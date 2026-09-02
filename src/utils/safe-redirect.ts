/**
 * Only a same-origin relative path is a safe post-login redirect target. `//evil.com` and
 * `/\evil.com` are protocol-relative URLs that a bare `startsWith('/')` check wrongly admits --
 * browsers treat them as absolute URLs to a different origin. Reject anything that isn't a single
 * `/` followed by a non-slash, non-backslash character (or nothing).
 */
export function isSafeRedirect(target: string | null): target is string {
  if (!target) return false;
  if (!target.startsWith('/')) return false;
  if (target.startsWith('//') || target.startsWith('/\\')) return false;
  return true;
}
