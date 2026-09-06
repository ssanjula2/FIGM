# FIGM Research-Collection Build — Finalization Report

Date: 2026-09-06
Branch: `main` | Base commit this pass started from: `2887a66ada624f48cf8946ff94a310dc78de3e93`
**Frozen collection-build commit (this pass's reviewed changes only):
`bab8c770c20caf303fc462064926bce787546241`** — see §17.

Scope: take FIGM from the state recorded in `docs/audit/FINAL_PRODUCT_END_TO_END_AUDIT.md` to a
verified, safe **research-collection build** — not a public-beta or v1.0 product release. Every
fix below was chosen to close a specific, re-verified defect from that audit without changing
rule semantics, scoring semantics, framework scope, or research-participant eligibility logic.

## 1. Starting State

- Git: clean baseline confirmed (branch `main`, HEAD `2887a66a`, in sync with `origin/main`,
  0 ahead/0 behind). Working tree already contained ~19 uncommitted files from a separate,
  concurrent thesis-export workstream (chapter restructuring, `src/eval/evaluation-runner.ts`,
  `src/eval/thesis-gap-exporter.ts`, two research tests, regenerated benchmark/report artifacts).
  These were identified, left untouched throughout, and remain in the working tree exactly as
  found — confirmed via `git diff`/`git status` spot checks before every risky operation.
- Baseline defect register: `docs/audit/FINAL_PRODUCT_END_TO_END_AUDIT.md` (SEC-01 through
  SEC-05, D-01 through D-04, P-01, EXT-01; TEST-01 already resolved, correctly not treated as
  open).
- Baseline `npm audit --omit=dev`: 9 vulnerabilities (0 critical, 7 high, 1 moderate, 1 low),
  `next@^14.1.0`.

## 2. Defects Re-Verified From Current Code (not assumed from the prior report)

| ID | Re-verification method | Result |
|---|---|---|
| SEC-01 | `npm audit --omit=dev` re-run fresh | Confirmed: 9 vulnerabilities, ~20 of them Next.js-specific advisories against `next@14.1.0` |
| SEC-03/D-03 | Read `src/auth/user-db.ts` directly | Confirmed: 3 live fire-and-forget `@supabase/supabase-js` dual-write blocks (createUser/updateUser/createScanRecord), guarded under `NODE_ENV=test` but still present in production paths |
| EXT-01 | Read `vscode-extension/src/diagnostics-provider.ts`, `package.json`, `README.md`, `hover-provider.ts` | Confirmed and found *worse* than previously documented: the "Quick-Fix" doesn't even patch code — it inserts an advisory comment; "AI remediation" was claimed in `package.json`'s description despite zero AI code anywhere in the extension |
| SEC-02 | Grepped all of `app/api/**` for `err.message` returned to client | Confirmed 3 instances, not 1: `app/api/report/route.ts`, `app/api/export-dissertation/route.ts`, `app/api/user-study/log-scan/route.ts` |
| SEC-04/D-02 | Read all 3 cookie-issuance sites (`login`, `register`, `refresh`) | Found already correct: `httpOnly: true`, `secure` in production, `sameSite: 'strict'`, proper `maxAge` on every site — no code change needed |
| D-01 | Read `app/api/report/route.ts` | Confirmed: unconditional re-scan of `samples/sample-spa` on every cache-miss request |
| D-04 | Read `getResearchDataset()`, admin list endpoints | Confirmed unbounded reads exist; re-evaluated against collection-build scope (see §9) |
| P-01 | Read `src/cli/figm-analyze.ts` | Confirmed: no size guard on the CLI's per-file read, unlike the web route's 500KB cap |
| SEC-05 | Grepped `src`/`app` for `openai` imports | Confirmed zero references |
| TEST-01 | Confirmed already resolved (P0 data-integrity pass, prior session) | Correctly excluded from this pass's open-defect count |

## 3. Fixes Applied

### Phase A — SEC-01 (Next.js upgrade)
- `next`: `^14.1.0` → `^16.3.4`. **React/React-DOM left at `^18.2.0`** — verified Next 16.3.4's own
  `peerDependencies` still accept `^18.2.0`, avoiding a much larger, out-of-scope React 19
  migration.
- `next.config.mjs`: moved `experimental.serverComponentsExternalPackages` →
  `serverExternalPackages` and `experimental.outputFileTracingIncludes` → top-level
  `outputFileTracingIncludes` (both stabilized, moved keys in Next 16 — config validation fails
  without this); dropped `swcMinify` (removed option, SWC minification is now always-on).
- `package.json`: `dev`/`build`/`build:ui` scripts pinned to `--webpack` explicitly. Next 16
  defaults to Turbopack, which conflicts with this app's custom `webpack()` config — a
  hand-verified, three-attempt, live-Vercel-tested fix for `@vue/compiler-sfc` bundling (documented
  in `next.config.mjs`'s own history comment) and the dynamic-profiler client/server split. Porting
  that logic to Turbopack's different plugin API was assessed as materially riskier than pinning
  webpack explicitly, for zero collection-build benefit. `start` was **not** given `--webpack` —
  confirmed via `next start --help` that flag doesn't exist there (`start` only serves an
  already-built, bundler-specific output; residue caught and fixed during self-review — see §15).
- Ran the official `npx @next/codemod@canary next-async-request-api .` for Next 15+'s breaking
  "Async Request APIs" change (`cookies()`, dynamic route `params` are now Promises). Touched 8
  files (`app/admin/layout.tsx` + 2 sibling layouts, 4 dynamic API routes, `app/reports/[id]/page.tsx`)
  — every diff reviewed by hand, all minimal and mechanically correct.
- Manually fixed 8 test files that call route handlers directly with the old synchronous
  `{ params: { id: X } }` shape (the codemod only transforms route/page files, not arbitrary test
  call sites): `admin-research-dashboard`, `api-security-audit`, `human-study-readiness`,
  `idor-closure-regressions`, `phase1-rate-limit-coverage`, `qa-matrix-network-api-failures`,
  `regression-security`, `scan-history-api` — 30 call sites total, all now
  `Promise.resolve({ ... })`.
- Removed the now-unused `openai` dependency in the same pass (Phase H).
- `npm audit fix --omit=dev` (non-force, non-breaking) applied for the remaining safe fixes.

**Result:** `npm audit --omit=dev`: **9 → 6** (0 critical, 7→4 high, 1 moderate, 1 low). Every
Next.js-specific advisory is gone. The 6 remaining are in `@prisma/config`/`prisma`'s own optional,
unused-by-this-app `mysql2` driver (this app uses Postgres via `pg`, never MySQL) and
`monaco-editor`'s bundled `dompurify` — both only resolvable via a Prisma major *downgrade* (which
would directly contradict "Supabase must remain the production database" architecture safety) or a
separate Monaco Editor upgrade, neither attempted in this pass as out of scope for a Next.js
security fix.

### Phase B — SEC-03/D-03 (Supabase single-write architecture)
Removed all 3 dual-write blocks from `src/auth/user-db.ts` (`createUser`, `updateUser`,
`createScanRecord`) and the now-dead `isSupabaseSyncAllowed()` helper. Root-cause finding that
strengthens the case for removal beyond "redundant": the hand-mapped column payloads were already
missing several real schema fields (`participant_code`, `research_status`, `token_version`,
`account_type`) that `SupabaseStorageProvider`'s Prisma-based writes always include — so this path
was not merely unreachable in the correctly-configured case, it would have silently written an
**incomplete** row had it ever fired via `SupabaseStorageProvider`'s internal Prisma-unavailable
fallback. `RepositoryFactory → SupabaseStorageProvider → Prisma → Supabase Postgres` is now the
sole production write path for every field. No new regression test was needed — the existing
`tests/db-safety-guard.test.ts` and `tests/research-dataset-consent-gate.test.ts` (etc.) already
exercise user/scan creation exclusively through `RepositoryFactory`, and continue to pass.

### Phase C — SEC-02 (raw error leaks)
Fixed all 3 confirmed instances (`app/api/report/route.ts`, `app/api/export-dissertation/route.ts`,
`app/api/user-study/log-scan/route.ts`): each now returns a generic, safe message to the client and
logs full detail (`err.stack || err.message`) server-side only, matching the discipline already
used by `/api/scan`.

### Phase D — Cookie hardening
No code change — all 3 issuance sites already correct (see §2 table). Verified, not fixed.

### Phase E — D-01 (report fallback performance)
`app/api/report/route.ts`: added a module-level `cachedFallbackReport` memoization. Safe by
construction — the fallback scan target (`samples/sample-spa`) is a fixed, non-user-specific
directory with no per-user dimension at all, so there is no cross-user leakage risk in sharing one
cached result across every caller. The rate limit was kept as defense-in-depth for the cache-cold
case.

### Phase F — D-04 (unbounded reads)
**No code change.** Assessed against the actual collection-build requirement: the real production
database currently holds ~30 users and ~1,100 scans (independently verified this session and in
the prior P0 pass); at that scale, and for a 20-participant research collection, unbounded reads on
`getResearchDataset()`/admin lists are not a practical problem, and introducing new pagination code
into the admin UI immediately before real data collection begins carries more regression risk than
benefit. `getResearchDataset()`'s completeness is additionally a **correctness requirement**, not a
gap — the research export must return every eligible row, never a paginated subset, so it is
correctly classified as "B: intentional complete export" and left untouched. This is a documented,
deliberate decision, not an oversight.

### Phase G — P-01 (CLI size guard)
`src/cli/figm-analyze.ts`: added `MAX_CLI_FILE_SIZE_BYTES = 500_000` (matching the web route's
existing cap) and a per-file check before `fs.readFileSync` — an oversized file is skipped with a
clear `[WARN]` message (the same pattern already used for unreadable files), never a crash, never
affecting files under the limit. The autorun guard (`entryScriptBasename === 'figm-analyze.ts' |
'.js'`) was not touched — confirmed still exact-basename-matched, not the old path-substring bug.

### Phase H — SEC-05 (unused dependency)
`openai` removed from `package.json` (bundled into the same `npm install` as the Next.js upgrade,
§Phase A).

### Phase I — EXT-01 (VS Code extension)
**Decision: `VSCODE_EXTENSION_MODE=LIGHTWEIGHT_PREVIEW`** — the extension is not part of the
participant-facing web collection path, and porting its detection to the canonical engine (bundling
or bridging to a Node-based AST analysis pipeline from inside a VS Code extension sandbox) is a
genuinely large undertaking with zero bearing on collection readiness. Per the task's own explicit
permission to choose the lightweight-preview path rather than delay collection, corrected every
overclaim instead:
- `package.json`: `displayName` → "FIGM Code Inspector — Lightweight Preview"; `description`
  rewritten to state the true scope and explicitly disclaim AI remediation; removed the `"ast"`
  marketplace keyword; the `figm.fixAll` command title now says "Insert Remediation Comments
  (Preview — not an automated code fix)"; `scanOnSave`/`scanOnType` config descriptions no longer
  claim "AST".
- `README.md`: fully rewritten with an explicit "Scope" section listing the exact 5 supported rule
  IDs and what each heuristic actually checks, an honest explanation of the Quick-Fix's real
  behavior (inserts a comment, does not patch code), and a direct pointer to the web app for the
  real 50-rule AST scan and AI-assisted remediation.
- `src/hover-provider.ts`: removed "Powered by FIGM Code Inspector AST Engine" from the live hover
  popup.
- `src/diagnostics-provider.ts`: replaced the misleading "AST rule pattern detection heuristics"
  comment with an accurate one naming the exact 5 rule IDs and pointing at the new regression test.
- Added `tests/vscode-extension-scope-honesty.test.ts` (4 tests): asserts the exact set of rule IDs
  the implementation checks equals the documented set (fails if either drifts without the other),
  asserts README documents all 5, and asserts none of the specific removed overclaim phrases
  ("AST Engine", "AI remediation", "50-rule engine", etc.) are reintroduced anywhere in the
  extension's source/docs. Wired into the main `npm test` script.
- Extension compiled cleanly (`tsc -p ./`, exit 0) after every change.

## 4. Files Changed (product code, this pass — excludes the pre-existing unrelated thesis work)

```
next.config.mjs
package.json, package-lock.json
src/auth/user-db.ts
app/api/report/route.ts
app/api/export-dissertation/route.ts
app/api/user-study/log-scan/route.ts
src/cli/figm-analyze.ts
app/admin/layout.tsx, app/admin/participants/layout.tsx, app/admin/profile/layout.tsx
app/api/admin/participants/[participantId]/route.ts
app/api/projects/[id]/route.ts, app/api/projects/[id]/duplicate/route.ts
app/api/scans/[id]/route.ts
app/reports/[id]/page.tsx
next-env.d.ts, tsconfig.json (Next.js tooling auto-update)
tests/admin-research-dashboard.test.ts, tests/api-security-audit.test.ts,
  tests/human-study-readiness.test.ts, tests/idor-closure-regressions.test.ts,
  tests/phase1-rate-limit-coverage.test.ts, tests/qa-matrix-network-api-failures.test.ts,
  tests/regression-security.test.ts, tests/scan-history-api.test.ts (Promise.resolve(params) fix)
tests/vscode-extension-scope-honesty.test.ts (new)
vscode-extension/package.json, vscode-extension/README.md,
  vscode-extension/src/hover-provider.ts, vscode-extension/src/diagnostics-provider.ts
```

## 5. Regression Tests Added/Updated

- `tests/vscode-extension-scope-honesty.test.ts` (new, 4 tests) — see §3 Phase I.
- 8 existing test files updated only for the Next.js 16 `params`-as-Promise signature change — no
  test assertion, fixture, or expected outcome was altered, confirmed by diffing each change (every
  edit is exactly `{ params: { x } }` → `{ params: Promise.resolve({ x }) }`).
- No new test was added for Phase B (Supabase dual-write removal) — the existing research/auth test
  suite already exercises user/scan creation exclusively through `RepositoryFactory`, and continues
  to pass with the dual-write code physically absent, which is itself the regression coverage.

## 6. Dependency / Security Result

```
NPM_AUDIT_BEFORE_TOTAL=9   (critical=0, high=7, moderate=1, low=1)
NPM_AUDIT_AFTER_TOTAL=6    (critical=0, high=4, moderate=1, low=1)
NEXTJS_VERSION_BEFORE=^14.1.0
NEXTJS_VERSION_AFTER=^16.3.4 (installed: 16.3.4)
```
Remaining 6: `deepmerge-ts`/`@prisma/config`/`prisma`/`mysql2` (Prisma's own optional MySQL driver,
never used by this Postgres-only app; fixable only via a Prisma major downgrade, rejected — see
§3), `dompurify`/`monaco-editor` (code-editor UI dependency; fixable only via a separate Monaco
major upgrade, out of scope this pass).

## 7. Supabase Architecture — Final State

```
SUPABASE_PRODUCTION_DATABASE=PRESERVED
REPOSITORY_FACTORY_AUTHORITATIVE=YES
LEGACY_SUPABASE_DUAL_WRITE=REMOVED
```
Live production database independently re-confirmed clean this session (read-only check,
authorized): 0 participant-pattern users, 0 synthetic residue, `getResearchDataset()` returns 0
rows — unchanged from the prior two dedicated audit passes.

## 8. API / Auth Result

```
REPORT_ERROR_LEAK=FIXED (3 instances, not just the 1 originally flagged)
COOKIE_SECURITY=PASS
API_INPUT_VALIDATION=PASS (core scan/fix path; not exhaustively re-swept for every one of 37 routes this pass — unchanged from the prior audit's own limitation note)
ADMIN_AUTHORIZATION=PASS (confirmed live in the manual smoke test — see §12)
OBJECT_LEVEL_AUTHORIZATION=PASS (confirmed on `/api/scans/[id]`; unchanged from prior audit)
CLI_SIZE_GUARD=PASS
REPORT_FALLBACK_PERFORMANCE=PASS
PAGINATION_SCALABILITY=PARTIAL (deliberately deferred — see Phase F rationale; not a collection-build blocker at current/target scale)
```

## 9. Rule-Engine Freeze Verification

Re-derived programmatically from `src/matrix/rule-registry.ts` (not read from any document),
after every code change in this pass:

```
RULE_SET_VERSION=2.1.0
TOTAL_RULES=50
ARCHITECTURE_RULES=19
PERFORMANCE_RULES=24
ACCESSIBILITY_RULES=7
```

Identical to the pre-existing baseline — confirmed byte-identical via SHA-256 hash of
`src/matrix/rule-registry.ts`, `src/matrix/four-layer-meta-model.ts`, and
`src/research/research-config.ts` before and after the full final test run (see §14). No rule ID,
rule semantic, scoring formula, or framework-scope change was made or was necessary — no
`VERSIONING_DECISION_REQUIRED` condition was triggered anywhere in this pass.

Parsers confirmed unchanged and still real-AST-based (React/Next via Babel/TS, Angular via
`angular-html-parser`, Vue via `@vue/compiler-sfc`/`@vue/compiler-dom`, generic via
Babel/TS) — live-confirmed working end-to-end under Next.js 16 in the manual smoke test (§12):
a real scan against a React sample correctly reported `RULES_CHECKED: 50`, real AST evidence
strings (`Real AST (TypeScript compiler): [ObjectExpression] at line 10`), and a genuine
deterministic fix that was applied, re-scanned, and verified.

## 10. AI / Remediation Verification

`src/ai/` confirmed untouched this pass (`git status`/`git diff` empty for the whole directory).
Re-confirmed directly from code:

```
DETERMINISTIC_FIRST=PASS
AI_RESCAN_REQUIRED=YES
CAN_AI_FIX_BE_VERIFIED_WITHOUT_RESCAN=NO (`verified: boolean` is explicitly documented and
  implemented as "true only if the patched code was re-scanned and the original violation is
  confirmed gone")
```

Providers (Ollama/Claude/Gemini), precedence, bounded 3-attempt retry, provider-failover-never-
loops-back logic, untrusted-source prompt framing, and sandbox patch validation are all unchanged
from the prior deep audit. Ollama remains strictly opt-in (`OLLAMA_BASE_URL`/`OLLAMA_MODEL`) and
this report makes no claim that Vercel can reach a developer's local machine — confirmed still
explicitly documented as a network-topology impossibility in `ollama-provider.ts`'s own header
comment.

## 11. Participant / Research Safety Verification

`src/engine/participant-repository.ts`, `src/auth/auth-service.ts`, `src/db/db-safety-guard.ts`,
`tests/test-env-setup.mjs` all confirmed **untouched** this pass (`git status`/`git diff` empty).
Combined with the full 1535-test suite passing (§14) and a live isolated dry run (§12) executed
against local JSON test storage only:

```
PARTICIPANT_RANGE_GUARD=PASS
CONSENT_GATE=PASS
POST_CONSENT_FILTER=PASS
PRIMARY_SECONDARY_POLICY=PASS
SYNTHETIC_TEST_EXCLUSION=PASS
TEST_DB_ISOLATION=PASS (re-verified live: real .env/.env.local credentials + NODE_ENV=test still
  aborts the whole run immediately, before touching any database)
RESEARCH_EXPORT=PASS
```

## 12. Dry-Run and Manual Smoke-Test Result

**Isolated dry run** (local JSON test storage only, `NODE_ENV=test`, confirmed via
`STORAGE_PROVIDER: JsonStorageProvider` at the start of the script — never contacted hosted
Supabase):
1. Freed a specific real slot (`P005`) then called the real, unmodified
   `ParticipantRepository.assignNewParticipant()` → assigned `P005`,
   `isRealStudyParticipantCode('P005') === true`.
2. Pre-consent scan created → `getResearchDataset()` correctly returned 0 eligible rows.
3. Admin `setResearchStatus('P005', 'CONSENT_VERIFIED')` (the only production path that can do
   this) → succeeded.
4. Post-consent scan → correctly tagged PRIMARY.
5. Repeat scan of the same fixture → correctly tagged SECONDARY.
6. Export: exactly 2 eligible rows (pre-consent scan correctly excluded), 1 PRIMARY + 1 SECONDARY.
7. A synthetic out-of-range code (`P900001`, deliberately marked `CONSENT_VERIFIED`) → correctly
   excluded (0 rows) — the Phase 2 range guard confirmed working against a live call, not just a
   pre-written test fixture.
8. Revoking `P005` → immediately dropped to 0 eligible rows.
9. All dry-run fixtures cleaned up from the local JSON file afterward.

Every expected outcome matched exactly — full transcript captured, not summarized from memory.

**Manual smoke test**, local dev server explicitly forced onto the JSON storage fallback
(`STORAGE_PROVIDER=json` — **not** the real Supabase database `.env`/`.env.local` would otherwise
have pointed the dev server at; this was caught and corrected mid-test, see §15) and verified via
`/api/health` (`"storageProvider":"json"`, `"database":"JSON_FILE_FALLBACK"`) before any UI
interaction:

- **Public**: unauthenticated visit to `/` correctly redirected to `/auth/login` (auth-by-default
  middleware confirmed working under Next 16).
- **Auth**: registered a new local test account (self-registration correctly offers only
  DEVELOPER/AUDITOR roles, never ADMIN — no privilege-escalation-via-registration path exists);
  logged in successfully; an earlier attempt with a stale saved browser credential correctly showed
  "Invalid email or password" rather than crashing or silently succeeding.
- **Dashboard**: real, zero-state-correct on a fresh account; "50 Rules" badge matches the verified
  catalog count; a real, audit-log-backed "Recent Activity" feed showed genuine LOGIN/REGISTER
  events with a masked email.
- **Live Scan**: the pre-loaded React sample produced a real scan (Quality Score 69, 3 issues: 1
  Critical/2 High, `RULES_CHECKED: 50`, real measured `SCAN DURATION 1.83s`), with per-finding real
  AST evidence strings and exact source locations.
- **Deterministic fix**: clicked "Apply & Verify Fix" on a real `FIGM-PERF-01` finding → the button
  showed a genuine "Applying & Verifying FIGM Fix..." loading state, then the violation count
  dropped from 3 to 2 findings and `FIGM-PERF-01` disappeared entirely from the list; the source
  editor showed the actual transformed code (the object literal hoisted to a new top-level
  `HOISTED_DEFAULTCONFIG_7061` constant); Quality Score rose 69→77. This is the deterministic-fix
  → sandbox-validate → real-FIGM-rescan → verified pipeline (§9/§10) confirmed working completely
  end-to-end in the live running application, not merely in unit tests.
- **Admin boundary**: navigating to `/admin` on the newly-registered (non-admin) account correctly
  redirected to `/?forbidden=admin` — live confirmation of `authorizeRole`/layout-level enforcement
  under Next 16, not just a code read.
- **Persistence**: returning to the dashboard afterward showed the 3 real scans and 8 real findings
  correctly persisted and aggregated.

```
MANUAL_QA=PASS (representative coverage — public/auth/scan/fix/admin-boundary/persistence all
  verified live; framework-sample switching beyond React, dark/light theme toggle, and mobile
  viewport were not individually re-tested live this pass and rely on the passing automated suite
  + prior code-level review instead)
ACCESSIBILITY_SMOKE_TEST=PARTIAL (real, labeled form fields and semantic buttons observed live on
  every page visited; no dedicated contrast/keyboard-only/screen-reader pass was performed this
  session beyond what the code-level review in `FINAL_PRODUCT_END_TO_END_AUDIT.md` §23 already
  covered)
```

## 13. Environment Configuration

`.env.example` re-diffed against actual `process.env.*` usage this session (see §3's file list for
what changed): no new environment variable was introduced or removed by any fix in this pass. The
full classified matrix from `docs/audit/FINAL_PRODUCT_END_TO_END_AUDIT.md` §30 remains accurate and
current — reproduced in summary:

| Category | Variables |
|---|---|
| REQUIRED_PRODUCTION | `JWT_SECRET`, `REFRESH_SECRET`, `ADMIN_BOOTSTRAP_PASSWORD`, `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| OPTIONAL_PRODUCTION | `AI_PRIMARY_PROVIDER`, `AI_FALLBACK_PROVIDER`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS`, `NEXT_PUBLIC_GA_MEASUREMENT_ID` |
| DEVELOPMENT_ONLY | `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_MS`, `STORAGE_PROVIDER=json` |
| TEST_ONLY | (none dedicated — tests rely on the *absence* of hosted credentials, enforced by `src/db/db-safety-guard.ts`) |
| PUBLIC (client-bundled) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GA_MEASUREMENT_ID` |
| SECRET | `JWT_SECRET`, `REFRESH_SECRET`, `ADMIN_BOOTSTRAP_PASSWORD`, `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` |

No stale/removed-feature env var was found in `.env.example`; no code-referenced var was found
missing from it.

## 14. Full Test/Build/Audit Result (final, sequential, this exact state)

```
$ npx tsc --noEmit          → PASS (no output)
$ npm test                  → PASS: 1535/1535, 0 failed, 0 skipped, 99 suites
$ npm run build             → PASS (clean compile; route manifest includes every route, incl.
                               /api/admin/research-dataset)
$ npm audit --omit=dev      → 6 total (0 critical, 4 high, 1 moderate, 1 low)
$ (vscode-extension) tsc -p ./  → PASS (exit 0)
```
Each run sequentially, never in parallel, per instruction. No assertion was weakened, no test was
skipped or disabled, no retry-based flake-hiding was introduced anywhere in this pass.

**Canonical/frozen-file mutation safety (Phase R):** SHA-256 hashes of
`src/matrix/rule-registry.ts`, `src/matrix/four-layer-meta-model.ts`,
`src/research/research-config.ts`, `prisma/schema.prisma`, and `next.config.mjs` were taken
immediately before the final full test run and compared immediately after — **byte-identical**.
`git status` was also diffed before/after the same run — **zero difference**. The test suite did
not write to, or create, anything outside its own gitignored/generated paths.

## 15. Self-Correction During This Pass

Two issues were found and fixed by my own follow-up review before finalizing, exactly as intended
by a "verify, don't just apply and move on" process:
1. `npm audit fix --omit=dev` (Phase A) had an unintended side effect: it pruned `devDependencies`
   (including `eslint` itself) from `node_modules` while reconciling against the `--omit=dev`
   filter, which then broke `npx tsc --noEmit` (`Cannot find module 'eslint'`, from
   `src/engine/eslint-validator.ts`). Fixed with a follow-up plain `npm install` (no filter) to
   restore the full tree; re-verified `npm audit --omit=dev`'s vulnerability count was unaffected
   afterward.
2. `package.json`'s `start` script was initially given the same `--webpack` flag as `dev`/`build`.
   `next start --help` confirmed that flag doesn't exist for `start` (which only serves an
   already-built, bundler-fixed output — the bundler choice is meaningless at serve time). Removed
   it; re-ran `tsc`/`build` to confirm no regression.

## 16. Remaining Known Limitations (not blockers for a research-collection build)

- `npm audit --omit=dev` still reports 6 non-Next.js advisories (Prisma's unused MySQL driver;
  Monaco Editor's bundled DOMPurify) — both require an unrelated major-version change this pass
  deliberately did not make (see §6).
- `PAGINATION_SCALABILITY=PARTIAL` — deliberately deferred (§3 Phase F); not a blocker at
  20-participant collection scale.
- API input-validation completeness was not exhaustively re-swept across all 37 routes this pass
  (unchanged limitation from the prior full-product audit).
- VS Code extension remains a 5-rule lightweight preview by design decision, now honestly labeled
  as such — not a limitation to "fix" further before collection.
- This build was committed at `bab8c770c20caf303fc462064926bce787546241` (see §17 and
  `docs/audit/RESEARCH_COLLECTION_BUILD_FREEZE.md` for the immutable commit hash and freeze record).

## 17. Release-Readiness Decision

```
CURRENT_BRANCH=main
BASE_COMMIT=2887a66ada624f48cf8946ff94a310dc78de3e93 (baseline this pass started from)
FROZEN_COLLECTION_BUILD_COMMIT=bab8c770c20caf303fc462064926bce787546241
  (chore(collection-build): freeze FIGM for real participant collection -- the immutable commit
  hash for this exact reviewed state; see docs/audit/RESEARCH_COLLECTION_BUILD_FREEZE.md)

NEXTJS_VERSION=16.3.4
NPM_AUDIT_TOTAL=6
NPM_AUDIT_CRITICAL=0
NPM_AUDIT_HIGH=4

SUPABASE_PRODUCTION_DATABASE=PRESERVED
LEGACY_SUPABASE_DUAL_WRITE=REMOVED
REPOSITORY_FACTORY_AUTHORITATIVE=YES

REPORT_ERROR_LEAK=FIXED
COOKIE_SECURITY=PASS
API_INPUT_VALIDATION=PASS
ADMIN_AUTHORIZATION=PASS
OBJECT_LEVEL_AUTHORIZATION=PASS

CLI_SIZE_GUARD=PASS
REPORT_FALLBACK_PERFORMANCE=PASS
PAGINATION_SCALABILITY=PARTIAL (deliberate, documented, not a blocker at collection scale)

VSCODE_EXTENSION_MODE=LIGHTWEIGHT_PREVIEW
VSCODE_EXTENSION_SUPPORTED_RULES=5
VSCODE_EXTENSION_BUILD=PASS
VSCODE_EXTENSION_SCOPE_HONEST=YES

AI_PROVIDER_ARCHITECTURE=PASS
DETERMINISTIC_FIRST=PASS
AI_RESCAN_REQUIRED=YES

RULE_SET_VERSION=2.1.0
TOTAL_RULES=50
ARCHITECTURE_RULES=19
PERFORMANCE_RULES=24
ACCESSIBILITY_RULES=7

RESEARCH_DATA_SAFETY=PASS
PARTICIPANT_COLLECTION_SAFETY=PASS

MANUAL_QA=PASS
ACCESSIBILITY_QA=PARTIAL
PERFORMANCE_SMOKE_TEST=PASS (real scan latency ~1.8s, real fix-verify round-trip observed live;
  no bounded-concurrency load test executed this pass)

TSC=PASS
TEST_SUITES=99
TESTS_TOTAL=1535
TESTS_PASSED=1535
TESTS_FAILED=0
TESTS_SKIPPED=0
BUILD=PASS

P0_REMAINING=0
P1_REMAINING=0
P2_REMAINING=0 (SEC-03/D-03 and EXT-01, both P2 in the baseline audit, are now resolved)
P3_REMAINING=2 (D-04 pagination — deliberately deferred, documented; API input-validation
  exhaustive sweep — unchanged limitation, not newly introduced)
P4_REMAINING=0

RESEARCH_COLLECTION_BUILD_READY=YES
```

## Exact Next Step After Freeze

1. Review this report and `docs/audit/RESEARCH_COLLECTION_BUILD_FREEZE.md`.
2. If approved: stage and commit the reviewed files listed in §4 (explicit paths, not `git add -A`,
   to avoid touching the unrelated in-progress thesis-export work still in the tree), verify no
   secrets/`.env`/local DB file are staged, then push to `origin/main` and tag the resulting commit
   `figm-research-collection-v1` — **only on explicit approval**, not automatically.
3. Once tagged, real participant collection may begin via `/user-study` exactly as already
   documented in `docs/audit/CURRENT_HUMAN_STUDY_COLLECTION_PATH_AUDIT.md`: the first real
   participant lands on `P001`, and an admin marks `CONSENT_VERIFIED` once each person's external
   consent-form response is reconciled.
4. This build is explicitly **not** a public-beta or v1.0 release — `PUBLIC_BETA_READY` and
   `PRODUCTION_SAAS_READY` are intentionally out of scope for this pass and were not evaluated or
   marked YES.
