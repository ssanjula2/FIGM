import { NextResponse } from 'next/server';

interface RateLimitWindow {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitWindow>();

/**
 * Enforce IP-based rate limiting on sensitive auth endpoints
 * @param ip Client IP identifier
 * @param maxRequests Maximum allowed requests in window
 * @param windowMs Window duration in milliseconds (default 60s)
 */
export function checkRateLimit(
  ip: string,
  maxRequests = 10,
  windowMs = 60 * 1000
): NextResponse | null {
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
    return NextResponse.json(
      {
        error: `Too many requests. Please try again in ${retryAfter} seconds.`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  return null;
}
