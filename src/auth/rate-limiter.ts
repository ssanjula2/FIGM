import { NextResponse } from 'next/server';
import { getPrismaClient } from '../db/prisma-client';

interface RateLimitWindow {
  count: number;
  resetTime: number;
}

// In-process fallback, used only when Postgres is unavailable. Ineffective across multiple
// serverless instances on its own -- see the DB-backed path below, which is the real fix.
const rateLimitMap = new Map<string, RateLimitWindow>();
let warnedFallback = false;

function checkRateLimitInMemory(ip: string, maxRequests: number, windowMs: number): NextResponse | null {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };

  if (now > entry.resetTime) {
    entry.count = 0;
    entry.resetTime = now + windowMs;
  }

  entry.count += 1;
  rateLimitMap.set(ip, entry);

  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return buildRateLimitResponse(retryAfter);
  }
  return null;
}

function buildRateLimitResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      error: `Too many requests. Please try again in ${retryAfterSeconds} seconds.`,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: retryAfterSeconds,
    },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  );
}

/**
 * Enforce IP-based rate limiting on sensitive auth endpoints. Backed by the real `audit_logs` table
 * (already written by every call site that uses this function -- see AuditLogger.logEvent calls in
 * the auth routes) when Postgres is connected, so the limit is genuinely shared across serverless
 * instances instead of being per-instance-only. Falls back to an in-process Map (logged once, not
 * silently) only when Postgres is unavailable.
 *
 * @param ip Client IP identifier
 * @param maxRequests Maximum allowed requests in window
 * @param windowMs Window duration in milliseconds (default 60s)
 */
export async function checkRateLimit(
  ip: string,
  maxRequests = 10,
  windowMs = 60 * 1000
): Promise<NextResponse | null> {
  const prisma = getPrismaClient();
  if (!prisma) {
    if (!warnedFallback) {
      warnedFallback = true;
      // eslint-disable-next-line no-console
      console.error('[rate-limiter] Postgres unavailable; falling back to in-process rate limiting (NOT shared across serverless instances).');
    }
    return checkRateLimitInMemory(ip, maxRequests, windowMs);
  }

  try {
    const windowStart = new Date(Date.now() - windowMs);
    const recentCount = await prisma.auditLog.count({
      where: { ipAddress: ip, createdAt: { gte: windowStart } },
    });

    if (recentCount >= maxRequests) {
      return buildRateLimitResponse(Math.ceil(windowMs / 1000));
    }
    return null;
  } catch (err) {
    // If the DB check itself fails, don't fail the whole request open silently without a trace --
    // log it and fall back to the in-process check so the endpoint still has *some* protection.
    console.error('[rate-limiter] DB-backed rate limit check failed, falling back to in-process check:', err instanceof Error ? err.message : err);
    return checkRateLimitInMemory(ip, maxRequests, windowMs);
  }
}
