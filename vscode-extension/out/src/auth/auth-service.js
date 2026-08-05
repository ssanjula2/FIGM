"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.signJWT = signJWT;
exports.signRefreshToken = signRefreshToken;
exports.verifyJWT = verifyJWT;
exports.verifyRefreshToken = verifyRefreshToken;
exports.generateResetToken = generateResetToken;
exports.validateEmail = validateEmail;
exports.validatePassword = validatePassword;
exports.validateRole = validateRole;
const node_crypto_1 = __importDefault(require("node:crypto"));
function getJwtSecret() {
    if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
        throw new Error('FATAL: JWT_SECRET environment variable is missing in production environment');
    }
    return process.env.JWT_SECRET || 'figm-multi-tenant-super-secret-key-2026';
}
function getRefreshSecret() {
    if (process.env.NODE_ENV === 'production' && !process.env.REFRESH_SECRET) {
        throw new Error('FATAL: REFRESH_SECRET environment variable is missing in production environment');
    }
    return process.env.REFRESH_SECRET || 'figm-multi-tenant-refresh-secret-key-2026';
}
const JWT_SECRET = getJwtSecret();
const REFRESH_SECRET = getRefreshSecret();
/**
 * Hash password securely using PBKDF2 with SHA-512 and salt
 */
function hashPassword(password) {
    const salt = node_crypto_1.default.randomBytes(16).toString('hex');
    const hash = node_crypto_1.default.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}
/**
 * Verify plaintext password against stored salt:hash
 */
function verifyPassword(password, storedHash) {
    if (!storedHash || !storedHash.includes(':'))
        return false;
    const [salt, originalHash] = storedHash.split(':');
    if (!salt || !originalHash)
        return false;
    const hash = node_crypto_1.default.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return node_crypto_1.default.timingSafeEqual(Buffer.from(hash), Buffer.from(originalHash));
}
/**
 * Sign Access JWT token for user session (Default: 1 hour / 3600s)
 */
function signJWT(payload, expiresInSeconds = 3600) {
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
    const signature = node_crypto_1.default
        .createHmac('sha256', JWT_SECRET)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64url');
    return `${encodedHeader}.${encodedPayload}.${signature}`;
}
/**
 * Sign Refresh Token for long-lived session renewal (Default: 7 days / 604800s)
 */
function signRefreshToken(payload, expiresInSeconds = 604800) {
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
    const signature = node_crypto_1.default
        .createHmac('sha256', REFRESH_SECRET)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64url');
    return `${encodedHeader}.${encodedPayload}.${signature}`;
}
/**
 * Verify and decode Access JWT token
 */
function verifyJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        const [encodedHeader, encodedPayload, signature] = parts;
        const expectedSignature = node_crypto_1.default
            .createHmac('sha256', JWT_SECRET)
            .update(`${encodedHeader}.${encodedPayload}`)
            .digest('base64url');
        if (signature !== expectedSignature)
            return null;
        const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
        const claim = JSON.parse(payloadJson);
        const now = Math.floor(Date.now() / 1000);
        if (claim.exp && claim.exp < now)
            return null;
        return {
            userId: claim.sub,
            email: claim.email,
            fullName: claim.name,
            role: claim.role || 'DEVELOPER',
        };
    }
    catch {
        return null;
    }
}
/**
 * Verify Refresh Token
 */
function verifyRefreshToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        const [encodedHeader, encodedPayload, signature] = parts;
        const expectedSignature = node_crypto_1.default
            .createHmac('sha256', REFRESH_SECRET)
            .update(`${encodedHeader}.${encodedPayload}`)
            .digest('base64url');
        if (signature !== expectedSignature)
            return null;
        const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
        const claim = JSON.parse(payloadJson);
        const now = Math.floor(Date.now() / 1000);
        if (claim.exp && claim.exp < now)
            return null;
        if (claim.kind !== 'refresh')
            return null;
        return {
            userId: claim.sub,
            email: claim.email,
        };
    }
    catch {
        return null;
    }
}
/**
 * Generate secure random token for password reset
 */
function generateResetToken() {
    const token = node_crypto_1.default.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins expiry
    return { token, expiry };
}
/**
 * Input Validation Utilities
 */
function validateEmail(email) {
    if (!email || typeof email !== 'string')
        return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
}
function validatePassword(password) {
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
function validateRole(role) {
    if (role === 'ADMIN' || role === 'AUDITOR' || role === 'DEVELOPER') {
        return role;
    }
    return 'DEVELOPER';
}
//# sourceMappingURL=auth-service.js.map