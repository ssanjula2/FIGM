import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionClient, SESSION_EXPIRED_EVENT, type SessionStorage } from '../src/auth/session-client.js';

/**
 * Unit coverage for the client-side silent-refresh mechanism that closes the real production gap
 * (see src/auth/session-client.ts's own doc comment): a verified, authenticated AI-assisted fix
 * produced no AiHistory row because the 1-hour access-token cookie had expired and nothing ever
 * refreshed it. Every browser dependency (storage, fetch, timers, the session-expired signal) is
 * injected here so this runs in plain Node -- no DOM/browser needed, and no test leaks state into
 * another via the app's shared singleton (each test constructs its own SessionClient).
 */

function makeMemoryStorage(): SessionStorage {
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

/** Builds a syntactically-real (unsigned, test-only) JWT string with the given `exp` claim --
 *  session-client.ts only ever decodes the payload client-side, never verifies the signature (the
 *  httpOnly cookie is what the server actually verifies), so a fixture like this exercises the
 *  real decode path without needing the server's real signing secret. */
function fakeJwt(expEpochSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ userId: 'usr_test', exp: expEpochSeconds })).toString('base64url');
  return `${header}.${payload}.fake-signature-not-verified-client-side`;
}

/** Fake timer controller: setTimeoutFn/clearTimeoutFn/now are all driven by this instead of real
 *  wall-clock time, so "near expiry" and "already expired" can be tested deterministically and
 *  instantly instead of sleeping for real minutes. */
function makeFakeClock(startMs = 1_700_000_000_000) {
  let current = startMs;
  const pending = new Map<number, { at: number; cb: () => void }>();
  let nextId = 1;
  return {
    now: () => current,
    setTimeoutFn: (cb: () => void, ms: number) => {
      const id = nextId++;
      pending.set(id, { at: current + ms, cb });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeoutFn: (id: ReturnType<typeof setTimeout>) => {
      pending.delete(id as unknown as number);
    },
    /** Advances the fake clock and synchronously fires every timer now due, in schedule order. */
    advance: (ms: number) => {
      current += ms;
      const due = [...pending.entries()].filter(([, t]) => t.at <= current).sort((a, b) => a[1].at - b[1].at);
      for (const [id, t] of due) {
        pending.delete(id);
        t.cb();
      }
    },
    pendingCount: () => pending.size,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('valid session, no refresh needed: recordSession schedules a timer but it never fires before expiry margin', () => {
  const clock = makeFakeClock();
  let refreshCalls = 0;
  const fetchFn = (async () => {
    refreshCalls += 1;
    return jsonResponse(200, { accessToken: fakeJwt(0), user: { id: 'usr_test' } });
  }) as unknown as typeof fetch;
  const client = new SessionClient({
    storage: makeMemoryStorage(),
    fetchFn,
    now: clock.now,
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
  });

  const expInSeconds = Math.floor(clock.now() / 1000) + 3600; // 1 hour from "now"
  client.recordSession(fakeJwt(expInSeconds));

  // Advance to well before the 5-minute refresh margin -- nothing should fire.
  clock.advance(30 * 60 * 1000); // 30 minutes in
  assert.equal(refreshCalls, 0, 'no refresh should occur while the token is still comfortably valid');
});

test('access token near expiry -> silent refresh occurs automatically', async () => {
  const clock = makeFakeClock();
  let refreshCalls = 0;
  const fetchFn = (async () => {
    refreshCalls += 1;
    return jsonResponse(200, { accessToken: fakeJwt(Math.floor(clock.now() / 1000) + 3600), user: { id: 'usr_test' } });
  }) as unknown as typeof fetch;
  const client = new SessionClient({
    storage: makeMemoryStorage(),
    fetchFn,
    now: clock.now,
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
  });

  const expInSeconds = Math.floor(clock.now() / 1000) + 3600;
  client.recordSession(fakeJwt(expInSeconds));

  // Advance past (expiry - 5min margin) -- the scheduled silent refresh should fire.
  clock.advance(56 * 60 * 1000); // 56 minutes in -- inside the 5-minute margin before the 60-minute expiry
  // The timer callback fires refreshSession() but doesn't await it -- give the microtask queue a
  // turn to let the fake-fetch promise resolve.
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(refreshCalls, 1, 'a silent refresh must fire once the token is within its refresh margin of expiring');
});

test('expired token -> refreshSession() succeeds -> a retried request via authFetch succeeds', async () => {
  const clock = makeFakeClock();
  let refreshCalls = 0;
  let protectedCallCount = 0;
  const storage = makeMemoryStorage();

  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/auth/refresh') {
      refreshCalls += 1;
      return jsonResponse(200, { accessToken: fakeJwt(Math.floor(clock.now() / 1000) + 3600), user: { id: 'usr_test' } });
    }
    protectedCallCount += 1;
    // First call to the protected endpoint fails (stale/expired session); the retry after refresh
    // must succeed -- simulating the real server, which would now see the refreshed cookie.
    if (protectedCallCount === 1) {
      return jsonResponse(401, { error: 'Authentication token is invalid or expired', code: 'INVALID_TOKEN' });
    }
    return jsonResponse(200, { ok: true, verified: true });
  }) as unknown as typeof fetch;

  const client = new SessionClient({ storage, fetchFn, now: clock.now, setTimeoutFn: clock.setTimeoutFn, clearTimeoutFn: clock.clearTimeoutFn });
  storage.setItem('figm_user', JSON.stringify({ id: 'usr_test' }));

  const res = await client.authFetch('/api/scan', { method: 'POST' });
  const body = await res.json();

  assert.equal(refreshCalls, 1, 'exactly one refresh must occur');
  assert.equal(protectedCallCount, 2, 'the original request must be retried exactly once after a successful refresh');
  assert.equal(res.status, 200);
  assert.equal(body.verified, true, 'the retried request must succeed and return the real server response');
});

test('refresh failure -> session becomes unauthenticated (storage cleared, session-expired signaled, no retry)', async () => {
  const clock = makeFakeClock();
  let protectedCallCount = 0;
  const storage = makeMemoryStorage();
  storage.setItem('figm_user', JSON.stringify({ id: 'usr_test' }));
  storage.setItem('figm_token', 'stale-token');

  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/auth/refresh') {
      return jsonResponse(401, { error: 'Invalid or expired refresh token', code: 'INVALID_REFRESH_TOKEN' });
    }
    protectedCallCount += 1;
    return jsonResponse(401, { error: 'Authentication token is missing', code: 'UNAUTHORIZED' });
  }) as unknown as typeof fetch;

  let sessionExpiredSignaled = 0;
  const client = new SessionClient({
    storage,
    fetchFn,
    now: clock.now,
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
    onSessionExpired: () => {
      sessionExpiredSignaled += 1;
    },
  });

  const res = await client.authFetch('/api/scan', { method: 'POST' });

  assert.equal(protectedCallCount, 1, 'a failed refresh must never trigger a retry of the original request');
  assert.equal(res.status, 401, 'the caller receives the original (unretried) 401 response');
  assert.equal(sessionExpiredSignaled, 1, 'a definitively failed refresh must signal session-expired exactly once');
  assert.equal(storage.getItem('figm_token'), null, 'client-visible session state must be cleared on a confirmed-dead session');
  assert.equal(storage.getItem('figm_user'), null);
});

test('a network-level failure during refresh (fetch throws) does NOT clear session state -- only a definitive server rejection does', async () => {
  const clock = makeFakeClock();
  const storage = makeMemoryStorage();
  storage.setItem('figm_user', JSON.stringify({ id: 'usr_test' }));
  storage.setItem('figm_token', 'still-here');

  const fetchFn = (async () => {
    throw new Error('network offline');
  }) as unknown as typeof fetch;

  const client = new SessionClient({ storage, fetchFn, now: clock.now, setTimeoutFn: clock.setTimeoutFn, clearTimeoutFn: clock.clearTimeoutFn });
  const ok = await client.refreshSession();

  assert.equal(ok, false);
  assert.equal(storage.getItem('figm_token'), 'still-here', 'a transient network failure must never log a real user out');
  assert.equal(storage.getItem('figm_user'), JSON.stringify({ id: 'usr_test' }));
});

test('concurrent requests -> only one refresh request is ever sent (single-flight)', async () => {
  const clock = makeFakeClock();
  let refreshCalls = 0;
  let resolveRefresh: (() => void) | null = null;
  const refreshGate = new Promise<void>((resolve) => {
    resolveRefresh = resolve;
  });

  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/auth/refresh') {
      refreshCalls += 1;
      await refreshGate; // held open until we release it below, so both callers overlap in time
      return jsonResponse(200, { accessToken: fakeJwt(Math.floor(clock.now() / 1000) + 3600), user: { id: 'usr_test' } });
    }
    return jsonResponse(200, { ok: true });
  }) as unknown as typeof fetch;

  const client = new SessionClient({ storage: makeMemoryStorage(), fetchFn, now: clock.now, setTimeoutFn: clock.setTimeoutFn, clearTimeoutFn: clock.clearTimeoutFn });

  const p1 = client.refreshSession();
  const p2 = client.refreshSession();
  resolveRefresh!();
  const [r1, r2] = await Promise.all([p1, p2]);

  assert.equal(refreshCalls, 1, 'two concurrent refreshSession() calls must share exactly one in-flight request');
  assert.equal(r1, true);
  assert.equal(r2, true);
});

test('no infinite retry: a second consecutive 401 after the retry is returned as-is, never retried again', async () => {
  const clock = makeFakeClock();
  let refreshCalls = 0;
  let protectedCallCount = 0;
  const storage = makeMemoryStorage();
  storage.setItem('figm_user', JSON.stringify({ id: 'usr_test' }));

  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/auth/refresh') {
      refreshCalls += 1;
      return jsonResponse(200, { accessToken: fakeJwt(Math.floor(clock.now() / 1000) + 3600), user: { id: 'usr_test' } });
    }
    protectedCallCount += 1;
    // Every call to the protected endpoint fails, even after refresh (e.g. account disabled
    // between the refresh and the retry) -- must not loop.
    return jsonResponse(401, { error: 'Authentication token is invalid or expired', code: 'INVALID_TOKEN' });
  }) as unknown as typeof fetch;

  const client = new SessionClient({ storage, fetchFn, now: clock.now, setTimeoutFn: clock.setTimeoutFn, clearTimeoutFn: clock.clearTimeoutFn });
  const res = await client.authFetch('/api/scan', { method: 'POST' });

  assert.equal(refreshCalls, 1, 'refresh is attempted exactly once, never repeated');
  assert.equal(protectedCallCount, 2, 'the original request is attempted, then retried exactly once -- never a third time');
  assert.equal(res.status, 401);
});

test('logout disables future refresh: markLoggedOut prevents both init() and refreshSession() from doing anything', async () => {
  const clock = makeFakeClock();
  let refreshCalls = 0;
  const storage = makeMemoryStorage();
  const fetchFn = (async () => {
    refreshCalls += 1;
    return jsonResponse(200, { accessToken: fakeJwt(Math.floor(clock.now() / 1000) + 3600) });
  }) as unknown as typeof fetch;
  const client = new SessionClient({ storage, fetchFn, now: clock.now, setTimeoutFn: clock.setTimeoutFn, clearTimeoutFn: clock.clearTimeoutFn });

  storage.setItem('figm_user', JSON.stringify({ id: 'usr_test' }));
  storage.setItem('figm_token_exp', String(Math.floor(clock.now() / 1000) + 3600));
  client.markLoggedOut();

  // init() must not resurrect a refresh cycle after logout, even though a plausible session
  // (figm_user/figm_token_exp) is technically still readable in storage at this instant.
  client.init();
  assert.equal(clock.pendingCount(), 0, 'no refresh timer may be scheduled after logout');

  const ok = await client.refreshSession();
  assert.equal(ok, false, 'refreshSession() must be a no-op after logout');
  assert.equal(refreshCalls, 0, 'no network request may ever be made after logout');
});

test('an unrecognized/non-retriable 401 (e.g. TOKEN_REVOKED) is treated as a definitive session end, never retried', async () => {
  const clock = makeFakeClock();
  let refreshCalls = 0;
  let protectedCallCount = 0;
  const storage = makeMemoryStorage();
  storage.setItem('figm_user', JSON.stringify({ id: 'usr_test' }));

  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/auth/refresh') {
      refreshCalls += 1;
      return jsonResponse(200, { accessToken: fakeJwt(Math.floor(clock.now() / 1000) + 3600) });
    }
    protectedCallCount += 1;
    return jsonResponse(401, { error: 'Session has been revoked, please log in again', code: 'TOKEN_REVOKED' });
  }) as unknown as typeof fetch;

  let sessionExpiredSignaled = 0;
  const client = new SessionClient({
    storage,
    fetchFn,
    now: clock.now,
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
    onSessionExpired: () => {
      sessionExpiredSignaled += 1;
    },
  });

  const res = await client.authFetch('/api/scan', { method: 'POST' });

  assert.equal(refreshCalls, 0, 'a revoked session must never attempt a refresh that cannot succeed');
  assert.equal(protectedCallCount, 1, 'the original request is never retried for a non-retriable reason');
  assert.equal(res.status, 401);
  assert.equal(sessionExpiredSignaled, 1);
  assert.equal(storage.getItem('figm_user'), null, 'a revoked session must clear client-visible state immediately');
});

test('init() never treats an anonymous visitor (no known session) as authenticated', async () => {
  const clock = makeFakeClock();
  let refreshCalls = 0;
  const storage = makeMemoryStorage(); // deliberately empty -- no figm_user, no prior session at all
  const fetchFn = (async () => {
    refreshCalls += 1;
    return jsonResponse(200, {});
  }) as unknown as typeof fetch;
  const client = new SessionClient({ storage, fetchFn, now: clock.now, setTimeoutFn: clock.setTimeoutFn, clearTimeoutFn: clock.clearTimeoutFn });

  client.init();
  assert.equal(clock.pendingCount(), 0, 'no refresh timer may be scheduled for a visitor with no known session');
  assert.equal(refreshCalls, 0);
});

test('init() resumes a silent refresh across a simulated page reload using only the persisted expiry', async () => {
  const clock = makeFakeClock();
  let refreshCalls = 0;
  const storage = makeMemoryStorage();
  const fetchFn = (async () => {
    refreshCalls += 1;
    return jsonResponse(200, { accessToken: fakeJwt(Math.floor(clock.now() / 1000) + 3600), user: { id: 'usr_test' } });
  }) as unknown as typeof fetch;

  // Simulate what a real page reload leaves behind in storage: a known user and a persisted
  // expiry, but no in-memory timer (a fresh SessionClient below has never called recordSession).
  storage.setItem('figm_user', JSON.stringify({ id: 'usr_test' }));
  storage.setItem('figm_token_exp', String(Math.floor(clock.now() / 1000) + 60)); // expires in 60s -- already within the 5-minute margin

  const client = new SessionClient({ storage, fetchFn, now: clock.now, setTimeoutFn: clock.setTimeoutFn, clearTimeoutFn: clock.clearTimeoutFn });
  client.init();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(refreshCalls, 1, 'init() must refresh immediately when the persisted expiry is already within the refresh margin');
});
