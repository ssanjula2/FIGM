# FIGM Code Inspector — Ultimate Final Forensic Audit

## 1. Audit Metadata

- **Date:** 2026-08-18.
- **Auditor:** Independent external examiner role (principal architect / static-analysis engineer / security engineer / QA engineer / accessibility engineer / performance engineer / research methodologist), executed as a coordinating agent orchestrating five independent, self-contained research passes plus direct synthesis and one piece of authorized live remediation.
- **Method:** This is not a single continuous audit session. Five parallel agents were dispatched, each with a distinct scope, each instructed to trust nothing from prior audit documents without independent re-derivation (live HTTP/DB testing, direct `git log`/`git show` commands, direct source reads with file:line citations, direct script/benchmark reruns). Their full detailed reports are preserved at `audit/sections-final/*.md` and are the primary evidence base for this document; this document is the synthesis, reconciliation, and final verdict layer on top of them. Nothing in this document asserts a fact that is not traceable to one of those five reports or to a command this coordinating session ran directly (the credential-rotation remediation in §13).
- **Predecessor documents:** `audit/new.md` (2026-08-13) and `audit/new-02.md` (2026-08-17, HEAD `c07e0f37`) were treated as **unverified hypotheses**, not facts — every finding they claimed as fixed was independently re-tested against current HEAD, not carried forward on trust. `audit/final-product-verification.md`, named in the audit brief, **does not exist in this repository** (`audit/*.md` glob returns only `new.md` and `new-02.md`) — this document does not fabricate its existence or contents.
- **A material, authorized exception to "no state changes during the audit":** partway through this audit, the live-security research pass discovered that the two seeded ADMIN accounts (`admin@figm.io`, `sanjula@nsbm.ac.lk`) were still authenticating against the real production Supabase database with the historically-leaked default password `Admin123456!`. The user explicitly instructed the coordinating session to rotate this immediately, and it was done via the application's own legitimate admin API (not a direct DB write, not a code change) — see §13 for the full before/after evidence. This is disclosed prominently because a "no source code was modified, nothing was committed" audit norm was observed by all five research passes, but this one live-data remediation action was taken, deliberately, on explicit user instruction, mid-audit.

---

## 2. Repository State (Phase 0)

```
Branch: main
HEAD:   02ed599d114847d86329605f6fae6d3b738e66ea
        "feat(Phase 10/11): real file and multi-file upload on the live-scan page"
Remote: origin https://github.com/ssanjula2/FIGM.git
Repository visibility: NOT publicly reachable via unauthenticated GitHub API/web (404 on both);
   whether this is specifically because it is set "Private" (vs. some other explanation) is
   NOT VERIFIED — no authenticated GitHub session was available to any research pass.
```

Baseline counts, independently confirmed by the QA/production research pass against current HEAD + working tree:

| Metric | Count |
|---|---|
| `tests/*.test.ts` files on disk | 52 |
| Files enumerated in `package.json`'s `"test"` script | 52 (exact match) |
| Rule IDs in `src/matrix/four-layer-meta-model.ts` | 25 (no duplicates, confirmed by two independent passes) |
| `app/api/**/route.ts` files | 32 |
| Actual test run result | **666/666 pass, 0 fail/skip/todo**, ~74s |
| `npx tsc --noEmit` | clean, exit 0 |

**Working tree at audit start was not clean.** `git status` showed 15 tracked files modified (mostly benchmark/report JSON/MD regenerated as a side effect of prior test/eval runs — an established, disclosed pattern per `audit/new-02.md`'s own note) and ~76 untracked files, the large majority under `scratch/` (test probes, JWT-shaped token captures, JSON response dumps from this and prior audit sessions). Two tracked files carried a **real, functional, uncommitted code fix**: `app/api/auth/logout/route.ts` and `src/auth/user-db.ts`, changing a `refreshToken: undefined` (Prisma silently ignores `undefined` in `update()`, so this never actually cleared the column) to `refreshToken: null` (which Prisma honors). This fix was independently live-verified as working (§9) but **is not part of HEAD `02ed599d`** — a fresh clone/CI checkout of that exact commit would not include it. This is flagged repeatedly below because it materially affects how "current state" claims should be scoped.

No destructive git operations were run by any research pass. No application source code was modified by any research pass. The one live-data change made this session (admin password rotation) is documented in full in §13.

---

## 3. Executive Summary

This audit found a project in a **substantially stronger security and QA posture than either prior audit documented**, and also found **the single most severe finding across all three audit cycles to date** — one that neither prior audit's brief anticipated and that was only surfaced by this session's dedicated focus on Phase 17 (server stability / untrusted code execution).

**What is now genuinely fixed and independently re-verified, live, against the current codebase (not carried forward from prior documents):**
- All 4 original CRITICAL application-layer security findings (unauthenticated IDOR, hardcoded JWT fallback, forged role/participantId) — still fixed, re-confirmed with fresh live attack traffic.
- SEC-06 (password hashing), SEC-07 (CSV injection), SEC-08 (plaintext admin API keys), NEW-01 (weak API-key randomness) — all fixed and independently re-verified, live.
- Two-user data isolation — fully re-verified live across every project/scan/export/list endpoint.
- PROD-01 (CSP/HSTS/Permissions-Policy), PROD-03 (branded error pages, favicon) — fixed and verified.
- QA-02 (tautological migration test) — fixed; **`audit/new-02.md` itself is now stale on this specific point**, a documentation/reality mismatch inside the audit trail itself.
- The 23-of-25-rules real-AST architecture claim — independently re-derived from source by a second pass and confirmed accurate and precisely scoped (Vue SFC genuinely never gets real-AST treatment; FIGM-ANG-03/04 are genuinely unconditional regex).
- The two previously-reported false-positive classes (FIGM-REACT-03 property-assignment overreach, FIGM-REACT-01's `Vue.filter()` misdetection) — both re-confirmed fixed via a fresh live rerun of the real-world benchmark against current HEAD, not just re-reading the fix commit messages.
- Test suite grew to 666/666 passing (0 skipped/todo), and the previously-known test-script exclusion gap (`tests/user-study-pipeline.test.ts`) is now closed.
- No new evidence of fabricated research/benchmark data was found anywhere in a fresh, independent, full-corpus documentation sweep. Independent annotation and the human usability study remain honestly, consistently disclosed as `PLANNED — NOT COMPLETED` — this project's strongest, most consistent trait across all three audit cycles is that it does not fabricate what it hasn't done.

**What is newly, critically wrong, found only in this cycle:**
1. **CRITICAL AT DISCOVERY → FIXED AND VERIFIED THIS SESSION — `DynamicProfiler` (`src/engine/dynamic-profiler.ts`) used to execute every submitted scan's source code in-process via `new Function()`, unconditionally, with no sandboxing.** Live-confirmed at discovery: submitted code could read `process.env` in full (85 real environment variable names captured), could hang the entire server indefinitely (an infinite loop never returned control — confirmed via a hard-killed subprocess probe), and an ordinary `async` function that throws (not even adversarial — this fired naturally, three times, while scanning unmodified real-world open-source code) crashed the whole Node process via Node's default unhandled-rejection behavior, because the application had **no** `process.on('unhandledRejection', ...)` handler anywhere. **Remediated this session** (see §17a): execution now happens in a disposable, isolated child process (`src/engine/sandbox/profiler-sandbox-runner.cjs`) spawned with a from-scratch, secret-free environment, a capped V8 heap, and a hard 3-second timeout with `SIGKILL`. Re-running the exact same three live probes against the fixed code confirms: the reachable `process.env` surface dropped from 85 real (secret-bearing) variables to 13 non-secret OS-loader defaults; the infinite-loop probe now returns control to the caller in ~3 seconds instead of hanging forever; and the parent process is confirmed still alive 500ms after the unhandled-rejection probe that previously crashed it outright. Full 666/666 regression suite re-run clean after the fix.
2. **CRITICAL, found live, and remediated mid-session on explicit user instruction — the two seeded ADMIN accounts were authenticating against the real production Supabase database with the historically git-leaked default password.** Independently reproduced (not merely re-quoted from a prior document): a live login with `Admin123456!` succeeded for both `admin@figm.io` and `sanjula@nsbm.ac.lk`, and returned a working privileged session. **This has now been fixed during this audit** — both passwords were rotated via the application's own admin API and the old password was confirmed to no longer work (§13). The code-level fix that was believed to address this (`resolveBootstrapAdminPassword` failing closed) turned out to have **zero effect** on this deployment, because it only governs a from-scratch JSON-fallback seed path this Supabase-backed deployment never uses — a real, load-bearing lesson about the gap between "the seeding code is fixed" and "the already-seeded data is fixed."
3. **CRITICAL, still open — `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and `DIRECT_URL` were committed to this repository's git history in its very first commit and have never been rotated**, confirmed byte-identical (SHA-256 hash comparison only, no values printed) between the current `.env` and the historically-committed one. `JWT_SECRET`/`REFRESH_SECRET` **were** rotated at some point (good) — the database-level credentials were not. The service-role key bypasses Supabase Row-Level Security entirely, meaning anyone with read access to this repo's git history (which was never rewritten — `98bac3f9` is still a live ancestor of `main`) has standing, application-independent, full read/write access to the production database, regardless of anything fixed in the Next.js application layer. **This audit could not rotate this itself** (no Supabase CLI or management API token available in this environment) and it remains the top open action item.
4. **HIGH — live, currently-valid bearer credentials were found at rest in the untracked, non-gitignored `scratch/` directory** (a still-valid 7-day refresh token, confirmed by successfully exchanging it live). `scratch/` is not in `.gitignore`, meaning a routine `git add -A` would restage exactly the class of secret this project has already suffered one real incident over.
5. **MEDIUM — a new latent defect in the just-fixed PROD-02 migration baseline**: `prisma/migrations/20260818075914_init_baseline/migration.sql`'s literal first line is a stray Prisma CLI stdout banner (`Loaded Prisma config from prisma.config.ts.`), not valid SQL — invisible against the already-baselined production DB (where the migration is recorded as applied and its body is never re-executed) but would break `prisma migrate deploy` on any fresh database (new dev machine, CI, disaster recovery).
6. **MEDIUM — a genuinely new, non-trivial correctness bug found only by this session's dogfooding**: FIGM's own framework detector misclassifies two of its own source files as `ANGULAR_TEMPLATE` purely because an identifier (`isNgForWithoutTrackBy`) and rendered JSX documentation prose ("trackBy", "RxJS") happen to contain Angular-hint substrings — comments/strings are correctly excluded from this check, but plain code identifiers and JSX text content are not. This is not cosmetic: it changes which of the 25 rules' framework gates apply to the file.
7. Several MEDIUM/LOW documentation-integrity findings, detailed in §22, including a genuine four-way contradiction in the project's own claimed test-pass-count across live documents (103 / 543 / 544 / 596, only one of which can be current), a stale "15 of 25" real-AST claim in `ARCHITECTURE.md` contradicting four other current documents that agree on 23/25, and an unhedged "unified AST" overclaim in `chapter3_architecture.tex` that its sibling chapter was specifically corrected to avoid.
8. **MEDIUM, research-integrity/ethics-adjacent, informational-to-medium severity — the live production database contains ~30 seeded user records using names/emails that resemble real, identifiable open-source maintainers** (patterns resembling `rauchg@vercel.com`, `yyx990803@vuejs.org`, `dan@react.dev`, etc.), one of which holds the `ADMIN` role. This is not a live-exploitable security bypass, but fabricated records impersonating identifiable real people sitting in an internet-reachable, production-equivalent database is a data-integrity and reputational issue this project's own documented history of fabrication concerns makes directly relevant, and it should be cleaned out regardless of this audit's security verdict.

Given finding #1 in particular — a remote, unauthenticated (from the scanner's perspective; reachability depends on whether `/api/scan`/`/live-scan` requires login, see §9) path to full environment-variable disclosure and total server hang/crash, present on every single scan — **this project cannot be called FINAL-READY**, and the severity class is worse than anything either prior audit document identified. The overall verdict is **NEEDS MAJOR IMPROVEMENT** (see §31), a step down from `audit/new-02.md`'s "NEAR FINAL" — not because the many things that document verified as fixed have regressed (they mostly haven't), but because this cycle looked somewhere the prior cycles didn't look hard enough, and found something worse.

---

## 4. Architecture Map (Phase 1)

Traced and independently confirmed across research passes (full detail: `audit/sections-final/ast-engine-benchmarks.md`, `audit/sections-final/live-security.md`):

```
PUBLIC UI (app/live-scan, app/login, app/register, ...)
  -> AUTH (app/api/auth/*, src/auth/auth-service.ts — JWT HS256, scrypt+legacy-PBKDF2 hashing)
  -> USER WORKSPACE / PROJECT (app/api/projects/*, ownership-checked)
  -> INPUT (POST /api/scan, POST /api/scans — code string in request body)
  -> FRAMEWORK DETECTION (src/parser/source-parser.ts detectFramework(); confirmed live-fragile, §4/§17 finding)
  -> PARSER (src/parser/typescript-framework-parser.ts — real TS compiler, crash-guarded;
             src/analysis/type-checker-service.ts — a SECOND, UNGUARDED ts.createSourceFile() call site, §17)
  -> AST (src/ast/real-syntax-node-builder.ts [23/25 rules, framework-gated] +
          src/analysis/react-ast-rules.ts [FIGM-REACT-02, separate module] +
          legacy regex in source-parser.ts for the remaining framework/rule combinations)
  -> DYNAMIC PROFILING (src/engine/dynamic-profiler.ts — UNSANDBOXED new Function() exec, §17 CRITICAL)
  -> FIGM RULE ENGINE (src/ast/ast-detection-engine.ts, 25 eval*() predicates)
  -> DIAGNOSTICS -> SCORE (src/engine/quality-score.ts, server-computed, not client-trusted)
  -> REMEDIATION (src/engine/remediation-engine.ts, template/regex; src/ai/* Gemini path, inactive by default)
  -> RE-SCAN (re-invokes the same pipeline)
  -> DATABASE (Prisma -> Supabase Postgres, confirmed live and genuinely used, §9)
  -> HISTORY / EXPORT (app/api/scans, app/api/export — CSV formula-injection now mitigated)
  -> ANALYTICS (app/analytics — reads live API data, no hardcoded numbers found)
```

**Duplicated/dead paths found:** a JSON-file storage-provider fallback path (`UserDB`/`JsonStorageProvider`) exists and is fully functional but not the active path in this deployment (`STORAGE_PROVIDER=supabase`); its own admin-seeding logic was fixed to fail closed, but that fix has zero effect on the live Supabase-backed deployment (§13) — a real example of a fix landing in the wrong layer. `vscode-extension/out/` (152 tracked files) is a checked-in compiled build artifact containing a duplicate, non-secret copy of the dev-only JWT fallback constant — dead weight, not a vulnerability. No hardcoded/demo-only scan results were found anywhere; every score/diagnostic traced to a live, server-side computation.

---

## 5. Real User Lifecycle (Phase 2)

Live-tested end-to-end by the security research pass against a fresh `next dev` instance backed by the real, remote Supabase Postgres database (confirmed via UUID-format user IDs, matching Prisma/Postgres defaults, versus the legacy `usr_<timestamp>` format the JSON fallback produces):

register → login → authenticated route → **logout → refresh-after-logout → re-login** was run as a clean, never-rotated-token test. Result: `POST /api/auth/refresh` with the pre-logout refresh token correctly returned `401 TOKEN_REVOKED` — the uncommitted logout fix (§2) works exactly as intended, live, against the real database. Re-login and `GET /api/auth/me` afterward returned the same durable account in a brand-new, cookie-less session, confirming server-side (not in-memory/localStorage) persistence.

**VERDICT: FIXED AND VERIFIED**, with the caveat that this fix is currently working-tree-only, not in HEAD (§2, §9, §31 action items).

---

## 6. Database Forensics (Phase 4)

- Confirmed genuinely Prisma/Postgres-backed for all data created during this audit: new test users got real UUID ids; the local `figm-user-db.json` fallback file's mtime predates the session and contains none of the new test accounts, while those accounts nonetheless authenticate correctly.
- The two legacy admin rows (`usr_admin_figm`, `usr_admin_sanjula`) use the old non-UUID id format, consistent with predating the Prisma/Postgres migration and never having been re-created since — direct evidence this is a real, aged production database, not a fresh demo seed.
- `prisma/migrations/` now exists (PROD-02, §7) with a real 276-line baseline SQL file and a 12-table schema; `prisma migrate status` against the live DB reports "up to date." **New defect**: the migration file's first line is corrupted CLI banner text (§7), invisible on the already-baselined production DB but would break a fresh deploy.
- No evidence found that the JSON-file fallback can silently become production persistence in this deployment — `STORAGE_PROVIDER=supabase` is set and the provider selection logic was read directly (`src/storage/repository-factory.ts:16`).

**VERDICT: FIXED AND VERIFIED**, with the PROD-02 migration-file caveat noted as a new, separate MEDIUM finding.

---

## 7. Authentication & Authorization (Phases 2–3, 13)

Full live attack matrix (complete detail in `audit/sections-final/live-security.md` §3–4):

| Test | Result | Verdict |
|---|---|---|
| Two-user isolation: B → A's project/scan (GET/PATCH/DELETE), export, list-scoping | 403 on all direct-access attempts; A's data absent from B's lists | FIXED AND VERIFIED |
| Anonymous → any protected route | 401 uniformly | FIXED AND VERIFIED |
| Missing / malformed / tampered-signature / `alg:none`-forged-role JWT | 401 on all four | FIXED AND VERIFIED |
| Forged `role:"ADMIN"` at registration | Server clamps to `DEVELOPER`; `AUDITOR` self-service role correctly honored | FIXED AND VERIFIED |
| Forged `participantId`/`qualityScore`/`userId` in `POST /api/scans` | No such fields are read from the body at all; `userId` is always the authenticated session's | FIXED AND VERIFIED |
| Rate limiting, fixed spoofed IP | Correctly triggers 429 after the configured threshold | FIXED AND VERIFIED |
| Rate limiting, rotating spoofed `X-Forwarded-For` | **Never rate-limited across a 13-request burst — full bypass** | CONFIRMED, residual MEDIUM (matches prior SEC-05; inherent to any topology without a trusted single reverse-proxy hop) |
| CORS preflight from an untrusted origin | No `Access-Control-Allow-Origin` header set; allow-listed origin correctly gets one | FIXED AND VERIFIED |
| Cookie flags | `HttpOnly`+`SameSite=Strict` present; `Secure` correctly conditional on `NODE_ENV=production` (absent in this dev test, as designed) | FIXED AND VERIFIED (as designed) |
| Default admin password `Admin123456!` against the real DB | **Succeeded live for both admin accounts** at time of discovery | CRITICAL at discovery; **REMEDIATED this session, see §13** |
| `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL`/`DIRECT_URL` rotation vs. git-history-exposed values | **Byte-identical — never rotated** | CRITICAL, STILL OPEN |

**Password hashing (SEC-06):** scrypt (`N=2^16, r=8, p=1`, random 16-byte salt) is genuinely the current algorithm; legacy PBKDF2-SHA512/10k hashes still verify and are transparently rehashed to scrypt on next successful login, in the correct order (verify-old → rehash → persist). One cosmetic-only defect: the docstring above `hashPassword` says "N=2^17" while the actual constant and the design-rationale comment both correctly use 2^16. **FIXED AND VERIFIED.**

**CSV export injection (SEC-07):** `sanitizeCsvCell` neutralizes leading `=`/`+`/`-`/`@` on every exported field, live-confirmed via a real export round-trip. **FIXED AND VERIFIED.**

**Admin apiKey exposure (SEC-08):** `GET /api/admin/users` now returns every key masked to its last 4 characters, live-confirmed across 255 real records. **FIXED AND VERIFIED.**

**API-key randomness (NEW-01):** both the admin-bootstrap and regular-user paths now use `crypto.randomBytes(16)`. **FIXED AND VERIFIED.**

---

## 8. Input & Framework-Detection Forensics (Phases 5–6)

Malformed-input resilience was independently stress-tested (`audit/sections-final/ast-engine-benchmarks.md` Task 3): empty string, unclosed braces, Unicode/emoji identifiers, null bytes, a 200k-character single line, and a 407KB/2000-function synthetic file all completed cleanly. One real crash was found and root-caused: 20,000 levels of nested unclosed braces triggers a genuine, uncaught `RangeError: Maximum call stack size exceeded` — but **not** through the crash-guarded `TypeScriptFrameworkParser`; through a second, separate, unguarded `ts.createSourceFile()`/`ts.createProgram()` call site in `src/analysis/type-checker-service.ts:98`, called unconditionally by `RuleExecutionEngine.analyzeFile`. Every API route calling `analyzeFile` wraps its handler body in try/catch, so this currently degrades to a caught `500` for the one request rather than a process crash — real, but **MODERATE**, distinctly less severe than the DynamicProfiler findings in §9.

**Framework misdetection (new finding, not in any prior audit):** FIGM's own dogfooding run found two of its own source files misclassified as `ANGULAR_TEMPLATE`. Root-caused by bisection against the real, unmodified detector: `source-parser.ts`'s own Angular-hint check (`lowerCode.includes('trackby')`) runs after comment/string-stripping, but that stripping pass has no state for plain code identifiers or JSX text content — so the identifier `isNgForWithoutTrackBy` (part of FIGM's own Angular-rule implementation) and rendered documentation prose mentioning "trackBy"/"RxJS" on the guidelines page both flip the whole file's detected framework. This is the same underlying defect class as an already-fixed "`@Component` in a comment" false positive, one layer short of complete: comments/strings are excluded, identifiers and JSX text are not. **Real, reproducible, changes which of the 25 rules' gates apply to the affected file — MEDIUM.**

---

## 9. AST Architecture (Phase 7) — Full 25-Rule Table

Independently re-derived from source by a dedicated research pass (not copied from either prior audit), cross-checked against `docs/architecture/RULE_ENGINEERING_AUDIT.md`'s own per-rule `knownLimitation` text where relevant. Full table with file:line evidence lives in `audit/sections-final/ast-engine-benchmarks.md` Task 2; summarized:

- **23 of 25 rules** have at least one framework with a genuine TypeScript-compiler-AST path (`ts.is*()`/`ts.forEachChild` in `src/ast/real-syntax-node-builder.ts`, plus a separate module `src/analysis/react-ast-rules.ts` for FIGM-REACT-02 specifically — a correction to the prior audit's framing, which attributed all real-AST rules to a single file).
- **FIGM-ANG-03** (`*ngFor` trackBy) and **FIGM-ANG-04** (template method-call detection) are confirmed **unconditional regex for every framework, including Angular itself** — no `useRealAst*` gate exists for either at all (direct proof: absence of the gate pattern present on every other rule's regex block).
- **VUE_SFC gets zero real-AST coverage across all 25 rules**, structurally guaranteed by `canAttemptRealAstParse()` excluding it before any rule-specific logic runs.
- `sourceKind: 'REAL_AST' | 'LEGACY_TEXT_HEURISTIC'` is present and correctly populated on every diagnostic from `real-syntax-node-builder.ts`-produced nodes, defaulting to `LEGACY_TEXT_HEURISTIC` when absent — **except** `react-ast-rules.ts`'s FIGM-REACT-02 path, which does not set `sourceKind` on its own `DiagnosticReport` (a minor provenance-labeling gap, LOW).
- Merge architecture confirmed by reading actual gate conditions: real-AST and legacy nodes are merged into one tree with mutual exclusion per rule/framework pair — never double-firing (independently spot-checked live: exactly one FIGM-REACT-02 finding per real violation, not two).

**VERDICT: CONFIRMED**, the 23/25-real-AST / Vue-never-real-AST / ANG-03-ANG-04-always-regex claim is accurate and now independently re-derived twice (this audit and the prior one), by two different methods, with matching results.

---

## 10. Rule Catalog Completeness (Phase 8)

Exactly 25 rules, single source of truth (`FOUR_LAYER_MAPPINGS` → `rule-registry.ts`'s `RULE_CATALOG` → `app/guidelines/page.tsx`), no duplicates, confirmed by two independent passes (grep-count cross-checks on `four-layer-meta-model.ts`, `ast-detection-engine.ts`, `figm-spec.json`, all agreeing on 25/25/25 with identical ID sets). A 5-rule metadata spot-check (severity, framework support, `knownLimitation`) found **one drift**: `four-layer-meta-model.ts`'s `knownLimitation` text for **FIGM-REACT-03** describes the rule's old, pre-fix, unqualified behavior ("any local variable... flagged whether or not it is actually component state"), while `figm-spec.json`'s text accurately describes the current, narrower, evidence-gated implementation. This is **user-facing** — `app/guidelines/page.tsx` renders `four-layer-meta-model.ts`'s (stale) text directly to end users. **DOCUMENTATION-IMPLEMENTATION MISMATCH, LOW-MEDIUM, narrow scope, easy fix.**

---

## 11. Live Scan & Benchmark Correctness (Phases 9–10, 22–23)

**Controlled benchmark** (`npm run eval`, rerun fresh this session): byte-for-byte identical TP=19/FP=2/FN=0/P=90.48%/R=100.00%/F1=95.00% versus the pre-run canonical artifact — fully deterministic on the 4-fixture/19-violation/8-rule testbed, as expected for a static rule engine. **FIXED AND VERIFIED**, matches every location this and the prior audit checked (README, dissertation `.md` and `.tex`, VIVA guide, 3 mirrored benchmark-results copies, analytics page — all either match exactly or are computed live from the same source at render time).

**Real-world benchmark** (5 pinned public repos, rerun fresh against current HEAD — 2 via the official script succeeding end-to-end, 3 via an equivalent standalone reproduction after intermittent Windows/git-for-Windows clone flakiness unrelated to FIGM's own code, root-caused and documented): 80 files / 4,732 LOC / 114 total findings / **0 synchronous engine crashes**. The two previously-reported false-positive classes were specifically re-checked: **FIGM-REACT-01's `Vue.filter()` namespace fix holds** (re-scanning the exact originating file, `vue-hackernews-2.0/src/entry-client.js` and siblings, shows 8 findings, all genuine array `.filter()`/`.sort()`/`.reduce()` calls on lowercase-initial identifiers — zero namespace false positives); **FIGM-REACT-03 shows 0 findings across all 5 repos** (consistent with "fixed," though this small corpus doesn't meaningfully stress-test the rule either way — an honest limitation the benchmark's own methodology document already discloses).

**VERDICT: FIXED AND VERIFIED**, both false-positive classes confirmed closed via a fresh live rerun, not a re-read of commit messages.

---

## 12. Remediation, Self-Dogfooding, and Rule-Metadata Findings (Phases 11, 25)

Dogfooding FIGM's engine directly against its own source (`app/live-scan/page.tsx` and 4 other substantial files) surfaced, beyond the framework-misdetection bug in §8:

- Two genuine `FIGM-REACT-02` true positives (array-index-as-`key` in `.map()` calls) — correctly detected.
- Several `FIGM-REACT-01`/`FIGM-PERF-05` findings that are technically correct per the rules' own documented, narrow scope (no cost/size threshold) but reflect a known-limitation pattern, not an engine bug.
- A recurring "rule fires correctly per its own predicate but the predicate has no way to know the file isn't relevant to the rule's rationale" theme: `FIGM-PERF-04` (dynamic-import advice) firing on a server-only Next.js Route Handler that is never shipped to a browser bundle, and `FIGM-REACT-01` firing on `real-syntax-node-builder.ts`'s own `NodeArray.filter(ts.isJsxAttribute)` — the TypeScript compiler API's own `.filter()`, not a React render-loop computation, in a file that is not a React component at all.
- No fake/hardcoded/cached findings were found anywhere; every diagnostic traced to genuine analysis of the actual submitted code.

**VERDICT:** engine correctness is real; the two new self-diagnosed issues (framework misdetection, §8; rule-relevance blind spot for non-component/server-only files) are genuine, previously-unflagged limitations, not fabrications.

---

## 13. Security — Live Remediation Performed This Session

This section documents the one authorized state-changing action taken during this audit, at the user's explicit instruction, after the live-security and AST-engine research passes independently surfaced two CRITICAL findings.

**Before (confirmed live by the research pass, then independently re-confirmed by the coordinating session before acting):**
```
POST /api/auth/login {"email":"admin@figm.io","password":"Admin123456!"}       -> 200, ADMIN session
POST /api/auth/login {"email":"sanjula@nsbm.ac.lk","password":"Admin123456!"}  -> 200, ADMIN session
```
Both accounts authenticated against the real, live, configured Supabase Postgres database with the exact password string that was historically committed to source and separately printed in a prior audit document. `GET /api/admin/users` with the resulting token returned real data (257 total user rows) — a genuine, currently-privileged session, not a stale/cached response.

**Action taken (coordinating session, this audit, with explicit user authorization):**
1. Logged in as `admin@figm.io` using the known leaked password to obtain a legitimate admin session.
2. Retrieved both admin account IDs (`usr_admin_figm`, `usr_admin_sanjula`) via the real `GET /api/admin/users` endpoint.
3. Generated two new, cryptographically random 24-character passwords.
4. Rotated both accounts' passwords via the application's own existing `PATCH /api/admin/users {userId, newPassword}` endpoint (real production code path, not a direct database write).
5. Verified: the old password now returns `401`; both new passwords authenticate successfully.
6. Deleted the local scratch files that briefly held the session/credentials; the new passwords were delivered to the user directly in conversation (the only appropriate channel) and are not stored anywhere in this repository or its scratch directories.

**After:**
```
POST /api/auth/login {"email":"admin@figm.io","password":"Admin123456!"}     -> 401
POST /api/auth/login {"email":"admin@figm.io","password":"<new password>"}   -> 200
POST /api/auth/login {"email":"sanjula@nsbm.ac.lk","password":"<new pw>"}    -> 200
```

**VERDICT: CRITICAL AT DISCOVERY → FIXED AND VERIFIED (remediated live, this session, 2026-08-18).** This closes the specific admin-password exposure. It does **not** close the underlying git-history exposure (§14) or the still-unrotated `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL`/`DIRECT_URL` (§14), both of which remain open and are not fixable from within this environment (no Supabase dashboard/CLI/management-API access available).

**Important root-cause note, independently significant beyond the fix itself:** the code-level change that was believed to have already addressed this (`resolveBootstrapAdminPassword()` in `src/auth/user-db.ts`, which now fails closed and no longer hardcodes `'Admin123456!'`) turned out to have **zero effect** on the live, exploited condition. That function only governs a from-scratch JSON-file seeding path (`JsonStorageProvider`/`UserDB`), which this Supabase-backed deployment (`STORAGE_PROVIDER=supabase`) never invokes — `SupabaseStorageProvider` has no seeding logic of its own; it only ever reads/updates rows that already exist. A prior audit script found in `scratch/batch13-revoke-admin-tokens.ts` shows an earlier pass had already identified this exact gap and mitigated only the *token* exposure (revoking the stored refresh token) while explicitly leaving the *password* itself unrotated — i.e., this specific condition was known and partially, not fully, mitigated before this session. This is a reusable lesson for this project going forward: **"the seeding code was fixed" and "the already-seeded production data was fixed" are different claims, and this audit found a real, live instance of the gap between them.**

---

## 14. Git History & Secrets Forensics (Phase 14)

Independently re-derived (not copied) from `docs/audit/GIT_HISTORY_SECRET_REMEDIATION.md`'s claims by a dedicated static-forensics pass:

| Claim | Independent re-verification |
|---|---|
| `figm-user-db.json` committed `98bac3f9`→`20e28f03`, 74 commits | **Confirmed exactly**, `git log --all --oneline` count matches |
| `.env` committed `98bac3f9`→`56ddcfc0`, 2 commits | **Confirmed exactly** |
| 465 user records in the pre-removal snapshot | **Confirmed exactly**, via direct record-count parsing (no values printed) |
| Admin refresh token present in that snapshot | **Confirmed**, plus a detail the original doc omitted: **16 non-admin refresh tokens were also committed**, and **both seeded admin accounts shared one password hash** |
| Repo is "private" | **NOT independently confirmable** — unauthenticated GitHub returns an identical 404 for private and nonexistent repos; only "not publicly browsable" is confirmed |
| Current tree clean of real secrets | **Confirmed clean** — a fresh, wider sweep (adding PEM-block and JWT-literal patterns the prior sweep didn't explicitly check) found zero real secrets; all `postgres://`-shaped hits are placeholders or documented localhost/CI fallback defaults |
| History never rewritten | **Confirmed** — `git merge-base --is-ancestor 98bac3f9 main` succeeds; `98bac3f9` (containing the full historical `.env` and `figm-user-db.json`) is still a live ancestor of `main`. No `filter-repo`/BFG pass has ever run. |
| `JWT_SECRET`/`REFRESH_SECRET` rotation status ("not verified" per the source doc) | **Resolved: both confirmed rotated** (SHA-256 hash comparison against the historical commit, no values printed) |
| `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL`/`DIRECT_URL` rotation status | **NEW FINDING, not named by the source doc or either prior audit: confirmed byte-identical to the historically-committed value — never rotated. CRITICAL, STILL OPEN.** |

**New structural finding, distinct from the original incident:** the untracked `scratch/` directory (61 files across this and prior audit sessions) is **not listed in `.gitignore`**. It currently contains at least one confirmed-valid, live 7-day refresh token (`scratch/refresh-token.txt` — live-tested by successfully exchanging it via `POST /api/auth/refresh`) plus several expired JWT-shaped test artifacts. A routine `git add -A`/`git add .` would restage all of it, reproducing the exact class of incident (credentials committed to source) this project has already suffered once, under a new directory name. **HIGH**, recommend adding `scratch/` to `.gitignore` immediately — this is a near-zero-cost fix.

Also found, lower severity: `FIGM_CODE_EXPORT.txt` (24,843-line full source-code dump sitting untracked at repo root, grepped clean of secrets but shouldn't persist there — LOW); `vscode-extension/out/` (152 tracked compiled files, including a duplicated non-secret dev-fallback JWT constant — LOW, hygiene only).

---

## 15. Accessibility (Phase 15)

Not independently re-run fresh by any of this session's five research passes (none was scoped to a full WCAG sweep with live browser interaction). This is a genuine gap in this audit cycle's coverage, carried forward as **NOT VERIFIED this session**. The prior audit's specific, individually re-checked fixes (login label association, notifications keyboard access, mobile nav toggle, contrast ratio) were not re-tested here and should not be assumed still correct without a fresh check — they are also not contradicted by anything found this session, which only touched accessibility incidentally via UI screenshots taken for other purposes. **Recommend a dedicated fresh accessibility pass before any FINAL-READY claim.**

---

## 16. Performance (Phase 16)

Direct engine-level benchmarking (bypassing HTTP/browser, since dev-server HTTP timing was previously documented as unreliable in this environment): a synthetic ~100KB/843-violation file completed in 700ms–1s across repeated runs (first run slower, consistent with JIT warm-up, not algorithmic degradation); the existing committed 210KB/2000-violation performance-budget test (`<15s`) passed as part of the full suite run. **No performance regression found. FIXED AND VERIFIED / no bottleneck evidenced.**

---

## 17. Server Stability & Untrusted Code Execution (Phase 17) — CRITICAL

This is the audit's most important section. Full technical detail: `audit/sections-final/ast-engine-benchmarks.md` Task 4.

`DynamicProfiler.profileExecution()` (`src/engine/dynamic-profiler.ts:34-137`) is called **unconditionally, on every single scanned file**, before any rule evaluation, via:
```js
const fn = new Function('React', 'exports', 'require', `try { ${executableCode} } catch(e) { return e; }`);
const res = fn({}, {}, () => ({}));
```
No `vm` module, no worker thread, no child process, no timeout, no memory cap. The comment directly above this code reads `// Sandboxed execution evaluation harness` — this is materially inaccurate; it is direct, unsandboxed, in-process execution of arbitrary submitted source.

**Live-confirmed impact (4 independent tests):**
1. **Confidentiality**: submitted code can read `process.env` in full — 85 real environment variable names captured live from the host process. On a real deployment this is direct exfiltration of every server-side secret (the same `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL`/`JWT_SECRET` discussed in §13–14) to anyone who can submit code to the scan endpoint — rotating those secrets (§14's open action item) does not close this hole; a newly-rotated secret is exactly as readable as the old one the moment it's deployed.
2. **Availability, vector 1**: an infinite loop (`while (true) {}`) never returns control. Confirmed via a hard-killed subprocess probe (6-second SIGKILL deadline, used specifically so the probe couldn't hang the audit's own shell) — the child process never exited on its own. Since this runs synchronously on Node's single event-loop thread with no timeout anywhere in the call chain, this **blocks the entire server for every concurrent user**, not just the submitting request.
3. **Availability, vector 2**: any submitted code whose top-level function is `async` and throws — an extremely common, entirely non-adversarial JavaScript pattern — produces an unhandled Promise rejection that, by Node's default behavior, **terminates the entire process**. Confirmed twice: once via a crafted probe (which crashed the audit's own test harness outright), and independently, **three separate times, from ordinary unmodified real-world open-source code** (`vercel/nextjs-portfolio-starter`'s `scripts/gen-rss.js`) during this session's own real-world benchmark rerun — this is not a hypothetical adversarial edge case, it happens on real code in the wild.
4. **Blast radius confirmed**: `grep -rn "unhandledRejection\|uncaughtException" app/` → zero matches. FIGM's actual Next.js API layer has no process-level safety net at all. The real-world benchmark script itself (`benchmarks/real-world/run-real-world-benchmark.ts:257-266`) registers its own handler purely so the *benchmark tooling* survives — a workaround for the benchmark's own purposes, explicitly documented in `METHODOLOGY.md` §6 as **not a production fix**.

**Partial, real mitigation confirmed to exist**: `require` is genuinely stubbed and blocks direct `require('fs')`/`require('child_process')`-style module loading — this specific channel is closed. It does **not** protect `process.env`, `process.exit`/`process.abort` (both true globals, unaffected by the `require` shadow), or either DoS vector above.

A second, related but less severe finding: `src/analysis/type-checker-service.ts:98` calls `ts.createSourceFile()`/`ts.createProgram()` with no try/catch anywhere in the function, unlike the properly-guarded `TypeScriptFrameworkParser`. A 20,000-level nested-unclosed-brace payload (trivially cheap to construct) triggers a real, uncaught `RangeError` here — currently caught one layer up by each API route's own try/catch (degrading to a `500` for that one request), so this is **MODERATE**, not process-fatal like the DynamicProfiler findings above.

**VERDICT AT DISCOVERY: CRITICAL, CONFIRMED, unmitigated in production.** If `/live-scan` or `POST /api/scan` is reachable by any user who can submit source code (this audit did not separately re-verify whether that endpoint requires authentication in the current deployment — see §31 open action item to confirm), this should be treated as a full remote-secret-disclosure-and-denial-of-service vulnerability, not a documented engine limitation.

### 17a. Remediation performed this session

Following this finding, the user directed a full remediation, executed in this same session. Summary (implementation detail in `src/engine/dynamic-profiler.ts` and the new `src/engine/sandbox/profiler-sandbox-runner.cjs`; full trace of every `new Function`/`eval`/`vm.*` call site in the repo was re-confirmed first, per the standard Step-1-before-Step-2 discipline — the only other execution primitive found was `TypeCheckerService.checkCode()`'s `ts.createSourceFile`/`ts.createProgram`, which does not execute code but was still unguarded against a stack-overflow crash; that was fixed in the same pass, see below):

- **The real Next.js/Node server process no longer executes any submitted source code directly, under any code path.** `DynamicProfiler.profileExecution()` retains its original synchronous public signature (avoiding a large, risky async-refactor across ~90 existing call sites in tests/CLI/benchmarks/API routes), but internally delegates the actual `new Function()` execution to a disposable child process via `child_process.spawnSync`.
- **Confidentiality control**: the child is spawned with a from-scratch, explicitly-curated `env` object — never a copy or filtered subset of the real `process.env` — containing only the minimum needed for the OS process loader itself to start (`PATH`, `SystemRoot`/`TEMP`/`TMP` on Windows). No application secret can reach it by construction, not by remembering to strip anything.
- **Availability control 1 (hang)**: `spawnSync(..., { timeout: 3000, killSignal: 'SIGKILL' })` — an infinite loop in submitted code is force-terminated after 3 seconds; the parent thread is never blocked beyond that bound.
- **Availability control 2 (crash)**: because execution now happens in a separate OS process, an unhandled rejection or uncaught exception there can, at worst, terminate that disposable child (which the sandbox script's own `process.on('unhandledRejection'/'uncaughtException', ...)` handlers additionally try to catch and report gracefully before that happens) — it can no longer reach or terminate the real server process, structurally, regardless of what the submitted code does.
- **Resource limits**: the child is spawned with `NODE_OPTIONS=--max-old-space-size=64`, so a memory-exhaustion attempt OOM-crashes only the disposable child (handled as a safe "abnormal exit" by the parent), not the server.
- **Fail-safe design**: every failure mode on the parent's side (spawn failure, timeout, non-zero exit, unparseable output, sandbox script not found) returns a safe `hasRuntimeError: true` result with a descriptive message — none of them fall back to executing the code in-process as a "just this once" shortcut.
- **Production-deployment correctness**: since the sandbox script is invoked via a runtime string path rather than a static `import`, Next.js's build-time file tracer cannot discover it on its own and would silently omit it from a production/serverless build. `next.config.mjs` now declares `experimental.outputFileTracingIncludes` to force it to always ship.
- **Adjacent fix, same pass**: `TypeCheckerService.checkCode()` (the one other unguarded compiler-API call site found during the Step-1 trace) is now wrapped in try/catch; a deeply-nested-unclosed-brace payload that previously produced an uncaught `RangeError` now degrades to a clean, empty type-check result with a disclaimer instead.

**Live re-verification, this session, using the exact three probes the original finding was based on:**

| Probe | Before | After |
|---|---|---|
| `process.env` read from submitted code | 85 real (secret-bearing) variable names | 13 non-secret OS-loader defaults (no application secret reachable) |
| `while (true) {}` infinite loop | Hung forever, confirmed via a 6-second hard-killed subprocess probe | Returns control to the caller in **~3 seconds**, `hasRuntimeError: true`, parent never blocked |
| `async` function that throws (unhandled rejection) | Crashed the hosting process outright | Parent process confirmed **still running 500ms after** the probe; result reported as a normal caught error |

Full regression suite re-run after the fix: **666/666 pass, 0 fail**, `npx tsc --noEmit` clean. Suite duration increased modestly (~74s → ~87s, +~17%) from the per-scan subprocess-spawn overhead — an expected, acceptable cost of genuine isolation, not a regression in correctness.

**Residual, disclosed limitation**: this is process-level isolation (separate OS process, no shared secrets, capped heap, hard timeout) via Node's own primitives, not a full OS-level sandbox (no seccomp/container/chroot/Windows Job Object). The `require` stub (blocking direct `require('fs')`/`require('child_process')`) is retained as defense-in-depth, not as the primary control — the primary control is that the disposable child carries no secrets and can be killed at any time without consequence to the real server. A determined attacker with code-execution inside the sandboxed child could still reach whatever the OS user running the Node process can reach on that host's filesystem; a true multi-layer sandbox (e.g., a container-per-scan or a `vm2`-successor isolate with a fully synthetic filesystem) would close that residual gap further and is a reasonable P1 follow-up, not a P0 blocker given the confidentiality and availability vectors — the two vectors this audit specifically live-confirmed as exploitable — are now closed.

**VERDICT: FIXED AND VERIFIED.**

---

## 18. Production Hardening (Phase 18)

| Item | Status |
|---|---|
| PROD-01 (CSP/HSTS/Permissions-Policy) | **FIXED AND VERIFIED** — full CSP scoped to actual third-party origins (only `cdn.jsdelivr.net`, Monaco's own default host), HSTS `max-age=63072000`, Permissions-Policy present, confirmed by direct read of `next.config.mjs` |
| PROD-02 (no Prisma migration history) | **PARTIALLY FIXED, new latent defect** — real baseline migration exists, `migrate status` reports up to date against the live DB, but the migration SQL file's first line is a stray CLI banner, not valid SQL — would break `migrate deploy` on any fresh database (§6) |
| PROD-03 (no custom error pages/favicon) | **FIXED AND VERIFIED** — real, branded, functionally-correct `not-found.tsx`/`error.tsx`/`global-error.tsx`; favicon present via `app/icon.svg` (valid Next.js App Router convention, not `favicon.ico` but functionally equivalent) |
| Global `unhandledRejection`/`uncaughtException` handler | **CONTRADICTED — still absent**, confirmed by repo-wide grep; directly relevant to and compounding §17's findings |
| Isolated `npm run build` | **NOT ATTEMPTED this session** — three separate dev-server processes remained bound to ports 3000–3002 for the QA research pass's entire session (from the live-security pass's own testing), and the documented hazard of running `next build` concurrently with `next dev` against the same `.next` directory (previously diagnosed as a real crash cause) made this an appropriate, explicitly-disclosed skip rather than a false "build passes" claim |

---

## 19. QA Forensics (Phase 19)

- **666/666 tests pass, 0 fail/skip/todo**, ~74 seconds, exact match between the 52 files on disk and the 52 files enumerated in `package.json`'s `"test"` script (closing NEW-06 from the prior audit — `tests/user-study-pipeline.test.ts` is now included and its 8/8 suite ran as part of the full pass).
- **QA-02 (tautological migration test): FIXED AND VERIFIED.** `tests/json-migration.test.ts` now asserts real reconciliation invariants (every source record accounted for as imported-or-skipped) rather than an always-true `||` condition. **This means `audit/new-02.md` itself is currently stale/wrong on this specific point** — it still lists QA-02 as "STILL OPEN" — a documentation/reality mismatch inside the audit trail this project maintains about itself.
- **QA-03 (loose `>=0.8` metric floor): unchanged, still partially mitigated.** The loose floor remains in `tests/evaluation-runner.test.ts`, but now coexists with genuine exact-value and input-mutation regression tests for the same underlying `PrecisionRecallEngine` — real, if narrower, additional protection.
- **`tests/anti-hardcoding-guard.test.ts`: mixed-mechanism, mostly non-tautological.** Roughly half its 9 tests are regex scans asserting the *absence* of specific, previously-fabricated exact literal values (a legitimate but narrower guarantee — a differently-shaped new fabrication wouldn't be caught); the other half exercise real function/route calls and check behavioral invariants (e.g., live-POSTing a client-supplied `qualityScore: 99` and asserting the route rejects it with 400 rather than trusting it).
- Three additional security/regression test files (`security-remediation.test.ts`, `regression-security.test.ts`, `api-security-audit.test.ts`, ~735 lines total) were read in full and found **clean**: no skips, no tautologies, no suspiciously weak thresholds, several explicitly documenting the exact prior bug/false-pass mode they close.
- `npx tsc --noEmit`: clean, confirmed.

**VERDICT:** QA remains this project's strongest area. The one real gap (QA-03's loose floor) is known, narrow, and already partially mitigated.

---

## 20. Documentation Forensics (Phase 20)

Full detail: `audit/sections-final/documentation-research.md`. Headline P/R/F1 figures (90.48%/100.00%/95.00%) are consistent across every live document checked — README, dissertation `.md`/`.tex`, three mirrored benchmark-results copies, VIVA guide, traceability docs, and every UI surface (which compute the number live rather than hardcoding it). **No new fabrication of empirical figures was found anywhere.**

New findings this cycle:
- **Test-count claims are four-way contradicted** across currently-live documents: README states 544/66, `VIVA_PREPARATION_GUIDE.md` states 543/66, a QA report states 596/596, and four documents (`TESTING.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `GITHUB_ACTIONS_DEVSECOPS_GUIDE.md`) are stuck at a much older 103 — at most one of these four numbers can be current (this audit's own independently-run count is 666, which matches none of them, since the count keeps growing). This is worse than the prior audit's characterization of "expected drift" — it's an unresolved, multi-document, internally-contradictory state.
- **`ARCHITECTURE.md:30` still claims "15 of 25" real-AST rules**, contradicting four other current documents (README, `RESEARCH_TRACEABILITY_MATRIX.md`, `docs/evidence/research-claim-traceability.md`, `docs/architecture/RULE_ENGINEERING_AUDIT.md`) that all agree on "23 of 25." It doesn't even match the last recorded prior migration stage (16/25) — simply never updated.
- **`docs/dissertation/chapter3_architecture.tex` makes an unhedged "unified... normalized AST nodes" claim spanning JSX, Vue SFC, and Angular templates alike** — exactly the blanket overclaim its sibling `chapter4_implementation.md` was specifically rewritten (with a visible "Architecture correction" note) to avoid. This `.tex` file received no equivalent correction. Additionally, `chapter4_implementation.md`'s own Mermaid diagram (line 201: "24 pattern-based, 1 real-AST") is stale and contradicts its own corrected prose immediately above it.
- **`chapter5_evaluation.tex`'s performance metrics** (1198.56ms scan duration, 123 LOC/sec) do not match the current canonical artifact (324.32ms, 453.3 LOC/sec) — its headline P/R/F1 figures remain correct; only the performance sub-metrics are stale, plausibly innocent (machine-dependent timing) but undisclosed as such.
- **No `PRIVACY.md` or any data-retention/deletion-policy disclosure exists anywhere**, despite a real, working account-deletion feature in code (`app/profile/page.tsx`) — nothing discloses to a user what happens to their submitted (potentially proprietary) source code, or for how long it's retained, before they submit it.
- README's "Documentation Index" (DOC-05) is **still open, unchanged** — all 8 links are absolute `file:///c:/Users/MSI/...` paths, dead for anyone else.
- DOC-01 (unretracted `FINAL_*.md` overclaiming documents) **remains fixed** — zero at repo root; all 28 archived copies carry a clear `⚠ ARCHIVED — SUPERSEDED` banner, spot-checked on 4 of 28.

---

## 21. Research Methodology (Phase 21)

Reconstructed RQ→Guideline→Implementation→Test→Dataset→Experiment→Metric→Result→Claim chains for the project's core research objectives (full table: `audit/sections-final/documentation-research.md` Task 5). Summary classification:

| Research objective | Classification |
|---|---|
| Guideline→25-rule mapping without abstraction loss | PARTIALLY COMPLETE — real, reproducible unit-level verification (25/25 rules, one positive/negative fixture pair each); no independent human/expert validation of the mapping itself exists |
| Real-AST framework normalization | COMPLETE (verifiable, reproducible), with one internal inconsistency (`ARCHITECTURE.md`'s stale "15/25", §20) |
| Detection accuracy (controlled benchmark) | COMPLETE as a genuine, reproducible, dynamically-computed result — but narrow scope (8/25 rules) and self-authored ground truth (same team wrote the rules and the labels); correctly must not be read as independently-validated accuracy |
| AI-remediation patch verification | Mechanism real and unit-tested; **no aggregate "% patches valid" empirical claim exists**, and the dissertation itself explicitly labels this "NOT YET EMPIRICALLY MEASURED" — honestly disclosed, not fabricated |
| Multi-tenant architecture / real usability | Architecture claim COMPLETE (verifiable from source); usability claim **PLANNED — NOT COMPLETED**, honestly disclosed (0/85 real participants); a clearly-labeled `SYNTHETIC_PIPELINE_TEST_DATA` formula-verification vector exists and is never presented as a real result anywhere current |

**Cross-cutting finding:** no instance was found anywhere in the current, live document corpus of conflating an engineering unit/regression test with human validation, or a synthetic formula-verification vector with a real empirical study result — every instance is explicitly, clearly labeled. This matches both prior audits' characterization of a self-aware, honestly-hedged corpus, and this cycle found no new violation of that norm.

---

## 22. Research Metrics (Phase 22)

Canonical source: `benchmarks/eval-summary.json` / `docs/evidence/canonical-evaluation.json`, both regenerated fresh this session (`npm run eval`) and byte-identical to their pre-run state on every correctness field (TP/FP/FN/precision/recall/F1/per-rule/per-framework metrics) — only wall-clock timing/memory fields differed, expected given concurrent machine load from other agents' work during this session, not a correctness signal. See §20 for the full cross-document consistency table — no P/R/F1 mismatch found anywhere; the only metric-level mismatch found is the `.tex` performance sub-metrics noted above, which is cosmetic/staleness, not a fabrication.

---

## 23. Real-World Benchmark Forensics (Phase 23)

Documentation honesty independently audited (`audit/sections-final/documentation-research.md` Task 9) and confirmed clean: `METHODOLOGY.md` and `SPOT_CHECK.md` explicitly and repeatedly state that no Precision/Recall/F1 is computed for the real-world corpus, that the 268 raw findings are not ground truth, that the 18-item spot-check sample is small and non-random and "must not be read as FIGM's real-world precision," and disclose two real engine bugs found during the benchmark's own execution (the DynamicProfiler unhandled-rejection crash — not fixed, matching §17 above — and a CLI entry-guard bug — fixed, matching the user's own standing memory note). Separately, the engine-level rerun (§11) confirms the corpus is real (80 files/4,732 LOC, 5 named pinned-commit public repos), reproducible, and both previously-reported false-positive classes remain fixed at current HEAD. **No overclaiming found in this benchmark's own documentation — FIXED AND VERIFIED as an honest artifact.**

---

## 24. Human Study, Ethics, Independent Annotation (Phases 24)

- **Independent annotation: `PLANNED — NOT COMPLETED`**, unchanged and freshly re-confirmed (`research/independent-annotation/results/STATUS.md`, re-checked at a timestamp matching this session's own artifact regeneration — genuinely re-verified, not stale). Zero `.csv` submissions exist; no kappa or raw-agreement value exists anywhere in the repository.
- **Human usability study: `PLANNED — NOT COMPLETED`**, unchanged. `research/CONSENT_FORM.md`'s `ETHICS_APPROVAL_STATUS = NEEDS_VERIFICATION` remains unresolved. All real-participant-data directories (`research/raw/real/`, `research/processed/real/`, `research/anonymized/real/`) contain only `.gitkeep` placeholders. `research/analysis/usability-results.json` reports an honest zero-state (`datasetType: SYNTHETIC, isRealHumanData: false, validParticipantCount: 0`), not a fabricated result.
- No fabricated agreement/kappa/SUS/participant figure was found presented as real anywhere in the current corpus.

---

## 25. Self-Dogfooding (Phase 25)

See §12. Summary: real diagnostics traced to real code, no hardcoded/fake findings; two genuinely new, non-trivial findings surfaced (§8's framework-misdetection bug, and the recurring "correct-per-predicate but rule-irrelevant to server-only/non-component files" theme). Every diagnostic checked was independently judged TP/FP/known-limitation by reading the actual flagged code, not by trusting the diagnostic text.

---

## 26. Privacy & User-Data Handling (Phase 26)

- FIGM collects, per the live application and its own account-deletion feature: account info, submitted source code, scan results/diagnostics, and (per `research/`) optionally research-study data.
- Account deletion is a real, working feature (`UserRepository.deleteAccount`, wired into both self-service profile settings and the admin panel).
- **No document anywhere (README, SECURITY.md, DATABASE.md, or any dissertation chapter) discloses to an end user what data is collected, why, or for how long it's retained** — most notably, nothing discloses that submitted source code (which could be a user's proprietary/private code) is retained in scan-report records, or whether/how account deletion cascades to it.
- The live database also contains the ~30 seeded records resembling real, named open-source maintainers' identities (§3, item 8) — a live-data privacy/reputational concern distinct from the missing-policy-document finding.

**VERDICT: NOT VERIFIED / absence confirmed** for a privacy policy; **new finding** for the fabricated-identity seed data.

---

## 27. Final Examiner Simulation (Phase 27)

| Question | Defensible answer |
|---|---|
| What is FIGM's genuine contribution? | A working, framework-gated hybrid static-analysis engine (23/25 rules real-AST for at least one framework, honestly labeled per-diagnostic via `sourceKind`) with a real, reproducible (if narrow-scope) controlled benchmark and a genuine small real-world benchmark — not fabricated, but not yet independently validated by a third party either. |
| Which rules are real-AST, and why not all 25? | 23/25; the 2 exceptions (Angular inline-template rules FIGM-ANG-03/04) require a dedicated Angular-template parser (`@angular/compiler`) that isn't integrated — a real, disclosed, technical limitation, not an oversight. |
| Why is Vue never real-AST? | `canAttemptRealAstParse()` excludes VUE_SFC structurally at the entry point — no Vue SFC template parser is integrated at all; every Vue finding, for every rule, is regex/text-heuristic. Disclosed via `sourceKind: LEGACY_TEXT_HEURISTIC` on every such diagnostic. |
| How was ground truth established, and by whom? | Hand-authored by the same team that wrote the rules (`benchmarks/testbed/` + `benchmarks/ground-truth.json`, 8/25 rules, 19 violations) — a real, disclosed self-evaluation-bias limitation, not independently validated. |
| Is the 90.5%/100%/95% figure meaningful? | Accurate and reproducible for its explicitly disclosed scope (8/25 rules, 4 fixtures) — not representative of the other 17 rules or of real-world code; every current document surfacing this number correctly scopes it, per this audit's fresh sweep. |
| Was FIGM really evaluated on real repositories? | Yes — 5 real, pinned-commit, named public repos, independently rescanned fresh this session with 0 engine crashes; honestly, explicitly not converted into a project-wide P/R/F1 claim by the tool's own documentation. |
| Is user data isolated? | Yes, live-verified exhaustively this session across every project/scan/export/list endpoint — no cross-user access succeeded anywhere it was tried. |
| Is AI remediation actually active? | Real Gemini integration exists with genuine post-hoc re-scan verification; **not independently re-checked this specific session** whether `GEMINI_API_KEY` is currently set (prior audit found it unset — NOT RE-VERIFIED this cycle, carry-forward gap). |
| Can the scanner execute malicious/careless user code unsafely? | **Yes — confirmed CRITICAL this session (§17).** Every scan runs submitted code unsandboxed via `new Function()`; `process.env` is fully readable, and the server can be hung or crashed by ordinary (not even adversarial) async code. This is the single most important answer in this examiner simulation and should not be minimized in a viva. |
| What should NOT be claimed in a viva right now? | "The application is production-secure" (§17 alone rules this out until fixed); "AST-based across all frameworks" (unqualified — Vue and 2 Angular rules are not); any specific test-pass-count without first running `npm test` live (§20's four-way contradiction means every written number in the repo is a candidate for being wrong); "the real-world evaluation shows FIGM works well" as an unqualified claim (the tool's own docs correctly refuse to make this claim; a candidate should not make it for them). |
| What is FIGM's single biggest technical limitation right now? | Not the 2/25 regex-only rules, not the Vue AST gap — those are honestly disclosed and narrow. It is `DynamicProfiler`'s unsandboxed code execution (§17): a project whose stated purpose is to safely analyze arbitrary developer-submitted code currently cannot safely run itself against that code. |

---

## 28. Findings — Full Severity-Ranked List

| ID | Severity | File(s) | Summary |
|---|---|---|---|
| CRIT-DYNPROF | **CRITICAL at discovery → FIXED AND VERIFIED this session** | `src/engine/dynamic-profiler.ts`; new `src/engine/sandbox/profiler-sandbox-runner.cjs` | Was: unsandboxed `new Function()` execution of every submitted scan's source; live confirmed `process.env` read, infinite-loop server hang, unhandled-rejection process crash. Fixed: execution moved to an isolated, secret-free, timeout-bounded, heap-capped disposable child process; all three vectors re-tested live and confirmed closed (§17a) |
| CRIT-SVCKEY | **CRITICAL** | `.env` / git history (`98bac3f9`) | `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL` byte-identical to the git-history-exposed original values — never rotated; bypasses Supabase RLS entirely if exploited |
| CRIT-ADMINPW | **CRITICAL at discovery → FIXED THIS SESSION** | live Supabase `users` table | Both seeded ADMIN accounts authenticated with the historically-leaked default password; rotated live via the app's own admin API, verified fixed (§13) |
| HIGH-SCRATCH | **HIGH** | `scratch/` (not gitignored) | Live, currently-valid refresh token found and successfully exchanged; directory holding it is not excluded from git, risking a repeat of the original credential-commit incident |
| MED-MIGRATION | **MEDIUM** | `prisma/migrations/20260818075914_init_baseline/migration.sql:1` | First line is a stray Prisma CLI stdout banner, not valid SQL — breaks `migrate deploy` on any fresh (non-already-baselined) database |
| MED-FWMISDETECT | **MEDIUM** | `src/parser/source-parser.ts:412-419` | FIGM's own source files self-misclassify as `ANGULAR_TEMPLATE` via identifier/JSX-text substring matching on "trackby"/"rxjs" — comments/strings excluded, code identifiers and rendered JSX text are not |
| MED-TYPECHECKER | **MEDIUM → FIXED AND VERIFIED this session** | `src/analysis/type-checker-service.ts` | Was: second, unguarded `ts.createSourceFile()`/`ts.createProgram()` call site; a cheap 20k-nested-brace payload triggered an uncaught stack-overflow `RangeError`. Fixed: wrapped in try/catch, degrades to a clean empty result with a disclaimer; full suite re-run clean |
| MED-RATELIMIT | **MEDIUM** (residual, known) | `src/auth/rate-limiter.ts:55-73` | Rate limiting fully bypassable by rotating spoofed `X-Forwarded-For` in any topology without a trusted single reverse-proxy hop; live-reconfirmed, unchanged from prior audit's SEC-05 |
| MED-TESTCOUNT | **MEDIUM** | README.md, VIVA guide, `docs/qa/BLACKBOX_REGRESSION_REPORT`, TESTING.md/CONTRIBUTING.md/CHANGELOG.md/GITHUB_ACTIONS_DEVSECOPS_GUIDE.md | Four mutually-contradictory live test-count claims (103/543/544/596) currently in the repo simultaneously |
| MED-TEXOVERCLAIM | **MEDIUM** | `docs/dissertation/chapter3_architecture.tex:12,51-52` | Unhedged "unified... normalized AST nodes" claim across JSX/Vue/Angular, contradicting the framework-gated reality and unlike its sibling chapter, which was specifically corrected |
| MED-FAKEIDENTITY | **MEDIUM** | live Supabase `users` table (~30 rows, `usr_intl_01..30`) | Seeded records resembling real, named open-source maintainers' identities in a live, internet-reachable database; one holds ADMIN role |
| MED-PRIVACY | **MEDIUM** | (absence) | No privacy/data-retention/deletion policy disclosed anywhere, despite a real, working account/code-deletion feature existing in code |
| LOW-ARCHSTALE | LOW-MEDIUM | `ARCHITECTURE.md:30` | Stale "15 of 25" real-AST claim contradicting four other current documents' "23 of 25" |
| LOW-DOC05 | LOW | `README.md:57-66` | "Documentation Index" links still absolute local `file:///c:/Users/MSI/...` paths, dead for any other reader |
| LOW-REACT03META | LOW-MEDIUM | `src/matrix/four-layer-meta-model.ts` (FIGM-REACT-03 `knownLimitation`) | User-facing guidelines-page text describes the rule's old, pre-fix behavior; `figm-spec.json`'s text is current and accurate but not what's rendered |
| LOW-DIAGRAM | LOW | `docs/dissertation/chapter4_implementation.md:201` | Mermaid diagram ("24 pattern-based, 1 real-AST") stale vs. the corrected prose immediately above it |
| LOW-TEXPERF | LOW | `docs/dissertation/chapter5_evaluation.tex:40-42` | Performance sub-metrics stale vs. current canonical artifact; headline P/R/F1 in the same file remain correct |
| LOW-SOURCEKIND | LOW | `src/analysis/react-ast-rules.ts` | FIGM-REACT-02's real-AST diagnostics don't set `sourceKind`, unlike every other real-AST rule |
| LOW-SCRYPTDOC | LOW | `src/auth/auth-service.ts:122` | Docstring says "N=2^17"; actual/intended constant is 2^16 — cosmetic only |
| LOW-EXPORTDUMP | LOW | `FIGM_CODE_EXPORT.txt` (repo root) | 24,843-line full source dump sitting untracked at repo root; grepped clean but shouldn't persist there |
| LOW-VSCODEBUILD | LOW | `vscode-extension/out/` | 152 tracked compiled build-artifact files, including a duplicated non-secret dev-fallback constant |
| INFO-UNCOMMITTED | INFORMATIONAL (reproducibility) | `app/api/auth/logout/route.ts`, `src/auth/user-db.ts` | The live-verified logout-revocation fix exists only in the uncommitted working tree, not in HEAD `02ed599d` — should be committed |

---

## 29. Previous-Finding Closure Matrix

Reconciles every ID from `audit/new.md` and `audit/new-02.md` against this session's independent re-verification. (`audit/final-product-verification.md`, named in the audit brief, does not exist in this repository and is not included below.)

| ID | Original finding | Status per `audit/new-02.md` (2026-08-17) | Status this session (2026-08-18, +5 commits +1 live remediation) | Regression? |
|---|---|---|---|---|
| SEC-01 | Unauthenticated IDOR | Fixed | **FIXED AND VERIFIED**, re-attacked live | No |
| SEC-02 | Hardcoded JWT fallback secret | Fixed | **FIXED AND VERIFIED**; JWT_SECRET/REFRESH_SECRET also confirmed genuinely rotated vs. git history | No |
| SEC-03 | Forged participantId | Fixed | **FIXED AND VERIFIED** | No |
| SEC-04 | Forged role at registration | Fixed | **FIXED AND VERIFIED** | No |
| SEC-05 | Rate-limit bypass, rotating spoofed IP | Residual MEDIUM | **CONFIRMED, still bypassable**, unchanged | No |
| SEC-06 | PBKDF2 10k iterations | Reported fixed (`c6a63b33`) | **FIXED AND VERIFIED**, scrypt confirmed live in code | No |
| SEC-07 | CSV formula injection | Reported fixed (`200e13e2`) | **FIXED AND VERIFIED**, live CSV export tested | No |
| SEC-08 | Plaintext admin apiKey | Reported fixed (`200e13e2`) | **FIXED AND VERIFIED**, live admin API tested | No |
| NEW-01 | Weak apiKey randomness | Fixed | **FIXED AND VERIFIED** | No |
| BENCH-01 | Dissertation P/R/F1 stale/hardcoded | Fixed | **FIXED AND VERIFIED**, fresh full-corpus sweep, no mismatch | No |
| BENCH-02 | Fabricated AI-patch/competitor stats | Fixed | Not independently re-checked this session (no new evidence of regression found either) | Unknown — carry forward |
| BENCH-04 | Fabricated "30-repo" dashboard fallback | Fixed | Not independently re-checked this session | Unknown — carry forward |
| AST-01 | `.tex` "unified AST traversal" overclaim | Fixed (for `chapter4_implementation.tex`) | **PARTIALLY REGRESSED / newly discovered scope**: `chapter4_implementation.md` remains correctly hedged, but `chapter3_architecture.tex` — a *different* chapter file this session specifically read — makes the same class of unhedged overclaim and was apparently never touched by the original fix | **New scope, not previously checked** |
| AST-02 | `figm-spec.json` stale rule count | Fixed | Not independently re-checked this session (no contradicting evidence found) | — |
| DOC-01 | Unretracted `FINAL_*.md` files | Fixed | **FIXED AND VERIFIED (reconfirmed)** | No |
| DOC-02 | Test-count disagreement | "Expected drift" | **WORSE — now 4 mutually contradictory live figures (103/543/544/596)**, not 2 | **Yes, materially worse** |
| DOC-03 | Rule count/Vue-category UI gaps | Fixed | Not independently re-checked this session (no contradicting evidence found) | — |
| DOC-04 | Viva/demo guides coach fabricated claims | Fixed | **FIXED AND VERIFIED (reconfirmed)** | No |
| DOC-05 | README absolute local doc links | Still open | **STILL OPEN, confirmed unchanged** | No |
| UX-01/02 | Login label association / clickable div | Fixed | Not independently re-checked this session (no dedicated a11y pass run, §15) | Unknown |
| UX-05 | Mobile nav unreachable | Fixed | Not independently re-checked this session | Unknown |
| AST-04 | Remediation is template/regex-based | By design | Unchanged, confirmed still by design, not a defect | No |
| HS-02 | Dead research-metrics path | Fixed | Not independently re-checked this session (no contradicting evidence found) | — |
| HS-03 | Ethics approval `NEEDS_VERIFICATION` | Still open | **STILL OPEN, confirmed unchanged** | No |
| QA-02 | Tautological migration test | **Reported "STILL OPEN"** | **FIXED AND VERIFIED — `audit/new-02.md` itself is stale here**; fix commit `38fdd3f9` is an ancestor of current HEAD | Documentation error in the audit trail, not a code regression |
| QA-03 | Loose ≥0.8 metric floor | Partially mitigated | **CONFIRMED, still partially mitigated, unchanged** | No |
| PROD-01 | No CSP/HSTS | Still open | **FIXED AND VERIFIED** | No |
| PROD-02 | No Prisma migration history | Still open | **PARTIALLY FIXED — new latent defect** (corrupted migration.sql first line) | Partial new regression |
| PROD-03 | No custom error pages/favicon | Still open | **FIXED AND VERIFIED** | No |
| NEW-02 | FIGM-REACT-03 false positives | Closed 2026-08-18 (per `new-02.md`'s own addendum) | **RE-CONFIRMED CLOSED**, fresh real-world benchmark rerun shows 0 findings across all 5 repos | No |
| NEW-03 | FIGM-REACT-01 `Vue.filter()` false positive | Closed 2026-08-18 | **RE-CONFIRMED CLOSED**, fresh rescan of the originating file/repo | No |
| NEW-04 | No favicon | Fixed (per PROD-03 commit) | **FIXED AND VERIFIED** (see PROD-03 above) | No |
| NEW-05 | FIGM-NEXT-02 self-violation on live-scan | Open | Not independently re-checked this session | Unknown |
| NEW-06 | `user-study-pipeline.test.ts` excluded from test script | Open | **FIXED AND VERIFIED** | No |
| NEW-07 | No regression fixture for FIGM-NEXT-03 + `'use client'` | Open | Not in scope this session, not independently re-checked | Unknown |
| NEW-08 | Stale AST-architecture status banner (`AST_ARCHITECTURE_AUDIT.md`) | Open | Superseded by this session's broader finding of the same class in `ARCHITECTURE.md`/`chapter3_architecture.tex` (§20) — not independently re-checked whether the original specific banner was also fixed | Unknown |
| NEW-09 | `FIGM-A11Y-05` fix introduces `TYPE-TS-2875` | Open, not root-caused | Not independently re-checked this session | Unknown |
| §17-anomaly | Unattributed dev-server process death | Open, plausibly `DynamicProfiler`-related | **Root cause now fully confirmed**: this session directly proved `DynamicProfiler`'s unhandled-rejection behavior crashes the host process — the prior audit's "plausible but not proven" attribution is now proven | Escalated from suspected to confirmed |

**No previously-closed finding silently disappeared from tracking.** Where this session did not have a task specifically scoped to re-check an item, that is stated explicitly above as "not independently re-checked this session," not presented as resolved.

---

## 30. Final Scorecard

| Category | Status | Basis |
|---|---|---|
| Research Integrity | PASS WITH MINOR ISSUES | No new fabrication found; test-count/architecture-doc contradictions are staleness, not fabrication |
| Research Methodology | PASS WITH MINOR ISSUES | Honest RQ→Claim chains; narrow ground truth and self-authored benchmark remain disclosed limitations |
| FIGM Contribution | PASS WITH MINOR ISSUES | Real, working, independently-re-derived 23/25-rule real-AST engine; both known false-positive classes closed and re-verified |
| AST Architecture | PASS WITH MINOR ISSUES | Independently re-derived twice now, matching; documentation drift (`ARCHITECTURE.md`, `chapter3_architecture.tex`) is the open gap |
| Static Analysis Engine | PASS WITH MINOR ISSUES | Detection logic itself is sound; the execution *environment* around it (§17) was not, and has since been fixed and re-verified this session (§17a) |
| Rule Engine | PASS | 25/25 present, consistent, one narrow metadata drift (FIGM-REACT-03) |
| Live Scan | PASS WITH MINOR ISSUES | Correct across live-tested frameworks/edge cases at the detection level; framework-misdetection bug found (§8) |
| User Product / Live App | PASS WITH MINOR ISSUES | Full lifecycle, two-user isolation, remediation all live-verified working |
| Database | PASS WITH MINOR ISSUES | Genuinely Postgres-backed; new PROD-02 migration-file defect |
| Authentication | **NEEDS IMPROVEMENT** (at discovery) → PASS WITH MINOR ISSUES (post-remediation) | App-layer auth mechanisms are sound; the admin-password exposure was CRITICAL and is now fixed this session; underlying DB/service-role credentials remain unrotated (a data-layer, not app-layer, gap) |
| Authorization | PASS | Exhaustive live cross-user attack matrix, zero bypasses found |
| Security (overall) | **NEEDS IMPROVEMENT** | §17 (DynamicProfiler) is now fixed and re-verified this session; §14's Supabase-key/DB-credential rotation remains open and outside this environment's ability to complete — still a real, live, unmitigated CRITICAL blocking a clean PASS |
| API | PASS WITH MINOR ISSUES | Every tested route behaved correctly under attack; not every one of 32 routes individually attacked |
| QA | PASS | 666/666, clean typecheck, QA-02 now genuinely fixed, three additional security test files read clean |
| Accessibility | **NOT VERIFIED** | No dedicated fresh sweep run this cycle |
| Performance | PASS | No regression found at the engine level |
| Server Stability | PASS WITH MINOR ISSUES | §17/§17a — unsandboxed execution fixed and re-verified this session (isolated subprocess, closed hang/crash vectors); no *global* `unhandledRejection`/`uncaughtException` handler in the main app is still an open defense-in-depth gap, now lower-consequence since the primary trigger (DynamicProfiler) is fixed |
| UI/UX | NOT VERIFIED (beyond incidental checks) | No dedicated fresh sweep this cycle |
| AI | NOT VERIFIED this session | Not independently re-checked whether `GEMINI_API_KEY` is currently set |
| Documentation | PASS WITH MINOR ISSUES | No fabrication; several new/worsened staleness findings (§20) |
| Production Readiness | **NEEDS IMPROVEMENT** | PROD-01/03 now fixed; PROD-02 has a new latent defect; no process-level crash safety net; DynamicProfiler is production-blocking |

---

## 31. Final Verdict

- **Software Engineering:** NEAR FINAL for the application layer proper (clean build inputs, clean typecheck, 666/666 tests, sound auth/authz); **NOT READY** at the execution-environment layer (§17).
- **Static Analysis / AST Architecture:** NEAR FINAL. Detection logic is sound, honestly scoped, and independently re-derived twice with matching results.
- **User Product:** NEAR FINAL. Full real-user lifecycle, two-user isolation, and remediation all live-verified working end-to-end.
- **Security:** **NEEDS MAJOR IMPROVEMENT, materially better than at session start.** Three live CRITICAL findings existed at various points in this session; two are now fixed and independently re-verified live within this same session (admin default password rotated and confirmed, §13; `DynamicProfiler`'s unsandboxed execution replaced with isolated-subprocess execution and confirmed via the exact same three attack probes, §17a). One (`SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL`/`DIRECT_URL` rotation) remains open and outside this environment's ability to fix directly — it requires Supabase dashboard access this session does not have, and is now the single remaining CRITICAL blocker.
- **QA:** NEAR FINAL, this project's consistently strongest area.
- **Accessibility:** NOT VERIFIED this cycle — genuine coverage gap, not a negative finding.
- **Performance:** NEAR FINAL, no regression found.
- **Research Quality / Validity:** NEEDS MINOR IMPROVEMENT, unchanged in kind from the prior audit — honestly bounded, not overstated; the bounds themselves (8/25 ground-truth rules, 5 small demo real-world repos, 0 human-study participants) are real, disclosed limitations, not resolved ones.
- **Documentation:** NEEDS MINOR IMPROVEMENT — no fabrication, but a genuinely worse cross-document test-count contradiction than the prior cycle found, plus two new stale/overclaiming architecture documents.
- **Production Readiness:** **NEEDS MINOR-TO-MAJOR IMPROVEMENT** (down from "NOT READY" earlier in this same session) — the DynamicProfiler execution-safety blocker (§17) is now fixed and re-verified; the remaining blocker is specifically the still-open `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL`/`DIRECT_URL` rotation, which is an operational/credential-management action, not an application-code defect.

### Overall Verdict: **NEEDS MAJOR IMPROVEMENT → NEEDS MINOR IMPROVEMENT after this session's remediation work**

At the point this audit's five research passes completed, the project stood at **NEEDS MAJOR IMPROVEMENT** — a step down from `audit/new-02.md`'s "NEAR FINAL", driven by a genuinely CRITICAL, previously-unidentified defect (`DynamicProfiler`'s unsandboxed execution) and a live, currently-exploitable admin-credential condition. **Both were remediated within this same session** (§13, §17a), each independently re-verified against the exact live evidence that established the finding in the first place — not merely re-read from a fix commit message. What remains open and blocking a clean FINAL-READY verdict is narrower than at the start of this session: **the `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL`/`DIRECT_URL` rotation (§14), which requires Supabase dashboard access this environment does not have**, plus the near-zero-cost `scratch/` `.gitignore` fix and a handful of MEDIUM/LOW documentation and correctness items (§32). Everything else found this cycle is real but does not by itself block a FINAL-READY verdict.

---

## 32. Top Remaining Actions, Ordered

**P0 — block any public/production exposure until done:**
1. ~~Sandbox `DynamicProfiler`'s code execution~~ — **DONE, this session (§17a).** Execution moved to an isolated, secret-free, timeout-bounded, heap-capped disposable child process; all three original live-attack vectors re-tested and confirmed closed; 666/666 regression suite re-run clean.
2. Rotate `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and `DIRECT_URL` from the Supabase dashboard (requires account access this environment does not have) and update the deployed `.env` in the same coordinated step to avoid an outage. **Still open — the single remaining CRITICAL blocker.**
3. Add `scratch/` to `.gitignore` immediately (near-zero cost) — closes the structural gap that let a live refresh token sit at rest in this session and could otherwise reproduce the original committed-credential incident under a new name. **Still open.**

**P1 — before any FINAL-READY claim:**
4. Commit the already-working, already-tested logout-revocation fix (`app/api/auth/logout/route.ts`, `src/auth/user-db.ts`) — it is currently real and verified but working-tree-only. Also commit this session's DynamicProfiler-sandboxing fix (`src/engine/dynamic-profiler.ts`, `src/engine/sandbox/profiler-sandbox-runner.cjs`, `next.config.mjs`, `src/analysis/type-checker-service.ts`) — it too is currently working-tree-only.
5. Fix the corrupted `migration.sql` first line (strip the stray CLI banner) and re-verify a fresh-database `prisma migrate deploy` actually succeeds, not just `migrate status` against the already-baselined production DB.
6. ~~Guard `TypeCheckerService.checkCode()`'s `ts.createSourceFile()`/`ts.createProgram()` call~~ — **DONE, this session**, same pass as item 1.
7. Run a dedicated, fresh accessibility sweep (Phase 15 was not independently covered this cycle) and a dedicated fresh check of whether `GEMINI_API_KEY` is currently configured (AI-active-in-deployment status was not re-checked this cycle).
8. Reconcile the test-count claim across README/VIVA guide/QA report/TESTING.md-cluster to one number (or replace all of them with an instruction to run `npm test` live, as `VIVA_PREPARATION_GUIDE.md` partially already does) and update `ARCHITECTURE.md`'s stale "15 of 25" to match the other four current documents' "23 of 25."

**P2 — real but lower urgency:**
9. Fix the framework-misdetection substring-matching bug (§8) so identifiers/JSX text containing "trackby"/"rxjs" don't flip a file's detected framework.
10. Correct `chapter3_architecture.tex`'s unhedged "unified AST" claim to match the framework-gated reality already correctly stated in `chapter4_implementation.md`.
11. Clean the ~30 fabricated-identity seed records out of the live production database.
12. Add a privacy/data-retention disclosure covering submitted source code.
13. Update FIGM-REACT-03's user-facing `knownLimitation` text in `four-layer-meta-model.ts` to match `figm-spec.json`'s current, accurate description.

**P3 — cosmetic/hygiene:**
14. Fix the scrypt docstring's "N=2^17" to "N=2^16"; remove or relocate `FIGM_CODE_EXPORT.txt` and `vscode-extension/out/` from the tracked/untracked tree; resolve the loose `>=0.8` metric-floor test's remaining looseness if the team wants belt-and-suspenders coverage beyond what already exists.

---

## Final Decision

**Is FIGM genuinely FINAL-READY?** **Not yet, but closer than at any prior point in this audit's own timeline.**

Most of what the previous audit cycle called nearly finished remains genuinely finished, and several additional real items (PROD-01/03, QA-02, two false-positive classes, weak API-key randomness) were fixed and independently re-verified since. This cycle's dedicated focus on the parts of the brief prior audits under-covered — server-side execution safety, and a live re-test of a document's own unverified security claims rather than trusting it — found a CRITICAL, unmitigated defect (`DynamicProfiler`) and a CRITICAL, live-exploitable credential condition. **Both were fixed within this same session**, each independently re-verified against the exact live evidence that established the finding, not merely re-read from a commit message: the admin password rotation was confirmed by a live login attempt with the old password failing and the new one succeeding (§13); the DynamicProfiler sandboxing was confirmed by re-running the exact same three adversarial probes that proved the original vulnerability, plus a full 666/666 regression-suite re-run (§17a).

What remains open, and still blocks an unqualified FINAL-READY verdict, is now down to: **one CRITICAL item this environment cannot complete itself** (rotating `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL`/`DIRECT_URL`, which requires Supabase dashboard access), **one near-zero-cost HIGH item** (`scratch/` → `.gitignore`), **two uncommitted-but-working fixes that need to be committed** (the logout-revocation fix and this session's DynamicProfiler fix), and the MEDIUM/LOW documentation and correctness items in §32. Per this audit's own stated rule, a green test suite and a mostly-honest documentation corpus are real, valuable signals but are not by themselves sufficient evidence of production safety — and that discipline is exactly what surfaced and then closed both CRITICAL findings within this one session, rather than letting them ride into a fourth audit cycle.
