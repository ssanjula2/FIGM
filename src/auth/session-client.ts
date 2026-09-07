/**
 * Framework-Independent Guideline Model (FIGM)
 * Client-side session refresh -- closes the gap found via real production Vercel logs
 * (`[api/scan] fix-interaction telemetry skipped: caller not authenticated (reason=UNAUTHORIZED,
 * ruleId=FIGM-REACT-01)`): the httpOnly `figm_token` access-token cookie has a hard 1-hour
 * lifetime (see app/api/auth/login/route.ts's `signJWT(..., 3600)`), and nothing anywhere in this
 * codebase ever called the existing `POST /api/auth/refresh` route to renew it. Any Live Scan
 * session left open past an hour silently loses every auth-gated side effect (AiHistory
 * telemetry, research eligibility writes, etc.) while the core scan/fix features -- which don't
 * require auth -- keep working, masking the problem.
 *
 * This module never touches AI provider routing, patch generation, validation, re-scan behavior,
 * AiHistory storage, or research eligibility rules -- it only keeps the existing refresh-token
 * flow (POST /api/auth/refresh, the figm_refresh_token cookie) exercised before/around the access
 * token's own expiry, and reactively for any OTHER authenticated route that returns a real 401.
 *
 * Testable in plain Node (no DOM): every browser dependency (storage, fetch, timers, the
 * session-expired signal) is injectable via the constructor, defaulting to the real
 * window/localStorage/fetch/setTimeout at call time -- never at import time -- so importing this
 * module never throws outside a browser.
 */

const REFRESH_MARGIN_MS = 5 * 60 * 1000; // proactively refresh 5 minutes before the token's own expiry
const MIN_DELAY_MS = 1000; // never schedule a zero/negative-delay timer -- fire almost immediately instead
const MAX_TIMEOUT_MS = 2_147_483_647; // setTimeout's max representable delay (~24.8 days)

const TOKEN_EXP_KEY = 'figm_token_exp';
const LOGGED_OUT_KEY = 'figm_logged_out';
const USER_KEY = 'figm_user';
const TOKEN_KEY = 'figm_token';

/** Reasons authenticateUser() (src/auth/auth-middleware.ts) returns on a 401 that a fresh access
 *  token could plausibly fix. TOKEN_REVOKED is deliberately excluded: a revoked session's refresh
 *  token is invalidated at the same time (see app/api/auth/logout/route.ts's tokenVersion bump),
 *  so /api/auth/refresh would fail identically -- retrying would just repeat the same failure. */
const AUTH_RETRY_CODES = new Set(['UNAUTHORIZED', 'INVALID_TOKEN']);

export const SESSION_EXPIRED_EVENT = 'figm:session-expired';

export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SessionClientDeps {
  storage?: SessionStorage;
  fetchFn?: typeof fetch;
  now?: () => number;
  setTimeoutFn?: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (id: ReturnType<typeof setTimeout>) => void;
  /** Called when a session is confirmed dead (refresh failed, or a non-retriable 401 occurred).
   *  Defaults to dispatching SESSION_EXPIRED_EVENT on window -- app/AppShell.tsx listens for this
   *  and navigates to /auth/login, the same destination Sidebar's own logout handler already uses. */
  onSessionExpired?: () => void;
}

/** In-memory fallback so importing/using this module outside a browser (e.g. this file's own
 *  tests, or an accidental server-side import) never throws -- it simply never persists, which is
 *  correct there since there is no real session to protect. */
function createInMemoryStorage(): SessionStorage {
  const mem = new Map<string, string>();
  return {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
    removeItem: (k) => {
      mem.delete(k);
    },
  };
}

/** Decodes only the `exp` claim, purely client-side, from the JWT string login/refresh responses
 *  already return in their JSON body -- the token itself is never sent anywhere by this module;
 *  the httpOnly cookie the server already set is what actually authenticates requests. `atob` is a
 *  real global in both browsers and modern Node (used here so this decodes identically in tests). */
function decodeJwtExpirySeconds(token: string): number | null {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) return null;
    let base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';
    const claims = JSON.parse(atob(base64));
    return typeof claims.exp === 'number' ? claims.exp : null;
  } catch {
    return null;
  }
}

export class SessionClient {
  private storage: SessionStorage;
  private fetchFn: typeof fetch;
  private now: () => number;
  private setTimeoutFn: (cb: () => void, ms: number) => ReturnType<typeof setTimeout>;
  private clearTimeoutFn: (id: ReturnType<typeof setTimeout>) => void;
  private onSessionExpired: () => void;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlightRefresh: Promise<boolean> | null = null;

  constructor(deps: SessionClientDeps = {}) {
    this.storage =
      deps.storage ?? (typeof window !== 'undefined' && window.localStorage ? window.localStorage : createInMemoryStorage());
    this.fetchFn = deps.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
    this.now = deps.now ?? (() => Date.now());
    this.setTimeoutFn = deps.setTimeoutFn ?? ((cb, ms) => setTimeout(cb, ms));
    this.clearTimeoutFn = deps.clearTimeoutFn ?? ((id) => clearTimeout(id));
    this.onSessionExpired =
      deps.onSessionExpired ??
      (() => {
        if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      });
  }

  private isLoggedOut(): boolean {
    return this.storage.getItem(LOGGED_OUT_KEY) === '1';
  }

  private cancelScheduledRefresh(): void {
    if (this.refreshTimer !== null) {
      this.clearTimeoutFn(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private scheduleSilentRefresh(expEpochSeconds: number): void {
    this.cancelScheduledRefresh();
    const rawDelay = expEpochSeconds * 1000 - this.now() - REFRESH_MARGIN_MS;
    const delay = Math.min(Math.max(rawDelay, MIN_DELAY_MS), MAX_TIMEOUT_MS);
    this.refreshTimer = this.setTimeoutFn(() => {
      this.refreshTimer = null;
      if (this.isLoggedOut()) return;
      void this.refreshSession();
    }, delay);
  }

  /**
   * Records a freshly-issued access token (call after login/register succeeds, and internally
   * after every successful refresh) so the next silent refresh can be scheduled relative to its
   * real expiry. Clears any prior logged-out flag -- a fresh login always supersedes it.
   */
  recordSession(accessToken: string): void {
    this.storage.removeItem(LOGGED_OUT_KEY);
    const exp = decodeJwtExpirySeconds(accessToken);
    if (exp === null) return; // can't schedule proactively; authFetch's reactive path still covers this session
    this.storage.setItem(TOKEN_EXP_KEY, String(exp));
    this.scheduleSilentRefresh(exp);
  }

  /**
   * Resumes silent refresh after a page load/reload (the in-memory timer above is lost on reload,
   * but the expiry recorded by recordSession persists in storage). Call once per app mount.
   * A no-op when no session is known client-side at all -- never treats an anonymous visitor as
   * authenticated, and never attempts a refresh after an explicit logout.
   */
  init(): void {
    if (this.isLoggedOut()) return;
    if (this.storage.getItem(USER_KEY) === null) return;
    const expRaw = this.storage.getItem(TOKEN_EXP_KEY);
    const exp = expRaw !== null ? Number(expRaw) : NaN;
    if (!Number.isFinite(exp)) return;
    const msUntilExpiry = exp * 1000 - this.now();
    if (msUntilExpiry <= REFRESH_MARGIN_MS) {
      void this.refreshSession();
    } else {
      this.scheduleSilentRefresh(exp);
    }
  }

  /**
   * Single-flight: concurrent callers (a proactive timer firing at the same moment as a reactive
   * authFetch retry, or several authFetch calls racing) share one in-progress POST
   * /api/auth/refresh instead of firing N parallel requests. Never attempted after logout.
   *
   * A network-level failure (fetch itself throws -- e.g. genuinely offline) does NOT clear session
   * state: it only means the refresh could not be VERIFIED, not that the server rejected it, so a
   * dropped connection must never silently log a real user out. Only a definitive non-OK response
   * (the server itself invalidating the refresh token) clears the session.
   */
  refreshSession(): Promise<boolean> {
    if (this.isLoggedOut()) return Promise.resolve(false);
    if (this.inFlightRefresh) return this.inFlightRefresh;

    this.inFlightRefresh = (async () => {
      try {
        const res = await this.fetchFn('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          this.clearSession();
          return false;
        }
        const data = await res.json().catch(() => null);
        if (data?.user) {
          this.storage.setItem(USER_KEY, JSON.stringify(data.user));
        }
        if (typeof data?.accessToken === 'string') {
          this.storage.setItem(TOKEN_KEY, data.accessToken);
          this.recordSession(data.accessToken);
        }
        return true;
      } catch {
        return false;
      } finally {
        this.inFlightRefresh = null;
      }
    })();
    return this.inFlightRefresh;
  }

  /** Clears client-visible session state. Never touches the httpOnly cookies themselves -- by the
   *  time this runs they are either already invalid (refresh was rejected) or already cleared
   *  server-side (POST /api/auth/logout already did that). */
  clearSession(): void {
    this.cancelScheduledRefresh();
    this.storage.removeItem(TOKEN_KEY);
    this.storage.removeItem(USER_KEY);
    this.storage.removeItem(TOKEN_EXP_KEY);
  }

  /**
   * Marks this session as explicitly logged out: refreshSession()/init() become permanent no-ops
   * until the next recordSession() call (a fresh login). Call from the app's existing logout
   * handler (app/Sidebar.tsx) alongside its own POST /api/auth/logout call.
   */
  markLoggedOut(): void {
    this.cancelScheduledRefresh();
    this.storage.setItem(LOGGED_OUT_KEY, '1');
    this.clearSession();
  }

  /**
   * Fetch wrapper for authenticated requests. On a 401 whose machine-readable `code`
   * (authenticateUser's own response shape) indicates a missing/expired access token, refreshes
   * once (single-flight, see refreshSession) and retries the ORIGINAL request exactly once --
   * never recurses, so a second consecutive 401 after the retry (e.g. the account was disabled
   * between the refresh and the retry) is returned to the caller as-is instead of looping.
   *
   * A 401 that is NOT one of AUTH_RETRY_CODES (TOKEN_REVOKED, or an unrecognized/non-JSON body) is
   * treated as a definitive session end -- marks logged out and signals SESSION_EXPIRED_EVENT
   * without attempting a refresh that cannot succeed.
   */
  async authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const first = await this.fetchFn(input, init);
    if (first.status !== 401) return first;

    let code: string | undefined;
    try {
      code = (await first.clone().json())?.code;
    } catch {
      // Non-JSON 401 body -- cannot classify the reason, so don't guess; surface it unchanged.
    }

    if (!code) return first;

    if (!AUTH_RETRY_CODES.has(code)) {
      this.markLoggedOut();
      this.onSessionExpired();
      return first;
    }

    const refreshed = await this.refreshSession();
    if (!refreshed) {
      this.onSessionExpired();
      return first;
    }

    return this.fetchFn(input, init);
  }
}

/** The one shared instance the app actually uses -- a fresh SessionClient() for tests instead, so
 *  test state never leaks between cases via this singleton's internal timer/in-flight-promise. */
export const sessionClient = new SessionClient();
