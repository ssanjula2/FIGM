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
 * Fails fast in production if a secret is too short or looks like an unfilled template placeholder
 * (e.g. "YOUR_PRODUCTION_JWT_SECRET_STRING" from .env.example accidentally left in place). Presence
 * alone was previously the only check -- any non-empty string, however weak, was accepted.
 */
function validateSecretStrength(secret: string, varName: string): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (secret.length < 32) {
    throw new Error(`FATAL: ${varName} must be at least 32 characters in production (got ${secret.length}).`);
  }
  if (PLACEHOLDER_SECRET_PATTERN.test(secret)) {
    throw new Error(`FATAL: ${varName} looks like an unfilled template placeholder value in production.`);
  }
}

function getJwtSecret(): string {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is missing in production environment');
  }
  if (!process.env.JWT_SECRET) {
    // This fallback only exists so the app can boot in local/dev/test environments without a
    // .env file. It's a fixed value committed in source, so anyone with repo access can forge
    // tokens (including role:'ADMIN') for any deployment that reaches this branch -- which
    // happens whenever NODE_ENV isn't exactly 'production' (unset, 'staging', 'test', etc.).
    // eslint-disable-next-line no-console
    console.error('[auth-service] JWT_SECRET is not set -- using the hardcoded default development secret. This is INSECURE outside local development.');
  }
  const secret = process.env.JWT_SECRET || 'figm-multi-tenant-super-secret-key-2026';
  validateSecretStrength(secret, 'JWT_SECRET');
  return secret;
}

function getRefreshSecret(): string {
  if (process.env.NODE_ENV === 'production' && !process.env.REFRESH_SECRET) {
    throw new Error('FATAL: REFRESH_SECRET environment variable is missing in production environment');
  }
  if (!process.env.REFRESH_SECRET) {
    // eslint-disable-next-line no-console
    console.error('[auth-service] REFRESH_SECRET is not set -- using the hardcoded default development secret. This is INSECURE outside local development.');
  }
  const secret = process.env.REFRESH_SECRET || 'figm-multi-tenant-refresh-secret-key-2026';
  validateSecretStrength(secret, 'REFRESH_SECRET');
  return secret;
}

const JWT_SECRET = getJwtSecret();
const REFRESH_SECRET = getRefreshSecret();

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
    role: payload.role || 'DEVELOPER',
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(claim)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
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
    .createHmac('sha256', REFRESH_SECRET)
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
      .createHmac('sha256', JWT_SECRET)
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
      role: (claim.role as UserRole) || 'DEVELOPER',
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
      .createHmac('sha256', REFRESH_SECRET)
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
