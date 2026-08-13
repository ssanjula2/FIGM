import crypto from 'node:crypto';
import { UserRole } from './user-db';

export interface UserPayload {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
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

/**
 * Hash password securely using PBKDF2 with SHA-512 and salt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify plaintext password against stored salt:hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(originalHash));
}

/**
 * Sign Access JWT token for user session (Default: 1 hour / 3600s)
 */
export function signJWT(payload: UserPayload, expiresInSeconds = 3600): string {
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
