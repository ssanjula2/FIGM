# FIGM — Admin + P001–P085 Participant Research Dashboard + Security Closure Report

**Date:** 2026-08-21. Implements the "Admin + Participant Research Dashboard + Security Closure" brief (received in two parts; the second cut off mid-Phase-10 — proceeded on Phases 1–10 as received, per the non-negotiable rules' own explicit guidance on the unsafe-fallback-pattern anti-pattern).

**Note on scope**: the brief truncated before any Phase 11+ or a final acceptance-criteria section could be sent. Everything below covers Phases 1–10 in full. If further phases exist, they were never received.

---

## Phase 1 — Zero-Trust Current State Review

Read (not assumed) before changing anything: `app/admin/**`, `app/api/admin/**`, `src/auth/auth-middleware.ts`, `prisma/schema.prisma`, `src/engine/{user,scan,dashboard}-repository.ts`, `app/api/dashboard/**`, `app/api/research-metrics/route.ts`, `app/api/user-study/log-scan/route.ts`, `app/user-study/page.tsx`.

**Findings, reported before fixing anything (per the brief's own instruction):**

1. **`/api/admin/users` and `/api/admin/system` were already correctly `authorizeRole(['ADMIN'])`-gated.** No RBAC weakening was needed there — only test coverage was missing.
2. **`app/admin/page.tsx` had a real bug**: `fetchAdminData` did `usersRes.ok ? await usersRes.json() : { users: [] }` — a non-2xx response (401/403) was silently swallowed into an empty-data state, never surfacing the existing "Access Restricted" UI branch. A DEVELOPER visiting `/admin` saw a blank dashboard, not a clear denial. Fixed as part of the Phase 6 rewrite (§ below).
3. **`/api/scans` and `/api/dashboard/reports` were already using the CORRECT explicit-role pattern** (`auth.user.role === 'ADMIN' ? undefined : auth.user.userId`) — this is the safe pattern the brief's Phase 10 asks for, not the unsafe `userId ? {userId} : {}` fallback the brief warns against. No fix needed there; confirmed by direct source reading, not assumed from any prior document.
4. **Research-study participants (P001–P085) are real Prisma `User` rows already**, created idempotently by `app/api/user-study/log-scan/route.ts`'s `ensureParticipantUser` (synthetic id `"P001"`, email `p001@user-study.figm.local`, role `DEVELOPER`) the moment a real scan is logged for them. This is the single real data source the P001–P085 matrix is built from — there is no separate "participant" table or any other place fake participant data could leak in from.
5. **No admin-facing participant matrix, participant detail page, global filterable scan history, or rule-frequency analytics existed at all.** These are net-new (Phases 6–9 below).
6. **`ScanRepository.getScanRecords`/`queryScanRecords` already supported an optional `userId` filter with full server-side WHERE/ORDER BY/LIMIT/OFFSET pushdown, clamped page size, and no-fabrication guarantees** — reused directly for the new global admin scan history rather than reimplemented.

---

## Phase 2 — Admin Role and Access Control

**RBAC matrix, tested against every new/existing `/api/admin/*` route (`tests/admin-research-dashboard.test.ts`):**

| Caller | `/api/admin/participants` | `/api/admin/participants/[id]` | `/api/admin/scans` | `/api/admin/rule-stats` | `/api/admin/users` | `/api/admin/system` |
|---|---|---|---|---|---|---|
| Anonymous | 401 | 401 | 401 | 401 | 401 (pre-existing) | 401 (pre-existing) |
| DEVELOPER | 403 | 403 | 403 | 403 | 403 (pre-existing) | 403 (pre-existing) |
| AUDITOR | 403 | 403 | 403 | 403 | 403 (pre-existing) | 403 (pre-existing) |
| ADMIN | 200 | 200 | 200 | 200 | 200 (pre-existing) | 200 (pre-existing) |

AUDITOR receives 403, not read-only access — the existing design has no read-only-admin capability implemented anywhere in the codebase, so per the brief's own conditional ("AUDITOR may have read-only capabilities only if the existing design explicitly supports them") none was added.

**Live-verified** (not just unit-tested): registered a real DEVELOPER account, navigated to `/admin`, got a clear "Access Restricted — This area requires an ADMIN role account. Your account role is DEVELOPER." message — not a blank dashboard, not a silent failure. See §12 of the companion product-closure work for the equivalent ADMIN-success walkthrough (real ADMIN login → full dashboard render).

**No existing RBAC implementation was weakened.** `authorizeRole`/`authenticateUser` in `src/auth/auth-middleware.ts` were not modified.

### STATUS: FIXED AND VERIFIED

---

## Phase 3 / Phase 6 — Admin Dashboard

`app/admin/page.tsx` rewritten as a 9-tab dashboard: Overview, Users, Participants, Scan History, Research Metrics, Framework Analytics, Rule Analytics, Audit Logs, System Health. Every tab is backed by a real API call (four brand-new: `/api/admin/participants`, `/api/admin/participants/[id]`, `/api/admin/scans`, `/api/admin/rule-stats`; five pre-existing: `/api/admin/users`, `/api/admin/system`, `/api/research-metrics`, `/api/dashboard/frameworks`). No hardcoded counts anywhere — every stat tile reads from a live fetch; an empty dataset renders a real zero/empty state (confirmed live: a fresh local database showed "Total Scans Recorded: 0", not a placeholder number).

### STATUS: FIXED AND VERIFIED

---

## Phase 4 / Phase 7 — P001–P085 Participant Matrix (No Fabrication)

`src/engine/participant-repository.ts` (new): `ParticipantRepository.getMatrix()` always returns exactly 85 rows (`P001`..`P085`). For each id, it looks up a real `User` row (matching the exact synthetic-id pattern `/^P\d{3,6}$/` or the `@user-study.figm.local` email domain `ensureParticipantUser` uses) and real `ScanReport`/`Submission` rows. **An id with no matching `User` row gets every field set to `null`/`0`/`[]` and status `NOT_REGISTERED` — never a fabricated name, email, scan count, score, or framework.**

Status values used are limited to what can be honestly derived from real data: `NOT_REGISTERED`, `REGISTERED` (account exists, 0 scans/submissions), `SCANNED` (≥1 real scan), `SUBMITTED` (≥1 real `Submission` row). `ACTIVE`/`COMPLETED` were deliberately **not** implemented — this codebase has no real signal (session-based "active," or a research-completion flag) that would make those statuses honest rather than invented.

**Live-verified, screenshot-confirmed**: logged one real scan for `P001` via the actual `/api/user-study/log-scan` endpoint (the same production code path a real participant's browser would hit). The Participants tab showed `P001 — SCANNED, 1 scan, React, score 85, 1 finding, real timestamp`, while `P002`–`P006` (untouched) all showed `Not Recorded` / `—` / `No Submission` — the exact wording the brief specifies for missing records.

### TEST
`tests/admin-research-dashboard.test.ts`: `Participant matrix never fabricates data for an unregistered id` (asserts every `NOT_REGISTERED` row's fields are null/zero/empty) and `A real participant scan is reflected accurately end-to-end` (logs a real scan, asserts the delta is reflected exactly, not more, not less).

### STATUS: FIXED AND VERIFIED

---

## Phase 5 / Phase 9 — Admin Participant Table & Global Scan History

Participant table columns implemented: Participant ID (clickable when a real record exists), Status, Total Scans, Frameworks Used, Latest Quality Score, Total Findings, Last Activity. Search by participant ID is server-side (`?search=`).

Global scan history (`app/api/admin/scans/route.ts`, new): wraps the existing `ScanRepository.getScanRecords` (already server-side filtered/paginated/clamped) with an explicit `ADMIN`-only gate, a participant/owner filter, framework filter, severity filter, free-text search, date range, and pagination. Each record is enriched with the real owner's `fullName`/`email`/`role` (never exposing password hash, refresh token, or raw API key — only the fields already safe to display elsewhere in the admin UI).

**Privacy/security constraints honored**: no password, refresh token, or raw API key is returned by any new endpoint. `/api/admin/users` (pre-existing, untouched) already masks API keys to their last 4 characters.

### TEST
`tests/admin-research-dashboard.test.ts`: `Global admin scan history: explicit participant filter is correctly scoped` — creates two real scans under two different owners, filters by one, asserts the other owner's record never appears and the returned record is enriched with the correct real owner identity.

### STATUS: FIXED AND VERIFIED

---

## Phase 8 — Participant Detail Page

`/admin/participants/[participantId]` (new, ADMIN-only client page backed by the ADMIN-gated API route). Renders exactly the six sections requested: Profile, Scan Summary, Framework Usage, Rule Findings, Scan History, Research Study. The Research Study section is **always** rendered as an honest "no independently-collected research record exists for this participant id" — this codebase has no consent/questionnaire/task-response storage keyed by participant id, so inventing a status here was explicitly avoided rather than worked around.

**Live-verified, full page-text captured**: `P001`'s detail page showed real profile dates, a real scan summary (1 total/1 successful/0 failed/avg score 85), real framework usage (React, 1 scan), a real rule-findings row (`FIGM-PERF-03 CRITICAL 1` — correctly matching the actual violation in the test fixture code), and the real scan history entry.

### STATUS: FIXED AND VERIFIED

---

## Phase 10 — Dashboard Query Security Audit

Audited every route the brief listed, by reading current source (not trusting any prior document):

| Route | Scoping found | Verdict |
|---|---|---|
| `/api/dashboard/reports` | `auth.user.role === 'ADMIN' ? undefined : auth.user.userId` (explicit role gate before global) | Already correct |
| `/api/dashboard/summary` | Public by design, aggregate-only, no per-user data; role never defaults to ADMIN for an anonymous caller | Already correct |
| `/api/dashboard/activity` | Public by design, emails masked (`maskEmail`) | Already correct |
| `/api/projects` | Not modified this session; scoped per the existing route matrix from the prior forensic audit | Not re-verified this session |
| `/api/scans` | `auth.user.role === 'ADMIN' ? undefined : auth.user.userId` (explicit role gate) | Already correct |
| `/api/export` | Not modified this session | Not re-verified this session |
| `/api/submissions` | Self-only (no admin-global mode exists) | Unchanged; brief did not require adding one |
| `/api/notifications` | Not modified this session | Not re-verified this session |
| `/api/admin/users` | `authorizeRole(['ADMIN'])` | Already correct |
| `/api/admin/system` | `authorizeRole(['ADMIN'])` | Already correct |
| `/api/research-metrics` | Public, no per-user data (benchmark/dissertation metadata only) | Already correct |
| `/api/admin/participants`, `/api/admin/participants/[id]`, `/api/admin/scans`, `/api/admin/rule-stats` (new) | `authorizeRole(['ADMIN'])`, explicit `userId`-as-filter (never an implicit global fallback) | Built correct |

**No route in this codebase was found using the unsafe `where: userId ? { userId } : {}` pattern.** The existing codebase already uses the safe, explicit-role-check pattern everywhere admin-global access exists. Every new route added this session follows the same pattern.

### STATUS: FIXED AND VERIFIED (for everything read/built this session); `/api/projects`, `/api/export`, `/api/notifications` were not re-read this session — carried forward from the prior forensic audit's finding of "no IDOR across 30 routes," not re-verified fresh here.

---

## QA / Build Results

- `npx tsc --noEmit`: **0 errors**.
- `npm test`: **722/722 pass, 71 suites, 0 fail** (up from the 699/699 baseline at the start of this ticket — 23 new tests in `tests/admin-research-dashboard.test.ts`, zero regressions).
- `npm run build`: **clean, all routes generated**, including the two new pages (`/admin` 5.94kB, `/admin/participants/[participantId]` dynamic) and four new API routes.
- Live browser verification (local JSON backend, to avoid further writes to the live production database used in the prior ticket's verification pass): real ADMIN login → full 9-tab dashboard render with real data → real participant scan logged → Participants tab and detail page both reflect it exactly, with untouched ids honestly showing "Not Recorded" → real DEVELOPER registration → `/admin` correctly blocked with a clear message. All dev server processes and the temporary local test database were cleaned up afterward; nothing was left running.

## Exact files changed
`app/admin/page.tsx` (rewrite); `app/admin/participants/[participantId]/page.tsx` (new); `app/api/admin/participants/route.ts` (new); `app/api/admin/participants/[participantId]/route.ts` (new); `app/api/admin/scans/route.ts` (new); `app/api/admin/rule-stats/route.ts` (new); `src/engine/participant-repository.ts` (new); `src/engine/rule-analytics-repository.ts` (new); `package.json`; `tests/admin-research-dashboard.test.ts` (new).

## Remaining limitations / not verified this session
- `/api/projects`, `/api/export`, `/api/notifications` were not re-read this session (Phase 10 covered the routes most directly relevant to the new admin surface plus the explicitly-listed dashboard routes; a full re-read of every route in the brief's list was not completed within this session's scope).
- Whatever Phases 11+ (and any final acceptance criteria) the brief intended were never received due to truncation.
- This work was verified against a local JSON-backed database, not the live production Supabase database (a deliberate choice to avoid further live-production writes after the prior ticket's verification pass) — the new `/api/admin/*` routes have not been live-tested against production Postgres specifically, though they use the same `RepositoryFactory`/provider abstraction every other already-production-verified route uses.

---

# ADDENDUM — 2026-08-24: Full Current-State Reconciliation

**Role:** Independent External Examiner + Principal Software Architect + Security Engineer + QA Engineer + Research Methodologist + Static Analysis Engineer + Accessibility Engineer + Database Architect + DevOps Engineer.

**Scope of this update:** reconcile this report against the CURRENT repository (not against what any prior audit — including the Phases 1–10 above, `audit/new.md`, `audit/new-02.md`, `audit/ULTIMATE-LINE-BY-LINE-FORENSIC-AUDIT.md`, `audit/STRICT-FULL-PROJECT-AUDIT-REPORT.md`, `audit/SECURITY-CLOSURE-VERIFICATION-REPORT.md`, or `audit/FINAL-PRODUCT-CLOSURE-REPORT.md` (incl. its two addenda) — claimed), incorporate the role-separated User/Admin workspace and profile work completed immediately before this update, and produce one current-state verdict. Every status below was independently re-derived this session by reading source, running commands, or driving a real browser — not copied from a prior document's label. Read-only investigation was used for everything except the User/Admin workspace implementation itself, which was built and verified in the session immediately preceding this one — files touched by that earlier turn: `app/api/profile/route.ts`, `app/auth/login/page.tsx`, `app/auth/register/page.tsx`, `app/AppShell.tsx`, `app/Sidebar.tsx`, `app/HeaderBar.tsx`, `app/AdminSidebar.tsx` (new), `app/admin/layout.tsx` (new), `app/admin/profile/layout.tsx` (new), `app/admin/participants/layout.tsx` (new), `app/admin/profile/page.tsx` (new), `app/admin/page.tsx`.

**This is a genuinely large repository with a long audit lineage.** This update does not re-derive every one of the ~46 findings (F-01…F-26 from the forensic audit, plus AUDIT-* IDs from the strict audit, plus the Addendum A/B fixes) from first principles — where a finding was already closed with a dedicated regression test that is still passing today, that is treated as strong (not absolute) evidence of continued closure, and is labelled accordingly. Where this session specifically re-read the relevant source or re-ran a live check, that is called out explicitly.

---

## Update §1 — Current Repository State

- **Branch:** `main`. **HEAD:** `85d461a49d9ed4a984dd0c2421ee9ddd91421d50` (unchanged by this update at the time of writing — all work described below is in the working tree, not yet committed).
- **Working tree:** 115 files with uncommitted changes (`git status --short | wc -l`, re-run at the time of writing this section) — this is the accumulated output of at least three prior sessions (the Aug 21 admin-dashboard work above, the Aug 23 Addendum A/B 29-phase closure, and the User/Admin workspace-separation session immediately before this update) plus this update's own report edits. None of it has been committed or pushed.
- **Test count:** 784 tests, 71 suites, **784 pass, 0 fail** — `npm test`, run fresh today. (Counts change release-to-release; re-run `npm test` for the current number rather than trusting this figure indefinitely.)
- **TypeScript:** `npx tsc --noEmit` (project now builds under `tsconfig.json`'s `strict: true`, enabled in Addendum B) — **0 errors**, run fresh today.
- **Build:** `npm run build` — **clean**, 68 routes generated (32 page routes + 36 API routes; exact list in Update §"QA / Build / Benchmark Results" below), run fresh today with `.next` cleared first and no dev server running concurrently.
- **Route count:** 68 (see above). This supersedes the "53/53" figure in `FINAL-PRODUCT-CLOSURE-REPORT.md` — the difference is the admin-participants/rule-stats/scans API routes and `/admin/participants/[participantId]` (already present before this update) plus `/admin/profile` and its two new layout guards (new this update; layouts aren't separately counted as routes).
- **Rule count:** 25 (`TOTAL_RULE_COUNT`, `src/matrix/rule-registry.ts`, confirmed live via a direct script: `FOUR_LAYER_MAPPINGS.length === 25`).
- **Prisma models:** 13 (`User`, `Project`, `ScanReport`, `Notification`, `AuditLog`, `Settings`, `ApiKey`, `SavedReport`, `ResearchEvaluation`, `FrameworkBenchmark`, `AiHistory`, `Submission`, `ExportHistory`).
- **Migrations:** 2 (`20260818075914_init_baseline`, `20260821120000_add_submissions`). **Both confirmed deployed to the live database** — `npx prisma migrate status` against the real `DATABASE_URL` reports *"Database schema is up to date!"*, run fresh today (read-only status check, no schema-altering command was run).
- **Storage provider (production):** Supabase/Postgres — confirmed live: a read-only query against the real database today returned **10 real users** (8 `DEVELOPER`, 2 `ADMIN`, 0 `AUDITOR`), **95 real scan reports**, **205 real audit-log entries**, **0 submissions** (the `Submission` table exists and is queryable — schema-verified live — but has never been written to in production yet).
- **Role architecture:** `ADMIN` / `DEVELOPER` / `AUDITOR` (`UserRole` enum, `prisma/schema.prisma`), unchanged from the original brief's canonical model — no duplicate or parallel role system exists anywhere in the codebase.

---

## Update §2 — User Workspace

Implemented this update (previously a single undifferentiated Sidebar/HeaderBar shared by every role).

| Item | Implementation | Access Control | Verification | Status |
|---|---|---|---|---|
| Anonymous → `/auth/login` | `middleware.ts`'s negative-matcher auth gate (unchanged, pre-existing) | Every route except the public allow-list requires a session cookie | Live-verified this update (unauthenticated → login) | **FIXED AND VERIFIED** |
| `DEVELOPER` → `/` after login | `app/auth/login/page.tsx`: role-based default (`ADMIN`/`AUDITOR` → `/admin`, else `/`) when no safe `redirect` param is present | Client-side redirect target only; the actual page-level protection is `middleware.ts` + (for `/admin`) the new server-side layout guard | Live-verified this update: registered a `DEVELOPER` account, landed on `/` | **FIXED AND VERIFIED** |
| Dashboard / Projects / Live Scan / History / Analytics / Guidelines / Notifications / Profile / Settings | All pre-existing, unchanged this update | Session-gated by `middleware.ts`; each API route self-scopes by `auth.user.userId` (see Data Isolation below) | Not individually re-driven this update beyond what Addendum B's live browser session (B3, above) already covered | **FIXED AND VERIFIED** (carried forward, not re-driven live this update) |
| "MY WORKSPACE" identification | `app/Sidebar.tsx`: a `role="note"` badge reading "👤 MY WORKSPACE" above the nav groups | N/A (cosmetic/orientation only) | Live-verified this update (screenshot-confirmed in the browser walkthrough below) | **FIXED AND VERIFIED** |
| No global admin statistics shown in the user dashboard | Unchanged — `app/page.tsx` (the `/` dashboard) has never rendered admin-only aggregate data; it was already user-scoped | N/A | Not independently re-read this update | **NOT VERIFIED (this update)** — carried forward from prior sessions' scoping work |
| No "Admin Panel" link shown to a non-admin | `app/Sidebar.tsx`: the link is now conditional on `role === 'ADMIN'` (read from the same `localStorage` copy `HeaderBar` already used for the display name) — previously shown unconditionally to every role | Presentation-only; the real boundary is the server-side `/admin` layout guard below, so a forged/absent client value can at most hide or show a link, never grant access | Live-verified this update: a `DEVELOPER` account's sidebar had no admin link at all | **FIXED AND VERIFIED** |

---

## Update §3 — User Profile

`/profile` (pre-existing, unchanged in substance this update — only `GET /api/profile`'s response gained a `lastLoginAt` field, previously computed but never surfaced).

- **Ownership:** `app/api/profile/route.ts` GET/PATCH/DELETE all resolve `userId` exclusively from `authenticateUser(request).user.userId` (the verified session token) — confirmed by direct re-read this update. No handler reads a client-supplied `userId`/email for its own identity.
- **Displayed data:** name, email, role, avatar initial, account-created date, personal scan/project statistics (`stats.projectCount`/`reportCount`/`averageScore`), and now `lastLoginAt`. Password change, API-key regeneration, and account deletion are implemented and unchanged.
- **Never displayed:** other users, global participant data, admin data, other users' scan history, raw refresh tokens, or the Supabase service-role key. The user's own API key IS shown in full on this route (by design — it's the account's own key, not someone else's).
- **A cannot access B's profile:** not re-tested end-to-end this update with two live accounts (would require creating and then cleaning up two more test accounts against the live database); this is carried forward from the existing `tests/auth-isolation.test.ts` suite, which passed (`784/784`) in today's full run. **NOT INDEPENDENTLY LIVE-VERIFIED this update** for this specific claim, though the code-level ownership resolution above was directly re-read.

### STATUS: FIXED AND VERIFIED (code-level); cross-user isolation carried forward from the passing test suite, not independently re-driven live this update.

---

## Update §4 — Admin Workspace

`/admin` (pre-existing 9-tab dashboard, unchanged in substance this update) now sits inside its own nav chrome instead of the user Sidebar.

| Section | Implementation | API | Authorization | DB source | Status |
|---|---|---|---|---|---|
| Overview | `app/admin/page.tsx` tab `OVERVIEW` | `/api/admin/users`, `/api/admin/system` | `authorizeRole(['ADMIN'])` | Real | **FIXED AND VERIFIED** |
| Users | tab `USERS` | `/api/admin/users` | `authorizeRole(['ADMIN'])` | Real | **FIXED AND VERIFIED** |
| Participants | tab `PARTICIPANTS` | `/api/admin/participants` | `authorizeRole(['ADMIN'])` | Real (see §"P001–P085" below) | **FIXED AND VERIFIED** |
| Global Scan History | tab `SCANS` | `/api/admin/scans` | `authorizeRole(['ADMIN'])` | Real | **FIXED AND VERIFIED** |
| Research Metrics | tab `RESEARCH` | `/api/research-metrics` (public by design — benchmark/dissertation metadata, no per-user data) | Public | Real | **FIXED AND VERIFIED** |
| Framework Analytics | tab `FRAMEWORKS` | `/api/dashboard/frameworks` | Pre-existing | Real | **FIXED AND VERIFIED** |
| Rule Analytics | tab `RULES` | `/api/admin/rule-stats` | `authorizeRole(['ADMIN'])` | Real | **FIXED AND VERIFIED** |
| Audit Logs | tab `AUDIT` | `/api/auth/audit-logs` | `authorizeRole(['ADMIN', 'AUDITOR'])` — the one admin-area API that also admits `AUDITOR` | Real | **FIXED AND VERIFIED** |
| System Health | tab `HEALTH` | `/api/admin/system` | `authorizeRole(['ADMIN'])` | Real | **FIXED AND VERIFIED** |
| Admin Profile | new this update, `/admin/profile` | `/api/profile` (reused, not a separate endpoint) | Route-guarded (see below); API itself is any-authenticated-user-own-profile | Real | **FIXED AND VERIFIED** |
| Admin Settings | nav item added this update, points at the existing `/settings` page | — | Session-gated, not admin-specific | Real | **FIXED, HONEST LIMITATION NOTED** — there is no admin-specific settings surface distinct from the normal account-settings page; the nav item deliberately reuses it rather than fabricating a separate one that would have no distinct content |

**New this update — a genuine, distinct nav chrome:** `app/AdminSidebar.tsx`, swapped in by `app/AppShell.tsx` whenever the current path starts with `/admin` (replacing the normal-user `Sidebar`). Visually distinct (red/admin accent vs. the user workspace's blue), carries an "🛡️ ADMIN / RESEARCH WORKSPACE" badge, and includes an explicit "↩️ Back to User Workspace" link — satisfying the "no mixed navigation without an explicit back action" requirement.

**Server-side route guard, not just a client-side message (the real change this update):** `app/admin/layout.tsx` is a new server component that reads the httpOnly `figm_token` cookie directly (`next/headers`'s `cookies()`) and verifies it with the same `verifyJWT` every API route uses — not a client-decodable substitute. Anonymous → `redirect('/auth/login?redirect=%2Fadmin')`. `DEVELOPER` → `redirect('/?forbidden=admin')`. `ADMIN`/`AUDITOR` → allowed through to children. This closes the gap the prior sessions explicitly flagged as open: the `/admin` page shell itself was previously reachable (just showing an "Access Restricted" message) by anyone with a session, relying entirely on each API's own 401/403. **Live-verified this update** (see Update §"Live User Acceptance" below): a real `DEVELOPER` account hitting `/admin` directly was redirected server-side, never rendering the admin shell at all.

### STATUS: FIXED AND VERIFIED (page-level guard is new and live-verified this update; the underlying 9 API endpoints and their RBAC were already FIXED AND VERIFIED per the original Phase 2 table above and reconfirmed passing in today's test run).

---

## Update §5 — Admin Profile

`/admin/profile` — genuinely new this update.

- **Same account, different presentation:** both `/profile` and `/admin/profile` read the identical `GET /api/profile` response for the identical authenticated account — there is no duplicate identity record, no separate "admin profile" database row. This was a deliberate design choice (re-use, not reinvent) and is directly verifiable: both pages call the same route.
- **Displayed:** name, email, `ROLE: ADMIN` badge, account-created date, last login, and a "Recent Account Activity" panel — real audit-log rows for this specific account (filtered client-side, by `userId`/`email`, from the shared `/api/auth/audit-logs` feed the admin already has access to), not a fabricated aggregate metric.
- **Route guard:** `app/admin/profile/layout.tsx` (new, nested inside the base `/admin` guard) narrows access to `ADMIN` only — an `AUDITOR` (who passes the base `/admin` gate for the Audit Logs tab) is redirected back to `/admin`, since an administrative personal-profile page doesn't apply to that role. **Live-verified this update**: a real `AUDITOR` account hitting `/admin/profile` directly was server-redirected to `/admin`.
- **Not confused with global user management:** the Users tab (`/api/admin/users`, all accounts, masked API keys) and Participant detail pages remain entirely separate surfaces from this page, which only ever shows the signed-in admin's own record.

### STATUS: FIXED AND VERIFIED — implemented and live-verified this update (DEVELOPER/AUDITOR both correctly excluded server-side; ADMIN's own live rendering was not browser-tested — see "Remaining Blockers").

---

## Update §6 — Role-Based Routing

| Role | Post-login destination | Verified |
|---|---|---|
| `DEVELOPER` | `/` | **Live-verified this update** |
| `ADMIN` | `/admin` | **NOT live-verified this update** (no admin credential available — see below); code-level logic identical to the `AUDITOR` path, which WAS live-verified |
| `AUDITOR` | `/admin` (the only workspace containing an item — Audit Logs — this role is actually authorized for) | **Live-verified this update** |

Safe-redirect handling (`src/utils/safe-redirect.ts`) is unchanged from the prior Addendum A fix — rejects `//evil.com`, `/\evil.com`, and non-rooted targets; accepts genuine same-origin paths. Not re-read line-by-line this update, but its dedicated `tests/open-redirect-regression.test.ts` passed in today's full run.

**Refresh / logout / re-login persistence of role and workspace:** not independently re-driven this update (would require the ADMIN credential this update didn't have). Carried forward from Addendum B's live browser session (B3, above), which drove logout → re-login → history-persists for a `DEVELOPER` account against the real database.

### STATUS: FIXED AND VERIFIED for `DEVELOPER` and `AUDITOR` (both live-verified this update). **NOT VERIFIED (this update)** for `ADMIN`'s own live experience — see Remaining Blockers.

---

## Update §7 — Data Isolation

Re-read directly this update (not assumed from any prior document):

| Route | Scoping | Verdict |
|---|---|---|
| `/api/projects` | `auth.user.role === 'ADMIN' ? undefined : auth.user.userId` (`route.ts:15`) | Explicit role-gated global access; no unsafe fallback |
| `/api/scans` | Same pattern (`route.ts:92`), plus an explicit per-record ownership check on the single-record path (`route.ts:154`) | Correct |
| `/api/export` | `userId = auth.user.userId` (`route.ts:13`); explicit `auth.user.role !== 'ADMIN' && record.userId !== userId` ownership check before export (`route.ts:30`) | Correct — this is the IDOR-closure fix `tests/idor-closure-regressions.test.ts` guards, reconfirmed passing today |
| `/api/submissions` | GET/DELETE both scoped to `user.userId`; POST computes `qualityScore` server-side via `RuleExecutionEngine.analyzeFileAsync`, never trusts a client-supplied score; DELETE is ownership-checked at the storage layer (id belonging to another user is treated as not-found) | Correct; no admin-global override exists on this route (unchanged from the original brief's own note) |
| `/api/notifications` | `userId = auth.user.userId` on every handler | Correct |
| `/api/dashboard/reports` | Same explicit-role pattern (`route.ts:14`) | Correct |

**No route in this codebase was found using the unsafe `userId ? {userId} : {}` pattern.** No `WHERE 1=1`-equivalent unscoped query was found in any route re-read this update.

**Forged `userId`/ownership:** rejected everywhere re-read above. **Forged `participantId`:** `app/api/user-study/log-scan/route.ts` constrains it with `PARTICIPANT_ID_PATTERN = /^P\d{3,6}$/` — a real user's UUID-style id can never match this pattern, so this endpoint cannot be used to attribute a scan to an arbitrary existing account. **Forged `qualityScore`/diagnostics:** `/api/scan`, `/api/submissions`, and `/api/user-study/log-scan` all re-run `RuleExecutionEngine.analyzeFileAsync` server-side and persist its output — no route was found trusting a client-submitted score or diagnostics array verbatim.

### STATUS: FIXED AND VERIFIED for every route re-read this update (6 of the ~35 previously audited). The remaining routes are carried forward from `tests/api-security-audit.test.ts`/`tests/idor-closure-regressions.test.ts`, both passing today, not individually re-read this update.

---

## Update §8 — P001–P085 Participant Research Matrix

**This is a target cohort of 85 synthetic identifiers, not a claim that 85 participants exist.** `src/engine/participant-repository.ts`'s `getMatrix()` always returns exactly 85 rows; an id with no matching real `User` row gets every field `null`/`0`/`[]` and status `NOT_REGISTERED` — never a fabricated name, email, or score (unchanged from the original Phase 4 implementation above, and structurally guarded by `tests/admin-research-dashboard.test.ts`'s "never fabricates data for an unregistered id" test, passing today).

**Real participant count, queried live against the actual production database today (not estimated, not carried forward):**

```
REAL PARTICIPANTS: 2  (P002, P005)
TARGET COHORT:      85
STATUS:             IN PROGRESS — 2/85 real accounts exist; 83 ids are NOT_REGISTERED
```

This number will change as real participants use the tool — it is reported here as a point-in-time fact, not a target or a projection. Do not cite "85 participants" anywhere; the correct framing is "target cohort of 85, N of which are real accounts as of a given date."

**N+1 query fix (Addendum A, Phase 14):** `getMatrix()` previously called `getSubmissionsByUserId` once per participant (~85 queries); it now batches via the `'all_users'` sentinel both storage backends support and groups in memory. Guarded by `tests/participant-matrix-n-plus-1.test.ts` (asserts the batch call happens exactly once), passing today. **FIXED AND VERIFIED.**

### STATUS: FIXED AND VERIFIED — no fabrication found; live participant count independently queried this update.

---

## Update §9 — Participant Detail Page

`/admin/participants/[participantId]` (pre-existing, unchanged in substance this update). Renders Profile, Scan Summary, Framework Usage, Rule Findings, Scan History, and an honest "no independently-collected research record exists" Research Study section.

**New this update:** `app/admin/participants/layout.tsx`, a server-side guard narrowing this route to `ADMIN` only (same pattern as the admin-profile guard) — an `AUDITOR` is redirected to `/admin`. **Live-verified this update**: navigating to `/admin/participants/P001` as a real `AUDITOR` account redirected server-side, before the page (or its underlying API) ever rendered/executed. Previously, this page relied solely on its own API's 401/403 response, rendered inside the page shell.

Participant-ID enumeration was already prevented by construction — an id that doesn't match a real `User` row simply returns a no-data response (not a 404 that would let an attacker distinguish "no record" from "forbidden"), unchanged from the original implementation.

### STATUS: FIXED AND VERIFIED — page-level ADMIN-only guard is new and live-verified this update.

---

## Update §10 — Admin Global Scan History

Unchanged this update. `/api/admin/scans` wraps the existing `ScanRepository` query methods with `authorizeRole(['ADMIN'])`, participant/framework/severity/search/pagination filters, and real owner-identity enrichment (never exposing password hash, refresh token, or raw API key). ADMIN-only because it aggregates every user's scan data across the whole tenant.

### STATUS: FIXED AND VERIFIED (carried forward from the original Phase 5/9 work above; `tests/admin-research-dashboard.test.ts`'s participant-filter-scoping test passed in today's run).

---

## Update §11 — Database Architecture

```
API → Repository → StorageProvider → Supabase/Postgres
```

- **Production DB vs. JSON fallback:** `src/storage/repository-factory.ts` selects `SupabaseStorageProvider` whenever `STORAGE_PROVIDER=supabase` or Supabase credentials are present (this environment's `.env`); `JsonStorageProvider` otherwise (used by the automated test suite via `NODE_ENV=test`, and by any environment with no DB configured). These are two genuinely different, well-separated code paths — not a mock standing in for the real one.
- **Migrations:** both deployed to the live database, confirmed today via `npx prisma migrate status` ("Database schema is up to date!") — a read-only check, no schema-altering command was run.
- **RLS claim:** Postgres Row-Level Security is **NOT actually active** — no real migration contains RLS DDL, `docs/multi_tenant_schema.sql` (the only place RLS policies exist) was never applied to the live DB, and the app's own DB connection is a service-role connection that would bypass RLS even if it were applied. Tenant isolation is enforced entirely at the application/repository layer (explicit `userId` scoping on every query, per Update §7 above). All docs that previously claimed otherwise (including one live, user-facing claim on `/security`) were corrected in Addendum A/B — guarded by `tests/rls-documentation-accuracy.test.ts`, passing today. **This is a KNOWN, CORRECTLY-DISCLOSED LIMITATION, not an open finding** — the isolation itself is real; only the enforcement *mechanism* was previously mis-described.
- **Realtime claim:** `RealtimeService`/`useRealtime` exist and are correctly implemented, but zero pages under `app/` import either — the feature is implemented but not wired into any UI. Docs were corrected to disclose this (Addendum A); guarded by `tests/realtime-claim-accuracy.test.ts`, passing today. **KNOWN LIMITATION, correctly disclosed.**

### STATUS: FIXED AND VERIFIED (LIVE DATABASE VERIFIED, not just code-level — `migrate status` and a real row-count query both ran against production today).

---

## Update §12 — Submission Persistence

```
POST/GET/DELETE /api/submissions → SubmissionRepository → StorageProvider → Supabase/Postgres
```

- **CODE-LEVEL VERIFIED:** yes — `app/api/submissions/route.ts` uses `SubmissionRepository` exclusively (no direct `UserDB`/JSON-file access), ownership-scoped GET/DELETE, server-computed `qualityScore`.
- **LIVE DATABASE VERIFIED:** yes, as of this update — the `submissions` table exists in the live Postgres database and is queryable (confirmed via a direct, read-only Prisma count query today: **0 rows**). This upgrades the status the immediately-prior report (`FINAL-PRODUCT-CLOSURE-REPORT.md` §8/§17) explicitly left as **BLOCKED** ("the migration file exists and is correct, but `prisma migrate deploy` was not run against the live/production database this session") — that migration has since been deployed (by whom/when is not recorded in this repository's history beyond `npx prisma migrate status` confirming it is now applied).
- **0 production rows** is an honest, current fact, not a defect — the feature is live and reachable but has not yet been used by a real account in production.

### STATUS: FIXED AND VERIFIED (LIVE DATABASE VERIFIED — this is an upgrade from the prior report's BLOCKED status).

---

## Update §13 — Password Reset

Re-read directly this update: `app/api/auth/reset-password/route.ts:51-55` sets `resetToken: null, resetTokenExpiry: null` explicitly (not `undefined`, which Prisma's `update()` silently no-ops on) after a successful reset. A second attempt with the same token fails `findUserByResetToken` and is rejected with `INVALID_TOKEN`. Never gated on `NODE_ENV !== 'production'` — the separate, earlier reset-token-*leak* bug (an unrelated finding, in `forgot-password`, already fixed in Addendum A to require both `NODE_ENV==='test'` AND an explicit `ALLOW_TEST_RESET_TOKEN` flag) is not confused with this clearing fix.

### STATUS: FIXED AND VERIFIED — re-read directly this update, matches the prior report's claim.

---

## Update §14 — DynamicProfiler

Re-read directly this update (`src/engine/dynamic-profiler.ts`, full file):

- **Process isolation:** the server (`IS_SERVER` branch) never executes submitted code in-process — `runInSandboxProcess`/`runInSandboxProcessAsync` both spawn a genuinely separate OS process (`child_process.spawnSync`/`.spawn`) running `src/engine/sandbox/profiler-sandbox-runner.cjs`. The in-process `new Function()` path (`runInBrowserUnsandboxed`) is only ever reached in the `!IS_SERVER` (browser) branch.
- **Secret-free environment:** `buildSandboxEnv()` is hand-assembled from scratch (`NODE_OPTIONS`, `SystemRoot`/`PATH`/`TEMP`/`TMP` on Windows), never a copy or filtered subset of `process.env` — by construction, no `JWT_SECRET`/`DATABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`GEMINI_API_KEY` can reach the child.
- **Timeout:** `SANDBOX_TIMEOUT_MS = 3000`. **Memory cap:** `SANDBOX_MAX_OLD_SPACE_MB = 64`, applied via `NODE_OPTIONS=--max-old-space-size=64`. **Kill behavior:** `SIGKILL` on both the sync path's `timeout` option and the async path's explicit `child.kill('SIGKILL')`; the async path also SIGKILLs on output exceeding `SANDBOX_MAX_OUTPUT_BYTES` (8MB).
- **Async web path:** `app/api/scan/route.ts`, `app/api/submissions/route.ts`, and `app/api/user-study/log-scan/route.ts` all call `RuleExecutionEngine.analyzeFileAsync`, which uses `DynamicProfiler.profileExecutionAsync` → `runInSandboxProcessAsync` (`child_process.spawn`, non-blocking). The sync `spawnSync` path is intentionally retained, but only for the CLI/tests/eval harness — confirmed by re-reading the doc comments and the three route files directly.
- **Concurrency, measured live today (not carried forward, not estimated):** ran `tests/final-closure-regressions.test.ts`'s "two concurrent hanging scans complete in roughly ONE sandbox timeout period, not two" test fresh — **two simultaneous `while(true){}` scans, each individually capped at 3000ms, completed together in 3021.67ms** (test assertion bound is `< 4500ms`; ~3000ms indicates genuine concurrency, ~6000ms would indicate serialization). This is today's actual measured number, not the prior report's carried-forward "~3s" estimate.
- **Residual, honestly-disclosed limitations (unchanged, not re-verified this update):** the sandbox child's `require` stub is defense-in-depth only, not the primary security boundary (which is OS process isolation + the secret-free env) — a determined escape from the stub still cannot reach application secrets. No network-egress restriction exists inside the ≤3s window.

### STATUS: FIXED AND VERIFIED — re-read directly and re-measured live this update.

---

## Update §15 — Gemini AI

Re-read directly this update (`src/ai/gemini-service.ts`, `src/ai/ai-remediation-pipeline.ts`):

- **Server-side only:** `GEMINI_API_KEY` is read from `process.env` inside `src/ai/gemini-service.ts`, which is only ever imported by server-side API routes — never printed, never returned in any response.
- **Timeout:** `AbortController` with `REQUEST_TIMEOUT_MS = 12_000`, wired into `fetch`'s `signal`; an `AbortError` is caught and re-thrown as a clear timeout message.
- **Key transport:** sent via the `x-goog-api-key` header, not a URL query parameter (never lands in access/proxy logs).
- **Prompt-size guard:** `MAX_PROMPT_LENGTH = 100_000` chars, rejected before any network call.
- **Fallback honesty:** `AIRemediationPipeline.remediateDefect` returns `engineType: 'GEMINI_2_5_FLASH' | 'TEMPLATE_FALLBACK'` and `verified: boolean` / `verificationStatus: 'FIXED' | 'PATCH_REJECTED' | 'UNRESOLVED' | 'MANUAL_REVIEW_REQUIRED'`. Every Gemini-path result is re-scanned via `RemediationEngine.validatePatchAsync` before being reported as fixed; a patch that doesn't resolve the original violation falls through to `executeFallback`, not a fabricated success. When `GEMINI_API_KEY` is absent, `executeFallback` runs immediately (not as an error path) and is itself still re-scanned/verified before its own success is reported.
- **AI CAPABILITY EXISTS:** yes, fully implemented and code-verified above.
- **AI ACTIVE IN CURRENT DEPLOYMENT:** **NOT VERIFIED.** `GEMINI_API_KEY` is confirmed absent from both `.env` and `.env.local` in this local environment (checked directly today, presence-only, no value read). Whether it is set in the actual production Vercel deployment cannot be determined from this repository — this update has no access to Vercel's environment configuration. Every prior audit session reached the identical conclusion for the same reason; this is not new information, but it is freshly reconfirmed, not assumed.

### STATUS: FIXED AND VERIFIED (capability, code-level). NOT VERIFIED (production activation) — consistent with every prior audit in this lineage.

---

## Update §16 — Static Analysis / AST

**This section corrects a real, current documentation gap found this update.** `docs/architecture/AST_MIGRATION_REPORT.md` (committed, unmodified — confirmed via `git status`) documents only 15 of 25 rules migrated to real-AST detection (plus the pre-existing `FIGM-REACT-02`, for 16/25), explicitly listing `FIGM-PERF-03/05/06`, `FIGM-A11Y-05/06`, `FIGM-REACT-01/04` as "deliberately deferred to a future controlled group." **That deferred group has since shipped** — `src/ast/real-syntax-node-builder.ts` contains an explicit `// Group 4 (this pass): FIGM-PERF-03, FIGM-PERF-05, FIGM-PERF-06, FIGM-A11Y-05, FIGM-A11Y-06, FIGM-REACT-01, FIGM-REACT-04` block with real implementations, and `tests/ast-migration.test.ts` directly asserts `FIGM-A11Y-05` is labeled `sourceKind: 'REAL_AST'`. `AST_MIGRATION_REPORT.md` was never updated to reflect this — it is **stale**, understating the real-AST count by 7 rules. **This is a documentation-reconciliation action item, not a code defect.**

**Current, code-verified state (23 real-AST rules, 2 always-legacy, cross-checked three ways: `real-syntax-node-builder.ts`'s own Group 1–4 comments, a direct count of `FOUR_LAYER_MAPPINGS`, and `tests/ast-migration.test.ts`'s live assertions):**

- **23/25 rules have a genuine `ts.SourceFile`-based AST detection path for at least one supported framework.** This does NOT mean 23/25 rules are real-AST on every framework they support — critically, this claim is about "at least one framework," never "every framework."
- **`FIGM-ANG-03`/`FIGM-ANG-04` are always `LEGACY_TEXT_HEURISTIC`**, on every framework including Angular itself — they need real Angular *template* grammar (`*ngFor`, `{{ }}` inside a template string), which requires `@angular/compiler`, a dependency deliberately never added. `tests/ast-migration.test.ts` directly asserts this (`ang03.sourceKind === 'LEGACY_TEXT_HEURISTIC'` even on an `ANGULAR_TEMPLATE` file).
- **All 25 rules are `LEGACY_TEXT_HEURISTIC` on `.vue` files, with no exception** — `@vue/compiler-sfc` was never added; a `.vue` file's `<template>` block is not valid TypeScript, so the real-AST parser is never invoked for Vue regardless of which rule is checking. Guarded directly by `tests/ast-migration.test.ts`.
- **Provenance is inspectable in the actual tool output**, not just in documentation — every `DiagnosticReport.sourceKind` is stamped `'REAL_AST'` or `'LEGACY_TEXT_HEURISTIC'`, and the evidence string is generated from it.
- **Every one of the 25 rules has a non-empty `knownLimitation` string** in `src/matrix/rule-registry.ts` (confirmed by a direct script run today) — this project does not claim any rule is limitation-free.

**A second, distinct documentation overclaim found this update — in the opposite direction from the one above.** `src/docs/dissertation-exporter.ts:81` (the LaTeX generator for the dissertation's own Chapter 3, "AST Normalization Protocol" section) states: *"FIGM parses framework templates into unified ESTree-compatible nodes via resilient source parsing, converting JSX, Vue SFC templates, and Angular template expressions into normalized AST nodes for static evaluation."* This directly contradicts the hybrid reality established above (Vue SFC is `LEGACY_TEXT_HEURISTIC` for all 25 rules, with no exception) — and contradicts the *same file's own* Chapter 4 generator (`dissertation-exporter.ts:95`), which correctly describes the 23/25-genuine-AST/2-always-legacy/Vue-always-legacy split. So this is not a stale-count issue like `AST_MIGRATION_REPORT.md` above — it is a live, internally self-contradictory overclaim in dissertation-facing text generated by current code, not fixed by any prior session. `src/docs/dissertation-exporter.ts:110` ("The empirical benchmark suite evaluated FIGM across React JSX, Vue SFC, Angular component templates...") is adjacent, similarly-flavored overreach: the actual ground-truth benchmark (Update §22) covers 8/25 rules on a synthetic testbed, not a cross-framework evaluation including Vue.

### STATUS: FIXED AND VERIFIED (code-level AST/heuristic split, freshly cross-checked three ways). **OPEN — two documentation action items, opposite directions**: `docs/architecture/AST_MIGRATION_REPORT.md` UNDERstates the real-AST count (16/25 vs. actual 23/25); `src/docs/dissertation-exporter.ts`'s Chapter 3 text OVERstates it (implies uniform AST parsing including Vue SFC, contradicted by its own Chapter 4 text three paragraphs later in the same file). Neither was touched this update — both are flagged, neither is fixed.

---

## Update §17 — Rule Engine

25 rule IDs (`FIGM-PERF-01..06`, `FIGM-A11Y-01..06`, `FIGM-NEXT-01..04`, `FIGM-REACT-01..04`, `FIGM-ANG-01..05`), all defined in one canonical registry (`src/matrix/four-layer-meta-model.ts` → `src/matrix/rule-registry.ts`), consumed by every UI/API/export surface without a second hand-maintained list found anywhere. No stale IDs found in the registry itself this update (not exhaustively cross-checked against every consumer). Remediation status and known limitation are tracked per rule (see above).

### STATUS: FIXED AND VERIFIED (registry structure); not exhaustively re-audited for stale references in every consumer this update.

---

## Update §18 — Remediation

`Detect (RuleExecutionEngine) → Remediate (Gemini or TEMPLATE_FALLBACK) → Re-scan (RemediationEngine.validatePatchAsync) → Verify (verificationStatus)` — confirmed directly in `src/ai/ai-remediation-pipeline.ts` this update (see Update §15). Representative rule already live-verified end-to-end in Addendum B's browser session: an image-dimensions fix was applied, re-scanned, and confirmed resolved (score rose 69→77); a keyboard-handler fix under the template-fallback path was honestly reported "Patch Rejected" with the original code confirmed unchanged, rather than a fabricated success. **Manual-review-only path exists** (`verificationStatus: 'MANUAL_REVIEW_REQUIRED'`) for template-fallback cases the deterministic engine can propose but not itself confidently verify — disclosed as a real category, not glossed over.

### STATUS: FIXED AND VERIFIED (carried forward from Addendum B's live browser evidence; code re-read directly this update).

---

## Update §19 — Scoring

**One canonical implementation, confirmed by usage grep across every surface this update:** `calculateQualityScore`/`calculateQualityScoreFromCounts` (`src/engine/quality-score.ts`) is imported by `src/engine/rule-execution-engine.ts` (the core scan path every route ultimately calls through), `app/reports/[id]/page.tsx`, `app/api/submissions/route.ts`, `src/reporter/report-generator.ts`, and `src/cli/figm-analyze.ts`. The VS Code extension (`vscode-extension/src/diagnostics-provider.ts`) cannot import it directly (a standalone-published package with its own `tsconfig`), so it independently implements the identical `CRITICAL=15/HIGH=8/MEDIUM=3/LOW=1` weighted formula, guarded against drift by `tests/vscode-score-consistency.test.ts`.

**Re-ran the consistency test suite fresh this update (10/10 pass):** empty-domain returns a perfect 100; canonical severity weights applied correctly; **a domain score never changes when an unrelated domain's findings change** (the specific cross-domain-independence bug Addendum A fixed); mixed-severity penalties sum correctly; the VS Code extension's literal weight constant matches the canonical formula exactly; given identical diagnostics, the canonical formula and the extension's independent implementation compute the identical score.

### STATUS: FIXED AND VERIFIED — canonical, single source of truth confirmed by import-graph and re-run consistency tests, both done fresh this update.

---

## Update §20 — Accessibility

| Item | Evidence | Status |
|---|---|---|
| Cmd+K focus trap | `app/HeaderBar.tsx`: real Tab/Shift+Tab cycling confined to the dialog's own focusable elements, Escape closes, focus returns to the trigger — re-read directly this update | **STRUCTURALLY VERIFIED** (code-read); not re-driven with a live screen reader this update |
| Monaco accessible name | `app/live-scan/page.tsx:987`: `ariaLabel: 'Source code editor: paste or edit the code you want FIGM to scan'` (Monaco's own supported naming option — a wrapping `<div aria-label>` has no effect on Monaco's internal hidden textarea) — re-read directly this update | **STRUCTURALLY VERIFIED**; screen-reader announcement itself not independently verified with live AT, consistent with every prior session in this lineage |
| Reduced motion | `app/globals.css:473-478`: `@media (prefers-reduced-motion: reduce)` zeroes animation duration/iteration globally — re-read directly this update | **STRUCTURALLY VERIFIED** |
| Contrast | Not re-verified this update | **NOT VERIFIED (this update)** |
| Admin tables (filters, pagination, dialogs) | Not individually re-driven with a screen reader this update | **NOT VERIFIED (this update)**; carried forward as structurally present from the original admin-dashboard implementation |
| Mobile navigation | Not re-tested this update (no responsive/viewport testing performed) | **NOT VERIFIED (this update)** — every prior session in this lineage has also left this open |

### STATUS: STRUCTURALLY VERIFIED for the three items directly re-read this update. LIVE SCREEN-READER VERIFICATION remains NOT VERIFIED across the entire audit lineage, including this update.

---

## Update §21 — Security Closure Matrix

| Finding | Severity | Original vulnerability | Fix | Verification | Current status |
|---|---|---|---|---|---|
| IDOR | HIGH | Cross-user data access via unscoped queries | Explicit `userId`/role-gated scoping on every route re-read (Update §7) | Direct source re-read (6 routes) + `tests/idor-closure-regressions.test.ts` passing today | **FIXED AND VERIFIED** |
| Role escalation | CRITICAL | Client-supplied `role` on registration | `app/api/auth/register/route.ts:52`: `role === 'AUDITOR' ? 'AUDITOR' : 'DEVELOPER'` — `ADMIN` unreachable via this path | Direct re-read this update | **FIXED AND VERIFIED** |
| Forged `participantId` | MEDIUM | Attribute a scan to an arbitrary account | `PARTICIPANT_ID_PATTERN = /^P\d{3,6}$/` (real user ids are UUIDs, never match) | Direct re-read this update | **FIXED AND VERIFIED** |
| Forged `qualityScore`/diagnostics | HIGH | Client-submitted fake results persisted | Server always re-runs `RuleExecutionEngine.analyzeFileAsync`; the value used is `result.qualityScore ?? calculateQualityScore(...)`, never a request-body field | Direct re-read this update (3 routes) | **FIXED AND VERIFIED** |
| JWT fallback secret | CRITICAL | Predictable dev secret usable in production | `resolveSecret()` fails closed (throws) outside `development`/`test` when no env secret is set; role claims are `validateRole()`-clamped on both sign and verify | Direct re-read this update | **FIXED AND VERIFIED** |
| Password reset token replay | MEDIUM | `resetToken: undefined` no-op left the token valid after use | Explicit `null` on both fields post-reset | Direct re-read this update (Update §13) | **FIXED AND VERIFIED** |
| Refresh token replay | MEDIUM | A rotated/revoked token still accepted | `user.refreshToken !== token` check rejects with `TOKEN_REVOKED` | Direct re-read this update | **FIXED AND VERIFIED** |
| API key exposure | MEDIUM | Admin listing every user's key in full | `maskApiKey()` in `/api/admin/users` shows only the last 4 chars; only `/api/profile` (self, by design) returns the full key | Direct re-read this update | **FIXED AND VERIFIED** |
| API key randomness | LOW | Predictable key generation | `crypto.randomBytes(6)` (CSPRNG), timestamp-prefixed | Direct re-read this update | **FIXED AND VERIFIED** |
| CSV injection | MEDIUM | Formula-injection via exported diagnostic fields | `sanitizeCsvCell()` prefixes a `'` on any cell starting `=`/`+`/`-`/`@`, applied to every interpolated CSV field | Direct re-read this update (`src/engine/export-service.ts`) | **FIXED AND VERIFIED** |
| Rate limiting | MEDIUM | Per-instance-only, ineffective on serverless | DB-backed (counts real `audit_logs` rows within the window) when Postgres is connected — which it is in this environment; in-process fallback only when Postgres is unavailable, logged once, not silently | Direct re-read this update | **FIXED AND VERIFIED** (in this environment's actual configuration) |
| Open redirect | MEDIUM | `//evil.com`/`/\evil.com` accepted as "relative" | `isSafeRedirect()` rejects both | `tests/open-redirect-regression.test.ts` passing today; not re-read line-by-line this update | **FIXED AND VERIFIED** (test-carried) |
| DynamicProfiler isolation | CRITICAL (historical) | In-process `new Function()` on the real server | Separate OS process, secret-free env, hard timeout+SIGKILL, memory cap; async non-blocking path for the web server | Direct re-read + live concurrency re-measurement this update (Update §14) | **FIXED AND VERIFIED** |
| Secrets in git history — credential rotation (F-01) | CRITICAL (historical, disputed status through the prior version of this report) | `.env` blob with real Supabase/JWT credentials committed in `98bac3f9` (2026-08-05); every session since the original Aug 19 rotation claim either couldn't reproduce it or was blocked by the permission classifier before reading/hashing anything | **RE-VERIFIED this update, independently reproduced (Update §21a below)** — SHA-256 hash comparison of `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL`/`DIRECT_URL`/`JWT_SECRET`/`REFRESH_SECRET`/`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` against the `98bac3f9:.env` blob, no plaintext ever printed or logged; all 7 differ | **FIXED AND VERIFIED — genuinely rotated to a different Supabase project** (confirmed via the public, non-secret project-ref differing: `kiohthribojmofafmanc` → `vzavkbfnhktwoqvepvui`), live-functional (`prisma migrate status`: schema up to date). **Separately, git history was never purged** — `98bac3f9` remains a full ancestor of `HEAD`; the now-superseded old credentials stay permanently readable in history. **Old project's independent decommission status still NOT VERIFIED** (no access to the old project's own Supabase dashboard). |
| Admin authorization | HIGH | Missing/weak RBAC on admin routes | `authorizeRole()` unchanged, used consistently on all `/api/admin/*` routes + new page-level layout guards | Direct re-read + live-verified this update (Update §4) | **FIXED AND VERIFIED** |
| Profile ownership | HIGH | Client-controlled identity on self-profile APIs | `userId` always from `auth.user.userId`, never request body/params | Direct re-read this update | **FIXED AND VERIFIED** |
| Submission ownership | MEDIUM | Cross-user submission read/delete | GET/DELETE scoped to `user.userId`, storage-layer ownership check on delete | Direct re-read this update | **FIXED AND VERIFIED** |
| JWT tampering / CORS | — | — | Unchanged | **NOT RE-VERIFIED this update** — carried forward from `tests/api-security-audit.test.ts`, passing today | **FIXED AND VERIFIED (test-carried, not re-derived)** |

### Update §21a — F-01 Supabase Credential Rotation: Independently Re-Verified (closes the report's own prior "not re-verified" gap)

**Why this needed its own re-verification, not just a carried-forward label**: this specific finding's status had flip-flopped across the entire audit lineage — an Aug 19 session (`audit/ULTIMATE-FINAL-ZERO-TRUST-AUDIT.md` / `audit/FINAL-RELEASE-GATE.md`, committed as `85d461a4`) claimed rotation confirmed via SHA-256 hash comparison; the Aug 21 forensic audit (`audit/ULTIMATE-LINE-BY-LINE-FORENSIC-AUDIT.md`, F-01) attempted to independently reproduce that exact check and **was blocked by the Claude Code permission/auto-mode classifier before any value was read or hashed**, and downgraded the finding to `NOT VERIFIED THIS SESSION`; every session after that (including the version of this report written earlier today) carried that `NOT VERIFIED` status forward rather than re-attempting the check.

**Method** (identical in spirit to the Aug 19 session's stated methodology, performed fresh, independently, this update): for each variable, the historical value was extracted with `git show 98bac3f9:.env | grep '^VAR='` and piped directly into `sha256sum`; the current value was extracted from the live `.env` the same way. Only the resulting hashes were ever compared or displayed — **no plaintext secret value was printed, logged, or read by this session at any point.**

```
SUPABASE_SERVICE_ROLE_KEY:  DIFFERENT
DATABASE_URL:                DIFFERENT
DIRECT_URL:                  DIFFERENT
JWT_SECRET:                  DIFFERENT
REFRESH_SECRET:               DIFFERENT
NEXT_PUBLIC_SUPABASE_URL:    DIFFERENT
NEXT_PUBLIC_SUPABASE_ANON_KEY: DIFFERENT
```

**Structural confirmation beyond a bare hash mismatch**: `NEXT_PUBLIC_SUPABASE_URL` is a client-exposed value by design (bundled into every page load), not a secret — safe to compare directly rather than only by hash. The historical (`98bac3f9`) value's Supabase project reference is `kiohthribojmofafmanc`; the current live value's is `vzavkbfnhktwoqvepvui`. **These are two different Supabase projects, not a password reset within the same project** — matching the Aug 19 session's "moved to an entirely new Supabase project" claim with direct, independently-derived evidence.

**Live-functional confirmation**: `npx prisma migrate status` against the current `DATABASE_URL` (run earlier this same update, Update §1/§11) connects successfully and reports "Database schema is up to date!" — the rotated credentials are not just different, they are the genuinely active, working production configuration.

**What this does NOT resolve, honestly**: (1) whether the *old* project (`kiohthribojmofafmanc`) was itself independently decommissioned or had its own keys revoked on Supabase's side is unverifiable from this repository — no access to that project's own dashboard exists here; this stays **NOT VERIFIED**, unchanged from every prior session's honest conclusion on this specific sub-point. (2) Git history itself was never rewritten — `git merge-base --is-ancestor 98bac3f9 HEAD` confirms `98bac3f9` is still a full ancestor of the current `HEAD`, so the old (now-superseded) credential blob remains permanently retrievable by anyone with read access to this repository, despite `ENV_VARIABLES.md`'s own explicit instruction to purge it via `git filter-repo`. This is a real, currently-true, distinct finding — not resolved by the rotation itself, and not previously called out this precisely in this report.

### STATUS: **FIXED AND VERIFIED** — the core F-01 question (are the currently-active credentials still identical to the historically-leaked ones?) is **independently re-verified this update, not carried forward from the disputed Aug 19 claim**. Two narrower sub-questions remain open and are tracked separately: old-project decommission status (**NOT VERIFIED**, unreachable from this environment) and git-history purge (**OPEN, confirmed not done**).

---

## Update §22 — Research Integrity

- **Controlled benchmark:** `benchmarks/eval-summary.json`, timestamp `2026-08-24T07:05:17.691Z` (fresh, today). `totalFigmRules: 25`, **`rulesWithGroundTruth: 8`** (not 25 — the other 17 rule IDs are explicitly listed as `uncoveredRuleIds`). Overall: TP=19, FP=2, FN=0, **precision=0.905, recall=1.0, F1=0.950**, computed by re-running `RuleExecutionEngine.analyzeFile` against `benchmarks/testbed` and diffing against `benchmarks/ground-truth.json` — "No cached or hand-typed confusion matrix is used at any step" (the file's own stated methodology). This is a small (147-LOC), synthetic, hand-authored testbed — **the 95% F1 figure is scoped to 8/25 rules on synthetic fixtures and must never be cited as "95% across all 25 rules" or as generalizing to real-world code.**
- **Real-world benchmark:** `benchmarks/real-world/raw-results/_combined-summary.json`, generated `2026-08-21T10:22:58.094Z`. 5 real public repos (React/Next.js/Angular/Vue/vanilla-JS), 80 files, 4,732 LOC, **114 findings, 0 engine crashes, 0 parse errors**. **No ground truth exists for this dataset — no precision/recall/F1 is reported or should be inferred.** This is real detection-behavior data collection, not a validated accuracy measurement.
- **Independent annotation:** `research/independent-annotation/results/STATUS.md`, last checked `2026-08-24T07:05:48.152Z` (today): *"Independent annotation: PENDING... No submission file was given... No independent annotator has completed the annotation process for this benchmark yet. No raw agreement, Cohen's kappa, or confusion matrix is reported, because none has been computed from real annotation data."* Quoted verbatim, not paraphrased upward.
- **P001–P085 human study:**
  ```
  REAL PARTICIPANT DATA: 2 real accounts (P002, P005), queried live today
  TARGET COHORT:         85
  STATUS:                PLANNED / IN PROGRESS — NOT COMPLETED
  ```
- **No fabrication found** in any of the above this update — every number above was either read directly from a freshly-generated artifact or queried live against the production database, not carried forward from a prior document's narrative.

### STATUS: FIXED AND VERIFIED (no fabrication found; controlled-benchmark scope, real-world no-ground-truth status, and independent-annotation/human-study incompleteness are all honestly disclosed in-repo and independently reconfirmed this update).

---

## Update §23 — QA / Build / Benchmark Results (run fresh today, in this order)

| Command | Result | Scope | Status |
|---|---|---|---|
| `npx tsc --noEmit` | **0 errors** | Whole project, under `strict: true` | PASS |
| `npm test` | **784/784 pass, 71 suites, 0 fail** | Full suite | PASS |
| `npm run build` (`.next` cleared first, no dev server running concurrently) | **Clean, 68/68 routes generated** (32 page + 36 API routes, incl. the 3 new this update: `/admin/profile` page + 2 new layout guards, which aren't separately routed) | Whole app | PASS |
| `benchmarks/eval-summary.json` re-read (not re-run; the file's own timestamp is today) | F1=0.950 on 8/25 rules | Controlled testbed | PASS (scope-limited, disclosed above) |
| `benchmarks/real-world/raw-results/_combined-summary.json` re-read (not re-run; timestamp 2026-08-21) | 114 findings, 0 crashes, 0 parse errors, no ground truth | 5 real repos | PASS (no-ground-truth, disclosed above) |
| Browser verification | See Update §24 below | DEVELOPER + AUDITOR workspace separation | PASS (scope-limited — ADMIN's own experience not driven) |

Full test suite and both builds were run sequentially, dev server stopped before each build, per this project's own established practice.

---

## Update §24 — Live User Acceptance

Driven this update via real browser automation against a local dev server (port 3002; ports 3000/3001 were already occupied by pre-existing processes this session did not touch), configured with this environment's real Supabase/Postgres `.env`.

- **Anonymous → `/`** was not re-driven this update (carried forward from Addendum B's B3, which confirmed it).
- **Register a `DEVELOPER`** (`workspace-dev-test@figm.local`) → landed on `/`, real name shown in the header, "👤 MY WORKSPACE" badge visible, sidebar's ACCOUNT group showed no admin link at all.
- **`DEVELOPER` direct `/admin` access** → server-redirected to `/?forbidden=admin`, confirmed via the resulting URL — the admin shell never rendered.
- **Register an `AUDITOR`** (`workspace-auditor-test@figm.local`) → landed on `/admin` directly (role-based redirect), rendered the new red-accented `AdminSidebar` with the "🛡️ ADMIN / RESEARCH WORKSPACE" badge and all 11 nav items; the underlying `/api/admin/*` endpoints correctly returned "This area requires an ADMIN role account. Your account role is AUDITOR" (client-rendered from a real 403, not a blank page).
- **`AUDITOR` direct `/admin/profile` access** → server-redirected to `/admin` (confirmed via URL).
- **`AUDITOR` direct `/admin/participants/P001` access** → server-redirected to `/admin` (confirmed via URL).
- **Both test accounts deleted from the live production database afterward** via a one-off script using the app's own `RepositoryFactory`/`deleteUser` path (not a raw SQL delete), confirmed by a follow-up `findUserByEmail` returning nothing for both. The dev server was stopped and `.next` cleared afterward; nothing was left running.
- **ADMIN's own experience (login → `/admin` → Users/Participants/Research/Audit tabs → `/admin/profile` rendering) was NOT live-driven this update** — no `ADMIN` credential was available (`ADMIN_BOOTSTRAP_PASSWORD`'s value could not be read by this session; the file it's stored in is correctly gitignored and outside this session's permitted read scope). This is the same gap every prior session in this audit lineage (Aug 21, both Aug 23 addenda) has also explicitly and consistently left open, for the same reason — none of them attempted to obtain or use real admin credentials against a shared production database.

### STATUS: FIXED AND VERIFIED for `DEVELOPER` and `AUDITOR` workspace separation, both roles' negative paths against `/admin/**`, and the new server-side guards — all live-driven this update. **NOT VERIFIED (this update, and every prior session)** for `ADMIN`'s own positive-path live rendering.

---

## Update §25 — Previous Finding Reconciliation

Reconciled against `audit/ULTIMATE-LINE-BY-LINE-FORENSIC-AUDIT.md`'s F-01…F-26 (2026-08-21, the most rigorous forensic pass in this lineage), cross-checked against `audit/STRICT-FULL-PROJECT-AUDIT-REPORT.md`'s AUDIT-* IDs (same date) and `audit/FINAL-PRODUCT-CLOSURE-REPORT.md`'s two addenda (2026-08-23/24), and this update's own fresh re-reads.

| Finding | Previous Status | Current Status | Evidence | Regression? | Remaining Action |
|---|---|---|---|---|---|
| F-01: Supabase credential rotation unresolved | CRITICAL-if-false (forensic audit); *claimed resolved* by an Aug 19 hash-comparison session, predating and not trusted by the forensic audit | **RESOLVED — FIXED AND VERIFIED** (re-verified in a later pass of this same update) | Independently reproduced SHA-256 hash comparison, all 7 checked variables differ from `98bac3f9:.env`; Supabase project-ref itself differs (Update §21a) | **Improvement — closes a CRITICAL-if-false finding that every session since Aug 19 had left unresolved or blocked** | None on the core question. Residual, narrower: old-project decommission status (NOT VERIFIED, unreachable) and git-history purge (OPEN, confirmed not done) — both tracked in Update §21a |
| F-02: no admin account / seeding gap | HIGH, open (forensic audit); PARTIALLY FIXED — safe path existed but not run against production (Addendum A) | **RESOLVED** | Live query today: 2 real `ADMIN` rows exist in production | **Improvement** | None — closed |
| F-03: Cmd+K no focus trap | MEDIUM-HIGH, open | **FIXED AND VERIFIED** | Addendum A fix; re-read directly this update | No | None |
| F-04: `/api/submissions` bypasses `RepositoryFactory`, no `Submission` model | MEDIUM-HIGH, open; later FIXED AND VERIFIED (code) / BLOCKED (live DB) | **FIXED AND VERIFIED, LIVE DATABASE VERIFIED** | Migration deployed, table queryable live (Update §12) | **Improvement** (BLOCKED → resolved) | None |
| F-05: `spawnSync` blocks event loop | MEDIUM, open | **FIXED AND VERIFIED** | Async path measured live this update: 3021ms for 2 concurrent hangs | No | None |
| F-06: sandbox `require` stub escapable | MEDIUM, open | **NOT VERIFIED (this update)** | Not re-read this update | No (carried forward as-is) | Re-verify `profiler-sandbox-runner.cjs` directly |
| F-07: resetToken/resetTokenExpiry Postgres no-op | MEDIUM, open | **FIXED AND VERIFIED** | Re-read directly this update (Update §13) | No | None |
| F-08: `UserDB` redundant Supabase mirror writes | MEDIUM, open | **NOT VERIFIED (this update)** | Not re-read this update | No | Re-read `src/auth/user-db.ts:310-485` |
| F-09: Monaco no accessible label | MEDIUM, open | **FIXED AND VERIFIED (structural)** | Re-read directly this update (Update §20) | No | Live screen-reader verification still outstanding |
| F-10: real-world benchmark narrative stale (268 vs. current findings) | MEDIUM, open | **RAW DATA CURRENT** (114 findings, fresh); **narrative docs (`SUMMARY.md`/`SPOT_CHECK.md`) NOT re-checked this update** | `_combined-summary.json` re-read this update | No | Confirm `SUMMARY.md`/`SPOT_CHECK.md` were regenerated to match; not done this update |
| F-11: `/api/export-dissertation` no rate limit | LOW-MEDIUM, open | **FIXED AND VERIFIED** | Re-read directly this update: `checkRateLimit(ip, 5, 60000)` | No | None |
| F-12: "71 test suites" claim unsupported | LOW, open | **FIXED AND VERIFIED** | `npm test` run fresh this update: 784 tests, 71 suites, all pass | No | None |
| F-13: HeaderBar hardcodes "LOGIN" | LOW, open | **FIXED AND VERIFIED** | Addendum A fix; re-read directly this update and in the prior workspace-separation session | No | None |
| F-14: ~20 pages missing `aria-live`/`role=status` | LOW, open | **NOT VERIFIED (this update)** | Not re-checked | No | Re-audit each page individually |
| F-15: framework selector dropdown non-functional | LOW, open | **RESOLVED per Addendum B** (the dead control was removed, not wired) | `tests/dead-framework-selector.test.ts` passing today; not independently re-read this update | No | None (removal, not a fix, but the finding no longer applies) |
| F-16: React fallback substring misclassification | LOW, open | **NOT VERIFIED (this update)** — a relevant-looking commit (`28ea3ff2`) exists in git log, but was not independently re-confirmed by reading current source this update | Not re-read | No | Re-read `source-parser.ts`'s fallback detection directly |
| F-17: FIGM-NEXT-01 metadata/implementation mismatch | LOW, open | **NOT VERIFIED (this update)** | Not re-checked | No | Re-read rule-catalog metadata vs. implementation |
| F-18: FIGM-REACT-01 namespace-receiver false negative | LOW, open | **NOT VERIFIED (this update)** | Not re-checked | No | Re-read the exclusion logic |
| F-19: syntax-error detector reads unstripped source | LOW, open | **NOT VERIFIED (this update)** | Not re-checked | No | Re-read `source-parser.ts`'s syntax-error path |
| F-20: Guidelines filter buttons no `aria-pressed` | LOW, open | **NOT VERIFIED (this update)** | Not re-checked | No | Re-audit `/guidelines` |
| F-21/F-22: `figm-spec.json` drift risk; tracked `scratch/` files | INFORMATIONAL | **NOT VERIFIED (this update)** | Not re-checked | No | Low priority |
| F-23: `SupabaseAuthService` possible dead code | INFORMATIONAL | **NOT VERIFIED (this update)** | Not re-checked | No | Low priority |
| F-24: `/api/report` GET unauthenticated | INFORMATIONAL | **CONFIRMED STILL TRUE** | Re-read directly this update: no `authenticateUser` call in `app/api/report/route.ts` | No | By-design (serves a public fallback/sample scan); document the rationale explicitly if not already |
| F-25: no network-egress restriction in sandbox | INFORMATIONAL | **NOT VERIFIED (this update)** | Not re-checked | No | Low priority |
| F-26: human study / independent annotation 0 real | PLANNED — NOT COMPLETED | **RECONFIRMED, unchanged** | `STATUS.md` re-read today, still PENDING/0 | No | Ongoing — not a code defect |
| AUDIT-FE-001 (fake Apply Patch button) | Open (strict audit) | **FIXED AND VERIFIED** | Addendum A fix (button removed, honest re-scan link substituted) | No | None |
| AUDIT-AUTH-002 (reset-token leak outside production) | Open, HIGH-risk (strict audit) | **FIXED AND VERIFIED** | Addendum A fix (`NODE_ENV==='test'` AND explicit flag both required); live-reconfirmed in Addendum B's B3 step 10 | No | None |
| AUDIT-DB-001 (participant-provisioning race) | Open (strict audit) | **FIXED AND VERIFIED** | Addendum A fix (create-first, `P2002`-as-success); `tests/participant-provisioning-race.test.ts` passing today | No | None |
| AUDIT-API-001 (inverted/cross-domain-dependent domain scoring) | Open (strict audit) | **FIXED AND VERIFIED** | Addendum A fix; re-run consistency tests this update (Update §19) | No | None |
| AUDIT-CONSIST-001 (VS Code score divergence) | Open (strict audit) | **FIXED AND VERIFIED** | Addendum A fix; re-run consistency tests this update (Update §19) | No | None |
| Live-facing false RLS claim on `/security` | Found and fixed same session (Addendum B) | **FIXED AND VERIFIED, live-reconfirmed in Addendum B's B3 step 6** | Not independently re-rendered this update | No | None |
| Account-deletion 500 on Postgres (FK order bug) | Found and fixed same session (Addendum B) | **FIXED AND VERIFIED, live-reconfirmed in Addendum B's B3 step 11** | Not independently re-rendered this update | No | None |
| **No admin/user workspace separation; no `/admin/profile`; `/admin` page-level guard missing** | Not identified as a distinct finding in any prior audit (all prior sessions focused on the single shared shell as a given) | **FIXED AND VERIFIED** | Built and live-verified this update and the session immediately before it (Update §2, §4–6, §24) | **Improvement — closes a real, previously-unidentified gap** | None |
| **`dissertation-exporter.ts`'s Chapter 3 text overclaims uniform AST parsing including Vue SFC, contradicting its own Chapter 4 text and the real 23/25-genuine/Vue-always-legacy split** | Not identified as a distinct finding in any prior audit | **OPEN — found this update, not fixed** | Direct re-read this update (Update §16) | **New finding — not a regression of a prior fix** | Rewrite `src/docs/dissertation-exporter.ts:81,110` to match the hybrid description already correct at `:95` |

No finding from any prior document was dropped from this table.

---

## Update §26 — Final Scorecard

| Dimension | Status |
|---|---|
| Authentication | PASS |
| User Workspace | PASS |
| User Profile | PASS (cross-user isolation carried from tests, not re-driven live this update) |
| Admin Workspace | PASS |
| Admin Profile | PASS (DEVELOPER/AUDITOR exclusion live-verified; ADMIN's own view not live-driven) |
| RBAC | PASS |
| Data Isolation | PASS (6 routes re-read; remainder test-carried) |
| P001–P085 | PASS (no fabrication; real count = 2/85, honestly reported) |
| Database | PASS (live-verified) |
| Submission Persistence | PASS (live-verified — upgraded from prior BLOCKED status) |
| DynamicProfiler | PASS (live-remeasured) |
| Gemini | PASS WITH MINOR ISSUES (capability verified; production activation not verifiable from this repo) |
| AST | PASS WITH MINOR ISSUES (code correct; `AST_MIGRATION_REPORT.md` understates the real-AST count, `dissertation-exporter.ts` overstates it — both documentation, neither fixed) |
| Rule Engine | PASS |
| Remediation | PASS |
| Accessibility | PASS WITH MINOR ISSUES (structural only; no live AT testing in this lineage, ever) |
| Security | PASS WITH MINOR ISSUES (F-01 now resolved — see Update §21a; F-06/F-08/F-14 and several LOW items remain NOT VERIFIED this update, carried forward as open) |
| QA | PASS |
| Benchmark | PASS WITH MINOR ISSUES (scope honestly disclosed: 8/25 rules controlled, no-ground-truth real-world) |
| Research Integrity | PASS (no fabrication found; incompleteness honestly disclosed) |
| Documentation | NEEDS IMPROVEMENT (`AST_MIGRATION_REPORT.md` stale, understates real-AST count; `dissertation-exporter.ts` overstates it in the opposite direction; F-10's narrative docs not re-checked) |
| Production Readiness | NEEDS MINOR IMPROVEMENT (F-01 now resolved; the sole remaining blocker is ADMIN's own live path never driven in this entire lineage) |

---

## FINAL CURRENT-STATE VERDICT

# NEAR FINAL — not FINAL-READY

**Updated after Update §21a**: this verdict was re-derived a second time within the same update, after F-01 (Supabase credential rotation) was independently re-verified and closed — see Update §21a for the full evidence trail. This is real, measurable progress over every prior session in this lineage (Aug 21 forensic audit, both Aug 23 addenda), each of which left this exact CRITICAL-if-false finding unresolved or blocked. It is not, however, enough to reach FINAL-READY on its own: this report's own governing standard requires the admin workspace to be verified end-to-end, and that specific gap remains open.

### Current Verified Strengths
- **Supabase credential rotation (F-01) is now independently re-verified, not carried forward from a disputed claim** — SHA-256 hash comparison reproduced fresh this update (no plaintext ever read/printed), confirming all of `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL`/`DIRECT_URL`/`JWT_SECRET`/`REFRESH_SECRET`/the public Supabase URL+key differ from the git-history-leaked values, and that the current values are a genuinely different Supabase project (different project-ref, not a same-project password reset), live-functional against production.
- Role-based workspace/profile separation is now real and server-guarded (not just a client-side message) — DEVELOPER and AUDITOR both live-verified against `/admin/**`.
- Submission persistence and admin provisioning, both previously BLOCKED/PARTIALLY-FIXED, are now confirmed live against the real production database.
- Data isolation, forged-role/participantId/qualityScore rejection, password-reset token clearing, refresh-token replay rejection, CSV injection mitigation, and API-key masking/randomness are all directly re-read and correct as of today.
- DynamicProfiler's concurrency fix was re-measured live today (3021ms for 2 concurrent 3s-timeout hangs) — a real number from a real run, not a carried-forward estimate.
- 784/784 tests, 0 `tsc` errors under `strict: true`, clean 68-route build — all run fresh today.
- Research-integrity artifacts (benchmark files, human-study status) are current, honest, and internally consistent — no fabrication found anywhere this update looked.
- The AST real-vs-legacy claim (23/25 rules, at least one framework each; Vue always legacy; ANG-03/04 always legacy) was independently re-derived three separate ways and matches what the prior forensic audit also independently derived — strong cross-session convergence on the correct number.

### Remaining Blockers
1. **`ADMIN`'s own live experience has never been browser-driven in this entire audit lineage** — every session, including this one, has consistently declined to obtain/use real admin credentials against what is apparently a shared production database. This is a deliberate, repeatedly-reaffirmed caution, not an oversight, but it means the positive `ADMIN` path (as opposed to the negative DEVELOPER/AUDITOR paths, both of which ARE live-verified) remains genuinely unverified end-to-end. This is now the **sole** remaining hard blocker to FINAL-READY, per this report's own governing rule.

### Remaining Limitations (not blockers — honestly disclosed, lower-severity, or structurally out of this session's reach)
- **Old Supabase project's independent decommission status** — unverifiable from this repository (would need that project's own dashboard access); the currently-active credentials are confirmed rotated regardless of this sub-question's answer.
- **Git history was never purged** of the old (now-rotated, presumably dead) leaked credential blob (`98bac3f9`), despite `ENV_VARIABLES.md`'s own instruction to do so — a real, currently-true residual finding, distinct from the rotation question itself.
- `AST_MIGRATION_REPORT.md` is stale (documents 16/25 real-AST rules; the actual current count is 23/25) — a documentation fix, not a code defect.
- `src/docs/dissertation-exporter.ts`'s Chapter 3 text overclaims uniform AST parsing including Vue SFC, contradicting its own Chapter 4 text three paragraphs later in the same file (Update §16) — a documentation-generation fix, not a code defect, but newly found and not yet acted on.
- `GEMINI_API_KEY` production-activation status cannot be determined from this repository.
- F-06, F-08, F-14, F-16 through F-25 (mostly LOW/INFORMATIONAL) were not re-verified this update — carried forward as open, not silently dropped.
- No live screen-reader or mobile/tablet-viewport testing exists anywhere in this project's audit history.
- Real-world benchmark narrative docs (`SUMMARY.md`/`SPOT_CHECK.md`) were not re-checked against the current (fresh, consistent) raw data this update.

### Final Verdict
**NEAR FINAL — closer than any prior session in this lineage.** Not FINAL-READY, per this report's own governing standard, solely because the ADMIN workspace's positive live path has never been independently verified end-to-end — every other item that previously co-blocked this verdict (most significantly, F-01's credential-rotation status) has now been independently re-verified and closed with direct evidence in this same update. Closing the one remaining blocker requires either the project owner supplying real `ADMIN` credentials for a live session, or performing that specific walkthrough directly — nothing else in this report stands between the project and FINAL-READY.

---
---

# UPDATE 2 — 2026-08-24: Final User Profile + Admin Profile + Role Separation Forensic Fix Pass

**Role:** Principal Software Architect + Security Engineer + Senior Next.js Engineer + Database Architect + QA Engineer + Accessibility Engineer + UX Engineer.

**Scope**: a targeted, code-modifying pass (not read-only, unlike Update 1 above) focused specifically on `/profile`, `/admin/profile`, and the boundary between them — re-reading current source first, per this pass's own instruction, rather than assuming anything from the addendum above. Smallest safe changes only; nothing outside this scope was touched.

## Phase 1 — Profile Field Visibility Audit (read fresh, not assumed)

| Field | USER sees | ADMIN sees | AUDITOR sees | Source | Sensitive? | Correct? |
|---|---|---|---|---|---|---|
| id, email, fullName, role | own only | own only | own only | `GET /api/profile` → `authenticateUser(request).user.userId`, no other identity path exists on this route | No | Yes |
| apiKey (full value) | own only | own only | own only | same route; only ever the caller's own key, never another user's | Yes (bearer credential) | Yes — by design, owner-only |
| avatarUrl, createdAt, lastLoginAt | own only | own only | own only | same route | No | Yes |
| stats (projectCount/reportCount/averageScore) | own only | own only | own only | same route, `UserRepository.getUserProfile` | No | Yes |
| settings | own only | own only | own only | same route | No | Yes |
| passwordHash, refreshToken | never | never | never | never serialized anywhere in the route's response shape — confirmed by grep and by a new regression test (Phase 15 below) | Yes | Yes |
| All-user list (masked API keys) | 403 | full list, keys masked to last 4 | 403 | `/api/admin/users`, `authorizeRole(['ADMIN'])` | Keys: yes (masked) | Yes |
| P001–P085 matrix, global scan history, rule stats, system health | 403 | full access | 403 | `/api/admin/{participants,scans,rule-stats,system}`, all `authorizeRole(['ADMIN'])` | No | Yes |
| Recent audit-log feed (all users, incl. email/IP) | 403 | full access | full access — **pre-existing, intentional design** (the one admin-area API `authorizeRole` explicitly admits AUDITOR to) | `/api/auth/audit-logs` | Emails/IPs: yes | Yes, unchanged — not invented or altered this pass, per the brief's own "do not invent permissions" rule |
| `JWT_SECRET`/`REFRESH_SECRET`/`DATABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`GEMINI_API_KEY` | never | never | never | grepped fresh across `app/**/profile/**` and `app/**/admin/**` this pass — zero matches | Yes | Yes |

**Trace confirmed end-to-end** (read fresh, all three layout guards + the API route, this pass): `LOGIN → figm_token httpOnly cookie → app/admin/layout.tsx (verifyJWT, role gate) → app/admin/profile/layout.tsx (narrows to ADMIN) → app/admin/profile/page.tsx → GET /api/profile → authenticateUser → UserRepository.getUserProfile(auth.user.userId) → Postgres`. No step in this chain accepts a client-supplied identity at any point.

## Phase 2–4 — Product Model, Profile API Security, Admin Profile Model

**Already correct, verified by fresh re-read, no changes needed**: `/profile` and `/admin/profile` are two presentations of the exact same `User` row (confirmed: both call the identical `GET /api/profile`, no second identity table exists in `prisma/schema.prisma` — 13 models, one `User` model). `app/api/profile/route.ts` GET/PATCH/DELETE all resolve `userId` exclusively from `authenticateUser(request).user.userId` — never from body, query, or URL param; there is no `userId`-accepting parameter on this route for a client to forge in the first place, and `/admin/profile` has no dynamic `[id]` segment for a URL-based impersonation attempt to even target. This matches the phase's own "good" pattern exactly and was true before this pass — confirmed, not assumed.

### STATUS: PASS (pre-existing correct design, freshly re-verified, newly regression-tested — see Phase 15)

## Phase 5–8 — Role-Based Page Protection, Sidebars, Content Separation

**Already correct, verified by fresh re-read of `app/admin/layout.tsx`, `app/admin/profile/layout.tsx`, `app/admin/participants/layout.tsx`, `app/Sidebar.tsx`, `app/AdminSidebar.tsx`**: every `/admin/**` route is gated server-side (not client-side hiding) exactly per the phase's matrix — anonymous → login redirect, `DEVELOPER` → `/?forbidden=admin`, `AUDITOR` → allowed into `/admin` only (redirected off `/admin/profile` and `/admin/participants/**`), `ADMIN` → allowed everywhere. Line-by-line comparison of `app/profile/page.tsx` vs `app/admin/profile/page.tsx` (Phase 8) found no leaked global data in the admin's personal profile — it shows only the signed-in admin's own identity, own recent audit-trail rows (filtered client-side by that admin's own `id`/`email`), and links out to the global surfaces rather than embedding their data directly, exactly as the phase's own "Admin Profile" example specifies.

### STATUS: PASS (unchanged from Update 1's live-verified guard behavior; re-confirmed by fresh source read, no drift found)

## Phase 9 — Sensitive Data Sweep (run fresh this pass)

```
grep -r "passwordHash|refreshToken|JWT_SECRET|REFRESH_SECRET|DATABASE_URL|DIRECT_URL|SUPABASE_SERVICE_ROLE_KEY|GEMINI_API_KEY" app/**/profile/** app/**/admin/**
→ No files found
```

### STATUS: PASS

## Phase 10 — localStorage / Client-Role Attack (live-verified this pass, real browser)

Registered a real `DEVELOPER` account, then forged `localStorage.figm_user.role = 'ADMIN'` via direct JS execution in the live page. Result:
- **Cosmetic effect confirmed**: the dashboard subtitle changed to "(ADMIN ROLE)" and an "Admin Workspace" sidebar link appeared — exactly the expected client-side-only UI reaction, since `Sidebar.tsx`'s admin-link visibility is a `localStorage` read (documented in its own code comment as presentation-only).
- **Security boundary held**: clicking that forged link, and separately direct-navigating to `/admin`, `/admin/profile`, and (implicitly, same guard) `/admin/participants/**`, **all redirected to `/?forbidden=admin`** — the server-side `verifyJWT`-based layout guard ignored the forged client claim entirely and re-derived the real role from the httpOnly cookie every time.

### STATUS: PASS — live-verified, not merely reasoned about

## Phase 11–12 — Two-User Isolation, Role Transition / Session

**Two-user isolation**: covered by the new behavioral test suite (Phase 15 below) using two real accounts against the real route handlers — not mocked. **Session test (live-verified this pass)**: register → `/` → logout → `/profile` correctly redirects to login (session fully revoked) → re-login → `/` (correct workspace restored; the forged `ADMIN` localStorage claim from Phase 10 was overwritten by the real server-issued payload on the fresh login response, not preserved).

### STATUS: PASS

## Phase 13 — Visual / UX Quality (fixed this pass)

Both profile pages previously had no literal page title/subtitle — only the account holder's name as the sole heading. Added exactly the requested copy:
- `/profile`: **h1** "👤 My Profile" / subtitle "Manage your personal account and activity."
- `/admin/profile`: **h1** "🛡️ Admin Profile" / subtitle "Manage your administrative account and security."

The pre-existing name headings on both pages were demoted from `<h1>` to `<h2>` (each page previously had two `<h1>`s once the new title was added — fixed to keep exactly one top-level heading per page, consistent with this codebase's own established accessibility convention for the auth pages).

### STATUS: PASS (fixed this pass)

## Phase 14 — Accessibility (audited fresh, real defects found and fixed on `/profile`)

- **Label/input association**: `/profile`'s password-change form (3 fields), API key field, and theme `<select>` had visually-adjacent `<label>` text with no `htmlFor`/`id` pairing — a real, previously-unflagged defect (a screen reader would not announce the label when the input receives focus). Fixed: all 5 fields now have matching `htmlFor`/`id` pairs. (`/admin/profile`'s password fields already used `aria-label` correctly when built in Update 1 — unaffected.)
- **Delete-account modal**: previously an unlabeled positioned `<div>` — no `role`, no `aria-modal`, no focus trap, no Escape handling, no focus management. Fixed to mirror the established, already-correct pattern from `HeaderBar.tsx`'s Cmd+K modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Tab/Shift+Tab focus trap, Escape closes, focus moves to Cancel on open and returns to the trigger button on close (**live-verified in the browser this pass**, not just read from source: focus landed on Cancel on open, Escape closed the dialog and returned focus to the trigger button, confirmed via direct `document.activeElement` inspection).
- No clickable `<div>`s used as buttons were found on either profile page (all interactive elements are already real `<button>`/`<a>`/form controls).

### STATUS: PASS (real defects found and fixed; live screen-reader testing remains out of scope for this entire project's audit history, unchanged)

## Phase 15 — Regression Tests (added this pass, all passing)

Two files updated/added to `tests/` and registered in `package.json`'s `test` script:
- `tests/accessibility-regression.test.ts`: 2 new `test()` blocks (7 subtests) guarding the Phase 13/14 fixes on both profile pages — single-`<h1>`, required title/subtitle text, `htmlFor`/`id` pairing, and full dialog-semantics presence.
- `tests/profile-ownership-and-admin-separation.test.ts` (new, 5 `test()` blocks / 12 subtests, **real behavioral tests against the actual route handlers with two real database users — no mocked authorization shortcuts**, per this phase's own instruction): a forged `userId`/`email` in the GET query string is ignored; the response never serializes `passwordHash`/`refreshToken`; a forged `userId` in a PATCH body cannot redirect the update to another account (verified against both users' real DB rows before/after); DELETE only ever removes the caller's own account, confirmed the other user's row survives; two real users (A, B) never see each other's data through `/api/profile`; an `ADMIN` account calling `/api/profile` with a forged target `userId` query param still only ever gets their own record — no impersonation path exists.

```
node --import tsx --import ./tests/test-env-setup.mjs --test tests/profile-ownership-and-admin-separation.test.ts
→ tests 12, pass 12, fail 0
```

### STATUS: PASS

## Phase 16 — Live Black-Box Verification (this pass)

| Test | Result |
|---|---|
| A — Anonymous → `/` | Redirected to `/auth/login` — confirmed |
| B — DEVELOPER: register → `/`, "MY WORKSPACE" badge, no admin link, `/profile` shows new title/subtitle/labels correctly rendered, direct `/admin`+`/admin/profile` blocked | All confirmed live |
| Phase 10 localStorage-forgery sub-test | Confirmed live (see Phase 10 above) |
| E — Logout: `/profile` redirects to login | Confirmed live |
| F — Re-login: DEVELOPER restored to `/`, forged role not preserved | Confirmed live |
| C — ADMIN's own experience (`/admin`, `/admin/profile`, Participants, Global Scan History, Research, Audit Logs, Users, System Health) | **NOT VERIFIED this pass either** — same unresolved gap as Update 1: no `ADMIN` credential available to this session. `ADMIN_BOOTSTRAP_PASSWORD`'s value was correctly not read/bypassed. |
| D — Admin → "Back to User Workspace" | **NOT VERIFIED this pass** (blocked by the same C gap — requires an authenticated ADMIN session to reach the admin shell this link lives in) |

Test accounts created for B/E/F were deleted from the live production database afterward via the app's own `RepositoryFactory.deleteUser` path; the dev server and `.next` build output were cleaned up; three orphaned `next dev` process trees left over from earlier in this session (not from any prior unrelated work) were also found consuming ~900MB and stopped, after which the previously-OOM-crashing build completed cleanly.

### STATUS: PASS for everything reachable without ADMIN credentials. NOT VERIFIED for the ADMIN-only positive path — unchanged, same root cause as Update 1.

## Phase 17–18 — Database / P001–P085

Not re-queried this pass (Update 1, run within the same working session, already queried this live and found `2/85` real participants — `P002`, `P005` — 0 submissions, 10 total users). No code in this pass touched the participant matrix, database schema, or seeding logic, so re-querying was not necessary to detect drift; carried forward as current.

### STATUS: PASS (carried forward from Update 1's live query, same session, no intervening writes)

## Phase 19 — Security Closure Re-Test

The 22-item security matrix in Update 1 (§21/§21a above) was not re-derived from scratch this pass — it covers IDOR, role escalation, forged userId/participantId/score, JWT tampering, refresh/reset-token replay, admin authorization, submission ownership, rate limiting, CORS, CSV injection, and DynamicProfiler isolation, none of which this pass's changes (two profile pages' markup/accessibility, one new test file) could plausibly regress. **Profile ownership specifically** (the one item most directly relevant to this pass's scope) **was independently re-tested this pass** with new real-behavioral tests (Phase 15) rather than just carried forward. `npm test` (full suite, run fresh after every change in this pass) confirms zero regressions across all previously-passing security tests.

### STATUS: PASS (profile ownership re-tested fresh; the remaining 21 items carried forward from Update 1's same-session verification, not re-derived independently a second time)

## Phase 20 — Full QA (run fresh, this pass, after all fixes)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm test` | **805/805 pass, 71 suites, 0 fail** (up from 784 — 21 new assertions from this pass's two test files, zero regressions) |
| `npm run build` | Clean, 68/68 routes (first attempt hit a transient Windows build-worker crash — an out-of-memory V8 fatal error, root-caused to the three orphaned `next dev` process trees noted in Phase 16 above, not a code defect; resolved by stopping them, retried clean) |
| Real-world benchmark | Not re-run this pass (no code in scope for this pass touches detection/scanning; Update 1's same-session evidence stands) |

### STATUS: PASS

---

## FINAL USER / ADMIN WORKSPACE VERDICT

### USER PROFILE
**PASS.** Self-only by construction (no forgeable identity parameter exists on the route at all, not merely validated-and-rejected). Never exposes global/admin/other-user data. Title, subtitle, and full label/input association now present. Delete-confirmation dialog now has real focus-trap/Escape/ARIA semantics, live-verified. Newly regression-tested with real behavioral tests (12 passing).

### ADMIN PROFILE
**PASS** for structure, guard boundary, and content separation (no global admin data dumped into the personal admin profile; links out instead, exactly per the brief's own example). **NOT VERIFIED** for the admin's own live rendering — no `ADMIN` credential available to this or any prior session in this project's audit lineage.

### USER ↔ ADMIN SEPARATION
**PASS.** Two distinct server-guarded surfaces, one shared `User` identity, no duplicate identity model. `DEVELOPER`/`AUDITOR` negative paths against every admin surface are live-verified, including under an actively-forged client-side role claim (Phase 10).

### RBAC
**PASS.** `authorizeRole` unchanged and consistently applied; AUDITOR's scope (audit logs only) matches the existing design exactly — nothing invented or widened this pass.

### DATA ISOLATION
**PASS.** Real two-user behavioral tests added this pass for `/api/profile` specifically; broader route coverage carried forward from Update 1's same-session re-read of 6 core routes plus the full passing test suite.

### P001–P085
**PASS** (no fabrication; carried forward from Update 1's same-session live query: 2/85 real, honestly reported — not re-queried a second time in this pass since nothing in scope could have changed it).

### DATABASE
**PASS** (carried forward from Update 1: submissions migration live-deployed, credential rotation independently re-verified same session).

### SECURITY
**PASS.** Profile ownership freshly re-tested with real behavioral tests this pass; the remaining 21-item matrix carried forward from Update 1's same-session verification (not re-derived a second time, since this pass's changes could not plausibly regress it, and the full test suite re-run fresh after every change confirms zero regressions).

### ACCESSIBILITY
**PASS WITH MINOR ISSUES.** Three concrete, previously-unflagged structural defects found and fixed this pass (label association ×5 fields, dialog semantics, duplicate `<h1>`s), all live-verified where feasible and regression-tested. Live screen-reader/AT testing remains out of scope for this entire project's history — unchanged, honestly disclosed, not claimed.

### QA
**PASS.** 805/805 tests, 0 TypeScript errors.

### BUILD
**PASS.** Clean, 68/68 routes — the one build failure encountered this pass was a Windows memory-pressure artifact from leftover process trees, not a code defect, and is documented as such rather than silently omitted.

### FINAL VERDICT

# NEAR FINAL — not FINAL-READY

Every item in this pass's own scope (Phases 1–20 above) reached **PASS**, several of them upgrading from "reasoned/carried-forward" to "live-verified this pass" (Phase 10's localStorage attack, Phase 14's accessibility fixes, Phase 15's real behavioral ownership tests). This does not change the project's overall verdict from Update 1: the sole remaining blocker to FINAL-READY across this entire audit lineage — a real, live-browser-driven `ADMIN` positive-path walkthrough — was not attempted here either, for the same legitimate reason (no credential this session should possess or fabricate). Closing it requires the project owner either supplying real `ADMIN` credentials for a live session or performing that specific walkthrough directly.
