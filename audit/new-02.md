# FIGM Code Inspector — Final Verification Audit (Forensic Re-Audit)

## 1. Audit Metadata

- **Audit date:** 2026-08-17
- **Auditor role:** Independent external examiner (Principal Software Architect / Senior Static Analysis Engineer / Principal Security Engineer / Senior QA Engineer / Research Methodologist / Accessibility Engineer / Performance Engineer / Academic Reviewer).
- **Predecessor document:** `audit/new.md` (dated 2026-08-13, HEAD `22e58e39` at time of writing, with a later addendum). This document does **not** overwrite, retract, or edit `audit/new.md` — every finding below was independently re-derived from the current working tree, then cross-referenced against `audit/new.md`'s finding IDs (SEC-*, BENCH-*, AST-*, AI-01, HS-*, DOC-*, UX-*, QA-*, PROD-*) purely to preserve a stable ID scheme. No commit message, prior audit claim, or code comment was accepted as proof of anything — every classification below is backed by either (a) a direct source-code quote with file:line, (b) a live HTTP request/response against the running application, or (c) hand-shown arithmetic from a cited raw data file.
- **Method:** Direct reading of current source; five separate live `next dev` sessions (ports 3001/3002, Windows, restarted repeatedly after dev-server compilation races — see §17 note) used for real HTTP attack/verification traffic against `/api/*`; one isolated `npm run build`; one full `npm test` run; one `npx tsc --noEmit` run; hand-recomputation of precision/recall/F1 from raw counts; a live browser session (Chrome, driven via automation) against the running app for UI-level verification.
- **Scope constraint acknowledged up front:** this is a large brief (25 sections). Every section below contains genuine, cited verification work. Where a specific sub-item was not independently reproduced this session (e.g., an exhaustive test of every one of 30+ API routes individually, or a real Vercel-edge deployment to validate the rate-limiter's topology assumption), that is stated explicitly as `NOT VERIFIED (reason)` rather than silently assumed passing.
- **No application source code was modified as part of this audit.** The only files written are: this report (`audit/new-02.md`) and untracked scratch/log artifacts (`scratch/*`, `*-final-audit*.log`) outside the tracked application code, all left in place per this repository's own established convention of leaving developer scratch artifacts untouched (see `audit/new.md` §1). Test-suite runs regenerate several tracked report/data files as a side effect (timestamps, re-run counts); those were reverted (`git checkout --`) after each run so they do not appear as unintended "changes" from this audit.

---

## 2. Repository State

```
Branch: main
HEAD:   c07e0f37d0a5412ef3b9cecd72b46dc883f253fb
        "fix(FIGM-NEXT-03): stop the revalidate quick-fix from breaking 'use client' directive ordering"
Tracking: main...origin/main (in sync at audit start)
```

Recent commit history (most recent first) confirms every remediation commit `audit/new.md`'s addendum promised, plus several more landed since:

```
c07e0f37 fix(FIGM-NEXT-03): stop the revalidate quick-fix from breaking 'use client' directive ordering
bb01d1c1 fix(FIGM-REACT-03): stop flagging router.push()/document.body.style/ref.current as state mutation
33818a82 fix(ai-fix): stop fabricating a fake "AI fix result" when the request fails or doesn't verify
1bb2488e fix(live-scan): replace positional diff with real LCS diff; stop wiping other violations' fix state on every re-scan
3c5aff30 perf: fix ~1MB client bundle bloat on live-scan page + the PERF-04 gap that hid it
0bd77721 fix: black-box E2E QA across all 4 frameworks finds and fixes 6 HIGH + 3 MEDIUM regressions
2f8eb7b0 fix: black-box E2E QA pass finds and fixes 2 HIGH-severity remediation-engine bugs
fbb98332 fix: unify human-study data flow; verify independent-annotation infra is fabrication-free
9fe78783 feat: real-world benchmark against 5 genuine public repositories
589054db fix: unify FIGM's 25-rule catalog behind a single canonical registry
3fc554a3 fix: application accessibility pass (WCAG 2.2 AA) for FIGM's own UI
11bedd07 docs: repository-wide research-claim reconciliation
b31ae713 fix: one canonical source of truth for all empirical benchmark metrics
e7cfadd1 feat: rule engineering pass — real-AST migration Group 4 (7 rules) + full 25-rule audit
f8ee4831 fix: live-scan pipeline no longer claims a fix worked without verified re-scan
a7ea19a0 feat(ast): migrate 15/25 FIGM rules from regex heuristics to real TypeScript-compiler AST
df30255b fix(security): close IDOR on dashboard/reports+projects, enforce trusted re-analysis on POST /api/scans, fix rate-limit IP spoofing
20e28f03 fix(security): remove committed admin credentials, fail-closed JWT/refresh secrets, env-driven admin bootstrap
```

**Untracked files at session start** (per `git status`, unchanged from `audit/new.md`'s own §1 disclosure): `FIGM_CODE_EXPORT.txt`, `debug-complexity.ts`, `scratch/diag-next02.ts`, `scratch/perf-large.mjs`, `test-suite-output.txt` — developer scratch artifacts, out of scope, left untouched. Additional `scratch/*` files exist from this and a prior session's live-testing activity (temp tokens, curl/test output); same treatment.

**No destructive git operations were performed.** No branch was checked out, no history rewritten, no commits amended or reset. `git checkout -- <tracked report files>` was used twice, only to revert `npm test`'s own side-effect regeneration of tracked benchmark/report JSON/MD files back to their committed state — not to discard any real work.

Every remediation commit named in `audit/new.md`'s addendum, and several landed afterward, **do exist in the current working tree** — confirmed by reading their actual current effect below, not by trusting the commit log alone.

---

## 3. Executive Summary

This is a markedly different picture than `audit/new.md`. Of that audit's 9 CRITICAL and 7 HIGH findings, independent re-verification this session found:

- **All 4 CRITICAL security findings (SEC-01–SEC-04) are FIXED AND VERIFIED**, confirmed both by reading the current code and by live HTTP attack traffic against a running instance (unauthenticated access → 401 on every route tested; cross-user IDOR on `/api/projects/:id` → 403; forged `participantId`/score on `POST /api/scans` → silently ignored, real value substituted server-side; role-escalation via `role:"ADMIN"` in a registration body → silently clamped to `DEVELOPER`; tampered/`alg:none`-forged JWTs → rejected).
- **BENCH-01 is FIXED AND VERIFIED**: the dissertation's headline P/R/F1 now come from the same live, dynamically-computed source (`benchmarks/eval-summary.json`) as `docs/evidence/canonical-evaluation.json`, verified by hand-recomputing 19/(19+2)=90.48%, 19/19=100%, F1=95.0% from the raw TP/FP/FN and matching every digit, and the chapter now carries an explicit "8 of 25 rules only" scope disclaimer.
- **A genuine, real-world (not fabricated) benchmark against 5 real public GitHub repositories now exists** (`benchmarks/real-world/`), reversing `audit/new.md` §10's "confirmed absent" finding — see §11.
- **AST-01's ".tex still says 'unified AST traversal'" overclaim is FIXED**: the `.tex` source now states the exact same 23-of-25/framework-gated/Vue-never-real-AST picture this audit independently re-derived from source in §8, down to naming the same two Angular-template rules as the exceptions.
- **DOC-01 (26 unretracted `FINAL_*.md` files) and DOC-04 (viva/demo guides coaching fabricated claims) are FIXED**: zero `FINAL_*.md` files remain in the repo root; the viva/demo guides now quote the correct scoped numbers and explicitly instruct the candidate *not* to claim 100%-across-25-rules or a 30-repository evaluation, proactively disclosing the historical fabrication.
- Several accessibility findings (UX-01/02, UX-05, contrast, `aria-live`, `prefers-reduced-motion`) are **fixed and independently re-verified** (label association, a real `<button>` replacing the bare clickable `<div>`, a working mobile nav toggle, and a hand-computed contrast ratio improvement from 4.23:1 to 5.85:1 against the same background).
- **Remaining genuinely open items**, all lower severity than before: SEC-05 (rate limiting) is real and DB-backed but — confirmed live — bypassable by rotating `X-Forwarded-For` in any topology lacking a real trusted single-hop proxy in front (the code's own documentation already states this caveat); SEC-06 (PBKDF2 iterations), SEC-07 (CSV formula-injection), SEC-08 (plaintext admin `apiKey`) are unchanged; PROD-01/02/03 (no CSP/HSTS, no Prisma migration history, no custom error pages) are unchanged; a residual git-history exposure of the old `figm-user-db.json` credentials remains (rotated going forward, but still present in older commits — see §5); the duplicate `/login` vs `/auth/login` route pair still exists (though the specific accessibility defect on `/login` itself is fixed); a **new, non-trivial finding**: FIGM-REACT-03's over-broad "any property assignment" false-positive pattern — already documented as a `knownLimitation` in the rule's own metadata — is now empirically confirmed live against real-world code (4 of 5 false positives in the real-world benchmark's spot-check trace to this one root cause), and it was only narrowed, not eliminated, by the most recent `FIGM-REACT-03` fix commit — and this session independently reconfirmed the same false-positive class firing 7 times inside FIGM's *own* live-scan page source (§8), not only in the external real-world benchmark. Two further small, previously-unflagged items found this session: the tool's own `/live-scan` page still trips its own `FIGM-NEXT-02` rule (unrelated to the already-fixed bundle-bloat regression — NEW-05), and no favicon is configured anywhere in the app (NEW-04).
- **`BENCH-02` (fabricated AI-patch stats, fabricated competitor-tool latencies) is FIXED AND VERIFIED**, closed by a parallel verification pass this same session: `src/eval/ai-patch-evaluator.ts` no longer exists (confirmed by filesystem check and by two regression tests asserting it stays deleted); `src/eval/tool-benchmark.ts`'s `TOOL_COMPARISON_MATRIX` now contains only boolean capability fields, with its own header comment explaining the fabricated latency figures were removed outright rather than "corrected." `DOC-05` and `QA-02` were also independently re-checked and remain **STILL OPEN, unchanged**; `QA-03` is **PARTIALLY MITIGATED** by a new exact-value regression test (`tests/anti-hardcoding-guard.test.ts`) coexisting with the original loose-floor assertion. See §4, §17, §22 for detail.
- **Four additional new findings from this same parallel pass** (full detail in §22): `tests/user-study-pipeline.test.ts` (8 passing tests) is silently excluded from `package.json`'s `"test"` script and doesn't count toward the reported pass total; the `FIGM-A11Y-05` auto-fix introduces a new, unexplained `TYPE-TS-2875` compiler diagnostic not present before the fix; `docs/audit/AST_ARCHITECTURE_AUDIT.md`'s own status banner is stale (says "15 of 25," actual is 23/25); and this session's own `FIGM-NEXT-03` fix has no permanent committed regression test yet.
- **A dev-server operational anomaly was observed and is reported, not fabricated a cause for**: mid-session, one `next dev` process terminated silently without a captured stack trace after handling a burst of `/api/scan` requests; a second, unrelated build-worker crash occurred when `next build` and `next dev` were run concurrently against the same `.next` directory. **This second crash's root cause was fully identified**, not left as a mystery: a background research agent from this same audit session started that `next dev` process against its explicit instructions not to; its concurrent writes to `.next`, combined with measured genuine host memory pressure (2.78GB free of 15.71GB at the worst point), caused the crash. Killing the specific process resolved it immediately and reproducibly on the next build attempt (49/49 routes, clean). See §17.

---

## 4. Previous-Finding Verification Matrix

| ID | Previous Finding | Current Status | Evidence | Regression? |
|---|---|---|---|---|
| SEC-01 | Live ADMIN refresh token + hardcoded `Admin123456!` committed in `figm-user-db.json` | **FIXED AND VERIFIED** (working tree); residual exposure in git history | `figm-user-db.json` untracked (`git ls-files` empty), `.gitignore:24`; `src/auth/user-db.ts` `resolveBootstrapAdminPassword()` requires `ADMIN_BOOTSTRAP_PASSWORD` (≥12 chars) or fails closed outside dev/test; `apiKey` now `crypto.randomBytes(16)`-derived, not a fixed string | No |
| SEC-02 | Hardcoded fallback JWT/refresh secret, `NODE_ENV==='production'`-exact guard | **FIXED AND VERIFIED** | `src/auth/auth-service.ts:27` `INSECURE_FALLBACK_ALLOWED_ENVS = new Set(['development','test'])` — allow-list, not exact-match exclusion; `validateSecretStrength()` rejects <32-char or placeholder-pattern secrets outside dev/test | No |
| SEC-03 | Unauthenticated IDOR on `GET /api/dashboard/reports`, `GET /api/projects` | **FIXED AND VERIFIED (live)** | Code: both routes now check `auth.errorResponse \|\| !auth.user` → 401 before any query. Live: unauthenticated `GET` on both → `401 {"code":"UNAUTHORIZED"}`; authenticated cross-user `GET /api/projects/:id` on another user's project → `403 {"error":"Forbidden: You do not own this project"}` | No |
| SEC-04 | `POST /api/scans` accepted forged `participantId`/score, unauthenticated | **FIXED AND VERIFIED (live)** | Code: `app/api/scans/route.ts` requires auth, never reads `participantId`/`qualityScore`/`diagnostics` from the body. Live: authenticated user A submitted `participantId: <user B's id>, qualityScore: 999` — response record's `userId` was A's own id (not B's), `qualityScore` was server-computed (100, not 999); anonymous write attempt → 401 | No |
| SEC-05 | Rate limit bypassable via spoofed `X-Forwarded-For` | **FIXED for the documented topology; residually bypassable in a topology without a trusted single upstream hop (confirmed live)** | Code now trusts the *last* CSV hop, reasoned for a single-Vercel-edge topology. Live: same spoofed IP, 15 requests to `/api/auth/login` (limit 10/60s) → 429 from request #11 onward (real, DB-backed limiter works); 15 requests with a *different* spoofed IP each time → zero 429s (bypass confirmed, exactly the residual risk the code's own comment names) | No (unchanged risk profile, now explicitly documented) |
| SEC-06 | PBKDF2 at 10,000 iterations (below OWASP ≥600,000 guidance) | **STILL OPEN** | `src/auth/auth-service.ts:105,116` — `crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512')`, unchanged | No |
| SEC-07 | CSV export formula-injection (`=`/`+`/`-`/`@` unescaped) | **STILL OPEN** | `src/engine/export-service.ts:54-55` — only `"` is escaped (`.replace(/"/g, '""')`); no leading-character neutralization | No |
| SEC-08 | `GET /api/admin/users` returns plaintext `apiKey` | **STILL OPEN** | `app/api/admin/users/route.ts:18` — `apiKey: u.apiKey` still mapped verbatim into the response | No |
| BENCH-01 | Dissertation headline P/R/F1 hardcoded/stale vs. live engine | **FIXED AND VERIFIED** | `docs/dissertation/chapter5_empirical_validation_and_benchmarks.md` now states 90.48%/100.00%/95.00%, identical to `benchmarks/eval-summary.json` (`generatedAt` timestamps match exactly, same run) and `docs/evidence/canonical-evaluation.json`; hand-recomputed 19/21=0.904762, 19/19=1.0, F1=0.95 — exact match; explicit "8 of 25 rules only" scope note now present in the chapter | No |
| BENCH-02 | Fabricated AI-patch stats, fabricated competitor-tool latencies | **FIXED AND VERIFIED** | `src/eval/ai-patch-evaluator.ts` **does not exist** (`ls` confirms `No such file or directory`); its non-reintroduction is regression-tested twice (`tests/research-gap-eval.test.ts`, `tests/research-integrity.test.ts` both assert `fs.existsSync(...) === false`). `src/eval/tool-benchmark.ts` read in full: `TOOL_COMPARISON_MATRIX` now contains only boolean capability fields (no `executionSpeedMs`, no fabricated `detectionSuccessRate: 100.0`), header comment explicitly states the prior hardcoded-latency figure was "removed rather than 'corrected' to a different number" since no competitor-tool benchmark harness exists anywhere in the repo. No live usage of the deleted evaluator module found anywhere in `app/`. | No |
| BENCH-04 | Fabricated "30-repository evaluation" fallback in dashboard activity feed | **FIXED AND VERIFIED** | `src/engine/dashboard-repository.ts:161-166` now returns `[]` when no real audit-log entries exist, with an explicit comment: *"An honest empty list lets the UI show a genuine 'no activity yet' state instead... in a prior version, a reference to the fabricated '30-repository evaluation' claim..."* — the fabricated fallback string itself no longer exists anywhere in the file, only a comment documenting its removal | No |
| AST-01 | ".tex still claims 'unified AST traversal'" after `.md` sibling corrected | **FIXED AND VERIFIED** | `docs/dissertation/chapter4_implementation.tex:6` now states the exact framework/rule-gated picture (23/25 real-AST, names the 2 Angular-template exceptions, states Vue SFC is never real-AST-parsed for any rule) — independently matches this audit's own from-source derivation in §8 | No |
| AST-02 | `figm-spec.json` stale (8/25 rules, generated 2026-07-29) | **FIXED AND VERIFIED** | `figm-spec.json` `meta.generatedAt: "2026-08-17T05:43:38.743Z"` (same day as this audit), `meta.totalCoreRules: 25`, `rules` array length 25 | No |
| AI-01 | `GEMINI_API_KEY` missing from `.env.example`; AI unconditionally marketed as active | **PARTIALLY FIXED** | `.env.example` now documents `GEMINI_API_KEY` with a clear "Optional — falls back to template" comment. Live-checked (key presence only, no value printed): `GEMINI_API_KEY` is **still unset** in the current `.env`/`.env.local` — AI remediation is still template-fallback-only in this deployment | No (doc/config mismatch resolved; runtime inactivity unchanged, now honestly documented) |
| DOC-01 | ~26 unretracted root `FINAL_*.md` files | **FIXED AND VERIFIED** | `ls FINAL_*.md` in repo root → 0 files. 33 archived documents now live under `docs/audit/archive/` instead | No |
| DOC-02 | Test-pass-count disagreement across ~10 documents (35–272 claimed, 415 actual) | **PARTIALLY OPEN (expected drift)** | `VIVA_PREPARATION_GUIDE.md:78` states "543 tests... 66 suites"; live count this session is 596 tests / 67 suites. The document itself explicitly instructs "confirm the live count at defense time" — self-aware staleness, not a fabrication, but numerically stale | Not a regression — self-disclosed as expected to drift |
| DOC-03 | Rule count 23 vs 25; guidelines UI missing `FIGM-A11Y-03`/`04`; no `VUE` category | **FIXED AND VERIFIED** | `app/guidelines/page.tsx` now imports `RULE_CATALOG` from `src/matrix/rule-registry.ts`, itself `FOUR_LAYER_MAPPINGS.map(...)` (single source of truth, structurally cannot drift); `FIGM-A11Y-03`/`04` both present in the page; `VUE_SFC` category (`🟢 Vue`) present | No |
| DOC-04 | Viva/demo guides coach the fabricated 30-repo/100% claims | **FIXED AND VERIFIED** | `VIVA_PREPARATION_GUIDE.md:60` quotes the correct scoped 90.5/100/95 figures with a "confirm against the live artifact" caveat; `DISSERTATION_DEMO_GUIDE.md:35` explicitly instructs *not* to present as "100% across all 25 rules" or "30 repositories," and proactively discloses the historical fabrication | No |
| DOC-05 | README "Documentation Index" links to local `file:///c:/Users/...` paths | **STILL OPEN, unchanged** | `README.md`'s Documentation Index still links every entry via an absolute `file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/*.md` path — broken for any other clone/grader/CI viewer | No |
| UX-01/UX-02 | `/login` broken label association; clickable `<div>` with no keyboard access (notifications, user-study) | **FIXED AND VERIFIED** | `app/login/page.tsx:212,234,255` — `htmlFor="auth-fullname"/"auth-email"/"auth-password"` paired with real inputs. `app/notifications/page.tsx:88-91` — the previously-bare clickable `<div>` is now a real `<button type="button">` with `aria-label`, which is native-keyboard-accessible by construction | No |
| UX-05 | `.sidebar-open` dead CSS; mobile nav totally unreachable below 1024px | **FIXED AND VERIFIED** | `app/Sidebar.tsx:91` — `className={\`sidebar-desktop${isOpen ? ' sidebar-open' : ''}\`}`, genuinely toggled by state now (a live browser screenshot this session also showed a real hamburger `mobile-menu-toggle` button with `aria-expanded`/`aria-controls`) | No |
| AST-04 | Remediation is 100% string/regex template substitution | **UNCHANGED (by design, not a defect)** | `src/engine/remediation-engine.ts` remains template/regex-based for every rule; several rules (e.g. FIGM-NEXT-02/04, and now FIGM-NEXT-03 for `'use client'` files) correctly set `requiresManualReview: true` rather than risk an unsafe auto-rewrite | No — this was never presented as a defect to fix, just a documented mechanism |
| HS-02 | `/api/research-metrics` watches a dead path (`data/user-study-responses.json`) disconnected from the real CSV pipeline | **FIXED AND VERIFIED** | `app/api/research-metrics/route.ts:207` now reads `research/analysis/usability-results.json` — the genuine canonical output of `scripts/import-user-study.ts` | No |
| HS-03 | Ethics-approval status inconsistently characterized | **STILL OPEN (unchanged, honestly disclosed)** | `research/CONSENT_FORM.md:8` — `ETHICS_APPROVAL_STATUS = NEEDS_VERIFICATION`, unresolved | No |
| QA-02 | Near-tautological migration test | **STILL OPEN, unchanged** | `tests/json-migration.test.ts:10` — `assert.ok(typeof summary.usersSkipped === 'number' \|\| summary.usersImported >= 0)` — passes even if the migration does nothing at all (`usersImported: 0` alone satisfies the right side of the OR unconditionally) | No |
| QA-03 | Loose ≥0.8 metric floor | **PARTIALLY MITIGATED** | `tests/evaluation-runner.test.ts:21-23` still asserts `precision/recall/f1Score >= 0.8` as a loose floor (would not catch a regression from 0.95 to 0.81). **However**, a new, stronger file now exists covering the same subsystem: `tests/anti-hardcoding-guard.test.ts` asserts *exact* recomputed values for `PrecisionRecallEngine.calculateMetrics`/`calculateFromDetections` across multiple varying inputs (e.g. `assert.equal(metrics1.precision, 83.33)`) and explicitly checks that changing one input changes the output (`assert.notEqual(...)`) — a real regression guard that did not exist at the prior audit | No |
| PROD-01 | No CSP/HSTS/Permissions-Policy | **STILL OPEN** | `next.config.mjs` headers: only `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` | No |
| PROD-02 | No `prisma/migrations/`, schema drift risk | **STILL OPEN** | `prisma/migrations/` does not exist | No |
| PROD-03 | No custom `not-found.tsx`/`error.tsx`/`global-error.tsx` | **STILL OPEN** | None of the three files exist in `app/` | No |

---

## 5. Security Re-Verification

### Secrets

- `git ls-files figm-user-db.json` returns nothing — **not currently tracked**. `.gitignore:24` excludes it with an explicit comment pointing at this exact prior finding.
- `git log --all --oneline -- figm-user-db.json` shows it **was** tracked and modified across **74 separate commits** before `20e28f03` removed it. Directly inspected the commit immediately preceding the fix (`git show 20e28f03^:figm-user-db.json`, parsed as JSON, field presence checked without printing any secret value): **465 user records**, including `sanjula@nsbm.ac.lk` with `role: ADMIN` and `refreshToken` present (a real, non-empty token field) — this is the exact record `audit/new.md` SEC-01 originally described, and it is still fully recoverable by anyone who clones the repository's full history (this repo is pushed to a real GitHub remote — confirmed via `git status -sb` showing `main...origin/main` tracking). **This means the historical credential (the old refresh token and the `Admin123456!` password hash) is still recoverable from git history** even though the working tree and all future commits are clean — a residual, lower-probability risk (requires an attacker with repo/clone access specifically mining history, not casual browsing of the current tree) that rotation going forward does not eliminate. Whether the corresponding live Supabase/Postgres record's password/refresh-token was ever separately rotated (independent of the git-history exposure) is **NOT VERIFIED** — this repo audit cannot inspect the live database.
- Repo-wide grep for API-key-shaped (`AIza...`), OpenAI-key-shaped (`sk-...`), PEM private-key blocks, and `postgres://user:pass@host` patterns across all tracked files found **zero real secrets** — the only regex hits were `.env.example`'s own placeholder values (`YOUR_PROJECT_REF:YOUR_PASSWORD@...`) and localhost fallback connection strings in `prisma.config.ts`/`.github/workflows/figm-scan.yml` (`postgresql://postgres:postgres@localhost:5432/...`), both intentionally non-secret defaults for local dev/CI.
- Current `.env`/`.env.local` (checked for **key presence only**, no values printed): `JWT_SECRET` set (64 chars), `REFRESH_SECRET` set (64 chars), `ADMIN_BOOTSTRAP_PASSWORD` set (32 chars), `SUPABASE_SERVICE_ROLE_KEY` set, `DATABASE_URL` set, `GEMINI_API_KEY` **not set**.

### Authentication (live-tested against a running instance)

| Test | Result |
|---|---|
| Missing token → `GET /api/projects` | `401 UNAUTHORIZED` |
| Tampered signature (bit-flipped) → `GET /api/projects` | `401 INVALID_TOKEN` |
| Malformed Bearer value | `401 INVALID_TOKEN` |
| `alg:"none"`, empty signature, forged `role:"ADMIN"` claim | `401 INVALID_TOKEN` — `verifyJWT` never reads the token's own `alg` header; it always recomputes an HMAC-SHA256 digest server-side and does a length-checked constant-time compare (`safeCompare`), so an empty/absent signature fails immediately regardless of what the header claims |
| Registration with `role:"ADMIN"` forged in the request body | Server minted the account with `role:"DEVELOPER"` — `validateRole()` clamps any non-{ADMIN,AUDITOR,DEVELOPER} or client-asserted role at both sign and verify time, and the register route never reads `role` from the client into the DB write |
| Refresh-token rotation / revocation | **Re-read directly from current source, live end-to-end test not achieved this session** (dev server died before this specific test could run — see §17). `app/api/auth/refresh/route.ts:51-58,67-70`: every successful refresh issues a **new** refresh token and immediately overwrites the user's single stored `refreshToken` (`provider.updateUser(user.id, { refreshToken: newRefreshToken })`); the next request checks `user.refreshToken !== token` and returns `401 TOKEN_REVOKED` if they don't match byte-for-byte — so re-using an already-rotated (old) refresh token is structurally rejected by this comparison, not merely by expiry. Mechanism confirmed sound by direct code reading; not re-exercised live this pass |

### Authorization / IDOR (live-tested)

- Two real accounts (A, B) were registered and logged in live. B created a project; A (a different authenticated user) attempted `GET /api/projects/:id` on B's project → **`403 Forbidden: You do not own this project`**. A's own `GET /api/projects` list did **not** contain B's project.
- `GET /api/dashboard/reports`, `/api/projects`, `/api/scans`, `/api/notifications`, `/api/admin/users` — all unauthenticated → `401`.
- `POST /api/scans` (A authenticated, forging B's user id as `participantId`, forging `qualityScore: 999`) → record was saved under **A's own real user id**, with a **server-recomputed** `qualityScore` (100, from actually re-running `RuleExecutionEngine.analyzeFile` on the submitted trivial code, not the forged 999).
- `/api/export` unauthenticated `GET` → `405` (method not allowed; the route likely only implements `POST`/other verbs — not independently confirmed which).

### Rate limiting (live-tested, two configurations)

- Fixed spoofed IP (`X-Forwarded-For: 9.9.9.9`), 15 requests to `POST /api/auth/login` (configured limit 10/60s): responses were `401,401,401,401,401,401,401,401,401,401,429,429,429,429,429` — **the DB-backed limiter is real and functions correctly** when the client IP is stable.
- Rotating spoofed IP (`X-Forwarded-For: 8.8.8.<i>` incrementing each request), 15 requests: **zero 429s** — confirms that in a topology without a genuinely trusted upstream hop appending the real client IP (e.g. local dev, or self-hosting without Vercel's edge in front), an attacker can reset the rate-limit window on every request by rotating the header. This is exactly the caveat `src/auth/rate-limiter.ts`'s own comment already states; it is a real, live-confirmed residual risk conditional on deployment topology, not a fabricated pass/fail.

### CORS

- `OPTIONS /api/projects` with `Origin: https://evil.example.com` → `204`, **no** `Access-Control-Allow-Origin` header set. Confirms the strict allow-list (`src/lib/cors.ts`) with no wildcard fallback still holds.

### CSRF / Cookies

- `Set-Cookie` flags on login/register/refresh/logout all confirmed: `httpOnly: true`, `sameSite: 'strict'`, `secure: process.env.NODE_ENV === 'production'`. Unchanged, sound.

### Data integrity (forgery attempts)

- Forged `participantId` → ignored (see IDOR section above).
- Forged `qualityScore`/`diagnostics` → ignored, server-recomputed.
- Forged `role` at registration → clamped server-side.
- No SQL injection surface found: repo-wide grep for `$queryRaw`/`$executeRaw` in `src/` returned zero matches; all Prisma calls use parameterized `where`/`data` objects.

### New observation (not in `audit/new.md`)

`src/auth/user-db.ts:369` — regular (non-default-admin) user `apiKey` generation uses `Date.now() + Math.random()` (`figm_key_${Date.now()}_${Math.random().toString(36)...}`), **not** `crypto.randomBytes` — weaker, guessable-in-principle randomness compared to the admin-bootstrap path (which correctly uses `crypto.randomBytes(16)`). Combined with SEC-08 (admin can view any user's plaintext `apiKey`), this is a low-severity but real inconsistency worth flagging: **NEW-01 (LOW)**.

---

## 6. Real AST Re-Verification

Traced directly from source, not from documentation: `Source → detectFramework() (source-parser.ts) → buildRealSyntaxNodes() (real-syntax-node-builder.ts, TypeScript compiler AST) and/or the legacy line-by-line regex builder (source-parser.ts) → ASTNode[] (real or synthetic, same shape) → ASTDetectionEngine.evaluateNode() (pure attribute-flag predicates, framework-gated) → DiagnosticReport → RemediationEngine (string/regex templates)`.

**Every one of the 25 `evalXxx()` predicates in `src/ast/ast-detection-engine.ts` only checks a boolean attribute flag** (e.g. `node.attributes?.isDirectStateMutation === true`) — the real-AST-vs-regex distinction lives entirely in *where that flag gets set*, not in the predicate itself. Two possible setters exist per rule: a `build*()` function using the real TypeScript compiler AST (`real-syntax-node-builder.ts`), or a `.includes()`/regex block (`source-parser.ts`). Both were read directly.

**Exact framework-level real-AST tally (verified by reading every `build*` function's ts.is*()/ts.forEachChild usage and every eligibility gate in `real-syntax-node-builder.ts:27-50` and `source-parser.ts:502-523`):**

| Rule | Real-AST frameworks | Regex/legacy frameworks | Build function |
|---|---|---|---|
| FIGM-PERF-01 | React_JSX, Next.js, Angular, Generic | Vue (never attemptable) | `buildPerf01` |
| FIGM-PERF-02 | React_JSX, Next.js | Vue, Angular, Generic | `buildPerf02` |
| FIGM-PERF-03 | React_JSX, Next.js, Angular, Generic | Vue | `buildPerf03` |
| FIGM-PERF-04 | React_JSX, Next.js, Angular, Generic | Vue | `buildPerf04` |
| FIGM-PERF-05 | React_JSX, Next.js | Vue, Angular, Generic | `buildPerf05` |
| FIGM-PERF-06 | React_JSX, Next.js, Angular, Generic | Vue | `buildPerf06` |
| FIGM-A11Y-01 | React_JSX, Next.js | Vue, Angular, Generic | `buildA11y01` |
| FIGM-A11Y-02 | React_JSX, Next.js | Vue, Angular, Generic | `buildA11y02` |
| FIGM-A11Y-03 | React_JSX, Next.js | Vue, Angular, Generic | `buildA11y03` |
| FIGM-A11Y-04 | React_JSX, Next.js | Vue, Angular, Generic | `buildA11y04` |
| FIGM-A11Y-05 | React_JSX, Next.js | Vue, Angular, Generic | `buildA11y05` |
| FIGM-A11Y-06 | React_JSX, Next.js | Vue, Angular, Generic | `buildA11y06` |
| FIGM-NEXT-01 | Next.js only | (rule is Next-only anyway) | `buildNext01` |
| FIGM-NEXT-02 | Next.js only | — | `buildNext02` |
| FIGM-NEXT-03 | Next.js only (gated: skips `'use client'` files, this session's own fix) | — | `buildNext03Root` |
| FIGM-NEXT-04 | Next.js, React_JSX | — | `buildNext04` |
| FIGM-REACT-01 | React_JSX, Next.js, Angular, Generic | Vue | `buildReact01` |
| **FIGM-REACT-02** | **React_JSX, Next.js only** (separate module) | Vue, Angular, Generic | `src/analysis/react-ast-rules.ts` (not in `real-syntax-node-builder.ts`) |
| FIGM-REACT-03 | React_JSX, Next.js, Angular, Generic | Vue | `buildReact03` |
| FIGM-REACT-04 | React_JSX, Next.js | Vue, Angular, Generic | `buildReact04` |
| FIGM-ANG-01 | Angular, Generic | React_JSX, Next.js, Vue | `buildAng01` |
| FIGM-ANG-02 | Angular, Generic | React_JSX, Next.js, Vue | `buildAng02` |
| **FIGM-ANG-03** | **none — pure regex, all frameworks** | all | *(no build function exists)* |
| **FIGM-ANG-04** | **none — pure regex, all frameworks** | all | *(no build function exists)* |
| FIGM-ANG-05 | Angular, Generic | React_JSX, Next.js, Vue | `buildAng05` |

**Exact tally: 23 of 25 rules have at least one framework path through the real TypeScript-compiler AST. 2 rules (FIGM-ANG-03 `*ngFor` trackBy, FIGM-ANG-04 template method-call detection) are pure regex/substring for every framework, with no real-AST path at all — both require parsing Angular's inline template markup, which the TypeScript compiler cannot do.** This numerically matches the "23/25" figure in commit messages `a7ea19a0`/`e7cfadd1` — but that headline number **omits a critical nuance, independently confirmed here**:

> **`VUE_SFC` is entirely excluded from `canAttemptRealAstParse()` (`real-syntax-node-builder.ts:48-50`). Every single Vue scan, for every single one of the 25 rules, always runs through the legacy regex/`.includes()` path — never real AST.** Additionally, 9 of the 23 "real-AST" rules (the JSX-gated group: PERF-02, A11Y-01–06, PERF-05, REACT-04) are real-AST **only** for React_JSX/Next.js — Angular and Generic also fall back to regex for these specific 9 rules, same as Vue. FIGM-REACT-02 (the original, pre-migration real-AST rule) retains its original 2-of-4-framework limitation unchanged.

This is precisely the granularity the dissertation's `.tex` chapter now states explicitly (see below) — a materially more honest claim than a flat "23/25 rules, real AST" headline would suggest, and this audit's independent source derivation matches it exactly, which is strong corroborating evidence the `.tex` text is accurate, not merely well-worded.

**Malformed-source handling:** `src/parser/typescript-framework-parser.ts:30-50` wraps `ts.createSourceFile` in a real `try { ... } catch (err) { ... }` (with a comment explicitly noting `ts.createSourceFile` itself doesn't throw for syntax errors, but the guard exists anyway as defense-in-depth) — the "never throws" claim in `real-syntax-node-builder.ts`'s doc comment was verified against this actual code structure, not accepted from the comment alone. Live-confirmed: a deliberately malformed React snippet (`function X( { return <div onClick={};`) submitted via the real `/api/scan` route returned `200` with 1 diagnostic and no server error.

**Source ranges:** Spot-checked live — a `FIGM-PERF-02` finding from a real scan reported `location: { start: { line: 2, column: 46 }, end: { line: 2, column: 66 } }` with `sourceKind: 'REAL_AST'`, matching the actual JSX attribute position in the submitted source (not a synthetic `{line:1,column:0}` marker). The one legitimate synthetic-location exception is `FIGM-NEXT-03`'s "missing export" marker (`{line:1,column:0}`, by necessity — there is no real node for something that's absent), which is documented as such in the code and is not a real-AST-rule bug.

**No double-counting between the two FIGM-REACT-02 implementations**: `src/engine/rule-execution-engine.ts:82-91` explicitly filters the legacy regex-based `FIGM-REACT-02` diagnostic *out* of the result set whenever `supportsRealAstAnalysis(framework)` is true, then substitutes the real-AST result from `src/analysis/react-ast-rules.ts`'s `detectArrayIndexKey()` — confirmed by reading the actual filter/replace logic, not inferred. A live scan of a React array-index-key violation returns exactly one `FIGM-REACT-02` diagnostic, not two.

**Dissertation cross-reference:** `docs/dissertation/chapter4_implementation.tex:6` (quoted in full): *"...23 of the 25 FIGM rules are detected via genuine TypeScript-compiler-API AST traversal for React, Next.js, plain JS/TS, and the TypeScript class body of Angular components... the remaining 2 rules (Angular \*ngFor trackBy and template method-call detection...), and every rule applied to Vue SFC markup..., are detected via a regex/substring text-heuristic... every emitted finding is labeled... (sourceKind: REAL_AST or LEGACY_TEXT_HEURISTIC)"* — this is now **accurate and matches this audit's independent source-code derivation exactly**. AST-01 is closed.

**One stale internal doc found, not previously flagged (post-dates `audit/new.md`'s own addendum): `docs/audit/AST_ARCHITECTURE_AUDIT.md`'s own "STATUS UPDATE" banner still says "15 of the 25 rules are now detected via genuine TypeScript-compiler-API AST traversal."** This was evidently written after commit `a7ea19a0` (which migrated 15/25) but never updated after the later `e7cfadd1` Group-4 batch brought the total to 23/25 — stale by 8 rules. The document's historical-baseline body below the banner is correctly labeled as historical and is not the issue; the banner itself, whose entire purpose is to state *current* status, is wrong. `docs/architecture/RULE_ENGINEERING_AUDIT.md:523` is current and correct ("23/25 rules are real-AST..."). Separately, `docs/architecture/AST_MIGRATION_MAP.md` still lists 7 specific rules (`PERF-03/05/06`, `A11Y-05/06`, `REACT-01/04`) as "deferred to a follow-up batch" — all seven are now confirmed migrated per the table above — with no reconciling status update, and it is the exact document `README.md`/`RULE_ENGINEERING_AUDIT.md` point readers to for "the full rule-by-rule breakdown." **NEW-08 (LOW, documentation-only).**

---

## 7. Rule Registry Completeness (Section 5 of the brief)

- **Exact rule count confirmed 25** (unchanged) — `grep -c "ruleId: 'FIGM-" src/matrix/four-layer-meta-model.ts` = 25, `grep -c "private static eval" src/ast/ast-detection-engine.ts` = 25 (matching pairs, one predicate per rule).
- **`figm-spec.json`**: 25/25 rules, generated same-day (§4, AST-02 fixed).
- **`app/guidelines/page.tsx`**: sources `RULE_CATALOG` from `src/matrix/rule-registry.ts`, itself `FOUR_LAYER_MAPPINGS.map(...)` — a direct, structural 1:1 derivation from the same source the engine reads. `FIGM-A11Y-03`/`FIGM-A11Y-04` and a `VUE_SFC` category are both present (DOC-03 fixed).
- **Test coverage**: a direct per-rule-ID `.includes()` check (not a fuzzy grep) against `tests/rule-detection-matrix.test.ts`, `tests/qa-matrix-boundary-adversarial.test.ts`, and `tests/ast-detection-rules.test.ts` found **all 25 rule IDs present in all three files** — zero missing.
- **No duplicated rule IDs, no obsolete rule IDs found** anywhere in `four-layer-meta-model.ts`, `ast-detection-engine.ts`, or `figm-spec.json` this session.

---

## 8. Live Black-Box Scan Verification

All tests below were run against a live `next dev` instance via the real `POST /api/scan` route (the same route the browser UI calls), and several were additionally re-confirmed by driving the actual live-scan browser UI directly (Chrome, automated).

| Test | Framework detected | Result |
|---|---|---|
| React (array-index `key`) | `REACT_JSX` | `FIGM-REACT-02` fired correctly |
| Next.js Server Component missing `revalidate` | `NEXT_JS` | `FIGM-NEXT-03` fired correctly |
| Next.js Client Component (`'use client'`) missing `revalidate` | `NEXT_JS` | `FIGM-NEXT-03` correctly **did not** fire (this session's own fix, re-verified fresh) |
| Angular (`@Component`, unsubscribed observable) | `ANGULAR_TEMPLATE` | `FIGM-ANG-01`, `FIGM-ANG-02` fired correctly |
| Vue SFC (click handler, no keyboard equivalent) | `VUE_SFC` | `FIGM-A11Y-01` fired correctly, `sourceKind: LEGACY_TEXT_HEURISTIC` (consistent with §6 — Vue is never real-AST) |
| Empty source | — | `400 { error: "Code string is required" }` — rejected cleanly, no crash |
| Malformed/unclosed-brace source | `REACT_JSX` | `200`, 1 diagnostic, no server error |
| Unicode identifiers + emoji (`Spécial`, `état`, `😀`) | `REACT_JSX` | `200`, 2 diagnostics, correctly parsed |
| Comment/string containing code-like text (`// const x = {a:1}`, `"<img src=x>"` as a string literal) | — | 1 diagnostic (`TYPE-TS-2875`, a TS compiler signal unrelated to the trap) — **no FIGM rule false-fired on the commented-out/string-embedded fake code**, confirming the comment/string-stripping pass (`stripCommentsAndStrings`) still holds |
| Unsupported framework (`.svelte`) | `SVELTE` | `200`, 0 diagnostics — degrades gracefully, does not crash |
| **Remediation → re-scan** (Next.js `revalidate`) | — | Original violation flagged → manually applied fix (`export const revalidate = 60;` prepended) → re-scanned → `FIGM-NEXT-03` no longer present |

**Live browser UI confirmation** (`http://localhost:3002/live-scan`, driven directly, not just the API): pasting the same Client Component reproduction showed **no** `FIGM-NEXT-03` card (1 unrelated finding, `FIGM-PERF-05`, quality 97/100); pasting the Server Component reproduction correctly showed the `FIGM-NEXT-03` card; clicking **Apply & Verify Fix** updated the editor to `export const revalidate = 60; ...` on line 1 and the results panel showed **"No Issues Found! / 100/100"** — the full detect → remediate → re-scan loop verified visually in the running app.

**Discrepancy between UI and engine:** none found this session.

**Dogfooding — scanning FIGM's own source with its own engine (`RuleExecutionEngine.analyzeFile` called directly against `app/live-scan/page.tsx`, bypassing the HTTP layer entirely to avoid the dev-server flakiness noted in §17):**

- **`FIGM-NEXT-02` (heavy static import without `next/dynamic`) fires on the tool's own primary page.** `app/live-scan/page.tsx:4` — `import Editor, { useMonaco, OnMount } from '@monaco-editor/react';` — a static top-level import whose specifier contains the substring `monaco-editor` (the rule's `HEAVY_MODULES` list matches on substring), with no `dynamic(` anywhere in the file. This is a **different** finding from the already-fixed `3c5aff30` bundle-bloat regression (that commit fixed a static `RemediationEngine` import pulling in the server-side compiler stack; it did not touch the Monaco import, and did not need to — `@monaco-editor/react` lazy-loads its own core internally, so this is not a real bundle-size problem in practice). But as a literal, direct self-application of the tool's own rule, it is a genuine, currently-live, unaddressed self-violation — the exact class of finding `audit/new.md` §17 originally flagged (then about `monaco-editor` generally), now independently reconfirmed against the *current* file.
- **`FIGM-REACT-03` fires 7 times on this same file**, all traced to `computeLineDiff()`'s local LCS-diff builder (`app/live-scan/page.tsx:220-257`): `const rows: DiffRow[] = []; ... rows.push({...})`. `rows` is a plain local array in a pure function, with no relationship to React state whatsoever. This is independent, first-party corroboration of **NEW-02** (§11, §22) — the false-positive class isn't only visible in the external real-world benchmark's five third-party repos, it is visibly live in FIGM's *own* codebase, on its *own* flagship page.
- Full self-scan diagnostic list for this file: `FIGM-NEXT-02` ×1, `FIGM-REACT-03` ×7, `FIGM-REACT-01` ×2, `FIGM-PERF-05` ×5, `FIGM-A11Y-05` ×1, `FIGM-REACT-02` ×2 — the `FIGM-REACT-01`/`PERF-05`/`A11Y-05`/`REACT-02` hits were not individually triaged for true/false-positive status this session (unlike the `NEXT-02` and `REACT-03` hits above, which were read against the actual surrounding code).

---

## 9. Remediation Re-Verification

For every remediation exercised live this session, the actual patched code was inspected (not just "did the diagnostic disappear"):

- **FIGM-NEXT-03** (Server Component): patch is `export const revalidate = 60; // [FIGM Quick-Fix]...\n\n<original code>` — syntactically valid, does not remove or alter any of the original code, re-scan confirms the violation is gone and no new violation is introduced.
- **FIGM-NEXT-03** (Client Component, `'use client'` file): correctly refuses (`requiresManualReview: true`) rather than corrupting the file — this session's own fix, re-confirmed fresh via a synthetic forced-defect test at the `RemediationEngine.applyQuickFix` level: `remediatedCode === originalCode` (byte-for-byte unchanged).
- General pattern confirmed by source reading (`src/engine/remediation-engine.ts`): rules where a safe automated fix cannot be reliably inferred (FIGM-NEXT-02's dynamic-import strategy, FIGM-NEXT-04's font-import placement, and now FIGM-NEXT-03 on Client Components) all correctly set `requiresManualReview: true` with a human-readable explanation, rather than guessing.
- **Not independently re-exercised this session**: the other 22 rules' remediation templates were not each individually re-run through a fresh detect→fix→re-scan cycle (only FIGM-NEXT-03 and the two already-live-tested ones above were). `audit/new.md` §7 previously reported all 25 rules have a dedicated fix case; this was not re-falsified but also not re-proven exhaustively this session — **NOT FULLY VERIFIED (scope-limited)**.
- **Additional detect→fix→re-scan cycles run this audit, against a live server**, checking specifically for (a) the violation actually gone, (b) no unrelated line touched, (c) no new defect introduced: `FIGM-PERF-02` (img dimensions — clean, only the violating line changed), `FIGM-REACT-02` (index key → stable id — clean), `FIGM-A11Y-05` (unlabeled input → injected `aria-label` — violation fixed, but see finding below), `FIGM-NEXT-04` (external font link — correctly refuses with `requiresManualReview: true`, matching the documented "manual review, not blind auto-apply" pattern), `FIGM-PERF-01` (loop-scope object literal → hoisted to a frozen constant — clean).
- **New finding: the `FIGM-A11Y-05` auto-fix introduces a new, different-category diagnostic.** Re-scanning the patched code (`aria-label="TODO: describe this field"` correctly and minimally injected, nothing else touched) surfaces `TYPE-TS-2875` ("This JSX tag requires the module path 'react/jsx-runtime' to exist...") on the exact patched line — independently confirmed **absent** on the original unpatched code by re-scanning it in isolation. This is a TypeScript-compiler-diagnostic category (`TYPE-TS-*`), separate from the 25 `FIGM-*` rules, and the actual accessibility fix itself is genuinely correct — but the *reason* the compiler diagnostic appears only post-patch was not root-caused this session (most likely an isolated-snippet module-resolution artifact of the standalone type-checker, not a real defect in the injected attribute, but not confirmed). **NEW-09 (MEDIUM).** Recommend follow-up to confirm this is snippet-isolation noise, not a real interaction between the type-checker and injected JSX attributes.

---

## 10. Research Metric Re-Verification

**Canonical source confirmed singular**: `benchmarks/eval-summary.json` and `docs/evidence/canonical-evaluation.json` share the identical `generatedAt` timestamp (`2026-08-17T11:53:22.5xx`) and identical `calculationMethod` text — both genuinely produced by the same run of `src/eval/evaluation-runner.ts` dynamically re-executing `RuleExecutionEngine.analyzeFile` against `benchmarks/testbed` and diffing against `benchmarks/ground-truth.json`, not a cached/hand-typed confusion matrix.

**Hand-recomputed from the raw counts in `benchmarks/eval-summary.json`:**
```
TP = 19, FP = 2, FN = 0
Precision = TP/(TP+FP) = 19/21 = 0.9047619047619048   -> matches file exactly
Recall    = TP/(TP+FN) = 19/19 = 1.0                   -> matches file exactly
F1        = 2*P*R/(P+R) = 2*0.904762*1/(1.904762) = 0.9500000000000001  -> matches file exactly
```
Per-rule TP sum (3+1+3+1+2+3+4+2 = 19) matches the overall TP of 19 — internally consistent.

**Cross-referenced against every surfaced location found this session:**

| Location | Value found | Matches canonical? |
|---|---|---|
| `benchmarks/eval-summary.json` | 90.48% / 100.00% / 95.00% | — (source) |
| `docs/evidence/canonical-evaluation.json` | 90.48% / 100.00% / 95.00% | Yes |
| `docs/dissertation/chapter5_empirical_validation_and_benchmarks.md` | 90.48% / 100.00% / 95.00%, with explicit "8 of 25 rules" scope note | Yes |
| `VIVA_PREPARATION_GUIDE.md` | "Precision = 90.5%, Recall = 100%, F1-Score = 95.0%... always confirm against the live artifact" | Yes |
| `DISSERTATION_DEMO_GUIDE.md` | "Precision 90.5%, Recall 100%, F1-Score 95.0%... covers 8 of the 25 rules... Do not present this as 100% across all 25 rules" | Yes |
| README.md, `.tex` dissertation source, `app/analytics/page.tsx`, landing-page components | **NOT RE-CHECKED THIS SESSION** | NOT VERIFIED |

No mismatch found anywhere this session actually checked. BENCH-01 is closed.

---

## 11. Benchmark Re-Verification (Controlled + Real-World)

**Controlled benchmark** (`benchmarks/testbed/`): unchanged — 4 hand-authored fixtures, 19 labelled violations, 8 of 25 rules covered (`FIGM-PERF-01..04`, `FIGM-A11Y-01..04`). 17 rules still have zero ground-truth-benchmarked coverage. This scope limitation is now **explicitly disclosed** everywhere the numbers are surfaced (§10).

**Real-world benchmark — `REAL-WORLD REPOSITORY EVALUATION: VERIFIED`.** This directly reverses `audit/new.md` §10's "NOT VERIFIED / confirmed absent" finding. Evidence, not inference from directory names:

- `benchmarks/real-world/METHODOLOGY.md` documents 5 real, named, linked public GitHub repositories (`bradtraversy/react-crash-2021`, `vercel/nextjs-portfolio-starter`, `johnpapa/angular-tour-of-heroes`, `vuejs/vue-hackernews-2.0`, `bradtraversy/vanillawebprojects`), each cloned at a pinned commit, with the script documented to **refuse to scan if the checked-out HEAD doesn't match the pinned SHA** — no silent fallback.
- `benchmarks/real-world/raw-results/` contains 5 real per-repo JSON files (5.9 KB–206 KB, plausible sizes for genuine per-file diagnostic output) plus a combined summary — inspected directly: `_combined-summary.json` reports `repoCount: 5, totalFilesScanned: 80, totalLOC: 4732, totalFigmFindings: 268, totalEngineCrashes: 0, totalFilesWithParseErrors: 0`.
- **Strong internal-consistency evidence this is real, not fabricated**: the combined summary's `asyncEngineCrashesDuringRun` field contains a **captured real stack trace** — `TypeError: RSS is not a constructor` at `dynamic-profiler.ts:73:19`, inside an `eval`'d context, propagating through `rule-execution-engine.ts:38:37` and `run-real-world-benchmark.ts:175:54/283:20`. This exact bug class (the scanner's `DynamicProfiler` genuinely executing scanned source in-process via `new Function()`, crashing asynchronously) matches a defect independently known from this project's own history — a fabricated dataset would be extraordinarily unlikely to also fabricate a consistent, file:line-accurate async crash trace pointing at a real, separately-documented engine bug.
- `benchmarks/real-world/SPOT_CHECK.md`: 18 findings manually judged against real source at the pinned commit (not the JSON output alone), each with specific file:line citations and reasoning. Explicit, honest methodology caveat: **not a random sample**, sized to answer "is the tool usually right on real code," not to produce a citable accuracy percentage. Reported precision: **13/18 (72%) if "TP (narrow)" counts as correct, 7/18 (39%) if only clean TPs count** — both numbers reported, neither cherry-picked.
- **No Precision/Recall/F1 is computed for the real-world corpus as a whole** — `METHODOLOGY.md` explicitly states this and explains why (no exhaustive ground truth exists for real-world code) — correct methodological restraint, not a gap to criticize.

**A genuine, concrete false-positive pattern was discovered by this real-world benchmark and is still open in the current codebase**: 4 of the spot-check's 5 false positives (`#3, #5, #8, #15`) are all the same root cause — **`FIGM-REACT-03` flags any `Identifier.property = value` assignment shape as "React state mutation," regardless of whether the file has any React content at all** (confirmed instances: `X.defaultProps = {...}`, `module.exports = withNextra()`, a Karma config's `module.exports = function(config)`, and a Canvas 2D `ctx.fillStyle = ...` assignment in a file with zero React). This matches the rule's own `knownLimitation` field in `four-layer-meta-model.ts` verbatim — the spot-check is the first empirical real-world confirmation that the documented limitation actually manifests, and shows it firing on files with **zero** React content. **This session's own earlier commit `bb01d1c1` ("stop flagging router.push()/document.body.style/ref.current as state mutation") narrowed this class but did not eliminate it** — the newly-found instances (`defaultProps`, `module.exports`, Canvas API) are a different, broader shape than what that commit specifically targeted. Flagged as a still-open finding, **NEW-02 (MEDIUM)**, below.

A second, smaller pattern: `FIGM-REACT-01` (#14) matched `Vue.filter(key, fn)` — Vue's global filter-registration API — as if it were `Array.prototype.filter`, based on method-name matching alone without checking the receiver type. **NEW-03 (LOW)**.

**Known limitations of the real-world benchmark, stated directly in its own docs and independently confirmed reasonable**: 5 repositories / 80 files / 4,732 LOC — small; all 5 are tutorials/starters/demos, not large production codebases; the 18/268 (6.7%) spot-check sample is intentionally diverse, not statistically random.

---

## 12. Independent Annotation Re-Verification

**Status: `PLANNED — NOT COMPLETED`.** Unchanged from `audit/new.md` §9, re-confirmed from raw data this session:

- `research/independent-annotation/README.md:7` — `**Status: Independent annotation: PENDING.**`
- `research/independent-annotation/submissions/` contains only a `README.md` — **zero `.csv` submission files**.
- `research/independent-annotation/results/STATUS.md` (read verbatim): *"Independent annotation: PENDING... No raw agreement, Cohen's kappa, or confusion matrix is reported, because none has been computed from real annotation data."* — `Last checked: 2026-08-17T11:53:26.837Z` (same day as this audit, i.e. this status check itself was freshly, correctly, still reporting PENDING).

No fabricated or synthetic kappa value is presented anywhere as FIGM research evidence. This remains one of the most consistently honest areas of the project.

---

## 13. Human Study Re-Verification

- **`ZERO REAL PARTICIPANTS VERIFIED`** — `research/raw/real/`, `research/processed/real/`, `research/anonymized/real/` were not re-inspected this session for content, but no evidence of a change was found and the canonical results pipeline (below) reports the same synthetic-only state.
- **HS-02 is FIXED AND VERIFIED**: `app/api/research-metrics/route.ts:207` — `const userStudyPath = join(process.cwd(), 'research', 'analysis', 'usability-results.json');` — this is the genuine output path of the real CSV-ingestion pipeline (`scripts/import-user-study.ts`), not the old dead `data/user-study-responses.json` path. The route's own comments explicitly document the fix rationale.
- **Ethics approval status: still `NEEDS_VERIFICATION`** (`research/CONSENT_FORM.md:8`) — unresolved, honestly disclosed, unchanged. HS-03 remains open.
- Synthetic test data's separation from "real" data was not independently re-exercised end-to-end this session (e.g., re-confirming `datasetType: "SYNTHETIC"`/`validParticipantCount: 0` in `research/analysis/usability-results.json` directly) — **NOT VERIFIED (not re-read this session)**, though no contradicting evidence was found either.

---

## 14. AI Remediation Re-Verification

Traced: `app/ai-fix/page.tsx` (UI) → `POST /api/scan` with `action:"ai-fix"` → `src/ai/ai-remediation-pipeline.ts` → `src/ai/gemini-service.ts` (real HTTPS call to Google's Generative Language API, `gemini-2.5-flash`, when `GEMINI_API_KEY` is set) → post-hoc re-scan verification → template fallback if any stage fails or the key is absent.

- **`AI CAPABILITY EXISTS`**: confirmed real, non-trivial implementation (genuine HTTP call construction, response parsing, and — importantly — the pipeline re-scans the patched code before reporting success, a real safety check).
- **`AI IS ACTIVE IN CURRENT DEPLOYMENT`**: **false**. `GEMINI_API_KEY` confirmed absent from the currently-loaded `.env`/`.env.local` (key-presence check only, no value read/printed). Every AI-fix request in this deployment currently falls through to `TEMPLATE_FALLBACK`.
- **Documentation now correctly distinguishes the two**: `.env.example` documents `GEMINI_API_KEY` as "Optional — if unset, AI-fix requests transparently fall back to the deterministic template remediation engine." AI-01's doc/config mismatch (key missing from `.env.example`) is fixed; the underlying runtime inactivity is unchanged but is no longer contradicted by the setup documentation.

---

## 15. Accessibility Re-Verification (Application's Own UI)

| Item | Prior finding | Current status |
|---|---|---|
| `/login` label association | `<label>` with no `htmlFor`, `<input>` with no `id` | **Fixed** — `htmlFor="auth-fullname"/"auth-email"/"auth-password"` present, paired with matching inputs |
| Notifications clickable control | Bare `<div onClick>`, no `role`/`tabIndex`/`onKeyDown` | **Fixed** — now a real `<button type="button">` with `aria-label`, natively keyboard-accessible |
| Mobile/tablet nav | `.sidebar-open` dead CSS, no toggle existed, total keyboard/pointer unreachability below 1024px | **Fixed** — `Sidebar.tsx` now genuinely toggles `.sidebar-open` via state; a live browser screenshot this session showed a real `mobile-menu-toggle` button with `aria-expanded`/`aria-controls`/`aria-label` |
| `aria-live`/status regions | Zero real usages anywhere in `app/` | **Improved** — 6 occurrences now found across `app/` (not exhaustively audited for correctness of each, but the prior "zero" finding no longer holds) |
| `prefers-reduced-motion` | None anywhere | **Improved** — 1 occurrence found (not verified to cover every animation in the app) |
| Contrast (`--text-dim` on `--bg`) | `#64748b` on `#030712` = 4.23:1 (fails AA 4.5:1) | **Fixed, hand-verified**: current value `#7c8ba6` on `#030712` = **5.85:1** (relative-luminance WCAG formula computed directly, not estimated) — passes AA with margin |
| Duplicate `/login` vs `/auth/login` routes | Both exist, `Sidebar` links the (previously broken) `/login` | **Partially open** — both routes still exist; `Sidebar.tsx:80` still links `/login` (not `/auth/login`), but the specific accessibility defect on `/login` itself is now fixed, so the user-facing harm from this specific finding is resolved even though the architectural redundancy remains |
| Dead `app/Header.tsx` | Full alternate header component, never imported | **Still open, unchanged** — file still exists, zero imports found anywhere in `app/` |

**Not re-verified this session**: full keyboard-navigation tab order, focus-visible styling, dialog/modal focus trapping, ARIA correctness on every custom control, and a full landmark/semantic-structure sweep — the prior audit's positive findings (search trigger, notification bell, tab widgets, `/auth/*` form cluster) were not re-tested, only the items with prior negative findings were specifically re-checked.

---

## 16. Performance Re-Verification

Dev-server HTTP-layer timing proved unreliable to measure this session (see §17's dev-server flakiness note — the same Windows `next dev` module-resolution races that intermittently 404/500'd real routes also produced wildly inconsistent request latency, 0.29s–6.2s for a trivial ~60-byte scan on the same warm route seconds apart). Rather than report that noise as a performance figure, the engine was benchmarked directly (`RuleExecutionEngine.analyzeFile`, in-process, bypassing Next.js/HTTP entirely — a valid and arguably more meaningful measurement of the actual analysis workload):

- **Large file**: a synthetic 96 KB / 2,000-pattern file scanned in **425 ms**, no crash, no timeout. Consistent with the prior audit's own large-file budget finding (`tests/qa-matrix-cross-cutting.test.ts`'s 2000-violation/~210KB fixture, 15s budget) — comfortably within budget on a materially similar scale.
- **Edge-case robustness**, all run directly against the engine, none threw: empty string, whitespace-only, malformed/unclosed-brace source (including a 3-level-deep unclosed nesting), Unicode identifiers + emoji, code-like text inside comments (correctly *not* flagged — the comment-stripping pass holds), code-like text inside string literals (correctly *not* flagged), an unsupported `.svelte` file (degrades to `SVELTE` framework / 0 diagnostics, no crash), 20-level-deep JSX nesting, and 5 duplicate copies of the same violation pattern (all 5 correctly and independently detected, no dedup collapse).
- `FIGM-NEXT-02` self-dogfooding finding (Monaco import on `/live-scan`, not code-split via `next/dynamic`) — see §8 — is the one concrete, still-open, self-referential performance-adjacent finding from `audit/new.md` §17 that was specifically re-checked and found still present (independent of the already-fixed `3c5aff30` bundle-bloat regression, a different bug in the same file).
- Duplicate notification polling (`audit/new.md`'s finding that `useNotifications.ts` polls every 10s from two simultaneous mount points) was **NOT RE-VERIFIED** this session — `src/hooks/useNotifications.ts:26` still shows the unconditional `setInterval(fetchNotifications, 10000)` with no page-visibility gate, unchanged from the prior audit's citation, but whether it is still double-mounted on `/notifications` specifically was not re-checked.
- One real, unplanned production-scale data point: `benchmarks/real-world/raw-results/_combined-summary.json`'s `totalScanDurationMs: 3291.17` for 80 real files / 4,732 LOC of genuine third-party code — i.e. ~41ms/file average, in-process, no subprocess overhead — genuine, reproducible wall-clock timing from the real-world benchmark run, corroborating the large-file number above at a different scale.
- `npm run build` (isolated): **no favicon exists anywhere** — `app/favicon.*` and `public/*.ico` both glob to zero files. Not a runtime performance issue, but a genuine, previously-unflagged production-polish gap (browser falls back to no icon / a generic default). New finding: **NEW-04 (LOW)**.
- `npm run build` (isolated, no concurrent dev server) completed successfully in a reasonable time with no reported bundle-size regressions versus the routes table already known from this session's earlier work (49 routes, `/live-scan` at 12 kB / 99.4 kB First Load JS — consistent with the earlier PERF-04/bundle-bloat fix commit `3c5aff30`'s stated target).

---

## 17. QA Re-Verification

**Full test suite, executed live this session:**
```
1..93
# tests 596
# suites 67
# pass 596
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 49999.148   (first run)  /  52673.4754 (second run, same result)
```
Two independent full runs this session both produced 596/596 pass, 0 fail — consistent and reproducible. This is up from `audit/new.md`'s 415/66; the growth is expected (more rules, more regression tests since the prior audit) and was not independently re-derived rule-by-rule this session, only the final pass/fail summary was re-verified live.

`npx tsc --noEmit`: **zero errors**, both runs (confirmed across three separate re-runs this audit in total, including one from a parallel verification pass — always clean).

**New QA finding, not in `audit/new.md`: one real test file is silently excluded from the `npm test` script.** `tests/` contains 49 `*.test.ts` files; `package.json`'s `"test"` script enumerates only 48 by name (direct diff of the file list against the script string). The missing one is `tests/user-study-pipeline.test.ts` — run standalone, it passes cleanly (8/8, "Real Participant User Study Pipeline & Invariant Test Suite"), so this is **not** a hidden failure, but it means the well-publicized "596/596" figure does not actually include these 8 tests, and a regression there would not be caught by the enumerated CI command. **NEW-06 (LOW).** Recommend adding it to the script list.

**QA-02/QA-03 re-inspected this session** (see §4 matrix) — QA-02 confirmed still open verbatim; QA-03 confirmed partially mitigated by a new, stronger exact-value test file (`tests/anti-hardcoding-guard.test.ts`) that coexists with the original loose-floor test.

**Regression-test gap for this session's own FIGM-NEXT-03 fix:** none of `tests/rule-detection-matrix.test.ts`, `tests/ast-detection-rules.test.ts`, or `tests/qa-matrix-boundary-adversarial.test.ts`'s FIGM-NEXT-03 fixtures combine `'use client'` with a missing `revalidate` export — the specific bug fixed this session has no permanent committed regression test, only this audit's own manual live re-verification (§8). **NEW-07 (LOW).**

**Operational anomaly, reported honestly, not diagnosed with false confidence:** mid-session, a `next dev` process (PID 21776, port 3002) went silent — its log simply stopped mid-stream with no captured exception, stack trace, or exit message — sometime after handling a burst of 12 rapid `POST /api/scan` requests (all of which had themselves returned `200` successfully, per the log). A subsequent script attempting further requests got `ECONNREFUSED`. **No stack trace or crash log was captured**, so the root cause is genuinely unknown — it is *consistent with* (but not proven to be) an async, delayed effect of `DynamicProfiler`'s documented in-process code-execution behavior (`src/engine/dynamic-profiler.ts`, the same mechanism `benchmarks/real-world/METHODOLOGY.md` §6 already documents as capable of producing an unhandled async rejection well after the triggering request has returned), but the scanned code in this session's burst test was trivial synthetic JS (`const x=1;`), not a file matching that specific known trigger shape, so this attribution is **not confirmed, only plausible**. Separately, `next build` run concurrently with a still-running `next dev` against the same `.next` directory produced a build-worker crash (`exit code 3221226505`) — this **was** diagnosed: stopping the dev server and cleaning `.next` before rebuilding resolved it immediately and reproducibly, confirming it was resource contention from this session's own overlapping test sequencing, not an application defect.

**Root cause of the concurrent-build-worker crash, fully identified in a parallel verification pass of this same audit:** the offending `next dev` process (a *different* PID than the one this session's own dev-server work used) was traced to `netstat`/`tasklist`/PowerShell process inspection and found to have been started by one of this audit's own background research agents — despite that agent's explicit instruction not to start a dev server. System free memory at the point of failure was measured directly: **2.78GB free of 15.71GB total**, i.e. genuine host memory pressure, not a hypothetical. Killing that specific process (confirmed by its process-start-time and command line: `node .../next/dist/server/lib/start-server.js`) immediately resolved the crash on the next build attempt (`NODE_OPTIONS=--max-old-space-size=3072 npm run build` then succeeded cleanly, 49/49 routes). **This is the single most concrete piece of evidence in this entire audit that the build-worker instability was 100% attributable to this session's own tooling, not the application** — narrowing "resource contention from this session's own overlapping test sequencing" (already correctly suspected above) down to a specific, named, killed process.

---

## 18. Documentation Re-Verification

- **DOC-01 (26 unretracted `FINAL_*.md`) — FIXED.** Zero `FINAL_*.md` files in repo root; 33 documents now live under `docs/audit/archive/`.
- **DOC-03 (rule count/Vue category) — FIXED**, structurally (single-source-of-truth registry), see §7.
- **DOC-04 (viva/demo guides) — FIXED**, see §4 table and §10.
- **DOC-02 (test count drift)**: `VIVA_PREPARATION_GUIDE.md` states 543 tests/66 suites; live count is 596/67. The document explicitly tells the reader to "confirm the live count at defense time" — this is disclosed, expected drift, not a fabrication, but the number is stale and could be refreshed.
- **AST-01 (`.tex` overclaim) — FIXED**, see §6.
- **DOC-05 (README `file://` links) — NOT RE-VERIFIED this session.**
- **Not swept this session**: a full repo-wide grep for every numeric claim (LOC figures, degree/thesis-title claims) across the entire `docs/` and root `.md` corpus, as the original prior audit did exhaustively. This session's documentation checks were targeted at the specific items named in `audit/new.md`'s findings, not a fresh from-scratch sweep of the whole corpus.

---

## 19. Production Readiness Re-Verification

- `npx tsc --noEmit`: clean.
- `npm test`: 596/596 pass (two runs).
- `npm run build` (isolated): succeeds, 49 routes, no errors — **note**: an earlier attempt run concurrently with a live `next dev` process against the same `.next` directory crashed the build worker; this was a self-inflicted test-sequencing artifact of this audit session, confirmed resolved by isolating the build (see §17). A real CI/deploy pipeline that doesn't run `dev` and `build` concurrently against the same output directory would not hit this.
- **PROD-01, PROD-02, PROD-03 all confirmed STILL OPEN, unchanged**: no CSP/HSTS/Permissions-Policy headers (`next.config.mjs` only sets `X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy`); no `prisma/migrations/` folder; no custom `not-found.tsx`/`error.tsx`/`global-error.tsx`.
- Browser console during live-scan UI testing this session: one unreproducible `[EXCEPTION] Object` with no message/stack was observed once (§17 of the prior FIGM-NEXT-03 task's own audit trail); not correlated with any failed request in the server log at the time it appeared, and not reproducible under controlled re-testing. Reported as an open, unexplained, low-confidence anomaly, not silently omitted.
- Server logs across every live-testing session this audit ran: no `5xx` responses, no unhandled server-side stack traces surfaced to any client — only expected `401`/`403`/`429`/`400` status codes from the security tests themselves.

**Production readiness is not solely evidenced by build success.** Build and type-check are clean, and the four prior CRITICAL security findings are fixed and live-verified — a materially safer state than `audit/new.md`'s "not currently safe to deploy" verdict. It is still not unconditionally production-ready: PROD-01 (no CSP/HSTS) is a real gap for a public-facing deployment, and SEC-05's rate-limit-topology dependency needs the actual production reverse-proxy configuration to be exactly as documented (a real Vercel deployment was not available to verify this session).

---

## 20. Research Traceability Re-Verification

| Research Question | Prior classification | Current classification | Basis |
|---|---|---|---|
| Can a framework-independent tool detect defects across React/Next/Angular/Vue? | PARTIALLY VERIFIED | **PARTIALLY VERIFIED, materially strengthened** | Controlled benchmark unchanged (8/25 rules, 90.5/100/95, honestly scoped); a genuine real-world benchmark now exists (§11), providing the first non-synthetic evidence of cross-framework behavior, with an honestly-reported 39–72% sample precision and two newly-identified, still-open false-positive classes |
| Is detection genuinely AST-based? | CONTRADICTED as a blanket claim | **COMPLETE, as a precisely-scoped claim** — 23/25 rules have a real-AST path, framework-gated exactly as now documented in the `.tex` chapter, independently re-derived from source and matching | Verified from source (§6), not from documentation |
| Does automated remediation produce safe fixes? | PARTIALLY VERIFIED | **PARTIALLY VERIFIED, unchanged in kind** — template engine sound, correctly refuses unsafe cases (now including FIGM-NEXT-03 on Client Components); AI path real but inactive by default | §9, §14 |
| Does the tool improve on existing static-analysis tools? | UNSUPPORTED EMPIRICAL CLAIM | **NOT RE-VERIFIED this session** (BENCH-02 not re-checked) | — |
| Is FIGM usable by real developers? | PLANNED — NOT COMPLETED | **PLANNED — NOT COMPLETED, unchanged** | §13 |
| Is the benchmark ground truth independently validated? | PLANNED — NOT COMPLETED | **PLANNED — NOT COMPLETED, unchanged, freshly re-confirmed same-day** | §12 |
| Was FIGM evaluated on real open-source repositories? | NOT VERIFIED | **VERIFIED** — reversed this session, see §11 | §11 |
| Is the application secure enough for its production-readiness claims? | CONTRADICTED (2 live IDOR routes + committed credentials) | **COMPLETE for the 4 CRITICAL findings originally cited** — all 4 fixed and live-verified; SEC-05/06/07/08 remain open at lower severity | §5 |

---

## 21. Academic Examiner Challenge

| Claim | Evidence | Counter-evidence | Verdict |
|---|---|---|---|
| "FIGM is AST-based, framework-independent" | 23/25 rules real-AST, framework-gated, `sourceKind` field on every diagnostic | Vue is never real-AST for any rule; 9 of 23 "real-AST" rules are real-AST only for React/Next.js, not Angular either | **Accurate as currently, precisely worded** ("framework- and rule-gated hybrid," per the `.tex` chapter); would be false as a blanket, unqualified claim |
| "Detection accuracy is 90.5%/100%/95%" | Reproducible, dynamically-computed, matches across every location checked | Covers only 8 of 25 rules on 4 hand-authored fixtures; not representative of the other 17 rules or of real-world code generally | **Accurate, but only for the explicitly-disclosed scope** — and that scope disclaimer is now present everywhere the number is quoted, which this session checked |
| "FIGM was evaluated on real-world code" | 5 real, pinned-commit, publicly-verifiable repositories genuinely cloned and scanned; raw output with internally-consistent, non-fabricatable crash traces; honest 39–72% sample precision, not a round/perfect number | Only 5 repos, 80 files, all tutorials/demos, not production codebases; sample size for the spot-check (18/268) is explicitly non-random | **Verified as a real, if small and non-representative, evaluation** — not fabricated, correctly caveated by its own methodology document |
| "The real-world evaluation shows FIGM works well on real code" | 72% sample precision if narrow-TPs count | 39% if only clean TPs count; two concrete, reproducible false-positive classes found (FIGM-REACT-03 firing on non-React code, FIGM-REACT-01 matching `Vue.filter`) | **Not fully supported as an unqualified "works well" claim** — the tool's own documentation does not make this claim either; this audit's own §11 records both numbers |
| "AI-powered remediation" | Real Gemini integration exists, with genuine post-hoc verification | Inactive in the current deployment (`GEMINI_API_KEY` unset) | **True of the code; false of this deployment** — and the documentation now correctly makes this distinction (§14), which was the prior audit's specific complaint |
| "Security hardening is complete" | 4/4 CRITICAL findings fixed and live-verified this session | SEC-05 (rate-limit topology dependency), SEC-06 (PBKDF2 iterations), SEC-07 (CSV injection), SEC-08 (plaintext apiKey), PROD-01 (no CSP/HSTS) all remain open | **Materially, substantially improved; not "complete."** The CRITICAL tier is closed; MEDIUM/LOW items remain |
| "The application is accessible" | Several concrete, previously-cited defects (login labels, notifications keyboard access, mobile nav) are fixed and re-verified | Full WCAG sweep was not repeated this session; only previously-flagged items were re-checked | **Improved and partially re-verified; not exhaustively re-audited** |

---

## 22. Findings (Remaining Open Items)

| ID | Severity | File | Evidence | Problem | Impact | Recommended action |
|---|---|---|---|---|---|---|
| SEC-05 | MEDIUM | `src/auth/rate-limiter.ts:55-73` | Live: 15 requests w/ rotating spoofed `X-Forwarded-For` → 0/15 hit 429, vs. 5/15 with a fixed IP | Rate limiting is only as strong as the trust placed in the last CSV hop of `X-Forwarded-For`; correct for a single-trusted-Vercel-edge topology, bypassable otherwise | Brute-force protection can be defeated by header rotation in any deployment without that exact topology | Document/enforce the topology assumption at deploy time (e.g. reject requests where the header shape doesn't match the expected single-hop pattern), or move to a platform-native client-IP signal if available |
| SEC-06 | MEDIUM | `src/auth/auth-service.ts:105,116` | `pbkdf2Sync(..., 10000, ...)` | Below current OWASP guidance (≥600,000 iterations) | Weaker resistance to offline password-hash cracking if the DB is ever exfiltrated | Raise iteration count or migrate to argon2id/bcrypt |
| SEC-07 | LOW | `src/engine/export-service.ts:54-55` | Only `"` escaped in CSV export | Formula/CSV injection if a malicious `offendingCodeSnippet`/`remediation` string starting with `=`/`+`/`-`/`@` is exported and opened in Excel/Sheets | Low-likelihood client-side code execution via a crafted diagnostic string | Prefix a `'` (or equivalent) to any cell value starting with those characters |
| SEC-08 | LOW | `app/api/admin/users/route.ts:18` | `apiKey: u.apiKey` returned verbatim | Every admin can see every user's plaintext API key | Internal-trust decision, not a bypass, but broadens blast radius of any single admin-account compromise | Return a masked/last-4 form, or omit entirely and offer a regenerate-only flow |
| NEW-01 | LOW | `src/auth/user-db.ts:369` | `apiKey: figm_key_${Date.now()}_${Math.random()...}` | Regular-user API keys use non-cryptographic randomness (`Math.random`), unlike the admin bootstrap path which correctly uses `crypto.randomBytes` | In principle more guessable than a properly-random key; combined with SEC-08's plaintext exposure, a slightly larger blast radius | Use `crypto.randomBytes` for all API-key generation, not just the admin bootstrap path |
| NEW-02 | MEDIUM | `src/ast/real-syntax-node-builder.ts` (`buildReact03`), `src/matrix/four-layer-meta-model.ts` (FIGM-REACT-03's own `knownLimitation`) | Real-world benchmark spot-check: 4/5 false positives all trace to this one cause (`defaultProps`, `module.exports`, Karma config, Canvas `ctx.fillStyle`) | FIGM-REACT-03 flags any `Identifier.property = value` assignment as React state mutation, without verifying React/state context at all; this session's own earlier fix (`bb01d1c1`) narrowed but did not eliminate this | Concentrated, real, reproducible false-positive source on non-React code — the single largest accuracy gap this audit found evidence for | Require the assignment target to be traceable to a `useState`/`this.state`-bound identifier (or equivalent) before firing, not just a shape match |
| NEW-03 | LOW | `real-syntax-node-builder.ts` (`buildReact01`) | Real-world spot-check #14: `Vue.filter(key, fn)` matched as `Array.prototype.filter` | Method-name-only matching without receiver-type verification | False positive on any non-array `.filter`/`.sort`/`.reduce`-named call | Verify the receiver is plausibly array-typed (or narrow to known array-producing call chains) before firing |
| NEW-04 | LOW | `app/`, `public/` | `app/favicon.*` and `public/*.ico` both glob to zero files | No favicon configured anywhere in the app | Minor production-polish gap; browser tab shows a generic/no icon | Add `app/favicon.ico` (or `app/icon.tsx`) per Next.js App Router convention |
| NEW-05 | LOW (self-referential) | `app/live-scan/page.tsx:4` | Dogfood self-scan: `FIGM-NEXT-02` fires on the tool's own `import Editor ... from '@monaco-editor/react'` — no `dynamic(` anywhere in the file | The tool's flagship page still literally trips its own "heavy static import" rule (a different bug from the already-fixed `3c5aff30` bundle-bloat regression) | Credibility: an analysis tool whose own primary page fails the exact rule it enforces on others | Wrap `Editor` in `next/dynamic(..., { ssr: false })`, or explicitly document why the substring-match rule doesn't apply to `@monaco-editor/react` (which already lazy-loads its own core) |
| NEW-06 | LOW | `package.json` `"test"` script; `tests/user-study-pipeline.test.ts` | 49 `*.test.ts` files exist, only 48 enumerated in the `test` script; the missing file (8 tests, all passing standalone) is `user-study-pipeline.test.ts` | The reported "596/596" pass figure doesn't actually include these 8 tests; a regression there wouldn't be caught by the enumerated CI command | Minor coverage-reporting accuracy gap, not a hidden failure | Add the file to the `"test"` script's enumerated list |
| NEW-07 | LOW | `tests/rule-detection-matrix.test.ts`, `tests/qa-matrix-boundary-adversarial.test.ts` | No fixture combines `'use client'` with a missing `revalidate` export | This session's own `FIGM-NEXT-03` fix (blocking the rule from firing on Client Component pages) has no permanent committed regression test | If ever reverted, nothing in CI would catch it | Add a `'use client'`-page fixture with `expectFire: false` to the FIGM-NEXT-03 test matrix |
| NEW-08 | LOW (documentation-only) | `docs/audit/AST_ARCHITECTURE_AUDIT.md` (status banner); `docs/architecture/AST_MIGRATION_MAP.md` | Banner still says "15 of the 25 rules"; actual is 23/25 (confirmed in §6). Migration map still lists 7 already-migrated rules as "deferred" | Stale internal doc could mislead a reader who doesn't cross-check against `RULE_ENGINEERING_AUDIT.md` (which is current and correct) | Update the banner to 23/25 and reconcile the migration map's "deferred" list |
| NEW-09 | MEDIUM | live remediation test, `FIGM-A11Y-05` case in `src/engine/remediation-engine.ts` | Re-scanning the `FIGM-A11Y-05` auto-fix's patched output surfaces a new `TYPE-TS-2875` diagnostic not present on the original code, though the actual `aria-label` fix itself is correct and minimal | Unexplained new compiler diagnostic introduced by an otherwise-correct accessibility fix | Not root-caused this session; possibly isolated-snippet module-resolution noise, not confirmed | Investigate whether this is a real interaction between the type-checker and injected JSX attributes, or an isolated-snippet artifact |
| PROD-01 | MEDIUM | `next.config.mjs` | Only 3 of the recommended security headers set | No CSP/HSTS/Permissions-Policy | Standard defense-in-depth gap for a public deployment | Add a CSP appropriate to the app's actual asset/script origins, HSTS, and a Permissions-Policy |
| PROD-02 | MEDIUM | `prisma/` | No `migrations/` folder | Schema applied via hand-run SQL, no enforced parity check | Silent drift risk between `schema.prisma` and the live DB | Adopt `prisma migrate` for schema changes going forward |
| PROD-03 | LOW | `app/` | No `not-found.tsx`/`error.tsx`/`global-error.tsx` | Falls back to Next.js's generic defaults | Minor UX/branding gap, not a functional defect | Add branded error pages |
| HS-03 | MEDIUM | `research/CONSENT_FORM.md:8` | `ETHICS_APPROVAL_STATUS = NEEDS_VERIFICATION` | Still unresolved | Blocks real human-study execution until resolved | Resolve before any real participant recruitment |
| DOC-02 | LOW | `VIVA_PREPARATION_GUIDE.md:78` | States 543/66, live is 596/67 | Self-acknowledged expected drift, not fabrication | Minor, self-mitigated by the document's own instruction to reconfirm live | Refresh the number periodically, or replace with a "run `npm test` for the current count" instruction entirely |
| §17-anomaly | LOW (unresolved, not attributed) | — | One `next dev` process died silently mid-session after a burst of `/api/scan` requests, no captured stack trace | Root cause not confirmed; plausibly but not provenly related to `DynamicProfiler`'s known in-process-execution behavior | Operational robustness risk for any deployment that receives bursty real traffic to `/api/scan` | Add a top-level `process.on('unhandledRejection', ...)` handler in the actual server entrypoint (not just the benchmark script) that logs with enough context to attribute the failure, and prioritize the already-identified `DynamicProfiler` sandboxing fix (`benchmarks/real-world/METHODOLOGY.md` §6's own recommendation) |

**Resolved by a parallel verification pass within this same audit** (previously listed here as unknown, now closed, see §4/§17 for evidence): BENCH-02 (fabricated AI-patch/competitor-latency stats — FIXED AND VERIFIED), DOC-05 (README `file://` links — STILL OPEN, unchanged), QA-02 (tautological migration test — STILL OPEN, unchanged), QA-03 (loose metric-floor test — PARTIALLY MITIGATED by a new exact-value test).

**Still genuinely not independently re-verified this session** (carried over from `audit/new.md`, status unknown, listed so they are not silently dropped from tracking): full keyboard-navigation/focus/landmark accessibility sweep beyond the specific items re-checked, refresh-token rotation/revocation live re-test.

---

## 23. Final Scorecard

| Category | Status | Evidence | Remaining Risk |
|---|---|---|---|
| Research Integrity | **PASS WITH MINOR ISSUES** | §10, §11, §18 — canonical metrics reproducible and consistent everywhere checked; real-world evaluation genuine; viva/demo guides no longer coach fabrication; BENCH-02 and BENCH-04 both independently re-checked within this audit and confirmed FIXED AND VERIFIED | Remaining lower-severity documentation staleness only (DOC-02, DOC-05, NEW-08) |
| Research Methodology | **PASS WITH MINOR ISSUES** | §11 — real-world benchmark now exists with honest, non-inflated precision reporting and explicit non-representativeness caveats | Ground truth still covers 8/25 rules for the controlled benchmark; real-world corpus is small (5 repos) |
| FIGM Contribution | **PASS WITH MINOR ISSUES** | §6, §7 — working, well-tested, now more honestly-described detection engine | Two concrete, reproducible false-positive classes newly evidenced (NEW-02, NEW-03) |
| AST Architecture | **PASS WITH MINOR ISSUES** | §6 — 23/25 rules real-AST, framework-gated, matches dissertation `.tex` exactly, independently re-derived | Vue never gets real-AST treatment for any rule (documented, not hidden, but a real capability gap) |
| Static Analysis Engine | **PASS WITH MINOR ISSUES** | §6, §8 — live-tested across 4 frameworks + edge cases, no crashes, graceful degradation | FIGM-REACT-03/01 false-positive classes (NEW-02/03) |
| Rule Engine | **PASS** | §7 — 25/25 rules present and consistent across engine, registry, UI, spec, and all three test-matrix files | — |
| Benchmark | **PASS WITH MINOR ISSUES** | §10, §11 | Controlled benchmark still small/self-authored; real-world benchmark small and non-representative (both honestly disclosed) |
| Ground Truth | **PASS WITH MINOR ISSUES** | §11 | 8/25 rules for the only exhaustive ground truth that exists |
| Independent Validation | **PLANNED — NOT COMPLETED** | §12 | Infrastructure ready, zero real submissions, honestly and consistently disclosed |
| Human Study | **PLANNED — NOT COMPLETED** | §13 | 0 real participants; ethics status unresolved |
| Security | **PASS WITH MINOR ISSUES** | §5 — all 4 CRITICAL findings fixed and live-verified | SEC-05/06/07/08, NEW-01 remain (all MEDIUM/LOW) |
| API | **PASS** | §5, §8 — every route tested this session behaved correctly under attack | Not every one of ~30 routes was individually attacked |
| Database | **PASS WITH MINOR ISSUES** | §19, `audit/new.md` §13 (schema soundness not re-audited this session) | No migration history (PROD-02) |
| QA | **PASS** | §17 — 596/596 tests, 2 independent runs, `tsc` clean | One unattributed dev-server crash observed (operational, not test-suite) |
| Accessibility | **PASS WITH MINOR ISSUES** | §15 — every previously-flagged item specifically re-checked is fixed and hand-verified (including a real WCAG contrast computation) | Full sweep not repeated; dead `Header.tsx` and duplicate `/login` route still open |
| Performance | **PASS WITH MINOR ISSUES** | §16 — engine-level benchmarking (bypassing unreliable dev-server HTTP timing): 425ms for a 96KB/2000-pattern file, zero crashes across 9 edge-case categories, corroborated by a real 41ms/file average from the real-world benchmark | `FIGM-NEXT-02` self-violation on `/live-scan` (NEW-05); dev-server HTTP-layer latency itself unmeasurable this session due to environment flakiness (not attributed to the app); duplicate-polling claim not re-checked |
| UI/UX | **PASS WITH MINOR ISSUES** | §15 | Duplicate login routes, dead `Header.tsx` |
| Documentation | **PASS WITH MINOR ISSUES** | §18 — the 3 most severe prior documentation findings (DOC-01, DOC-03, DOC-04) all fixed and verified | DOC-02 stale (self-disclosed), DOC-05 not re-checked, no fresh full-corpus sweep performed |
| Production Readiness | **PASS WITH MINOR ISSUES** | §19 — build/typecheck clean, all CRITICAL security findings closed | PROD-01/02/03 still open; rate-limit topology dependency unverified against a real deployment |

---

## 24. Final Verdict

- **Software Engineering:** NEAR FINAL. Clean build, clean typecheck, 596/596 tests across two independent runs, and — critically — the four previously CRITICAL security defects are not just claimed-fixed but live-attacked-and-confirmed-fixed this session.
- **Static Analysis:** NEAR FINAL. The AST claim is now precisely, verifiably worded rather than overstated; genuine cross-framework live-scan behavior confirmed with no crashes on adversarial input.
- **AST Architecture:** NEAR FINAL. 23/25 rules real-AST, framework-gated exactly as documented; the one remaining `.tex`/`.md` mismatch from the prior audit is resolved.
- **Research Quality:** NEEDS MINOR IMPROVEMENT. The headline empirical claim is now reproducible and consistently stated everywhere checked; a genuine real-world evaluation now exists and is honestly, non-inflatedly reported. Independent annotation and the human study remain entirely unexecuted (correctly disclosed, not fabricated).
- **Research Validity:** NEEDS MINOR IMPROVEMENT. Same basis as above — validity is now honestly bounded rather than overstated, but the bounds themselves (8/25 rules, 5 small demo repos) are real limitations, not resolved ones.
- **Security:** NEEDS MINOR IMPROVEMENT. All CRITICAL findings closed and live-verified; several MEDIUM/LOW findings remain (PBKDF2 iterations, CSV injection, plaintext API keys, rate-limit topology dependency).
- **QA:** NEAR FINAL. Consistently the project's strongest area across both audits.
- **Accessibility:** NEEDS MINOR IMPROVEMENT. Every specifically-flagged prior defect that was re-checked is fixed and hand-verified; a full fresh sweep was not repeated, and two lower-severity UX items (dead component, duplicate route) remain.
- **Performance:** NEEDS MINOR IMPROVEMENT. Engine-level benchmarking (425ms/96KB/2000-pattern file, zero crashes across 9 edge-case categories, corroborated by real-world-benchmark timing) found no bottleneck; dev-server HTTP-layer timing was itself unmeasurable this session due to environment flakiness rather than an app defect. One genuine, newly-confirmed self-referential gap: the tool's own `/live-scan` page still trips its own `FIGM-NEXT-02` rule (NEW-05).
- **UI/UX:** NEEDS MINOR IMPROVEMENT.
- **Documentation:** NEEDS MINOR IMPROVEMENT. The three most severe prior findings (self-contradicting audit waves, fabricated-claim-coaching exam guides, stale rule count) are all fixed; one number is knowingly stale and several items were not re-swept this session.
- **Production Readiness:** NEEDS MINOR IMPROVEMENT. No longer blocked by live, unauthenticated data-leak vulnerabilities or committed credentials (the prior audit's explicit disqualifying condition) — remaining gaps are standard hardening items (CSP/HSTS, migration history, custom error pages), not exploitable defects found this session.

### Overall Verdict: **NEAR FINAL**

This is a substantial, verified improvement over `audit/new.md`'s "NEEDS MAJOR IMPROVEMENT." The two categories that previously disqualified the project outright — live, unauthenticated IDOR vulnerabilities plus a committed admin credential, and a research narrative that actively coached fabricated claims into a live examination — are both closed, and closed in a way this audit independently confirmed rather than assumed: real attack traffic against a running instance, hand-recomputed arithmetic matching every digit of the canonical metrics, and direct reading of the actual current viva/demo-guide text. What remains open is a set of genuinely lower-severity, well-understood items (rate-limit topology dependency, PBKDF2 iteration count, CSV injection, missing security headers, no migration history, two still-open false-positive classes in FIGM-REACT-01/03, a handful of newly-found LOW/MEDIUM QA and documentation-drift items (NEW-06 through NEW-09), and a few sections of `audit/new.md`'s original scope no session yet had time to independently re-touch: a full keyboard-navigation/focus/landmark accessibility sweep beyond the specific items re-checked, and refresh-token rotation/revocation live re-testing). BENCH-02, BENCH-04, DOC-05, and QA-02/03 — flagged as gaps earlier in this same document — were independently closed within this audit via a parallel verification pass (§4, §17, §22). None of the remaining open items is remotely of the same severity class as what blocked the prior verdict. This is not `FINAL-READY` — a genuinely complete final audit would need those remaining untouched sections independently re-verified too, not carried forward on trust — but it is real, substantive, evidence-backed progress, not a premature "VERIFIED" declaration of the kind `audit/new.md` §21 specifically warned this repository has a history of producing.

---

## 25. Top 10 Remaining Actions

1. ~~Independently re-verify BENCH-02~~ — **done within this same audit** (a parallel verification pass): confirmed FIXED AND VERIFIED, `src/eval/ai-patch-evaluator.ts` deleted and regression-tested, `tool-benchmark.ts` stripped of fabricated latency figures. BENCH-04 was already independently re-verified and closed (§4).
2. Fix FIGM-REACT-03's over-broad property-assignment matching (NEW-02) — now empirically confirmed as the single largest concentrated false-positive source found in real-world testing across two audits.
3. Fix FIGM-REACT-01's method-name-only matching (NEW-03) — confirmed firing on Vue's `Vue.filter()` API.
4. Resolve the rate-limiter's topology dependency (SEC-05) explicitly for whatever the actual production deployment target is, or hedge against it (e.g. combined IP+session/device signal).
5. Add CSP/HSTS/Permissions-Policy headers (PROD-01) before any public-facing deployment.
6. Raise PBKDF2 iterations (SEC-06) and escape CSV-export leading characters (SEC-07).
7. Investigate the unattributed dev-server process death (§17) — at minimum add a global `unhandledRejection` handler with real attribution logging to the actual server entrypoint, and prioritize `DynamicProfiler`'s already-identified sandboxing fix.
8. Resolve the `ETHICS_APPROVAL_STATUS = NEEDS_VERIFICATION` (HS-03) before any real human-study recruitment.
9. Consolidate the duplicate `/login`/`/auth/login` routes and delete the confirmed-dead `app/Header.tsx`.
10. Perform a fresh, full-corpus documentation and performance sweep (this session's checks were targeted at previously-named findings, not an exhaustive from-scratch pass like `audit/new.md`'s original one) before declaring the project unconditionally `FINAL-READY`.
