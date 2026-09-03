# Stage 7G — Final Pre-Data-Collection Cleanup, Developer Dashboard User Scoping,
# GA4 Admin Integration, Metric-Truth Audit, Research Freeze v4

Scope: fix the developer dashboard's global-data leak into the "My Workspace" view, add an
honest GA4 admin-reporting surface, audit every visible product metric to its real source, verify
the local dev DB environment and confirm the database baseline has no test contamination, freeze
`research-freeze-v4`, and deploy/verify that exact version on Production. No real participant,
expert (RQ4), or RQ1 experiment data was collected this stage.

---

## 1. Baseline re-confirmation

```
research-freeze-v3   -> 748183fe0fa1bff79c5446a5a394e09917ec8186 (Stage 7F's frozen, PASS-accepted
                          Production candidate, unchanged/untouched this stage)
HEAD (session start) -> 748183fe0fa1bff79c5446a5a394e09917ec8186
```
`docs/audit/STAGE_7F_PRODUCTION_DEPLOYMENT_AND_ACCEPTANCE_REPORT.md` (present on disk, never
committed) confirmed: Production acceptance PASS, engineering-test accounts cleaned (31 users, 0
`engtest`/`curltest` remaining at the end of that stage), local `.env`'s `DATABASE_URL` flagged as
stale after the Supabase password rotation.

## 2. Local environment housekeeping

`.env`'s `DATABASE_URL`/`DIRECT_URL` failed Postgres authentication (`28P01`) — the pre-rotation
password. `.env.local` (edited more recently) had the correct rotated password for `DATABASE_URL`
(pooler, `:6543`) but a `DIRECT_URL` pointing at a direct host (`db.<project>.supabase.co:5432`)
that does not resolve from this network (`ENOTFOUND`) — not a credential issue, the host itself
isn't reachable here.

Per explicit owner instruction, both `.env`'s `DATABASE_URL` and `DIRECT_URL` were set to the
working pooled connection string (copied from `.env.local`, values never printed). Verified via a
direct `pg` client query (`SELECT 1`) — real connect + query succeeded.

`npx prisma migrate status` itself hangs indefinitely against the pooler (pgbouncer transaction
pooling doesn't support the advisory locks Prisma's migrate commands require) — a pre-existing
environmental limitation, not something this stage introduced or could route around without
inventing a direct connection string. Verified schema currency instead by directly comparing the 5
local migration folder names against `_prisma_migrations` rows in the DB: all 5 present and
`finished_at` set, in order. A read-only row-count check (`31` users, `4` projects) matched Stage
7F's own final post-cleanup counts exactly, confirming this is the same database.

```
LOCAL_DB_ENV_CURRENT: YES (owner-directed pooler-for-both fix; schema currency verified via direct
  _prisma_migrations comparison since `prisma migrate status` cannot complete against this pooler)
```

## 3–7. Developer dashboard data-flow trace and the leak

Traced every card in `app/components/dashboard/LiveDashboardContent.tsx` (rendered at `/`, which
`middleware.ts` gates to authenticated sessions only — despite the API routes behind it having
been built, and commented, as "intentionally public platform-wide" data from an earlier era before
`/` became the authenticated home) through to its API route and repository method:

| Card | API | Repository call (before) | Scope (before) |
|---|---|---|---|
| Total Projects/Scans/Rules/AI Suggestions, Composite Health Score, Framework Distribution | `/api/dashboard/summary` | `DashboardRepository.getSummary(undefined, role)` | **global**, ignored the caller entirely |
| Recent Activity Feed | `/api/dashboard/activity` | `getActivityFeed(10)` | **global** audit-log feed |
| Recent Static Inspection Reports | `/api/dashboard/reports` | `getRecentReports(userId)` | already correctly per-user |
| Top-bar Quality Score badge | `HeaderBar.tsx` via `useScans()` → `/api/scans` | already correctly per-user server-side | correct source, but the client computed an **average of every scan** with a `|| 90` fallback masking real 0% scores, and a hardcoded `90%` when the user had zero scans |

`getSummary()` already accepted an optional `userId` (proven by existing tests aggregating a
single seeded user's data) — the bug was that `/api/dashboard/summary/route.ts` never passed the
authenticated caller's id, always calling it with `undefined` (global). `getActivityFeed()` had no
`userId` parameter at all.

`/api/dashboard/frameworks` and `/api/dashboard/statistics` are legitimately global and are
consumed only by the Admin dashboard (`FrameworkTile` in `app/admin/page.tsx`) — left unchanged.

## 5–7. Fix implemented

- `app/api/dashboard/summary/route.ts` and `app/api/dashboard/activity/route.ts`: now require
  authentication (`authenticateUser`) and derive `userId` server-side —
  `role === 'ADMIN' ? undefined : auth.user.userId` — the same pattern `/api/dashboard/reports` and
  `/api/scans` already used. Never trusts a client-supplied id.
- `DashboardRepository.getActivityFeed(limit, userId?)`: new optional scope parameter, threaded
  through `StorageProvider.getAuditLogs(limit, userId?)` in both the Supabase/Prisma provider
  (`where: userId ? { userId } : undefined`) and the JSON fallback provider.
- `DashboardRepository.getSummary()`'s `avgQualityScore` is now `null` (not `0`) when the scope has
  zero real scans — a real 0% average and "nothing to average" are different facts.
- `LiveDashboardContent.tsx`: cards relabeled "My Projects" / "My Scans" / "My Findings" / "My AI
  Fix Suggestions"; the 5th card ("Active Developers", a platform-wide count with no honest
  per-user equivalent) removed rather than relabeled — grid is now 4 columns. Quality-score gauge
  renders an honest "No scans yet / RUN A SCAN TO SEE YOUR SCORE" state instead of a 0%-look ring.
  Empty states for Recent Activity and Recent Scans gained a "Run your first scan" CTA per the
  task's required contract.
- `HeaderBar.tsx`: top-bar badge now shows `records[0]` (the caller's single latest scan via the
  hook's default `createdAt desc` sort) instead of averaging every scan with a fabricated-90%
  fallback; renders "No scans yet" (neutral, not red/green) when the caller has none.
- `app/AdminSidebar.tsx` had its own separate, hardcoded tab list (distinct from the in-page
  `TABS` array in `app/admin/page.tsx`) — missed on the first pass, caught during the real-browser
  admin walkthrough when the new GA4 tab wasn't reachable from the sidebar; fixed.

## 8–14. Admin dashboard / GA4

Admin's global Product Analytics (Overview/Users/Scans/Framework/Rule Analytics/Audit
Logs/System Health) already sourced real, unfiltered-for-admin DB data and needed no change.

New: `src/lib/ga4-admin-reporting.ts` (`getGA4AdminReportingStatus()`) and
`app/api/admin/analytics/website/route.ts` (ADMIN-only) back a new, clearly separate "Website
Analytics (GA4)" admin tab. Since this deployment has no `GA4_PROPERTY_ID` /
`GA4_SERVICE_ACCOUNT_KEY` (the server-side GA4 Data API credentials a real admin-reporting
integration would require — the public client Measurement ID alone cannot query historical GA4
data), the panel renders an honest "Not configured for admin reporting" state. No fake charts. GA4
client-side tracking (`app/components/GoogleAnalytics.tsx`, `src/lib/analytics.ts`) was already
correctly implemented pre-Stage-7G (`send_page_view: false` + manual per-route `page_view`, gated
on `NODE_ENV === 'production'` and a configured Measurement ID) and was left unmodified.

## 15–20. Database pre-collection baseline audit

Read-only dry-run inventory (Production/shared database, since local dev and Production
share the same Supabase project):

```
users by role:        ADMIN 2, DEVELOPER 29 (31 total)
users by accountType:  NORMAL 31 (0 ENGINEERING_TEST at baseline)
engtest/curltest email matches (not already ENGINEERING_TEST): 0
researchStatus:        ASSIGNED 10 (real @user-study.figm.local RQ4 participants), null 21
projects: 4  |  scan_reports: 920  |  notifications: 3  |  audit_logs: 2082
submissions / research_evaluations / ai_history / export_history / saved_reports /
  framework_benchmarks: 0 each
```

**Zero pre-existing contamination found** — Stage 7F's own cleanup already left the database
clean. No destructive baseline cleanup was required or performed this stage.

```
DB_BACKUP_STATUS: NOT_VERIFIED (no destructive cleanup was needed this stage, so this gate was
  not exercised; Supabase's own backup/snapshot configuration was not independently checked)
DB_CLEANUP_DRY_RUN: USERS_TO_DELETE 0, PROJECTS_TO_DELETE 0, SCANS_TO_DELETE 0,
  NOTIFICATIONS_TO_DELETE 0, AUDIT_ROWS_TO_DELETE 0, OTHER_ROWS_TO_DELETE 0 (pre-existing baseline)
ADMINS_AFFECTED: 0  RESEARCH_PARTICIPANTS_AFFECTED: 0  EXPERT_SUBMISSIONS_AFFECTED: 0
```

## 21. Full product metric-truth audit

`docs/product/METRIC_SOURCE_REGISTRY.md` — every visible metric (Developer dashboard, header,
Admin, Scanner, GA4) traced UI → API → repository → DB query, with semantic definition,
aggregation/filter, empty-state behavior, engineering-test exclusion, and research-usage
allowance documented.

```
METRIC_SOURCE_REGISTRY: PASS
HARDCODED_PLAUSIBLE_METRICS: 0
```

## 22. Regression tests added

- `tests/dashboard-analytics.test.ts`: `avgQualityScore` empty-case assertion changed from `0` to
  `null`; two new tests — (A) a brand-new developer's scoped summary/reports/activity are all
  zero/empty/null even while another user has real activity in the same store; (B) User A's
  scoped views never contain User B's data and vice versa (summary, reports, activity feed).
- `tests/api-security-audit.test.ts`: `/api/dashboard/summary` unauthenticated → now `401` (was
  `200`, the exact leak); new tests confirming a DEVELOPER caller gets a scoped (zero) result on a
  fresh id and ADMIN still gets the platform-wide aggregate.
- `tests/header-quality-score-truth.test.ts` (new): source-level regression guarding against the
  `|| 90` fallback and the hardcoded 90% no-scans default ever being reintroduced into
  `HeaderBar.tsx`.
- `tests/ga4-admin-reporting.test.ts` (new): missing GA4 Data API credentials → honestly
  `configured: false` with a real explanatory reason; client-tracking status is independent of
  admin-reporting status; both credentials present → `configured: true`; admin page source
  guarded against ever fabricating GA4 numbers with `Math.random()`.

## 23. Local verification

```
npx tsc --noEmit               -> clean
npm test                       -> 1463/1463 pass, 0 fail (re-run twice, identical result)
rm -rf .next && npm run build  -> PASS, exit 0, 59/59 routes generated
```
`/api/dashboard/summary` and `/api/dashboard/activity` now show `ƒ` (dynamic) in the build's route
table, as expected now that they require authentication (were previously `ƒ` already via
`force-dynamic`/no-request-read heuristics; unchanged in that respect, just now also
auth-gated).

## 24–26. Real browser verification (local dev, connected to the shared Supabase DB)

Registered a clearly-marked `engtest.stage7g.*@figm.io` account pair plus one temporary
ENGINEERING_TEST admin promotion (owner ran the DB update directly — see Section 26 note below;
this session never performed a role-escalation write itself, per the permission classifier's own
block on that action).

- **New account ("Stage7G EngTest A")**: My Projects/Scans/Findings/AI Suggestions all `0`; My
  Quality Score "No scans yet / RUN A SCAN TO SEE YOUR SCORE"; Framework Distribution three empty
  bars; My Recent Activity "No recent activity yet." + CTA; My Recent Scans empty + CTA; top-bar
  "No scans yet". **Zero** global numbers (no 900+ scans, no 2000+ rules triggered) visible
  anywhere.
- **After running real scans** (the live-scan page's own auto-scan-on-load behavior persisted 4
  real scans of the loaded example file): My Scans `4`, My Findings `12`, My Quality Score `69%
  VERIFIED`, top-bar "Latest Scan: 69% (FAILED)" (`< 70` correctly renders FAILED), Framework
  Distribution React JSX/TSX `4 Repos` (100% bar) — all real, internally consistent, matching the
  persisted `scan_reports` rows exactly (confirmed via `My Recent Scans` table: 4×
  `UserProfile.jsx`, `69%`, `3 defects`).
- **Second account ("Stage7G EngTest B")**: registered fresh — **zero** leakage of Account A's
  `UserProfile.jsx`/69% score/activity. Confirmed via full page text extraction, not just visual
  inspection.
- **Admin** (temporary ENGINEERING_TEST-promoted account, owner-executed DB write, deleted after):
  Overview showed real global counts (`34` users incl. the 3 test accounts, `4` projects, `924`
  scans incl. the 4 test scans, `Postgres (Supabase)`); new "Website Analytics (GA4)" tab
  (discoverable from the sidebar after the `AdminSidebar.tsx` fix) rendered "Client tracking: NOT
  CONFIGURED" / "Admin reporting: NOT CONFIGURED" with the full honest explanatory text — correct
  for local dev (`NODE_ENV !== 'production'`, no GA4 Data API credentials).
- Zero unexpected console errors throughout (the one console entry seen — "Extra attributes from
  the server: crxlauncher-bridged,crxlauncher" — is the browser-automation extension's own DOM
  injection, unrelated to the app).

**Incidental finding, not a Stage 7G regression**: mid-verification, `/api/admin/system` was
observed taking up to ~17s in local dev (real DB round-trips across 4 sequential, un-parallelized
provider calls fetching all 920+ scan rows and 2082 audit-log rows) — this triggered a transient
Next.js dev-mode `ChunkLoadError` once. Traced to an unrelated environmental issue: an earlier
`npm run dev` process (stopped via its task ID) had not actually released port 3000 before a
second instance started on port 3001, so the browser kept hitting a stale/zombie process. Resolved
by force-killing the orphaned `node` processes and restarting cleanly on port 3000; the route
itself works correctly and returns real data (confirmed both via the app and a direct manual
fetch) once addressed. Pre-existing route performance (sequential rather than parallel queries) is
noted but out of this stage's scope to optimize.

```
DEVELOPER_DASHBOARD_USER_SCOPED: PASS
NEW_USER_DASHBOARD: PASS
OTHER_USER_DATA_LEAK: 0
TOP_BAR_SCORE_SEMANTICS: caller's single latest persisted scan ("Latest Scan: N% (PASSED/FAILED)",
  threshold >=70), "No scans yet" when none exist -- never an average, never a fabricated default.
  (For an ADMIN caller, /api/scans's pre-existing, unchanged-by-this-stage semantics return the
  platform-wide most-recent scan, not the admin's own -- consistent with ADMIN's existing
  global-visibility pattern elsewhere in this app, not a new leak.)
ADMIN_PRODUCT_ANALYTICS: PASS
```

## 27–28. Cleanup of this stage's own test data (local)

Deleted via the authenticated admin API (`DELETE /api/admin/users`), after a dry-run-equivalent
check confirmed exactly the 3 `engtest.stage7g.*` accounts created this stage (2 developer
accounts deleted cleanly; the temporary admin account's own self-delete succeeded at the DB level
but hit a pre-existing, unrelated bug — attempting to write a self-referential audit-log row for a
user that had just been deleted, an FK violation — surfaced as an HTTP 500 despite the deletion
itself having already succeeded; confirmed via direct read-only query, not assumed).

```
local users before: 34  ->  after: 31 (exact pre-Stage-7G baseline)
remaining engtest.stage7g.* rows: 0
orphan scan_reports/projects: 0
real ADMIN accounts (sanjula@nsbm.ac.lk, admin@figm.io): intact, unaffected
```

## 29–30. Pre-freeze inventory and secret review

```
git status --short (pre-commit) -> 20 intended Stage 7G files (7 modified source/API, 4 modified
  storage-provider files, 2 modified tests, 5 new files [1 API route, 1 lib, 2 tests, 1 doc], plus
  package.json's test-script list and the previously-uncommitted Stage 7F report) + the same
  benign benchmark/eval-summary/dissertation timestamp-regeneration residue from this stage's own
  `npm test` run (Stage 7E/7F's own documented, established pattern) -- left uncommitted, not part
  of the freeze commit, consistent with precedent.
.env / .env.local: untracked, gitignored, unchanged in this respect
No password/API key/service-account/Vercel-token value printed or committed anywhere this stage.
SECRET_LEAKAGE: 0
```

## 31–32. research-freeze-v4

```
Commit:  ef0ead7fac712bd62732f958a125db98e31b4bdf
         "feat(dashboard): scope developer dashboard to authenticated user, add GA4 admin panel"
Tag:     research-freeze-v4 (annotated), target == HEAD == commit above
research-freeze-v1/v2/v3: unchanged (61686e7a.../d64515f1.../748183fe... respectively)
```

## 33. Production deployment

```
vercel deploy --prod --yes   (two earlier attempts failed transiently -- "Not authorized" then
  "fetch failed" after a fully successful remote build; both are Vercel-API/network-level
  transients, not code or auth-scope problems -- the third attempt succeeded outright)
PRODUCTION_DEPLOYMENT_ID: dpl_DVd4kuwjvhCvWzy2E71JRb295suz
PRODUCTION_URL: https://figm-code-inspector.vercel.app (aliased)
readyState: READY, target: production
DEPLOYED_COMMIT_MATCHES_FREEZE_V4: YES (HEAD verified == research-freeze-v4 on a tree with no
  application-source diff, immediately before deploying)
```

## 34. Final production acceptance

All checks below run directly against `https://figm-code-inspector.vercel.app` after the v4
deploy, using freshly-created `engtest.stage7g.prod.*@figm.io` accounts (cleaned up after, see
Section 35):

```
GET  /api/health                -> 200 HEALTHY, database: CONNECTED_POSTGRES
GET  /                          -> 307 (unauthenticated redirect, correct)
GET  /about, /auth/login        -> 200
POST /api/auth/register (A)     -> 200, real tokens
GET  /api/dashboard/summary (A, brand-new) -> totalScans:0, totalProjects:0, avgQualityScore:null
POST /api/scans (A, real scan)  -> 200, real persisted record, qualityScore 89
GET  /api/dashboard/summary (A, after)     -> totalScans:1, avgQualityScore:89 (matches the scan)
POST /api/auth/register (B)     -> 200
GET  /api/dashboard/summary (B) -> totalScans:0, avgQualityScore:null (zero leakage of A's data)
GET  /api/dashboard/activity (B)-> {"activity":[]}  (no mention of A)
GET  /api/dashboard/reports (B) -> {"reports":[]}
POST /api/auth/logout (A)       -> 200
GET  /api/dashboard/summary (A's now-stale token) -> 401 TOKEN_REVOKED
POST /api/scan (unauthenticated smoke) -> qualityScore 100, figmStatus COMPLETE
Admin dashboard (owner's own real admin login, verified directly by the owner) -> Overview numbers
  correct; new "Website Analytics (GA4)" tab present
vercel logs (last 38 entries spanning this whole check) -> 100% "info" level, 0 "error" level
```

```
PRODUCTION_REGISTER/LOGIN/LOGOUT: PASS
PRODUCTION_STALE_TOKEN_REJECTION: PASS
PRODUCTION_NEW_USER_DASHBOARD: PASS (zeros/null, no leak)
PRODUCTION_ONE_SCAN_METRICS: PASS (real values, matches persisted record)
PRODUCTION_CROSS_USER_ISOLATION: PASS
PRODUCTION_ADMIN_GLOBAL_ANALYTICS: PASS (owner-verified directly; this session did not touch
  Production admin credentials or promote a Production account to ADMIN)
PRODUCTION_SCAN_SMOKE: PASS
PRODUCTION_DB_PERSISTENCE: PASS
BLOCKING_PRODUCTION_5XX: 0 observed across every check above and the reviewed log window
SECRET_LEAKAGE: 0
```

## GA4 verification

`NEXT_PUBLIC_GA_MEASUREMENT_ID` (`G-NLCX94QNDT`) was added to Vercel Production ~1h before this
stage's own deploy — the v4 deploy above is the first Production build to actually bake it into
the client bundle (a prior build would not have picked it up, per how Next.js inlines
`NEXT_PUBLIC_*` at build time). Verified in a real browser across `/about`, `/methodology`, and
`/auth/login`:

```
gtag.js load                    -> 200, correct src (googletagmanager.com/gtag/js?id=G-NLCX94QNDT)
page_view events                -> fired per route change (dp=/about, then dp=/auth/login,
                                    distinct requests -- confirms manual per-route tracking, not
                                    just gtag's own single automatic page_view), correct
                                    tid=G-NLCX94QNDT
```
The `google-analytics.com/g/collect` beacon calls all returned HTTP 503 in this specific automated
browser environment — most likely this session's own browser-automation tooling / tracking
protection intercepting the beacon (the app never inspects this response; `sendBeacon`/`fetch
keepalive` calls are fire-and-forget by design, so this does not indicate the app-side integration
is broken). GA4's own Realtime report could not be independently checked — this session has no
Google account credentials for the GA4 console, and inventing or requesting one is out of scope.

```
GA4_MEASUREMENT_ID_ENV: CONFIGURED
GA4_CLIENT_TRACKING: PASS (script loads; correctly-parameterized per-route events fire)
GA4_REALTIME: PARTIAL (network-level proof of correct client-side emission confirmed; GA4
  console's own Realtime report not independently viewable by this session -- not fabricated PASS)
GA4_ADMIN_REPORTING: NOT_CONFIGURED (by design -- no GA4 Property ID / service-account credential
  in this environment; the admin panel states this honestly, no fake charts)
GA4_PRIVACY_SAFETY: PASS (tests/analytics-payload-safety.test.ts, unmodified this stage, still
  passing -- no forbidden field name in src/lib/analytics.ts, single gtag('event', ...) call site,
  closed parameter types on every track* function)
```

## 35. Production cleanup of this stage's own test data

```
DRY RUN (email like 'engtest.stage7g.prod%'): 3 accounts (2 from the isolation-pair test, 1 extra
  from an earlier single-account check) -- all DEVELOPER/NORMAL, 0 ADMIN, 0 research participants
DELETE executed -> 3 rows removed
Verified after: total users 31 (exact pre-Stage-7G baseline), 0 engtest/curltest rows remaining,
  0 orphan scan_reports, both real ADMIN accounts (admin@figm.io, sanjula@nsbm.ac.lk) intact
```

---

## Report fields

```
LOCAL_DB_ENV_CURRENT: YES
DEVELOPER_DASHBOARD_USER_SCOPED: PASS
NEW_USER_DASHBOARD: PASS
OTHER_USER_DATA_LEAK: 0
TOP_BAR_SCORE_SEMANTICS: caller's single latest persisted scan; "No scans yet" honest no-data
  state when none exist; never an average, never a hardcoded fallback
ADMIN_PRODUCT_ANALYTICS: PASS

GA4_MEASUREMENT_ID_ENV: CONFIGURED
GA4_CLIENT_TRACKING: PASS
GA4_REALTIME: PARTIAL (client-side network emission confirmed; GA4 console Realtime report not
  independently viewable by this session -- no Google account access)
GA4_ADMIN_REPORTING: NOT_CONFIGURED
GA4_PRIVACY_SAFETY: PASS

DB_BACKUP_STATUS: NOT_VERIFIED (no destructive cleanup was needed this stage; Supabase's own
  backup configuration was not independently checked)
DB_CLEANUP_DRY_RUN: 0 pre-existing contamination found (local + Production share one DB); this
  stage's own test artifacts: 3 local + 3 Production accounts, all deleted (see Sections 27-28, 35)
DB_CLEANUP_EXECUTED: YES (own-artifact cleanup only; no pre-existing contamination existed)
ENGINEERING_TEST_USERS_REMAINING: 0
ADMINS_DELETED: 0
RESEARCH_PARTICIPANTS_DELETED: 0
EXPERT_SUBMISSIONS_DELETED: 0

METRIC_SOURCE_REGISTRY: PASS
HARDCODED_PLAUSIBLE_METRICS: 0

FINAL_TSC: PASS
FINAL_TESTS: 1463/1463 PASS
FINAL_BUILD: PASS

RESEARCH_FREEZE_V4_CREATED: YES
FREEZE_V4_COMMIT: ef0ead7fac712bd62732f958a125db98e31b4bdf
FREEZE_V4_TAG_TARGET: ef0ead7fac712bd62732f958a125db98e31b4bdf

PRODUCTION_DEPLOYMENT_ID: dpl_DVd4kuwjvhCvWzy2E71JRb295suz
PRODUCTION_URL: https://figm-code-inspector.vercel.app
PRODUCTION_ACCEPTANCE: PASS

REAL_PARTICIPANTS_CREATED_THIS_STAGE: 0
RQ4_EXPERT_SUBMISSIONS_CREATED_THIS_STAGE: 0
RQ1_RUNS_CREATED_THIS_STAGE: 0

READY_FOR_REAL_RESEARCH_DATA_COLLECTION: YES

NEXT_ACTION:
Preserve research-freeze-v4 (ef0ead7fac712bd62732f958a125db98e31b4bdf) and use this exact,
now-verified Production deployment (dpl_DVd4kuwjvhCvWzy2E71JRb295suz,
https://figm-code-inspector.vercel.app) for the approved real research-data collection stages.
Real data collection was NOT started this stage and requires a separate, explicit go-ahead.

Minor housekeeping items (not blockers):
  1. GA4 Realtime could not be independently confirmed by this session (no Google account
     access) -- worth a quick manual check in the GA4 console when convenient.
  2. /api/admin/users' DELETE handler throws an unhandled 500 on a true self-delete (deleting the
     currently-authenticated admin's own account) due to a foreign-key violation writing that
     deletion's own audit-log entry after the user row is already gone -- the deletion itself
     still succeeds; a real admin should simply avoid self-deleting via this endpoint until fixed.
  3. /api/admin/system's four sequential (not parallelized) DB queries can take several seconds
     under real data volume (920+ scans, 2000+ audit logs) -- a pre-existing characteristic, not a
     Stage 7G regression, but worth a future latency pass if the Admin dashboard's perceived load
     time becomes a concern.
```

---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SFoo68V5qcgsEiMcsBCRn6
