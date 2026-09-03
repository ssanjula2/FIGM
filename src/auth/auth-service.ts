import crypto from 'node:crypto';
import { UserRole } from './user-db';

export interface UserPayload {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  // Present (and meaningful) only when this payload came from decoding a real access JWT via
  // verifyJWT -- see signJWT's tokenVersion parameter and auth-middleware.ts's authenticateUser,
  // which is the only real consumer (compares this against the user's current DB tokenVersion to
  // detect a revoked-by-logout token). Optional so every other UserPayload construction site
  // (login/register/refresh response bodies, tests) is unaffected.
  tokenVersion?: number;
}

export interface AuthSession {
  user: UserPayload;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

const PLACEHOLDER_SECRET_PATTERN = /YOUR_|CHANGE_?ME|<.*>|\bexample\b|\bplaceholder\b|\btodo\b|\bTBD\b/i;

/**
 * Environments where a predictable, source-committed fallback secret/credential is tolerable.
 * Deliberately an allow-list (not "anything that isn't 'production'"): an unset NODE_ENV, or an
 * unrecognized value like 'staging'/'preview', previously fell through to the insecure fallback
 * silently. Only local development and the automated test runner are exempted; every other value
 * -- including unset -- is treated as production-equivalent and fails closed.
 */
const INSECURE_FALLBACK_ALLOWED_ENVS = new Set(['development', 'test']);

export function isInsecureFallbackAllowed(): boolean {
  return INSECURE_FALLBACK_ALLOWED_ENVS.has(process.env.NODE_ENV || '');
}

/**
 * Fails fast if a secret is too short or looks like an unfilled template placeholder (e.g.
 * "YOUR_PRODUCTION_JWT_SECRET_STRING" from .env.example accidentally left in place), in any
 * environment where the insecure fallback isn't tolerated. Presence alone was previously the only
 * check -- any non-empty string, however weak, was accepted.
 */
function validateSecretStrength(secret: string, varName: string): void {
  if (isInsecureFallbackAllowed()) return;
  if (secret.length < 32) {
    throw new Error(`FATAL: ${varName} must be at least 32 characters (got ${secret.length}).`);
  }
  if (PLACEHOLDER_SECRET_PATTERN.test(secret)) {
    throw new Error(`FATAL: ${varName} looks like an unfilled template placeholder value.`);
  }
}

function resolveSecret(envVarName: 'JWT_SECRET' | 'REFRESH_SECRET', devFallback: string): string {
  const configured = process.env[envVarName];
  if (configured) {
    validateSecretStrength(configured, envVarName);
    return configured;
  }

  if (!isInsecureFallbackAllowed()) {
    // Fail closed. No predictable fallback is ever used outside development/test, regardless of
    // whether NODE_ENV is 'production', unset, 'staging', 'preview', or anything else -- closing
    // the loophole where only an exact NODE_ENV==='production' match used to trigger this check.
    throw new Error(
      `FATAL: ${envVarName} environment variable is missing. Refusing to start with a predictable ` +
      `fallback secret outside local development/test. Set ${envVarName} to a strong random value ` +
      `(e.g. \`openssl rand -hex 32\`).`
    );
  }

  // Local/dev/test convenience only: a fixed, source-committed value. Anyone with repo access can
  // forge tokens (including role:'ADMIN') signed with this secret -- acceptable only because this
  // branch is now unreachable outside development/test.
  // eslint-disable-next-line no-console
  console.error(
    `[auth-service] ${envVarName} is not set -- using the hardcoded default development secret. ` +
    'This is INSECURE outside local development/test.'
  );
  validateSecretStrength(devFallback, envVarName);
  return devFallback;
}

function getJwtSecret(): string {
  return resolveSecret('JWT_SECRET', 'figm-multi-tenant-super-secret-key-2026');
}

function getRefreshSecret(): string {
  return resolveSecret('REFRESH_SECRET', 'figm-multi-tenant-refresh-secret-key-2026');
}

/**
 * Constant-time string comparison for HMAC signatures, matching the timingSafeEqual pattern
 * already used for password verification below. A plain `!==` comparison on the signature would
 * short-circuit on the first differing byte, which is a (low-practicality but real) timing
 * side-channel for an attacker trying to forge a valid signature byte-by-byte.
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// SEC-06: scrypt (Node's built-in crypto.scryptSync, no new dependency and no native-binding
// build step -- important for serverless/Vercel deployment). N=2^16, r=8, p=1 is OWASP's own
// explicitly-endorsed lighter alternative to N=2^17 for resource/latency-constrained deployments
// (serverless function execution time and cold-start latency both cost real money/UX here) --
// still ~64MB working memory and a large, deliberate improvement over PBKDF2 at only 10,000
// iterations (well below current OWASP guidance for PBKDF2-SHA512, which calls for >=600,000).
// New hashes are tagged with a `scrypt:` prefix so the format is self-describing -- no separate DB
// column/migration needed. verifyPassword still accepts the old, untagged `salt:hash` PBKDF2
// format so every existing stored hash keeps working; needsRehash below lets the login route
// transparently upgrade a legacy hash to scrypt once the user's real password is available (i.e.
// right after a successful login), never forcing a reset or destroying accounts.
const SCRYPT_PREFIX = 'scrypt:';
const SCRYPT_KEYLEN = 64;
// maxmem must be strictly greater than the ~64MiB (128*N*r bytes) N=65536,r=8 actually needs --
// 128MiB gives generous headroom rather than sitting exactly on the boundary.
const SCRYPT_OPTIONS: crypto.ScryptOptions = { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

function scryptHashHex(password: string, salt: string): string {
  return (crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS) as Buffer).toString('hex');
}

/**
 * Hash password securely using scrypt (N=2^17, r=8, p=1) with a random salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = scryptHashHex(password, salt);
  return `${SCRYPT_PREFIX}${salt}:${hash}`;
}

/**
 * Verify plaintext password against a stored hash -- either the current `scrypt:salt:hash`
 * format, or a legacy, untagged `salt:hash` PBKDF2-SHA512 (10,000 iterations) hash from before
 * this fix, which must keep verifying correctly for every already-registered user.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;

  if (storedHash.startsWith(SCRYPT_PREFIX)) {
    const [salt, originalHash] = storedHash.slice(SCRYPT_PREFIX.length).split(':');
    if (!salt || !originalHash) return false;
    const hash = scryptHashHex(password, salt);
    const hashBuf = Buffer.from(hash, 'hex');
    const originalBuf = Buffer.from(originalHash, 'hex');
    if (hashBuf.length !== originalBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, originalBuf);
  }

  if (!storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  const hashBuf = Buffer.from(hash, 'hex');
  const originalBuf = Buffer.from(originalHash, 'hex');
  if (hashBuf.length !== originalBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, originalBuf);
}

/**
 * True if `storedHash` is in the legacy, untagged PBKDF2 format -- i.e. it should be transparently
 * rehashed to scrypt the next time the caller has the real plaintext password available (right
 * after a successful verifyPassword call, e.g. in the login route). Never true for an already
 * scrypt-hashed value, so this never causes needless re-hashing work on every login.
 */
export function needsRehash(storedHash: string): boolean {
  return !!storedHash && !storedHash.startsWith(SCRYPT_PREFIX);
}

/**
 * Sign Access JWT token for user session (Default: 1 hour / 3600s).
 *
 * `tokenVersion` must be the signing-time value of the user's DB `tokenVersion` column (every
 * caller has just read the user row anyway -- login/register/refresh routes). It is embedded in
 * the claim so authenticateUser() can detect and reject this exact token if the user logs out
 * (which bumps the DB value) before the token's own `exp` -- see prisma/schema.prisma's
 * tokenVersion doc comment. Required (positioned before the defaulted `expiresInSeconds`, since TS
 * forbids a required parameter after an optional one), so a caller can't accidentally mint a token
 * that silently bypasses revocation by omitting it.
 */
export function signJWT(payload: UserPayload, tokenVersion: number, expiresInSeconds = 3600): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    sub: payload.userId,
    email: payload.email,
    name: payload.fullName,
    // Normalized through the same allow-list verifyJWT decodes with below, so no caller -- however
    // it obtained `payload` -- can ever mint a claim outside {ADMIN, AUDITOR, DEVELOPER}. Route
    // handlers must still only ever pass a role read from the authenticated user's own DB record,
    // never a client-supplied field; this is defense-in-depth, not a substitute for that.
    role: validateRole(payload.role),
    tokenVersion,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(claim)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Sign Refresh Token for long-lived session renewal (Default: 7 days / 604800s)
 */
export function signRefreshToken(payload: UserPayload, expiresInSeconds = 604800): string {
  const header = { alg: 'HS256', typ: 'JWT', kind: 'refresh' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    sub: payload.userId,
    email: payload.email,
    kind: 'refresh',
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(claim)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', getRefreshSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode Access JWT token
 */
export function verifyJWT(token: string): UserPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', getJwtSecret())
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    if (!safeCompare(signature, expectedSignature)) return null;

    const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    const claim = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (claim.exp && claim.exp < now) return null;

    return {
      userId: claim.sub,
      email: claim.email,
      fullName: claim.name,
      // Same enum allow-list as signing (see signJWT). A token whose signature verifies but whose
      // role claim is outside {ADMIN, AUDITOR, DEVELOPER} is clamped to the least-privileged role
      // rather than trusted verbatim.
      role: validateRole(claim.role),
      // A token signed before this field existed (or any other malformed claim) decodes as 0 --
      // the same value a freshly-created/never-logged-out user's DB row starts at, so an old token
      // from before this feature shipped is treated as not-yet-revoked, not rejected outright.
      tokenVersion: typeof claim.tokenVersion === 'number' ? claim.tokenVersion : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Verify Refresh Token
 */
export function verifyRefreshToken(token: string): { userId: string; email: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', getRefreshSecret())
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    if (!safeCompare(signature, expectedSignature)) return null;

    const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    const claim = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (claim.exp && claim.exp < now) return null;
    if (claim.kind !== 'refresh') return null;

    return {
      userId: claim.sub,
      email: claim.email,
    };
  } catch {
    return null;
  }
}

/** Consent state carried inside a research-participant session token -- see
 *  signResearchParticipantToken's doc comment for why consent lives here rather than in a new DB
 *  column. `given` defaults to false on the token a fresh GET /api/user-study/log-scan issues;
 *  POST /api/user-study/consent is the only thing that ever re-signs a token with `given: true`. */
export interface ResearchParticipantConsent {
  given: boolean;
  version?: string;
  timestamp?: string;
}

/**
 * Signs a research-participant session token binding one browser session to exactly one
 * participant code (e.g. "P006"). Unlike a real user JWT, this never carries a role/identity
 * beyond the participant code itself -- the study is intentionally anonymous, with no login step
 * (see app/user-study/page.tsx). Reuses the same HMAC secret/format as signJWT rather than
 * inventing a second signing mechanism (see auth-authz forensic audit finding on
 * /api/user-study/log-scan: previously ANY caller could POST any participantId with no session
 * binding at all). 7-day expiry: long enough to span a real participant's return visit within the
 * same browser, short enough not to be a permanent forgeable credential.
 *
 * `consent` defaults to not-given -- callers that want a consent-bearing token must pass one
 * explicitly (see POST /api/user-study/consent, the only route that ever does). Binding consent to
 * this anonymous session token, rather than a new database column keyed by real identity, avoids
 * collecting any additional PII solely to enforce the consent gate.
 */
export function signResearchParticipantToken(
  participantCode: string,
  expiresInSeconds = 604800,
  consent: ResearchParticipantConsent = { given: false }
): string {
  const header = { alg: 'HS256', typ: 'JWT', kind: 'research_participant' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    sub: participantCode,
    kind: 'research_participant',
    iat: now,
    exp: now + expiresInSeconds,
    consentGiven: consent.given === true,
    consentVersion: consent.given ? consent.version : undefined,
    consentTimestamp: consent.given ? consent.timestamp : undefined,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(claim)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', getJwtSecret())
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verifies a research-participant session token and returns the participant code it is bound to
 * plus its consent state, or null if missing/malformed/expired/tampered/wrong-kind. Never trust a
 * client-supplied participantId for attribution -- this is the only source of truth for "which
 * participant does this request belong to," and consentGiven here is likewise the only source of
 * truth for whether study-interaction logging may proceed (see POST /api/user-study/log-scan).
 */
export function verifyResearchParticipantToken(
  token: string
): { participantCode: string; consentGiven: boolean; consentVersion?: string; consentTimestamp?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', getJwtSecret())
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    if (!safeCompare(signature, expectedSignature)) return null;

    const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    const claim = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (claim.exp && claim.exp < now) return null;
    if (claim.kind !== 'research_participant') return null;
    if (typeof claim.sub !== 'string' || !claim.sub) return null;

    return {
      participantCode: claim.sub,
      consentGiven: claim.consentGiven === true,
      consentVersion: typeof claim.consentVersion === 'string' ? claim.consentVersion : undefined,
      consentTimestamp: typeof claim.consentTimestamp === 'string' ? claim.consentTimestamp : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Generate secure random token for password reset
 */
export function generateResetToken(): { token: string; expiry: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins expiry
  return { token, expiry };
}

/**
 * Input Validation Utilities
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
}

export function validateRole(role?: string): UserRole {
  if (role === 'ADMIN' || role === 'AUDITOR' || role === 'DEVELOPER') {
    return role;
  }
  return 'DEVELOPER';
}
