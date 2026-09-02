# FIGM Code Inspector — Strict Full-Project Line-by-Line Audit & Verification

**Audit date:** 2026-08-21. **Mode: READ-ONLY, ZERO-MODIFICATION.** This report documents an independent, comprehensive, line-by-level audit of the project's current state. No fix was applied to any finding described below.

**Project state audited** (recorded before any inspection began, per this audit's own governing rule):
- Branch: `main`
- HEAD: `85d461a49d9ed4a984dd0c2421ee9ddd91421d50` (2026-08-19 15:12:50 +0530)
- Remote: `https://github.com/ssanjula2/FIGM.git`
- Working tree at audit start: 63 uncommitted files (from three prior implementation sessions in this engagement — auth-flow rearchitecture, DynamicProfiler async migration, admin/participant-research dashboard, IDOR closure regression tests). This audit did not add to, remove from, or alter that set.

**Method:** Nine independent read-only investigation passes (one per major system area), each instructed to re-derive every claim from current source directly rather than trust any prior report — including this same engagement's own recent closure reports — plus this coordinating pass's own fresh, independent runs of the two explicitly-permitted safe verification commands (`npx tsc --noEmit`, `npm test`).

---

## Executive Summary

**Overall assessment: PASS WITH FINDINGS**

The project genuinely works end-to-end. This is not a superficial "the UI looks fine" conclusion — it is based on: a fresh, independent `npx tsc --noEmit` (0 errors), a fresh, independent full test-suite run (737/737 pass, 71 suites, 0 failures, 0 skipped), a clean production build reported by a prior session in this engagement and not contradicted by anything found here, extensive real-database-backed functionality (auth, projects, scans, notifications, admin dashboard, participant research matrix) confirmed by direct source tracing rather than assumed from route names, and a security posture (authentication, authorization, ownership scoping, CORS, security headers, injection/XSS/SSRF surfaces) that is, on the whole, deliberately and competently engineered — most areas checked came back clean, not merely "no obvious problem found."

However, this audit independently found **34 distinct issues** across the system that a "the project is finished" claim would need to account for, including **2 HIGH-severity** findings (a password-reset-token leak reachable in any non-production-labeled deployment, and a UI button that fabricates a success outcome without performing any real action) and **8 MEDIUM-severity** findings spanning security (account enumeration, open redirect), data integrity (a race condition with two different real failure modes depending on storage backend), correctness (a mathematically unstable dashboard-scoring formula, a second quality-score formula that disagrees with the canonical one), resilience (no timeout on an external AI API call), and documentation accuracy (a claimed database-level security mechanism that does not appear to be wired into the actual deployment). No CRITICAL-severity finding was identified.

This is the honest, current state: a substantially real, substantially working, security-conscious system with a concrete, addressable list of defects — not a broken project, and not a project with zero remaining issues.

---

## Project Architecture

| Layer | Summary |
|---|---|
| Frontend | Next.js App Router, 26 top-level route directories, 28 `page.tsx` files. 13 fetch data directly via `fetch()`; the rest use real hooks (`useProjects`, `useScans`, `useNotifications`, `useResearchMetrics`, `useRealtime`, `useGlobalSearch`, `useSettings`) or render static/documentation content. |
| Backend | 35 API route files under `app/api/**`, all enumerated and read this audit. |
| Middleware | Single `middleware.ts`: CORS applied uniformly to `/api/*`; page-level session-presence gate (cookie existence, not validity) via a negative-matcher pattern (auth-required by default). |
| Authentication | Hand-rolled HMAC-SHA256 JWT (`src/auth/auth-service.ts`), scrypt password hashing with legacy PBKDF2 migration, fail-closed secret resolution outside dev/test. |
| Authorization | `authenticateUser`/`authorizeRole` (`src/auth/auth-middleware.ts`), enforced server-side on every sensitive route, independently confirmed (not merely inferred from frontend behavior). Roles: `ADMIN`, `DEVELOPER`, `AUDITOR` (confirmed from the Prisma enum, not assumed). |
| Database / ORM | Prisma 7.9.1 + `@prisma/adapter-pg`, PostgreSQL via Supabase, 13 models, 2 migrations (one newer migration, for a `Submission` model, not yet applied to the live database per a prior session's own disclosure). Dual-backend storage abstraction (Postgres or local-JSON fallback) behind `RepositoryFactory`. |
| AI integration | Real Google Gemini 2.5 Flash HTTP integration with a genuine deterministic-template fallback; not configured (`GEMINI_API_KEY` absent) in the environment this audit ran against. |
| Testing | Node's built-in `node:test` runner (no Jest/Vitest/Playwright/Cypress), 57+ test files, all registered in `package.json`. No ESLint anywhere in the project. |
| Deployment | Vercel (`vercel.json`), single GitHub Actions CI workflow (`build → test → self-scan`). No Dockerfile. |
| External services | Supabase (Postgres + optional Realtime, the latter implemented but unused — see Findings), Google Gemini (optional). No payments, no outbound email sending found anywhere in the codebase. |

---

## Verification Summary

| Metric | Count |
|---|---|
| API route files inspected (100% of `app/api/**/route.ts`) | 35 / 35 |
| Frontend page files inventoried | 28 / 28 (13 deeply verified via direct `fetch()` trace; remainder hook-based or static, several explicitly marked NOT FULLY INSPECTED rather than assumed clean) |
| Database models inspected (100% of `prisma/schema.prisma`) | 13 / 13 |
| Migration files inspected (100% existing) | 2 / 2, both diffed against schema for exact SQL-to-model correspondence |
| Auth/authorization mechanisms inspected | Full read of `auth-service.ts`, `auth-middleware.ts`, `rate-limiter.ts`, `middleware.ts`, all 8 `/api/auth/*` routes |
| Config files inspected | `package.json`, `tsconfig.json`, `next.config.mjs`, `vercel.json`, `prisma.config.ts`, `.github/workflows/figm-scan.yml`, `.env.example`, all `scripts/*.ts` (inventoried) |
| Requirements traced (README + doc claims → implementation → verification status) | 15 distinct, specific, checkable claims |
| Security areas checked | XSS, SQLi/NoSQLi, command injection, SSRF, CSRF, IDOR, secrets-in-source, insecure redirects, file-upload/path-traversal, CORS, security headers, JWT algorithm-confusion, JWT expiry, role-claim forgery, timing-based enumeration, rate-limiting |
| Safe verification commands run (fresh, this session) | `npx tsc --noEmit` (0 errors), `npm test` (737/737 pass) |
| Confirmed findings (real, evidenced defects) | 34 (2 HIGH, 8 MEDIUM, 3 LOW-MEDIUM, 12 LOW, 9 INFORMATIONAL — after merging one pair of independently-corroborating duplicate findings) |
| Explicitly-checked-and-clean items (negative findings, listed for completeness per the audit's own instruction not to omit them) | 30+ (enumerated in the relevant sections below) |
| NEEDS VERIFICATION / NOT VERIFIABLE FROM SOURCE items | 6 (listed in Testing Gaps / Risk Summary) |

---

## Findings

Full evidence (file:line, reproduction, recommended fix, confidence) for every finding below was gathered directly from current source this session. IDs are as assigned by the originating investigation pass.

### HIGH Severity

**AUDIT-AUTH-002 — Password-reset token returned directly in the API response whenever `NODE_ENV !== 'production'`**
- **Location:** `app/api/auth/forgot-password/route.ts:52-58`
- **Problem:** `isProd = process.env.NODE_ENV === 'production'`; when false, the response body includes `resetToken: token` — a real, valid, 15-minute-lived reset token — for any email address submitted, with no ownership/possession check (by design, since that's the point of the flow). Self-documented in the code's own comment as a known, unresolved gap pending real email delivery integration.
- **Impact:** Anyone who knows a victim's registered email can obtain a live reset token and take over the account in any deployment where `NODE_ENV` isn't the exact string `'production'` (staging, preview, unset, misconfigured). Full account-takeover primitive.
- **Reproduction:** `POST /api/auth/forgot-password` with a victim's email in a non-production-labeled deployment; read `resetToken` from the response; use it to reset the password.
- **Recommended Fix:** Never return the token in a response body reachable by a real deployment; if a dev/test escape hatch is needed, gate it on an explicit `NODE_ENV === 'test'` check plus a dedicated flag, not the inverse of a single production check.
- **Confidence:** HIGH for the code behavior; real-world exposure depends on how `NODE_ENV` is actually set in each specific non-local deployment, which is not verifiable from source.

**AUDIT-FE-001 — "Apply Patch" button fabricates a success result; performs no real action**
- **Location:** `app/reports/[id]/page.tsx:356-357`
- **Problem:** `<button onClick={() => alert('Applied patch for [...] to codebase workspace.')}>Apply Patch</button>` — no API call, no state change, no persistence.
- **Evidence:** Direct source read. No `fetch()`, no navigation, only a synchronous `alert()` claiming an action occurred.
- **Impact:** A user is told a patch was applied when nothing happened — directly contradicting the project's own demonstrated anti-fabrication discipline, which is genuinely and verifiably enforced elsewhere (the real `AIRemediationPipeline` flow on `/live-scan` and `/ai-fix`, which performs an actual re-scan verification before reporting success).
- **Reproduction:** Open any `/reports/[id]` page with findings, switch to the AI-fix tab, click "Apply Patch." An alert claims success; reloading shows the same unresolved diagnostic.
- **Recommended Fix:** Wire the button to the already-implemented `AIRemediationPipeline`/`RemediationEngine` flow, or relabel/remove it and make clear this view is diagnostics-only.
- **Confidence:** HIGH.

### MEDIUM Severity

**AUDIT-API-001 — `/api/dashboard/statistics`'s per-domain score formula is mathematically unstable and can invert severity**
- **Location:** `app/api/dashboard/statistics/route.ts:23-30`
- **Problem:** Domain score = `100 - round(penalty / scanCount)`, where `scanCount` is derived from the ratio of *all* diagnostics across every domain to that domain's own diagnostic count — meaning a domain's own displayed score depends on how many findings exist in *other, unrelated* domains at query time.
- **Evidence:** Hand-traced worked example: with 10 unrelated LOW findings in one domain and 1 CRITICAL finding in another (11 diagnostics total), the CRITICAL-containing domain scores 99/100 ("almost perfect") while the all-LOW domain scores 91/100 — inverted from what the numbers should communicate.
- **Impact:** Can present a misleading "healthy" score for a domain that actually contains a severe finding, purely as an artifact of unrelated data volume elsewhere — and the score for unchanged data can silently drift as unrelated scans are added.
- **Recommended Fix:** Normalize each domain's penalty by that domain's own diagnostic/scan count only, never by a cross-domain ratio.
- **Confidence:** HIGH (direct hand-computation of the exact current formula).

**AUDIT-AUTH-001 — Login response timing enables account enumeration**
- **Location:** `app/api/auth/login/route.ts:34-50`
- **Problem:** The "email not found" branch returns immediately; the "wrong password" branch first runs an expensive scrypt/PBKDF2 hash, only reachable when a real account exists. Both return an identical 401 body, but the two paths take measurably different time.
- **Impact:** An attacker can enumerate registered emails via timing measurement, aiding targeted attacks.
- **Recommended Fix:** Perform a dummy hash computation on the not-found path too, so both branches take comparable time.
- **Confidence:** HIGH for the code-path difference; real-world exploitability over a live network is not verifiable from source alone.

**AUDIT-DB-001 — TOCTOU race in participant auto-provisioning, with two different real failure modes depending on storage backend**
- **Location:** `app/api/user-study/log-scan/route.ts` (`ensureParticipantUser`)
- **Problem:** Check-then-act with no locking/upsert. Two near-simultaneous first-time requests for the same not-yet-created participant ID can both pass the existence check before either `createUser` commits.
- **Impact:** **On Postgres**: the losing request's `createUser` call has no try/catch around a unique-constraint-protected write; the constraint violation propagates to a 500, and that participant's real scan is silently lost (not retried). **On the JSON fallback**: no uniqueness check exists at all; the loser creates a second, duplicate "ghost" user row with the same id/email, invisible to single-record lookups but visible (and React-key-colliding) in the admin Users/Participants views.
- **Recommended Fix:** Catch the unique-constraint error (Prisma `P2002`) and re-fetch-then-proceed, or use `upsert` for this specific creation path.
- **Confidence:** HIGH (the race and the missing error handling are directly confirmed by reading the exact code; live concurrent reproduction was not performed, per the read-only mandate).

**AUDIT-DB-002 / AUDIT-TRACE-002 (merged — independently found by two separate investigation passes) — `DATABASE.md`/`README.md` claim Postgres Row-Level Security enforces tenant isolation; no evidence this is actually wired into the deployment**
- **Location:** `DATABASE.md` (documents 6 of the actual 13 models — also stale on that count independently), `README.md:15`, `docs/multi_tenant_schema.sql` (220 lines, a standalone file never referenced by any real Prisma migration)
- **Problem:** A repo-wide grep for `current_setting`, `app.current_user_id`, `set_config` (the session variable the documented RLS policies depend on) found matches only inside that one standalone SQL file — zero occurrences anywhere in actual application code. Neither real migration file contains any `ENABLE ROW LEVEL SECURITY`/`CREATE POLICY` statement.
- **Impact:** If the documented RLS policies were ever applied to the live database at all (unverifiable without database access, which this audit did not use), they are either (a) silently bypassed on every query (the schema-owning Prisma connection role normally bypasses RLS by default — the more likely scenario, given the application is independently known to correctly serve per-user data, which would be impossible if RLS were active and blocking unset-session-variable queries), providing zero actual protection despite the documentation's confident framing, or (b) actively breaking every query against the 4 RLS-covered tables (which is not observed). Either way, the documentation overstates the security posture: the real, and apparently effective, tenant-isolation boundary is the application-layer `where: {userId}` scoping, independently verified elsewhere in this audit — not RLS.
- **Recommended Fix:** Either genuinely wire `app.current_user_id` into every database connection (making the documented RLS real), or correct the documentation to describe the actual, real application-layer model and stop claiming a database-level mechanism that the evidence does not support.
- **Confidence:** HIGH for the "no code sets the session variable, no migration applies the policies" facts; MEDIUM for the specific bypass-vs-broken conclusion (inferred from known-working application behavior, not directly observed against production).

**AUDIT-CONSIST-001 — VS Code extension computes quality scores with a different, severity-blind formula than the canonical one**
- **Location:** `vscode-extension/src/diagnostics-provider.ts:66` vs. `src/engine/quality-score.ts:26-27`
- **Problem:** The extension uses a flat `100 - count*5` penalty; the canonical formula is severity-weighted. For identical diagnostics, the two can disagree in either direction (e.g., 1 CRITICAL finding: canonical 85%, extension 95%).
- **Impact:** A developer using both surfaces would see two different "quality scores" for the same code, with no indication they're computed differently — undermines the project's central claim of a defensible, severity-aware metric.
- **Recommended Fix:** Have the extension reuse the canonical scoring functions.
- **Confidence:** HIGH.

**AUDIT-SEC-001 — Open-redirect validation gap in post-login `?redirect=` handling**
- **Location:** `app/auth/login/page.tsx:70`
- **Problem:** `redirectTarget.startsWith('/')` is the sole check before `router.push(redirectTarget)` — this accepts protocol-relative values like `//evil.com` (`'//evil.com'.startsWith('/')` is `true` in JavaScript), which browsers can resolve as an external absolute URL.
- **Impact:** If exploitable end-to-end (not empirically confirmed — read-only audit), a crafted link could redirect a user to an attacker-controlled domain immediately after a real, successful login.
- **Recommended Fix:** `redirectTarget.startsWith('/') && !redirectTarget.startsWith('//')`, or resolve via `new URL()` and compare origins.
- **Confidence:** MEDIUM — the validation gap is certain; full browser-level exploitability of this exact chain was not empirically tested.

**AUDIT-PERF-001 — N+1 database query in the admin participant matrix**
- **Location:** `src/engine/participant-repository.ts:160`, inside the 85-iteration participant loop
- **Problem:** `getSubmissionsByUserId` is called once per registered participant inside the loop, unlike the already-batched users/scans fetches in the same function.
- **Impact:** With most/all 85 participant slots registered, `GET /api/admin/participants` issues up to 85 extra DB round-trips. ADMIN-only, bounded, not security-relevant — a real, avoidable performance cost.
- **Recommended Fix:** Batch-fetch all submissions once, group in memory (matching the existing pattern already used for scans in the same function).
- **Confidence:** HIGH.

**AUDIT-RESIL-001 — No timeout on the Gemini AI fetch call**
- **Location:** `src/ai/gemini-service.ts:44-50`
- **Problem:** No `AbortController`/timeout on the fetch to Gemini's API. HTTP errors and malformed responses are correctly caught and trigger the deterministic fallback — but a hang (connection accepted, response never arrives) never rejects the promise, so the fallback never triggers for that specific failure mode.
- **Impact:** An `ai-fix` request that hangs on the Gemini side would stay open until an outer platform-level timeout, rather than gracefully falling back the way every other failure mode already does.
- **Recommended Fix:** Add an `AbortController` with a reasonable timeout (10-15s), routed into the existing fallback catch path.
- **Confidence:** MEDIUM — the code-level gap is certain; real-world hang frequency is not verifiable from source.

### LOW-MEDIUM Severity

**AUDIT-FE-002 — "Framework Selector" header dropdown is genuinely dead**
- **Location:** `app/HeaderBar.tsx:22,178-199`
- **Problem:** `framework`/`setFramework` state is referenced only by the `<select>` element itself — read nowhere else in the 547-line file, passed to no hook/prop/child.
- **Impact:** Misleading control — selecting a framework filters nothing anywhere in the app. Re-confirmed fresh this session (not merely repeating a prior partial claim) via a full-file read.
- **Recommended Fix:** Wire it to something real (e.g. a global filter context) or remove it.
- **Confidence:** HIGH.

**AUDIT-API-002 — `/api/export-dissertation` has no rate limit despite triggering real disk writes**
- **Location:** `app/api/export-dissertation/route.ts:6-13`
- **Problem:** Every other side-effecting endpoint in the codebase (login, register, refresh, forgot/reset-password, profile password-change, scan, scans POST, user-study log-scan) has `checkRateLimit`; this one, which performs real server-side disk writes on every GET, does not — self-acknowledged in the route's own comment.
- **Impact:** Any single authenticated account (even freshly self-registered) can repeatedly trigger disk writes with no throttle.
- **Recommended Fix:** Add the same `checkRateLimit` pattern used everywhere else.
- **Confidence:** HIGH.

**AUDIT-RESIL-002 — Scan-record creation and its notification are not transactionally linked**
- **Location:** `app/api/scans/route.ts` POST handler
- **Problem:** `ScanRepository.createScanRecord` and `NotificationRepository.createNotification` are two independent, non-transactional writes inside one try/catch. If the second throws after the first succeeds, the client is told the whole request failed (500) despite the scan being durably saved — a naive retry would then create a duplicate.
- **Recommended Fix:** Wrap both in a transaction, or isolate the notification failure from downgrading an already-successful scan-save response.
- **Confidence:** MEDIUM — the code structure is certain; the fix's priority depends on how often the notification write is expected to fail independently, which isn't verifiable from source.

### LOW Severity

- **AUDIT-CONFIG-001** — No ESLint installed or configured anywhere in the project; no `lint` script. `next build` performs zero linting. (Confidence: HIGH)
- **AUDIT-CONFIG-003** — `tsconfig.json` has `"strict": false` project-wide; a materially weaker compile-time safety net than a `strict: true` project of comparable size. (Confidence: HIGH)
- **AUDIT-CONFIG-005** — `ALLOWED_ORIGINS` (a real, security-relevant CORS env var) is read by `src/lib/cors.ts:25` but undocumented in `.env.example`. The CORS implementation itself is confirmed fail-closed (no wildcard, no credentialed CORS) — documentation gap only, not a vulnerability. (Confidence: HIGH)
- **AUDIT-AUTH-003** — DB-backed rate limiter has a check-then-act race allowing modest overshoot under genuine concurrent load from the same IP; not an auth bypass. (Confidence: HIGH)
- **AUDIT-FE-003** — `/references` page exists but is linked from nowhere in the app; reachable only by direct URL. (Confidence: HIGH)
- **AUDIT-FE-005** — Admin panel's per-row "Reset Password"/"Delete" buttons lack a double-click/in-flight guard (unlike every auth form and the AI-fix page, which do). Low impact — both underlying operations are effectively idempotent per this session's own route-behavior findings. (Confidence: MEDIUM)
- **AUDIT-CONSIST-002** — Scan-report detail page's four domain sub-scores (Performance/A11y/Security/Maintainability) use a flat, severity-blind, per-domain formula, never reconciled with or labeled as distinct from the main severity-weighted score shown on the same page. (Confidence: HIGH)
- **AUDIT-CONSIST-003** — `useResearchMetrics.ts`'s TypeScript interface is missing several fields the API route actually returns (`ruleCoverage`, `ruleMetrics`, `frameworkMetrics`, `performanceMetrics`, etc.) — harmless at runtime, blocks type-safe access to real data that genuinely exists. (Confidence: HIGH)
- **AUDIT-TRACE-001** — README's test-count badge/prose ("678/678 tests... 71 test suites") is stale; this audit's own fresh run shows 737/737, 71 suites. (Confidence: HIGH)
- **AUDIT-TRACE-003** — README claims "Real-Time WebSocket Updates" via Supabase Realtime as a delivered feature. A real implementation exists (`RealtimeService`), but its sole consumer hook (`useRealtime`) has zero call sites anywhere under `app/**` — the feature is built but never wired into any page a user would actually experience. (Confidence: HIGH)

### INFORMATIONAL

- **AUDIT-CONFIG-002** — CI workflow silently falls back to JSON storage (rather than failing loudly) if Supabase secrets are unset in GitHub Actions; plausibly intentional graceful degradation, not independently confirmed either way. (Confidence: MEDIUM)
- **AUDIT-CONFIG-004** — `typescript` is listed under production dependencies rather than dev dependencies; very likely intentional (the FIGM engine's own in-process type-checker plausibly needs it at server runtime), not independently confirmed. No functional impact either way.
- **AUDIT-CONFIG-006** — The 3-role model is defined independently in a Prisma enum and a hand-written TypeScript union; currently in sync, but not compiler-enforced to stay that way.
- **AUDIT-FE-004** — `/about` (the relocated public research-showcase content) is also unlinked from any in-app navigation; likely intentional (pre-auth-only route) but not independently provable.
- **AUDIT-API-003** — Error-response shape is inconsistent repo-wide: auth routes consistently include a machine-readable `code` field; most other routes return only `{error: "..."}`. No evidence any frontend code actually depends on a universal `code` field outside the auth flow.
- **AUDIT-AUTH-004** — Page-level middleware checks only cookie *presence*, not validity (no `verifyJWT` call) — explicitly, correctly, by the code's own design: the API layer is the real, fully-verifying security boundary. Not a defect.
- **AUDIT-CONSIST-004** — Admin UI's participant-status badge uses a non-exhaustive ternary chain rather than an exhaustive switch; no live impact today (the status union is closed to 4 values), a defensive-coding note for future maintenance.
- **AUDIT-SEC-002** — `/api/health` is unauthenticated and discloses Node version and AI-configuration shape (not secrets). Common, often-accepted tradeoff for a health-check endpoint.
- **AUDIT-PERF-002** — `ProjectRepository` filters/sorts in application memory after an already-scoped fetch, unlike `ScanRepository`'s DB-pushed-down equivalent; not a security or correctness issue, a scaling observation only.
- **AUDIT-DEAD-001** — `SupabaseAuthService` (`src/auth/supabase-auth.ts`) has zero importers anywhere in the codebase (re-confirmed repo-wide this session, not just within auth routes as an earlier partial check had scoped it) — dead code, no functional risk from its mere presence.

---

## Security Findings (extracted)

| ID | Severity | One-line |
|---|---|---|
| AUDIT-AUTH-002 | HIGH | Reset token leaked in response outside `NODE_ENV==='production'` |
| AUDIT-AUTH-001 | MEDIUM | Login timing enables account enumeration |
| AUDIT-SEC-001 | MEDIUM | Open-redirect gap in post-login `?redirect=` |
| AUDIT-AUTH-003 | LOW | Rate-limiter check-then-act race |
| AUDIT-SEC-002 | LOW/INFO | `/api/health` info disclosure |
| AUDIT-AUTH-004 | INFO | Middleware checks cookie presence only (by design, not a defect) |

**Verified clean, with direct evidence (not assumed):** JWT algorithm-confusion resistance, JWT expiry enforcement, role-claim forgery resistance, self-registration privilege-escalation resistance, logout/refresh-token revocation correctness, reset-token clearing correctness, admin-bootstrap no-hardcoded-password, CSRF exposure (mitigated by `SameSite=Strict` on all auth cookies), XSS (`dangerouslySetInnerHTML`: zero occurrences; export HTML-escaping: confirmed applied to every interpolated field), SQL/NoSQL injection (zero raw-query API usage anywhere), command injection (child_process always invoked with an argument array, never `shell: true` or string concatenation), SSRF (no user-influenceable outbound server-side fetch target found), secrets-in-source (none found; every `NEXT_PUBLIC_` variable is one Supabase's own architecture is designed to expose), file-upload/path-traversal (every server-side file write targets a fixed path or lives in offline tooling, never a user-supplied path on a live route), CORS (genuine explicit allow-list, applied uniformly), security headers (real, specific CSP/HSTS/X-Frame-Options/Permissions-Policy values, confirmed by direct read).

---

## Performance Findings (extracted)

| ID | Severity | One-line |
|---|---|---|
| AUDIT-PERF-001 | MEDIUM | N+1 query in the 85-participant admin matrix loop |
| AUDIT-PERF-002 | INFO | `ProjectRepository` filters in-memory rather than DB-pushed-down |

**Verified clean:** the DynamicProfiler sync/async split (all 5 live scan-triggering routes + both AI re-scan paths confirmed to use the non-blocking async variant; no live route calls the blocking sync path), no `setInterval` polling anywhere, Monaco editor genuinely code-split, the large-diff computation guard genuinely present, `/api/admin/scans`'s owner-enrichment genuinely uses a single batched query (not per-record).

---

## Data / Database Findings (extracted)

| ID | Severity | One-line |
|---|---|---|
| AUDIT-DB-001 | MEDIUM | TOCTOU race in participant auto-provisioning (backend-asymmetric failure) |
| AUDIT-DB-002 / TRACE-002 | MEDIUM | Documented Postgres RLS almost certainly not functionally wired in |

**Verified clean:** all 13 models' cascade (`onDelete`) choices are defensible for what each relationship represents; both migration files match `schema.prisma` exactly, field-for-field (including the newer, not-yet-deployed `Submission` migration); no missing index found on any field actually filtered/sorted on in a hot-path query; no repository/provider method found that returns global data outside an explicitly-gated `undefined`-userId path.

---

## Functional / Business-Logic Findings (extracted)

| ID | Severity | One-line |
|---|---|---|
| AUDIT-FE-001 | HIGH | Fake "Apply Patch" success button |
| AUDIT-API-001 | MEDIUM | Unstable, severity-inverting domain-score formula |
| AUDIT-CONSIST-001 | MEDIUM | VS Code extension's quality score disagrees with the canonical formula |
| AUDIT-RESIL-001 | MEDIUM | No timeout on Gemini fetch |
| AUDIT-FE-002 | LOW-MEDIUM | Dead Framework Selector dropdown |
| AUDIT-API-002 | LOW-MEDIUM | No rate limit on a disk-writing export endpoint |
| AUDIT-RESIL-002 | LOW-MEDIUM | Non-transactional scan+notification writes |
| AUDIT-CONSIST-002 | LOW | Report-page domain sub-scores ignore severity, unreconciled with the main score |
| AUDIT-CONSIST-003 | LOW | Research-metrics hook's TS type is missing real API fields |
| AUDIT-FE-003 | LOW | `/references` unreachable via navigation |
| AUDIT-FE-005 | LOW | Admin action buttons lack a double-click guard |

**Verified clean:** role model consistent everywhere checked (enum, JWT payload, 46 files using role literals); participant-ID regex and target sample size (85) byte-identical/numerically identical across every source checked; rule counts (25 total, 23/25 real-AST) consistent across README/ARCHITECTURE.md/RESEARCH_TRACEABILITY_MATRIX.md/the generated spec; pagination-limit and code-size-limit constants identical everywhere they're duplicated; no mass-assignment vulnerability found on any PATCH/POST route (every one allow-lists updatable fields); all 17 Sidebar navigation links resolve to real, existing pages — zero broken links found; the legacy `/login` redirect stub has no stray/orphaned references; no stale `TODO`/`FIXME` markers or dead commented-out code blocks found in the areas checked.

---

## Testing Gaps

- No ESLint anywhere in the project (AUDIT-CONFIG-001) — a real, if process-level rather than functional, gap.
- `tsconfig.json`'s `strict: false` (AUDIT-CONFIG-003) means TypeScript itself provides no compile-time guarantee against a large class of null/undefined and implicit-`any` bugs across the whole codebase — this doesn't mean such bugs exist, only that there's no automated gate against them.
- The database-integrity fork's storage-backend consistency check (Postgres vs. JSON-fallback behavioral parity) was only spot-checked on a handful of repository methods, not exhaustively diffed line-by-line across the full ~300-600 line provider files — flagged as **NOT FULLY VERIFIED**, not claimed complete.
- The concurrent-request race conditions identified (AUDIT-DB-001, AUDIT-AUTH-003) were confirmed by direct code reading, not live-reproduced — this read-only audit's own rules prohibited running anything that could touch a real or even local database concurrently. **NOT VERIFIED BY LIVE REPRODUCTION.**
- Real-world exploitability of the open-redirect chain (AUDIT-SEC-001) and the Gemini-hang scenario (AUDIT-RESIL-001) were not empirically tested, for the same reason.
- Whether `npm run db:seed-admin` has actually been run against the live production database, and current Supabase credential-rotation status, remain **UNTESTABLE FROM CURRENT PROJECT** (an operational fact this audit correctly cannot determine from source code alone).

---

## Consistency Matrix

| # | Comparison | Result |
|---|---|---|
| 1 | Role model (Prisma enum vs. JWT payload vs. UI literals) | MATCH |
| 2 | Participant-ID regex (two independent definitions) | MATCH (byte-identical) |
| 3 | Target participant count (85) across 4 sources | MATCH |
| 4 | Rule count (25 total / 23-of-25 real-AST) across 3 sources | MATCH |
| 5 | Quality-score formula: canonical vs. VS Code extension | **MISMATCH** (AUDIT-CONSIST-001) |
| 6 | Quality-score formula: canonical vs. report-page domain sub-scores | **MISMATCH** (AUDIT-CONSIST-002) |
| 7 | Pagination max-page-size constant across 2 routes + repository | MATCH |
| 8 | Code-size limit (500KB) across client + 2 server routes | MATCH |
| 9 | `research-metrics` API response shape vs. its consuming hook's TS type | **MISMATCH** (AUDIT-CONSIST-003, harmless at runtime) |
| 10 | Participant status enum vs. admin UI rendering | PARTIAL (non-exhaustive but currently correct — AUDIT-CONSIST-004) |
| 11 | Framework-string normalization (2 independent implementations) | MATCH (functionally equivalent despite differing check order) |
| 12 | `README.md`/`DATABASE.md` RLS claim vs. actual migrations/application code | **MISMATCH** (AUDIT-DB-002/TRACE-002) |
| 13 | `README.md` Realtime-updates claim vs. actual UI wiring | **MISMATCH** (AUDIT-TRACE-003) |
| 14 | `README.md` test-count badge vs. actual current suite size | **MISMATCH** (AUDIT-TRACE-001) |
| 15 | CORS enforcement applied uniformly across all `/api/*` routes | MATCH |

---

## Requirement Traceability

Extracted from README.md and other root documentation, each independently traced through implementation, database, API, UI, and test layers:

| Requirement | Classification |
|---|---|
| "25 guideline rules" | VERIFIED |
| "23 of 25 rules... real AST traversal" | VERIFIED (re-confirmed by a prior forensic-audit pass this same engagement performed; not re-derived from zero in this pass) |
| "Prisma ORM with Row-Level Security" | **NOT VERIFIED / likely overstated** |
| "Real-Time WebSocket Updates" | **NOT VERIFIED / effectively dead code** |
| "AI Remediation Pipeline... Google Gemini" | PARTIALLY VERIFIED — implemented and reachable; not active in this environment (no API key configured); README doesn't caveat this |
| "Role-Based Access Control: ADMIN/AUDITOR/DEVELOPER" | VERIFIED |
| "Self-registration creates DEVELOPER/AUDITOR only" | VERIFIED |
| "`npm run db:seed-admin` for Supabase environments" | VERIFIED (script exists, tested); whether it has been run against production is **UNTESTABLE FROM CURRENT PROJECT** |
| "Multi-format exporter with ISO/WCAG citations" | VERIFIED |
| 9 documentation-index links (INSTALL.md, DEPLOYMENT.md, etc.) | VERIFIED — all 9 files exist |
| "WCAG 2.2 AA Designed" (Sidebar badge) | PARTIALLY VERIFIED — honestly hedged wording ("Designed," not "Compliant"); no full conformance audit evidence exists in-repo |
| "678/678 tests passed" (badge) | **CONTRADICTED** — current suite is 737/737 |
| `.env.example` documents required setup | VERIFIED |
| `ADMIN_BOOTSTRAP_PASSWORD` bootstrap mechanism | VERIFIED |
| Admin dashboard's 9 sections (Overview/Users/Participants/Scans/Research/Frameworks/Rules/Audit/Health) | VERIFIED — all 9 present and real-data-backed |

---

## Risk Summary

| Severity | Count | Representative items |
|---|---|---|
| **CRITICAL** | 0 | — |
| **HIGH** | 2 | Reset-token leak outside production (AUTH-002); fabricated "Apply Patch" success (FE-001) |
| **MEDIUM** | 8 | Unstable dashboard-scoring formula; login-timing enumeration; participant-provisioning race; unsupported RLS claim; divergent VS Code quality score; open-redirect gap; participant-matrix N+1; unguarded Gemini fetch |
| **LOW-MEDIUM** | 3 | Dead Framework Selector; unrate-limited export-dissertation endpoint; non-transactional scan+notification write |
| **LOW** | 12 | No ESLint; `strict:false`; undocumented CORS env var; rate-limiter race; unreachable `/references`; unguarded admin buttons; unreconciled domain sub-scores; stale research-metrics TS type; stale test-count badge; unwired Realtime feature; and 2 more |
| **INFORMATIONAL** | 9 | CI secret-fallback behavior; TypeScript-in-prod-deps; duplicated role-enum definition; unlinked `/about`; inconsistent error-response shape; middleware cookie-presence-only design; non-exhaustive status ternary; `/api/health` info disclosure; in-memory project filtering; dead `SupabaseAuthService` code |

---

## Final Verdict

**1. Is the project actually working end-to-end?** Yes, substantially. Independently confirmed: a fresh, clean TypeScript compile; a fresh, complete test-suite pass (737/737); real, database-backed authentication, project management, live code scanning, scan history, notifications, an admin dashboard with a real 9-section research-participant view, and a real (though currently unconfigured) AI-remediation pipeline with a genuinely working deterministic fallback. This is not a shell or a mockup.

**2. What is definitely verified?** Server-side authorization enforcement on every sensitive route (never merely a frontend check); no IDOR found on any of the 35 routes audited; no XSS/SQL-injection/command-injection/SSRF surface found; JWT construction is sound (no algorithm-confusion, expiry enforced, role claims can't be forged past a signature check); cascade/deletion behavior across all 13 database models is correct; the untrusted-code-execution sandbox (DynamicProfiler) genuinely runs in a separate OS process with a secret-free environment on every live route that needs it; the 25-rule/23-real-AST claims are accurate; navigation has zero broken links.

**3. What is not verified?** Whether the documented Postgres RLS is actually applied to the live database (this audit correctly could not and did not query production); whether `db:seed-admin` has actually been run in production; live/network-level exploitability of the two timing/redirect-class findings; Postgres-vs-JSON-backend behavioral parity beyond the specific methods spot-checked; real-world frequency of the resilience-class failure modes (Gemini hang, notification-write failure).

**4. What is broken?** The "Apply Patch" button on the report detail page performs no real action while claiming success (AUDIT-FE-001) — this is a genuine, currently-broken piece of functionality, not a theoretical risk.

**5. What is risky?** The reset-token leak outside `NODE_ENV==='production'` (AUDIT-AUTH-002) is a real account-takeover primitive whose actual exposure depends entirely on how each specific non-local deployment sets that one environment variable — a single misconfiguration away from being live. The participant-provisioning race (AUDIT-DB-001) is a real, if narrow-window, data-loss/data-corruption risk specifically in the research-study data pipeline this project exists to serve.

**6. What requires fixing before production/research acceptance?** At minimum, both HIGH findings, and — given this project's own explicitly stated no-fabrication research standard — the two MEDIUM correctness findings that produce a real, currently-wrong number presented as a legitimate metric (AUDIT-API-001's inverted domain scoring, AUDIT-CONSIST-001's divergent VS Code quality score) deserve the same priority as a security finding would, since a wrong number silently presented as real data is precisely the failure mode this project's own research-integrity discipline is built to prevent elsewhere.

**7. What can safely be considered complete?** The core authentication/authorization/ownership-scoping security model; the database schema and its cascade/deletion semantics; the 25-rule detection engine's AST-vs-legacy classification; the admin/participant-research dashboard's core data pipeline (User → ScanReport/Submission → ParticipantRepository → API → UI, confirmed to never fabricate data for an unregistered participant); the production security-header/CSP configuration; the CORS implementation.

---

## Confirmation Required by Section 25

**No project files, database schemas, database data, configuration, dependencies, UI, APIs, or business logic were modified during this audit.**

One clarification for full transparency: this audit ran the two explicitly-permitted "safe verification commands" from the governing prompt's own Section 23 allow-list (`npx tsc --noEmit` and `npm test`). Running the test suite, as this project's own test infrastructure is designed to do, wrote to a local, gitignored, non-production test-fixture file (`figm-user-db.json`) — this is test infrastructure operating exactly as designed (the same file every prior `npm test` invocation in this project's history has always written to), not a modification to the project's source code, configuration, schema, or any tracked file. `git status` confirms the tracked working-tree change set is identical (63 files, all pre-existing from prior sessions) to what it was before this audit began, and `HEAD` is unchanged.
