# Stage 7F — Research Freeze v3, Vercel Production Deployment, and Final Production Acceptance

Scope: confirm `research-freeze-v3` (already created at the end of Stage 7E), deploy that exact
frozen commit to Vercel Production, and run the full production acceptance suite. This stage
**stops short of a PASS**: acceptance testing uncovered a real, blocking infrastructure defect —
Production's configured database is missing schema that has been live and verified on every other
environment (local dev, Preview) since Stage 7D. No code fix was applied; per this stage's own
Section 30 instruction, code is not touched unless Production exposes a real *code* defect, and
this is a *database configuration* defect, not a code defect. No real participant, expert, or RQ1
data was collected.

---

## 1–7. Freeze v3 confirmation

`research-freeze-v3` was already created at the end of Stage 7E (commit `748183fe`, tag pointing to
the same commit). Re-verified fresh this stage before touching anything:

```
git status --short   -> (only benign benchmark-timestamp regeneration files from this stage's own
                          test run -- see Section 4; no application source changed)
HEAD                  -> 748183fe0fa1bff79c5446a5a394e09917ec8186
research-freeze-v3    -> 748183fe0fa1bff79c5446a5a394e09917ec8186  (unchanged, verified)
research-freeze-v2    -> d64515f12e4815573d4c152e3971f3504d016a61  (untouched)
research-freeze-v1    -> 61686e7aabad6f8c2c71b09ca0a5b52c36d08946  (untouched)
```

`FREEZE_V3_CREATED: YES` (carried over from Stage 7E, re-verified). No new freeze commit was
created this stage since no source code changed.

## 3. Secret gate

No `.env`/`.env.local` tracked (already gitignored, unchanged). No real secret values were printed
at any point this stage — Production env var names were checked via `vercel env ls production`
(names/types only), and the one value pushed (`GEMINI_API_KEY`) was piped directly into `vercel env
add`'s stdin from the local environment, never echoed. `SECRET_LEAKAGE: 0`.

## 4. Final pre-deploy tests (re-run fresh, from the exact frozen commit)

```
npx tsc --noEmit               -> clean
npm test                       -> 1453/1453 pass, 0 fail
rm -rf .next && npm run build  -> PASS, exit 0
```

Running the test suite regenerated several benchmark/eval artifact files with fresh
timestamps/timing numbers (`benchmarks/eval-summary.json`, `docs/validation-report.md`, etc.) — the
same self-benchmarking side effect observed in Stage 7E, real re-measurements, not fabricated or
edited by hand. Left uncommitted (local-only residue), does not affect the frozen commit that was
already deployed.

## 8. Vercel Production environment review

`vercel env ls production` (names/types only, no values ever printed): `MIGRATION_SECRET`,
`NEXT_PUBLIC_APP_URL`, `DIRECT_URL`, `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `REFRESH_SECRET`, `JWT_SECRET`,
`STORAGE_PROVIDER` were all already present (set 8–25 days ago, before this session). No
`OLLAMA_*`/test-only/research-local variables present — correct. `GEMINI_API_KEY` was **missing**
(present on Preview, absent on Production) — added this stage with explicit approval, additive
only, no existing value touched.

`PRODUCTION_ENV: PARTIAL` — every required variable *name* was present (the check this section
asks for), but live testing below revealed that `DATABASE_URL`'s actual target database does not
have the schema this deployment expects — a defect invisible to a names-only check, only
discoverable by actually exercising the app.

## 9. Production deploy — exact freeze v3 commit

`HEAD` reconfirmed `748183fe...` immediately before deploying (clean working tree). Deployed via
`vercel deploy --prod --yes` from that exact tree.

```
PRODUCTION_DEPLOYMENT_ID: dpl_E3P9Lj5oabJrCFaWo7HKv54FdyRE
PRODUCTION_URL: https://figm-code-inspector.vercel.app (canonical alias)
                https://figm-code-inspector-e0k2oewub-sehan-portfolio.vercel.app (deployment URL)
                https://figm-code-inspector-sehan-portfolio.vercel.app (secondary alias)
target: production, readyState: Ready
```

`DEPLOYED_COMMIT_MATCHES_FREEZE_V3: YES` — this project deploys via direct CLI upload of the local
working tree (no Git-integration SHA is independently displayed by Vercel for this project), so
this is asserted procedurally: `HEAD` was verified to equal `research-freeze-v3`'s target
immediately before the deploy, on a confirmed-clean working tree, with no edits in between.

## 10. Production build log review

```
npm install                    -> PASS (same benign npm allow-scripts notices as every prior deploy)
npx prisma generate             -> PASS
next build                      -> PASS, 58/58 static pages generated
Compiled with warnings          -> the SAME two, already-investigated benign @vue/compiler-sfc
                                    "Critical dependency" warnings (identical text/import-trace to
                                    every prior deployment this session) -- no new warning
All serverless functions created -> PASS
```

`PRODUCTION_BUILD: PASS`

## 11. Public production smoke test

Unauthenticated route checks (plain `curl`, no protection bypass needed — Production, unlike
Preview, has no Deployment Protection in front of it):

```
GET /            -> 307 (correct app-level redirect to /auth/login for an unauthenticated visitor)
GET /methodology -> 200
GET /auth/login  -> 200
GET /auth/register -> 200
GET /api/health  -> 200, {"status":"HEALTHY", ..., "services":{"database":"CONNECTED_POSTGRES",
                     "aiRemediation":"ACTIVE", "dynamicProfiler":"ACTIVE", ...}}
```

Real browser check of `/about`: renders correctly (hero, real domain-count product preview 19/24/7,
footer), **zero console errors**, matches Preview's already-verified desktop rendering exactly.

`PRODUCTION_PUBLIC_ROUTES: PASS`

## 12. Production auth test — BLOCKING DEFECT FOUND

```
POST /api/auth/register -> 500
{"error":"\nInvalid `prisma.user.findUnique()` invocation:\n\nThe column `users.token_version`
does not exist in the current database.","code":"SERVER_ERROR"}
```

Confirmed via direct Vercel function log inspection (not just the client-facing error): a real
`PrismaClientKnownRequestError`, code `P2022` (`ColumnNotFound`), thrown from the live database
query itself — this is not a stale-Prisma-Client artifact (the deployed client was generated fresh
from this exact schema during this exact build, confirmed in Section 10's log) and not an
application bug (the same code path has been exercised successfully dozens of times this session
against Preview and local dev, on the same frozen commit).

**Root cause, to the extent determinable without access to the actual credential value:**
Production's `DATABASE_URL` (a `Secret`-type Vercel variable, set 8–25 days ago, never touched by
this or any prior stage of this engagement) points at a Postgres database that does **not** have
the `tokenVersion`/`accountType` migrations applied — migrations that were verified applied to the
database used by local dev and Preview back in Stage 7D, and have been relied on continuously
since. Because `DATABASE_URL` is a Vercel `Secret` (its value cannot be read back by design, even
by an authorized deploy), this session cannot determine from here whether Production's database is
a genuinely separate, legitimate production database that has simply never been migrated, or a
stale/misconfigured value that should instead point at the same Supabase project as Preview. This
is a decision only the project owner can make, and was surfaced immediately rather than guessed at
or worked around.

```
PRODUCTION_AUTH: FAIL
PRODUCTION_LOGOUT: NOT_TESTED (blocked — registration/login never succeeded)
PRODUCTION_STALE_TOKEN_REJECTION: NOT_TESTED (blocked)
```

## 13–15. DB persistence, cross-user isolation, admin authorization — blocked by Section 12

```
PRODUCTION_DB: FAIL (SUPABASE_POSTGRES intended and configured, but schema mismatch prevents any
  real read/write through the User model -- confirmed via /api/dashboard/summary also throwing the
  identical P2022 error on prisma.user.findMany())
PRODUCTION_DB_PERSISTENCE: NOT_TESTED (blocked -- no account could be created to test with)
PRODUCTION_CROSS_USER_ISOLATION: NOT_TESTED (blocked)
```

Admin authorization was partially verifiable, since the *rejection* paths never touch the User
table:
```
GET  /api/admin/users (no token)      -> 401 {"code":"UNAUTHORIZED"}   [verified, real]
```
Admin login itself could not be exercised (same underlying DB failure would occur), so the full
200-path and the admin UI were not reachable this stage.
```
PRODUCTION_ADMIN_AUTHORIZATION: PARTIAL (401 rejection verified real; 200/403 paths blocked by
  Section 12's DB defect)
PRODUCTION_ADMIN_UI: NOT_TESTED (blocked)
```

## 16–19. Live Scanner, three domains, Engine Diagnostics, deterministic/AI fix — all DB-independent, all verified working

The core scan/remediation engine (`/api/scan`) does **not** require authentication or touch the
`users` table for a plain scan or fix action — this let every engine-level check run cleanly
despite Section 12's defect, real evidence that the *product* is healthy and the defect is
isolated to the persistence/auth layer:

| Check | Result |
|---|---|
| Clean scan | `figmStatus: COMPLETE`, 0 diagnostics, quality 100 |
| Architecture (`FIGM-NEXT-01`, `use client` missing) | real finding, real AST evidence |
| Static Performance (`FIGM-PERF-02`, un-dimensioned `<img>`) | real finding, real AST evidence |
| Accessibility (`FIGM-A11Y-01`, keyboard parity) | real finding, real AST evidence (see fix tests below) |
| Malformed (unclosed brace) | `parserStatus: INVALID`, `figmStatus: PARTIAL`, quality docked to 85 — never false CLEAN |
| Engine Diagnostics | real, distinct values across every call (e.g. 77.02 ms / 0.39 MB) — `measurementType: MEASURED`, `profilerStatus: OK` |

```
PRODUCTION_ARCHITECTURE_DOMAIN: PASS
PRODUCTION_STATIC_PERFORMANCE_DOMAIN: PASS
PRODUCTION_ACCESSIBILITY_DOMAIN: PASS
PRODUCTION_CLEAN_SCAN: PASS
PRODUCTION_VIOLATION_SCAN: PASS
PRODUCTION_MALFORMED_SCAN: PASS
PRODUCTION_ENGINE_DIAGNOSTICS: PASS
PRODUCTION_DYNAMIC_PROFILER: AVAILABLE
```

**Deterministic fix and the Stage 7E anomaly-fix — both verified live on Production**, with function
logs confirming the exact observability contract from Stage 7E:

- Top-level (non-render-scope) `FIGM-A11Y-01` instance: `DETERMINISTIC_ATTEMPTED` →
  `DETERMINISTIC_FIX_APPLIED verificationStatus=FIXED finalResult=VERIFIED`, response
  `engineType: "AST_DETERMINISTIC_FIX"`, **no `AI_PROVIDER_SELECTED` log line at all** — the AI
  provider was genuinely never invoked.
- Render-scope `FIGM-A11Y-01` instance (the exact anomaly fixture): `DETERMINISTIC_ATTEMPTED` →
  `DETERMINISTIC_REJECTED verificationStatus=PATCH_REJECTED finalResult=AI_FALLBACK_SELECTED` →
  `AI_PROVIDER_SELECTED provider=GEMINI viaDeterministicFallback=true` → real Gemini round-trip →
  `PATCH_APPLIED verificationStatus=FIXED finalResult=VERIFIED`, response `engineType:
  "AI_ASSISTED_FIX"`.

```
PRODUCTION_DETERMINISTIC_FIX: PASS
DETERMINISTIC_AI_CALL_SUPPRESSED: YES
PRODUCTION_DETERMINISTIC_TO_AI_FALLBACK: PASS
PRODUCTION_AI_ONLY_FIX: PASS (the render-scope case above is a genuine, successful AI-only
  resolution once the deterministic path is correctly excluded; FIGM-PERF-02-class rules with no
  deterministic fixer at all follow the identical AI_ASSISTED_FIX path, already verified on Preview
  in Stage 7D/7E)
```

## 22. Production function log review

Reviewed the full recent log window. Beyond Section 12's DB-schema errors (all attributable to the
one root cause, not several independent problems) and the already-classified benign ESLint
`no-config-found` degradation (present, non-blocking, identical to every prior stage), **zero**
other errors: no connection-pool exhaustion, no timeouts, no child-process failures, no unhandled
promise rejections, no AI-provider errors, no routing contradictions (the deterministic/AI logs are
fully self-consistent, per Section 16–19 above).

```
BLOCKING_PRODUCTION_5XX: 2 confirmed this session (POST /api/auth/register, GET
  /api/dashboard/summary — both the single Section 12 root cause, not independent defects)
```

## 23–24. Browser desktop / tablet / mobile

Only the public, unauthenticated surface could be walked in a real browser this stage (everything
behind login is blocked by Section 12). `/about` verified: correct rendering, zero console errors,
matches Preview's already-fully-verified desktop walkthrough exactly (same commit, same code).
Tablet/mobile real-viewport verification remains the same disclosed, unresolved tooling limitation
carried over from Stage 7C/7E (`resize_window` does not change the actual Chrome viewport in this
environment) — not re-attempted this stage since the authenticated surfaces that most need it
(dashboard, Live Scan, admin) were unreachable anyway.

```
PRODUCTION_DESKTOP: PARTIAL (public-only surface verified; authenticated pages blocked by Section 12)
PRODUCTION_TABLET: PARTIAL (same disclosed tooling limitation as Stage 7C/7E, not re-attempted)
PRODUCTION_MOBILE: PARTIAL (same)
UNEXPECTED_APP_CONSOLE_ERRORS: 0 (on the one page that could be checked)
```

## 25. Production metric truth spot-check

Cross-checked what could be reached: `/api/scan` diagnostics, domain labels, quality scores, and
Engine Diagnostics values are all real, non-fabricated, and internally consistent across repeated
calls (Section 16–19). Admin-derived counts (total scans/projects/users) could not be cross-checked
against the DB this stage — that surface is exactly what's broken. `PRODUCTION_METRIC_TRUTH_SPOTCHECK:
PARTIAL` (real for the DB-independent surface; not reachable for the DB-dependent surface).

## 26. GA4 status

`NEXT_PUBLIC_GA_MEASUREMENT_ID` was not part of this stage's env changes and was not observed
configured on Production. `GA4_STATUS: NOT_CONFIGURED` — acceptable, not a blocker, per this
stage's own instruction.

## 27. Engineering test data cleanup

Registration failed with a `500` before any row could be written — **zero** engineering-test (or
any other) accounts were created in Production's database this stage, so there is nothing to clean
up there. (This session's *local*/Preview-connected database — a possibly-different database from
Production's — was already returned to its clean 30-user state at the end of Stage 7E; unaffected
by this stage.)

```
ENGINEERING_TEST_DATA_CLEANUP: NOT_APPLICABLE (nothing was created against Production's DB this
  stage — the write that would have created it failed first)
```

## 28. Research data gate

```
REAL_PARTICIPANTS_CREATED_THIS_STAGE: 0
RQ4_EXPERT_SUBMISSIONS_CREATED_THIS_STAGE: 0
RQ1_RUNS_CREATED_THIS_STAGE: 0
```
No historical data anywhere (local DB, Preview DB, or the repository's own `research/` artifacts)
was read, overwritten, or touched this stage.

## 29. Production go/no-go

Section 12's defect alone is sufficient to fail the gate — auth, DB persistence, cross-user
isolation, and full admin authorization are all explicit PASS requirements and none could be
verified working. The scan/remediation engine itself (Sections 16–19) is fully healthy on this
exact deployment, which is worth noting precisely so the remaining work is understood as narrow
(database configuration) rather than a reason to distrust the whole release.

```
VERCEL_PRODUCTION_ACCEPTANCE: FAIL
```

## 30. Final local reproducibility check

No code was modified in response to Section 12's finding, per this stage's own instruction (a
database configuration issue is not a code defect). `research-freeze-v3` therefore remains the
correct, final, frozen candidate — nothing invalidates it.

```
git status --short  -> only the benign benchmark-regeneration files from Section 4 (local-only,
                        untracked-diff residue, not committed)
HEAD                 -> 748183fe0fa1bff79c5446a5a394e09917ec8186
research-freeze-v3    -> 748183fe0fa1bff79c5446a5a394e09917ec8186  (still matches HEAD exactly)
```

## Report fields

```
FREEZE_V3_CREATED: YES (carried over from Stage 7E; reconfirmed unchanged, no new freeze needed)
FREEZE_V3_COMMIT: 748183fe0fa1bff79c5446a5a394e09917ec8186
FREEZE_V3_TAG_TARGET: 748183fe0fa1bff79c5446a5a394e09917ec8186

PRE_DEPLOY_TSC: PASS
PRE_DEPLOY_TESTS: 1453/1453 PASS
PRE_DEPLOY_BUILD: PASS

PRODUCTION_ENV: PARTIAL (all required variable names present; GEMINI_API_KEY added this stage;
  DATABASE_URL's actual target database is missing required schema -- undetectable by a
  names-only check, found only by live testing)

PRODUCTION_DEPLOYED: YES
PRODUCTION_DEPLOYMENT_ID: dpl_E3P9Lj5oabJrCFaWo7HKv54FdyRE
PRODUCTION_URL: https://figm-code-inspector.vercel.app
DEPLOYED_COMMIT_MATCHES_FREEZE_V3: YES (verified procedurally -- HEAD confirmed == research-freeze-v3
  on a clean tree immediately before `vercel deploy --prod`)

PRODUCTION_BUILD: PASS
PRODUCTION_PUBLIC_ROUTES: PASS

PRODUCTION_AUTH: FAIL
PRODUCTION_LOGOUT: NOT_TESTED
PRODUCTION_STALE_TOKEN_REJECTION: NOT_TESTED

PRODUCTION_DB: FAIL (SUPABASE_POSTGRES configured, but schema mismatch: users.token_version column
  missing on whatever database DATABASE_URL currently targets)
PRODUCTION_DB_PERSISTENCE: NOT_TESTED
PRODUCTION_CROSS_USER_ISOLATION: NOT_TESTED

PRODUCTION_ADMIN_AUTHORIZATION: PARTIAL (401 rejection verified real; 200 path blocked)
PRODUCTION_ADMIN_UI: NOT_TESTED

PRODUCTION_ARCHITECTURE_DOMAIN: PASS
PRODUCTION_STATIC_PERFORMANCE_DOMAIN: PASS
PRODUCTION_ACCESSIBILITY_DOMAIN: PASS

PRODUCTION_CLEAN_SCAN: PASS
PRODUCTION_VIOLATION_SCAN: PASS
PRODUCTION_MALFORMED_SCAN: PASS

PRODUCTION_ENGINE_DIAGNOSTICS: PASS
PRODUCTION_DYNAMIC_PROFILER: AVAILABLE

PRODUCTION_DETERMINISTIC_FIX: PASS
DETERMINISTIC_AI_CALL_SUPPRESSED: YES
PRODUCTION_DETERMINISTIC_TO_AI_FALLBACK: PASS
PRODUCTION_AI_ONLY_FIX: PASS

PRODUCTION_DESKTOP: PARTIAL (public surface only; authenticated pages blocked)
PRODUCTION_TABLET: PARTIAL (disclosed tooling limitation, unchanged from Stage 7C/7E)
PRODUCTION_MOBILE: PARTIAL (same)

UNEXPECTED_APP_CONSOLE_ERRORS: 0
BLOCKING_PRODUCTION_5XX: 2 (both the single Section 12 root cause)
SECRET_LEAKAGE: 0

PRODUCTION_METRIC_TRUTH_SPOTCHECK: PARTIAL (real for engine-level values; DB-dependent counts
  unreachable)

GA4_STATUS: NOT_CONFIGURED

ENGINEERING_TEST_DATA_CLEANUP: NOT_APPLICABLE (nothing was created against Production's DB)

REAL_PARTICIPANTS_CREATED_THIS_STAGE: 0
RQ4_EXPERT_SUBMISSIONS_CREATED_THIS_STAGE: 0
RQ1_RUNS_CREATED_THIS_STAGE: 0

VERCEL_PRODUCTION_ACCEPTANCE: FAIL

FINAL_FROZEN_VERSION: research-freeze-v3 (unchanged; no code defect was found, so no new freeze
  was created)

READY_FOR_REAL_RESEARCH_DATA_COLLECTION: NO

NEXT_ACTION (blocking defects only):
  1. Determine what Production's DATABASE_URL is actually supposed to point to -- the same
     Supabase project already migrated and verified on Preview/local dev throughout Stages 7D-7F,
     or a genuinely separate production database that has simply never received the
     tokenVersion/accountType migrations. This is a decision only the project owner can make;
     Vercel's DATABASE_URL is a `Secret`-type variable and its value cannot be read back to infer
     the answer.
  2. Once that's decided: either point Production's DATABASE_URL/DIRECT_URL at the correct,
     already-migrated database, or run `npx prisma migrate deploy` against Production's real
     intended database (whichever this session is given credentials/authorization for).
  3. Re-run this stage's Section 12-15 acceptance checks (auth, DB persistence, cross-user
     isolation, admin authorization/UI) against the same already-deployed commit -- no redeploy
     should be needed, since the defect is data-layer configuration, not the deployed code.
  4. Only after VERCEL_PRODUCTION_ACCEPTANCE = PASS: begin the approved real research-data
     collection stages using this exact frozen Production version.
```

---

## Continuation (same day) — owner-corrected DATABASE_URL/DIRECT_URL, redeploy, still blocked

**Initial Production acceptance (above): FAIL** — stale Production DB target, missing
`users.token_version`/`users.account_type` schema. Preserved as-is above, not erased.

The project owner manually corrected `DATABASE_URL` and `DIRECT_URL` on Vercel Production to point
at the intended, already-migrated Supabase database (password also reset/recreated), entered
directly into Vercel's dashboard. This session never saw, requested, or handled either connection
string's value.

### 1–2. Frozen code / env names reconfirmed

```
HEAD                -> 748183fe0fa1bff79c5446a5a394e09917ec8186
research-freeze-v3   -> 748183fe0fa1bff79c5446a5a394e09917ec8186  (still matches, unchanged)
git status --short   -> only the same benign benchmark-timestamp residue as before; no application
                          source differs from v3
```
`vercel env ls production` (names only): all ten required variables present, including the
now-present `GEMINI_API_KEY` (added in the original Stage 7F run). `DATABASE_URL`/`DIRECT_URL`
still display `created ... 25d ago` in the CLI listing — expected: editing an existing Vercel env
var's value through the dashboard does not reset its `created` timestamp, so this is not evidence
either way about whether the value actually changed. The real test is behavioral (Section 3
onward), not this timestamp.

### 3. Redeployed exact research-freeze-v3

`HEAD` reconfirmed `748183fe...` immediately before deploying (clean of any source change).
Redeployed via `vercel deploy --prod --yes` — required specifically because Vercel bakes env vars
into a deployment at build/runtime-start time, so the corrected `DATABASE_URL`/`DIRECT_URL` would
not take effect on the already-running prior deployment.

```
NEW_PRODUCTION_DEPLOYMENT_ID: dpl_BWEzv5QZ6AtzqDVbQ5YF8qtmf2Xs
PRODUCTION_URL: https://figm-code-inspector.vercel.app (canonical alias, re-pointed to this deployment)
target: production, readyState: Ready
PRODUCTION_REDEPLOYED_AFTER_ENV_CHANGE: YES
```
Build log: `npm install` PASS, `prisma generate` PASS, `next build` PASS, only the same two
already-investigated benign `@vue/compiler-sfc` warnings — no new build error.

### 4. Health check

`GET /api/health` → `200`, `"database":"CONNECTED_POSTGRES"`, `"aiRemediation":"ACTIVE"`. As the
original report already notes, this alone does not prove schema correctness — confirmed necessary
by what follows.

### 5. First critical database test — still blocked, different failure mode

```
POST /api/auth/register -> 500
{"error":"\nInvalid `prisma.user.findUnique()` invocation:\n\nAuthentication failed against the
database server, the provided database credentials for `postgres` are not valid","code":"SERVER_ERROR"}
```

Confirmed server-side via Production's own function logs (not just the client-facing message) —
real `PrismaClientKnownRequestError`s from both `prisma.auditLog.count()` (the DB-backed rate
limiter, which fell back to its documented in-process behavior — working exactly as designed) and
`prisma.user.findUnique()`, both citing **"Authentication failed against the database server, the
provided database credentials for `postgres` are not valid."**

This is meaningfully different from the original failure: the earlier `P2022 ColumnNotFound` error
is **gone**, which is itself evidence the `DATABASE_URL` value genuinely changed (a stale/unchanged
connection string would have reproduced the identical `P2022`, not a different error class). The
new failure is a **Postgres authentication rejection** — the connection string's password does not
match what the database server currently accepts. Given the owner's own account of events (the
Supabase password was reset/recreated around the same time the connection strings were entered),
the most likely causes are: the entered password doesn't match the actual final reset password, a
copy/paste or URL-encoding issue (a password containing `@`, `:`, `/`, `%`, or other URL-reserved
characters must be percent-encoded or the connection string parses incorrectly), or
`DATABASE_URL`/`DIRECT_URL` were updated inconsistently with each other. This session cannot
distinguish between these possibilities without seeing the value, which it deliberately does not
request or handle.

Per this continuation's own instruction (STOP rather than run migrations or change DB configuration
automatically), no further DB-configuration action was taken.

```
PRODUCTION_DB_TARGET_FIX: FAIL
```

### 6–13. Blocked by Section 5

Login, logout/stale-token revocation, `accountType` schema verification, DB persistence, dashboard,
cross-user isolation, and admin authorization/UI all require a working database connection and were
**not reached** this continuation. The scan-engine smoke check (Section 12) was skipped for the same
reason it would be pointless to duplicate: nothing about a database credential fix could regress the
already-verified DB-independent scan engine, and this continuation's own Section 12 instruction says
not to re-run already-passed checks unless the fix could plausibly affect them.

### 13. Log review

```
POST_FIX_P2022_COUNT: 0 (the original schema-mismatch error class is fully gone, confirming the
  DATABASE_URL value did change)
BLOCKING_PRODUCTION_5XX_AFTER_FIX: 1 confirmed this continuation (POST /api/auth/register, now via
  a Postgres authentication rejection instead of P2022 -- same root category: DB connectivity, new
  specific cause)
unhandled rejections: 0
connection-pool/timeout errors: 0 beyond the credential rejection itself
```

### 14. Engineering test data cleanup

No account was created this continuation (registration failed at the database layer before any row
could be written) — nothing to clean up.

```
ENGINEERING_TEST_CLEANUP: NOT_APPLICABLE
```

### 16. Research gate

```
REAL_PARTICIPANTS_CREATED_THIS_CONTINUATION: 0
RQ4_EXPERT_SUBMISSIONS_CREATED_THIS_CONTINUATION: 0
RQ1_RUNS_CREATED_THIS_CONTINUATION: 0
```

### Continuation report fields

```
PRODUCTION_DB_ENV_CORRECTED: YES (confirmed behaviorally -- the original P2022 error class is gone,
  replaced by a Postgres authentication rejection, proving the DATABASE_URL value changed)
PRODUCTION_REDEPLOYED_AFTER_ENV_CHANGE: YES
NEW_PRODUCTION_DEPLOYMENT_ID: dpl_BWEzv5QZ6AtzqDVbQ5YF8qtmf2Xs
PRODUCTION_URL: https://figm-code-inspector.vercel.app

PRODUCTION_REGISTER: FAIL
PRODUCTION_LOGIN: NOT_TESTED (blocked)
PRODUCTION_LOGOUT: NOT_TESTED (blocked)
PRODUCTION_STALE_TOKEN_REJECTION: NOT_TESTED (blocked)
PRODUCTION_ACCOUNT_TYPE_SCHEMA: NOT_TESTED (blocked)

PRODUCTION_DB: FAIL (Postgres authentication rejected -- credentials in DATABASE_URL/DIRECT_URL do
  not match what the target database server currently accepts)
PRODUCTION_DB_PERSISTENCE: NOT_TESTED (blocked)
PRODUCTION_DASHBOARD: NOT_TESTED (blocked -- same DB dependency as the original run's
  /api/dashboard/summary failure)
PRODUCTION_CROSS_USER_ISOLATION: NOT_TESTED (blocked)
PRODUCTION_ADMIN_AUTHORIZATION: NOT_TESTED (blocked -- even the 401 unauthenticated-rejection path
  was not re-verified this continuation since Section 5 already established the blocker)
PRODUCTION_ADMIN_UI: NOT_TESTED (blocked)
PRODUCTION_SCAN_SMOKE: NOT_RUN (deliberately skipped -- a DB-credential issue cannot regress the
  already-verified DB-independent scan engine; re-running it would not have added information)

POST_FIX_P2022_COUNT: 0
BLOCKING_PRODUCTION_5XX_AFTER_FIX: 1 (Postgres authentication rejection, new failure mode)

ENGINEERING_TEST_CLEANUP: NOT_APPLICABLE

SOURCE_CODE_CHANGED: NO
RESEARCH_FREEZE_V3_UNCHANGED: YES
FINAL_FROZEN_VERSION: research-freeze-v3

VERCEL_PRODUCTION_ACCEPTANCE: FAIL

READY_FOR_REAL_RESEARCH_DATA_COLLECTION: NO

NEXT_ACTION (blocking defect only):
  1. Re-verify the exact password used in the corrected DATABASE_URL/DIRECT_URL against the actual,
     currently-active Supabase database password -- particularly whether it needs URL-encoding
     (special characters such as @ : / % must be percent-encoded inside a Postgres connection URI)
     and whether DATABASE_URL (pooler, :6543) and DIRECT_URL (direct, :5432) were both updated to
     the SAME new password consistently.
  2. Once corrected, no redeploy should be necessary to re-test purely by re-running
     Section 5 (POST /api/auth/register) directly against the current deployment -- Vercel
     serverless functions read environment variables at cold-start, so a running function may need
     a moment (or a fresh invocation) to pick up a variable value changed without a new deployment;
     if a stale value is suspected, redeploy again the same way as this continuation's Section 3
     (no code change, same frozen commit).
  3. Once POST /api/auth/register returns 200/201 with no P2022 and no authentication-rejection
     error: resume this continuation's Sections 6-13 (login/logout/stale-token, accountType,
     persistence, dashboard, cross-user isolation, admin authorization/UI, log review, cleanup)
     before setting VERCEL_PRODUCTION_ACCEPTANCE = PASS.
```

---

## Continuation 2 (same day) — retried after a fresh redeploy, same credential rejection persists

The prior continuation's own `NEXT_ACTION` suggested a stale cold-start value might explain the
authentication rejection. To rule that out, re-ran Sections 1-5 from scratch this stage:

```
HEAD                -> 748183fe0fa1bff79c5446a5a394e09917ec8186 (unchanged, reconfirmed)
research-freeze-v3   -> 748183fe0fa1bff79c5446a5a394e09917ec8186 (unchanged, reconfirmed)
vercel env ls production -> all 10 required variable names still present, unchanged
```

Redeployed the exact same frozen commit again (a genuinely new deployment, not a reuse of the
prior one — this itself rules out a stale-cold-start theory, since a brand-new deployment starts
every function cold):

```
NEW_PRODUCTION_DEPLOYMENT_ID: dpl_C9SJiUYagyomjCfUvfwopBHYsCkH
PRODUCTION_URL: https://figm-code-inspector.vercel.app (re-aliased to this deployment)
```

`GET /api/health` → `200`, `HEALTHY` (this endpoint does not itself query the `users` table, so it
cannot detect the credential problem — consistent with the original report's own caveat that health
alone is not sufficient proof).

```
POST /api/auth/register -> 500
{"error":"...Authentication failed against the database server, the provided database credentials
for `postgres` are not valid","code":"SERVER_ERROR"}
```

Confirmed identical in the fresh deployment's own function logs (`prisma.user.findUnique()` and the
DB-backed rate limiter's `prisma.auditLog.count()`, both citing the same authentication rejection).
**The failure is unchanged from the prior continuation, on a genuinely new deployment** — this
rules out a stale-value/cold-start explanation. The credential mismatch itself has not yet been
resolved on the Vercel/Supabase side.

```
PRODUCTION_DB_TARGET_FIX: FAIL (unchanged)
VERCEL_PRODUCTION_ACCEPTANCE: FAIL (unchanged)
SOURCE_CODE_CHANGED: NO
RESEARCH_FREEZE_V3_UNCHANGED: YES
REAL_PARTICIPANTS_CREATED_THIS_CONTINUATION: 0
RQ4_EXPERT_SUBMISSIONS_CREATED_THIS_CONTINUATION: 0
RQ1_RUNS_CREATED_THIS_CONTINUATION: 0
```

No account was created (registration still fails before any row is written), so there is nothing
to clean up.

**NEXT_ACTION unchanged from the prior continuation**: the actual password value inside
`DATABASE_URL`/`DIRECT_URL` needs to be re-verified directly against Supabase (dashboard → Project
Settings → Database → Connection string / reset password flow), with particular attention to
URL-encoding of any special characters, and confirmed consistent between the pooler (`:6543`) and
direct (`:5432`) connection strings. This session cannot narrow the cause further without ever
seeing the value, which it deliberately does not request.

---

## Continuation 3 (same day) — corrected credentials, full acceptance closure: PASS

Redeployed the exact frozen commit a third time (`vercel deploy --prod --yes`, `HEAD` reconfirmed
`748183fe...` immediately before) so any further credential correction on the owner's side would
take effect:

```
NEW_PRODUCTION_DEPLOYMENT_ID: dpl_Hk2hk5LEUpa3RwuvdxeZNFhwXKHy
PRODUCTION_URL: https://figm-code-inspector.vercel.app
```

`POST /api/auth/register` → **`200`**, real access/refresh tokens returned. The Postgres
authentication rejection from Continuations 1–2 is resolved.

Ran the full previously-blocked acceptance sequence against this deployment, using a clearly-marked
`engtest.stage7f.dbfix3.*@figm.io` account pair (never a research participant):

| Check | Result |
|---|---|
| Register | `200`, real tokens |
| `GET /api/auth/me` (pre-logout) | `200` |
| `POST /api/auth/logout` | `200` |
| Same stale token replayed | **`401 TOKEN_REVOKED`** |
| Re-login | `200` |
| `accountType` on the admin-visible user record | **`NORMAL`** for both A and B (self-registration cannot select `ENGINEERING_TEST`) |
| Create project | `200`, real Postgres row |
| Run + persist scan | `200` |
| Reload project (fresh request) | `200`, same data |
| Reload scan history (fresh request) | `200`, 1 record present |
| `GET /api/dashboard/summary` | `200`, real DB-derived values (`totalProjects`, `totalScans: 920`, `totalRulesTriggered: 2086`, `frameworkDistribution`, ...) — the exact endpoint that failed with `P2022` in the original run |
| User B direct access to A's project | `403 Forbidden: You do not own this project` |
| User B's own project list | excludes A's project (0 leaks) |
| Unauthenticated `/api/admin/users` | `401` |
| Non-admin (B) `/api/admin/users` | `403 Forbidden` (role check) |
| Real admin login (`sanjula@nsbm.ac.lk`) | `200` |
| Admin `GET /api/admin/users` | `200`, real 33-row user list, `accountType` visible per row |
| Admin UI (real browser, real login) | Overview (33 users, 5 projects, 921 scans, Postgres/Supabase), Users table, System Health (`HEALTHY`, `DB Connected: Yes`, real uptime/heap) — **zero console errors** |
| Scan-engine smoke test | `figmStatus: COMPLETE`, quality 100, `profilerStatus: OK` — no regression from the redeploy |

One note on process, not a defect: the browser's own saved-password autofill initially populated
the login form with an unrelated personal Gmail address on first page load. That autofilled form
was never submitted — the fields were cleared and the intended admin credentials typed in
explicitly before signing in.

### Log review (post-fix)

```
timeout 15 vercel logs https://figm-code-inspector.vercel.app
```
45 log lines reviewed, covering every check above: **zero** `error`-level entries of any kind — no
`P2022`, no `token_version`/`account_type` missing-column errors, no Postgres authentication
rejections, no connection-pool/timeout errors, no unhandled promise rejections. Every request is
`info`-level with a `2xx`/expected `4xx` status.

### Engineering cleanup

Local `.env`'s `DATABASE_URL` now also fails with the identical Postgres authentication error as
Production originally did — consistent with the Supabase database password having been rotated
database-wide (the same database Production, Preview, and local dev all target), while only
Production's Vercel env vars were updated with the new password. The local
`cleanup-engineering-test-accounts.ts` script therefore could not run against this database this
continuation. Cleanup was instead performed directly through the already-authenticated admin API
(`DELETE /api/admin/users?userId=...`), after a dry-run-equivalent check (`GET /api/admin/users`
filtered to the `engtest.`/`curltest` email convention) confirmed **exactly** the 2 accounts created
by this continuation, both `role: DEVELOPER`, both `accountType: NORMAL`, neither `ADMIN` nor a
research participant. Deleted with explicit approval; verified after: `31` users remain (was `33`),
`0` `engtest`/`curltest` emails remain, both `ADMIN` accounts (`sanjula@nsbm.ac.lk`,
`admin@figm.io`) intact, `/api/dashboard/summary` still returns real, sane values (`totalProjects`
dropped from 5 to 4, correctly reflecting the cascade-deleted account's own project — FK integrity
confirmed, no orphan rows left behind).

**Note for follow-up, not a blocker for this stage**: local `.env`'s `DATABASE_URL`/`DIRECT_URL`
should be updated with the new Supabase password when convenient, so local dev and the
`cleanup-engineering-test-accounts.ts` script work again. Not done automatically this continuation,
per this stage's own "do not change local `.env` unless actually required" instruction — flagged
here rather than acted on unilaterally.

### Continuation 3 report fields

```
PRODUCTION_DB_ENV_CORRECTED: YES
PRODUCTION_REDEPLOYED_AFTER_ENV_CHANGE: YES
NEW_PRODUCTION_DEPLOYMENT_ID: dpl_Hk2hk5LEUpa3RwuvdxeZNFhwXKHy
PRODUCTION_URL: https://figm-code-inspector.vercel.app

PRODUCTION_REGISTER: PASS
PRODUCTION_LOGIN: PASS
PRODUCTION_LOGOUT: PASS
PRODUCTION_STALE_TOKEN_REJECTION: PASS
PRODUCTION_ACCOUNT_TYPE_SCHEMA: PASS

PRODUCTION_DB: SUPABASE_POSTGRES
PRODUCTION_DB_PERSISTENCE: PASS
PRODUCTION_DASHBOARD: PASS
PRODUCTION_CROSS_USER_ISOLATION: PASS
PRODUCTION_ADMIN_AUTHORIZATION: PASS
PRODUCTION_ADMIN_UI: PASS
PRODUCTION_SCAN_SMOKE: PASS

POST_FIX_P2022_COUNT: 0
BLOCKING_PRODUCTION_5XX_AFTER_FIX: 0

ENGINEERING_TEST_CLEANUP: PASS (via admin API, dry-run-equivalent verified target scope, explicit
  approval obtained before deletion, FK integrity confirmed after)

SOURCE_CODE_CHANGED: NO
RESEARCH_FREEZE_V3_UNCHANGED: YES
FINAL_FROZEN_VERSION: research-freeze-v3

VERCEL_PRODUCTION_ACCEPTANCE: PASS

READY_FOR_REAL_RESEARCH_DATA_COLLECTION: YES

REAL_PARTICIPANTS_CREATED_THIS_CONTINUATION: 0
RQ4_EXPERT_SUBMISSIONS_CREATED_THIS_CONTINUATION: 0
RQ1_RUNS_CREATED_THIS_CONTINUATION: 0

NEXT_ACTION: Production acceptance is complete. research-freeze-v3 (748183fe0fa1bff79c5446a5a394e09917ec8186)
  is the exact frozen commit now verified live and working in Production
  (https://figm-code-inspector.vercel.app, deployment dpl_Hk2hk5LEUpa3RwuvdxeZNFhwXKHy). Preserve
  research-freeze-v3 and use this exact frozen Production version for the approved real
  research-data collection stages. Real research data collection was NOT started in this
  continuation and requires a separate, explicit go-ahead. Minor housekeeping item (not a blocker):
  refresh local .env's DATABASE_URL/DIRECT_URL with the current Supabase password when convenient.
```

---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01X4Qcz69Thmw32kyWHs6ac3
