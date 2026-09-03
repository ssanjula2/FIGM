# Vercel Preview Deployment Checklist

Prepared during Stage 7C pre-Vercel closure. This is a pre-flight checklist for the **first**
Vercel preview deployment -- **no deployment has been performed as part of preparing this
document.** Work through it top to bottom before running `vercel` / connecting the Git repo to a
Vercel project.

---

## 1. Runtime / build configuration

| Item | Value | Source |
|---|---|---|
| Node version | 22.x (matches local dev: `v22.14.0`) | Set `"engines": { "node": "22.x" }` in `package.json` if not already pinned, or configure in the Vercel project's Node.js Version setting |
| Install command | `npm install` (default) | `package.json` |
| Build command | `npm run build` (`next build`) | `package.json` |
| Framework preset | Next.js | `next.config.mjs` |
| `next.config.mjs` | Review `outputFileTracingIncludes` -- must still include `src/engine/sandbox/profiler-sandbox-runner.cjs` so the dynamic-profiler sandbox script ships with the deployed function bundle | `next.config.mjs` |

## 2. Required environment variables (set in Vercel Project Settings -> Environment Variables, Preview scope)

See `ENV_VARIABLES.md`'s "Categorized quick reference" section for the full REQUIRED_PRODUCTION /
OPTIONAL_PRODUCTION / DEVELOPMENT_ONLY / RESEARCH_ONLY breakdown. Minimum for a working preview:

- `NODE_ENV` (Vercel sets this automatically for Preview/Production -- do not override)
- `JWT_SECRET`, `REFRESH_SECRET` -- real random values (`openssl rand -hex 32`), **not** the
  placeholder strings from `.env.example`. The app fails closed (refuses to start) without these
  outside local dev/test -- this is intentional and already verified (`src/auth/auth-service.ts`).
- `ADMIN_BOOTSTRAP_PASSWORD` -- only required at the moment you actually run
  `npm run db:seed-admin` against the preview's database; not required for the app to boot.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` (pooler, `:6543`, used by the running app), `DIRECT_URL` (`:5432`, used only by
  Prisma CLI migrations -- see item 3)

## 3. Optional environment variables

- `AI_PRIMARY_PROVIDER` / `AI_FALLBACK_PROVIDER` -- pin explicitly, or leave unset to use the
  default Claude > Gemini precedence (Ollama is never reachable from Vercel -- see item 4).
- `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` -- set whichever provider(s) you want AI-assisted
  remediation to use. Deterministic fixes work with neither set.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` -- omit unless a real GA4 property is configured; the app must
  never imply analytics are live when this is unset (verified,
  `tests/rq1-performance-page-no-fabrication.test.ts`-adjacent honesty tests).
- `NEXT_PUBLIC_APP_URL` -- set to the actual preview URL once known, or leave for Vercel's own
  `VERCEL_URL` equivalent if the app is updated to read that instead.

## 4. Must remain unset on Vercel

- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_MS` -- **must stay unset.** Vercel's
  serverless runtime has no network path to a local machine's Ollama instance; setting either
  would make Ollama the highest-precedence AI provider (see `src/ai/ai-provider-selector.ts`) and
  every AI-assisted remediation attempt would fail to connect instead of falling through to
  Claude/Gemini.
- `ALLOW_TEST_RESET_TOKEN` -- must stay unset (test-only escape hatch).

## 5. Database migration status

Run **before** the first preview deployment that needs the new columns, against the real Supabase
database, with explicit human approval (this is a shared-state action -- see the caution notes in
`docs/audit/STAGE_7B_PRE_DEPLOYMENT_HARDENING_REPORT.md`'s Continuation section for why):

```
npx prisma migrate deploy
npx prisma generate
```

As of this checklist, two migrations are generated but **not yet applied**:
- `prisma/migrations/20260903051137_add_token_version/` -- required for the logout/session
  revocation fix (Stage 7B) to actually function; without it, `POST /api/auth/logout` throws.
- `prisma/migrations/20260903072448_add_account_type/` -- prepared for the engineering-test-data
  provenance model (Stage 7C, Section 20); **not required** for the app to function (nothing reads
  or writes `accountType` yet -- see `prisma/schema.prisma`'s `AccountType` doc comment). Safe to
  apply at the same time as the tokenVersion migration, or defer.

**Rule for this project, learned the hard way this pass**: never deploy code that references a
Prisma field without both the migration being applied AND `prisma generate` having been run against
the same schema -- doing one without the other breaks the specific feature at runtime with an
`Unknown argument` (client stale) or `column does not exist` (DB stale) error, not a build failure.

## 6. Prisma generate requirement

`prisma generate` must run as part of (or immediately before) the Vercel build, so the deployed
Prisma Client matches `prisma/schema.prisma` exactly. Confirm whether Vercel's Next.js build
preset already runs this automatically (via a `postinstall` script or Next.js's own Prisma
plugin detection) or whether an explicit `"postinstall": "prisma generate"` needs adding to
`package.json`.

## 7. Storage provider

`STORAGE_PROVIDER` should be left unset or explicitly `"supabase"` in every deployed environment.
`src/storage/repository-factory.ts` now fails closed (throws at first use, does not silently
degrade) if Supabase credentials are missing outside local dev/test -- confirm items in Section 2
are all set before deploying, or the app will refuse every storage-touching request.

## 8. `maxDuration` assumptions

`app/api/scan/route.ts` declares `export const maxDuration = 60`. Confirm this fits the target
Vercel plan's actual function-duration limit (varies by plan) -- the route does AST parsing, a
disposable child-process spawn (dynamic profiler, 3s internal hard timeout), and on the fix path a
real AI-provider network call.

## 9. Dynamic profiler / child-process verification (Section 22)

**Not yet verified against the real Vercel serverless runtime -- do this on the first preview
deploy, before calling this RESOLVED:**

1. Run a scan via the deployed preview URL's `/live-scan` page.
2. Check the Engine Diagnostics panel's "Scan Duration" / "Engine Memory Delta" render real
   numbers (not "Unavailable").
3. If they show "Unavailable" / the UI's new "Dynamic profiler unavailable in this environment"
   notice (Stage 7C, Section 22) appears: this is the honest, correctly-degraded state -- **static
   findings must still be present and correct** (verify the finding list above the notice is
   populated). This is not a failure of the checklist; it is the system correctly reporting a real
   environment limitation instead of crashing or fabricating a metric. If it happens, note it in
   the next stage's report and decide whether dynamic profiling is worth pursuing further on
   Vercel or should remain a documented, accepted limitation.
4. Confirm the server does NOT return a 500 for the whole scan request in either case.

## 10. Scan route smoke test

`POST /api/scan` with a small real code snippet -- confirm a 200 with real `diagnostics`,
`figmStatus`, and `profile` fields (per items 9 above for `profile`).

## 11. Health endpoint

`GET /api/health` -- confirm 200 and that it does not leak any secret/internal detail in its body.

## 12. Auth validation

- Register a real (clearly-labelled engineering-test, e.g. `engtest.preview@...`) account via the
  UI.
- Log in, confirm the dashboard loads with real (zero, for a fresh account) data.
- Log out, confirm `POST /api/auth/logout` returns 200 (requires migration 5.1 applied -- see
  Section 5).

## 13. DB write/read verification

Create a project and run one scan via the UI; reload; confirm it persists (Supabase, not an
ephemeral fallback -- see Section 7).

## 14. Logout verification (the specific regression from Stage 7B)

Replay the exact live verification from `docs/audit/STAGE_7B_PRE_DEPLOYMENT_HARDENING_REPORT.md`'s
Continuation section against the deployed preview: log in, note the access token is accepted,
log out, confirm the SAME (now-stale) token is rejected with `401 TOKEN_REVOKED` on a subsequent
request (a second browser tab, or a direct API call with the old token, simulates this).

## 15. Static scan verification

Run one clean scan, one violation scan, and one malformed/partial-parse scan via the deployed
preview (same three cases as the Stage 5A/7B local browser walkthroughs) -- confirm all three
produce honest, distinct results (no false CLEAN on a parse failure).

## 16. Admin authorization / cross-user isolation

Re-run the same `curl`-based checks from Stage 7B's Continuation section (non-admin -> 403,
unauthenticated -> 401/307, cross-user project read/delete -> 403) against the deployed preview
URL, not just localhost.

## 17. Rollback notes

- Preview deployments are isolated per-deployment URLs by default -- a bad preview does not affect
  production traffic. No special rollback action is needed for a preview; simply fix and redeploy,
  or promote a known-good earlier preview via the Vercel dashboard.
- Database migrations applied via `prisma migrate deploy` are **not** automatically rolled back by
  reverting a Vercel deployment. If a migration needs to be undone, write and apply a real
  down-migration explicitly -- never manually edit `_prisma_migrations` or the schema out of band.
- If `STORAGE_PROVIDER`/Supabase credentials are misconfigured such that the app fails closed
  (Section 7), this is the intended, safe failure mode -- fix the environment variables rather than
  loosening the check.

---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TknUUqzGqFni8F7U1qepq2
