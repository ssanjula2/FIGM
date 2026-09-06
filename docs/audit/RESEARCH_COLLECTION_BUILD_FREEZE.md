# FIGM Research-Collection Build — Freeze Record

Date/time: 2026-09-06
Branch: `main`
Base commit: `2887a66ada624f48cf8946ff94a310dc78de3e93` (`chore(research): finalize thesis stages
and harden study data integrity`)

## FINAL FROZEN, DEPLOYED & TAGGED COMMIT (supersedes the initial freeze below)

**FINAL COLLECTION-BUILD COMMIT:** `6a214e28df3f430a40c333274efd5ab46e1a6c83`
(`fix(study): allow anonymous access to participant study page`)

**TAG:** `figm-research-collection-v1` — NOT YET moved to this commit; still points at
`b33456dbcb485ada536b66ab5d492e4d5deb178d` pending explicit approval (see Freeze Status below).
The tag's history so far: initial target `9eac19a93d7abe89582d54dab7bec80ec613e73d`, moved
(explicitly approved) to `b33456dbcb485ada536b66ab5d492e4d5deb178d` after two post-freeze fixes,
and now a further two fixes below bring the actually-deployable, participant-reachable commit to
`6a214e28df3f430a40c333274efd5ab46e1a6c83`:

1. `72743e1f85bb0403d73f2ebb4dc71b64cf0307a6` (`fix(deploy): force verified webpack build on
   Vercel`) — `vercel.json` hard-coded `buildCommand` to plain `next build`, silently overriding
   the Project Settings dashboard and shipping the wrong bundler config. Fixed to
   `npx prisma generate && npm run build`. Config-only; no application code touched.
2. `b33456dbcb485ada536b66ab5d492e4d5deb178d` (`fix(scan): return controlled 400 on
   malformed/missing request body`) — production smoke testing found `POST /api/scan` returning
   an unhandled `500` for a missing/unparseable request body instead of a controlled `400`. Fixed
   by isolating `request.json()` parsing into its own try/catch ahead of the rest of the handler.
   Scope: `app/api/scan/route.ts` request-body parsing only, plus regression tests in
   `tests/live-scan-e2e.test.ts`. No change to rule detection, scoring, participant/consent logic,
   PRIMARY/SECONDARY policy, Supabase architecture, or remediation semantics.
3. `3eb4a47f6bd4b010f6ee145206d045d2545c2cc8` (`fix(study): classify Next.js participant fixture
   correctly`) — the participant study's Next.js task fixture (`app/user-study/page.tsx`,
   `BENCHMARKS.nextjs`) was submitted with `fileName: 'DashboardPage.tsx'`, a flat filename with no
   Next.js route-shape or content hint, so FIGM misclassified it as generic `REACT_JSX` and it
   never exercised any `FIGM-NEXT-*` rule. Fixed by changing only the fileName to
   `'app/dashboard/page.tsx'` (no fixture code change). Re-verified live: `NEXT_JS`, 3 findings
   (`FIGM-NEXT-03`, `FIGM-NEXT-01`, `FIGM-PERF-05`). See `docs/research/PARTICIPANT_TASK_PROTOCOL.md`
   §12.
4. `6a214e28df3f430a40c333274efd5ab46e1a6c83` (`fix(study): allow anonymous access to participant
   study page`) — production smoke testing found `GET /user-study` redirecting an unauthenticated
   visitor to `/auth/login` (a pre-existing gap in `middleware.ts`'s authenticated-by-default page
   gate, present since 2026-09-03, unrelated to this collection-build pass, but not caught until
   this smoke check). This made the real-participant study page completely unreachable by anyone
   without an existing product login. Fixed by adding exactly one entry (`path === '/user-study'`)
   to `middleware.ts`'s `isPublicPath`, plus the matching entry in `app/AppShell.tsx`'s
   `isBareRoute()` (so the page renders standalone, without the authenticated app's Sidebar/
   HeaderBar chrome, for an anonymous visitor) — required to keep an existing drift-regression test
   (`tests/accessibility-regression.test.ts`) passing, and correctness-required regardless. `/admin`
   and all `/api/admin/*` routes are unaffected. Added
   `tests/middleware-public-path-regression.test.ts`.

None of these four follow-up commits touched `ruleSetVersion`, the 50-rule catalog, scoring,
framework scope, participant P001-P020 eligibility, consent semantics, PRIMARY/SECONDARY policy,
Supabase architecture, or remediation/VERIFIED semantics — all remain exactly as certified by the
original freeze pass below.

**Post-fix verification (commit `6a214e28df3f430a40c333274efd5ab46e1a6c83`, live production):**

```
CI (GitHub Actions, figm-scan.yml):        PASS
Vercel Production deployment:              READY (alias https://figm-model.vercel.app confirmed
                                            serving this exact commit -- the /user-study anonymous-
                                            access fix and the app/dashboard/page.tsx fixture
                                            fileName, both of which exist only in this commit, were
                                            independently observed live)
Production smoke test:                     PASS
  GET  /user-study (unauthenticated) -> 200 (previously 307 -> /auth/login; fixed this pass)
  GET  /api/health                   -> 200, status=HEALTHY, storageProvider=supabase,
                                         database=CONNECTED_POSTGRES
  GET  /admin (unauthenticated)      -> 307 redirect to /auth/login (protected, unchanged)
  GET  /api/admin/participants       -> 401 UNAUTHORIZED (unauthenticated, unchanged)
  GET  /api/admin/research-dataset   -> 401 UNAUTHORIZED (unauthenticated, unchanged)
  Live /user-study JS bundle fetched directly and grepped: contains 'app/dashboard/page.tsx',
    does NOT contain the old 'DashboardPage.tsx' value
  POST /api/scan (unauthenticated, no persistence), exact fixture code+fileName
    -> framework: NEXT_JS, 3 findings (FIGM-NEXT-03, FIGM-NEXT-01, FIGM-PERF-05)
  No participant record, consent, or research scan created during any of the above
  Runtime errors observed this round: 0
Supabase production database:              CONNECTED_POSTGRES (confirmed via live /api/health)
REAL_DATA_COLLECTION_READY:                YES
```

---

## Initial Freeze Pass (historical — commit superseded by the pointer above)

**FROZEN COLLECTION-BUILD COMMIT:** `bab8c770c20caf303fc462064926bce787546241`
(`chore(collection-build): freeze FIGM for real participant collection`)

This is the exact, immutable commit this record certifies. It contains only the reviewed
research-collection-build hardening pass described in
`docs/audit/RESEARCH_COLLECTION_BUILD_FINALIZATION.md` (33 files) — the separate, pre-existing,
unrelated thesis-export workstream present in the working tree at the time was deliberately left
uncommitted and untouched (confirmed via `git status` immediately after this commit: those files
remain modified/untracked, exactly as before). `package.json` required one surgical staging step:
its `test` script is a single-line, space-separated file list that the concurrent thesis work had
also appended to (`tests/thesis-exporter-canonical-guard.test.ts`) on the same line as this pass's
own addition (`tests/vscode-extension-scope-honesty.test.ts`) — the committed version includes only
this pass's own addition; the thesis reference was excluded from the commit and remains, uncommitted,
in the working tree's copy of `package.json`.

## Frozen Product Identity

```
ruleSetVersion:              2.1.0
Total canonical rules:       50
  Architecture:               19
  Static Performance:         24
  Accessibility:                7
Primary frameworks:          React, Next.js, Angular
Additional framework support: Vue
Scanning authority:          RuleExecutionEngine (real parser/AST per framework -- Babel/TypeScript
                              for React/Next/generic JS, angular-html-parser for Angular templates,
                              @vue/compiler-sfc + @vue/compiler-dom for Vue SFCs)
Remediation order:           deterministic AST fixer (25 rules wired) -> AI-assisted (Claude/
                              Gemini/Ollama, provider-abstracted, bounded 3-attempt retry) ->
                              manual-review-only -- AI is never consulted before FIGM's own rule
                              engine has already identified the specific violation being fixed
Verification requirement:    a remediation is VERIFIED only after sandbox validation (syntax,
                              patch-scope, compile+type-check) AND a genuine FIGM re-scan confirms
                              the original violation is gone -- never on syntax-check alone
```

## Database / Persistence Architecture

```
Production database:         Supabase PostgreSQL (PRESERVED -- not removed, not downgraded)
Write path:                  RepositoryFactory -> SupabaseStorageProvider -> Prisma (@prisma/
                              adapter-pg + pg.Pool) -> Supabase PostgreSQL -- the SOLE production
                              write path as of this build (legacy direct-Supabase dual-write
                              side-channel in src/auth/user-db.ts removed this pass)
Local/test fallback:         JsonStorageProvider (local file), selected automatically whenever
                              Supabase credentials are absent, and unconditionally for automated
                              tests regardless of credentials (src/db/db-safety-guard.ts fails the
                              whole test run fast if a hosted Supabase URL is ever detected under
                              NODE_ENV=test -- re-verified live this pass)
```

## Research Participant Collection Policy (unchanged, re-verified this pass)

```
Target participant count:         20 (HUMAN_STUDY_TARGET_PARTICIPANTS)
Real participant code range:      P001..P020 (isRealStudyParticipantCode() -- rejects any
                                   out-of-range or non-canonically-padded code, e.g. P021, P900001,
                                   P0020)
Eligibility rule (ALL required):  1. participant code in the real P001..P020 range
                                   2. researchStatus === CONSENT_VERIFIED
                                   3. researchConsentVerifiedAt is non-null
                                   4. scan.createdAt >= researchConsentVerifiedAt
                                   REVOKED participants contribute zero rows (falls out of the
                                   single inclusion rule, not a special case)
Consent verification:             admin-only, off-platform reconciliation against an external
                                   consent form -- never set automatically anywhere in the codebase
Repeat-scan policy:                repeat scans are never blocked; the earliest eligible
                                   (post-consent) attempt per (participant, fixture) is PRIMARY,
                                   every later valid attempt is SECONDARY -- preserved, never
                                   dropped or overwritten, never counted as an additional primary
                                   observation
Research export:                  ADMIN-gated GET /api/admin/research-dataset, a thin pass-through
                                   over ParticipantRepository.getResearchDataset() with no
                                   reimplemented eligibility logic; JSON or CSV
```

## Verification Evidence for This Freeze

```
TSC=PASS
TESTS_TOTAL=1535   TESTS_PASSED=1535   TESTS_FAILED=0   TESTS_SKIPPED=0   TEST_SUITES=99
BUILD=PASS
NPM_AUDIT (production deps): 6 total (0 critical, 4 high, 1 moderate, 1 low) -- down from 9 at the
  start of this pass; every Next.js-specific advisory resolved
VS Code extension compile:   PASS
Canonical-file mutation check: SHA-256 hashes of rule-registry.ts, four-layer-meta-model.ts,
  research-config.ts, schema.prisma, and next.config.mjs are byte-identical before and after the
  final full test run; `git status` is identically empty-diffed before/after the same run
Live production database (read-only, authorized check, this session): 0 participant-pattern users,
  0 synthetic residue, getResearchDataset() returns 0 rows -- matches the researcher's own reported
  pre-collection state exactly
Isolated dry run (local JSON test storage only): full participant lifecycle (assign -> pre-consent
  scan excluded -> admin consent-verify -> post-consent scan PRIMARY -> repeat scan SECONDARY ->
  export -> synthetic-code excluded -> revoked excluded) executed against the real, unmodified
  production code path and confirmed at every step
Manual smoke test (local dev server forced onto JSON storage, confirmed via /api/health before any
  UI action -- never touched the real Supabase database): register -> login -> live scan (real
  React sample, 50 rules checked, real AST evidence) -> deterministic fix applied and re-scan-
  verified live (violation count 3->2, quality score 69->77, source code genuinely transformed) ->
  non-admin correctly denied /admin -> scans/findings correctly persisted and displayed on return
  to dashboard
```

## Deployment Status

No Vercel deployment was performed or verified as part of this pass. No deployment URL is recorded
here because none exists yet for this exact reviewed state -- fabricating one is explicitly
prohibited. `VERCEL_DEPLOYMENT_READY` (build succeeds with zero backend credentials present,
Vercel-specific Vue/dynamic-profiler bundling fixes already in place and unchanged by this pass)
remains a build-level property confirmed in the prior full-product audit; it is not the same
statement as "this exact commit has been deployed and verified live."

## Environment / Configuration Identifiers (no secret values)

```
STORAGE_PROVIDER selection logic: unchanged (RepositoryFactory, credential-gated)
Next.js:      16.3.4 (webpack bundler pinned explicitly for dev/build; Turbopack default not used)
React:        18.2.0 (unchanged)
Prisma:       7.9.1 (unchanged)
Node:         v22.14.0 (development environment this build was verified under)
ruleSetVersion:        2.1.0
consentVersion:        1.0.0 (CONSENT_PROTOCOL_VERSION, unchanged)
```

## Freeze Status

```
RESEARCH_COLLECTION_BUILD_READY=YES
RESEARCH_COLLECTION_BUILD_COMMIT=bab8c770c20caf303fc462064926bce787546241 (initial freeze pass --
  superseded, see below)
TAG_CURRENTLY_POINTS_TO=b33456dbcb485ada536b66ab5d492e4d5deb178d (figm-research-collection-v1 --
  NOT yet moved to the commit below; awaiting explicit approval)
FINAL_COLLECTION_BUILD_COMMIT=6a214e28df3f430a40c333274efd5ab46e1a6c83 (deployed,
  production-verified; tag move pending)
CI=PASS
VERCEL_PRODUCTION=READY
PRODUCTION_SMOKE_TEST=PASS
SUPABASE_PRODUCTION_DATABASE=CONNECTED_POSTGRES
REAL_DATA_COLLECTION_READY=YES
```

This record has been cross-checked against the actual commit hashes above, so a future reader
never confuses "the build that was verified" with any later, different commit on `main`. As of
this update, `figm-research-collection-v1` still points at `b33456dbcb485ada536b66ab5d492e4d5deb178d`
(two fixes behind the current `FINAL_COLLECTION_BUILD_COMMIT`) — the tag is deliberately NOT moved
automatically; see "FINAL FROZEN, DEPLOYED & TAGGED COMMIT" near the top of this file for the full
history of what changed and why, and move the tag only after explicit approval.
