# GitHub Actions Workflow — Secret Context Verification

Date: 2026-09-04
Scope: `.github/workflows/figm-scan.yml`. Read-only investigation plus empirical local build tests;
no destructive actions; no secret values printed or exposed at any point.

## 1. VS Code diagnostics reported

```
Context access might be invalid: DATABASE_URL
Context access might be invalid: DIRECT_URL
Context access might be invalid: NEXT_PUBLIC_SUPABASE_URL
Context access might be invalid: NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## 2. Exact workflow references (full inventory)

| Line | Step name | Expression | Context | Fallback | Actually needed by that step? |
|---|---|---|---|---|---|
| 40 | ⚙️ Generate Prisma Client | `${{ secrets.DATABASE_URL \|\| 'postgresql://postgres:postgres@localhost:5432/postgres' }}` | `secrets.*` | Yes, localhost literal | No — see §9 |
| 41 | ⚙️ Generate Prisma Client | `${{ secrets.DIRECT_URL \|\| 'postgresql://postgres:postgres@localhost:5432/postgres' }}` | `secrets.*` | Yes | No — see §9 |
| 61 | ⚡ Execute FIGM AST Static Analysis Engine (`id: figm_scan`) | `${{ secrets.DATABASE_URL \|\| 'postgresql://postgres:postgres@localhost:5432/postgres' }}` | `secrets.*` | Yes | No — see §9 |
| 62 | ⚡ Execute FIGM AST Static Analysis Engine | `${{ secrets.DIRECT_URL \|\| 'postgresql://postgres:postgres@localhost:5432/postgres' }}` | `secrets.*` | Yes | No — see §9 |
| 63 | ⚡ Execute FIGM AST Static Analysis Engine | `${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}` | `secrets.*` | No | No — see §9 |
| 64 | ⚡ Execute FIGM AST Static Analysis Engine | `${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}` | `secrets.*` | No | No — see §9 |

No occurrence in: Checkout, Setup Node, Install Dependencies, Build (line 43-44, deliberately —
see §9), the automated-test step (line 46-54, deliberately removed by the prior P0 pass — see §6),
Upload Artifacts, or the PR-comment step (which only uses the auto-provided
`secrets.GITHUB_TOKEN`, unrelated to this investigation).

Every occurrence uses correct, standard GitHub Actions expression syntax: `secrets.NAME` context
access, and `A || B` short-circuit-OR with a single-quoted string literal fallback where present.
Both forms are documented, valid GHA expression grammar.

## 3. Secret vs. variable classification

```
VARIABLE_NAME=DATABASE_URL
CURRENT_CONTEXT=secrets
CURRENT_USAGE=Generate Prisma Client (env), Execute FIGM AST Static Analysis Engine (env)
REQUIRED_IN_CI=NO (see §9 — prisma generate never connects; ci:scan's own code never reads it)
SENSITIVE=YES (full Postgres connection string, includes credentials)
RECOMMENDED_CONTEXT=secrets
CHANGE_REQUIRED=NO

VARIABLE_NAME=DIRECT_URL
CURRENT_CONTEXT=secrets
CURRENT_USAGE=Generate Prisma Client (env), Execute FIGM AST Static Analysis Engine (env)
REQUIRED_IN_CI=NO (same reasoning as DATABASE_URL)
SENSITIVE=YES
RECOMMENDED_CONTEXT=secrets
CHANGE_REQUIRED=NO

VARIABLE_NAME=NEXT_PUBLIC_SUPABASE_URL
CURRENT_CONTEXT=secrets
CURRENT_USAGE=Execute FIGM AST Static Analysis Engine (env)
REQUIRED_IN_CI=NO (ci-figm-scan.ts and its two direct imports never reference it — see §9)
SENSITIVE=NO — the `NEXT_PUBLIC_` prefix means Next.js inlines this into the public client
  JavaScript bundle on every real deployment; it is already visible to anyone who loads the app.
RECOMMENDED_CONTEXT=vars (optional best-practice improvement, not a defect — see note below)
CHANGE_REQUIRED=NO

VARIABLE_NAME=NEXT_PUBLIC_SUPABASE_ANON_KEY
CURRENT_CONTEXT=secrets
CURRENT_USAGE=Execute FIGM AST Static Analysis Engine (env)
REQUIRED_IN_CI=NO (same reasoning as NEXT_PUBLIC_SUPABASE_URL)
SENSITIVE=NO — Supabase's own security model treats the "anon" key as safe for public/client-side
  exposure (Row Level Security policies are the actual access boundary, not secrecy of this key);
  combined with the `NEXT_PUBLIC_` prefix, it is already public in every deployed build.
RECOMMENDED_CONTEXT=vars (optional best-practice improvement, not a defect)
CHANGE_REQUIRED=NO
```

**Note on the two `vars` recommendations:** this is a best-practice observation, not something
implemented here. GitHub Secrets work perfectly correctly for a non-sensitive value — there is no
functional defect, and moving them would require creating repository Variables outside this file
and is not something to do "merely to silence an editor warning" (per the task's own instruction).
Reported for the researcher's awareness only.

## 4. Local syntax validation

No `actionlint`, `yamllint`, `gh`, or `python`/`python3` is installed in this environment.
`js-yaml` (already a transitive dependency in `node_modules`) was used to structurally parse the
file:

```
YAML_PARSE=OK
top-level keys: name, on, permissions, jobs
job steps count: 9 (all present, in the expected order)
```

This validates YAML structure (indentation, block/mapping nesting, the `env:` blocks, step
ordering) but — since `${{ ... }}` is opaque scalar text to a generic YAML parser, not evaluated —
does not itself validate GitHub Actions expression *semantics*. Those were checked manually against
GitHub's documented expression grammar (§2): every `secrets.NAME` and `A || 'literal'` form present
is valid, unambiguous syntax. No malformed expressions, no missing fallback where one was clearly
intended, no step-ID or `if:` conditional issues (`if: always()`, `if: github.event_name ==
'pull_request' && always()` are both standard, valid forms), no job-dependency issues (this
workflow has a single job, so none apply), and no shell-syntax issues in any `run:` block.

## 5. Remote GitHub Actions status

```
REMOTE_GITHUB_ACTIONS_RUN_CHECK=NOT_AVAILABLE
```

`gh` is not installed (checked both the Bash shell PATH and via PowerShell `Get-Command`). No
remote run status, workflow list, or log content was fetched or fabricated.

## 6. Test-step DB isolation (re-verified)

Re-confirmed the P0 hardening from `docs/audit/PRE_STUDY_DATA_INTEGRITY_FINAL.md` is still in place
in the current workflow file and codebase:

- The automated-test step (line 46-54) has no `env:` block at all — no `DATABASE_URL`, no
  `DIRECT_URL`, no Supabase variable of any kind. It runs `npm test` with only what `npm ci`/`setup-node`
  provide.
- `tests/test-env-setup.mjs` still `await import`s and calls
  `assertSafeTestDatabaseEnvironment()` from `src/db/db-safety-guard.ts` before any test file loads.
- `src/db/db-safety-guard.ts` exists and is unchanged from the prior pass.
- `src/db/prisma-client.ts`'s `getPrismaClient()` still calls the same guard before constructing a
  real `pg.Pool`/`PrismaClient` (defense in depth).
- `src/auth/user-db.ts` still guards all three of its direct-to-Supabase sync call sites with
  `isSupabaseSyncAllowed()`, which returns `false` whenever `NODE_ENV === 'test'`.

No other step or mechanism in this workflow injects a hosted Supabase credential into the test
step. No test was run with production credentials during this verification.

```
P0_TEST_DB_ISOLATION_REGRESSION=NO
```

## 7. Are the four configured secrets still referenced?

All four (`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
are referenced somewhere in the workflow file (§2) — none are `UNUSED_IN_WORKFLOW` at the
*workflow-reference* level. However, §9 below finds that the *scripts* those references feed
(`prisma generate`, `scripts/ci-figm-scan.ts`) do not actually consume three-and-a-half of the four
at runtime. No secret was deleted or flagged for deletion; that determination is left to the
researcher.

## 8. Special attention: the test step (repeated from §6 for completeness)

Confirmed unchanged and correct — see §6. `P0_TEST_DB_ISOLATION_REGRESSION=NO`.

## 9. Prisma / build / FIGM-scan step necessity

**Does `prisma generate` actually require `DATABASE_URL`?** No. `prisma.config.ts` (this project
uses `@prisma/config` with `earlyAccess: true`, not a `url = env("DATABASE_URL")` line in
`schema.prisma` itself) already provides its own fallback:
`process.env.DIRECT_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/figmdb'`.
`prisma generate` only reads the schema to emit a client; it never opens a connection. The
workflow's own env-block fallback is a harmless second layer that happens to take precedence over
`prisma.config.ts`'s (since it always yields a non-empty string first) — redundant, not incorrect.

**Does the build actually require `DATABASE_URL`/`DIRECT_URL`/`NEXT_PUBLIC_SUPABASE_*`?** No —
verified empirically, not assumed. Ran `npm run build` locally with all six related environment
variables (`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_PROVIDER`) explicitly
cleared, simulating the real CI condition (where `.env`/`.env.local` don't exist at all —
confirmed both are `.gitignore`d, only `.env.example` is tracked, so CI's checkout never has them).
Build succeeded cleanly, same route manifest as a normal build, zero errors. This confirms every
data-touching route in this codebase correctly declares `export const dynamic = 'force-dynamic'`
(a pattern already used consistently throughout this codebase), so Next.js never attempts to
statically pre-render anything that would reach `RepositoryFactory`/Prisma at build time. The
build step's lack of any `env:` block for these variables (lines 43-44) is correct, not an
oversight.

**Does the FIGM static scan (`ci:scan`) actually require these?** Very likely not, though this
one is slightly less absolute than the build case (no live empirical run was performed against the
real script, since `ci:scan` executes AI-remediation code paths that would need real provider
credentials to run meaningfully and is out of scope to trigger here). Read `scripts/ci-figm-scan.ts`
directly: it imports only `RuleExecutionEngine` and `RemediationEngine` — both purely local
static-analysis/AI-remediation engines. Grepped both modules for any reference to
`storage-provider`, `repository-factory`, `prisma-client`, `supabase-storage`, or
`@supabase/supabase-js`: zero matches. Nothing in this script's own import graph touches the
database or Supabase layer at all.

**Could any of these references be safely removed without changing intended behavior?** Likely
yes, for `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` in the `ci:scan` step (appear
genuinely unconsumed) and, less critically, `DATABASE_URL`/`DIRECT_URL` could be dropped from the
`ci:scan` step's env block for the same reason. This is reported as an observation for the
researcher's optional future cleanup — **not implemented here**, per the task's explicit
instruction not to remove things "just because" they look unused, and because the workflow is not
currently broken by their presence (unused env vars injected into a step's process environment are
inert, not harmful).

## Changes made in this pass

**None.** The workflow file was not modified. No defect was found that met the bar for a
correction (invalid syntax, a genuinely broken reference, or a real config error) — see the final
classification below.

## Remaining warnings

The four VS Code "Context access might be invalid" warnings will most likely persist in the editor
even though the workflow is correct. This is a well-documented characteristic of the GitHub Actions
VS Code extension: it validates `secrets.*` references against a locally cached list of the
repository's configured secret *names*, fetched via the extension's own GitHub API session. That
cache can be stale (secrets added after the extension last synced), or the check can be skipped
entirely if the extension isn't authenticated / the local git remote isn't recognized as linked to
the exact repository the secrets live in. None of this affects what GitHub Actions itself does at
runtime: an undefined `secrets.X` simply evaluates to an empty string, never a workflow syntax
error or a hard failure — which is precisely why the two Postgres-URL references defensively
include a literal fallback.

## Final recommendation

Do not modify `.github/workflows/figm-scan.yml`. The four secrets are correctly named, correctly
referenced with valid syntax, and the P0 test/production database isolation fix from the prior pass
remains fully intact. Treat the four VS Code diagnostics as editor/static-analysis false positives.
Optional, non-urgent future cleanup: drop the apparently-unconsumed `NEXT_PUBLIC_SUPABASE_*` (and
possibly `DATABASE_URL`/`DIRECT_URL`) injection from the `ci:scan` step's `env:` block, and consider
moving the two `NEXT_PUBLIC_SUPABASE_*` values from Secrets to Variables given they are not
actually sensitive — both are style/hygiene improvements, not fixes for anything broken.
