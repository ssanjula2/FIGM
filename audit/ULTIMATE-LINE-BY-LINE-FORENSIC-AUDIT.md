# FIGM Code Inspector — Ultimate Line-by-Line Forensic Audit

**Audit type:** Pure forensic audit. No source, test, config, `.env`, database, or documentation file was modified during this audit except the creation of this one report. No credentials were rotated, no users created/deleted, no commits made, no deployment triggered, no destructive commands run.

**Method:** Eight independent read-only evidence-gathering passes (each scoped to a disjoint slice of the 31-phase audit brief), followed by manual cross-reconciliation and synthesis by the coordinating session. Every claim below is either (a) a direct file:line citation independently re-derived from current source, (b) a claim from a prior in-repo audit document explicitly marked as such and not re-verified, or (c) explicitly tagged `NOT VERIFIED` / `UNSUPPORTED EMPIRICAL CLAIM` / `PLANNED — NOT COMPLETED` where evidence does not exist or could not be gathered under audit-only (no state-changing action) constraints.

**Prior "FIXED"/"VERIFIED" labels in this repository's own audit lineage (`audit/new.md`, `audit/new-02.md`, `audit/ULTIMATE_FINAL_FORENSIC_AUDIT.md`, `audit/ULTIMATE-FINAL-ZERO-TRUST-AUDIT.md`, `audit/FINAL-READY-VERIFICATION.md`, `audit/FINAL-RELEASE-GATE.md`, `audit/sections-final/*`) were treated as claims to re-verify, not as evidence**, per this audit's own governing instructions. Where re-derivation was possible from static source, it was done independently. Where it required live execution, a live network call, or reading a secret value, it is explicitly marked `NOT VERIFIED — STATE-CHANGING/EXECUTION TEST NOT PERMITTED IN THIS AUDIT`.

---

## 1. Audit Metadata

| Field | Value |
|---|---|
| Audit date | 2026-08-21 |
| Repository | `C:\Users\MSI\.gemini\antigravity-ide\scratch\figm-model` (local clone), remote `https://github.com/ssanjula2/FIGM.git` |
| Branch | `main` |
| HEAD | `85d461a49d9ed4a984dd0c2421ee9ddd91421d50`, committed 2026-08-19 15:12:50 +0530 |
| Working tree | Clean at audit start and end (no files modified) |
| Total commits | 173 (`git rev-list --all --count`) |
| Method | 8 parallel read-only forensic passes + manual synthesis; zero code execution, zero live HTTP calls, zero secret values read or printed |
| GitHub repo public/private status | **NOT VERIFIED** — no network call made (out of scope for a local, read-only audit) |

---

## 2. Repository State

- Working tree clean; `git status --porcelain` empty at audit start.
- `.gitignore` ignores `node_modules`, `.next`, `dist`, `build`, `coverage`, `*.log`, `.env`/`.env*`, `figm-ci-report.json/.md`, `figm-scan-report.json/.html`, `research/raw/real/*` (with a `!README.md` exception), `.vercel`, `figm-user-db.json` (comment cites `audit/new.md` CRITICAL SEC-01), `scratch/` (comment cites `audit/ULTIMATE_FINAL_FORENSIC_AUDIT.md` HIGH-SCRATCH), `benchmarks/real-world/.repo-clones/`, `vscode-extension/out/`.
- `.env`/`.env.local` currently **NOT tracked** (confirmed via `git ls-files`).
- `figm-user-db.json` currently **NOT tracked** (correctly gitignored; a 3.97MB untracked local copy exists on disk).
- **4 files under gitignored `scratch/` remain tracked** (`scratch/exhaustive-zero-trust-audit.ts`, `scratch/test-dynamic-metrics.ts`, `scratch/verify-api-endpoints.ts`, `scratch/verify-real-db-crud.ts`) — added before the ignore rule existed; `.gitignore` does not retroactively untrack. **DOCUMENTATION / IMPLEMENTATION MISMATCH** (LOW): the `.gitignore` comment implies full exclusion. Content of these 4 files was not inspected this session.
- `figm-spec.json` (a *generated* artifact, produced by `npm run generate-spec` from `src/matrix/export-spec.ts`) **is tracked in git** — can silently drift from source truth if not regenerated before commit. LOW/INFORMATIONAL.
- Benchmark JSON/CSV outputs (`benchmarks/eval-summary.json`, `benchmarks/ground-truth.json`, `benchmarks/benchmark-results.csv/.md`, `benchmarks/real-world/raw-results/*.json`) are tracked — appears intentional (committed as canonical evidence artifacts).

---

## 3. Architecture Map

| Area | Files/dirs | Evidence status |
|---|---|---|
| FRONTEND | `app/**` (~30 page areas: accessibility, admin, ai-fix, analytics, auth, diagnostics, guidelines, history, live-scan, login, notifications, performance, profile, profiler, projects, references, reports, security, settings, user-study; `AppShell.tsx`, `HeaderBar.tsx`, `Sidebar.tsx`) | Deep-read for ~7 pages + full flow trace; ~14 pages grep-only (§15 lists which) |
| API | `app/api/**/route.ts` — 30 route files | All 30 read in full (§5) |
| AUTH | `src/auth/` (12 files) | Read in full |
| DATABASE | `prisma/schema.prisma`, 1 migration, `src/storage/` (12 files), `src/db/` (2 files) | Read in full |
| STATIC ANALYSIS / PARSER / AST / RULE ENGINE | `src/parser/` (6), `src/ast/`, `src/analysis/` (3), `src/engine/` (28), `src/matrix/` (7) | Core files read in full |
| REMEDIATION | `src/engine/remediation-engine.ts` (856 lines) + patch-validator | Read in full |
| AI | `src/ai/` (10 files) | Read in full |
| RESEARCH | `research/**`, `RESEARCH_TRACEABILITY_MATRIX.md` | Read; raw data directories inspected for real content |
| BENCHMARK | `benchmarks/` (testbed, real-world, adversarial-real-world) | Read; recomputed P/R/F1 from raw counts |
| TESTING | `tests/` — 54 `.test.ts` files (matches `package.json` test script exactly) | Inventory + spot-read of ~10 files |
| DEPLOYMENT | `next.config.mjs`, `vercel.json`, `middleware.ts`, `.github/workflows/figm-scan.yml` | Read (workflow file not deep-read) |
| DOCUMENTATION | ~20 root `.md` files + `docs/**` + `audit/**` | Grepped for contradictions, cross-referenced |
| `src/` subsystem file counts | ai=10, analysis=3, auth=12, cli=6, db=2, docs=3, engine=28, eval=14, hooks=13, lib=1, matrix=7, parser=6, pipeline=2, reporter=2, storage=12, types=4 | Raw inventory |

---

## 4. Full Source Audit (High-Risk Functions)

| File:Line | Function | Purpose | Auth | DB Access | Security Risk | Status |
|---|---|---|---|---|---|---|
| `src/auth/auth-service.ts:18-77` | `resolveSecret()` | Resolves `JWT_SECRET`/`REFRESH_SECRET`, fails closed outside dev/test if unset/weak/placeholder | N/A | N/A | Prevents predictable-secret startup | **FIXED AND VERIFIED** (source-level) |
| `src/auth/auth-service.ts:100-166` | `verifyPassword`/`needsRehash` | scrypt + legacy PBKDF2 verification, transparent rehash | N/A | N/A | Constant-time compare (`timingSafeEqual`) | **FIXED AND VERIFIED** |
| `src/auth/auth-service.ts:171-330` | `signJWT`/`verifyJWT`/`verifyRefreshToken`/`validateRole` | Hand-rolled HMAC-SHA256 JWT, role-claim allow-listed on sign+verify | N/A | N/A | Forged/out-of-range role claims clamped to DEVELOPER | **FIXED AND VERIFIED** |
| `src/auth/user-db.ts:153-178` | `resolveBootstrapAdminPassword` | Admin bootstrap password resolution | N/A | Local JSON | No hardcoded password; dev/test only generates ephemeral random password | **FIXED AND VERIFIED** |
| `src/auth/user-db.ts:310-328,345-360,458-485` | `createUser`/`updateUser`/`createScanRecord` | JSON-store CRUD | N/A | JSON file + fire-and-forget raw Supabase mirror | Redundant, silently-failing dual-write path | **MEDIUM finding**, see §28 F-08 |
| `app/api/auth/logout/route.ts:13-22` | logout handler | Sets `refreshToken: null` (not `undefined`) | Required | Postgres/JSON | Correctly revokes refresh token | **FIXED AND VERIFIED** |
| `app/api/auth/reset-password/route.ts:46-50` | reset handler | Sets `resetToken: undefined` | Token-based | Postgres/JSON | Same Prisma no-op bug class as logout, **not fixed here** | **MEDIUM finding**, see §28 F-07 |
| `app/api/auth/register/route.ts:47-52` | register handler | Clamps client role to DEVELOPER/AUDITOR | N/A | Postgres/JSON | No path to self-registered ADMIN | **FIXED AND VERIFIED** |
| `src/engine/dynamic-profiler.ts:144-330` | `profileExecution`/`runInSandboxProcess` | Executes user-submitted code for dynamic profiling | N/A (internal) | None | See full §9 execution audit | **PARTIAL ISOLATION** |
| `src/engine/sandbox/profiler-sandbox-runner.cjs:50-121` | sandbox child entry | Runs untrusted code via `new Function` inside a disposable child process | N/A | None | `require` stub bypassable; no network restriction | See §9 |
| `src/engine/remediation-engine.ts:787-853` | `validatePatch` | Re-scans patched code, rejects new syntax/type/guideline errors | N/A | None | Prevents false "FIXED" reports | **FIXED AND VERIFIED** |
| `app/api/submissions/route.ts:3,14,41` | submissions handler | Bypasses `RepositoryFactory`, calls `UserDB` directly | Required | JSON file only, **no Prisma model** | Data never reaches Postgres regardless of config | **MEDIUM-HIGH finding**, see §28 F-04 |

---

## 5. Auth / API Audit — Full Route Matrix

Ownership legend: **Own** = compares `resource.userId === auth.user.userId` (or ADMIN bypass) before mutating a specific resource. **Scoped** = list endpoint filtered server-side by `userId`. **N/A** = no per-resource ownership concept.

| Route | Method | Auth | Role gate | Ownership | Input validation | Risk |
|---|---|---|---|---|---|---|
| `/api/auth/register` | POST | N/A | Role clamped to DEVELOPER/AUDITOR | N/A | email/password/name validated, rate-limited 10/min | Low |
| `/api/auth/login` | POST | N/A | — | N/A | rate-limited 10/min | Low |
| `/api/auth/logout` | POST | Optional | — | Self (token) | — | Low |
| `/api/auth/refresh` | POST | Refresh-token bound | — | Token-bound to stored value | rate-limited 20/min | Low |
| `/api/auth/me` | GET | Required | — | Self only | — | Low |
| `/api/auth/forgot-password` | POST | N/A | — | Masks user existence | rate-limited 5/min; reset token echoed to caller only when `NODE_ENV!=='production'` | Low |
| `/api/auth/reset-password` | POST | Token-based | — | Token-bound | password strength; **resetToken clearing bug (§28 F-07)** | Medium |
| `/api/auth/audit-logs` | GET | Required | ADMIN/AUDITOR | N/A | — | Low |
| `/api/admin/system` | GET | Required | **ADMIN only** | N/A | — | Low |
| `/api/admin/users` | GET/PATCH/DELETE | Required | **ADMIN only** | N/A | apiKey masked on GET | Low |
| `/api/projects` | GET/POST | Required | — | Scoped | name length ≥2 | Low |
| `/api/projects/[id]` | GET/PATCH/DELETE | Required | — | Own (explicit 403) | PATCH allow-lists fields | Low |
| `/api/projects/[id]/duplicate` | POST | Required | — | Own (explicit 403) | — | Low |
| `/api/scan` | POST | **Optional** (anonymous guest allowed by design) | — | Persists under real userId or `usr_anonymous_guest` | 500KB cap; rate-limited 60/min (15/min ai-fix) | Low (intentional public preview) |
| `/api/scans` | GET/POST | Required | — | Scoped/Own; server derives score, rejects client-forged trust fields | full param validation, 500KB cap, rate-limited 60/min | Low |
| `/api/scans/[id]` | GET/PATCH/DELETE | Required | — | Own (explicit 403) | — | Low |
| `/api/dashboard/activity` | GET | None (public by design) | — | N/A | emails masked | Low |
| `/api/dashboard/frameworks` | GET | None (public by design) | — | N/A | — | Low |
| `/api/dashboard/reports` | GET | Required | — | Scoped | — | Low |
| `/api/dashboard/statistics` | GET | None (public by design) | — | N/A; unknown scores honestly `null` | — | Low |
| `/api/dashboard/summary` | GET | Optional, public by design | — | N/A | — | Low |
| `/api/export` | POST | Required | — | Own (explicit 403) | scanId/format required | Low |
| `/api/export-dissertation` | GET | Required | — | N/A | **No rate limit despite acknowledged disk-write concern** | Low-Medium (§28 F-10) |
| `/api/health` | GET | None | — | N/A | — | Low (standard health info) |
| `/api/notifications` | GET/PATCH/DELETE | Required | — | Scoped/Own (markAsRead explicitly ownership-checked) | — | Low |
| `/api/profile` | GET/PATCH/DELETE | Required | — | Self only | password change re-verifies current password | Low |
| `/api/report` | GET | None | — | N/A | — | Low/Informational — undocumented why public, looks legacy/demo |
| `/api/research-metrics` | GET | None (public by design) | — | N/A | — | Low |
| `/api/search` | GET | Optional | — | Scoped; users-search ADMIN-only | — | Low |
| `/api/settings` | GET/PATCH | Required | — | Self only | PATCH allow-lists fields | Low |
| `/api/submissions` | GET/POST | Required | — | Self only, **bypasses storage abstraction** | — | Medium (§28 F-04) |
| `/api/user-study/log-scan` | GET/POST | None | — | N/A (synthetic participant IDs) | format-validated, server re-runs real analysis, rate-limited 30/min | Low (by design) |

**No route was found with a missing-auth or missing-ownership defect at the "authenticated attacker reads/writes another user's private data" level**, across all 30 routes independently reviewed.

---

## 6. Database Audit

`prisma/schema.prisma` (269 lines), PostgreSQL via Supabase, **one migration only** (`20260818075914_init_baseline` — from-scratch baseline, no drift history to audit).

| Model | Ownership FK | onDelete |
|---|---|---|
| `Project` | `userId→User` | Cascade |
| `ScanReport` | `userId→User`, `projectId→Project` | Cascade / SetNull |
| `Notification` | `userId→User` | Cascade |
| `AuditLog` | `userId→User` (nullable) | **SetNull** (audit trail survives deletion, anonymized) |
| `Settings`, `ApiKey`, `SavedReport`, `AiHistory`, `ExportHistory` | `userId→User` | Cascade |
| `ResearchEvaluation` | `userId→User` (nullable) | SetNull |
| `FrameworkBenchmark` | none | — |

**No `Submission` Prisma model exists at all** — architecturally significant (see §28 F-04).

**Multi-tenant isolation: architecturally guaranteed** for everything that goes through `RepositoryFactory` — every list/query takes an explicit `userId`, both storage backends filter by it, and single-resource routes additionally re-check ownership. One IDOR was previously found and fixed in `NotificationRepository.markAsRead` (`src/engine/notification-repository.ts:29-42`) — confirmed unconditional, not sampled.

**Storage architecture**: `RepositoryFactory` (`src/storage/repository-factory.ts:8-23`) selects `SupabaseStorageProvider` (Prisma/Postgres) when configured, else `JsonStorageProvider`/`UserDB`. `SupabaseStorageProvider` falls back internally to JSON only if Prisma init fails, logging loudly (not silent). **`UserDB` is live, load-bearing code, not legacy** — reachable whenever Postgres is unreachable/unconfigured.

**Deletion/retention (Phase 24 technical half)**: `DELETE /api/profile` → `UserRepository.deleteAccount` → real cascading delete on both backends, genuinely removing `Project`/`ScanReport` (including `diagnostics` JSON, which can contain source-code snippets) /`Notification`/`Settings`/`ApiKey`/`SavedReport`/`AiHistory`/`ExportHistory`; `AuditLog`/`ResearchEvaluation` survive anonymized. **FIXED AND VERIFIED** — not merely hidden.

---

## 7. Secrets / Git-History Audit — CRITICAL SECTION

### Current tracked state
- `.env`/`.env.local`: not tracked. `.env.example`: read in full, contains only clean unambiguous placeholders (`"YOUR_PRODUCTION_JWT_SECRET_STRING"`, etc.) — **NOT FOUND**: no real secret material.
- Local `.env` (untracked): `ADMIN_BOOTSTRAP_PASSWORD`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `REFRESH_SECRET`, `STORAGE_PROVIDER`, `SUPABASE_SERVICE_ROLE_KEY` all **PRESENT** (key names only, no values read). `GEMINI_API_KEY` **NOT PRESENT**.

### Historical exposure — independently re-confirmed this session
- `.env` was committed at `98bac3f9` ("Initial FIGM DevSecOps Platform") and untracked at `56ddcfc0`. **The historical blob is still reachable** (`git cat-file -e 98bac3f9:.env` succeeds this session) — **no history rewrite (filter-repo/BFG) has ever occurred.**
- `figm-user-db.json` (historically contained an admin refresh token and a hardcoded default admin password per commit `20e28f03`'s message) was added at `98bac3f9`, touched by 74 historical commits, untracked at `20e28f03`. **Blob still reachable** (`git cat-file -e` succeeds). Content not read this session (would risk exposing password hashes/tokens).
- Same key-name set (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `REFRESH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) present in both the historical and current `.env`.
- **`ENV_VARIABLES.md:30` explicitly instructs purging this history via `git filter-repo`** — this instruction has never been carried out. This exact gap is independently documented in three separate prior audit files already in this repo (`audit/sections-final/git-history-secrets.md:72-78`, `audit/sections-final/live-security.md:287-290`, `audit/ULTIMATE_FINAL_FORENSIC_AUDIT.md:244`), all agreeing history was never rewritten — a **long-standing, repeatedly-documented, still-unremediated** gap between stated policy and actual repository state. **DOCUMENTATION / IMPLEMENTATION MISMATCH.**

### Rotation status — the single most consequential unresolved question in this audit
- The most recent commit on `main` (`85d461a4`, this session's HEAD) is titled *"docs(audit): ultimate zero-trust audit -- Supabase credential rotation confirmed."* Its companion checklist, `audit/FINAL-RELEASE-GATE.md`, states `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL`/`DIRECT_URL` were rotated **this prior session** ("moved to an entirely new Supabase project, not just a password reset"), verified via SHA-256 hash comparison (no plaintext read/printed) plus live functional testing.
- **This session attempted to independently reproduce that same hash-comparison methodology and was blocked by the Claude Code permission/auto-mode classifier before any value was read or hashed.** No workaround was attempted, per audit discipline (do not bypass a permission boundary).
- Per this audit's own governing rule ("do not trust previous 'FIXED' labels," "a commit message alone is not evidence"), the rotation claim is recorded here as: **the prior document's claim, with its stated methodology, but NOT independently re-verified this session.** It is neither confirmed nor contradicted by this session's own evidence — it is **NOT VERIFIED THIS SESSION.**
- **Explicitly still open even in the prior document's own text**: whether the *old* (pre-rotation) Supabase project's credentials were independently revoked, or the old project deleted, is stated by `audit/FINAL-RELEASE-GATE.md` itself as **NOT VERIFIED**.
- **If the historical `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL` were in fact never rotated, or the old project was never decommissioned, this is a live CRITICAL finding** — a full-privilege database credential, reachable by anyone who can read this git history (e.g. if the GitHub remote is or becomes public, or any clone/fork exists). This audit **cannot rule that out** and does not accept the prior claim at face value per its own governing instructions.

### Fallback-secret code audit
- `resolveSecret()` (`src/auth/auth-service.ts:18-77`) genuinely fails closed outside dev/test for `JWT_SECRET`/`REFRESH_SECRET` — **FIXED AND VERIFIED** (source-level). This governs only these two secrets' *current* code-path behavior, not the historical-exposure question above.
- No other hardcoded default-secret literal pattern found in `src/`, `app/`, `middleware.ts`.

---

## 8. User Lifecycle Audit (Phase 6)

| Step | Status | Evidence |
|---|---|---|
| Visitor → Register | IMPLEMENTED | `app/auth/register/page.tsx:25-56`, real `POST /api/auth/register` |
| Register → Login | IMPLEMENTED | `app/auth/login/page.tsx:26-57`; old duplicate `/login` now redirects to canonical `/auth/login` |
| Login → Dashboard | PARTIALLY VERIFIED | Login redirects to `/guidelines`, not a `/dashboard` route (dashboard content lives at `app/page.tsx`); not verified whether intentional |
| Dashboard → Project | IMPLEMENTED (existence only) | `app/projects/page.tsx` exists; full CRUD flow not read in full |
| Code Input → Scan | IMPLEMENTED | Real Monaco editor, `fetch('/api/scan')`, dual client+server 500KB size guard |
| Results | IMPLEMENTED | UI carries `sourceKind: 'REAL_AST' \| 'LEGACY_TEXT_HEURISTIC'` per-finding — genuine provenance labeling |
| Remediation | IMPLEMENTED, verification-gated | `VerificationStatus` union never labels anything "Verified Fixed" without `verified===true` from a real re-scan (§13) |
| Re-scan / History / Details | IMPLEMENTED | `useScans` performs real paginated `fetch('/api/scans?...')`, not mock data |
| Logout | IMPLEMENTED, recently-fixed per in-code comment | Real `POST /api/auth/logout`, clears local storage, navigates away. Comment states prior version was a dead link with no server-side revocation — a real prior security bug. Not live-re-verified this session. |
| Re-login | NOT VERIFIED | No live login attempted (audit rule) |

**No dead/broken internal navigation links found** in the components sampled (not an exhaustive check of every page).

---

## 9. Input / Scan Audit & Untrusted Code Execution Forensics (Phases 7–8) — CRITICAL SECTION

### Execution primitive sweep (full repo)
`new Function(`: `src/engine/dynamic-profiler.ts:115` (browser-only fallback, guarded `!IS_SERVER`) and `src/engine/sandbox/profiler-sandbox-runner.cjs:109` (inside the disposable child process). No `eval(`, no `vm` module, no `worker_threads`, no dynamic `import()` of user content anywhere in `src/`, `app/`, `scripts/`.

### DynamicProfiler architecture — full trace
- `profileExecution` (`dynamic-profiler.ts:248-330`): `IS_SERVER ? runInSandboxProcess : runInBrowserUnsandboxed`.
- **Server path**: `child_process.spawnSync` (`:156-164`) launches `profiler-sandbox-runner.cjs` as a genuine **separate OS process**. Env built from scratch by `buildSandboxEnv()` (`:86-99`) — `process.env` is **never copied into the child**; secrets are structurally absent, not merely redacted.
- `timeout: 3000ms`, `killSignal: SIGKILL` (`:159-160`) — Node's native `spawnSync` timeout over a genuinely separate OS process. This is architecturally sound (does not suffer the "single JS thread can't preempt its own infinite loop" problem, because the loop runs in a different process than the one enforcing the timeout). Heap capped via `NODE_OPTIONS=--max-old-space-size=64`.
- All failure modes (no runner found, spawn error, non-zero exit, unparseable stdout, catch-all) return `hasRuntimeError: true`; **no code path falls back to in-process execution.**
- Child process registers `unhandledRejection`/`uncaughtException` handlers *before* executing code, reporting a structured result and exiting cleanly — a real, correct fix for async-rejection process crashes.
- Only two call sites of `profileExecution` in the entire repo: the real production scan path (`rule-execution-engine.ts:38`) and a fixed benchmark snippet in the eval harness (not user input).

### New, previously-undisclosed gaps (independently found this session)
- **`require` stub is trivially bypassable** — it only shadows the identifier inside the `new Function(...)` parameter scope; a standard Function-constructor escape reaches ambient `process`/`global`/`Buffer` directly, unblocked by anything in this file.
- **No network egress restriction** — nothing blocks outbound `fetch`/`http`/`net` from the sandboxed child within the ≤3s window.
- **`spawnSync` blocks the entire Node event loop** for up to 3s per scan — while one sandbox child runs, the whole Next.js server cannot service *any other* request. This is an availability/DoS-adjacent risk under concurrent load, distinct from (and not mitigated by) the per-IP rate limit, since it is a global-concurrency problem, not a per-IP one.

### Classification: **PARTIAL ISOLATION**
A real, correctly-implemented separate-OS-process boundary with a by-construction secret-free environment, a hard OS-level timeout+SIGKILL, and a capped child heap — a genuine and effective fix for the specific failure modes named in the code's own comments (secret leakage, infinite loops, unhandled-rejection crashes). **Not** a TRUE SANDBOX (no seccomp/container/microVM; `require` stub escapable; no network restriction). **Not** UNSAFE IN-PROCESS EXECUTION either — **the user-memory characterization "scanner executes real code in-process via `new Function()`" is STALE relative to current source** for the server/production path; it accurately describes only the still-present browser-side fallback, which is correctly scoped to the requesting user's own browser tab (`!IS_SERVER`), never the server.

Production shipping: `next.config.mjs:12-13` force-includes the `.cjs` runner via `outputFileTracingIncludes` — **verified by static config, not by an actual `next build` run this session.**

### Input methods (`app/live-scan/page.tsx`)
| Input method | Classification |
|---|---|
| Paste / editor | REAL, SERVER-SIDE, DYNAMIC |
| Single file upload | REAL, SERVER-SIDE, DYNAMIC |
| Multiple file upload | REAL, SERVER-SIDE, DYNAMIC (same code path) |
| Preset/sample code | Hardcoded *input*, but genuinely re-scanned server-side each time — not a hardcoded *result* |
| Repository / whole-repo input | **NOT IMPLEMENTED** in the live-scan UI product feature (exists only as an offline research script under `benchmarks/real-world/`) |

Score generation is real (`RuleExecutionEngine.analyzeFile`, no `Math.random()`, no hardcoded score, no demo/mock branch found); `/api/scan` reuses the same `qualityScore` for both the live response and persistence (fixing a previously-documented 74-vs-88 discrepancy bug).

`/api/scan` posture: 500KB input cap (413 on overflow), non-string rejection, rate-limited 60/min (15/min ai-fix), **auth optional by design** (anonymous guest scans allowed, persisted only for authenticated users).

---

## 10. Framework Detector Audit (Phase 9)

`SourceParser.detectFramework` (`src/parser/source-parser.ts:401-485`). All content-hint checks run against `stripCommentsAndStrings(code)` (`:407`), closing the "comment/string/JSX-text false positive" class explicitly for Angular/Next (cited historical regressions in inline comments, `:404-406`, `:424-429`). Angular detection requires real syntax shape (`@component\(`, `<ng-template`, `trackby`/`ngfortrackby`, real `rxjs` import) or a `.component.ts` filename — not bare prose substring hits.

**Residual, previously-undocumented finding (LOW)**: the React fallback for non-`.jsx`/`.tsx` files (`source-parser.ts:474-482`) does a **plain, non-word-boundary-anchored substring test** (`lowerCode.includes('usestate')`, etc.) — a `GENERIC_ESTREE` file with an unrelated identifier merely containing one of these substrings (e.g. `useStateMachine`) could be misclassified `REACT_JSX`. Blast radius dampened by downstream rule predicates requiring real React AST shapes to actually fire, but the classification step itself is not evidence-based here.

**Verdict: PASS with one LOW finding.**

---

## 11. AST Architecture Audit (Phase 10)

Pipeline: `detectFramework` → `buildASTFromCode` (legacy regex loop **and/or** `buildRealSyntaxNodes` real-AST builder, mutually exclusive per rule×framework, no double-counting) → `UniversalASTMapper.normalizeNode` (carries `sourceKind` forward) → `ASTDetectionEngine.evaluateNode` (25 pure predicate functions) → `createReport` sets `sourceKind`, **defaulting absent values to `LEGACY_TEXT_HEURISTIC`, not silently assuming real-AST.**

Tree shape is intentionally flat by design (documented in `AST_MIGRATION_MAP.md §3`); ancestor-relationship reasoning (scope classification, `useMemo`-ancestor checks) happens during real-AST node production against the genuine `ts.Node` parent chain, before flattening — a legitimate design, not a shortcut.

**Independent re-derivation of the "23/25 real-AST" claim** (from `real-syntax-node-builder.ts`'s 22 `build*` functions + FIGM-REACT-02's separate module = 23; cross-checked against `figm-spec.json`'s 25-rule total): **MATCH.** `ARCHITECTURE.md:30` currently reads "23 of 25" — **the "ARCHITECTURE.md still says 15/25" finding recorded in three older audit files in this repo's own `audit/` directory (`audit/ULTIMATE_FINAL_FORENSIC_AUDIT.md:349,445`, `audit/sections-final/documentation-research.md:232`) is now STALE.** Current documentation is accurate on this specific point.

**Vue**: mechanically confirmed 0/25 rules real-AST (`canAttemptRealAstParse` hard-excludes `VUE_SFC`/`SVELTE` by construction — `@vue/compiler-sfc` was explicitly never added as a dependency). **Angular ANG-03/04**: always legacy — needs real Angular template grammar (`@angular/compiler`, confirmed absent from `package.json`), which a `.component.ts` file's TS-parseable class body cannot provide for its `template: \`...\`` string.

**More precise sub-finding**: of the 23 real-AST rules, **only 9 are real-AST for Angular's class body too; 14 are React/Next-only**. A bare "23/25 real-AST" headline without this caveat would overstate Angular/Vue coverage — current in-repo docs do carry the caveat.

---

## 12. Complete 25-Rule Table (Phase 11)

| Rule ID | Severity | Real-AST Framework(s) | Legacy-only Framework(s) | Builder | Test Coverage |
|---|---|---|---|---|---|
| FIGM-PERF-01 | HIGH | REACT_JSX, NEXT_JS, GENERIC_ESTREE, ANGULAR_TEMPLATE | VUE_SFC | `real-syntax-node-builder.ts:204-224` | rule-detection-matrix, ast-detection-rules, ast-migration, qa-matrix-boundary-adversarial |
| FIGM-PERF-02 | HIGH | REACT_JSX, NEXT_JS | VUE_SFC, ANGULAR_TEMPLATE | `:226-259` | rule-detection-matrix, ast-detection-rules |
| FIGM-PERF-03 | CRITICAL | REACT_JSX, NEXT_JS, GENERIC_ESTREE, ANGULAR_TEMPLATE | VUE_SFC | `:709-720` | rule-detection-matrix, ast-detection-rules |
| FIGM-PERF-04 | MEDIUM | REACT_JSX, NEXT_JS, GENERIC_ESTREE, ANGULAR_TEMPLATE | VUE_SFC | `:329-345` | rule-detection-matrix, ast-detection-rules |
| FIGM-PERF-05 | MEDIUM | REACT_JSX, NEXT_JS | VUE_SFC, ANGULAR_TEMPLATE, GENERIC_ESTREE | `:732-746` | rule-detection-matrix |
| FIGM-PERF-06 | HIGH | REACT_JSX, NEXT_JS, GENERIC_ESTREE, ANGULAR_TEMPLATE | VUE_SFC | `:750-763` | rule-detection-matrix |
| FIGM-A11Y-01 | CRITICAL | REACT_JSX, NEXT_JS | VUE_SFC, ANGULAR_TEMPLATE | `:351-372` | rule-detection-matrix, accessibility-regression |
| FIGM-A11Y-02 | HIGH | REACT_JSX, NEXT_JS | VUE_SFC, ANGULAR_TEMPLATE | `:374-387` | rule-detection-matrix, accessibility-regression |
| FIGM-A11Y-03 | HIGH | REACT_JSX, NEXT_JS | VUE_SFC, ANGULAR_TEMPLATE | `:389-413` | rule-detection-matrix, accessibility-regression |
| FIGM-A11Y-04 | CRITICAL | REACT_JSX, NEXT_JS | VUE_SFC, ANGULAR_TEMPLATE | `:415-430` | rule-detection-matrix, accessibility-regression |
| FIGM-A11Y-05 | CRITICAL | REACT_JSX, NEXT_JS | VUE_SFC, ANGULAR_TEMPLATE | `:776-790` | rule-detection-matrix, accessibility-regression |
| FIGM-A11Y-06 | HIGH | REACT_JSX, NEXT_JS | VUE_SFC, ANGULAR_TEMPLATE | `:810-824` | rule-detection-matrix, accessibility-regression |
| FIGM-NEXT-01 | CRITICAL | NEXT_JS only (catalog metadata overstates REACT_JSX support — §28 F-16) | — | `:968-981` | rule-detection-matrix |
| FIGM-NEXT-02 | HIGH | NEXT_JS only | — | `:981-1017` | rule-detection-matrix, live-scan-e2e |
| FIGM-NEXT-03 | MEDIUM | NEXT_JS only | — | `:1017-1039` | rule-detection-matrix, remediation-engine-regressions |
| FIGM-NEXT-04 | MEDIUM | NEXT_JS, REACT_JSX | — | `:1039-1057` | rule-detection-matrix |
| FIGM-REACT-01 | HIGH | REACT_JSX, NEXT_JS, GENERIC_ESTREE | VUE_SFC | `:862-874` | rule-detection-matrix, react-ast-rules |
| FIGM-REACT-02 | HIGH | REACT_JSX, NEXT_JS | GENERIC_ESTREE (not independently confirmed — NOT VERIFIED) | `src/analysis/react-ast-rules.ts` | rule-detection-matrix, react-ast-rules (dedicated) |
| FIGM-REACT-03 | CRITICAL | REACT_JSX, NEXT_JS, GENERIC_ESTREE, ANGULAR_TEMPLATE | VUE_SFC | `:632-668` | rule-detection-matrix, adversarial-complete-detection, qa-matrix-boundary-adversarial, react-ast-rules |
| FIGM-REACT-04 | MEDIUM | REACT_JSX, NEXT_JS | VUE_SFC, ANGULAR_TEMPLATE, GENERIC_ESTREE | `:882-897` | rule-detection-matrix |
| FIGM-ANG-01 | CRITICAL | ANGULAR_TEMPLATE, GENERIC_ESTREE | — | `:909-922` | rule-detection-matrix |
| FIGM-ANG-02 | HIGH | ANGULAR_TEMPLATE, GENERIC_ESTREE | — | `:922-938` | rule-detection-matrix |
| FIGM-ANG-03 | HIGH | **NONE — always legacy** | ANGULAR_TEMPLATE, GENERIC_ESTREE | `source-parser.ts:1062-1076` | rule-detection-matrix |
| FIGM-ANG-04 | HIGH | **NONE — always legacy** | ANGULAR_TEMPLATE, GENERIC_ESTREE | `source-parser.ts:~1077-1090` | rule-detection-matrix |
| FIGM-ANG-05 | HIGH | ANGULAR_TEMPLATE, GENERIC_ESTREE | — | `:938-968` | rule-detection-matrix |

**Rule-ID consistency**: `figm-spec.json` has exactly 25 entries (`node -e "require('./figm-spec.json').rules.length"` → 25). `src/matrix/rule-registry.ts` derives `RULE_CATALOG` directly from `FOUR_LAYER_MAPPINGS` via `.map()` — a single source of truth, structurally preventing ID drift between registry/spec/engine. Per-test-file string-literal consistency was not exhaustively checked (**NOT VERIFIED** at that granular level).

### FIGM-REACT-01 / FIGM-REACT-03 Forensic Review (Phase 12)

**FIGM-REACT-01**: `isLikelyNonArrayNamespaceReceiver` (`real-syntax-node-builder.ts:848-860`) excludes any bare-identifier receiver starting with an uppercase letter — structurally general (no hardcoded `"Vue"` string comparison anywhere), correctly excludes `Vue.filter(...)`. `Array.from(x).filter(...)` is **not** excluded (receiver is a `CallExpression`, not a bare `Identifier`) — matches the rule's own documented known limitation. **Verdict: FIXED AND VERIFIED as a genuine structural fix, not narrow suppression.** New, previously-undocumented residual finding: a PascalCase-named plain array variable is now incorrectly excluded (false negative) — a real trade-off the fix accepts but does not disclose.

**FIGM-REACT-03**: ~230 lines of categorical exclusions (`document`/`window`/`.current` ref chains) plus a **positive-evidence allowlist** (`this.state`, or file-wide `stateLikeNames` built from real `useState` destructuring with alias tracing, or `setX(...)` calls gated on independent React/JSX evidence via a real AST `containsJsx` check). Direct verification against every example named in the audit brief (`defaultProps`, `module.exports`, canvas mutations, local arrays, `setX` naming, `useState` evidence, React context) confirms **no hardcoded literal-string exclusions exist** — exclusion is entirely evidence-based. **Verdict: FIXED AND VERIFIED as a genuine, generalized fix.** Honestly-disclosed residual limitation: `stateLikeNames` is file-wide, not scope-aware — two unrelated identically-named variables in different functions in the same file are indistinguishable to this rule (stated in the rule catalog itself, not hidden).

---

## 13. Remediation Engine Audit (Phase 13)

`src/engine/remediation-engine.ts` (856 lines). **Patch generation is regex/string-based, not true AST transformation** — `code.includes(snippet)` / `code.replace(snippet, fixedSnippet)` per rule case. Detection is AST-based; the patch step is textual. This is an architectural fact, not inherently a bug.

**Refuses unsafe fixes**: 6/25 rules (`FIGM-PERF-05`, `FIGM-NEXT-02`, `FIGM-NEXT-04`, `FIGM-REACT-01`, `FIGM-REACT-04`, `FIGM-ANG-04`) set `requiresManualReview = true` with inline rationale, never claiming a complete automated fix.

**`validatePatch()` (lines 787-853) is a real VERIFY step**: no-op check → re-invokes `RuleExecutionEngine.analyzeFile` on both original and patched code → rejects new syntax errors → rejects new `TYPE_COMPILE_ERROR` codes → rejects any newly-introduced FIGM guideline violation → only then reports `FIXED`. **No code path reports `verified: true` without an actual re-scan.**

**Finding R-1 (MEDIUM, latent, not reproduced)**: `code.replace(snippet, fixedSnippet)` uses a **string** argument, which only replaces the first occurrence. If the offending snippet text is duplicated in a file, the wrong occurrence could be patched — largely defended against by `validatePatch`'s re-scan (would likely surface as `UNRESOLVED`, not a false `FIXED`), but no existing test exercises a duplicated-snippet file. **UNSUPPORTED EMPIRICAL CLAIM that this has ever actually misfired** — flagged as a plausible latent risk, not a reproduced bug.

Test coverage (`remediation-coverage.test.ts`, `remediation-engine-regressions.test.ts`, `ai-remediation.test.ts`) is substantive: parametrized over all 25 rule IDs with real parse→detect→fix→re-scan assertions; one test even executes generated code via `new Function` to confirm semantic (not just string) correctness. No `.skip`/`.only`/tautologies found.

---

## 14. AI Audit (Phase 14)

**AI CAPABILITY = YES.** `src/ai/gemini-service.ts` (70 lines, read in full): genuine `fetch()` to Gemini 2.5 Flash, real HTTP-error handling, real response-shape validation. `src/ai/patch-validator.ts` rejects empty output, markdown fences, no-op patches, and code failing real AST parsing before ever trusting LLM output.

**AI ACTIVE = NOT VERIFIED (in this environment).** `GEMINI_API_KEY` is absent from both `.env` and `.env.local` (key-name check only). The pipeline checks presence, not just truthiness, and deterministically falls back when absent. Whether AI is active in any *deployed* environment cannot be verified from this local audit.

**Wired into the live app path** (not dead code): `app/api/scan/route.ts` imports and calls `AIRemediationPipeline` on `action === 'ai-fix'`, gated by its own tighter 15/min rate limit.

**FALLBACK = YES, not degraded**: `executeFallback()` reuses the exact same `RemediationEngine.applyQuickFix` + `validatePatch` from §13 — the AI path does not get a weaker verification bar than the deterministic path; an AI-produced patch that fails `AIPatchValidator` or `validatePatch` is discarded and the deterministic result returned instead.

**POST-SCAN VERIFICATION = YES**, converging on the same `validatePatch` function for both AI and fallback paths — **directly satisfies the "prevents false success" requirement for the whole remediation+AI subsystem.**

---

## 15. Frontend / UI / UX Audit (Phase 15)

Files read in full: `Sidebar.tsx`, `HeaderBar.tsx`, `AppShell.tsx`, `login`/`auth/login`/`auth/register` pages, `settings/page.tsx` (partial), `user-study/page.tsx` (partial), `live-scan/page.tsx` (partial). Remaining ~14 pages (`history`, `projects`, `admin`, `diagnostics`, `analytics`, `security`, `performance`, `accessibility`, `references`, `reports/[id]`, `profiler`, `ai-fix`, `notifications`, `guidelines`) were grep-only — **NOT VERIFIED by full read.**

**Confirmed findings:**
- **`app/HeaderBar.tsx:326-332`** — profile nav element always renders literal text **"LOGIN"** and avatar letter "L" regardless of the actual signed-in user, despite the real user's name being available in `localStorage`. Real, minor, but notably inconsistent with this codebase's otherwise strong anti-hardcoding discipline. (§28 F-13)
- **`app/HeaderBar.tsx:17,126-148`** — a "Framework Selector" dropdown has no observable downstream consumer in the files read. **NOT VERIFIED whether it's genuinely non-functional** (a context provider elsewhere could consume it) — flagged, not asserted.
- **`app/settings/page.tsx:83-99`** — theme selector is honestly disabled with disclosed limitation text, not left as a misleading dropdown. **Positive finding.**
- **`app/user-study/page.tsx:184`** — hero banner honestly states "HUMAN COLLECTION PENDING"; in-code comment documents a **previously-fabricated hardcoded 88/4 score sent for every participant**, since fixed to send real submitted code for server-side recomputation. **Positive finding, directly relevant to §20/§21.**
- No `mock`/`fake data`/`Coming soon` labels found anywhere under `app/**`; every occurrence of the string "hardcoded" found in the codebase is a comment or UI copy **disclaiming** hardcoding.

---

## 16. Accessibility Audit (Phase 16, source-based only — no rendered-DOM/contrast measurement possible)

| Item | Status |
|---|---|
| Label/htmlFor-id pairing on auth forms | **PASS** — enforced by regression test, confirmed present |
| Error announcement + focus management (auth forms) | **PASS** — `role="alert"` + programmatic focus |
| Single `<h1>` per auth page | **PASS** |
| Mobile nav drawer focus trap + return | **PASS** — real Tab/Shift+Tab trap, focus restoration, Escape-to-close |
| Mobile menu toggle semantics | **PASS** — real `<button>` with `aria-expanded`/`aria-controls`/`aria-label` |
| **Cmd+K search modal focus trap** | **FAIL** — `aria-modal="true"` present but **no Tab-focus trap found**; a keyboard user can Tab out into background content. Independently confirmed by two sources (this audit's frontend fork + `audit/FINAL-RELEASE-GATE.md`, unresolved as of HEAD). (§28 F-03) |
| **Monaco editor accessible label** | **FAIL** (per `audit/FINAL-RELEASE-GATE.md`, unresolved as of HEAD — not independently re-verified this session, code not re-read for this specific control) |
| Notification dropdown items (HeaderBar) | PARTIALLY VERIFIED — ARIA `role="button"` pattern, inconsistent with the full `/notifications` page which is tested to require real `<button>` elements |
| **Live-region coverage app-wide** | **Likely broad gap** — `role="status"`/`aria-live`/`role="alert"` found in only 10 of ~30 page/component files despite most having loading/error state; remaining pages confirmed to have `loading`/`error` state but no confirmed announcement mechanism. **FAIL/NOT VERIFIED per-page.** (§28 F-14) |
| Overall "WCAG 2.2 AA Designed" badge (`Sidebar.tsx:289`) | **UNSUPPORTED EMPIRICAL CLAIM AS A CONFORMANCE CLAIM** — wording says "Designed" not "Verified/Conformant" (a defensible hedge), but no axe-core scan or full manual audit evidence exists; regression tests cover a small set of previously-fixed defects, not a WCAG conformance suite |
| Color-contrast tokens | **NOT VERIFIED** — `app/globals.css` not read; observed colors in read files are inline hex literals, not named contrast-checked tokens |
| Semantic landmarks | **PASS** — real `<main>`, `<footer>`, `<aside>`, `<nav aria-label>`, `<header>` |
| Guidelines-page filter buttons `aria-pressed` | **FAIL** (per `audit/FINAL-RELEASE-GATE.md`, LOW, unresolved as of HEAD) |

---

## 17. Performance Audit (Phase 17, source-based only — no live measurement performed; nothing fabricated)

| Item | Status |
|---|---|
| Monaco editor code-splitting | **PASS** — `next/dynamic({ssr:false})`, explicitly dogfoods the app's own FIGM-NEXT-02 rule |
| Polling / repeated API calls | **PASS (none found)** — zero `setInterval`/polling matches app-wide |
| Client+server input-size guard | **PASS** — 500KB cap enforced on both sides, not client-trusted only |
| Large-diff computation guard | **PASS** — `computeLineDiff` falls back to a coarse diff above a 4,000,000 cell LCS threshold rather than hanging the tab |
| `spawnSync` blocking the event loop | See §9 — MEDIUM availability risk under concurrency |
| Bundle size beyond Monaco / route-level splitting | **NOT VERIFIED** — would require a real build/bundle-analyzer run |
| N+1 query patterns | **NOT VERIFIED** — not read by the fork covering this phase |
| Live Core Web Vitals / load-time numbers | **NOT VERIFIED** — no dev server started; no number should be cited elsewhere in this repo without corroborating instrumentation |

---

## 18. QA Forensic Audit (Phase 18)

- **Test inventory**: 54 files on disk in `tests/*.test.ts`, exactly matching `package.json`'s `test` script — **zero silent exclusions.**
- **`.skip`/`.only`**: zero matches repo-wide.
- **Tautology spot-check** (3 files fully read: `precision-recall-pipeline`, `anti-hardcoding-guard`, `regression-security`): no `assert(true)` patterns found; `precision-recall-pipeline.test.ts:52-71` proves 4 distinct TP/FP/FN inputs yield 4 pairwise-distinct F1 scores (a genuine not-hardcoded proof); `anti-hardcoding-guard.test.ts` (211 lines) is **itself a regression-guard suite whose entire purpose is scanning production source for previously-fabricated metrics** (a hardcoded 85.71% precision, a fabricated Cronbach's α=0.892, a fabricated confusion matrix, a fabricated 84.6/"Grade A" SUS score, 8 named "fabricate 85 participants" seed scripts) — strong first-party corroboration of the project's documented fabrication history **and** an active correction discipline.
- **Not exhaustively verified**: the remaining ~51 test files were not fully read for tautologies — treat "no tautologies anywhere" as **NOT VERIFIED** beyond the 3 sampled files, though `.skip`/`.only`/exclusion checks were repo-wide and complete.
- **README.md's "678 tests / 71 test suites" claim**: **NOT VERIFIED this session** (running the suite was out of scope — several test files touch a live Supabase DB). Static proxy counts (239 top-level `test()`/`it()` calls, 47 `describe()` blocks) do not corroborate "71 test suites," though table-driven/looped test generation could explain the gap. **Classification: UNSUPPORTED EMPIRICAL CLAIM pending a live run**, not a confirmed falsehood.

---

## 19. Controlled Benchmark Audit (Phase 19)

Source: `benchmarks/eval-summary.json` / `docs/evidence/canonical-evaluation.json` (byte-identical, same generation timestamp), `benchmarks/ground-truth.json`.

**Recomputed independently from raw counts** (TP=19, FP=2, FN=0): Precision = 19/21 = **0.904762** (matches reported exactly), Recall = 19/19 = **1.0** (matches), F1 = **0.95** (matches, floating-point rounding only). ✅ Exact match.

**Minor clarity gap (not fabrication)**: the per-rule breakdown table shows 0 FP across all 8 ground-truth-covered rules; the 2 overall FPs are attributable to *uncovered* rules (`REACT_JSX`/`ANGULAR_TEMPLATE` framework metrics) firing extra diagnostics on the same fixtures — a real nuance `benchmark-results.md` does not explain.

**Classification: DYNAMIC, REPRODUCIBLE.** `RESEARCH_TRACEABILITY_MATRIX.md:25-30` itself self-documents that a **prior version of this exact table reported a fabricated 1.00/1.00/1.00 precision/recall/F1 and a fabricated Cronbach's α=0.892**, both since corrected — direct textual, first-party confirmation of the project's documented fabrication history, now stated as fixed and independently confirmed absent from the current live table.

**Ground-truth benchmark scope is 8 of 25 rules only** (`FIGM-A11Y-01..04`, `FIGM-PERF-01..04`), 19 expected violations, 147 LOC testbed — consistently stated everywhere this was checked.

---

## 20. Real-World Benchmark Audit (Phase 20)

Corpus: 5 real, named, linkable GitHub repos with real 40-hex-char commit SHAs independently spot-checked (e.g. `raw-results/react-crash-2021.json` → `a644cdedd86d9a4bb939eca4881bf26a29340519`, matching the 8-char prefix shown in `SUMMARY.md`). **No ground truth exists for this corpus, and the documents are explicit and honest about it** — the only bounded precision figures (13/18, 7/18) are scoped to an 18-item manual spot-check with repeated caveats not to read them as an overall precision figure. **No unsupported aggregate P/R/F1 was found for the real-world set.**

**CRITICAL documentation-currency finding (found by this audit, not caught by any prior audit pass):**
- `benchmarks/real-world/SUMMARY.md` (last touched 2026-08-14) headlines **268 total findings**, dominated by **FIGM-REACT-03: 153 findings (57%)**, built around false-positive examples cited in `SPOT_CHECK.md` #3/#5/#8/#15.
- Current `raw-results/*.json` (regenerated 2026-08-18 by commit `bf80a0ff`, **after** fix commit `640ffd67` "gate the setX(...) setter-name signal on real React/JSX context") report **114 total findings and zero FIGM-REACT-03 hits across all 5 repos.**
- **`SUMMARY.md`/`METHODOLOGY.md`/`SPOT_CHECK.md` were never regenerated after the fix landed** — they describe a detector state that no longer exists.
- `audit/sections-final/documentation-research.md:201-206` (an earlier audit pass in this same repo) **cites the stale 268/FIGM-REACT-03 figures as current, without flagging the staleness** — this specific contradiction survived at least one prior audit pass undetected.
- **Classification: DOCUMENTATION / IMPLEMENTATION MISMATCH.** The raw JSON is genuine and reproducible; the narrative Markdown is stale. **Recommendation: re-run the real-world benchmark and regenerate `SUMMARY.md`/`SPOT_CHECK.md` before citing the 268/FIGM-REACT-03 figures anywhere (including a viva).**

Other Phase 20 evidence (unaffected by the staleness above, still current): `METHODOLOGY.md` documents a real, previously-live async `unhandledRejection` crash reproduced against a real cloned file — this is the historical bug the current sandbox-process architecture (§9) was built to fix. 0 parser errors / 0 sync engine crashes across all 80 real-world files, consistent between the stale summary and the current raw results (unaffected claim).

---

## 21. Research Traceability (Phase 21)

`RESEARCH_TRACEABILITY_MATRIX.md` (39 lines): RO1–RO5, each mapping Research Question → Feature → Source Module → API → DB Model → Metric/Result.

| RO | Status |
|---|---|
| RO1 (Guideline Formalization) | PARTIALLY COMPLETE — 25 rules unit-verified; only 8/25 have empirical ground-truth benchmark coverage |
| RO2 (Multi-Framework AST Normalization) | PARTIALLY COMPLETE — 23/25 real-AST claim (independently confirmed in §11) |
| RO3 (Automated Quality Engine) | COMPLETE for the 19-violation/8-rule benchmark; explicitly NOT COMPLETED for anything broader |
| RO4 (AI Remediation) | PARTIALLY COMPLETE — re-scan verification implemented+tested; self-flagged "no aggregate % patches valid benchmark has been run" |
| RO5 (Multi-Tenant SaaS) | PARTIALLY COMPLETE — architecture real; explicitly "0/85 participants collected," SUS/Cronbach's α "not currently reportable," not deployed with real users |

**This document itself is the single strongest piece of self-admitted-and-corrected fabrication evidence in the repository**: it records that a prior version fabricated 1.00/1.00/1.00 metrics, a fabricated α=0.892, a nonexistent "30 Open-Source SPA Benchmark Repositories" dataset, and several wrong file paths/DB model names — all stated as now corrected.

---

## 22. Human Study / Independent Annotation Status (Phase 22)

**Independent annotation**: `research/independent-annotation/results/STATUS.md` states explicitly: *"Independent annotation: PENDING... No submission file was given... No independent annotator has completed the annotation process... No raw agreement, Cohen's kappa, or confusion matrix is reported, because none has been computed from real annotation data."* Only infrastructure exists (blinded ground truth, templates, fixtures). → **`PLANNED — NOT COMPLETED`**, per the audit's own instruction not to infer completion from infrastructure.

**Human/usability study**: `research/analysis/usability-results.json` explicitly reports `"datasetType": "SYNTHETIC"`, `"isRealHumanData": false`, `"collectionStatus": "NOT_COLLECTED"`, `"validParticipantCount": 0`. `research/raw/real/`, `research/processed/real/`, `research/anonymized/real/` each contain only a `.gitkeep`. → **`PLANNED — NOT COMPLETED`**.

**Ethics/consent**: `research/CONSENT_FORM.md`, `DATA_COLLECTION_PROTOCOL.md`, `ANONYMIZATION_PROTOCOL.md` exist as protocol documents; **no reference to a formal IRB/institutional ethics-board approval number/letter was found anywhere in `research/**`.** This does not prove no ethics review occurred (it may exist outside the repo) — **NOT VERIFIED**, not a negative finding.

**Cohen's kappa**: computation logic exists (`tests/inter-rater-reliability.test.ts`, `scripts/compare-annotations.ts`) but, per the above, has never been run against real annotation data — any kappa value anywhere in the codebase is necessarily synthetic/test-fixture-derived.

---

## 23. Documentation Audit (Phase 23)

**Consistent claims** (checked across README.md, ARCHITECTURE.md, RESEARCH_TRACEABILITY_MATRIX.md, VIVA_PREPARATION_GUIDE.md, DISSERTATION_DEMO_GUIDE.md, docs/DEVELOPMENT_SUMMARY.md): rule count (25), real-AST count (23/25), ground-truth benchmark scope (8/25 rules, 19 TP/2 FP/0 FN, P=90.5%/R=100%/F1=95.0%, 147 LOC) — **no contradiction found**, all consistent. `DISSERTATION_DEMO_GUIDE.md:35` proactively self-discloses that an earlier "30-repository/755k-LOC" dataset existed and was deleted for having no real scans behind it — a historical fabrication now disclosed, not hidden.

**Contradiction found**: README.md:47's **"678 tests across 71 test suites"** is not corroborated by static analysis (§18) — flagged `UNSUPPORTED EMPIRICAL CLAIM`, with the caveat README.md itself already tells the reader to "run `npm test` yourself to confirm."

**Trajectory contradiction across the audit lineage itself**: `audit/FINAL-READY-VERIFICATION.md` (through its 2026-08-19 addendum) states *"no other known CRITICAL or HIGH finding standing between it and a genuine FINAL-READY verdict"* once the credential-rotation blocker closes. **The very next commit in the same lineage** (`audit/FINAL-RELEASE-GATE.md`, same HEAD `85d461a4`, same day) finds **5 new open items** — most severely, no admin account exists at all on the live database — and explicitly concludes **NEAR FINAL, not FINAL-READY.** This is a documented instance of one audit's confidence outpacing what the very next, more thorough pass actually found. See §26 for full reconciliation.

No other numeric contradictions (LOC totals, participant counts, superlative security/accessibility claims) were found in the files checked — the documentation set is unusually self-caveating for a project of this kind.

---

## 24. Privacy Audit (Phase 24)

Line-by-line cross-check of `PRIVACY.md` against `prisma/schema.prisma` and account-deletion code:

| PRIVACY.md claim | Status |
|---|---|
| No standalone full-source-code record; only per-finding snippets in `diagnostics` JSON | STILL VALID (schema-level; not every finding-construction code path traced) |
| No automatic retention/expiry job; deletion only on user action | STILL VALID |
| Account deletion cascades projects/scans(+snippets)/notifications/settings/API keys/saved reports/AI history/export history | **FIXED AND VERIFIED — all 8 relations checked individually against the schema, exact match** |
| AuditLog retained, user link cleared not deleted | STILL VALID — exact match (`onDelete: SetNull`) |
| Deletion is self-service only, not admin-triggerable via this path | STILL VALID — `DELETE /api/profile` takes `userId` only from the authenticated session, no client-supplied ID accepted |
| Admins can access other users' data | STILL VALID, and **more protective than a literal reading might suggest** — admin GET masks API keys to last-4-characters, not plaintext |
| AI remediation has no third-party transmission when using template fallback | **NOT VERIFIED by this fork** — cross-referenced against §14; consistent with §14's findings |

**One documentation omission (LOW, not a mismatch)**: `ResearchEvaluation` and `FrameworkBenchmark` tables are not covered by PRIVACY.md's data inventory — neither stores source code or obviously-identifying content.

**Overall: PRIVACY.md is one of the more evidence-backed documents in this repository** — every specific, falsifiable claim it makes about the data model and cascade-delete behavior was independently corroborated against current schema/code.

---

## 25. Production Deployment Audit (Phase 25)

- `next.config.mjs`: `reactStrictMode: true`, real security `headers()` on every route — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, a real `Content-Security-Policy` (default-src 'self', explicit CDN allow-list for Monaco, object-src 'none', frame-ancestors 'none'), `Strict-Transport-Security` with preload, `Permissions-Policy`. `'unsafe-eval'`/HMR websocket allowance gated dev-only. **`'unsafe-inline'` remains for script-src/style-src in all environments** — a genuine, explicitly-acknowledged (comment-documented) tradeoff versus a nonce-based CSP, not a silent gap. **Classification: FIXED AND VERIFIED (source-level).**
- Sandbox runner `.cjs` is force-included in serverless build output tracing (`outputFileTracingIncludes`) with a comment citing the prior `CRIT-DYNPROF` finding as rationale — **verified by static config, not by an actual production build this session.**
- `vercel.json`: `buildCommand: "npx prisma generate && next build"`, region `sfo1`, secrets expected from Vercel dashboard (consistent with `.env.example`/`ENV_VARIABLES.md`).
- `webpack()` stubs `child_process`/`fs`/`path`/`url` client-side only, with a documented rationale (DynamicProfiler is reachable from the client bundle's import graph even though its execution path is runtime-guarded).
- `.github/workflows/figm-scan.yml` exists but was not deep-read by any fork this session — **NOT VERIFIED.**

---

## 26. Self-Dogfooding Audit (Phase 26, illustrative, not exhaustive — no scanner execution)

| # | Location | Pattern | Rule | Classification |
|---|---|---|---|---|
| 1 | `app/history/page.tsx:206-207` | `[1,2,3,4,5].map((i) => <div key={i}/>)` loading skeleton | FIGM-REACT-01-adjacent (index-as-key) | **INTENTIONAL EXCEPTION** — static literal array, list identity never changes, the textbook acceptable case |
| 2 | `app/live-scan/page.tsx:307-309` | `rows.map((row,i)=><div key={i}>)` in a diff-view renderer, `rows` dynamically derived | FIGM-REACT-01-adjacent | **TRUE POSITIVE (illustrative, low severity)** — genuine instance of the targeted pattern, low practical risk since the list is typically wholesale-replaced |
| 3 | `app/guidelines/page.tsx:213` | Documentation prose string describing the anti-pattern, not executable code | FIGM-REACT-01-adjacent | **FALSE POSITIVE TRAP** — a naive substring/regex scanner would misfire here; illustrates why AST-based (not text) detection matters, and why FIGM's own `app/` tree is a poor adversarial corpus for its own rules |

Not exhaustive — a real self-scan (out of scope, would require executing the scanner against its own tree) could surface more.

---

## 27. Previous Audit Reconciliation (Phase 27)

### Audit-document commit lineage (`git log --oneline -- audit/`)
```
85d461a4  2026-08-19  Supabase credential rotation confirmed  [ULTIMATE-FINAL-ZERO-TRUST-AUDIT.md + FINAL-RELEASE-GATE.md]  <- HEAD
dc69ea84  2026-08-19  fix dead-link/stale-content docs; 2026-08-19 re-verification addendum  [amends FINAL-READY-VERIFICATION.md]
94902d2f  2026-08-18  add ULTIMATE_FINAL_FORENSIC_AUDIT + FINAL-READY verification reports
3d9e7730  2026-08-18  reconcile test-count/AST-scope contradictions, add PRIVACY.md
29e63ffb  2026-08-18  close NEW-03 (FIGM-REACT-01 Vue .filter() false positive)
12e256ac  2026-08-18  close NEW-02 (FIGM-REACT-03 false-positive class)
ea71e5c0  2026-08-17  close BENCH-02/QA-02/QA-03, add 4 new low findings
9b84c384  2026-08-17  final verification re-audit (new-02.md)
c07e0f37  2026-08-17  fix(FIGM-NEXT-03) revalidate/quick-fix ordering bug
fbb98332  2026-08-14  unify human-study data flow; verify independent-annotation infra fabrication-free
11bedd07  2026-08-14  repository-wide research-claim reconciliation
```

The lineage is **generally self-correcting and honest** — later documents find and disclose new problems rather than rubber-stamping earlier "FIXED" claims. Several genuinely severe issues (live IDOR, committed credentials, in-process arbitrary-code execution with `process.env` access) were, per the documentary trail, found and fixed across 2026-08-14 → 2026-08-19.

### Reconciliation table

| Finding | Old status | Current evidence (this audit) | Current status |
|---|---|---|---|
| CRIT-DYNPROF (in-process `new Function()` execution) | CRITICAL, `ULTIMATE_FINAL_FORENSIC_AUDIT.md` (2026-08-18) | §9 of this report independently re-derived the current architecture from source: separate-OS-process execution, no in-process execution on the server path | **FIXED AND VERIFIED (by static source re-derivation this session)** — the "in-process" characterization is now stale for the server path |
| Supabase credential rotation | CRITICAL/BLOCKED, `FINAL-READY-VERIFICATION.md` (through 2026-08-19 addendum) | `FINAL-RELEASE-GATE.md`/`ULTIMATE-FINAL-ZERO-TRUST-AUDIT.md` (same-day, later commit) claim closed via hash comparison; **this session attempted to independently reproduce that check and was blocked by the permission classifier before reading/hashing anything** | **NOT VERIFIED THIS SESSION** — neither confirmed nor contradicted; see §7 |
| Historical `.env`/`figm-user-db.json` blobs purged from git history | `ENV_VARIABLES.md:30` instructs this as a required remediation step | Independently re-confirmed this session: **blobs are still reachable**, no rewrite ever occurred | **OPEN — DOCUMENTATION/IMPLEMENTATION MISMATCH, confirmed unremediated** (matches 3 prior audit docs' own findings) |
| Admin account on live (rotated) database | Not previously flagged (new consequence of the rotation itself) | `audit/FINAL-RELEASE-GATE.md` unchecked item #1, no later commit exists | **OPEN — NOT RESOLVED as of HEAD** |
| Cmd+K modal focus trap / Monaco accessible label / guidelines `aria-pressed` | New findings, `FINAL-RELEASE-GATE.md` (2026-08-19) | Independently re-confirmed the Cmd+K focus-trap gap this session (§16); Monaco label and `aria-pressed` not independently re-read this session | **OPEN — NOT RESOLVED as of HEAD** (focus-trap independently confirmed; other two carried forward from the prior document, not independently re-verified) |
| `source-parser.ts` syntax-error false positive on raw un-stripped source | `FINAL-RELEASE-GATE.md`, LOW | No later commit | **OPEN — NOT RESOLVED (LOW)**, not independently re-read this session |
| Real-world benchmark reproducibility | Previously closed, then `FINAL-RELEASE-GATE.md` marks it BLOCKED (network failure) | §20 of this report found a **different, more consequential** issue: the narrative docs are stale relative to the current raw data (a fix landed after the docs were written) | **STALE — NEEDS RE-VERIFICATION**, and specifically needs re-running to regenerate `SUMMARY.md`/`SPOT_CHECK.md` |
| Two live IDOR routes + committed admin credential (original) | `audit/new.md` CRITICAL → `audit/new-02.md` claims closed | §5 of this report independently reviewed all 30 routes and found no IDOR | **STILL VALID** (independently corroborated, not just documentary) |
| 678/678 tests, clean typecheck/build, 50/50 routes | `ULTIMATE-FINAL-ZERO-TRUST-AUDIT.md` (2026-08-19) claims a live run | This audit did not execute the suite (out of scope) | **NOT VERIFIED THIS SESSION** — static preconditions (file-list integrity, no `.skip`/`.only`) are STILL VALID |

**Conclusion**: `audit/FINAL-READY-VERIFICATION.md`'s title and "no other known CRITICAL or HIGH" framing are **stale** as of its own next-day successor. `audit/FINAL-RELEASE-GATE.md`'s **NEAR FINAL** verdict and 5-item open list is the most current and load-bearing prior state — this session's independent findings are consistent with treating that as the accurate baseline, with one addition (the real-world benchmark documentation staleness, §20) and one downgrade (the rotation claim cannot be independently confirmed this session, §7).

---

## 28. Complete Findings

Ranked by severity. Each finding is independently re-derived from current source by this session unless marked otherwise.

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| F-01 | **CRITICAL (unresolved status)** | Rotation of `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL`/`DIRECT_URL` is **NOT VERIFIED this session** — prior audit claims rotation confirmed via hash comparison, but this session's attempt to independently reproduce that check was blocked before reading any value. Historical blobs containing the same key names remain fully reachable in git history (never purged, despite `ENV_VARIABLES.md:30` instructing a purge). If rotation did not in fact occur, or the old Supabase project was never decommissioned (itself explicitly `NOT VERIFIED` even by the prior document), this is a live CRITICAL exposure. | §7 |
| F-02 | **HIGH (open, per most recent prior audit, not independently re-verified this session)** | No admin account exists on the live database and no application-level seeding path exists — `/admin` and all admin-only routes are inoperable in the current deployment. | `audit/FINAL-RELEASE-GATE.md` item #1; not independently re-tested this session (would require live DB access) |
| F-03 | **MEDIUM-HIGH** | Cmd+K search modal (`app/HeaderBar.tsx:354-491`) has `aria-modal="true"` but no keyboard focus trap — independently re-confirmed this session. | §16 |
| F-04 | **MEDIUM-HIGH** | `/api/submissions` bypasses `RepositoryFactory` entirely, calling `UserDB` directly; no Prisma `Submission` model exists at all. Data always persists to a local/tmp JSON file, never Postgres, regardless of `STORAGE_PROVIDER` configuration — inconsistent with the documented architecture and non-durable on serverless deployment. | `app/api/submissions/route.ts:3,14,41`; absence in `prisma/schema.prisma` |
| F-05 | **MEDIUM** | `spawnSync`-based sandbox execution blocks the entire Node.js event loop for up to 3s per scan — an availability/DoS-adjacent risk under concurrent load, not mitigated by the existing per-IP (not global) rate limit. | §9 |
| F-06 | **MEDIUM** | `require` stub in the sandbox child process (`profiler-sandbox-runner.cjs`) is trivially bypassable via a standard Function-constructor escape — the stub provides materially less defense-in-depth than a reader might assume, though no secrets are reachable regardless (§9's env-isolation finding is independent and unaffected). | §9 |
| F-07 | **MEDIUM** | `resetToken`/`resetTokenExpiry` are never actually cleared in Postgres after password reset (`{resetToken: undefined}` is a Prisma no-op) — the exact same bug class the codebase already found and fixed for `refreshToken` at logout, missed here. Bounded by a 15-minute token TTL. | `app/api/auth/reset-password/route.ts:46-50` |
| F-08 | **MEDIUM** | `UserDB` contains its own redundant, fire-and-forget, error-swallowing raw Supabase mirror writes independent of and potentially inconsistent with `SupabaseStorageProvider` — reachable in a specific storage-fallback misconfiguration state. | `src/auth/user-db.ts:310-328,345-360,458-485` |
| F-09 | **MEDIUM** | Monaco code editor has no accessible label (screen-reader users tabbing into live-scan get an unlabeled control). | `audit/FINAL-RELEASE-GATE.md` item #3; not independently re-read this session |
| F-10 | **MEDIUM** | Real-world benchmark narrative documents (`SUMMARY.md`, parts of `METHODOLOGY.md`/`SPOT_CHECK.md`) are stale relative to current raw data: they headline 268 findings dominated by a since-fixed FIGM-REACT-03 false-positive pattern (153/268); current raw results show 114 findings with zero such hits. Not caught by at least one prior audit pass. | §20 |
| F-11 | **LOW-MEDIUM** | `/api/export-dissertation` has no rate limit despite its own code comment acknowledging a disk-write abuse concern. | `app/api/export-dissertation/route.ts` |
| F-12 | **LOW** | README.md's "71 test suites" claim is not corroborated by static analysis (47 `describe()` blocks, 54 files) — unsupported pending a live test run this audit was not permitted to perform. | §18, §23 |
| F-13 | **LOW** | `HeaderBar.tsx:326-332` hardcodes the literal text "LOGIN" as the profile display name regardless of actual signed-in user identity. | §15 |
| F-14 | **LOW** | ~20 of ~30 data-fetching pages show no `role="status"`/`aria-live`/`role="alert"` usage despite having loading/error state. | §16 |
| F-15 | **LOW (not fully confirmed)** | Framework selector dropdown in `HeaderBar.tsx` has no observable downstream consumer in the files read — possibly non-functional. | §15 |
| F-16 | **LOW** | React fallback framework detection (`source-parser.ts:474-482`) uses unanchored substring matching, a residual (previously undocumented) misclassification risk. | §10 |
| F-17 | **LOW** | FIGM-NEXT-01's rule-catalog metadata lists `REACT_JSX` as a supported framework, but the implementation only ever produces a candidate for `NEXT_JS` — a metadata/implementation mismatch, not a detection bug. | §12 |
| F-18 | **LOW** | FIGM-REACT-01's namespace-receiver exclusion introduces an undocumented new false-negative risk for PascalCase-named plain array variables. | §12 |
| F-19 | **LOW** | `source-parser.ts`'s own syntax-error detector reads raw un-stripped source; a comment/string containing `<<<`/`INVALID_SYNTAX` can trigger a false `SYNTAX-PARSE-ERROR`. | `audit/FINAL-RELEASE-GATE.md` item #4; not independently re-read this session |
| F-20 | **LOW** | Guidelines-page filter buttons convey active state by color only, no `aria-pressed`/`aria-current`. | `audit/FINAL-RELEASE-GATE.md` item #5; not independently re-read this session |
| F-21 | **LOW/INFORMATIONAL** | `figm-spec.json` (a generated artifact) is tracked in git and can silently drift from source truth if not regenerated before commit. | §2 |
| F-22 | **LOW/INFORMATIONAL** | 4 files under gitignored `scratch/` remain tracked from before the ignore rule existed; content not inspected. | §2 |
| F-23 | **INFORMATIONAL** | `SupabaseAuthService` (`src/auth/supabase-auth.ts`) appears to have no call sites among the reviewed auth routes — possible dead code, not confirmed via full-repo grep. | §5 |
| F-24 | **INFORMATIONAL** | `/api/report` GET is unauthenticated with no documented rationale, unlike other intentionally-public routes — looks like a legacy/demo endpoint. | §5 |
| F-25 | **INFORMATIONAL** | No network egress restriction on the DynamicProfiler sandbox child — submitted code could make outbound requests within the ≤3s window before timeout. | §9 |
| F-26 | **PLANNED — NOT COMPLETED** | Human usability study and independent annotation: 0 real participants, 0 real annotations, no in-repo evidence of formal ethics-board/IRB approval (not proof none exists). | §22 |

### Positive / FIXED AND VERIFIED items worth preserving
JWT/refresh-secret fail-closed validation; scrypt password hashing with safe legacy migration; role-claim allow-listing on JWT sign+verify; correct refresh-token revocation at logout; no self-registration ADMIN escalation; no hardcoded admin bootstrap password; real cascading account deletion on both storage backends (including scan-source snippets); no IDOR found across all 30 API routes; genuinely separate-OS-process sandboxed execution with secret-free environment and hard OS-level timeout (a real fix for the previously-CRITICAL in-process execution bug); DynamicProfiler async-rejection handling that cannot crash the server; production security headers (CSP/HSTS/X-Frame-Options/Permissions-Policy) genuinely present and reasoned; remediation engine's `validatePatch` genuinely prevents false-success reporting for both deterministic and AI paths; controlled benchmark P/R/F1 independently recomputed and matched exactly; PRIVACY.md's cascade-delete claims fully corroborated against the schema; strong, self-documented anti-fabrication discipline (dedicated `anti-hardcoding-guard.test.ts`, `RESEARCH_TRACEABILITY_MATRIX.md`'s own self-corrections); no `.skip`/`.only`/silently-excluded tests anywhere in the 54-file suite; honest disclosure of incomplete research status (human study, independent annotation) rather than fabricated substitutes.

---

## 29. Final Examiner Simulation

1. **Exact research contribution?** A rule-engineering methodology for framework-aware static-analysis detection that mixes real-AST (TypeScript compiler) and legacy text-heuristic detection paths per rule×framework combination, with an honest per-finding provenance label (`sourceKind`), plus an empirically-benchmarked subset (8/25 rules, controlled testbed) and a documented (not-yet-ground-truthed) real-world evaluation on 5 public repositories.
2. **Exact software contribution?** A working multi-tenant Next.js/Postgres SaaS application implementing that engine end-to-end: auth, scan pipeline, sandboxed execution, deterministic + optional-AI remediation with re-scan verification, and a research-data-collection subsystem — all independently confirmed reachable and wired, not scaffolding.
3. **Truly framework-independent?** No. Vue (0/25 rules real-AST) and 2 Angular rules are always legacy-only; 9 of the 23 real-AST rules are React/Next-only. Framework-independence is a partial, honestly-disclosed property, not a blanket claim the code supports.
4. **Fully AST-based?** No, and the project does not claim this — 23/25 rules have a real-AST path for at least one framework; 2 (ANG-03/04) are always regex-based; Vue is 0/25 real-AST by construction.
5. **What is the 23/25 claim actually describing?** That 23 of 25 rules have at least one framework for which detection walks a genuine `ts.SourceFile` AST rather than a line-heuristic. It does not mean 23/25 rules are real-AST for every framework they claim to support — only 14/23 extend to Angular's class body, and 0 extend to Vue.
6. **Why is Vue different?** `@vue/compiler-sfc` was never added as a dependency; a `.vue` SFC's `<template>` block is not valid TypeScript, so `ts.createSourceFile` cannot meaningfully parse it — a scoping decision, confirmed by a hard `canAttemptRealAstParse` exclusion in code, not an oversight.
7. **Which rules are regex-only?** FIGM-ANG-03, FIGM-ANG-04 (always); all 25 rules are regex-only for Vue and Svelte; 9 additional rules are regex-only for Angular's class body.
8. **How was ground truth established?** A synthetic, hand-authored 147-LOC testbed with an itemized `ground-truth.json` (19 expected violations across 8 rules) — spot-checked and confirmed concrete/specific, not generic placeholders. It is not derived from real-world code, and covers under a third of the rule catalog.
9. **Is the 95% F1 generalizable?** No, and the project's own documents do not claim it is — it is scoped to 8/25 rules on a 147-LOC synthetic testbed. The 5-repo real-world evaluation explicitly has no ground truth and reports no aggregate P/R/F1.
10. **Was real-world evaluation genuine?** Yes as data collection (real repos, real commit SHAs, real raw findings) — but its narrative interpretation documents are currently stale relative to the underlying data (§20), and should be regenerated before being cited.
11. **Was human usability actually measured?** No. `validParticipantCount: 0`, explicitly and machine-recorded as such.
12. **Was independent annotation actually completed?** No. `STATUS.md` states explicitly no annotator has submitted anything; infrastructure exists, real data does not.
13. **Is user data isolated?** Architecturally yes at the query/route layer (independently confirmed across all 30 routes, no IDOR found), with two residual defects (F-04, F-07) that are data-consistency/cleanup bugs, not cross-tenant leakage.
14. **Is arbitrary user code safely handled?** Partially. The current architecture (separate OS process, secret-free env, hard timeout, capped heap) is a real and effective fix for the previously-CRITICAL in-process execution risk, but it is not a true sandbox (escapable `require` stub, no network restriction, and a real event-loop-blocking availability risk under concurrent load).
15. **Is AI active?** Implemented and wired into the live app path, but not configured (no `GEMINI_API_KEY`) in this environment — cannot be verified as active in any deployed environment from this audit.
16. **Biggest limitations?** (a) Rotation status of the historically-exposed Supabase credentials could not be independently verified this session; (b) admin functionality is currently inoperable on the live database per the project's own most recent audit; (c) empirical validation covers 8/25 rules on synthetic data only; (d) human study and independent annotation are entirely uncompleted; (e) sandbox isolation is partial, not a true sandbox.
17. **What claims should NOT be made in a viva?** "95% F1 across all 25 rules" (it's 8/25, synthetic); "23/25 real-AST" without the Vue/Angular caveat; "268 real-world findings, mostly FIGM-REACT-03 false positives" (stale — current data shows 114, zero); "678 tests / 71 test suites" without having personally run `npm test` first; "fully sandboxed execution" (it is process-isolated, not OS-sandboxed); "Supabase credentials rotated" as a settled fact (this audit could not independently confirm it).
18. **What would prevent production deployment today?** The unresolved admin-account/seeding gap (F-02, makes `/admin` inoperable), the unverified secret-rotation status (F-01, if false would be an active CRITICAL), and the `spawnSync` event-loop-blocking concurrency risk (F-05) under real multi-user load.

---

## 30. Final Scorecard

| Dimension | Status |
|---|---|
| Research Integrity | **PASS WITH MINOR ISSUES** — documented, self-corrected fabrication history; active anti-fabrication test guard |
| Research Methodology | **PASS WITH MINOR ISSUES** — sound where applied, but ground truth covers 8/25 rules only |
| Research Validity | **NEEDS IMPROVEMENT** — human study and independent annotation entirely uncompleted; real-world eval lacks ground truth (by design, disclosed) |
| FIGM Contribution | **PASS WITH MINOR ISSUES** |
| Static Analysis | **PASS WITH MINOR ISSUES** |
| AST Architecture | **PASS** (independently re-derived and matches documented claims) |
| Rule Engine | **PASS WITH MINOR ISSUES** (F-16, F-17, F-18) |
| Framework Detection | **PASS WITH MINOR ISSUES** (F-16) |
| Live Scan | **PASS** |
| User Product | **PASS WITH MINOR ISSUES** (F-02 admin gap, F-04 submissions bypass) |
| Database | **PASS** |
| Authentication | **PASS WITH MINOR ISSUES** (F-07) |
| Authorization | **PASS** (no IDOR found across 30 routes) |
| Security (secrets/history) | **NEEDS IMPROVEMENT** (F-01 unresolved rotation-verification status; unpurged git history) |
| Untrusted Code Execution | **PASS WITH MINOR ISSUES** (real fix for the prior CRITICAL; F-05, F-06, F-25 residual) |
| QA | **PASS WITH MINOR ISSUES** (F-12 unverified test-count claim; not exhaustively spot-checked) |
| Accessibility | **NEEDS IMPROVEMENT** (F-03, F-09, F-14, F-20; no conformance audit evidence) |
| Performance | **NOT VERIFIED** for anything requiring live measurement; source-level checks PASS |
| AI | **PASS WITH MINOR ISSUES** (implemented and safe; not verified active in any deployment) |
| Privacy | **PASS** (fully corroborated against schema) |
| Documentation | **PASS WITH MINOR ISSUES** (F-10, F-12, and the FINAL-READY-VERIFICATION.md trajectory contradiction) |
| Production Readiness | **NEEDS IMPROVEMENT** (F-01, F-02, F-05) |

---

## 31. Final Verdict

# NEAR FINAL

**Not FINAL-READY.** This verdict is consistent with, and independently re-derived rather than copied from, this repository's own most recent prior audit (`audit/FINAL-RELEASE-GATE.md`).

Per this audit's own required standard, FINAL-READY requires that no CRITICAL or HIGH finding remains and all major claims are supported. That standard is not met:

- **F-01 (rotation-verification status unresolved)** is classified CRITICAL-if-false and this session could not rule out "false" — the governing instruction not to trust a commit-message-level claim applies directly here.
- **F-02 (no admin account/seeding path)** is a currently-open HIGH-severity operational gap per the project's own most recent audit, not independently re-testable in a read-only session.
- Several MEDIUM findings (F-03 through F-09) represent real, currently-unresolved defects, none individually blocking but collectively indicating the project is close to, not at, a defensible production state.

### Exact Remaining Blockers (in priority order)

1. **Independently verify `SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_URL`/`DIRECT_URL` rotation** with a session that has permission to perform the hash-comparison check (or, preferably, verify directly against the Supabase dashboard's credential-issuance log) — this audit was blocked from doing so. Until resolved, treat the historically-exposed credential as potentially still live.
2. **Confirm decommission of the old (pre-rotation) Supabase project** — explicitly unresolved even in the prior audit's own text.
3. **Create an admin account / build a seeding path** on the live database — `/admin` and every admin route are currently inoperable.
4. **Purge the historical `.env`/`figm-user-db.json` blobs from git history** (e.g. `git filter-repo`) as `ENV_VARIABLES.md` itself already instructs but has never been executed — independent of whether current credentials are rotated, this closes a standing exposure surface.
5. **Add a keyboard focus trap to the Cmd+K search modal** (F-03).
6. **Add an accessible label to the Monaco editor** (F-09, not independently re-verified this session but carried forward as open).
7. **Fix the resetToken/resetTokenExpiry Postgres no-op bug** (F-07) — same fix pattern already applied to `refreshToken`.
8. **Route `/api/submissions` through `RepositoryFactory`, or add a real `Submission` Prisma model** (F-04).
9. **Re-run the real-world benchmark and regenerate `SUMMARY.md`/`SPOT_CHECK.md`** before citing the FIGM-REACT-03/268-finding figures anywhere (F-10) — the underlying tool has already improved past what those documents describe.
10. **Address the `spawnSync` event-loop-blocking concurrency risk** (F-05) — e.g. via a worker pool or async spawn, before exposing the scan endpoint to meaningful concurrent load.
11. Lower priority: F-06 (require-stub hardening), F-08 (redundant Supabase mirror writes), F-11 through F-25.
12. Human usability study and independent annotation remain `PLANNED — NOT COMPLETED` — not a blocker for software production-readiness, but a blocker for any research claim beyond what is currently, honestly documented.

None of items 3, 5–8 require new architecture — they are narrow, targeted fixes to existing, working code. Items 1, 2, 4, and 9 require action outside this session's read-only scope (credential verification, git-history rewriting, and a benchmark re-run) but not new feature work.
