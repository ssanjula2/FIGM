/**
 * Explicit, allow-listed CORS policy for /api/*.
 *
 * Before this module existed, the codebase had zero CORS configuration anywhere -- no route set
 * Access-Control-Allow-Origin, so browsers fell back to same-origin-only by default. That was
 * "safe by omission" but also meant there was no reviewable, testable policy at all, and no
 * guard against someone later adding a wildcard origin (e.g. copy-pasting a permissive dev
 * snippet) without noticing the implications.
 *
 * Policy:
 *  - Origins are matched against an explicit allow-list (ALLOWED_ORIGINS env var, comma
 *    separated; falls back to NEXT_PUBLIC_APP_URL). Never a wildcard.
 *  - Access-Control-Allow-Credentials is never set. This app's real client-side auth mechanism
 *    is an `Authorization: Bearer <token>` header read from localStorage (see
 *    docs/audit/CSRF_REVIEW.md), not automatic credentialed cookie transmission, so credentialed
 *    CORS isn't needed. Never combine a non-wildcard allow-list with credentials:true without
 *    re-reading that review first -- that combination is the classic CORS misconfiguration this
 *    module exists to prevent.
 */

const DEFAULT_ALLOWED_METHODS = 'GET, POST, PATCH, PUT, DELETE, OPTIONS';
const DEFAULT_ALLOWED_HEADERS = 'Content-Type, Authorization';

export function getAllowedOrigins(): string[] {
  const fromEnv = process.env.ALLOWED_ORIGINS;
  if (fromEnv && fromEnv.trim() !== '') {
    return fromEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  return appUrl ? [appUrl] : [];
}

export function isOriginAllowed(origin: string | null, allowedOrigins: string[] = getAllowedOrigins()): boolean {
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

/**
 * Builds the CORS response headers for a given request Origin. Returns headers with no
 * Access-Control-Allow-Origin key at all when the origin isn't on the allow-list -- never a
 * wildcard fallback.
 */
export function buildCorsHeaders(origin: string | null, allowedOrigins: string[] = getAllowedOrigins()): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' };

  if (isOriginAllowed(origin, allowedOrigins)) {
    headers['Access-Control-Allow-Origin'] = origin as string;
    headers['Access-Control-Allow-Methods'] = DEFAULT_ALLOWED_METHODS;
    headers['Access-Control-Allow-Headers'] = DEFAULT_ALLOWED_HEADERS;
    headers['Access-Control-Max-Age'] = '86400';
  }

  return headers;
}
