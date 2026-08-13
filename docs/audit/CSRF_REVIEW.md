# CSRF Review — FIGM API

**Scope**: Every state-changing (`POST`/`PATCH`/`PUT`/`DELETE`) route under `app/api/**`.
**Date**: 2026-08-13. Written as part of the API security audit alongside the authorization,
rate-limiting, and CORS fixes in the same change.

## 1. Is CSRF protection required here?

CSRF is a threat against **cookie-based authentication**: a browser that already holds a session
cookie for `figm.example` will still attach it automatically to a cross-site request forged by
`evil.example` (a hidden form auto-submit, an `<img>`-triggered GET, etc.), unless something
stops it. Bearer-token-in-header authentication is structurally immune to this, because a
cross-site page cannot read another origin's `localStorage` or set an arbitrary `Authorization`
header on a simple cross-site form/navigation request.

This app uses **both** mechanisms:

1. **Primary path (what the actual frontend uses)**: `POST /api/auth/login` (and `register`,
   `refresh`) return `accessToken`/`refreshToken` in the JSON response body. The client
   (`app/auth/login/page.tsx`, `app/login/page.tsx`) stores these in `localStorage` and every
   subsequent authenticated `fetch()` call sends `Authorization: Bearer <token>` explicitly (see
   e.g. `app/components/dashboard/LiveDashboardContent.tsx`, `app/admin/page.tsx`). **This path
   is CSRF-immune by construction.**
2. **Fallback path (defense-in-depth / non-JS clients)**: the same login/register/refresh
   responses *also* set `figm_token`/`figm_refresh_token` as `httpOnly` cookies, and
   `authenticateUser()` (`src/auth/auth-middleware.ts`) accepts either the `Authorization` header
   **or** the cookie. If a browser ever sends a request relying solely on the cookie (no header
   set — e.g. a non-JS form post, or a future code path that forgets to set the header), that
   request is theoretically forgeable cross-site unless the cookie itself is protected.

**Conclusion: yes, protection is required**, because the server still *accepts* cookie-only
authentication even though the shipped frontend doesn't currently rely on it that way. Treating
"the frontend happens to always send a header" as sufficient protection would be fragile — a
future page, a different client (mobile webview, browser extension, curl script someone pastes
into a form-based tool), or a bug that drops the `Authorization` header could silently fall back
to the forgeable cookie path.

## 2. What protection is actually implemented

Rather than adding a separate CSRF token (double-submit cookie / synchronizer token), which would
be redundant with the header-based auth the app already uses, protection is layered at the
**cookie** level, since that's the only path where CSRF is even a meaningful threat here:

- **`SameSite=Strict`** on both `figm_token` and `figm_refresh_token`, set on every cookie-writing
  route (`login`, `register`, `refresh`, and cleared the same way on `logout`). `Strict` cookies
  are never attached to cross-site requests at all — not even top-level navigations — which is
  the strongest browser-native CSRF mitigation available and blocks every classic CSRF vector
  (forged forms, cross-site `fetch`, `<img>`/`<script>`-triggered GETs). This was previously
  `SameSite=Lax`, which still allows the cookie on cross-site top-level GET navigations; `Strict`
  closes that gap. No part of this app's own flow depends on a cross-site navigation carrying the
  auth cookie (login/refresh are same-site `fetch()` calls, and password reset uses a token, not
  the cookie), so tightening to `Strict` has no functional downside here.
- **`Secure` in production** (`secure: process.env.NODE_ENV === 'production'`) — previously
  unset. Ensures the cookie is never sent over plain HTTP once deployed, so it can't be
  intercepted and replayed by a network attacker, which would otherwise be a separate way to
  obtain a working session without needing CSRF at all. Left conditional on `NODE_ENV` (rather
  than always `true`) so local HTTP development still works.
- **`httpOnly`** (already present, unchanged) — the cookie is inaccessible to JavaScript, so even
  if the cookie fallback path is used, XSS on the site can't directly read the token out of the
  cookie jar (it *could* still ride the cookie to issue authenticated requests via `fetch(...,
  {credentials:'include'})`, but that's an XSS concern, not a CSRF one, and is unrelated to the
  primary `localStorage`+header path anyway, which is the more likely XSS exfiltration target).

## 3. What was NOT added, and why

- **No CSRF token (double-submit cookie / synchronizer token pattern)**: unnecessary complexity
  given `SameSite=Strict` already blocks the relevant cross-site request shapes, and the
  primary auth path (Authorization header) was already immune. A token would add another moving
  part (token generation, storage, validation on every mutating route) to defend a threat surface
  that's already closed by the cookie attribute change above.
- **No `Origin`/`Referer` header validation on mutating routes**: `SameSite=Strict` provides
  equivalent protection with less custom code to get wrong (e.g. mishandling missing `Referer`
  headers, which some privacy tools strip).

## 4. Residual risk

- `SameSite=Strict` is enforced by the **browser**, not the server — clients that ignore
  `SameSite` (very old browsers, some non-browser HTTP clients) get no protection from this
  attribute. This is accepted as standard practice; the realistic threat model here is a browser
  user visiting a malicious page, which `Strict` covers.
- If a future route is added that relies on the cookie fallback for a state-changing request,
  it inherits this protection automatically (the cookie attributes are set once, at issuance) —
  but if a future *client* is added that requires cross-site cookie delivery (e.g. embedding this
  app's API in a third-party site via an iframe that needs auth), `SameSite=Strict` would break
  it, and that would need a deliberate, separate design decision (most likely a real CSRF token
  scheme at that point) rather than loosening `SameSite` back to `Lax`/`None`.
