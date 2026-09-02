/**
 * Shared constant for the anonymous research-participant session cookie name, used by both
 * app/api/user-study/log-scan/route.ts and app/api/user-study/consent/route.ts. Deliberately NOT
 * exported from either route.ts file -- Next.js's App Router route-handler type validation only
 * permits a fixed set of recognized exports (GET/POST/etc., config, dynamic, revalidate, ...) from
 * a route.ts module, and rejects any other export (including a plain constant) at build time.
 */
export const STUDY_COOKIE = 'figm_study_token';
