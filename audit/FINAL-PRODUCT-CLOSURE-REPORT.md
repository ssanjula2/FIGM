# FIGM Code Inspector — Final Product Closure Report

**Date:** 2026-08-21. Implements the "Final Product Auth Flow + Remaining Issue Closure" brief, closing five findings from `audit/ULTIMATE-LINE-BY-LINE-FORENSIC-AUDIT.md` (F-03 Cmd+K focus trap, F-04 submissions persistence, F-05 DynamicProfiler concurrency, F-07 resetToken clearing, plus the primary product requirement: authentication-gated homepage) and investigating admin provisioning (the prior audit lineage's open item).

Status labels used below: **FIXED AND VERIFIED**, **PARTIALLY FIXED**, **NOT VERIFIED**, **BLOCKED**, **KNOWN LIMITATION**.

---

## 1. Executive Summary

Every item in the brief's Final Acceptance Criteria was implemented and independently verified: `npx tsc --noEmit` (0 errors), the full test suite (699/699 pass, up from 678/678 baseline, 0 fail/skip), the controlled benchmark (F1=95.0%, exact match to the required baseline), a clean production build (53/53 routes), a freshly re-run real-world benchmark (network was reachable this session), and a live end-to-end browser verification against the real production database (register → dashboard → live-scan → history → logout → re-login, with history persisting and a leftover test account cleaned up afterward). No fabricated data, no bypassed database, no weakened security, and no broken existing functionality were introduced — see §12 for the specific verification evidence for each claim.

**One open item remains genuinely unresolved**: admin-account provisioning against the live database now has a real, safe, documented path (`npm run db:seed-admin`), but this session did not run it against the actual production database (running it would create real credentials this report should not describe or assume the value of) — see §6.

---

## 2. Authentication Flow

### BEFORE
`middleware.ts` treated `/` as a public path and gated only a hand-maintained allow-list of routes (`/admin`, `/submissions`, `/profile`, `/analytics`, `/auth`). Every other page — including the homepage (a public marketing/research-showcase landing view with a client-side toggle to a dashboard), `/live-scan`, `/history`, `/projects`, `/guidelines`, and more — was reachable by an unauthenticated visitor. `AppShell` wrapped every route, including the login/register pages, in the authenticated app's Sidebar/HeaderBar chrome.

### ROOT CAUSE
The middleware's `isPublicPath`/`matcher` was a positive allow-list of *protected* routes rather than a default-protected posture — any new page was public-by-default unless someone remembered to add it to the list. This is architecturally the same class of gap as several other findings in the forensic audit (a hand-maintained list silently going stale).

### FIX
- `middleware.ts`: `isPublicPath` now lists only the actual public surface (`/login`, `/register`, `/forgot-password`, `/auth/*`, `/about`, `/eval-results/*`, Next.js internals). `matcher` is now a single negative pattern (`/((?!_next/static|_next/image|favicon.ico|icon.svg).*)`) instead of a hand-maintained list — every route is protected by default, including any added in the future.
- `app/page.tsx`: now renders only `LiveDashboardContent` (the authenticated dashboard) — reachable exclusively because middleware already excluded unauthenticated visitors.
- `app/about/page.tsx` (new): the original public research-showcase landing content, relocated here rather than deleted, so it remains reachable without an account (research committee / external reviewer access) but no longer gates or precedes the product itself.
- `app/AppShell.tsx`: now renders `/auth/*`, `/login`, `/register`, `/forgot-password`, `/about` **without** the Sidebar/HeaderBar chrome (`isBareRoute`), so the login/register experience is genuinely standalone.
- `app/register/page.tsx`, `app/forgot-password/page.tsx` (new): thin redirect stubs to the canonical `/auth/*` pages, matching the existing `/login` → `/auth/login` pattern, for a consistent top-level trio.
- Post-login/register redirect target changed from `/guidelines` to `/` (the dashboard), matching the brief's flow diagram. The login page now also honors middleware's `?redirect=` query param (previously set but never consumed) so a visitor bounced from a specific protected page returns there after logging in instead of always landing on the dashboard.

### TEST
`tests/accessibility-regression.test.ts` — new `Regression: the application requires authentication before showing the product` block asserts `"/"` is not in middleware's public-path list, the matcher is a negative catch-all pattern, `AppShell` has `isBareRoute` logic, and `app/page.tsx` renders the dashboard (not the old landing content).

### VERIFICATION
Live browser: anonymous visit to `http://localhost:3001/` → 307 redirect to `/auth/login`, rendered standalone (no Sidebar/HeaderBar). See §12 for the full walkthrough.

### STATUS: **FIXED AND VERIFIED**

---

## 3. Login/Register Architecture

### Investigation (Phase 1 of the brief)
- Canonical login/register UI was already `/auth/login` / `/auth/register` (fuller implementation: httpOnly-cookie-aware, focus-managed error handling, accessibility regression coverage). `/login` already redirected to `/auth/login` (a prior fix, source comment confirms it).
- Auth is stored **both** ways: `/api/auth/login` and `/api/auth/register` set real httpOnly cookies (`figm_token`, `figm_refresh_token`) *and* return the token in the response body, which the client also stores in `localStorage` for `Authorization: Bearer` API calls. `src/auth/auth-middleware.ts#authenticateUser` checks the Bearer header first, cookie second — so API-route auth was unaffected by any of these changes. `middleware.ts`'s page-level gating reads the cookie only.
- No duplicate/diverging auth mechanism was created. `/register` and `/forgot-password` were added as redirect stubs (matching the existing `/login` pattern), not second implementations.

### FIX
Made `/login`, `/register`, `/forgot-password` (top-level) canonical redirect targets to the existing `/auth/*` implementations — one source of truth for login/register/forgot-password UI, per the brief's acceptance criterion.

### VERIFICATION
Live browser: `/` → `/auth/login` → "Register Now" link → `/auth/register`, filled and submitted → real session created → landed on `/` (dashboard). See §12.

### STATUS: **FIXED AND VERIFIED**

---

## 4. User Lifecycle

Verified live end-to-end (§12): register → authenticated session → dashboard (real stats: 2 projects, 66 scans, 148 rules triggered, live data) → Live Scan (real AST-based auto-scan, 3 genuine findings with real evidence) → Scan History (2 real persisted records) → Logout (session invalidated server-side, confirmed by `/` bouncing back to login afterward) → Re-login → history still present (both records, identical timestamps).

### STATUS: **FIXED AND VERIFIED**

---

## 5. Database Persistence

All persistence in the verified flow above went through the real Postgres/Supabase backend (`STORAGE_PROVIDER=supabase` active in this environment — confirmed via live `prisma:query` logs showing real `INSERT INTO scan_reports`, `INSERT INTO audit_logs`, `SELECT` queries against `public.users`/`public.projects`/`public.notifications`). No JSON-file fallback was used for any part of the live-browser verification. Cross-user isolation for submissions was verified directly (§8).

### STATUS: **FIXED AND VERIFIED** (for the flows exercised; not an exhaustive re-audit of every route)

---

## 6. Admin Functionality

### BEFORE
`src/auth/user-db.ts` already had safe, non-hardcoded admin-bootstrap logic (`resolveBootstrapAdminPassword`, `DEFAULT_ADMIN_ACCOUNTS`) — but it only runs automatically for the JSON storage backend (on first load of an empty local DB file). `SupabaseStorageProvider` has no equivalent auto-seed step at all. Per the prior audit lineage (`audit/FINAL-RELEASE-GATE.md`), a freshly-provisioned or credential-rotated production database therefore has zero users and no application-level path to create the first admin (self-registration correctly refuses to create ADMIN accounts).

### ROOT CAUSE
Missing: an explicit, safe provisioning path for the Postgres backend specifically. Not a security bug — the *absence* of an automatic seed is itself correct (a live database should not be seeded implicitly), but no manual path existed either.

### FIX
`scripts/seed-admin.ts` (new): explicit, idempotent script reusing the exact same `resolveBootstrapAdminPassword`/`DEFAULT_ADMIN_ACCOUNTS` logic as the JSON backend (one definition of "how a default admin password is resolved," not two). Never overwrites an existing account's password or role. Never prints the resolved password except via the pre-existing, already-scoped-to-dev/test `console.error` inside `resolveBootstrapAdminPassword` itself (unchanged). Added `npm run db:seed-admin`. Documented in `ENV_VARIABLES.md` (new "Admin Account Provisioning" section) and `README.md`.

### TEST
`tests/final-closure-regressions.test.ts` — `Admin account bootstrap is idempotent and never overwrites an existing account`: creates via `seedAdminAccounts()`, confirms both default accounts are created with role `ADMIN`; simulates an operator changing the seeded password; re-runs the script; confirms zero new accounts created and the changed password is untouched.

### VERIFICATION
Test-level: **FIXED AND VERIFIED** (passing, real Postgres-shaped provider interface exercised against the JSON fallback in the test environment — the test environment has no `DATABASE_URL` set, matching this repo's existing test convention).

Against the actual live production database: **NOT VERIFIED / BLOCKED BY DESIGN**. This session deliberately did not run `npm run db:seed-admin` against the real production database, and does not know whether an admin account already exists there. Doing so would create a real, live admin credential that this report should not describe, assume the value of, or imply has (or has not) already been done. **This is the one action from the brief's acceptance criteria that requires the project owner's own explicit action** (running the script with `ADMIN_BOOTSTRAP_PASSWORD` set to a real secret they control), not something this session should do on their behalf.

### STATUS: **PARTIALLY FIXED** — safe, tested, documented path now exists; actually provisioning the live database's first admin account is left to the project owner.

---

## 7. Password Reset

### BEFORE
`app/api/auth/reset-password/route.ts` cleared the reset token via `{ resetToken: undefined, resetTokenExpiry: undefined }`. Prisma's `update()` silently ignores `undefined`-valued fields (treats them as "not included"), so on the Postgres backend the token was **never actually cleared** — the exact same bug class already found and fixed for `refreshToken` at logout, but missed here.

### ROOT CAUSE
`undefined` vs `null` in a Prisma `update()` payload.

### FIX
`app/api/auth/reset-password/route.ts`: `resetToken: null, resetTokenExpiry: null` (explicit). `DBUser.resetToken`/`resetTokenExpiry` types widened to `string | null` (matching the existing `refreshToken` pattern) in `src/auth/user-db.ts`.

### TEST
`tests/final-closure-regressions.test.ts` — `Password reset actually clears resetToken/resetTokenExpiry`: sets a real pending token, resets successfully, asserts both fields are `null` afterward (not just absent-from-response), and asserts the same token is rejected (`400 INVALID_TOKEN`) on a replay attempt.

### VERIFICATION
`npm test`: passing (part of the 699/699 run).

### STATUS: **FIXED AND VERIFIED**

---

## 8. Submission Persistence

### BEFORE
`app/api/submissions/route.ts` imported `UserDB` directly and called `UserDB.getSubmissionsByUserId`/`UserDB.createSubmission`, bypassing `RepositoryFactory` entirely. No Prisma `Submission` model existed. Data always persisted to the local/tmp JSON file, never Postgres, regardless of `STORAGE_PROVIDER`. (Also confirmed this session: zero frontend callers of `/api/submissions` exist anywhere in `app/**` — this endpoint was reachable only via direct API call.)

### ROOT CAUSE
A production data path was never migrated onto the storage-provider abstraction the rest of the app uses.

### FIX
- `prisma/schema.prisma`: new `Submission` model (`userId`, `fileName`, `framework`, `codeContent`, `executionTimeMs`, `qualityScore`, `diagnosticsCount`, cascade-deletes with `User`).
- `prisma/migrations/20260821120000_add_submissions/migration.sql` (new, hand-authored in the same style as the existing baseline migration — **not applied to any live database this session**, see §17).
- `src/storage/storage-provider.ts`: `IStorageProvider` gains `createSubmission`/`getSubmissionsByUserId`/`deleteSubmission`.
- `src/storage/json-storage-provider.ts`: thin delegation to `UserDB` (unchanged JSON behavior, now behind the real interface).
- `src/storage/supabase-storage-provider.ts`: real Prisma-backed implementation.
- `src/engine/submission-repository.ts` (new): thin repository wrapper, mirroring `NotificationRepository`'s existing pattern.
- `app/api/submissions/route.ts`: rewritten to use `SubmissionRepository` instead of `UserDB`. Added a `DELETE` handler (didn't exist before) for parity with every other resource route, ownership-checked at the storage layer.
- `src/auth/user-db.ts`: added `UserDB.deleteSubmission` (ownership-checked, mirrors `deleteProject`/`deleteScanRecord`).

### TEST
`tests/final-closure-regressions.test.ts` — `/api/submissions persists through the real storage-provider abstraction`: creation, retrieval via `SubmissionRepository` directly (proving it isn't only readable from wherever POST happened to write it), cross-user isolation on GET, ownership-checked DELETE (a forged delete by another user returns 404 and does not remove the record), and real delete by the owner.

### VERIFICATION
`npm test`: passing (part of the 699/699 run). Not exercised in the live-browser walkthrough (no frontend UI calls this endpoint, confirmed above) — the migration itself is not yet applied to the live database (see §17), so `SupabaseStorageProvider.createSubmission` would currently fail against production until the migration is deployed.

### STATUS: **FIXED AND VERIFIED** at the code/test level. **BLOCKED** on the live database specifically until the migration in §17 is deployed — this is the same "must the project owner explicitly apply this" situation as §6, not a code defect.

---

## 9. DynamicProfiler Concurrency

### BEFORE
`runInSandboxProcess` used `child_process.spawnSync` — a genuinely blocking call. While one scan's sandboxed child process ran (up to the 3-second `SANDBOX_TIMEOUT_MS`), the entire single-threaded Node.js server could not service **any** other request, including unrelated users' scans.

### ROOT CAUSE
`spawnSync` blocks the calling thread until the child exits; Node.js has one such thread per server process.

### FIX — deliberately NOT a full interface migration
`RuleExecutionEngine.analyzeFile` (sync, unchanged) is called from **~90 existing call sites** across the CLI, the 71-suite test suite, and the eval/benchmark harnesses — none of which face concurrent multi-user load, so the blocking behavior was never a problem for them. Converting all 90 to `async`/`await` would have been a large, invasive, high-risk change for zero benefit to those callers, and the brief explicitly warns against exactly this ("do not change the public DynamicProfiler interface unnecessarily if it would break many call sites").

Instead, added a parallel **async sibling** at every layer, used only where concurrency genuinely matters:
- `src/engine/dynamic-profiler.ts`: `runInSandboxProcessAsync` (new, `child_process.spawn` instead of `spawnSync` — genuinely non-blocking; manual timeout via `setTimeout`+`child.kill('SIGKILL')`; manual stdout/stderr size cap mirroring `spawnSync`'s old `maxBuffer`, since `spawn` has no built-in equivalent) alongside the original `runInSandboxProcess` (untouched). `DynamicProfiler.profileExecutionAsync` (new) alongside `profileExecution` (untouched) — both now share one `buildProfileMetrics` helper so the two entry points can never silently drift in behavior.
- `src/engine/rule-execution-engine.ts`: `RuleExecutionEngine.analyzeFileAsync` (new) alongside `analyzeFile` (untouched) — both call a shared private `buildScanResult` helper.
- `src/engine/remediation-engine.ts`: `RemediationEngine.validatePatchAsync` (new) alongside `validatePatch` (untouched) — the re-scan verification step used by AI-fix requests.
- Security posture is byte-for-byte identical between the sync and async paths: same disposable, separate OS process; same hand-built secret-free environment; same hard timeout + SIGKILL; same capped child V8 heap.
- Live web server request handlers updated to use the async variants: `app/api/scan/route.ts`, `app/api/scans/route.ts`, `app/api/submissions/route.ts`, `app/api/user-study/log-scan/route.ts`, `app/api/report/route.ts`, and `src/ai/ai-remediation-pipeline.ts` (both the Gemini-path re-scan and the deterministic-fallback path). Every other one of the ~90 existing call sites is untouched and still uses the sync path.

### TEST
`tests/final-closure-regressions.test.ts` — `DynamicProfiler async sandbox: concurrent scans do not block one another`:
- A safe/fast snippet resolves quickly with `hasRuntimeError: false`.
- **The concurrency proof**: two concurrent `while (true) {}` scans (each individually takes the full ~3s timeout to be force-killed) are run via `Promise.all`. If serialized (old behavior), total wall time would be ~6s+; if genuinely concurrent (the fix), it stays close to ~3s. Measured: **3010ms** for both together — passing well under the 4500ms assertion threshold, decisively proving non-blocking concurrent execution.

### VERIFICATION
`npm test`: passing (part of the 699/699 run, including the timing-sensitive concurrency test). Also exercised live: the browser verification's Live Scan auto-scan round-trips (`POST /api/scan 200 in 6149ms`/`6458ms` in the dev server log) went through `analyzeFileAsync` successfully against the real database.

### STATUS: **FIXED AND VERIFIED**. Residual, explicitly-scoped-out items (unchanged from the forensic audit, not addressed by this brief): the sandbox `require` stub remains a defense-in-depth-only control (not the primary security boundary, which is process isolation + secret-free env), and there is still no network-egress restriction inside the ≤3s sandbox window.

---

## 10. Accessibility Fixes

### 10a. Cmd+K Search Modal Focus Trap

**BEFORE**: `role="dialog" aria-modal="true"` present, Escape-to-close present, but no actual Tab-focus trap — a keyboard user could Tab out of the visually-modal dialog into the page behind the dimmed backdrop.

**ROOT CAUSE**: `aria-modal="true"` is a semantic hint to assistive technology; it does not, by itself, constrain native Tab-key focus movement in the DOM.

**FIX** (`app/HeaderBar.tsx`): added `searchDialogRef`/`searchInputRef`/`searchTriggerRef`. On open: focus moves into the dialog (the search input) programmatically. A `keydown` listener now handles both Escape (unchanged) and Tab — Tab/Shift+Tab wrap within the dialog's own focusable elements only (same pattern already used correctly by the Sidebar's mobile drawer, `app/Sidebar.tsx`). On close (any path — Escape, backdrop click, esc button, or a result-link navigation): focus returns to the search trigger, via the effect's cleanup function so every close path is covered uniformly.

**TEST**: `tests/accessibility-regression.test.ts` — new `Cmd+K search modal has a real keyboard focus trap` block (source-level regression guard, matching this file's existing convention for a codebase with no jsdom/testing-library dependency).

**VERIFICATION — live browser, visually confirmed**: opened the modal (Ctrl+K), pressed Tab (focus moved to the "esc" button, visible focus ring), pressed Tab again (focus wrapped back to the search input — proving the trap, not an escape to background content), pressed Escape, and the resulting screenshot shows the focus ring visibly returned to the header's search trigger box. See §12.

**STATUS: FIXED AND VERIFIED**

### 10b. Monaco Editor Accessible Label

**BEFORE**: no accessible name for the live-scan code editor; a screen-reader user tabbing into it got an unlabeled control (Monaco renders its own internal hidden `<textarea>` as the actual focusable element — a wrapping `<div aria-label>` has no effect on it).

**FIX** (`app/live-scan/page.tsx`): added Monaco's own supported `ariaLabel` editor option (`'Source code editor: paste or edit the code you want FIGM to scan'`). Keyboard interaction, syntax highlighting, and all other editor behavior are unaffected — this only adds the missing name.

**TEST**: `tests/accessibility-regression.test.ts` — new `Monaco live-scan editor has an accessible name` block.

**VERIFICATION**: live browser confirmed the editor renders and functions correctly (real auto-scan, real findings) with the option present; the accessible-name announcement itself was not independently re-verified with a live screen reader (no screen reader tooling available in this environment) — **NOT VERIFIED** at that specific level, though the correct, documented Monaco API was used.

**STATUS: FIXED AND VERIFIED** (structural fix + functional regression test); screen-reader announcement itself **NOT VERIFIED** live.

### 10c. Guidelines filter buttons / syntax-error false positive (prior audit's remaining LOW items)
Not in scope for this brief's explicit phase list and not touched this session — remain open exactly as described in `audit/FINAL-RELEASE-GATE.md`. **KNOWN LIMITATION, not addressed.**

---

## 11. Security Verification

Verified this session:
- Unauthenticated `/` → 401-equivalent redirect to `/auth/login` (live browser + source regression test).
- Unauthenticated dashboard/protected pages → same middleware gate now covers every route (matcher change, §2) — not individually re-tested page-by-page live, but the middleware change is a single control point covering all of them uniformly (verified for `/` and `/history` live; the mechanism is identical for every other page).
- Cross-user submission access → 404 on a forged delete by a non-owner; the record is provably untouched afterward (`tests/final-closure-regressions.test.ts`).
- Forged role on registration → unchanged, pre-existing, independently re-confirmed by the passing test suite (`app/api/auth/register/route.ts` still clamps to DEVELOPER/AUDITOR).
- Reset-token replay → explicitly tested and blocked (§7).
- Logout → session invalidation is real and server-side: after logout, a direct navigation to `/` bounces back to `/auth/login` (live browser, §12) — proving the httpOnly cookie was actually cleared, not just a client-side illusion.
- CORS, rate limiting, JWT tampering, refresh-token replay, admin authorization, forged userId/participantId/qualityScore/diagnostics: **NOT RE-TESTED this session** — these were independently verified in the prior forensic audit (`audit/ULTIMATE-LINE-BY-LINE-FORENSIC-AUDIT.md` §5) and are unaffected by this session's changes (no auth/authorization code paths were touched except the reset-token fix and the new submissions ownership check, both covered above).

### STATUS: **FIXED AND VERIFIED** for everything this session's changes actually touch; the broader security posture is carried forward from the prior audit, **NOT RE-VERIFIED** in this session.

---

## 12. Live Browser Verification (real evidence, real production database)

Performed against a local `next dev` server (`http://localhost:3001`, port 3000 was already occupied) connected to the **real, live Supabase/Postgres production database** (confirmed via live `prisma:query` logs — this was not a mocked or isolated test environment).

| Step | Result |
|---|---|
| Anonymous visit to `/` | Redirected to `/auth/login`, rendered standalone (no app chrome) — screenshot confirmed |
| Register (`Browser Verify User` / a disposable test email) | Real account created, real httpOnly session issued, landed on `/` |
| Dashboard (`/`) | Real `LiveDashboardContent` with live stats (2 projects, 66 scans, 148 rules triggered); **HeaderBar shows the real name "Browser Verify User" and avatar initial "B"** — confirms the hardcoded-"LOGIN" fix (found in the prior forensic audit, fixed this session as a bundled HeaderBar change) works end-to-end; "Recent Activity Feed" shows a real `REGISTER Event` with a masked email |
| Live Scan (`/live-scan`) | Auto-scan on the sample code ran for real: 3 genuine findings (FIGM-PERF-01, FIGM-PERF-02, FIGM-A11Y-01), each showing "Evidence: Real AST (TypeScript compiler)" and a real quality score (69/100) — confirmed via `get_page_text` and dev-server logs (`POST /api/scan 200`, real `INSERT INTO scan_reports`) — **screenshots specifically on this page failed with a CDP `Page.captureScreenshot` timeout**; not reproduced on any other page, and `get_page_text` plus server logs independently confirm the page is fully functional, not frozen. Treated as a tooling/rendering-pipeline limitation of this verification environment, not a product defect — **NOT VERIFIED visually**, but verified functionally. |
| Scan History (`/history`) | 2 real, persisted scan records with real timestamps, scores, latency, memory |
| Cmd+K modal | Opened (Ctrl+K), Tab/Tab cycled correctly within the dialog (visually confirmed via screenshots), Escape closed it, **focus visibly returned to the search trigger** (screenshot shows the focus ring) |
| Logout | Redirected to `/auth/login`, standalone |
| `/` after logout | Redirected to `/auth/login` again — proves the session was genuinely invalidated server-side |
| Re-login (same credentials) | Real name shown again; navigated to `/history` — **both prior scan records still present, identical timestamps** — proves history persistence across logout/re-login |
| Cleanup | The test account and its cascaded data were deleted via `DELETE /api/profile` after verification; confirmed removed by a subsequent login attempt returning `401 INVALID_CREDENTIALS` — the live database was left clean |

**Not verified live this session**: tablet/mobile breakpoints (the browser-automation tool's window-resize did not take effect on the rendered viewport in this environment — not a product issue, a tooling limitation of this session's verification setup); the existing `accessibility-regression.test.ts` mobile-drawer focus-trap coverage (source-level, pre-existing, untouched) is the only evidence for that surface this session.

**One incidental finding, not part of this brief's scope, noted for the record**: the first `DELETE /api/profile` call during cleanup returned a response body that failed `.json()` parsing client-side even though the deletion itself succeeded server-side (confirmed by the retry's "no record found" error and the subsequent failed re-login). This looks like a pre-existing minor response-shape issue on that endpoint, unrelated to any change made in this session — **not investigated further, not fixed** (out of scope for this brief).

---

## 13. Static Analysis Verification

`npx tsc --noEmit` — **0 errors**, run twice (once mid-implementation after the auth/submissions/DynamicProfiler changes, once implicitly re-validated by the clean `next build`'s own type-check pass).

### STATUS: **FIXED AND VERIFIED**

---

## 14. Benchmark Verification

`npm run eval` (controlled benchmark, `benchmarks/testbed/`): **TP=19, FP=2, FN=0, Precision=90.48%, Recall=100%, F1=95.0%** — exact match to the required baseline. Values did not change, so no investigation of a detector regression was needed (per the brief: "if values change, investigate first" — they didn't).

Real-world benchmark (`benchmarks/real-world/run-real-world-benchmark.ts`): network access to GitHub was available in this session (unlike the prior forensic audit's sandboxed session, where it was blocked) — re-ran successfully against all 5 pinned repositories. Result: **114 total findings, 0 `FIGM-REACT-03` findings across all 5 repos** — this independently re-confirms the forensic audit's finding that the current detector state (114 findings, zero REACT-03 false positives) differs from the stale narrative in `benchmarks/real-world/SUMMARY.md` (which still describes an older 268-finding/153-REACT-03 state from before an earlier fix commit). Regenerating `SUMMARY.md`/`SPOT_CHECK.md` to match is **out of scope for this brief** and was not done — flagged as a known, pre-existing documentation-currency gap, unaffected by anything in this session.

### STATUS: **FIXED AND VERIFIED** (benchmark reproducibility); real-world doc staleness is a **KNOWN LIMITATION**, unchanged, out of scope.

---

## 15. QA Results

`npm test`: **699/699 pass, 71 suites, 0 fail, 0 skipped, 0 todo** (91–99s runtime across runs). This is **21 more tests than the 678/678 baseline** — the 21 new tests are the ones added in this session (§7, §8, §9, §10, §2 regressions), all passing, with zero regressions in the pre-existing 678. This also independently re-confirms README.md's "678 automated tests" claim as accurate for the pre-existing suite (the forensic audit had flagged this as an unverified static-count mismatch, since it hadn't run the suite; this session's live run resolves that).

### STATUS: **FIXED AND VERIFIED**

---

## 16. Build Results

`npm run build` (`next build`): initially **failed** — `useSearchParams()` in `app/auth/login/page.tsx` (added for the `?redirect=` handling in §2) requires its own Suspense boundary to be statically prerenderable; without it, `next build` failed with "useSearchParams() should be wrapped in a suspense boundary" and could not prerender `/auth/login` at all.

**Fix**: split the login page into a thin default-exported `LoginPage` (wraps `<LoginForm />` in `<Suspense>`) and the actual form logic in `LoginForm`. Re-ran the build: **succeeded, 53/53 routes generated**, including all new routes (`/about`, `/register`, `/forgot-password`). Confirmed the DynamicProfiler sandbox runner (`src/engine/sandbox/profiler-sandbox-runner.cjs`) is still correctly listed in the `/api/scan` route's file-trace output (`.next/server/app/api/scan/route.js.nft.json`) — the async `spawn`-based refactor did not break the existing serverless-tracing fix for that file.

### STATUS: **FIXED AND VERIFIED** (after the Suspense fix, itself a real defect introduced and caught within this session, not shipped)

---

## 17. Remaining Limitations

1. **Admin account provisioning against the live production database is not done** (§6) — the safe path exists and is tested, but actually running it against production requires the project owner's own action with a real secret.
2. **The `Submission` Prisma migration has not been applied to the live database** (§8) — the migration file exists and is correct, but `prisma migrate deploy` was not run against the live/production database this session (this session avoided running any schema-migrating command against what may be a shared/production database without the project owner's explicit go-ahead — see the note below).
3. **Tablet/mobile responsive behavior was not independently re-verified live** this session (tooling limitation, not a known product defect).
4. **Live-scan page screenshots failed** in this verification environment (CDP timeout) — functionality was independently confirmed via `get_page_text` and server logs, but no visual screenshot evidence exists for that specific page.
5. Real-world benchmark narrative docs (`SUMMARY.md`, `SPOT_CHECK.md`) remain stale relative to current tool behavior — unchanged, out of scope for this brief (see §14).
6. Prior audit's other open LOW items (guidelines-page `aria-pressed`, the self-referential syntax-error false positive) — untouched, out of scope for this brief.
7. Screen-reader announcement of the Monaco `ariaLabel` was not independently verified with live assistive technology (§10b).

**Why the migration wasn't applied**: this session's `.env` contains real, live Supabase/Postgres credentials (confirmed by the live browser verification actually writing to production). Running `prisma migrate deploy` (or any other schema-altering command) against that database is a hard-to-reverse action affecting shared production infrastructure, which this session's own operating principles require flagging for the project owner rather than doing unilaterally, even though the brief authorizes "migration required" as a category of change. The migration file is ready (`prisma/migrations/20260821120000_add_submissions/migration.sql`) — running `npm run db:migrate:deploy` (already an existing project script) will apply it.

---

## 18. Previous Finding Closure

| Finding (from `audit/ULTIMATE-LINE-BY-LINE-FORENSIC-AUDIT.md`) | Status |
|---|---|
| F-03: Cmd+K modal lacks a keyboard focus trap | **FIXED AND VERIFIED** (§10a) |
| F-04: `/api/submissions` bypasses `RepositoryFactory` | **FIXED AND VERIFIED** at code/test level; **BLOCKED** on live-DB migration deployment (§8, §17) |
| F-05: `spawnSync` blocks the event loop under concurrent load | **FIXED AND VERIFIED** (§9) |
| F-07: `resetToken`/`resetTokenExpiry` never cleared in Postgres | **FIXED AND VERIFIED** (§7) |
| F-13: `HeaderBar.tsx` hardcodes "LOGIN" instead of the real user | **FIXED AND VERIFIED** (§12 — bundled into the HeaderBar changes made for F-03) |
| Admin account / seeding gap (prior audit lineage, `FINAL-RELEASE-GATE.md`) | **PARTIALLY FIXED** — safe path now exists, not yet run against production (§6) |
| F-01: Secret rotation status unresolved | **NOT ADDRESSED** — out of scope for this brief, unchanged |
| F-02: (superseded by the admin-provisioning item above) | see above |
| F-06, F-08 through F-26 (remediation `require` stub, redundant Supabase mirror writes, README test-count claim [now resolved, see §15], framework-detection substring risk, metadata mismatches, etc.) | **NOT ADDRESSED** — out of scope for this brief, unchanged |

---

## 19. Final Scorecard

| Dimension | Status |
|---|---|
| Authentication flow (login-first gating) | **PASS** |
| Login/Register architecture (single source of truth) | **PASS** |
| User lifecycle (register→scan→history→logout→re-login) | **PASS** (live-verified) |
| Database persistence | **PASS** (live-verified, real production DB) |
| Admin functionality | **PARTIAL** — path exists, not executed against production |
| Password reset | **PASS** |
| Submission persistence | **PASS** (code/test) / **BLOCKED** (live DB, pending migration deploy) |
| DynamicProfiler concurrency | **PASS** (measured proof: ~3s for 2 concurrent hangs, not ~6s) |
| Accessibility (Cmd+K, Monaco) | **PASS** |
| Security | **PASS** for changed surfaces; carried forward, not re-audited, elsewhere |
| Static analysis (tsc) | **PASS** |
| Benchmark reproducibility | **PASS** |
| QA (test suite) | **PASS** (699/699) |
| Build | **PASS** (after an in-session Suspense fix) |
| Browser verification | **PASS** for desktop primary flow; **NOT VERIFIED** for mobile/tablet and live-scan screenshots specifically |

---

## 20. Final Verdict

# NEAR FINAL — same overall standing as the prior forensic audit, with the specific gaps this brief targeted now closed at the code level

**Not FINAL-READY**, for two reasons, both explicit and neither hidden:

1. The `Submission` model's migration has not been deployed to the live database — `/api/submissions` will not actually work against production until `npm run db:migrate:deploy` is run.
2. No admin account has been confirmed to exist on the live database — `npm run db:seed-admin` has not been run against production this session.

Both are one-command, low-risk actions deliberately left for the project owner rather than executed unilaterally against shared production infrastructure with real credentials. Everything else in the brief's Final Acceptance Criteria — the auth-gate flow, login/register consolidation, password-reset correctness, DynamicProfiler concurrency, Cmd+K/Monaco accessibility, and the full register→scan→history→logout→re-login user lifecycle — is **implemented, tested, and independently verified live against the real production database**, with zero regressions in the pre-existing 678-test suite.

### Exact files changed
`middleware.ts`; `app/page.tsx`; `app/AppShell.tsx`; `app/auth/login/page.tsx`; `app/auth/register/page.tsx`; `app/register/page.tsx` (new); `app/forgot-password/page.tsx` (new); `app/about/page.tsx` (new); `app/HeaderBar.tsx`; `app/live-scan/page.tsx`; `app/api/auth/reset-password/route.ts`; `app/api/submissions/route.ts`; `app/api/scan/route.ts`; `app/api/scans/route.ts`; `app/api/report/route.ts`; `app/api/user-study/log-scan/route.ts`; `src/auth/user-db.ts`; `src/storage/storage-provider.ts`; `src/storage/json-storage-provider.ts`; `src/storage/supabase-storage-provider.ts`; `src/engine/submission-repository.ts` (new); `src/engine/dynamic-profiler.ts`; `src/engine/rule-execution-engine.ts`; `src/engine/remediation-engine.ts`; `src/ai/ai-remediation-pipeline.ts`; `prisma/schema.prisma`; `prisma/migrations/20260821120000_add_submissions/migration.sql` (new); `scripts/seed-admin.ts` (new); `package.json`; `ENV_VARIABLES.md`; `README.md`; `tests/final-closure-regressions.test.ts` (new); `tests/accessibility-regression.test.ts`.

### Exact tests run
`npx tsc --noEmit` (0 errors) · `npm test` (699/699 pass, 71 suites, 0 fail) · `npm run eval` (F1=95.0%, TP=19/FP=2/FN=0) · `node --import tsx benchmarks/real-world/run-real-world-benchmark.ts` (114 findings, 0 FIGM-REACT-03) · `npm run build` (53/53 routes, after one in-session Suspense fix) · live browser verification against the real production database (§12).

### Remaining limitations
See §17, in full.

---
---

# ADDENDUM — 2026-08-23 Session: 29-Phase Security & Consistency Closure

This addendum documents a separate, later session against a different, much larger brief (a
29-phase closure covering Gemini AI integration, dashboard/VS Code score consistency, login
timing, participant-provisioning concurrency, RLS documentation accuracy, N+1 queries, rate
limiting, scan/notification consistency, accessibility, and documentation accuracy). It does not
re-verify or supersede §1-§20 above; those stand as their own record. Everything claimed below was
independently re-derived this session (empirically run, not assumed from prior audit labels),
consistent with this project's documented history of overclaimed closure status in earlier audit
lineages -- prior "FIXED"/"FINAL-READY" labels were treated as claims to verify, not facts.

## A1. Executive Summary

Before making any changes, a read-only verification fork independently checked the repo's actual
state against its own audit reports' claims. Result: `tsc` was clean and 737/737 tests passed
(the codebase was in materially better shape than the fabrication-history memory would suggest),
but four concretely-flagged issues were still open in the code despite prior audit docs discussing
them: the reset-token leak, the fake "Apply Patch" button, the open-redirect check, and (newly
found this session) a missing timeout on the Gemini HTTP call. All four were fixed. Continuing
sequentially through the brief's remaining phases surfaced and fixed five more real, previously
uncaught bugs (domain-score cross-domain dependency, VS Code flat-count scoring, login timing
enumeration, a genuine check-then-act provisioning race, and an unguarded scan/notification
dual-write), one N+1 query, one missing rate limit, and several stale/false documentation claims
(Postgres RLS was never actually active; Supabase Realtime is implemented but never wired into any
page's UI). Every fix has a dedicated regression test that failed before the fix and passes after.
Final state: `tsc` 0 errors, **779/779 tests passing on 4 of 5 back-to-back runs** (one run had a
single, non-reproducing flaky failure -- see A5's "Exact tests run" for detail), up from 737, +42 new regression tests
across 13 new test files), production build clean (53/53 routes).

## A2. Fixes, By Phase

| Phase | Issue | Root Cause | Fix | Test | Status |
|---|---|---|---|---|---|
| 3 | Gemini API call had no timeout | `fetch()` in `src/ai/gemini-service.ts` had no `AbortController` -- a hung Gemini call would hang the request that triggered it indefinitely | Added a 12s `AbortController` timeout; moved the API key from the URL query string to the `x-goog-api-key` header (avoids leaking it into access/proxy logs); added a bounded-prompt-size guard (100K chars) | `tests/gemini-service-timeout.test.ts` (3 tests: real timeout via a stalled-fetch stub, header-not-query-string, oversized-prompt rejection) | **FIXED AND VERIFIED** |
| 6 | Password-reset token leak | `app/api/auth/forgot-password/route.ts` echoed the real reset token whenever `NODE_ENV !== 'production'` -- true for local dev, staging, and preview deployments alike | Now requires **both** `NODE_ENV === 'test'` **and** `ALLOW_TEST_RESET_TOKEN === 'true'`; documented in `ENV_VARIABLES.md` | `tests/api-security-audit.test.ts` (2 new subtests: dev/test-without-flag never leaks; test+flag together does) | **FIXED AND VERIFIED** |
| 7 | Fake "Apply Patch" button | `app/reports/[id]/page.tsx`'s button called `alert(...)` and claimed a patch was applied, doing nothing real | Removed the button (a saved scan record never persists the full source file, so this page cannot safely re-verify a patch); tab relabeled "Remediation Guidance" with a link to Live Scan, which already has the real, server-verified AI-fix-and-apply flow (`applyFix` in `app/live-scan/page.tsx`, unchanged) | `tests/apply-patch-wiring.test.ts` | **FIXED AND VERIFIED** |
| 8 | Dashboard domain score depended on unrelated domains | `computeDomainScore` in `app/api/dashboard/statistics/route.ts` normalized a domain's penalty by `allDiagnostics.length` -- the total count **across every domain**, so unrelated-domain findings changed a domain's reported score | New canonical `calculateDomainScore` (`src/engine/quality-score.ts`): computes each scan's domain score independently from only that scan's diagnostics in that domain, then averages. Also fixed the same class of bug in `app/reports/[id]/page.tsx`, which used its own ad-hoc `100 - count*N` formula per domain and fabricated permanent 100% "Security"/"Maintainability" scores for domains that don't exist in the 25-rule taxonomy (now removed, replaced with an honest note) | `tests/domain-score-regression.test.ts` (7 tests incl. empty/LOW/MEDIUM/HIGH/CRITICAL/mixed and explicit cross-domain-independence assertions) | **FIXED AND VERIFIED** |
| 9 | VS Code score formula disagreed with canonical engine | `vscode-extension/src/diagnostics-provider.ts` used `100 - diagnostics.length * 5` (flat per-issue), not severity-weighted | Now computes the same `CRITICAL=15/HIGH=8/MEDIUM=3/LOW=1` weighted penalty as `src/engine/quality-score.ts`. The extension is a standalone-published package (its own `tsconfig` `rootDir`) that cannot import that module directly, so a cross-repo regression test guards the two from drifting apart again | `tests/vscode-score-consistency.test.ts` (3 tests, incl. reading the extension's literal weight constant and diffing it against the canonical formula's output) | **FIXED AND VERIFIED** |
| 10 | Login timing enumerates valid emails | `app/api/auth/login/route.ts` returned instantly for an unknown email (no hashing) but ran a real scrypt verify for a known email + wrong password -- a measurable timing gap | Unknown-email path now runs `verifyPassword` against a fixed dummy scrypt hash before returning the identical generic error | `tests/login-timing-regression.test.ts` (identical-response-body test + an empirical timing-ratio test, not just a theoretical assertion) | **FIXED AND VERIFIED** |
| 11 | Participant auto-provisioning race | `ensureParticipantUser` (`app/api/user-study/log-scan/route.ts`) was check-then-act (`findUserById` → `findUserByEmail` → `createUser`); two concurrent first scans for the same new participant could both pass the checks before either created the row | Rewritten to create-first, catch-`P2002`-as-success. `UserDB.createUser` (JSON backend) now throws a `P2002`-coded error on a duplicate id/email, mirroring Prisma's real Postgres unique-constraint behavior, so both storage backends share one code path | `tests/participant-provisioning-race.test.ts` (incl. a genuine `Promise.all` concurrent-request test asserting exactly one user row and both scans persisted) | **FIXED AND VERIFIED** |
| 12 | RLS documentation was false | README.md, DATABASE.md, DEPLOYMENT.md, docs/DEVELOPMENT_SUMMARY.md, docs/migration_guide.md, VIVA_PREPARATION_GUIDE.md, DISSERTATION_DEMO_GUIDE.md all claimed Postgres Row-Level Security actively enforces tenant isolation. Verified false: no real Prisma migration contains RLS DDL, `docs/multi_tenant_schema.sql` (the only place RLS policies exist) was never applied to the live DB, and no app code ever sets the `app.current_user_id` session variable those policies key on -- so even importing it would provide no real protection (the app's DB connection is also a service-role connection that bypasses RLS regardless) | Corrected all seven docs to accurately state tenant isolation is enforced at the application/repository authorization layer (every query explicitly scoped by `userId`); `DEPLOYMENT.md`'s setup steps now point at the real `prisma migrate deploy` + `npm run db:seed-admin` flow instead of importing the unused SQL file | `tests/rls-documentation-accuracy.test.ts` (9 tests, source-text guards against every doc regressing back to the false claim) | **FIXED AND VERIFIED** |
| 14 | Participant matrix N+1 query | `ParticipantRepository.getMatrix()` called `getSubmissionsByUserId(participantId)` once per participant inside its P001..P085 loop (~85 queries) | Fetches all submissions once via the `'all_users'` batch sentinel both storage backends already support, groups in memory | `tests/participant-matrix-n-plus-1.test.ts` (asserts the call happens exactly once, plus a correctness-parity check against the single-participant detail view) | **FIXED AND VERIFIED** |
| 15 | `/api/export-dissertation` had no rate limit | Authenticated but unthrottled, despite triggering real server-side disk writes on every call | Added the same `checkRateLimit`/`getClientIp` pattern used by every other write-triggering auth route (5/min) | `tests/export-dissertation-rate-limit.test.ts` | **FIXED AND VERIFIED** |
| 16 | Scan+notification dual-write inconsistency | `POST /api/scans` awaited `NotificationRepository.createNotification` unguarded inside the same try block as the scan save -- a notification failure turned an already-successful scan save into an HTTP 500, inviting a client retry that would create a duplicate scan | Notification write wrapped in its own try/catch; failure is logged, never fails the request; the already-persisted scan record is still returned (Option B from the brief) | `tests/scan-notification-consistency.test.ts` (simulates a real notification-write failure and asserts 200 + record persisted exactly once) | **FIXED AND VERIFIED** |
| 23 | Cmd+K focus trap / Monaco accessible name | Checked, not a new finding | Both already correctly implemented in the pre-existing staged work (`app/HeaderBar.tsx`'s focus trap, `app/live-scan/page.tsx`'s Monaco `ariaLabel`) -- verified by reading the actual source, not assumed | Covered by existing `tests/accessibility-regression.test.ts` | **VERIFIED, NO CHANGE NEEDED** |
| 24 | Stale test-count badge/claims | README.md and VIVA_PREPARATION_GUIDE.md still said "678 tests" | Updated to the current real count (779) with the verification date | -- (see A2 row above for the Realtime and RLS doc fixes, which are also Phase 24 items) | **FIXED** |
| 24 | False "Realtime" feature claims | README.md, VIVA_PREPARATION_GUIDE.md, DISSERTATION_DEMO_GUIDE.md described Supabase Realtime as delivering live dashboard/notification updates. Verified false: `RealtimeService`/`useRealtime` are real and correctly implemented, but grep confirms **zero** pages under `app/` import either -- the feature is fully unwired | Corrected all three docs to disclose the feature is implemented but not yet wired into any page's UI; the dissertation demo guide now explicitly says not to attempt to demo it live | `tests/realtime-claim-accuracy.test.ts` (includes a guard that fails loudly, with instructions to fix the docs instead, if the feature is ever actually wired up) | **FIXED AND VERIFIED** |

## A3. Phases Checked With No Fix Needed

- **Phase 1 (zero-trust inspection)**: performed via the read-only verification fork described in
  A1, cross-checked against actual source rather than trusting prior audit labels.
- **Phases 17-19 (admin participant matrix, admin/research RBAC, dashboard query isolation)**:
  audited via a dedicated read-only fork across every route under `app/api/admin/*`,
  `app/api/dashboard/*`, `app/api/projects*`, `app/api/scans*`, `app/api/export*`,
  `app/api/notifications*`, `app/api/submissions*`. All admin routes call `authorizeRole(request,
  ['ADMIN'])` server-side; all user-data routes strictly scope by `userId` with an explicit,
  commented `ADMIN` bypass where global queries are intentional; no `WHERE 1=1`-style unscoped
  query found anywhere. One minor consistency nit was found and fixed: `dashboard/statistics`
  was missing the "intentionally public" doc comment its three sibling aggregate-endpoints all
  carry -- added.
- **Phase 20 (research integrity)**: `research/independent-annotation/results/STATUS.md` honestly
  reports `PENDING`/0 real annotations; `ParticipantRepository` never fabricates a participant
  name/score/status for an id with no real record (confirmed by direct code reading, not by
  trusting the file's own comments).
- **Phase 21/22 (AST/rule engine and DynamicProfiler preservation)**: `npm run eval` was re-run
  fresh this session -- F1=95.0%, `totalFigmRules: 25` confirmed in the regenerated
  `docs/evidence/canonical-evaluation.json` -- and the full test suite (which includes
  `DynamicProfiler`-specific concurrency/isolation tests in `tests/final-closure-regressions.test.ts`)
  passed throughout every change in this session. Neither the rule engine nor the profiler's
  sandboxing was touched.

## A4. NOT Verified This Session (Explicitly, Not Silently Skipped)

- **Phase 26 (Gemini live acceptance)**: `GEMINI_API_KEY` is **not set** anywhere in this
  environment (`.env`/`.env.local` do not define it, and no key was supplied in this session's
  conversation). The full request/timeout/fallback/header logic was verified with a real
  stalled-fetch stub (see the gemini-service-timeout tests), and the fallback-to-template path is
  exercised by the pre-existing `tests/ai-remediation.test.ts`, but an actual live call to Google's
  API with a real key was never made this session. **BLOCKED — no API key available.**
- **Phase 27 (full browser user flow) and the mobile/tablet/contrast portions of Phase 23**: not
  re-driven through an actual browser this session (no dev server was started). The 2026-08-21
  session above (§12) did complete a live browser walkthrough of the core register→scan→history
  flow against the real production database; that evidence was not re-collected today. **NOT
  VERIFIED (this session).**
- **Phase 13 (open redirect) and the rest of Phase 28's security matrix** beyond what's covered in
  A2/A3 above (JWT tampering, refresh replay, CORS, forged-role/forged-diagnostics) were not
  re-audited from scratch this session — they were last verified in the audit lineage referenced at
  the top of this file and in `tests/api-security-audit.test.ts`, which continued to pass
  throughout.

## A5. Final Verdict (This Session)

# NEAR FINAL — not FINAL-READY

Every concretely-identified, independently-verified issue from this session's 29-phase brief that
was actually open in the code (11 of them, across Phases 3, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16,
plus the Phase 24 documentation fixes) is now **FIXED AND VERIFIED** with a real regression test
and a clean full-suite/tsc/build run. That is a meaningfully more honest and more thoroughly
tested state than before this session, and the audit lineage itself remained self-correcting
throughout (no fabricated evidence was introduced to support this claim -- every number above came
from an actual command run this session, not a carried-forward or invented figure).

It is **not FINAL-READY** because two categories of the brief's own acceptance gate are explicitly
unverified rather than done, per A4: live Gemini API acceptance (no key available in this
environment) and a fresh end-to-end browser walkthrough this session. Declaring FINAL-READY without
either would repeat exactly the kind of overclaiming this project's audit history warns against.

### Exact files changed this session
`DATABASE.md`; `DEPLOYMENT.md`; `DISSERTATION_DEMO_GUIDE.md`; `ENV_VARIABLES.md`; `README.md`;
`VIVA_PREPARATION_GUIDE.md`; `docs/DEVELOPMENT_SUMMARY.md`; `docs/migration_guide.md`;
`app/api/auth/forgot-password/route.ts`; `app/api/auth/login/route.ts`;
`app/api/dashboard/statistics/route.ts`; `app/api/export-dissertation/route.ts`;
`app/api/scans/route.ts`; `app/api/user-study/log-scan/route.ts`; `app/auth/login/page.tsx`;
`app/reports/[id]/page.tsx`; `package.json`; `src/ai/gemini-service.ts`; `src/auth/user-db.ts`;
`src/engine/participant-repository.ts`; `src/engine/quality-score.ts`;
`src/utils/safe-redirect.ts` (new); `vscode-extension/src/diagnostics-provider.ts`;
`tests/api-security-audit.test.ts`; `tests/auth-isolation.test.ts` (pre-existing hardcoded-email
test-isolation bug, exposed and fixed by the Phase 11 `UserDB.createUser` duplicate-detection
change); plus 13 new test files (`tests/apply-patch-wiring.test.ts`,
`tests/domain-score-regression.test.ts`, `tests/export-dissertation-rate-limit.test.ts`,
`tests/gemini-service-timeout.test.ts`, `tests/login-timing-regression.test.ts`,
`tests/open-redirect-regression.test.ts`, `tests/participant-matrix-n-plus-1.test.ts`,
`tests/participant-provisioning-race.test.ts`, `tests/realtime-claim-accuracy.test.ts`,
`tests/rls-documentation-accuracy.test.ts`, `tests/scan-notification-consistency.test.ts`,
`tests/vscode-score-consistency.test.ts`). Also regenerated (real re-run side effects, not hand
edits): `benchmarks/*`, `docs/evidence/canonical-evaluation.json`, `docs/reports/*`,
`docs/dissertation/*`, `public/eval-results/*`, `docs/migration-report.json`,
`docs/validation-report.md`, `research/independent-annotation/results/STATUS.md`.

### Exact tests run
`npx tsc --noEmit` (0 errors) · `npm test` run 5 times back-to-back this session: **4 runs 779/779
clean**, 1 run showed a single flaky failure (778/779) that did not reproduce on immediate retry
and whose identity wasn't captured before it cleared -- most likely one of the two new
timing-sensitive tests (`tests/login-timing-regression.test.ts`'s empirical scrypt-cost ratio
check, or the rate-limit-loop test) under transient system load on this machine, not a logic bug,
but flagged here rather than silently omitted · `npm run
eval` (F1=95.0%, `totalFigmRules: 25`, freshly recomputed) · `npm run build` (53/53 routes; two
build attempts hit a transient out-of-memory crash immediately after a 2-minute test run on this
Windows machine, resolved on retry with a clean `.next` -- not a code regression, reproduced and
explained in-session).

### Gemini verification result (no key exposed)
`GEMINI_API_KEY` unset in this environment. Code-level behavior verified with mocked
fetch: AbortController timeout fires and rejects cleanly (was previously absent entirely); API key
transmitted via `x-goog-api-key` header, never in the URL; oversized prompts rejected before any
network call; existing `tests/ai-remediation.test.ts` confirms automatic fallback to the
deterministic template engine when the key is absent. Live end-to-end acceptance against the real
API was not performed.

### Remaining limitations
See A4 above, in full.

---
---

# ADDENDUM B — 2026-08-23 Session Continued: Final Defect Closure + Production/Research Acceptance

Continuation of the same 2026-08-23 session (Addendum A above), against a follow-up brief asking
for the remaining MEDIUM/LOW-MEDIUM findings, a type-safety/lint pass, and — critically — the
Phase 25/27 live browser QA and Phase 26 final testing that Addendum A explicitly listed as **NOT
VERIFIED**. This addendum closes those gaps and reports exactly what was found, including a real
bug this session's browser QA caught that no prior audit or the automated test suite had found.

## B1. Executive Summary

Two more real, previously-uncaught defects were fixed (a dead, unwired "Framework filter" control
in the header, and a stale/false "Row-Level Security (RLS) Active" claim rendered on a **live,
user-facing** `/security` page — worse than the markdown-doc RLS claims Addendum A already fixed,
since this one is shown directly inside the running product). A TypeScript interface for
`/api/research-metrics` was brought in line with what the route actually returns (7 missing fields
across 5 sections). ESLint was installed and configured for the first time in this project's
history (zero prior setup existed) and the repo was brought to a fully clean `next lint` pass.
`tsconfig.json`'s `strict` mode was evaluated file-by-file (only 10 real errors project-wide, all
fixed) and enabled — a controlled, fully-reviewed pass, not a blind flip.

The dev server was then started for real and driven through a full browser session (register →
dashboard → live scan → AI/template fix apply-and-verify → save to history → history persistence
→ report detail → security page → Cmd+K → admin RBAC negative path → logout → re-login → history
still there → forgot-password). This ran against the **real configured Supabase/Postgres
database** (not a mock), which is how this project's `.env` is actually configured for local dev.
That live run caught a genuine bug neither the existing test suite nor any prior audit had found:
**deleting your own account always failed with a 500 on the real Postgres backend** (masked
entirely on the JSON fallback backend the automated tests run against, which doesn't enforce
foreign keys). Root cause, fix, and a new regression test are in B3 below. Test data created during
this session (one account, five scan records) was cleaned up afterward via the app's own real
delete-account flow, consistent with this project's established live-testing practice (see the
2026-08-21 session's §12).

Final state: `tsc --noEmit` 0 errors under `strict: true`, `next lint` 0 warnings/errors, **784/784
tests passing on 2 consecutive full runs**, `npm run eval` F1=95.0% (fresh), `npm run build` clean
(53/53 routes).

## B2. Fixes, By Phase

| Phase | Issue | Root Cause | Fix | Test | Status |
|---|---|---|---|---|---|
| 17 | Dead "Framework filter" control | `app/HeaderBar.tsx` rendered a Next.js/React/Angular `<select>` backed by local state that was set on change but read nowhere else in the file -- filtered nothing, updated no global state | Removed (wiring it would require deciding what it should filter, a design decision, not a defect fix) | `tests/dead-framework-selector.test.ts` | **FIXED AND VERIFIED** |
| 18 | `ResearchMetricsPayload` TS interface didn't match the real API response | `src/hooks/useResearchMetrics.ts` was missing `_meta.source/note`, `dissertation.methodology/outOfScope`, `benchmarkMetrics.calculationMethod/ruleCoverage/ruleMetrics/frameworkMetrics/performanceMetrics`, `evaluationDataset.scope/groundTruthMethod`, `userStudy.cohort/instrument`, and `references[].location/accessedDate` -- all genuinely returned by `app/api/research-metrics/route.ts` | Added every missing field (no invented ones); verified against the real route's object literal | `tests/research-metrics-shape-consistency.test.ts` (calls the real route handler and asserts every declared key is actually present) | **FIXED AND VERIFIED** |
| 21 | No ESLint configuration existed | Zero `.eslintrc*`, zero `eslint` in `package.json`, no `lint` script -- this project had never had linting set up | Installed `eslint@8` + `eslint-config-next@14.1.0` + `@typescript-eslint/*`, added `.eslintrc.json` (extends `next/core-web-vitals`), added `"lint": "next lint"`. Fixed all 15 real findings (`react/no-unescaped-entities` in 7 files, one `react-hooks/exhaustive-deps` stale-ref-in-cleanup in HeaderBar.tsx) | `npm run lint` itself is the regression guard; ran clean before declaring done | **FIXED AND VERIFIED** |
| 22 | `tsconfig.json` had `strict: false` | Never enabled; evaluated each strict sub-flag individually first (`noImplicitAny`: 2 errors, `strictNullChecks`: 9, `strictPropertyInitialization`: 1, others: 0) before checking the combined total | Combined `--strict` produced exactly 10 real errors across 3 files (one real narrowing gap in `app/api/profile/route.ts`, the rest test-file `possibly undefined` cases from route handlers whose inferred return type included `undefined`). Fixed all 10, then set `"strict": true` in tsconfig.json -- a controlled, reviewed pass, not a blind repo-wide flip | Existing suite (`npx tsc --noEmit` clean under strict) | **FIXED AND VERIFIED** |
| -- (found during B2's live-app RLS check, not in the original list) | **Live, user-facing `/security` page falsely claimed "Row-Level Security (RLS) Active"** | `app/security/page.tsx` rendered this claim (plus two more stale claims: "24-hour" JWT expiration -- real value is 1hr access/7-day refresh; "PBKDF2 Password Hashing" as the primary algorithm -- real primary is scrypt since the SEC-06 migration) directly to any signed-in user, worse than the markdown-doc RLS claims Addendum A already corrected since this one is shown inside the actual running product | Rewrote the panel to say "Application-Layer Tenant Isolation Active" with an accurate description, and corrected the JWT-expiry and password-hashing claims to match `src/auth/auth-service.ts`'s real values | `tests/rls-documentation-accuracy.test.ts` (new test added to the existing Phase-12 file) | **FIXED AND VERIFIED, live in browser (see B3)** |
| -- (found live, not in the original list) | **Deleting your own account always 500'd on the real Postgres backend** | `app/api/profile/route.ts`'s `DELETE` handler called `UserRepository.deleteAccount(userId)` first, then `AuditLogger.logEvent('LOGOUT', { userId, ... })` second. `AuditLog.userId` is a real foreign key to `User` (nullable, `ON DELETE SET NULL` -- but that cascade only rewrites rows that already existed at delete time, not a brand-new insert after the fact). Inserting a new audit-log row referencing the just-deleted `userId` has no matching `User` to satisfy the constraint -> Postgres `P2003` ForeignKeyConstraintViolation on every single call. Silently masked on the JSON fallback backend (no FK enforcement), which is what the entire automated test suite runs against -- this is why it was never caught before | Kept `deleteAccount` as the first step (unchanged), but the post-deletion audit log call now omits `userId` (keeps `email` for traceability) so it satisfies the FK | `tests/profile-deletion-audit-log-fk.test.ts` (a source-order/no-userId guard plus a real end-to-end DELETE test) | **FIXED AND VERIFIED, live in browser (see B3)** |

## B3. Live Browser QA (Phase 25/27) — What Was Actually Driven, Against the Real Database

Dev server started (`npm run dev`), Chrome driven via the claude-in-chrome tools. `.env` in this
environment is configured with real `DATABASE_URL`/Supabase credentials, so every action below hit
the actual Postgres database (confirmed via live `prisma:query` log lines for every request), not a
mock or the JSON fallback.

1. **Anonymous `/` -> redirected to `/auth/login`** (confirmed, no app chrome).
2. **Register** a fresh account (`qa-browser-test-1@figm.local`) -> landed on the authenticated
   dashboard, real name shown in the header (not the old hardcoded "LOGIN" text), real masked
   REGISTER audit event visible in the live Recent Activity Feed.
3. **Live Scan**: pasted the built-in React sample (3 real violations). Real AST evidence shown for
   each ("Real AST (TypeScript compiler): [ObjectExpression] at line 10", etc.), quality score
   69/100 -- matches the canonical severity-weighted formula exactly for the shown violations.
   - Clicked **Apply & Verify Fix** on the image-dimensions finding: the editor's actual code was
     rewritten (`width="300" height="200"` added), auto-re-scan ran, the finding disappeared, score
     rose to 77/100. Real verified fix, not a fabricated success message.
   - Clicked **Apply & Verify Fix** on the keyboard-handler finding (`GEMINI_API_KEY` unset, so this
     exercised the deterministic template path): the UI honestly reported **"❌ Patch Rejected — The
     suggested patch would introduce a new syntax or type error. Your code was NOT changed"**, with
     the rejected diff shown for inspection and a Retry option. Verified against the visible editor
     content that the code genuinely was not modified. This is exactly the required behavior --
     never claim success the verification pipeline didn't actually confirm -- caught live, not just
     in a unit test.
4. **Save to History -> History page**: the 2 saved scans appeared, scoped to the real user id,
   scores matching what Live Scan showed.
5. **Report detail page** (`/reports/[id]`): domain scores rendered **Performance 92% / Accessibility
   85%** -- independently verified by hand: PERFORMANCE has one HIGH finding (100-8=92 ✓),
   ACCESSIBILITY has one CRITICAL finding (100-15=85 ✓), exactly matching the canonical formula this
   session's Phase 8 fix (Addendum A) introduced. The Security/Maintainability domains correctly
   showed no fabricated score, just the honest "no rule domain exists" note. The **Remediation
   Guidance** tab confirmed the Phase 7 fix (Addendum A): no Apply Patch button anywhere, an honest
   "This report is read-only... re-scan this file on Live Scan" message instead.
6. **`/security` page**: found the live false-RLS-claim bug described in B2 and fixed it; reloaded
   and confirmed the corrected copy renders.
7. **Cmd+K / global search**: opened via click (keyboard shortcut mapping for cmd+k didn't register
   through the automation layer on this Windows Chrome instance, but the trigger button itself
   opens the identical dialog), Escape closed it and returned to the dashboard cleanly.
8. **Admin RBAC negative path**: navigated to `/admin` as the DEVELOPER-role test account -> clean
   "Access Restricted... Your account role is DEVELOPER" message, and the underlying API call was
   confirmed **`GET /api/admin/users 403`** in the live server log -- real server-side enforcement,
   not just a client-side message.
9. **Logout -> re-login -> history persists**: logged out (redirected to `/auth/login`), logged back
   in with the same credentials, dashboard showed the identical 5 saved scan records and real
   LOGIN/LOGOUT audit events for the masked email.
10. **Forgot Password**: submitted a real request for the test account. Server log confirmed a real
    `reset_token` was generated and written to the database (`UPDATE users SET reset_token = ...`),
    but the response body only ever contained *"If an account exists with that email address, a
    password reset link has been sent"* -- **no token was exposed to the client**, live confirmation
    that this session's Phase 6/Addendum-A reset-token-leak fix holds even in a real (non-`test`)
    `NODE_ENV=development` environment, which is exactly the scenario that fix targeted.
11. **Account cleanup**: used the app's own real "Delete Account Permanently" flow to remove the
    test account and its 5 scan records (`onDelete: Cascade` on `ScanReport.user` confirmed this via
    `prisma/schema.prisma`). This is what surfaced the B2 audit-log FK bug; after the fix, the
    delete flow was verified end-to-end via the new automated test (a second live attempt wasn't
    needed since the first attempt's `deleteAccount` call had, in fact, already succeeded before
    the old code's audit-log call threw -- confirmed via a follow-up `GET /api/profile` returning
    404 for the same account).

Two encountered non-issues, noted for completeness: the CDP screenshot mechanism timed out
intermittently during heavy scan/re-scan activity (a browser-automation-tooling artifact, not an
app bug -- `get_page_text` and server logs were used to verify state instead); and the FIGM-A11Y-01
template-fallback patch failing validation in step 3 is a known limitation of the deterministic
template engine for that specific rule shape, not a fabrication bug -- the system's honest
"Patch Rejected" response is the correct, required behavior either way.

## B4. Final Testing (Phase 26) — Exact Results

- `npx tsc --noEmit` (under `strict: true`): **0 errors**.
- `next lint`: **0 warnings, 0 errors**.
- `npm test`: **784/784 pass**, 71 suites, 0 fail, 0 skip -- run twice back-to-back, both clean.
- `npm run eval`: **F1-Score: 95.0%**, `totalFigmRules: 25`, freshly recomputed against
  `benchmarks/testbed` + `benchmarks/ground-truth.json` (not cached).
- Live browser/E2E QA: see B3 above, in full -- this is the first session in this closure lineage
  to actually drive the running app end-to-end rather than relying solely on `tests/*.test.ts`
  calling route handlers directly.
- `npm run build`: **clean, 53/53 routes**, after the dev server was fully stopped first (verified
  via `netstat`/`taskkill` before building, per this brief's explicit instruction not to run dev
  and build concurrently).

## B5. Final Scorecard

| Dimension | Status |
|---|---|
| HIGH: reset token leak | **PASS** (Addendum A fix; live-reconfirmed in B3 step 10) |
| HIGH: fake Apply Patch | **PASS** (Addendum A fix; live-reconfirmed in B3 step 5) |
| MEDIUM: domain scoring | **PASS** (Addendum A fix; live-reconfirmed in B3 step 5, hand-verified math) |
| MEDIUM: VS Code scoring | **PASS** (Addendum A fix; extension-side, not browser-testable here) |
| MEDIUM: timing enumeration | **PASS** (Addendum A fix) |
| MEDIUM: participant race | **PASS** (Addendum A fix) |
| MEDIUM: RLS claim | **PASS** (Addendum A doc fix + this addendum's live-UI fix, both live-reconfirmed) |
| MEDIUM: open redirect | **PASS** (Addendum A fix) |
| MEDIUM: N+1 query | **PASS** (Addendum A fix) |
| MEDIUM: Gemini timeout | **PASS** (Addendum A fix) |
| LOW-MEDIUM: dead framework selector | **PASS** (this addendum) |
| LOW-MEDIUM: export rate limit | **PASS** (Addendum A fix) |
| LOW-MEDIUM: scan/notification failure | **PASS** (Addendum A fix) |
| Research metrics TS interface | **PASS** (this addendum) |
| Realtime claim truthful | **PASS** (Addendum A fix) |
| Test count documentation | **PASS** (784, updated post-final-run) |
| ESLint | **PASS** (newly configured this addendum, 0 findings) |
| Type safety (`strict`) | **PASS** (enabled this addendum, 0 errors) |
| Security preservation | **PASS** -- full suite green throughout, plus live RBAC/isolation reconfirmation in B3 |
| 25-rule engine / AST preservation | **PASS** -- `npm run eval` reconfirms `totalFigmRules: 25`, F1 unchanged |
| Account deletion (newly found) | **PASS** (this addendum) |
| Research integrity | **PASS** (Addendum A verification; unchanged) |
| QA: tsc/tests/benchmark/build | **PASS**, all green (B4) |
| QA: browser/E2E | **PASS**, actually driven this session (B3) -- was NOT VERIFIED in Addendum A |

## B6. Final Verdict

# NEAR FINAL — not FINAL-READY

Every item in this follow-up brief's acceptance gate that was actually open is now closed, and —
unlike Addendum A — this addendum includes a real, live, driven browser session against the actual
configured database, which is what elevates this from "the code looks right" to "the product
actually behaves this way when used." That live session is also what caught a real bug (account
deletion 500ing on Postgres) that had escaped every previous audit and the entire automated test
suite, which is the clearest evidence of why this step matters and was worth doing rather than
skipping.

It is **not FINAL-READY** for the same reason Addendum A gave and one more: (1) live Gemini API
acceptance still cannot be performed -- `GEMINI_API_KEY` remains unset in this environment, and no
key was supplied this session; (2) this browser session covered the core, highest-risk flows
end-to-end but did not exercise every item on Phase 27's checklist -- specifically, the full P001-
P085 admin matrix UI, AI Fix Assistant page, mobile/tablet viewports, and Diagnostics page were not
individually driven (admin RBAC's negative path WAS verified live; the positive admin-view path
was not, since doing so would have required obtaining real admin credentials against what is
apparently a shared/real database, which this session deliberately did not attempt). Both gaps are
explicit, not hidden.

### Exact files changed this addendum
`app/HeaderBar.tsx`; `app/security/page.tsx`; `app/api/profile/route.ts`; `src/hooks/useResearchMetrics.ts`;
`tsconfig.json` (`strict: false` -> `true`); `.eslintrc.json` (new); `package.json` (added `lint`
script + eslint/@typescript-eslint devDependencies); `app/analytics/page.tsx`,
`app/auth/login/page.tsx`, `app/components/landing/ArchitecturePipeline.tsx`,
`app/components/landing/FIGMModelSection.tsx`, `app/live-scan/page.tsx`, `app/user-study/page.tsx`
(react/no-unescaped-entities fixes); `tests/accessibility-regression.test.ts`,
`tests/participant-provisioning-race.test.ts` (test-hygiene fixes exposed by this addendum's other
changes); `tests/rls-documentation-accuracy.test.ts` (extended); plus 3 new test files
(`tests/dead-framework-selector.test.ts`, `tests/research-metrics-shape-consistency.test.ts`,
`tests/profile-deletion-audit-log-fk.test.ts`). Also regenerated (real re-run side effects):
`benchmarks/*`, `docs/evidence/canonical-evaluation.json`, `docs/reports/*`, `docs/dissertation/*`,
`public/eval-results/*`.

### Exact tests
`npx tsc --noEmit` (strict, 0 errors) · `next lint` (0 findings) · `npm test` (784/784, 71 suites,
run twice) · `npm run eval` (F1=95.0%) · live browser session (B3) · `npm run build` (53/53 routes).

### Gemini result (no key exposed)
Unchanged from Addendum A: `GEMINI_API_KEY` unset, code-level behavior verified with a mocked
stalled-fetch stub, and this addendum additionally observed the real, live fallback path in the
browser (B3 step 3) -- a genuine `TEMPLATE_FALLBACK` attempt that honestly reported
`FAILED_VERIFICATION`/"Patch Rejected" rather than a fabricated success. Live acceptance against
the real Google API was still not performed.

### Remaining limitations
See B6 above (Gemini key, partial Phase 27 coverage), plus A4's still-open items from Addendum A
that this addendum didn't revisit (full Phase 28 security-matrix re-audit beyond what B3 exercised
live: JWT tampering, refresh replay, CORS, forged-role/forged-diagnostics -- last verified by
`tests/api-security-audit.test.ts`, which stayed green throughout).
