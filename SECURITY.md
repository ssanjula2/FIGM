# FIGM Code Inspector — Security Policy & Controls

Security controls, authentication standards, RBAC enforcement, and vulnerability reporting procedures.

---

## 1. Authentication & Session Management
- **Password Hashing**: PBKDF2 with SHA-512 and 10,000 iterations using a 16-byte random salt per user.
- **Session Tokens**: JWT access tokens signed with HMAC-SHA256 (default expiration: 1 hour).
- **Refresh Tokens**: Cryptographically random base64url strings stored securely (default expiration: 7 days).

---

## 2. Authorization & RBAC
Roles enforced across system endpoints:
- **`ADMIN`**: Full platform management, user role updates, password resets, system metrics.
- **`AUDITOR`**: Read-only compliance auditing, benchmark viewing, report exporting.
- **`DEVELOPER`**: Workspace project creation, scan execution, AI patch application.

---

## 3. Data Protection Controls
- **XSS Prevention**: Dynamic text HTML-entity encoded prior to PDF/HTML report rendering.
- **SQL Injection Prevention**: Parameterized queries via Prisma ORM.
- **Rate Limiting**: Sliding window rate limiter (`checkRateLimit`/`getClientIp`, `src/auth/rate-limiter.ts`) enforcing API request quotas per IP address, DB-backed (`audit_logs` row counts) so the limit is genuinely shared across serverless instances, with an in-process fallback only when Postgres is unavailable. See §4 for the current per-route accounting.

---

## 4. Rate Limiting — Per-Route Accounting

Every `app/api/**/route.ts` handler, audited (Phase 1 security close-out) against two questions:
does it need a limit beyond authentication/authorization, and if not, why not. "Rated" below means
`checkRateLimit` is actually called in that handler.

### Rated
| Route | Limit | Why |
|---|---|---|
| `POST /api/auth/login`, `/forgot-password`, `/refresh`, `/register`, `/reset-password` | 10/min (varies) | Unauthenticated by nature — brute-force/enumeration surface. |
| `POST /api/scan` (plain scan) | 60/min per IP | Cheap, local, the core interactive feature — generous so normal editor-like re-scanning isn't throttled. |
| `POST /api/scan` (`action` = a fix/AI variant) | 15/min per IP **and** 15/min per client fingerprint (hashed User-Agent/Accept-Language/Accept-Encoding, IP-independent) | Calls a real AI provider before `authenticateUser` is ever reached in that branch — a genuine anonymous cost/abuse vector. The fingerprint dimension was added in Phase 1 specifically because a per-IP-only limit is defeated by IP rotation (proxy/VPN, or a forged `X-Forwarded-For` chain) while every other request characteristic stays identical; requiring an attacker to defeat both independent dimensions at once is strictly harder than either alone. |
| `GET /api/export-dissertation` | 5/min | Every request triggers real server-side disk writes. |
| `PATCH /api/profile` (`CHANGE_PASSWORD`) | 10/min | Sensitive, abuse-prone action. |
| `POST /api/export` | 10/min | Generates real report content (PDF/CSV/Markdown/JSON) and writes a notification row per call. |
| `GET /api/report` | 10/min | Its no-cached-report fallback path recursively re-runs the full FIGM analysis engine over a sample directory on every call. |
| `GET /api/search` | 30/min | Runs real DB queries. Auth is now fully enforced (see the "Resolved" note below, superseding the "Known gap" this row used to point to). |
| `POST /api/submissions` | 15/min | Runs the same `RuleExecutionEngine.analyzeFileAsync` path as `/api/scan` on arbitrary client-supplied code, then persists a DB record — same compute+write cost profile `/api/scan`'s own limit exists to bound. |
| `POST /api/projects` (create) | 10/min | No per-account cap otherwise exists on project count — a real DB-row/storage exhaustion vector, not just an annoyance. |
| `POST /api/projects/[id]/duplicate` | 10/min | Same reasoning as create, and a heavier per-call DB write (copies the source project). |
| `PATCH /api/user-study/log-scan` | (existing) | Research-study data-integrity path. |

### Intentionally NOT rate-limited (auth/authorization is the real control, or the route is a cheap, bounded, self-scoped operation)
| Route(s) | Reason |
|---|---|
| `app/api/admin/**` (participants, rule-stats, scans, system, users), `GET /api/auth/audit-logs` | `authorizeRole(['ADMIN'])`/`['ADMIN','AUDITOR']`-gated. The actor pool is small and trusted by design; if an admin account is ever compromised, a request-rate limit is not a meaningful additional control compared to credential revocation/monitoring — the correct mitigation for that scenario lives elsewhere, not here. |
| `POST /api/auth/logout` | Can only act on the caller's own session/refresh token — no cross-user or volumetric impact from spamming your own logout. |
| `GET /api/auth/me` | Cheap identity read off the verified JWT, expected to be polled frequently by the client on normal navigation — rate-limiting it would break legitimate usage for no security benefit. |
| `GET /api/dashboard/reports`, `GET /api/dashboard/summary` | Read-only, bounded (reports capped at 10 rows), scoped to the caller's own data (or explicitly, intentionally public platform-wide aggregates for `summary` — no per-user data, see that route's own comment). |
| `GET/PATCH/DELETE /api/notifications` | Single-row, self-scoped operations on the caller's own notifications only. |
| `GET /api/projects`, `GET/PATCH/DELETE /api/projects/[id]` | Read/update/delete of the caller's own existing projects — bounded by how many projects that account already has (itself now rate-limited at creation, see above), not a creation vector. |
| `GET/PATCH/DELETE /api/scans/[id]` | Same reasoning as `/api/projects/[id]` — operates on an existing, ownership-checked scan record; scan *creation* is `/api/scan`, already rate-limited. |
| `GET/PATCH /api/settings` | Single-row, self-scoped user preferences. |

### Resolved (was: "Known gap" above)
**Update (Phase 1 security follow-up):** `GET /api/search` previously never checked `authenticateUser`'s `errorResponse` and never returned 401 for a missing/invalid token — unlike every sibling route in this codebase, it silently proceeded with `userId=undefined` instead of rejecting the request. No data ever actually leaked (project/scan results were still correctly scoped to an empty set for an anonymous caller, and the admin user-search branch was already correctly `isAdmin`-gated), but the endpoint was reachable without authentication at all. **This is now fixed**: the route enforces the same `authenticateUser`/`errorResponse`/401 pattern as every other authenticated route (see `tests/search-auth-enforcement.test.ts` for regression coverage — missing/invalid/expired tokens all return 401, valid-token search behavior and result scoping are unchanged, and the ADMIN-only user-search gate still holds).
