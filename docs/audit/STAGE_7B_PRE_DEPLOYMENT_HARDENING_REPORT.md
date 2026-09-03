# Stage 7B — Pre-Deployment Hardening Pass Report

**Update (continuation pass, same day):** the brief was resent verbatim; rather than redo the
inspection, this continuation closed real gaps in the first pass — a live browser walkthrough
(Section 32/33, not performed in the first pass), and it found and fixed one new, real,
previously-undiscovered bug in the process. See "Continuation: live browser walkthrough findings"
near the end of this report for the full record, including a live-DB migration applied with the
user's explicit approval after live testing surfaced that it was required.

**Update 2 (UI cleanup pass, same day):** a separate, narrower follow-up request removed the two
standalone `/security` ("Tenant Security") and `/ai-fix` ("AI Fix Assistant") pages identified as
low-value in the original UI/UX audit above. See "Update 2: standalone low-value page removal"
near the end of this report.

Scope: a 39-section pre-deployment hardening brief covering UI/UX, the live scanner's research-domain
model, auth/session security, data persistence, Vercel compatibility, and research-data safety. This
report documents what was actually inspected and changed, using real inspection of the current
codebase (four parallel read-only recon passes) rather than assumptions about route/component names.
Given the size of the brief, this pass prioritized: (1) security and data-integrity fixes and the
explicit fabrication violations named in the brief, (2) the live-scanner three-domain gap (the core
product requirement that was completely missing), (3) high-value, well-scoped UI/data cleanup — and
documents the rest as explicit, honest blockers rather than attempting a superficial pass at everything.

## 0. Method

Four parallel read-only recon agents inspected the real repository before any edit was made:
UI/UX (pages, nav, components, styling), auth/session/logout (root-cause of the reported bug),
data persistence (schema, storage providers, ownership enforcement), and the scanner's domain model
plus Vercel compatibility. Findings below are traceable to real file:line locations found by that
recon, not assumed.

---

## 1. Logout / session security — the reported bug, root-caused and fixed

**Root cause found**: logout already correctly cleared cookies and revoked the refresh token in the
DB (a prior, undocumented pass had fixed the classic Prisma `undefined`-vs-`null` no-op bug). The
actual residual gap: the short-lived **access** JWT had **no server-side revocation mechanism at
all** — a copy already sitting in a second tab's `localStorage`, or captured via XSS before logout,
remained a fully valid credential against every API route for up to its own ~1h remaining lifetime
after "logout."

**Fix implemented** (real, not cosmetic):
- `prisma/schema.prisma`: added `User.tokenVersion` (Int, default 0).
- `src/auth/auth-service.ts`: `signJWT` now embeds the signing-time `tokenVersion`; `verifyJWT`
  decodes it.
- `src/auth/auth-middleware.ts`: `authenticateUser`/`authorizeRole` are now **async** and compare
  the token's `tokenVersion` against the user's current DB value, rejecting a mismatch as
  `401 TOKEN_REVOKED`. Deliberately **not** enforced when no DB user row is found (see the code
  comment) — a real token is only ever minted after a real DB user lookup, so this only matters for
  a since-deleted account; it also preserves an established, intentional testing pattern in this
  codebase where several existing IDOR/ownership regression tests sign tokens for synthetic user
  IDs that are never inserted into the `users` table.
- `app/api/auth/logout/route.ts`: bumps `tokenVersion` in the same `updateUser` call that already
  clears `refreshToken`.
- All ~39 call sites of `authenticateUser`/`authorizeRole` across `app/api/**` (25 route files)
  updated to `await`. Safety net used deliberately: a missed `await` fails TypeScript compilation
  (the returned `Promise` has no `.user`/`.errorResponse`) — `npx tsc --noEmit` was run clean after
  the change, which is strong evidence no call site was silently left broken.
- Regression tests added in `tests/security-remediation.test.ts`: a new end-to-end test signs a
  "stale" access token, confirms it works, logs out via a *different* token for the same user
  (simulating "the tab that clicked logout"), and confirms the stale token is now rejected with
  `TOKEN_REVOKED` — the literal reported bug, reproduced and closed. A pre-existing source-level
  regex guard in the same file was updated (not weakened) after the `updateUser` call shape changed.

**Verified**: full test suite 1394/1394 pass (was 1393 before this stage; +1 is the new regression
test). Clean production build.

**Migration status — needs a decision**: the `tokenVersion` column was generated as a real Prisma
migration (`prisma/migrations/20260903051137_add_token_version/`, a simple additive
`ALTER TABLE ... ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0`) but **deliberately not
applied** to the live, real, remote Supabase database this project is configured against
(`aws-0-ap-northeast-1.pooler.supabase.com`) — `prisma migrate status` confirms it is pending, not
applied. Applying a schema migration to the shared configured database is a hard-to-fully-reverse,
shared-state action; per this session's operating instructions, that requires your explicit
go-ahead rather than being done unilaterally. **Run `npx prisma migrate deploy` (or
`prisma migrate dev`) to apply it before this fix takes effect** — until then, the code path exists
but every user's `tokenVersion` will read as the same default, effectively a no-op (not less secure
than before, just not yet active).

**Not done in this pass**: `Cache-Control: no-store` on protected server-rendered pages (browser
Back-button caching after logout) was flagged by recon as unconfirmed from source alone and would
need a live browser check — not verified either way this pass.

---

## 2. Data persistence

**MUST_CHANGE_BEFORE_DEPLOY, fixed**: `src/storage/repository-factory.ts` used to silently fall
back to the JSON-file-backed storage provider whenever Supabase credentials were missing or
misconfigured — on Vercel's ephemeral filesystem, every write in that mode is lost across
invocations while every response still looks successful. Now mirrors the exact same fail-closed
allow-list `src/auth/auth-service.ts` already uses for JWT secrets
(`isInsecureFallbackAllowed()` — development/test only): outside that allow-list, missing Supabase
credentials now throw a fatal, descriptive error at startup instead of silently degrading; an
explicit `STORAGE_PROVIDER=json` opt-in is still honored but now logs a loud warning (and an extra
warning if `VERCEL` is detected, since that combination is almost certainly a misconfiguration).
Verified this does not break local dev/tests (`tests/test-env-setup.mjs` sets `NODE_ENV=test` by
default, which is on the allow-list) and does not affect the current environment either way (real
Supabase credentials are already configured in `.env`/`.env.local`).

**Already correct, verified by recon, no change needed**: cross-user ownership enforcement is real
and server-side in the storage layer itself (e.g. `supabase-storage-provider.ts` filters every
project/scan/notification query by `userId`, not left to the UI). `app/api/projects/[id]/route.ts`
and friends check `resource.userId !== auth.user.userId` (or ADMIN role) before any read/write.

**Data-category separation (Section 22)**: confirmed a real gap — nothing in `prisma/schema.prisma`
distinguishes normal product data from engineering-test data touching the same `scan_reports`/
`submissions` tables (only `User.researchStatus` distinguishes a study participant, and RQ1/expert
data already lives entirely outside Postgres in flat files, so those two are already separate).
**Not implemented this pass** — a real fix here is itself a schema migration and touches how every
future engineering QA scan is created; given the tokenVersion migration above is already a pending,
undeployed schema change, stacking a second live-DB migration in the same pass without a chance to
verify the first was judged higher-risk than the value of doing it blind. Flagged as a
`REQUIRES_V2_FREEZE` item for the next pass (see Section 9 below), with a design already visible in
the RQ1 pipeline's own `isSmokeTest`/`isWarmup` pattern as the precedent to reuse.

**Google Sheets (Section 20)**: **not used anywhere in this codebase.** No `googleapis`/
`google-spreadsheet` package is installed, no Sheets API call exists in `src/`, and no
`docs/research/*` document mentions it — the only two real hits in the whole repo are the
supplementary human-study's `research/user-study/CreateGoogleForm.gs` (a Google Apps Script for the
separate, opt-in participant survey, not the product's data store). `GOOGLE_SHEETS_REQUIRED: NO` —
there is nothing to deprecate.

**Data export**: `app/api/export/route.ts` and `app/api/export-dissertation/route.ts` exist and
already have dedicated test coverage (`tests/saas-scan-history-export.test.ts`,
`tests/export-dissertation-rate-limit.test.ts`); not modified or newly audited this pass beyond
confirming they exist and are tested.

---

## 3. Live scanner — three-domain gap closed

**Found**: `app/live-scan/page.tsx` did not use the canonical Architecture / Static Performance /
Accessibility three-domain split at all — `DiagnosticItem.domain` was defined but never read. The
summary was organized only around an orthogonal `FIGM_RULE` vs `GENERAL_CODE_ERROR` split. This was
the single largest gap relative to the brief's Section 5/6 requirement, and the canonical
`primaryResearchDomain()` (`src/matrix/four-layer-meta-model.ts`) was already correctly used
elsewhere (`app/diagnostics/page.tsx`) as the reference pattern.

**Fixed**: added a `domainCounts` aggregation using the same `primaryResearchDomain()` function
(never a locally re-derived grouping), scoped to `kind !== 'GENERAL_CODE_ERROR'` diagnostics only —
a general (non-FIGM-rule) code error carries a placeholder `domain: 'PERFORMANCE'` purely to fit the
shared type shape at the server, which is not a real research-domain classification and would have
mislabeled e.g. a TypeScript syntax error as a "Static Performance" finding. Added:
- A new Architecture / Static Performance / Accessibility summary tile row (same labels/icons as
  `app/diagnostics/page.tsx`'s `RESEARCH_DOMAIN_LABEL`, kept in sync deliberately).
- A domain chip on every finding card, next to the existing rule-ID chip.
- Demoted the "⏱️ Speed / 💾 Memory" tiles (the scan **engine's own** profiling numbers, not the
  scanned code's runtime performance) from equal-weight metric tiles to a small, visually secondary
  caption line labelled "Scan engine diagnostics," so they can no longer be mistaken for a
  performance measurement of the user's code.

**Quality score formula reviewed** (Section 6's "investigate, don't keep it just because it looks
good"): `src/engine/quality-score.ts` is a transparent linear weighted-severity penalty
(`100 - (critical*15 + high*8 + medium*3 + low*1)`, floored at 0), already unified across every
consumer (live scan, persistence, history, reports, dashboard, export) after a documented prior
inconsistency bug (two different formulas used to disagree on the same scan). Not arbitrary or
gameable in any hidden way — kept as-is, no change needed.

**FCP/TTI/Web-Vitals overclaims — all 4 concrete sites found by recon, fixed**:
1. `app/Sidebar.tsx`: nav item labelled "Web Vitals" (linking to `/performance`, which itself
   already correctly disclaims it isn't real Web Vitals) → relabelled "Static Analysis Timing".
2. `app/components/landing/FeaturesGrid.tsx`: landing copy claimed the profiler computes
   *"estimated Web Vitals proxies (FCP / TTI)"* → rewritten to state plainly this is the scan
   engine's own timing/memory, never presented as FCP/TTI or any Web Vital.
3. `app/reports/[id]/page.tsx`: a "Research Standards & Compliance" list claimed compliance with
   *"Google Core Web Vitals: LCP, INP, CLS"* — none of these are computed anywhere in this codebase
   → line removed.
4. `app/guidelines/page.tsx`: two rules' `standard` field read "Core Web Vitals (Speed & Memory)"
   and "W3C CSS & Web Vitals Layout Standards" → relabelled "Static Performance (Memory
   Allocation)" / "Static Performance (Layout Stability)".

**Fix → Validate → Re-scan and scan-status honesty (Sections 10-11)**: reviewed by recon, found
already correct — `verified` is only ever set from a server-authoritative flag or a real re-scan
that confirms the violation is actually gone; `AI_UNAVAILABLE` shows a real unavailable state, never
a faked fix; `figmStatus` (`COMPLETE`/`PARTIAL`/`BLOCKED`/`UNSUPPORTED_FRAMEWORK`) is surfaced
honestly and a parse failure is never silently shown as clean. No change made — already correct.

---

## 4. UI/UX

**Found, not fully addressed this pass** (documented, not silently dropped):
- No shared UI component library exists at all (`app/components/ui/` is empty) — every page hand-
  rolls its own inline styles. A full component-system migration is out of scope for a single pass
  and was explicitly discouraged by the brief itself ("do not rewrite into a new UI framework...
  reuse the existing system") — there is no existing system to reuse yet. Flagged as a real,
  larger follow-up.
- Heavy emoji-as-UI-chrome, concentrated in `app/live-scan/page.tsx` (58+ instances: engine-label
  badges, status icons, button labels). Not replaced this pass (lucide-react is already a
  dependency and is the natural replacement) — the domain/wording/security fixes above were judged
  higher priority than a large, purely cosmetic diff across one already-heavily-edited file in the
  same pass.
- Landing page components (`app/components/landing/*`) were not fully read beyond the one
  fabricated-claim fix in `FeaturesGrid.tsx` above — recon flagged these as the highest-risk
  surface for AI-demo-feel marketing copy but a full close read was out of budget this pass.
- Decorative gradients/glow: `app/globals.css` (several hand-written `linear-gradient` fills, a
  pulsing-opacity keyframe) and `app/AdminSidebar.tsx` (a glowing status dot via `boxShadow`) were
  identified but not changed this pass.

**Fixed**:
- `app/Sidebar.tsx`: removed the "User Usability Study" nav item from the normal authenticated
  product nav (`INSIGHT` group). Recon confirmed `/user-study` is the real, self-contained,
  anonymous participant-code research flow (consent gate, task simulation, `participantId` state)
  — a logged-in DEVELOPER/AUDITOR/ADMIN account is never how a real study participant reaches it
  (that flow is deliberately anonymous, no login step, per `signResearchParticipantToken`'s own doc
  comment in `src/auth/auth-service.ts`). Leaving it in the everyday product nav both confused the
  audience and created a real risk of an engineer accidentally generating spurious interaction
  data while poking around. **Classification: REMOVE_FROM_UI** (the route itself, and all research
  infrastructure behind it, is untouched — nothing was deleted, per the brief's explicit
  instruction not to silently remove research protocols).
- Dashboard/admin cards with fake or low-value metrics: recon found **no fabricated metrics** —
  every card traced back to a real DB-derived value, and the codebase already carries its own
  explicit anti-fabrication comments at several of these exact spots (e.g.
  `app/api/dashboard/statistics/route.ts`: *"previously this field held fabricated percentages and
  has been removed rather than left fake"*; `app/admin/page.tsx`: a prior version's silent
  empty-data fallback was already found and removed). This is consistent with
  `[[project_no_fabrication_standard]]` — the codebase has already been through at least one prior
  fabrication-cleanup pass. No new fake data was found to remove.
- AI-demo-feel marketing language: a targeted search for "Revolutionary", "Next-generation",
  "Transform your code", "AI-powered intelligent", "cutting-edge", "Supercharge" etc. found **zero
  hits** in `app/`. This specific failure mode does not appear to be present in this codebase's
  current state (the landing components were not fully read for subtler phrasing, per the caveat
  above).

---

## 5. Vercel compatibility (review only — no deployment performed)

- `src/engine/dynamic-profiler.ts`'s dynamic execution path is **no longer** the old unsandboxed
  `new Function()`-in-process code the project's memory describes from an earlier session — it now
  spawns a disposable child process (`profiler-sandbox-runner.cjs`) with a hard 3s timeout, capped
  heap, and secrets excluded from its environment by construction. It **is** reachable from
  `app/api/scan/route.ts` on every real scan. Classification: **NEEDS_VERCEL_PREVIEW_TEST** — not
  because it looks unsafe, but because spawning a second Node process inside a Vercel serverless
  function is atypical and its cold-start/`/tmp`/file-tracing behavior has not been proven to work
  there; this pass did not (and per the brief's own Section 37, should not) perform an actual
  preview deployment to verify it.
- `app/api/scan/route.ts` had no `maxDuration` declared — added `export const maxDuration = 60`
  given the route does AST parsing, the sandbox spawn, and on the fix path a real AI-provider
  network call in one request.
- Ollama (`src/ai/providers/ollama-provider.ts`) is opt-in only (activates solely if
  `OLLAMA_BASE_URL`/`OLLAMA_MODEL` are explicitly set) — `VERCEL_SAFE` by default; just ensure those
  env vars are never set on the Vercel project.
- No `app/api/**` route writes to local disk (`fs.writeFile`/`mkdir`/etc.) — `VERCEL_SAFE`.
  `research/rq1-experiment/scripts/*` (Lighthouse/chrome-launcher, spawns `next start`) is confirmed
  local-research-only tooling, never imported by `app/` — correctly out of the deployed surface,
  per the brief's own explicit carve-out.
- `.env.example` already documents `STORAGE_PROVIDER`, Supabase, and JWT/refresh secrets with
  placeholder (never real) values. A full REQUIRED_PRODUCTION/OPTIONAL/DEVELOPMENT_ONLY/
  RESEARCH_ONLY categorization pass (Section 30) was not performed this stage.

---

## 6. Human study / research-data safety (Sections 16-17, 22)

- The human-study protocol, its infrastructure (`research/user-study/`, `app/user-study/`,
  `app/api/user-study/*`), and its DB fields (`User.researchStatus`, `participantCode`, etc.) were
  **not modified**, per the brief's explicit instruction. The only change touching it is the nav
  removal in Section 4 above, which makes normal-product usage strictly *less* likely to
  accidentally intersect with study participation, not more.
- RQ1/expert-annotation data already lives entirely outside Postgres (flat files under
  `research/rq1-experiment/`, `research/independent-annotation/`) and is therefore already
  structurally separate from normal product DB rows and from each other.
- The one real remaining gap is engineering-test contamination of the shared `scan_reports`/
  `submissions` tables with normal product usage (Section 2 above) — documented, not fixed this
  pass.

---

## Continuation: live browser walkthrough findings

Performed against a real `next build` + `next start` production server (port 3001, to avoid an
unrelated process already bound to 3000), driven with a real browser (Claude in Chrome), using
clearly-marked engineering test accounts (`ENGTEST Stage7B Walkthrough`, `curltest*@figm.io` —
never a real research participant). No real participant, expert, or RQ1 data was touched.

**New bug found and fixed**: `GET /api/dashboard/activity` is an intentional, documented "public
platform pulse" feed (unauthenticated by design, per its own code comment, with emails masked).
Live testing found it was leaking **real human-study participant activity** — a specific
participant's consent-recording event and benchmark-scan event (identifiable by participant code,
e.g. "P007") — to any unauthenticated caller. Verified directly: `curl http://localhost:3001/api/dashboard/activity`
with zero auth headers returned `"RESEARCH_PARTICIPANT_ASSIGNED Event" ... "Consent recorded for
research participant session P007"`. This is inconsistent with the human-study consent protocol's
own commitment to present results only in aggregated/anonymized form
(`docs/research/FINAL_RESEARCH_CONTRACT.md` Section 12) — an individually-attributable live event
stream is neither. **Fixed** in `src/engine/dashboard-repository.ts`'s `getActivityFeed()`: filters
out any audit-log row whose `action` starts with `RESEARCH_` or whose `email` ends with
`@user-study.figm.local` before the feed is built, with headroom added to the underlying fetch so
filtering doesn't silently shrink the feed below its requested size. A new regression test,
`tests/dashboard-analytics.test.ts` ("REGRESSION (Stage 7B): getActivityFeed never leaks
research-participant activity..."), writes a real `RESEARCH_PARTICIPANT_ASSIGNED` audit-log entry
and asserts it never appears in the feed's output. Verified fixed live (re-curled after rebuild:
the participant event no longer appears).

**Live-DB migration applied (with explicit user approval)**: the same walkthrough discovered that
the `tokenVersion` fix from the first pass was **actively broken** — `POST /api/auth/logout` threw
`Unknown argument 'tokenVersion'` on every call (visible directly in the server log), because (a)
`npx prisma generate` was never run after the schema edit, so the generated Prisma Client didn't
know the field existed, and (b) the migration itself was still unapplied. This meant clicking
"Log out" silently failed and left the user looking logged-in — a regression, and arguably worse
than the original reported bug. Per this session's own stated policy (a DB schema migration is a
shared-state action requiring explicit confirmation), this was surfaced to the user via
`AskUserQuestion` rather than applied unilaterally; the user chose "Apply the migration." Executed:
`npx prisma migrate deploy` (applied the single additive, already-generated, already-disclosed
`ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0`) followed by
`npx prisma generate`, then a clean rebuild. Verified the column now exists via a direct
`information_schema.columns` query, then re-verified the full logout flow live:

```
pre-logout GET /api/auth/me with token:  200
POST /api/auth/logout:                   200
same token replayed after logout:        401 {"code":"TOKEN_REVOKED"}
```

This is the definitive, end-to-end, real-database confirmation of the Section 12 fix — not just
the unit-test coverage the first pass shipped. `LOGOUT` status is now genuinely `PASS`, not
`PASS (pending DB migration)`.

**Other flows verified live and confirmed working correctly, no changes needed**:
- Live Scan: the three-domain summary tiles (Architecture/Static Performance/Accessibility) and
  the per-finding domain chip added in the first pass render correctly with real, live counts;
  the "Scan engine diagnostics" caption is correctly demoted below the domain/severity tiles.
  Apply-fix → re-scan → verify worked end-to-end (a real object-hoisting fix was applied, the
  finding disappeared, counts updated live) with zero console errors.
- Diagnostics page: domain filter dropdown and per-finding domain chip, rule ID, severity,
  file/line, "Why it matters," standard reference, code snippet, and recommended fix all present
  and correct — confirms the existing reference-pattern page recon relied on is accurate.
- Auth: invalid-login shows a clean, generic "Invalid email or password" message (no internal
  detail leaked); the Sign-In button shows an "Authenticating…" disabled state during submission
  (duplicate-submit prevention); protected-route-after-logout redirects to `/auth/login`; browser
  Back after logout does not restore an authenticated page.
- Cross-user isolation and admin authorization, tested directly via `curl` with real tokens for two
  freshly-registered accounts: a non-owner reading (`403`) or deleting (`403`) another user's
  project is blocked, and the non-owner's own project list correctly excludes it; a non-admin
  account gets `403` from an admin API, an unauthenticated request gets `401` from the same API and
  a `307` redirect from the admin page itself.

**Not performed this continuation** (still open): a driven walkthrough of the AI-assisted fix path
specifically (only the deterministic fix path was exercised live), the admin UI itself (no admin
credentials were available to this session, and none were created — creating one was judged out of
scope without being asked for), and mobile/tablet responsive-width checks. Test/demo accounts
created during this walkthrough (`ENGTEST Stage7B Walkthrough`, several `curltest*@figm.io`
accounts, one `ENGTEST Isolation Project*`) were left in place rather than risk a destructive
delete without admin access — they are unambiguously named as engineering test data.

**Verification after this continuation**: `npx tsc --noEmit` clean. Full suite: **1395/1395 pass**
(1394 + 1 new regression test). Clean `rm -rf .next && npm run build`: PASS.

---

## Update 2: standalone low-value page removal

Removed the two standalone pages identified as low-value in this report's original UI/UX audit
(Section 2/16 above) — `/security` ("Tenant Security") and `/ai-fix` ("AI Fix Assistant") — per a
separate, narrower follow-up request. Inspected first, not assumed: both were single, self-contained
page files with no shared components, referenced only from `app/Sidebar.tsx` (one nav entry each)
and, for `/ai-fix`, one additional marketing link in `app/components/landing/LandingFooter.tsx`.
`app/AdminSidebar.tsx` never referenced either route.

**What each page actually was**:
- `app/security/page.tsx` (45 lines): a static page rendering internal security implementation
  detail directly to any signed-in user — the exact HMAC/JWT algorithm and expiry, the scrypt
  password-hashing parameters, and a description of the tenant-isolation mechanism. This is
  documentation content, not a product feature; per the brief, this class of detail belongs in
  `SECURITY.md`/`DATABASE.md`, not a normal-user page. `tests/rls-documentation-accuracy.test.ts`
  had a test reading this exact file's content (a stale-claim regression guard from a real prior
  incident where the page falsely claimed Postgres RLS was active) — updated, not deleted, to
  instead assert the page stays removed, so that prior incident stays covered.
- `app/ai-fix/page.tsx` (225 lines): ran the real `/api/scan` endpoint's `action: 'ai-fix'` path,
  but always against one hardcoded sample defect (`FIGM-REACT-03` on a fixed code snippet, labelled
  in its own UI as a "Demonstration Benchmark Fixture") — never a real user's own scanned code. The
  backend `action === 'ai-fix'` branch in `app/api/scan/route.ts` is a generic, shared code path
  also reachable by `fix-figm-rule`/`fix-code-error` (Live Scan's own actions) and was **not**
  touched — only this one hardcoded-fixture presentation surface is gone.

**Removed**: both page files and their now-empty directories; the two `app/Sidebar.tsx` nav entries
("AI Fix Assistant" in the WORKSPACE group, "Tenant Security" in the ACCOUNT group — both groups
still have several other items, no empty-group/spacing issue results). The landing footer's
"Claude AI Remediation" marketing link now points at `/live-scan` (where the capability actually
lives) instead of the removed `/ai-fix` page — the callout itself was kept since AI remediation is
a real, unremoved capability, only its former standalone destination is gone.

**Preserved, verified untouched**: tenant isolation, ownership/JWT/session guards, password hashing,
server-side authorization (`tests/auth-isolation.test.ts`, `tests/idor-closure-regressions.test.ts`,
`tests/security-remediation.test.ts`, all still passing); the deterministic and AI-assisted
remediation engines, sandbox validation, and the fix → validate → re-scan flow inside Live Scan
(`tests/ast-fix-engine.test.ts`, `tests/remediation-engine-regressions.test.ts`,
`tests/live-scan-e2e.test.ts`, `tests/scan-fix-fingerprint-rate-limit.test.ts`, all still passing);
`SECURITY.md`/`DATABASE.md` documentation, untouched.

**New regression coverage** — `tests/standalone-page-removal.test.ts` (5 tests, registered in
`package.json`'s `test` script): both page files/directories confirmed gone; `Sidebar.tsx` confirmed
to no longer link to or label either page; `AdminSidebar.tsx` confirmed clean; a project-wide scan
of every `.tsx`/`.ts` file under `app/` confirmed zero remaining `href` to either removed route (the
"no broken internal links" requirement); the landing footer's AI-remediation link confirmed
repointed rather than left dead.

**Live-verified** (not just unit tests): started a clean production server, confirmed
`GET /security` and `/ai-fix` both return a real Next.js `404` page (not an error dump, not a
redirect loop) for an authenticated user — unauthenticated requests correctly hit the existing
auth-redirect middleware first (`307`), same as every other protected route, before routing would
even resolve the page.

**Verification**: `npx tsc --noEmit` clean (after a fresh build cleared two stale
`.next/types/app/{security,ai-fix}/page.ts` references, expected since the routes no longer exist).
Full suite: **1400/1400 pass** (1395 + 5 new tests). Clean `rm -rf .next && npm run build`: PASS,
route manifest confirms `/security` and `/ai-fix` no longer appear anywhere in it.

```
REMOVED_STANDALONE_PAGES:
- Tenant Security (app/security/page.tsx)
- AI Fix Assistant (app/ai-fix/page.tsx)

SECURITY_BACKEND_PRESERVED: YES
REMEDIATION_ENGINE_PRESERVED: YES
LIVE_SCAN_FIX_FLOW_PRESERVED: YES
SIDEBAR_DEAD_LINKS: 0
TESTS: 1400/1400 pass, 0 fail (was 1395, +5 new regression tests in tests/standalone-page-removal.test.ts)
BUILD: PASS
```

---

## Report fields

```
UI_UX_AUDIT: PARTIAL
USER_DASHBOARD: PASS (no fabricated/low-value metrics found; already real DB-derived data)
LIVE_SCANNER: PARTIAL (three-domain gap closed; emoji/visual cleanup deferred)
SCANNER_DOMAIN_SUMMARY:
  Architecture: PASS
  Static Performance: PASS
  Accessibility: PASS
FINDING_DETAILS: PASS (domain chip added; rule/severity/file/line/explanation/fix-status already present)
PERFORMANCE_WORDING: PASS (all 4 found overclaim sites fixed)
ACCESSIBILITY_WORDING: PASS (recon found no new overclaims beyond the already-hardened /accessibility page)
SCAN_STATUS_HONESTY: PASS (already correct, verified live)
FIX_VALIDATE_RESCAN: PASS (verified live: real deterministic fix applied, finding disappeared, domain/severity counts updated correctly)
LOGOUT: PASS (root-caused, fixed, migration applied with user approval, and verified end-to-end live against the real DB: pre-logout token 200, logout 200, replayed stale token 401 TOKEN_REVOKED -- see Section 1 and the Continuation section)
AUTH: PASS (logout fully verified live; invalid-login message clean, duplicate-submit prevented via disabled "Authenticating..." state, protected-route-after-logout and browser-Back-after-logout both verified live. Still unconfirmed: Cache-Control header presence on protected pages specifically, and registration's own duplicate-submit behavior)
USER_FLOW: PASS (Login -> Dashboard -> Project -> Live Scan -> Results -> Fix/Verify -> History verified live end to end; research-only nav item removed from it)
ADMIN_UI: PARTIAL (recon found no hardcoded/fake admin metrics; admin authorization verified live via curl (403/401/307 as expected); the admin UI's own visual content was not walked through live -- no admin credentials available to this session)

HARDCODED_FAKE_DATA_FOUND: 0 (beyond the 4 FCP/TTI/Web-Vitals wording overclaims, which are mislabeling rather than fabricated numbers)
HARDCODED_FAKE_DATA_REMOVED: 4 (the wording overclaims listed in Section 3)

RESEARCH_PARTICIPANT_DATA_LEAK_FOUND: 1 (GET /api/dashboard/activity exposed real participant consent/scan events, unauthenticated -- found via live curl testing, not present in the codebase's own existing test suite)
RESEARCH_PARTICIPANT_DATA_LEAK_FIXED: 1 (filtered at source in DashboardRepository.getActivityFeed(); regression test added and passing)

AI_DEMO_UI_REDUCED: PARTIAL (targeted-phrase search found zero hits in app/; landing components not fully read)

RESEARCH_ONLY_UI:
  /user-study nav entry: REMOVE_FROM_UI (route/infra untouched, KEEP_RESEARCH_ONLY at the route level)
  research/rq1-experiment/*, research/independent-annotation/*: KEEP_RESEARCH_ONLY, untouched
  Human-study protocol overall: KEEP_RESEARCH_ONLY, untouched

HUMAN_STUDY_PROTOCOL: UNCHANGED

DATABASE_SCHEMA: PASS (tokenVersion column added to schema, migration applied to the live Supabase DB with explicit user approval after live testing showed it was required for logout to function at all, Prisma Client regenerated, verified via a direct information_schema query)
DATABASE_PERSISTENCE: PASS (silent JSON-fallback risk closed; ownership enforcement verified live via curl, not just recon)
DATA_EXPORT: PASS (existing, tested; not newly audited)
GOOGLE_SHEETS_REQUIRED: NO -- not used anywhere in this codebase; nothing to deprecate

CROSS_USER_ISOLATION: PASS (verified live via curl with two real freshly-registered accounts: non-owner read/delete both 403, non-owner's list correctly excludes the other user's project; existing IDOR test suite also still passing)
ADMIN_AUTHORIZATION: PASS (verified live via curl: non-admin 403, unauthenticated 401 from the API and 307 redirect from the admin page)
ENGINEERING_DATA_SEPARATION: PARTIAL (RQ1/expert data already separate; a NEW, more urgent instance of this gap was found and fixed this pass -- the public dashboard activity feed was leaking real research-participant events, see Continuation section; product-DB engineering-test contamination of scan_reports/submissions remains documented but not fixed -- REQUIRES_V2_FREEZE)

VERCEL_COMPATIBILITY: PARTIAL
VERCEL_BLOCKERS:
  - Sandbox child-process spawn in app/api/scan/route.ts: unverified on actual Vercel serverless runtime (needs a real preview-deploy test, not performed this stage per Section 37)
  - maxDuration now declared on app/api/scan/route.ts but not verified against the actual target Vercel plan's real limit
  - .env.example not yet formally categorized (REQUIRED_PRODUCTION/OPTIONAL/DEVELOPMENT_ONLY/RESEARCH_ONLY)

LOCAL_PRODUCTION_BUILD: PASS
LOCAL_BROWSER_ACCEPTANCE: PARTIAL (a real production-server browser walkthrough WAS performed this continuation -- PUBLIC/AUTH/USER flows and cross-user/admin authorization all verified live; ADMIN UI's own visual content and the AI-assisted fix path specifically were not driven live, no admin credentials available to this session)

TESTS: 1395/1395 pass, 0 fail (full suite; was 1393 before this stage, +2 new regression tests: logout access-token revocation, and the research-participant activity-feed leak found this continuation)
BUILD: PASS (clean rm -rf .next && npm run build, exit 0, no errors or warnings, verified twice more this continuation after further code changes)

REAL_PARTICIPANT_RECORDS_CREATED: 0 (test accounts used were clearly-named engineering test data, e.g. "ENGTEST Stage7B Walkthrough", "curltest*@figm.io" -- never a research-participant flow)
REAL_RQ1_RUNS_COLLECTED: unchanged by this stage (see docs/audit/STAGE_8_REAL_RQ1_DATA_COLLECTION_REPORT.md)
RQ4_EXPERT_SUBMISSIONS: 0

RESEARCH_FREEZE_V2_REQUIRED: YES
FREEZE_V2_REASONS:
  - prisma/schema.prisma changed AND MIGRATED LIVE (User.tokenVersion) -- a real, participant-facing-adjacent auth/session behavior change, now active in the live database
  - src/auth/auth-middleware.ts, auth-service.ts, and the logout/login/register/refresh routes changed (session revocation behavior)
  - src/engine/dashboard-repository.ts changed (public activity feed no longer includes research-participant events -- a research-data-safety fix, directly relevant to the human-study protocol's presentation commitments)
  - app/live-scan/page.tsx changed (scan UI: domain summary, finding-card domain chip, engine-diagnostics relabel)
  - app/Sidebar.tsx changed (nav: relabelled /performance link, removed /user-study entry)
  - src/storage/repository-factory.ts changed (storage-provider selection now fails closed outside dev/test)
  - app/guidelines/page.tsx, app/reports/[id]/page.tsx, app/components/landing/FeaturesGrid.tsx changed (wording only, no data/behavior change)
  - app/security/page.tsx and app/ai-fix/page.tsx removed (Update 2) -- normal-user-facing navigation surface reduced; underlying security/remediation implementation unchanged
  None of these change RQ1 experiment methodology, RQ4 protocol, or the human-study protocol itself.

READY_FOR_VERCEL_DEPLOYMENT: NO

NEXT_ACTION: Remaining blockers before Vercel deployment, in priority order:
  1. A real Vercel preview deployment to verify the child-process sandbox path in app/api/scan/route.ts actually works under the serverless runtime (Section 31/37 -- this pass deliberately did not attempt this, per the explicit instruction not to deploy).
  2. An admin-account browser walkthrough of the admin UI itself and the AI-assisted (not just deterministic) fix path -- not performed, no admin credentials available to this session.
  3. Optional, not blocking: emoji/gradient visual cleanup, landing-page copy audit, .env.example formal categorization, engineering-test-vs-product-data DB separation (design already sketched in Section 2), mobile/tablet responsive-width checks, clean up the ENGTEST/curltest engineering test accounts and project created during live testing.
  Once resolved: create research-freeze-v2, then proceed to actual Vercel deployment and production DB/browser verification.
```

---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TknUUqzGqFni8F7U1qepq2
