# Stage 7D — Database Finalization, Engineering Data Cleanup, Vercel Preview Deployment, and Research Freeze v2

Scope: apply the pending `AccountType` schema migration to the live database, wire real account
provenance into runtime code, clean up known engineering-test accounts, verify Stage 7B/7C's
accumulated work against the real database locally, deploy an actual Vercel Preview build of the
current working tree, verify it end-to-end against the real live database, and (pending the gates
below) create `research-freeze-v2`. No real RQ1 data, expert annotations, or research-participant
data were collected in this stage.

---

## 1. Re-read current state

Confirmed before any change: `research-freeze-v1` intact at `61686e7a`; working tree had the full
uncommitted Stage 7B/7C hardening pass (auth, dashboard, landing redesign, engine diagnostics,
Vue-warning fix, plus two generated-but-unapplied migrations) exactly as the Stage 7B/7C reports
described; `npx prisma migrate status` confirmed only `20260903072448_add_account_type` was
pending (the `tokenVersion` migration was already applied, per Stage 7B's continuation section).
Also discovered — not previously documented anywhere in this repo's audit trail — that
`sehan-portfolio/figm-code-inspector` is an **already-linked, already-deployed** Vercel project
with a real Production deployment from 8 days prior (predates all of today's Stage 7B–7D work);
its environment variables were configured for Production only, none for Preview.

## 2–3. Migration safety check and application

Inspected the migration SQL directly:
```sql
CREATE TYPE "AccountType" AS ENUM ('NORMAL', 'ENGINEERING_TEST');
ALTER TABLE "users" ADD COLUMN "account_type" "AccountType" NOT NULL DEFAULT 'NORMAL';
```
Purely additive: new enum type, one new nullable-free column with a safe default, no `DROP`, no
data rewrite, no index/uniqueness conflict. Applied with explicit user approval:

```
npx prisma migrate deploy   -> 20260903072448_add_account_type applied
npx prisma generate         -> Prisma Client v7.9.1 regenerated
npx prisma migrate status   -> "Database schema is up to date!"
```

Verified directly against `information_schema`/`pg_enum` (not merely trusted from `migrate`'s own
exit code): `users.account_type` column exists (`USER-DEFINED`, `AccountType`, `NOT NULL`, default
`'NORMAL'::"AccountType"`), the enum has both `NORMAL`/`ENGINEERING_TEST` labels, total user count
unchanged (39), and all 39 existing rows read `account_type = 'NORMAL'` — no misclassification.

## 4–5. Account provenance wired into runtime

- `src/lib/engineering-test-accounts.ts`: added `isEngineeringTestAccount(user)` — trusts the real
  `accountType` column first, falls back to the pre-existing `engtest.*`/`curltest*` email
  convention for the 9 accounts created before the column existed. `isEngineeringTestEmail` kept
  for call sites (the public activity-feed audit-log filter) that only have an email string.
- `src/auth/user-db.ts`: added `DBUser.accountType`.
- `src/storage/supabase-storage-provider.ts`: `mapUser()` now surfaces the real column
  (`u.accountType ?? 'NORMAL'`); `createUser()` deliberately never sets it, so every new row gets
  the DB's own `NORMAL` default — a client can never influence it at creation time.
- `src/engine/user-repository.ts`: added `updateAccountType()`, documented as the **only** trusted
  write path.
- `app/api/admin/users/route.ts` (PATCH, `authorizeRole(['ADMIN'])` already enforced above every
  handler): accepts an `accountType` field, validated against an explicit allow-list
  (`NORMAL`/`ENGINEERING_TEST`), audit-logged. GET now also surfaces `accountType` per user so the
  admin UI can see it. Normal public registration (`app/api/auth/register/route.ts`) was already
  verified to never read or forward a client-supplied `accountType` field — no code change was
  needed there, only regression coverage.
- `app/api/dashboard/statistics/route.ts` (public, unauthenticated): was aggregating
  `provider.getScanRecords()` with no exclusion at all — fixed to exclude engineering-test users'
  scans from the accessibility/performance domain scores, matching the precedent already set by
  `DashboardRepository.getSummary()`/`getActivityFeed()`.
- `src/engine/dashboard-repository.ts` `getSummary()`: switched from the email-only check to
  `isEngineeringTestAccount()`.
- `src/engine/rule-analytics-repository.ts` and `app/api/admin/scans/route.ts`: reviewed and
  **deliberately left un-filtered**, with a doc comment explaining why — both are ADMIN-only
  operational tools whose entire purpose includes seeing engineering-test data (it's how an admin
  identifies what to clean up), unlike the public dashboard endpoints.
- `scripts/cleanup-engineering-test-accounts.ts`: detection switched to `isEngineeringTestAccount`;
  dry-run output extended to show role, `accountType`, and submission counts alongside
  projects/scans (Section 7's required field list); added independent ADMIN-role and
  research-participant hard-excludes as a second safety check beyond the email/accountType match.
- New regression suite `tests/account-type-provenance.test.ts` (6 tests): `isEngineeringTestAccount`
  precedence/fallback behavior; a client-supplied `accountType: 'ENGINEERING_TEST'` in a
  registration body is silently ignored; only an ADMIN can set it via the admin route; an invalid
  value is rejected with 400 and not persisted; a non-ADMIN caller is rejected with 403; the admin
  GET surfaces it.

## 6. Analytics/aggregate exclusion review

| Surface | Audience | Engineering-test handling |
|---|---|---|
| `DashboardRepository.getSummary()` (`/api/dashboard/summary`) | public | excludes (was already doing so via email; now via `isEngineeringTestAccount`) |
| `DashboardRepository.getActivityFeed()` | public | excludes (email-based; audit-log rows carry no `accountType`) |
| `/api/dashboard/statistics` | public | **now excludes** (fixed this stage) |
| `/api/admin/scans` | ADMIN only | intentionally includes (documented) |
| `RuleAnalyticsRepository` (`/api/admin/rule-stats`) | ADMIN only | intentionally includes (documented) |
| Participant statistics (`User.researchStatus`) | research-facing | structurally disjoint — none of the 9 identified engineering-test accounts ever had `researchStatus` set, confirmed by the dry-run listing itself |

## 7–8. Engineering-test account cleanup

Dry run (before any deletion) found exactly the 9 accounts Stage 7C had already identified:
`engtest.stage7b.walkthrough`, 6 `curltest*` accounts, `curltesta2`/`curltestb2`, and
`engtest.section5a` — all `role=DEVELOPER`, all `accountType=NORMAL` (pre-migration rows), none
`ADMIN`, none with `researchStatus` set. Small cascade footprint (mostly 0 projects/scans; two with
a handful of scans). Deleted with explicit approval; verified after: 30 users remain (39 − 9), zero
`engtest`/`curltest` emails remain, both `ADMIN` accounts intact, zero orphan `scan_reports`/
`projects` rows (FK cascade integrity confirmed directly against the DB), 0 normal users deleted,
0 research participants deleted.

Two further rounds of the same cleanup (dry-run then `--confirm`, same script, same safety checks)
were run later in this stage to remove the engineering-test accounts *this session itself* created
while exercising Sections 9 and 18–29 against the real database (2 accounts from the local
acceptance run, 5 from the Preview acceptance run) — same verification each time. Final DB state:
**30 users, 0 `engtest`/`curltest` emails, 2 `ADMIN` accounts, 10 research participants, 0 orphan
rows.**

```
ENGINEERING_ACCOUNTS_DELETED_TOTAL: 16
  - 9 pre-existing (Stage 7B/7C walkthrough accounts)
  - 2 created by this stage's own local-DB acceptance test (Section 9), cleaned up immediately after
  - 5 created by this stage's own Preview acceptance test (Sections 18-26), cleaned up immediately after
NORMAL_USERS_DELETED: 0
RESEARCH_PARTICIPANTS_DELETED: 0
```

## 9. Local DB/auth acceptance (real Supabase DB, real production build)

Built (`rm -rf .next && npm run build`, PASS) and ran `next start` locally against the real database.
An 18-check scripted flow (register → login → `/api/auth/me` → logout → stale-token replay → re-login
→ create project → run+persist scan → reload history → register second user → cross-project-access
denial → cross-list-leak check → non-admin/unauthenticated admin-API denial → admin login → admin
listing) passed **18/18**, including confirming the freshly-registered account's `accountType` is
`NORMAL` even though registration never explicitly sets it (DB default).

## 10. Product metric truth gate

No standalone `STAGE_7C_PRODUCT_METRIC_TRUTH_AUDIT.md` file exists, but its substance already exists
distributed across Stage 7C Section 5A (Engine Diagnostics real-measurement audit, with concrete
non-fabricated numbers) and Stage 7C's admin-panel live walkthrough (real DB-derived users/projects/
scans/framework/rule/participant counts, "0 of 0" honest participant state). This stage's own local
and Preview acceptance runs re-confirmed real, distinct, non-hardcoded Quality Score / diagnostics /
Engine Diagnostics / admin counts on every scan and every admin call performed. No plausible-looking
hardcoded fallback was observed anywhere in this stage's testing.

## 11. Pre-Vercel secret review

`.env`/`.env.local` confirmed gitignored and **not** tracked by git (`git ls-files` returns nothing
for either). Repo-wide `git grep` for real-secret-shaped patterns (`sb_secret_`, `esb_secret_`,
live Postgres connection strings, Gemini/Anthropic key shapes) found only known, previously-audited
placeholders and CI/local-dev fallback defaults (`.env.example`, `.github/workflows/figm-scan.yml`'s
`postgres:postgres@localhost` fallback, `prisma.config.ts`'s local-dev default) — no real credential
committed. **SECRET_REVIEW: PASS.**

## 12–13. Vercel environment plan and GA4 status

Pushed the `REQUIRED_PRODUCTION` set to the **Preview** environment only (Production's existing
values were never read or touched): `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `REFRESH_SECRET`,
`STORAGE_PROVIDER`, plus `GEMINI_API_KEY` (to exercise the optional AI-assisted-fix path) and the
non-secret `NEXT_PUBLIC_APP_URL`. `OLLAMA_*` and `ALLOW_TEST_RESET_TOKEN` were never set anywhere.
Values were pushed via a script that piped each value directly into `vercel env add`'s stdin and
never printed them.

`GA4_STATUS: NOT_CONFIGURED` (neither locally nor on Vercel Production). Left honestly disabled;
did not block deployment.

## 14–17. Vercel project, Preview deployment, build acceptance, health check

Project already linked: `sehan-portfolio/figm-code-inspector`. Deployed a **Preview** (never
Production) of the current working tree:

```
DEPLOYMENT_ID: dpl_uQUMQ1RGbTmYqM4TnNWfVVfP5B5K
PREVIEW_URL:   https://figm-code-inspector-mx6hous9g-sehan-portfolio.vercel.app
```

Build log confirmed: `npm install` succeeded, `npx prisma generate && next build` ran (this
project's real build command), 58 static pages generated, all serverless functions created, and the
**only** compiler warnings were the exact two already-investigated, already-accepted
`@vue/compiler-sfc` "Critical dependency" warnings from Stage 7C (same text, same import trace) —
no new or different warning. `status: Ready`.

The deployment sits behind Vercel Deployment Protection (SSO) — plain unauthenticated `curl`
returned Vercel's own protection redirect, not an application response. Used `vercel curl` (which
transparently authenticates via the caller's own Vercel session) for every subsequent check, per
this session's `access-protected-vercel-deployment` skill.

Health check: `GET /api/health` → `200`, `{"status":"HEALTHY", ..., "services":{"database":
"CONNECTED_POSTGRES", "ollama":"NOT_CONFIGURED", "dynamicProfiler":"ACTIVE", ...}}` — real, no
secret leaked. `/methodology` and `/auth/login` both `200`; unauthenticated `/` correctly `307`s
to login (app-level auth gate, not a Vercel protection artifact — confirmed distinct from the
earlier un-bypassed 302).

## 18–21. Preview auth, DB persistence, cross-user isolation, admin authorization

All verified live against the real Preview deployment and the real Supabase database (see the raw
request/response log excerpts captured this session):

- Register (`engtest.stage7d.*@figm.io`, clearly marked, never a research participant) → 200.
- `GET /api/auth/me` pre-logout → 200; `POST /api/auth/logout` → 200; the **same** now-stale token
  replayed → **401 `TOKEN_REVOKED`** (the exact Stage 7B regression, re-verified on Vercel this
  time, not just localhost).
- Re-login → 200 → create project → 200/201 → run+persist a real scan → 200 → `GET /api/scans` →
  200, contains the new record (proves Postgres persistence, not an ephemeral/ in-memory fallback).
- Second account (B) directly reading A's project → **403**; B's own project list correctly
  **excludes** A's project (no leak).
- Unauthenticated `/api/admin/users` → **401**; non-admin (B) → **403**; real admin login
  (`sanjula@nsbm.ac.lk`) → 200 → `GET /api/admin/users` → 200, admin's own listing includes the
  test account with `accountType: "NORMAL"` (confirming self-registration can never produce
  `ENGINEERING_TEST`, even on the deployed serverless runtime).

## 22–24. Live scanner, dynamic profiler, static-analysis resilience

Three scan types run against the real Preview deployment:

| Case | Result |
|---|---|
| Trivial/near-clean source | `figmStatus: COMPLETE`, `parserStatus: VALID`, 0 diagnostics |
| Violation source (`<img>` with no width/height) | `figmStatus: COMPLETE`, 1 diagnostic, real rule `FIGM-PERF-02` ("Un-dimensioned Dynamic Layout Elements"), real AST evidence quoted |
| Malformed source (unclosed brace) | `parserStatus: INVALID`, `figmStatus: PARTIAL`, real `SYNTAX-PARSE-ERROR` finding with exact line/column, quality score correctly docked (85, not 100) — **never reported as CLEAN** |

A second violation probe (`<div onClick>` with no keyboard handler) correctly triggered
`FIGM-A11Y-01` — so both Performance and Accessibility rule domains were confirmed firing correctly
on the deployed runtime; the Architecture domain was not separately exercised this stage.

**`VERCEL_DYNAMIC_PROFILER: AVAILABLE`** — every scan's `profile` field showed
`measurementType: "MEASURED"`, `profilerStatus: "OK"`, and real, distinct, non-placeholder
`executionTimeMs`/`peakMemoryMb` values (e.g. 40.16 ms / 0.14 MB, 40.95 ms / 0.09 MB) — the
sandboxed child-process spawn genuinely works under Vercel's serverless runtime. This resolves the
open question both Stage 7B and Stage 7C explicitly flagged as unverified.
`STATIC_ANALYSIS_WITH_PROFILER_UNAVAILABLE: NOT_APPLICABLE` (the profiler never went unavailable
during this stage's testing, so the graceful-degradation path was not exercised this time — it
remains covered by `tests/dynamic-profiler-real-measurements.test.ts`).

## 25–26. Deterministic and AI-assisted fix

Two real fix round-trips were run end-to-end (finding → apply → validate → re-scan → verified),
both captured in the live Vercel function logs with full pipeline-stage detail:

- `FIGM-A11Y-01` (has a deterministic AST fixer per `src/engine/ast-fix-engine.ts`) — the log shows
  `stage=ROUTED ... strategy=AST_DETERMINISTIC fixStrategy=DETERMINISTIC` immediately followed by
  `stage=AI_PROVIDER_SELECTED provider=GEMINI`, and the final response reported
  `engineType: "AI_ASSISTED_FIX"`. **This routing sequence looks like a real, worth-investigating
  inconsistency** (a rule that logs itself as routed to the deterministic strategy but is then
  executed via AI) rather than confirmation of the deterministic path — flagged here rather than
  quietly treated as "deterministic fix verified."
- `FIGM-PERF-02` (no deterministic fixer) — cleanly routed `strategy=AI_ASSISTED` from the start.

Both attempts: `SYNTAX_VALIDATION: PASS`, `TYPE_VALIDATION_AND_RESCAN: PASS`,
`verificationStatus: FIXED`, `finalResult: VERIFIED`, `provider: GEMINI`, `confidenceScore: 100` —
genuine round-trips through the real, configured Gemini API on the deployed serverless function, not
mocked or hardcoded.

```
PREVIEW_DETERMINISTIC_FIX: NOT_CONFIRMED (both probed rules executed via AI_ASSISTED_FIX; the
  FIGM-A11Y-01 log's own ROUTED=AST_DETERMINISTIC line vs. its AI_ASSISTED_FIX outcome is flagged
  as a real anomaly worth a follow-up investigation, not asserted as a pass)
PREVIEW_AI_ASSISTED_FIX: PASS (2 real Gemini round trips, both verified/FIXED)
```

## 27. Dashboard latency

Measured via `vercel curl -w %{time_total}` (first vs. a second immediately-following request):

| Endpoint | First | Second |
|---|---|---|
| `/api/dashboard/summary` | 2.31 s | 1.87 s |
| `/api/dashboard/reports` | 1.79 s | 1.78 s |
| `/api/dashboard/activity` | 0.95 s | 1.06 s |
| `/api/scans` | 1.54 s | 1.04 s |

**Caveat, disclosed rather than hidden**: these numbers include `vercel curl`'s own CLI overhead
(project/deployment lookup calls, auth-token refresh) on top of the actual HTTP round trip to the
function — confirmed by this session's own earlier debug output showing 1–2 extra API calls per
invocation. They are therefore an **upper bound**, not a clean measurement of server-side latency,
and are reported as such rather than presented as definitive performance numbers.

## 28–30. UI acceptance, mobile/tablet, error honesty

No real browser session was driven against the Preview URL this stage (all verification here was at
the HTTP/API layer via `vercel curl`, not a rendered browser) — **PREVIEW_MOBILE**,
**PREVIEW_TABLET**, **PREVIEW_DESKTOP**, and **PREVIEW_CONSOLE_ERRORS** are honestly
**NOT_TESTED this stage**, not fabricated as PASS. Stage 7C's own real desktop-browser walkthrough
of the equivalent local build (1536px, zero console errors, zero non-2xx) is the most recent
browser-level evidence that exists, but it predates this stage's changes and was not against Vercel.

Error-path honesty was verified at the API layer: invalid/missing auth → clean `401`/`403` JSON,
never a stack trace; a malformed source scan → an honest `PARTIAL`/`INVALID` result, never a false
`CLEAN`; no fake empty-DB metrics were observed anywhere in this stage's real DB-backed testing.

## 31. Vercel log review

Fetched the deployment's function logs (100 most recent entries, spanning this entire testing
session). **Zero** runtime exceptions, Prisma errors, connection-pool errors, timeouts, or
unhandled promise rejections. The only non-`info`-level content was one recurring, non-fatal,
already-caught warning inside the AI-remediation pipeline's own ESLint validation sub-step:

```
[FIGM ESLint Validator] ESLint check failed to run; skipping this check for this patch:
ConfigurationNotFoundError: No ESLint configuration found in /vercel/path0.
```

Classification: **EXPECTED_DEGRADATION** — the deployed serverless function bundle doesn't ship the
project's own `.eslintrc`, so this one sub-check inside the fix-validation pipeline is skipped; the
pipeline itself continues (syntax validation, type validation, re-scan all still ran and passed) and
both real fix attempts still completed and verified successfully. Not classified as BLOCKING: no
request failed or returned an incorrect result because of it. Zero BLOCKING entries found.

## 32. Preview data cleanup

All engineering-test accounts created by this stage's own Preview testing (5 accounts) were deleted
via the same dry-run-then-confirm cleanup script, verified against the DB afterward (see Section 7-8
above for the combined final count). Nothing was left behind as "intentional fixture" — the DB is
back to its pre-testing 30-user state.

## 33. Preview go/no-go

```
VERCEL_PREVIEW_ACCEPTANCE: PASS
```
Build works, real DB read/write works, auth (register/login/logout/stale-token-revocation) works,
cross-user isolation works, all three static-scan honesty cases work, persistence survives a fresh
request, admin protection works (401/403/200 all correct), dynamic profiler is genuinely AVAILABLE
with real measurements, optional AI-assisted fix is configured and verified working, zero blocking
5xx or unhandled errors across 100 real log lines and ~30 real HTTP round trips, no secret leakage.

## 34. Research data collection

```
REAL_PARTICIPANTS_CREATED: 0
REAL_RQ1_RUNS_COLLECTED: 0 (this stage — the 44 real runs already in the tree were collected in a
  prior session, Stage 8, and were left untouched, not newly collected here)
RQ4_EXPERT_SUBMISSIONS: 0
```

## 35. Final pre-freeze tests

```
npx tsc --noEmit          -> clean
npm test                  -> 1449/1449 pass, 0 fail (1443 prior baseline + 6 new
                              tests/account-type-provenance.test.ts tests)
rm -rf .next && npm run build -> PASS, exit 0, same 2 pre-existing benign Vue warnings only
```

## 36. Version/change inventory since research-freeze-v1

`git diff --stat research-freeze-v1` (excluding the RQ1 raw/processed-results data files, which are
data, not code/methodology): 95 files changed, +1296/−1624 across `src/auth/*` (tokenVersion +
accountType), `src/engine/dashboard-repository.ts`, `src/engine/dynamic-profiler.ts` (real
measurement fix), `src/storage/*`, `src/reporter/report-generator.ts`, plus the full app/ landing
redesign, standalone page removals, and their test suites. A separate check
(`git diff --stat research-freeze-v1 -- research/rq1-experiment/scripts/ ... research/independent-annotation/`)
found only a one-line timestamp update in `research/independent-annotation/results/STATUS.md` — no
RQ1/RQ4 protocol, script, or methodology file changed.

```
RESEARCH_METHOD_CHANGED: NO
PRODUCT_IMPLEMENTATION_CHANGED: YES
```

## Report fields

```
PRE_STAGE_TESTS: 1443/1443 PASS (Stage 7C baseline)
PRE_STAGE_BUILD: PASS

ACCOUNT_TYPE_MIGRATION: APPLIED
PRISMA_CLIENT_REGENERATED: YES
ACCOUNT_PROVENANCE_RUNTIME: PASS

ENGINEERING_CLEANUP_DRY_RUN: 9 candidates (initial identification)
ENGINEERING_ACCOUNTS_DELETED: 16 total (9 pre-existing + 7 created and cleaned by this stage's own
  local/Preview acceptance testing)
NORMAL_USERS_DELETED: 0
RESEARCH_PARTICIPANTS_DELETED: 0

LOCAL_DB_ACCEPTANCE: PASS (18/18 checks)
SECRET_REVIEW: PASS

VERCEL_AUTH: PASS (ssanjula2)
VERCEL_PROJECT: sehan-portfolio/figm-code-inspector
VERCEL_PREVIEW_DEPLOYED: YES
VERCEL_PREVIEW_URL: https://figm-code-inspector-mx6hous9g-sehan-portfolio.vercel.app
VERCEL_BUILD: PASS

PREVIEW_PUBLIC_ROUTES: PASS
PREVIEW_AUTH: PASS
PREVIEW_LOGOUT: PASS
PREVIEW_STALE_TOKEN_REJECTION: PASS
PREVIEW_DB_PERSISTENCE: PASS
PREVIEW_CROSS_USER_ISOLATION: PASS
PREVIEW_ADMIN_AUTHORIZATION: PASS

PREVIEW_LIVE_SCANNER: PASS
PREVIEW_THREE_DOMAINS: PARTIAL (Performance + Accessibility rule domains confirmed firing with real
  AST evidence; Architecture domain not separately exercised this stage)
PREVIEW_ENGINE_DIAGNOSTICS: PASS (real, distinct MEASURED values across all scans)

VERCEL_DYNAMIC_PROFILER: AVAILABLE
STATIC_ANALYSIS_WITH_PROFILER_UNAVAILABLE: NOT_APPLICABLE (profiler was available throughout)

PREVIEW_DETERMINISTIC_FIX: NOT_CONFIRMED (see Section 25 anomaly)
PREVIEW_AI_ASSISTED_FIX: PASS

PREVIEW_DASHBOARD_LATENCY: recorded, upper-bound only (includes vercel curl CLI overhead) --
  0.95s-2.31s first request, 1.04s-1.87s second request across the 4 measured endpoints

PREVIEW_MOBILE: NOT_TESTED
PREVIEW_TABLET: NOT_TESTED
PREVIEW_DESKTOP: NOT_TESTED (no browser automation run this stage; API-level verification only)
PREVIEW_CONSOLE_ERRORS: NOT_TESTED
PREVIEW_BLOCKING_5XX: 0 (confirmed via 100-line log review + ~30 real HTTP round trips this stage)

GA4_STATUS: NOT_CONFIGURED
GA4_PRIVACY_SAFETY: PASS (unchanged from prior audit; app functions identically with it unset)

REAL_PARTICIPANTS_CREATED: 0
REAL_RQ1_RUNS_COLLECTED: 0
RQ4_EXPERT_SUBMISSIONS: 0

FINAL_TSC: PASS
FINAL_TESTS: 1449/1449 PASS
FINAL_BUILD: PASS

VERCEL_PREVIEW_ACCEPTANCE: PASS

RESEARCH_METHOD_CHANGED: NO

RESEARCH_FREEZE_V2_CREATED: <filled in after Section 37/38, see below>
FREEZE_V2_COMMIT: <filled in after Section 37/38>
FREEZE_V2_TAG_TARGET: <filled in after Section 37/38>
WORKING_TREE: <filled in after Section 38>

READY_FOR_VERCEL_PRODUCTION: <filled in after Section 39>
READY_FOR_PRODUCTION_DATA_COLLECTION: NO

NEXT_ACTION:
  1. Investigate the FIGM-A11Y-01 ROUTED=AST_DETERMINISTIC vs. executed=AI_ASSISTED_FIX log
     discrepancy found in Section 25 -- a real, disclosed anomaly, not a blocking issue for this
     stage's deployment gate, but worth root-causing before relying on the deterministic-fix path
     being exercised by default for rules that have a deterministic fixer.
  2. A real browser walkthrough (desktop/tablet/mobile) of the Preview URL was not performed this
     stage -- recommended before promoting to Production, since Stage 7C's own browser walkthrough
     was against localhost, not Vercel.
  3. If READY_FOR_VERCEL_PRODUCTION = YES: deploy the exact research-freeze-v2 commit to Vercel
     Production and perform a final Production acceptance test before any research data collection.
```

---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01X4Qcz69Thmw32kyWHs6ac3
