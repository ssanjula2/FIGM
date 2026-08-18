# QA / Performance / Production-Hardening Forensic Section

Baseline: branch `main`, HEAD `02ed599d`. Working tree has uncommitted modifications (see §11).
All commands below were run directly against the repo at
`C:\Users\MSI\.gemini\antigravity-ide\scratch\figm-model` on 2026-08-18. `npm run build` was
deliberately **not run** for the reason documented in §10 — do not infer a build result from its
absence.

---

## 1. QA — full test suite (Phase 19)

**CLAIM:** the exact `"test"` script from `package.json` (52 files, `node --import tsx --import
./tests/test-env-setup.mjs --test --test-concurrency=1 --test-timeout=120000 tests/*.test.ts...`)
passes in full, and the file enumerated in the script matches what's on disk.

**EVIDENCE:** Ran the literal script command in the background (PowerShell, redirected to a temp
file). Final summary block from the run:

```
1..102
# tests 666
# suites 68
# pass 666
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 74008.7138
```

Disk vs. script diff (PowerShell, `Get-ChildItem tests -Filter *.test.ts` vs. regex-extracted file
list from `package.json`'s `scripts.test` string):

```
SCRIPT_COUNT:52
DISK_COUNT:52
--- IN DISK NOT IN SCRIPT ---
(none)
--- IN SCRIPT NOT ON DISK ---
(none)
```

**VERDICT: FIXED AND VERIFIED.** 666/666 tests pass, 0 failed/skipped/todo, ~74s wall time. The
52 files on disk and the 52 files enumerated in `package.json`'s `"test"` script are an **exact
match** — the previously-reported gap (`tests/user-study-pipeline.test.ts` silently excluded,
NEW-06 in `audit/new-02.md`) is now closed: that file **is** in the current script string (verified
directly against the `package.json` read at the top of this session) and its suite (`Real
Participant User Study Pipeline & Invariant Test Suite`, 8/8 passing) appears in the run output as
suite `#101`. Per the audit's own standard, a green suite alone isn't proof of correctness — see
§2/§3 for assertion-quality spot checks.

Caveat for reproducibility: running the suite mutates several tracked files as a side effect
(`benchmarks/benchmark-results.md`, `docs/evidence/canonical-evaluation.json`,
`docs/migration-report.json`, etc. — all appear in `git status` as modified). This was already true
at session start (these files were listed as modified before I ran anything), so it predates my
run, but it means "the test suite" and "some prior test/eval run leaves the tree dirty" are
entangled — a `git diff --stat` before/after `npm test`/`npm run eval` would need separating out to
know exactly which command wrote which file. Not further investigated here as out of scope for
this section.

---

## 2. QA — assertion-quality spot-check (Phase 19)

### `tests/json-migration.test.ts` (QA-02)

**CLAIM:** the tautological assertion previously reported (`audit/new-02.md:101`:
`assert.ok(typeof summary.usersSkipped === 'number' || summary.usersImported >= 0)` — true for any
`usersSkipped` value) has been replaced with real invariants.

**EVIDENCE:** `tests/json-migration.test.ts:15-36`, full file read. Current assertions:
- `tests/json-migration.test.ts:15-17` — independently reads `UserDB.getAllUsers().length` /
  `getProjects().length` / `getScanRecords().length` from the **same source** the migration script
  itself reads, *before* calling the migration.
- `tests/json-migration.test.ts:27-29` — `assert.equal(summary.usersImported + summary.usersSkipped,
  sourceUserCount, ...)` (and the same pattern for projects/scans) — a real reconciliation
  invariant: every record must be accounted for as imported-or-skipped, none silently dropped.
- `tests/json-migration.test.ts:34-36` — `if (summary.status !== 'FAILED') { assert.deepEqual(summary.errors,
  [], ...) }` — ties the status string to the script's own `errors.length > 0 ? 'FAILED' : ...`
  formula rather than just checking membership in a string enum.

No `||`-widened always-true condition remains in this file. `git log --oneline -- tests/json-migration.test.ts`
shows this was fixed in commit `38fdd3f9` ("test(QA-02): replace tautological migration-summary
assertion with real invariants"), and `git merge-base --is-ancestor 38fdd3f9 HEAD` returns exit 0 —
i.e. this fix **is** included in the current HEAD `02ed599d`.

**VERDICT: FIXED AND VERIFIED.** Note: `audit/new-02.md:101` and `:399` still list QA-02 as "STILL
OPEN, unchanged" — that claim is now **stale/contradicted** by the current working tree
(**DOCUMENTATION-IMPLEMENTATION MISMATCH** between `audit/new-02.md` and the actual current
`tests/json-migration.test.ts`). Whether `audit/new-02.md` predates commit `38fdd3f9` chronologically
was not independently timestamp-verified here, but regardless, the document's claim does not match
current source.

### `tests/evaluation-runner.test.ts` (QA-03, loose floor) vs. `tests/anti-hardcoding-guard.test.ts` (exact regression)

**EVIDENCE — loose floor, `tests/evaluation-runner.test.ts:21-23`:**
```ts
assert.ok(results.overall.precision >= 0.8, 'Expected Precision >= 80%');
assert.ok(results.overall.recall >= 0.8, 'Expected Recall >= 80%');
assert.ok(results.overall.f1Score >= 0.8, 'Expected F1-Score >= 80%');
```
This is genuinely loose — it would not catch a regression from e.g. 0.95 to 0.81.

**EVIDENCE — exact-value regression, same file, `tests/evaluation-runner.test.ts:43-65` ("Anti-Hardcoding
Suite"):**
```ts
const metrics1 = PrecisionRecallEngine.calculateMetrics({ tp: 10, fp: 2, fn: 3, tn: 25 });
assert.equal(metrics1.precision, 83.33); // 10 / 12 = 83.33%
assert.equal(metrics1.recall, 76.92);    // 10 / 13 = 76.92%
assert.equal(metrics1.f1Score, 80.0);
```
plus a second "Dynamic Mutation Suite" (`:67-92`) that mutates ground-truth/detections and asserts
the resulting metric **changes** (`assert.notEqual(mutBRes.recall, baseRes.recall)`), which is a
stronger guarantee than a static exact-value check alone (it proves the function is actually
sensitive to its inputs, not just returning one memorized correct-looking number).

**VERDICT: as reported by the prior audit — CONFIRMED, PARTIALLY MITIGATED.** The loose `>=0.8`
floor at `evaluation-runner.test.ts:21-23` is still exactly that (unchanged), but it now coexists
with real exact-value + input-mutation regression coverage of the underlying
`PrecisionRecallEngine` in the same file and in `tests/anti-hardcoding-guard.test.ts` (see §3). The
loose floor is a real but low-severity residual gap: it guards against catastrophic regression
(e.g. precision collapsing to 0.5) but not against a smaller regression staying above 0.8.

### Three additional security/regression files, read in full for tautologies/skips/weak thresholds

- **`tests/security-remediation.test.ts`** (all 282 lines read). 14 subtests covering: fail-closed
  JWT/refresh secret resolution outside dev/test (`:64-95`), rejection of short/placeholder secrets
  (`:97-104`), role-forgery clamping (`:106-116`), that public self-registration cannot mint an
  ADMIN JWT via live route call (`:118-139`), that `resolveBootstrapAdminPassword()` never returns
  the old hardcoded `'Admin123456!'` literal and differs across calls (`:141-155`), fail-closed
  bootstrap outside dev/test (`:157-167`), a live refresh-token-revocation round trip against the
  real route handlers (`:175-207`), a source-level regression guard for a Prisma `undefined`
  vs. `null` update bug (`:209-265`, see §11 below — this is the same bug I found live-fixed but
  **uncommitted** in the working tree), and rejection of a refresh token for a deleted user
  (`:267-281`). No `.skip`/`.todo`, no tautological pattern found — every assertion depends on
  actual return values/status codes from real function/route calls, several explicitly documented
  as *not* using the same call twice to avoid an accidental same-second false pass (`:193-195`).
- **`tests/regression-security.test.ts`** (44 lines, full file). 3 subtests: 413 on oversized scan
  payload (`:7-16`), 200 on a normal guest scan (`:18-28`), and 401 on unauthenticated IDOR access
  to `/api/projects/[id]` (`:30-42`) — with an explicit code comment (`:34-40`) noting a *previous*
  version of this exact test accepted 401/403/404 as an OR, which coincidentally passed only
  because the fixture ID didn't exist (a real historical tautology, now narrowed to `assert.equal(res.status,
  401)` only). No skips, no remaining looseness found.
- **`tests/api-security-audit.test.ts`** (409 lines, full file). 17 subtests: JWT
  missing/malformed/expired/tampered rejection (`:33-64`), role-based authorization (`:66-81`),
  privilege-escalation-via-registration blocked (`:83-96`), IDOR on `/api/projects/[id]` proven with
  a *real owned project* and distinguishing unauthenticated (401) vs. wrong-user (403) vs. owner
  (200) (`:136-171` — this is the strengthened version referenced by the
  `regression-security.test.ts` comment above), mass-assignment protection on PATCH (`:204-231`),
  notification IDOR (`:233-266`), PII masking in the public activity feed (`:268-283`), rate
  limiting on both a generic check (`:351-360`) and the specific `CHANGE_PASSWORD` action
  (`:362-385`), CORS allow-list correctness including explicit "wildcard never used" and
  "credentials never enabled" checks (`:387-408`), and API-key masking for admin listing
  (`:294-317`) plus cryptographically-secure API-key generation format checks (`:319-349`). No
  skips/todos; no tautological patterns found — every check inspects real response bodies/status
  codes/regex-matched key shapes from live route calls.

**VERDICT (3 spot-checked files): CLEAN.** No tautologies, no `.skip`/`.todo`, no suspiciously weak
thresholds found in `security-remediation.test.ts`, `regression-security.test.ts`, or
`api-security-audit.test.ts`. These read as genuinely adversarial, well-reasoned regression tests
with real narrative justification for each assertion (several document the exact prior bug/false-pass
mode they close).

---

## 3. QA — anti-hardcoding guard (Phase 19/22 supplement)

**CLAIM:** `tests/anti-hardcoding-guard.test.ts` guards against reintroduction of previously-fabricated
hardcoded metric/participant/credential values, and does so by real recomputation, not just
comparison against another hardcoded expectation.

**EVIDENCE:** Full file read (211 lines), 9 tests under `describe('Source-Level Anti-Hardcoding
Guard Suite')`:
1. `:28-39` — regex-asserts `PrecisionRecallEngine.calculateMetrics` has no default `matrix`
   parameter and no hardcoded `precision: 85.7|recall: 94.7|f1Score: 90.0` literal in source.
2. `:41-52` — regex-asserts `UserStudyEvaluator` computes Cronbach's alpha dynamically (contains
   `cronbachAlpha =` / `calculateAlpha` / `variances`) and has no hardcoded return-object literal.
3. `:54-65` — reads `EvaluationRunner.runEvaluation`'s method body via a regex match and asserts it
   does **not** read `canonical-evaluation.json`/`eval-summary.json` as an input (guards against
   circularity: the runner writing its own "proof").
4. `:67-109` — walks every `.ts` file under `src/eval/` and `src/engine/` and regex-scans each for
   10 specific previously-fabricated literal patterns (exact numbers: `85.71`, `94.74`, `90.00`,
   `0.892`, `86.4`, the exact retired `{tp:18,fp:3,fn:1,tn:25}` confusion matrix, etc.) — code
   comments (`:72-95`) document that a dead module carrying these exact literals as a fallback
   (`benchmark-data-loader.ts`) was deleted rather than patched, and that a prior version of the
   confusion-matrix regex missed a trailing-comma variant.
5. `:111-129` — a **behavioral** (not regex) test: calls
   `ResearchDataPipeline.getSyntheticModelProvenance()` live and asserts `isRealHumanData === false`
   and `datasetType === 'SYNTHETIC'`; separately asserts `validateParticipantRecord` rejects a
   record with `consentGiven: false`.
6. `:131-141` — calls `processUserStudyPipeline()` live against a nonexistent CSV path and asserts
   the resulting provenance report correctly reports `isRealHumanData: false`,
   `collectionStatus: 'NOT_COLLECTED'`, `validParticipantCount: 0`.
7. `:143-166` / `:168-183` — filesystem existence/content checks that 8 specific named fabrication
   scripts (e.g. `seed-85-developers.ts`) don't exist, plus a generalized pattern-match for *any*
   script defining a ≥10-name hardcoded array AND writing to the user DB.
8. `:185-197` — regex-checks `dissertation-exporter.ts` source doesn't contain
   `"primary data was collected"` or the specific fabricated SUS/satisfaction numbers (84.6, 92.4%,
   89.1%) or `"Grade A"`.
9. `:199-210` — a live route call: POSTs to `/api/user-study/log-scan` with a client-supplied
   `qualityScore: 99` and no real code, asserts 400 (not silently logged with a
   client-trusted/fabricated score), and regex-checks the route source doesn't read
   `clientScore`/`clientCount` fields or contain the old canned `FIGM-STANDARD-2026` fallback string.

**VERDICT: as described — mixed-mechanism, and mostly non-tautological.** Roughly half the tests
(1–4, 8) are **regex/text scans of source files** that assert the *absence* of specific
previously-fabricated literal values or patterns — these do not "recompute" anything; they are
purpose-built regression guards against reintroducing exact known-bad numbers, which is a
legitimate but narrower guarantee than independent recomputation (a differently-shaped hardcoded
fabrication, e.g. a new literal not in the banned list, would not be caught by tests 1/2/4/8 alone).
The other half (5, 6, 9, and 7's filesystem checks) **do** exercise real function/route calls and
check behavioral invariants rather than comparing against another hardcoded expectation. The actual
independent-recomputation coverage for precision/recall/F1 specifically (the headline "no fabricated
benchmark numbers" claim) lives in the adjacent tests inside `tests/evaluation-runner.test.ts:43-92`
(§2 above), which this file's test 1 only checks the absence of a hardcoded fallback for — the two
files are complementary, not redundant.

---

## 4. Type checking

**EVIDENCE:**
```
$ npx tsc --noEmit
EXIT:0
```
No output, clean exit.

**VERDICT: FIXED AND VERIFIED / clean.** No type errors.

---

## 5. Production hardening — PROD-02 (Phase 18)

**CLAIM:** `prisma/migrations/` now exists with a real baseline migration.

**EVIDENCE:**
```
$ ls prisma/migrations
20260818075914_init_baseline
migration_lock.toml
$ wc -l prisma/migrations/20260818075914_init_baseline/migration.sql
276 prisma/migrations/20260818075914_init_baseline/migration.sql
```
`prisma/schema.prisma` defines a real 12-table PostgreSQL schema (`users`, plus enums `UserRole`,
`ProjectStatus`, `NotificationType`, `AuditAction`, `ExportFormat`, etc. — `schema.prisma:14-40`
read directly). `migration.sql` contains real `CREATE SCHEMA`/`CREATE TYPE`/`CREATE TABLE`
statements matching the schema (`users`, and — per the migration file — 11 more tables).

`npx prisma migrate status` (read-only, safe to run per the task's own guidance — confirmed
`.env` contains a `DATABASE_URL` key without printing its value):
```
Prisma schema loaded from prisma\schema.prisma.
Datasource "db": PostgreSQL database "postgres", schema "public" at "aws-1-ap-south-1.pooler.supabase.com:5432"

1 migration found in prisma/migrations

Database schema is up to date!
```
This matches the fix commit `77e76fe9`'s own claim ("`prisma migrate status` now reports 'Database
schema is up to date'").

**NEW DEFECT FOUND — the migration.sql file itself is corrupted.** Byte-level inspection
(`xxd` on the first 200 bytes) shows the file's literal first line is:
```
Loaded Prisma config from prisma.config.ts.
```
followed by a blank line, then the real SQL starting with `-- CreateSchema`. This is Prisma CLI's
own stdout banner from `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`
(the exact command cited in commit `77e76fe9`'s message) — in this Prisma version the "Loaded
Prisma config..." banner is written to **stdout**, not stderr, so a plain `> migration.sql`
redirect captured it as the first line of the generated SQL file. This is not a SQL comment (no
leading `--`) and is not valid SQL — if this file were ever executed verbatim by `prisma migrate
deploy` against a **fresh** database (any environment where this migration isn't already recorded
as applied in `_prisma_migrations`, e.g. a new dev machine, CI, or disaster recovery), it would fail
with a syntax error on line 1 before ever reaching `CREATE SCHEMA`.

This defect was not caught by the fix commit's own verification because that verification (per the
commit message: "`prisma migrate deploy` immediately after confirmed a genuine no-op") ran against
the **already-baselined** live Supabase DB, where the migration is recorded as applied and its SQL
body is never re-executed — so the corrupted first line was never actually exercised.

**VERDICT: PROD-02 is FIXED for the specific symptom originally reported (no `prisma/migrations/`
folder, `migrate status` reporting "not managed by Prisma Migrate") — that specific complaint is
resolved and independently re-verified live above.** However, the fix introduced a new, narrower,
latent defect: **CONTRADICTED / new regression** — the committed `migration.sql` is not valid
standalone SQL and would break `prisma migrate deploy` on any environment other than the
already-baselined production database. This was not exercised or caught by the fix commit's own
"verified live" claims, which only tested the no-op path. Recommend: strip the leading CLI banner
line from `prisma/migrations/20260818075914_init_baseline/migration.sql` and re-verify with `prisma
migrate diff` output redirected via a method that separates stdout banners from `--script` SQL
output (e.g. `--exit-code` isn't relevant here, but capturing via a dedicated `-o`/file-output flag
if the installed Prisma version has one, or stripping the first non-SQL line before commit).

---

## 6. Production hardening — PROD-03 (Phase 18)

**CLAIM:** `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` are real branded pages, and
a favicon exists.

**EVIDENCE:** All three files read in full.
- `app/not-found.tsx` (56 lines) — real branded 404 page: glassmorphism card, shield emoji, "Page
  Not Found" heading, working `<Link href="/">Back to Overview</Link>`.
- `app/error.tsx` (91 lines) — `'use client'` route-level error boundary, receives `error`/`reset`
  props per Next.js App Router contract, logs to `console.error` (`:14-17`, with a comment
  explaining why), renders a branded "Something Went Wrong" card with working `reset()` button and
  a link home.
- `app/global-error.tsx` (60 lines) — root-layout-level error boundary, correctly renders its own
  complete `<html>/<body>` (required since this only fires when the root layout itself throws) with
  a code comment explaining why it deliberately avoids `globals.css`/other app modules (`:3-7`).

None of the three are trivial/empty stubs — each has real Next.js App Router semantics (correct
prop signatures, correct nesting behavior) and matching brand styling (dark glass cards, gradient
buttons, consistent with the rest of the app).

**Favicon:** `app/favicon.ico` / `public/favicon.ico` do **not** exist (`Glob` for both returned no
matches; the only `favicon.ico` files found repo-wide are inside `node_modules/@supabase/...` and
third-party benchmark fixture repos under `benchmarks/real-world/.repo-clones/`, none of which are
the app's own). Instead, `app/icon.svg` exists (10 lines, 480 bytes, read in full) — a real
non-empty SVG: a gradient rounded-square with "FI" lettering. This **is** a valid, non-empty
favicon under the Next.js 13+ App Router file-convention (`app/icon.(ico|jpg|jpeg|png|svg)` is
automatically served as the site favicon/icon metadata; `.ico` at `app/`/`public/` root is not
required).

**VERDICT: FIXED AND VERIFIED.** All three error-boundary pages are real, functional, and branded.
A favicon exists via `app/icon.svg` (Next.js convention), not `favicon.ico` — functionally
equivalent, verified non-empty and real (not a 0-byte placeholder).

---

## 7. Performance forensics (Phase 16)

**CLAIM:** direct engine benchmarking (bypassing HTTP/browser) on a small typical file and a
synthetic ~100KB file with many repeated violations.

**EVIDENCE:** Wrote `scratch/audit-perf-bench.ts`, calling
`RuleExecutionEngine.analyzeFile(filePath, code)` directly (confirmed exact signature at
`src/engine/rule-execution-engine.ts:36`), timed with `performance.now()`, 3 runs each, small file =
`benchmarks/testbed/ReactBenchmark.jsx` (1710 bytes, real fixture), large file = synthetically
generated 100096-byte / 843-line file with a repeated known-violation pattern (invariant object
literal inside `.map()` + inline arrow handler in JSX). Actual output:
```
Small file: ...\benchmarks\testbed\ReactBenchmark.jsx (1710 bytes)
  [small run 0] 187.189 ms, diagnostics=10, qualityScore=9
  [small run 1] 88.463 ms, diagnostics=10, qualityScore=9
  [small run 2] 60.669 ms, diagnostics=10, qualityScore=9

Synthetic large file: 100096 bytes, 843 repeated violation lines
  [large run 0] 1000.004 ms, diagnostics=2530, qualityScore=0
  [large run 1] 780.683 ms, diagnostics=2530, qualityScore=0
  [large run 2] 708.216 ms, diagnostics=2530, qualityScore=0
```
(First run of each size is slower — consistent with JIT/module warm-up, not algorithmic
degradation; results stabilize on repeat calls within the same process.)

**Existing committed performance-budget test:** `tests/qa-matrix-cross-cutting.test.ts:28-55`
("[Huge file] a 2000-violation, ~210KB file completes without throwing, in bounded time..."):
builds a 2000-line/~210KB fixture, asserts `elapsedMs < 15000` (`:54`) — i.e. the committed budget
is **under 15 seconds** for a file roughly 2x the size of my synthetic large file. This test is
part of the 52-file/666-test enumerated suite and passed in the full run (§1) — its own internal
budget assertion is real and currently satisfied.

**VERDICT: FIXED AND VERIFIED / no performance regression found.** My independently-run synthetic
~100KB file completed in 700ms–1s (well under any budget), and the larger committed 210KB/2000-violation
fixture has its own passing, non-trivial (`<15s`, not `<1000s`) budget assertion already in the
suite. No evidence of pathological scaling was observed across repeated runs.

---

## 8. Server stability — process-level (Phase 17 supplement)

**CLAIM:** no global `process.on('unhandledRejection', ...)` / `process.on('uncaughtException',
...)` handler exists anywhere in the app.

**EVIDENCE:** Repo-wide grep for both strings, excluding `node_modules`:
```
Found 5 files
scratch\audit-dynprofiler-safe.ts        <- my own/another prior audit's throwaway script, not app code
audit\new-02.md                          <- prose discussion in a prior audit doc, not code
benchmarks\real-world\raw-results\_combined-summary.json  <- benchmark data artifact, not code
benchmarks\real-world\METHODOLOGY.md     <- prose, not code
benchmarks\real-world\run-real-world-benchmark.ts  <- a benchmark harness script, not the app itself
```
None of the 5 matches are in `app/`, `src/`, `middleware.ts`, or any other application runtime path.
`middleware.ts` (67 lines, read in full) handles CORS and auth-redirect logic per-request but
registers no process-level handlers. Spot-checked `app/api/scan/route.ts` (2 `try {` blocks) and
`app/api/auth/login/route.ts` (1 `try {` block) — both use local per-route try/catch, consistent
with the pattern throughout the API surface, but this is request-scoped error handling, not a
process-wide safety net for unhandled promise rejections/exceptions outside any request context.

**VERDICT: CONTRADICTED (still absent — matches the prior audit's finding, no change).** No global
`unhandledRejection`/`uncaughtException` handler exists in application code. Per-route try/catch is
present and reasonably thorough where checked, which mitigates but does not eliminate the gap (a
genuinely unhandled async error outside any route handler's try/catch — e.g. inside a fire-and-forget
background operation — would still crash the Node process or fail silently depending on Next.js's
own runtime behavior, which was not further tested here).

---

## 9. Repo hygiene (Phase 0/19 supplement) — baseline numbers for other agents

**EVIDENCE (all commands run directly against current HEAD `02ed599d` + working-tree state):**
```
$ Get-ChildItem tests -Filter "*.test.ts" | Measure-Object   →  52 test files on disk
$ Get-ChildItem app/api -Filter "route.ts" -Recurse | Measure-Object   →  32 API route.ts files
$ [regex]::Matches((Get-Content src/matrix/four-layer-meta-model.ts -Raw), "ruleId: 'FIGM-").Count   →  25
```
**VERDICT — baseline numbers for this HEAD:**
| Metric | Count |
|---|---|
| `tests/*.test.ts` files on disk | **52** |
| Files enumerated in `package.json`'s `"test"` script | **52** (exact match, see §1) |
| `ruleId: 'FIGM-` occurrences in `src/matrix/four-layer-meta-model.ts` | **25** |
| `app/api/**/route.ts` files | **32** |
| Test count from actual run | **666** (see §1) |

---

## 10. Build

**NOT ATTEMPTED — explicitly skipped for safety, per this audit's own documented hazard.**
Checked `Get-NetTCPConnection -State Listen` for ports 3000/3001/3002 **repeatedly across the
session** (start, midpoint, and immediately before writing this section):
```
LocalPort OwningProcess
3002      14100
3001      29700
3000      35044
```
Three separate listening processes were present continuously throughout my entire session (not a
one-time snapshot) — consistent with another agent actively running `next dev` (and possibly having
restarted/rebound across 3000→3001→3002) for live browser/HTTP testing, per the coordination note.
Given the documented, previously-diagnosed hazard that running `next dev` and `next build`
concurrently against the same `.next` output directory crashes the build worker, and given these
processes never freed their ports during my session, I did not run `npm run build`. `npx tsc
--noEmit` (§4) and the full `npm test` run (§1) — both explicitly called out as safe to run
alongside a dev server — were completed successfully and are not affected by this gap. **Build
result: NOT VERIFIED this session, for the stated safety reason, not because it was attempted and
failed.**

---

## 11. Uncommitted working-tree changes found during this audit

Not one of the 10 numbered tasks directly, but material to interpreting results above: `git status
--porcelain=v1 -uno` shows several tracked files modified but **not committed** on top of HEAD
`02ed599d`, most notably:

- `app/api/auth/logout/route.ts` — changes `updateUser(auth.user.userId, { refreshToken: undefined
  })` to `{ refreshToken: null }`, with a code comment explaining Prisma's `update()` silently
  ignores `undefined`-valued fields (treats them as "not included"), so the prior code never
  actually cleared the refresh token against the real Prisma/Supabase-backed storage provider —
  meaning a stolen/leaked refresh token would remain valid for its full life even after logout.
- `src/auth/user-db.ts` — widens `refreshToken?: string` to `refreshToken?: string | null` to match.
- `tests/security-remediation.test.ts` — adds the two regression tests that verify this
  (`:209-265` in the version I read, "logout actually revokes the refresh token" and "source-level
  guard: the logout route clears refreshToken with null, never undefined").

**This fix is real and the tests for it pass** (confirmed as part of the 666/666 full-suite run in
§1, and read in full in §2). But **it is currently only in the uncommitted working tree**, not part
of HEAD `02ed599d` — `git diff app/api/auth/logout/route.ts src/auth/user-db.ts` shows it as an
unstaged modification. Any report characterizing HEAD `02ed599d` alone (e.g. from a fresh clone or
CI checkout of that exact commit, without the working tree) would **not** include this fix. Flagging
for the coordinating agent since this affects how "current state" claims should be scoped —
verified-in-working-tree is not the same as verified-in-HEAD here.

Also uncommitted: `tests/user-study-pipeline.test.ts` inclusion in `package.json`'s `"test"` script
(§1) — the current, already-in-place `package.json` I read at the top of this session already
listed it, and it is **not** among the modified files in `git status`, so that fix (NEW-06) **is**
committed as part of HEAD (unlike the logout fix above). Confirmed via `git status --porcelain=v1
-uno` showing no `M package.json` line.

---

## Summary reconciliation table

| ID | Prior status (per `audit/new-02.md` / task brief) | Current status (this session) | Evidence |
|---|---|---|---|
| PROD-01 | Fixed by `e065a6fe` (coordinator pre-confirmed) | **FIXED AND VERIFIED** (not re-verified independently here per instructions; `tests/security-headers.test.ts` source-level regression guard also present and passing) | §1 (passing), coordinator's own `next.config.mjs` read |
| PROD-02 | No `prisma/migrations/` | **PARTIALLY FIXED / new latent defect found** — folder + baseline now real and `migrate status` reports up to date, but `migration.sql`'s first line is corrupted CLI banner text, not valid SQL, would break `migrate deploy` on a fresh DB | §5 |
| PROD-03 | No custom error pages / no favicon | **FIXED AND VERIFIED** — real branded `not-found.tsx`/`error.tsx`/`global-error.tsx`, favicon via `app/icon.svg` | §6 |
| QA-02 | "STILL OPEN" per `audit/new-02.md:101` | **FIXED AND VERIFIED** — `audit/new-02.md` is stale on this point; commit `38fdd3f9` (ancestor of HEAD) replaced the tautology with real invariants | §2 |
| QA-03 | "PARTIALLY MITIGATED" | **CONFIRMED, still partially mitigated, unchanged** — loose `>=0.8` floor still present, coexists with exact-value/mutation regression tests | §2 |
| NEW-06 | Test file silently excluded from `"test"` script | **FIXED AND VERIFIED** — file now enumerated, 52/52 disk-vs-script match, part of the committed HEAD | §1 |
| NEW-07 | Missing regression-test fixture for a `'use client'`+`FIGM-NEXT-03` edge case | **NOT IN SCOPE of this session's tasks** (unrelated to QA/perf/production tasks assigned) — not investigated | — |
| (new) | — | **Global `unhandledRejection`/`uncaughtException` handler: still absent** | §8 |
| (new) | — | **Uncommitted logout-revocation fix** (`refreshToken: undefined → null`) present in working tree but not in HEAD `02ed599d` | §11 |
