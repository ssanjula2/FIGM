"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRateLimit = checkRateLimit;
const server_1 = require("next/server");
const rateLimitMap = new Map();
/**
 * Enforce IP-based rate limiting on sensitive auth endpoints
 * @param ip Client IP identifier
 * @param maxRequests Maximum allowed requests in window
 * @param windowMs Window duration in milliseconds (default 60s)
 */
function checkRateLimit(ip, maxRequests = 10, windowMs = 60 * 1000) {
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
        return server_1.NextResponse.json({
            error: `Too many requests. Please try again in ${retryAfter} seconds.`,
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter,
        }, {
            status: 429,
            headers: {
                'Retry-After': String(retryAfter),
            },
        });
    }
    return null;
}
//# sourceMappingURL=rate-limiter.js.map