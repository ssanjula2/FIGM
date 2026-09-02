# FIGM Complete API Audit Report

**Date:** 2026-08-25. **Method:** five independent, parallel audit passes, each covering a disjoint
slice of this brief, each explicitly instructed to re-derive findings from current source directly
rather than trust this session's own earlier claims or any prior `audit/*.md` report. Full raw detail
for each slice is preserved at `scratch/audit-2026-08-25-api/*.md` (gitignored). RBAC/auth findings
are static-source-only (no dev server was started, no live HTTP probing performed) — flagged
explicitly wherever that matters.

---

## Executive Summary

| Score | Value |
|---|---|
| **Overall Project Rating** | **82/100 — Strong engineering, concrete and fixable gaps** |
| **Security Score** | **79/100** |
| **API Quality Score** | **84/100** |
| **Production Readiness Score** | **76/100** |
| **Research Readiness Score** | **72/100** |

**Headline:** No CRITICAL findings anywhere across 35 API routes, the auth/session system, the
database schema, or the FIGM engine's untrusted-code sandbox. RBAC and IDOR checks are clean on every
route traced (no user can read/write another user's data; no role can escalate). SQL/NoSQL/command
injection and CSRF are both structurally absent. The previously-dangerous dynamic-profiling sandbox is
now genuinely process-isolated and safe. **However**, this pass found **2 real, live, exploitable-today
HIGH-severity issues** (unauthenticated AI-cost exposure; an unauthenticated fully-unbounded database
read) and a consistent pattern of MEDIUM-severity hardening gaps (session-token duplication, missing
rate limits, inconsistent error-message sanitization) that should be fixed before this is called
production-ready. Research-wise, RQ1–RQ3 are genuinely and honestly supported by live, non-hardcoded
evaluation code; **RQ4 (expert comparison) has zero real evidence behind it** — correctly left
unfabricated, but a real gap.

---

## Critical Findings

**None found.**

---

## High Priority Findings

**H1 — Unauthenticated Gemini API cost exposure via `POST /api/scan`.**
In `app/api/scan/route.ts`, the AI-fix action branch (`action: 'fix-figm-rule' | 'fix-code-error' |
'ai-fix'`) calls `FigmFixPipeline`/`CodeErrorFixPipeline` — which call the real, billed Gemini API —
**before** `authenticateUser(request)` is invoked. Any anonymous caller can POST a fix request and
trigger a real external API charge, throttled only by IP-based rate limiting (15/min), which is
bypassable by rotating source IPs.
**Fix:** require authentication before the AI-fix branch runs; the static-scan-only path can remain
anonymous by design, but AI-fix specifically has real external cost and needs an authenticated,
per-account quota.

**H2 — Public, unauthenticated, fully unbounded database read via `GET /api/dashboard/statistics`.**
This route is intentionally public (documented in its own code comment), but calls
`provider.getScanRecords()` with **no `userId` filter and no limit** — loading every `ScanReport` row
in the entire database on every anonymous request just to compute two aggregate scores in memory. This
is a real scalability ceiling and a mild DoS-amplification vector (cheap anonymous request → expensive
unbounded read).
**Fix:** add a `LIMIT`/sampling strategy, or precompute/cache the aggregate rather than reading the
full table per request.

---

## Medium Priority Findings

**M1 — Session tokens duplicated in JSON response body.** `login`, `register`, and `refresh` all
return `accessToken`/`refreshToken` in the plain JSON body in addition to setting them as `httpOnly`
cookies. This materially weakens httpOnly's actual protection: an XSS payload can read both tokens
(including the 7-day refresh token) straight from the `fetch()` response without ever touching
`document.cookie`. **Fix:** stop echoing tokens in the response body; the cookies alone are sufficient
for the app's own cookie-based auth flow.

**M2 — No rate limiting on `POST /api/submissions`.** Runs a full 50-rule AST analysis per request
for any authenticated user with zero `checkRateLimit` call, unlike every sibling compute endpoint.
Compute-exhaustion DoS risk from a single scripted account. **Fix:** apply the same rate-limit pattern
already used on `/api/scans` POST.

**M3 — `report-generator.ts`'s `generateHTML()` inconsistently escapes output.**
`offendingCodeSnippet` is HTML-escaped; `d.filePath` (attacker-influenceable via `/api/scan`'s
`fileName` field) and `d.remediation` are interpolated raw — a real stored-XSS bug if the generated
HTML is ever opened in a browser with a crafted filename. **Confirmed not currently reachable from any
live `app/api/**` route** (CLI-only, via `--out report.html`), so today's blast radius is limited to a
CI pipeline scanning attacker-named files — but it is a real bug, not a theoretical one. **Fix:** apply
`escapeHTML()` to both fields for defense in depth.

**M4 — Unmasked `details` field on the public `/api/dashboard/activity` feed.** `log.email` is masked
before this anonymous-facing feed is served, but `log.details` is not. Currently safe by content
inspection, but not structurally enforced against a future `AuditLogger.logEvent` call site writing an
identifying string into `details`. **Fix:** mask/strip `details` on this specific public feed.

**M5 — `GET /api/admin/system` and `getAllUsers()` are unbounded everywhere they're called.** Same
missing-pagination pattern as H2, but ADMIN-gated, so blast radius is smaller. Acceptable at current
scale; a real gap if the user base grows.

**M6 — Raw `err.message` returned to the client on ~9 of 10 sampled routes' generic 500 handler**,
including `api/auth/login`, `api/projects`, `api/profile`, `api/admin/users`, `api/report`,
`api/notifications`, `api/submissions`, `api/export-dissertation`. `api/scan` is the one deliberate
gold-standard exception (explicit in-code comment: "never forward err.message/stack to the client").
This reads as a fix applied to one flagged route without generalizing project-wide. Real information-
disclosure risk on an unexpected server error (e.g. a Prisma constraint message echoing schema
internals), not directly attacker-controlled content. **Fix:** adopt the `/api/scan` pattern (log full
detail server-side, return a generic message) everywhere a route touches `fs` or Prisma directly.

**M7 — No documented database backup/restore strategy.** Zero mentions in `DEPLOYMENT.md`/
`DATABASE.md`. Currently relies entirely and silently on Supabase's platform defaults. **Fix:**
document the actual retention/restore story explicitly, even if it is "we rely on Supabase's default
backups" — an honest statement, not a silent gap.

**M8 — No external monitoring/APM.** No Sentry/Datadog/New Relic/etc. anywhere in `package.json` or
source; production error visibility is `console.error`/Vercel function logs only. Acceptable for a
research deployment, insufficient for real incident response.

---

## Low Priority Findings

- **L1** — Stateless access token (JWT) is not blacklisted at logout; remains valid up to its 1-hour
  natural expiry even after the refresh token is revoked. Standard, already-documented JWT tradeoff.
- **L2** — `GET /api/report` is unauthenticated and returns raw `err.message` on failure; low impact
  since every file path it touches is fixed/non-user-controlled (no path traversal possible).
- **L3** — `/api/profile`'s `REGENERATE_API_KEY` action is not rate-limited (unlike `CHANGE_PASSWORD`
  on the same route).
- **L4** — `/api/admin/users` has no self-demotion or last-admin-deletion guard — an operational
  footgun for an admin, not an externally exploitable vulnerability.
- **L5** — 5 of the 6 dead Prisma models lack `@@index([userId])` — near-zero impact since they're
  unreferenced by any application code path (see Database Assessment).
- **L6** — No confirmed, consistent request-body size cap across every scan-write path; confirmed
  present on `/api/scan` (500KB) and `/api/user-study/log-scan`, not independently confirmed on
  `/api/scans` POST in this pass.
- **L7** — Naming collision: the storage-provider layer's raw `getScanRecords(userId?)` and the
  repository layer's paginated `ScanRepository.getScanRecords(query)` share a name with different
  signatures across layers — plausibly how H2's unbounded call was introduced by mistake. Worth
  renaming one for clarity.

**Explicitly flagged as unconfirmed, not asserted (honesty over completeness):**
- Two previously-documented false-positive detector classes (`FIGM-REACT-01`, `FIGM-REACT-03`, from
  `benchmarks/real-world/SUMMARY.md`) were **not re-verified against current detector source** in this
  pass — flag as unconfirmed whether still present, don't cite as current without a follow-up check.
- RBAC coverage is **not exhaustive**: `/api/admin/rule-stats`, `/api/export*`, `/api/search`,
  `/api/notifications`, `/api/settings` were not individually IDOR-traced end-to-end (though all were
  confirmed to require auth in the API inventory pass).
- Every RBAC/auth finding in this report is **static-source-only** — no live HTTP probing was
  performed. Recommend a live black-box pass (unauthenticated curl against each admin route expecting
  401/403, cross-account token replay) as a follow-up to raise confidence from "the code enforces this"
  to "demonstrated under real request handling."
- `npx prisma migrate status` could not be run live (no outbound network access to Supabase in this
  sandboxed session) — not claimed broken, simply unverified this pass.
- WCAG `standardReference` citation coverage was not exhaustively confirmed per individual
  ACCESSIBILITY-domain rule.

---

## API Inventory Table

35 route files under `app/api/**/route.ts` (Glob-confirmed count), covering ~50 HTTP method handlers.
27 require authentication; 8 are intentionally, documentedly public.

| # | Endpoint | Method | Auth | Roles | Purpose | DB / Deps | Risk (Severity) |
|---|---|---|---|---|---|---|---|
| 1 | `/api/health` | GET | NO (intentional) | — | Liveness probe | RepositoryFactory | None |
| 2 | `/api/report` | GET | **NO** | — | Serves/regenerates a sample scan report | fs, RuleExecutionEngine | Unauthenticated + unthrottled compute; leaks `err.message` (L2) |
| 3 | `/api/research-metrics` | GET | NO (intentional) | — | Public dissertation evidence JSON | fs | None |
| 4 | `/api/dashboard/summary` | GET | NO (intentional) | — | Public aggregate stats | DashboardRepository | None |
| 5 | `/api/dashboard/activity` | GET | **NO** | — | Public recent-activity feed | DashboardRepository | `details` field not structurally PII-safe (M4) |
| 6 | `/api/dashboard/frameworks` | GET | NO (intentional) | — | Public framework-distribution counts | DashboardRepository | None |
| 7 | `/api/dashboard/statistics` | GET | NO (intentional) | — | Public aggregate domain scores | DashboardRepository | **Unbounded full-table read (H2)** |
| 8 | `/api/dashboard/reports` | GET | YES | self (ADMIN=global) | Recent scan reports | DashboardRepository | None |
| 9 | `/api/auth/register` | POST | N/A | — | Signup | UserRepository | Role correctly clamped, cannot self-assign ADMIN |
| 10 | `/api/auth/login` | POST | N/A | — | Login | UserRepository | Raw `err.message` on 500 (M6) |
| 11 | `/api/auth/logout` | POST | Optional | — | Logout, revokes refresh token | UserRepository | None — prior bug confirmed fixed |
| 12 | `/api/auth/refresh` | POST | N/A (token) | — | Rotate token pair | UserRepository | Tokens duplicated in body (M1) |
| 13 | `/api/auth/me` | GET | YES | any | Current user info | UserRepository | None |
| 14 | `/api/auth/forgot-password` | POST | N/A | — | Issue reset token | UserRepository | None — existence-masked, correct |
| 15 | `/api/auth/reset-password` | POST | N/A (token) | — | Consume reset token | UserRepository | None — single-use enforced |
| 16 | `/api/auth/audit-logs` | GET | YES | ADMIN, AUDITOR | Recent audit log | AuditLogger | None |
| 17 | `/api/profile` | GET/PATCH/DELETE | YES | self only | Profile, password change, API key | UserRepository | `REGENERATE_API_KEY` not rate-limited (L3) |
| 18 | `/api/settings` | GET/PATCH | YES | self only | User settings | UserRepository | None |
| 19 | `/api/notifications` | GET/PATCH/DELETE | YES | self only | Notifications CRUD | NotificationRepository | None |
| 20 | `/api/projects` | GET/POST | YES | self (ADMIN=global) | List/create projects | ProjectRepository | None |
| 21 | `/api/projects/[id]` | GET/PATCH/DELETE | YES | owner/ADMIN | Project detail/update/delete | ProjectRepository | None — field allow-listed |
| 22 | `/api/projects/[id]/duplicate` | POST | YES | owner/ADMIN | Duplicate project | ProjectRepository | None |
| 23 | `/api/scans` | GET/POST | YES | self (ADMIN=global) | List/create scans | ScanRepository | None — server derives score, not client |
| 24 | `/api/scans/[id]` | GET/PATCH/DELETE | YES | owner/ADMIN | Scan detail/favorite/delete | ScanRepository | None |
| 25 | `/api/scan` | POST | **action-dependent** | — | Core FIGM+code-error scan + AI-fix | RuleExecutionEngine, Fix pipelines | **AI-fix runs before auth check (H1)** |
| 26 | `/api/submissions` | GET/POST/DELETE | YES | self only | Saved submissions + re-analysis | SubmissionRepository | **No rate limiting (M2)** |
| 27 | `/api/export` | POST | YES | owner/ADMIN | Export a scan record | ExportService | None |
| 28 | `/api/export-dissertation` | GET | YES | any | Regenerate dissertation artifacts | DissertationExporter | None — correctly rate-limited (disk writes) |
| 29 | `/api/search` | GET | Optional | scoped by role | Global search | Several repos | None — safe empty-fallback for anon |
| 30 | `/api/admin/system` | GET | YES | ADMIN | System/DB health | RepositoryFactory | Unbounded reads (M5) |
| 31 | `/api/admin/users` | GET/PATCH/DELETE | YES | ADMIN | User management | UserRepository | No last-admin guard (L4) |
| 32 | `/api/admin/participants` | GET | YES | ADMIN | Participant matrix | ParticipantRepository | None |
| 33 | `/api/admin/participants/[id]` | GET/PATCH | YES | ADMIN | Participant detail/status | ParticipantRepository | None — input validated |
| 34 | `/api/admin/scans` | GET | YES | ADMIN | Global scan history | ScanRepository | None |
| 35 | `/api/admin/rule-stats` | GET | YES | ADMIN | Rule-firing analytics | RuleAnalyticsRepository | None |
| — | `/api/user-study/log-scan` | GET/POST | Session-cookie | research participant | Research scan logging | ParticipantRepository | None — prior HIGH bug confirmed fixed this session |

---

## Security Assessment

**No CRITICAL findings anywhere.** No SQL/NoSQL/command injection found (Prisma's typed query builder
used throughout, no raw string interpolation into any query; the only real `child_process` use — the
dynamic profiler — takes only pre-parsed source text, never a shell command built from user input). No
CSRF vulnerability (`sameSite=strict` httpOnly cookies + no-credentials CORS policy together defeat
classic cross-site cookie-riding). CORS is an explicit origin allow-list, never a wildcard. Security
headers (CSP/HSTS/X-Frame-Options/Permissions-Policy) genuinely apply to API responses, not just pages.

**IDOR: clean on every route traced.** Four concrete resource-ownership paths (`/api/scans/[id]`,
`/api/projects/[id]`, `POST /api/scans`, `/api/user-study/log-scan`) were traced end-to-end; every one
derives identity from the verified JWT/session, never a client-supplied id. No horizontal or vertical
privilege escalation found. `/admin/**` page gating is backed by independent, real API-level
enforcement, not a single point of failure.

**Authentication is strong** (88/100 on its own dedicated scoring): HS256 with constant-time
verification, role clamped both at sign and verify time, scrypt password hashing with legacy-PBKDF2
transparent upgrade, genuine timing-attack/enumeration mitigation on login, real refresh-token
rotation with revocation, existence-masked password reset, DB-backed rate limiting with a correctly
last-hop `X-Forwarded-For` resolution. The two deductions are M1 (token duplication in response body)
and the standard stateless-JWT logout tradeoff (L1).

**What pulls the overall Security Score down from Authentication's 88 to 79 overall:** the two live,
exploitable-today HIGH findings (H1, H2) sit outside the auth system itself (an auth-ordering bug and
an unbounded-query bug respectively), plus the M3 XSS field and the M6 error-leakage pattern add real,
if lower-severity, surface area the auth score alone doesn't capture.

---

## Architecture Assessment

Genuine layered separation: `src/` splits into 18 purpose-named directories (ai, analysis, ast, auth,
cli, db, engine, eval, hooks, matrix, parser, pipeline, reporter, storage, types, utils), not a
grab-bag. The FIGM 50-rule research engine and the general code-error/AI-repair engine are
architecturally separate **and enforced at runtime**, not just by convention: `figm-fix-pipeline.ts`
and `code-error-fix-pipeline.ts` each throw if handed a diagnostic outside their own domain. Both
route through the same single verification/rollback gate before any source mutation is applied
(`RemediationEngine.evaluatePatchResults`). Single rule-registry source of truth
(`FOUR_LAYER_MAPPINGS`) confirmed used consistently everywhere the rule count or rule list is needed —
no second hand-maintained copy found. Test-to-source ratio is roughly 1:1 (80 test files / 80 src
files). Zero unresolved TODO/FIXME/HACK developer-debt markers.

---

## Performance Assessment

**Performance Score: 68/100.** No N+1 query patterns found anywhere. The main paginated list surface
(`/api/scans`, `/api/admin/scans`) genuinely uses `skip`/`take` + parallel `count()`. The score is
pulled down specifically by H2 (public, unauthenticated, fully unbounded `getScanRecords()` read) and
M5 (admin-gated but still unbounded `getAllUsers()`/system reads) — both are real, not hypothetical,
scalability ceilings. A secondary contributor: an unverified/inconsistent request-body size cap across
every scan-write path (L6), and a same-named-but-different-signature method across the storage-provider
and repository layers (L7) that plausibly enabled H2 to be introduced by mistake in the first place.

---

## Database Assessment

**Verdict: SOUND.** 13 Prisma models; password storage is scrypt (N=65536/r=8/p=1, random salt per
account, format-tagged for self-describing legacy-upgrade), no plaintext or reversible secret storage
anywhere. Cascade behavior is deliberate and correct: user-owned data cascades on user deletion
(right-to-erasure-correct), while `AuditLog`/`ResearchEvaluation` use `SetNull` so the audit trail
survives user deletion (also correct — you want audit history to outlive the account it describes).
Data isolation is enforced at the query layer (repository methods filter by `userId` in the `where`
clause), not only at the API layer — correct defense-in-depth placement. **6 of 13 Prisma models are
confirmed dead** (`ApiKey`, `SavedReport`, `ResearchEvaluation`, `FrameworkBenchmark`, `AiHistory`,
`ExportHistory` — zero real Prisma-client usage found anywhere in `app/`/`src/`, re-confirmed this
session, not just repeated from a prior claim) — a maintainability/cleanliness issue, not a security
one. Migration status (`prisma migrate status`) could not be verified live in this sandboxed session
(no outbound DB network access) — reported as unverified, not claimed broken.

---

## Research Evaluation Assessment

| Research Question | Verdict | Basis |
|---|---|---|
| RQ1 — Performance analysis capability | **SUPPORTED** | 43/50 rules are `PERFORMANCE` domain, live via `/api/scan` + `/api/research-metrics` |
| RQ2 — Accessibility guideline validation | **PARTIALLY SUPPORTED** | 7/50 rules are `ACCESSIBILITY` domain (smaller surface); per-rule WCAG citation completeness not exhaustively confirmed this pass |
| RQ3 — Automated tool effectiveness | **SUPPORTED, genuinely live** | `evaluation-runner.ts`'s P/R/F1 formula reads directly from live TP/FP/FN counts produced by re-running the real engine against `benchmarks/testbed` and diffing `benchmarks/ground-truth.json` — confirmed not a hardcoded confusion matrix |
| RQ4 — Expert comparison and metrics | **NOT SUPPORTED** | Zero real evidence. Independent human annotation is genuinely `PENDING` (no submissions on disk); no Cohen's Kappa, no real expert-vs-tool comparison exists anywhere in the repository. Correctly not fabricated — but a real, unresolved gap. |

This project's evaluation infrastructure has a genuine research-integrity strength worth naming
explicitly: `research-metrics`'s benchmark numbers, the rule count, and the P/R/F1 figures are all
dynamically derived from live code paths, with in-code comments that explicitly guard against
over-claiming (e.g. never implying "all N rules" from a partial-coverage P/R/F1 figure). RQ4 is the one
area where no amount of further engineering closes the gap — it requires a real human completing the
independent-annotation workflow.

---

## Required Fixes Before Final Submission

**Must-fix (HIGH):**
1. Move `authenticateUser()` ahead of the AI-fix branch in `POST /api/scan` (H1).
2. Bound or cache `GET /api/dashboard/statistics`'s database read (H2).

**Should-fix (MEDIUM, in priority order):**
3. Stop returning tokens in the login/register/refresh JSON body (M1).
4. Add rate limiting to `POST /api/submissions` (M2).
5. Apply `escapeHTML()` to `filePath`/`remediation` in `report-generator.ts` (M3).
6. Standardize the `/api/scan`-style generic-error-message pattern across all routes touching
   `fs`/Prisma directly, starting with `api/auth/login` (M6).
7. Mask/strip `details` on the public `/api/dashboard/activity` feed (M4).
8. Add pagination to `getAllUsers()`/`/api/admin/system` (M5).
9. Document an explicit backup/restore statement, even if it's "relies on Supabase platform defaults"
   (M7).

**Recommended, not blocking:**
- Add basic external error monitoring (even a free-tier Sentry project) (M8).
- Rename one of the two colliding `getScanRecords()` signatures (L7).
- Follow-up live black-box RBAC probe pass to raise the auth/RBAC findings from static-verified to
  demonstrated-live.
- Re-verify whether the two previously-documented FP detector classes (FIGM-REACT-01/03) are still
  present against current source before citing them as current limitations anywhere.

---

## Final Recommendation

**B) Research Ready but Needs Minor Improvements.**

Justification: no architectural redesign is needed anywhere in this system. Authentication, RBAC,
injection resistance, CSRF resistance, database isolation, and the (historically dangerous) dynamic
code-execution sandbox are all genuinely well-engineered and independently re-verified against current
source, not assumed correct. The FIGM/general-code-error architectural separation this project depends
on for its research claims is real and runtime-enforced. What stands between this system and (A)
Production Ready is a short, concrete, non-architectural list: two HIGH-severity bugs (an auth-ordering
mistake and an unbounded query), a handful of MEDIUM hardening gaps that are each a small, well-
understood patch, and undocumented (not necessarily absent) backup/monitoring posture. What stands
between this system and a fully defensible research contribution is RQ4 specifically — real
independent human annotation, which no further code change can substitute for. Neither gap justifies
(C) Requires Major Improvements; both are addressable without touching the system's actual
architecture.
