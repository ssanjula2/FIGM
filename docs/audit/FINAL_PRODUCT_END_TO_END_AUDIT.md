# FIGM — Final Product End-to-End Audit

Date: 2026-09-06
Scope: the actual current product implementation (code + tests), not ts modified, nothing was committed or pushed.
Working tree note: at audit time there were ~19 uncommitted local modifications (thesis-export
pipeline files: `src/eval/evaluation-runner.ts`, `src/eval/thesis-gap-exporter.ts`, two research
tests, and several regenerated report/benchmark artifacts) left over from separate, concurrenthesis documents, not
---

## 1. Executive Summary

FIGM is a genuinely substantial, mostly-real static-analysis product: a 50-rule catalog with real
AST-based detection (Babel/TypeScript for React/Next/generic JS, `angular-html-parser` for Angular
templates, `@vue/compiler-sfc`/`@vue/compiler-dom` for Vue SFCs), a three-tier remediation
architecture (deterministic AST fixers → AI-assisted, provider-abstracted, sandbox-validated →
manual-review-only), a real Prisma/Supabase-backed multi-tenant SaaS shell (auth, dashboards,
admin, research-participant workflow), and a 1,526-test automated suite that passed cleanly at
audit time. Security fundamentals (CORS, CSP, rate limiting, RBAC, IDOR checks, JWT revocation via
`tokenVersion`) are implemented with real, working-as-designed logic, not just comments claiming so.

The most significant findings are: (1) the production dependency tree carries 9 known
vulnerabilities including ~20 Next.js advisories only fixed by a major-version upgrade (Next 14 →
16) — a real, unaddressed supply-chain risk; (2) the VS Code extension does **not** run the
canonical FIGM engine — it is a separate, much simpler line-text-heuristic reimplementation
covering only 5 of 50 rules, despite an internal comment calling it "AST rule pattern detection";
(3) local-Ollama AI remediation is architecturally correct but genuinely cannot run on Vercel
without a self-hosted, publicly-reachable bridge — a deployment constraint, not a bug, but one a
reader could easily miss; (4) the CI test-database isolation and research-data range guard, both
recently hardened, are confirmed intact and passing. No P0 (critical security / data-loss /
research-integrity blocker) was found in the current code.

---

## 2. Architecture Map

### Frontend (`app/`)
32 page routes. Key groupings, by evidence (`Glob app/**/page.tsx`):
- **Public/marketing:** `/`, `/about`, `/methodology`, `/references`, `/guidelines`.
- **Auth:** `/login`, `/register`, `/forgot-password`, `/auth/login`, `/auth/register`,
  `/auth/forgot-password`, `/auth/reset-password` (both a top-level stub and canonical `/auth/*`
  implementation exist for each — middleware redirects between them based on session state).
- **Core product:** `/live-scan` (the scanner UI), `/history`, `/projects`, `/diagnostics`,
  `/diagnostics/[id]`, `/reports/[id]`, `/profiler`, `/performance`, `/accessibility`.
- **Account:** `/profile`, `/settings`, `/notifications`.
- **Admin:** `/admin` (tabbed dashboard: Overview/Users/Participants/Scans/Research/Frameworks/
  Rules/Website Analytics/Audit/Health), `/admin/profile`, `/admin/participants/[participantId]`.
- **Research:** `/user-study` (the real participant-facing scan flow — see §6 of
  `docs/audit/CURRENT_HUMAN_STUDY_COLLECTION_PATH_AUDIT.md`, already audited this session),
  `/analytics`, `/rq1-experiment` + 4 fixture sub-pages (isolated Lighthouse measurement targets,
  intentionally excluded from the auth gate — see middleware.ts).

### Backend
- **API routes:** `app/api/**/route.ts`, 37 total — full inventory in §3 below.
- **Auth layer:** `src/auth/auth-service.ts` (JWT sign/verify, password hashing, secret
  resolution with fail-closed production checks), `src/auth/auth-middleware.ts`
  (`authenticateUser`/`authorizeRole`, tokenVersion revocation check), `src/auth/rate-limiter.ts`
  (DB-backed, X-Forwarded-For last-hop trust model), `middleware.ts` (page-level auth-by-default
  redirect + CORS).
- **Repositories:** `src/engine/*-repository.ts` (scan, project, user, participant, submission,
  notification, settings, research, rule-analytics, dashboard) — all route through
  `RepositoryFactory` (`src/storage/repository-factory.ts`), which selects
  `SupabaseStorageProvider` (Prisma+pg) or `JsonStorageProvider` (local file) based on configured
  credentials, never silently in production.
- **Rule execution:** `src/engine/rule-execution-engine.ts` (orchestrator), `src/matrix/*`
  (canonical 50-rule catalog), `src/ast/*` (AST builders), `src/parser/source-parser.ts`
  (framework detection + parsing), `src/analysis/*` (TypeScript compiler service, complexity).
- **Remediation pipelines:** `src/engine/ast-fix-engine.ts` +
  `angular-template-fix-engine.ts`/`vue-fix-engine.ts` (deterministic), `src/ai/*` (AI-assisted,
  provider-abstracted, sandbox-validated — see §12/§13).
- **AI provider abstraction:** `src/ai/ai-provider-selector.ts`,
  `src/ai/providers/{claude,gemini,ollama}-provider.ts`.
- **Reporting/export:** `src/reporter/report-generator.ts`, `app/api/export`,
  `app/api/export-dissertation`, `app/api/admin/research-dataset` (CSV/JSON).
- **Audit logging:** `src/auth/audit-logger.ts`, backed by the `audit_logs` Postgres table (also
  double-duty as the rate-limiter's shared counter).
- **Rate limiting:** `src/auth/rate-limiter.ts` — see above.

### Persistence
- **Prisma** (`prisma/schema.prisma`): `User`, `Project`, `ScanReport`, `Notification`,
  `AuditLog`, `Settings`, `ApiKey`, `SavedReport`, `ResearchEvaluation`, `AiHistory`,
  `ExportHistory`, `Submission` models. Research-participant fields
  (`participantCode`/`researchStatus`/`researchAssignedAt`/`researchConsentVerifiedAt`) live
  directly on `User`, not a separate table.
- **Supabase**: the deployed production backend via `@prisma/adapter-pg` + `pg.Pool`
  (`src/db/prisma-client.ts`), never the raw `@supabase/supabase-js` client for primary CRUD (that
  package is used only for the legacy dual-write side-channel in `user-db.ts`, now guarded — see
  §4, §30).
- **Local JSON fallback**: `src/storage/json-storage-provider.ts` / `src/auth/user-db.ts`
  (`figm-user-db.json`), used for local dev without Supabase credentials and unconditionally for
  automated tests (hardened this repository's own P0 pass — see
  `docs/audit/PRE_STUDY_DATA_INTEGRITY_FINAL.md`).
- **Research dataset storage**: no separate table — derived at read time from `User` +
  `ScanReport` by `ParticipantRepository.getResearchDataset()`.
- **Audit/event storage**: `AuditLog` table, `src/auth/audit-logger.ts`.

### Developer tooling
- **CLI**: `src/cli/{index,figm-analyze,serve}.ts`, packaged as `bin/figm-analyze.js` →
  `dist/src/cli/figm-analyze.js` (a committed, pre-built `dist/` exists — see §23).
- **VS Code extension**: `vscode-extension/` (`extension.ts`, `diagnostics-provider.ts`,
  `hover-provider.ts`, `quickfix-provider.ts`, `commands.ts`, `status-bar.ts`, `rules-data.ts`),
  packaged as `figm-code-inspector-1.0.0.vsix`. **Does not share the canonical engine** — see §24.
- **Benchmark/evaluation tooling**: `src/eval/*`, `benchmarks/`, `research/rq1-experiment/`,
  `research/independent-annotation/`.

### Call-flow maps (evidence-traced)

**A. Normal scan** — Client (`/live-scan`) → `POST /api/scan` → rate limit (per-IP, 60/min for
plain scans) → `RuleExecutionEngine.analyzeFileAsync` (parse → framework detect → AST rules →
TypeScript compile check → dynamic profiling via sandboxed child process → diagnostics + quality
score) → optional `ScanRepository.createScanRecord` if authenticated (persistence failure is
non-fatal, surfaced as a distinct `INFRASTRUCTURE_ERROR`, never silently dropped) → JSON response.

**B. AI-assisted fix** — Client clicks Fix → `POST /api/scan` with `action: 'fix-figm-rule' |
'fix-code-error'` → tighter per-IP AND per-client-fingerprint rate limit (15/min, anonymous-safe)
→ `AIRemediationPipeline.remediateDefect` → staleness guard (rejects a fix request against
drifted source) → `decideRemediation` picks exactly one of: AST deterministic fixer (if the rule
ID is in `SUPPORTED_RULE_IDS`) → AI provider (`AIProviderSelector.getActiveProvider()`, bounded 3
attempts, sandbox-validated, re-scanned) → MANUAL_REVIEW (no patch attempted). Never a 4th path,
never a legacy regex-templated fallback (`remediation-engine.ts` exists but is never invoked from
this pipeline).

**C. User login** — `POST /api/auth/login` → password verify (bcrypt-class hashing in
`auth-service.ts`) → JWT signed with current `tokenVersion` → httpOnly-equivalent cookie/localStorage
token → subsequent requests carry `Authorization: Bearer` or `figm_token` cookie →
`authenticateUser` verifies signature+expiry+tokenVersion on every request.

**D. Admin request** — Any `/api/admin/*` route → `authorizeRole(request, ['ADMIN'])` (confirmed
on all 11 admin route files, no exceptions found) → 401/403 on failure, never a client-side-only
gate (the admin UI's own role check is explicitly commented as "purely a UX shortcut," not the
real boundary).

**E. Research participant scan** — `/user-study` → `GET /api/user-study/log-scan` issues a
signed, session-scoped, anonymous participant JWT (`figm_study_token`, distinct `kind` claim,
cannot authenticate as a real user — a previously-found and fixed confused-deputy bug) →
`assignNewParticipant()` mints next `P001..P020` slot → consent checkbox →
`POST /api/user-study/consent` re-signs the token with `consentGiven` → `POST
/api/user-study/log-scan` re-runs the real engine server-side and persists under the participant's
real `User.id`.

**F. Research dataset export** — `GET /api/admin/research-dataset` (ADMIN-gated) →
`ParticipantRepository.getResearchDataset()` (the sole eligibility authority: real P001-P020 range
+ `CONSENT_VERIFIED` + post-consent timestamp + REVOKED exclusion) → PRIMARY/SECONDARY attempt
tagging → JSON or CSV.

---

## 3. API Route Inventory

37 route files under `app/api/`. Method-level detail for every route was not individually
re-verified line-by-line in this pass where it duplicates prior, already-verified audit work in
this same session (research/admin routes — see `docs/audit/CURRENT_HUMAN_STUDY_COLLECTION_PATH_AUDIT.md`
and `PRE_STUDY_DATA_INTEGRITY_FINAL.md`); every route listed below was at minimum confirmed to
exist and its top-level auth gate (or explicit absence) was checked directly.

| Path | Auth | Role | Rate limited | DB write | Notes |
|---|---|---|---|---|---|
| `/api/auth/login` | none (public) | — | yes (login-specific) | yes (lastLogin) | credential entry point |
| `/api/auth/register` | none (public) | — | yes | yes | |
| `/api/auth/logout` | required | — | — | yes (tokenVersion bump) | real revocation |
| `/api/auth/refresh` | refresh-token-based | — | — | possibly | |
| `/api/auth/me` | required | — | — | no | |
| `/api/auth/forgot-password` | none (public) | — | yes | yes (reset token) | |
| `/api/auth/reset-password` | token-based | — | yes | yes | |
| `/api/auth/audit-logs` | required | (self-scoped) | — | no | |
| `/api/scan` | optional (anonymous scans allowed) | — | yes (60/min scan, 15/min fix, +fingerprint) | yes if authed | core scanner, confirmed §2 |
| `/api/scans` | required | — | — | list | |
| `/api/scans/[id]` | required | owner-or-admin | — | GET/PATCH/DELETE | confirmed ownership check §15 |
| `/api/report` | required | — | yes (10/min) | no | shared/static report, not per-user (§15) |
| `/api/export`, `/api/export-dissertation` | required | — | yes (dissertation export has its own dedicated rate-limit test) | no | |
| `/api/submissions` | required | — | — | yes | |
| `/api/projects`, `/api/projects/[id]`, `/api/projects/[id]/duplicate` | required | owner-or-admin | — | yes | |
| `/api/profile`, `/api/settings`, `/api/notifications` | required | self | — | yes | |
| `/api/search` | required | — | — | no | |
| `/api/health` | none (public) | — | — | no | includes Ollama health check, no secrets |
| `/api/dashboard/*` (frameworks/reports/statistics/activity/summary) | required | self-scoped | — | no | |
| `/api/user-study/log-scan`, `/api/user-study/consent` | anonymous, session-cookie-scoped | — | yes (30/min) | yes | audited in depth this session |
| `/api/research-metrics` | none (public) | — | — | no | intentionally public (evidence for reviewers) |
| `/api/admin/*` (participants, participants/[id], scans, users, system, rule-stats, analytics/website, research-dataset) | required | **ADMIN only** | admin routes generally unthrottled beyond global auth | yes (participants/users) | 11 files, all confirmed `authorizeRole(['ADMIN'])`, no exceptions |

```
TOTAL_API_ROUTES=37
PUBLIC_ROUTES=5  (login, register, forgot-password, health, research-metrics)
AUTHENTICATED_ROUTES=21
ADMIN_ROUTES=11
WRITE_ROUTES=~20
HIGH_RISK_ROUTES=1  (see finding D-01 below — /api/report's shared, unscoped fallback-scan path)
```

**Flags:**
- No unauthenticated sensitive endpoint found (health/research-metrics are public by deliberate,
  documented design and expose no per-user or credential data).
- No internal/debug/migration endpoint reachable over HTTP was found (`scripts/migrate-json-to-supabase.ts`
  etc. are CLI-only, never wired to a route).
- No admin endpoint found without role enforcement.
- `/api/report`'s fallback path re-runs a full recursive scan of `samples/sample-spa` on every
  request when `figm-scan-report.json` is absent — rate-limited (10/min) but still real,
  authenticated-account-triggerable compute cost; not a security hole, a minor cost/DoS-adjacent
  design note (D-01, P3).
- CORS: explicit allow-list only, no wildcard, no credentialed CORS (§15) — not overly permissive.
- Body-size enforcement: `/api/scan` explicitly caps at 500KB; not every route was individually
  checked for an equivalent cap (see §14 finding).

---

## 4. Authentication / Authorization Audit

Traced directly from `src/auth/auth-service.ts`, `auth-middleware.ts`, `middleware.ts`,
`rate-limiter.ts`.

- **Login/logout**: password hashing present (not double-checked against a specific bcrypt cost
  factor in this pass, but hashing — not plaintext — is used); logout bumps `tokenVersion` in the
  DB, which `authenticateUser` checks on every subsequent request — this is what makes logout
  actually revoke an already-issued, still-unexpired access token, a documented and tested fix
  (not just a comment claiming it — the check is a real, present 3-line comparison in
  `auth-middleware.ts:76`).
- **Session/cookie handling**: dual-mode — `Authorization: Bearer` header (primary, used by the
  admin/app SPA via localStorage) or a `figm_token` cookie fallback, checked in that order.
  `middleware.ts` uses the cookie for its page-level redirect gate; API routes independently
  re-verify via `authenticateUser`, so a page-level bypass alone cannot reach protected data.
- **Token signing/verification**: `verifyJWT` explicitly rejects any token carrying a `kind` claim
  (a `refresh` or `research_participant` token) from authenticating as a real user — this is a
  real, previously-found-and-fixed confused-deputy bug (see `docs/audit/CURRENT_HUMAN_STUDY_COLLECTION_PATH_AUDIT.md`),
  confirmed still present in current `auth-service.ts`.
- **Role checks**: `authorizeRole` is a thin, correct wrapper over `authenticateUser` plus an
  array-inclusion check — no route was found bypassing it for an admin-only action (§3).
  Admin-UI role display is explicitly commented as UX-only, not the real boundary.
- **Rate limiting on auth**: DB-backed (`audit_logs`-derived count), with an in-process fallback
  only when Postgres is unreachable (logged, not silent). Login/register/forgot-password all call
  `checkRateLimit`.
- **CSRF-relevant behavior**: the app's real auth transport is `Authorization: Bearer` from
  localStorage, not automatic cookie-based credentialed requests — CORS never sets
  `Access-Control-Allow-Credentials`, closing the classic CSRF-via-cross-site-cookie vector by
  construction (documented explicitly in `src/lib/cors.ts`). The `figm_token` cookie fallback path
  does exist and is not `SameSite`/`httpOnly` hardening-verified in this pass — flagged as a gap
  to close off definitively (finding D-02, P3, since the primary auth path doesn't rely on it).
- **IDOR / ownership**: `app/api/scans/[id]/route.ts` checks `existing.userId !== auth.user.userId`
  (unless ADMIN) on every handler — confirmed directly, not assumed. Participant/admin boundary is
  enforced via the separate `kind`-claim JWT check above, not just a role field.

```
AUTH_MODEL=JWT (HMAC-signed, tokenVersion-revocable), Bearer-header primary / cookie fallback
SESSION_MODEL=Stateless JWT + DB-checked revocation counter (tokenVersion)
ADMIN_AUTHZ=PASS
OBJECT_LEVEL_AUTHZ=PASS (confirmed on scans; not individually re-verified on every one of the ~20 write routes in this pass — see limitation note)
COOKIE_SECURITY=PARTIAL (Secure/SameSite/HttpOnly flags on figm_token were not directly re-verified this pass; Bearer-header path, the primary mechanism, has no cookie exposure at all)
RATE_LIMIT_AUTH=PASS
```

---

## 5. Database / Data Access Audit

`prisma/schema.prisma` models confirmed: `User` (with the four research-participant fields,
`accountType` for engineering-test provenance, `tokenVersion`, unique `email`/`participantCode`/`apiKey`),
`Project`, `ScanReport` (cascade-deletes with `User`, `SetNull` on `Project` deletion),
`Notification`, `AuditLog` (`SetNull` on user deletion — audit history survives account deletion,
by design), `Settings`, `ApiKey`, `SavedReport`, `ResearchEvaluation`, `AiHistory`,
`ExportHistory`, `Submission`.

- **Uniqueness**: `User.email`, `User.participantCode`, `User.apiKey` all `@unique` in Postgres.
- **Cascade behavior**: `ScanReport`/`Project`/`Notification`/`Submission` → `onDelete: Cascade`
  on their `User` relation (deleting a user removes their data); `AuditLog` → `onDelete: SetNull`
  (preserves the log row, nulls the actor) — a deliberate, correct choice for audit integrity.
- **Direct Supabase writes bypassing the repository abstraction**: found and already remediated
  this session — `src/auth/user-db.ts` had three fire-and-forget `@supabase/supabase-js` sync
  calls (`users` upsert/update, `scan_reports` insert) that ran independent of
  `RepositoryFactory`'s provider selection whenever Supabase env vars happened to be present. Now
  guarded by `isSupabaseSyncAllowed()` (disabled under `NODE_ENV=test`) — confirmed present in
  current code (`user-db.ts:166,375,410,523`). This remains architecturally unusual (a legacy
  dual-write path) even though it's now safe under test; see finding D-03 (P2) — it should
  arguably be removed entirely now that `SupabaseStorageProvider`/Prisma is the sole intended
  write path, rather than kept "safe."
- **Service-role key on client side**: `SUPABASE_SERVICE_ROLE_KEY` is referenced only in
  server-side files (`user-db.ts`'s sync block, `supabase-storage-provider.ts` indirectly via
  Prisma's connection string, `ga4-admin-reporting.ts`) — no `NEXT_PUBLIC_` prefix on it anywhere,
  and no client-component import path was found reaching it.
- **Test-DB isolation**: confirmed intact this pass — `tests/test-env-setup.mjs` calls
  `assertSafeTestDatabaseEnvironment()` (`src/db/db-safety-guard.ts`) before any test loads,
  aborting the whole run if a hosted Supabase URL is detected under `NODE_ENV=test`; verified
  end-to-end in the prior session pass (real credentials → immediate abort, no DB touched).
- **Duplicate participant codes**: impossible in Postgres (`@unique` on `participantCode`);
  possible (and previously observed) in the local JSON test-storage backend, which is why several
  test files now purge-before-create — a JSON-fallback-only artifact, never reachable in
  production.
- **N+1 queries**: `getMatrix()` was previously N+1 (one `getSubmissionsByUserId` call per
  participant row) and was fixed to a single batched `'all_users'` sentinel call — confirmed via
  `tests/participant-matrix-n-plus-1.test.ts`, which asserts `callCount === 1`. No other clear N+1
  pattern was found in the repositories inspected (`dashboard-repository.ts` calls
  `getSubmissionsByUserId` twice total, both single calls, not in a loop).
- **Unbounded queries / missing pagination**: `provider.getScanRecords()` (no args) fetches ALL
  scan rows — used by `getResearchDataset()` and a few admin aggregates. At current scale (~30
  users, ~1,100 scans per the live-DB audit earlier this session) this is not yet a problem, but
  it is an unbounded `SELECT *`-style read with no pagination, and will not scale indefinitely
  (finding D-04, P3 — design limitation more than a bug at current scale).

```
DB_PROVIDER_ARCHITECTURE=RepositoryFactory abstraction over SupabaseStorageProvider(Prisma+pg)/JsonStorageProvider, credential-gated selection
PRODUCTION_DB_SAFETY=PASS (fail-closed provider selection outside dev/test; live DB independently verified clean this session)
TEST_DB_ISOLATION=PASS (confirmed intact, guard verified live)
SERVICE_ROLE_BOUNDARY=PASS
DUPLICATE_RECORD_RISK=LOW (Postgres-enforced in production; JSON-fallback-only risk in tests, already mitigated in test code)
N_PLUS_ONE_RISKS=0 confirmed-open (1 historical instance found and already fixed, regression-tested)
```

---

## 6. Research Data Safety Audit

This was the direct subject of extensive work earlier in this session
(`docs/audit/PRE_STUDY_SYNTHETIC_DB_RESIDUE_AUDIT.md`, `PRE_STUDY_DATA_INTEGRITY_FINAL.md`,
`CURRENT_HUMAN_STUDY_COLLECTION_PATH_AUDIT.md`). Re-confirmed present in current code, not merely
re-cited from memory:

- `isRealStudyParticipantCode()` (`src/engine/participant-repository.ts:42`) — present, derived
  from `HUMAN_STUDY_TARGET_PARTICIPANTS` (=20), rejects non-canonical padding and out-of-range
  codes.
- `getResearchDataset()`'s eligibility filter uses `isRealStudyParticipantCode(...) &&
  researchStatus === 'CONSENT_VERIFIED' && !!researchConsentVerifiedAt` — confirmed present.
- Post-consent timestamp gate: `scan.createdAt >= consentVerifiedAt`, confirmed in the same
  method.
- REVOKED exclusion falls out of the single inclusion rule (not a special case) — confirmed.
- PRIMARY/SECONDARY: earliest eligible `(userId, fileName)` pair tagged PRIMARY, rest SECONDARY —
  confirmed, with dedicated regression coverage (`tests/repeated-scan-attempt-policy.test.ts`,
  `tests/research-dataset-range-guard.test.ts`).
- Participant assignment race conditions: `assignNewParticipant()` uses create-then-retry-on-P2002
  under concurrent requests, picks the smallest unused number (not max+1) — regression-tested in
  `tests/participant-provisioning-race.test.ts`.
- Admin consent verification: `PATCH /api/admin/participants/[participantId]` (ADMIN-gated) is the
  only path that can set `CONSENT_VERIFIED`/`REVOKED` — confirmed, never automatic.
- Export filtering/correctness: `app/api/admin/research-dataset/route.ts` is a thin pass-through
  over `getResearchDataset()` — confirmed it does not reimplement eligibility logic. CSV export
  correctly escapes commas/quotes/newlines (`csvEscape` helper, confirmed present).
- Live production database independently verified this session: 0 participant-pattern users, 0
  synthetic residue, `getResearchDataset()` returns 0 rows — matches the researcher's own reported
  state exactly.

```
RESEARCH_DATA_FILTERING=PASS
CONSENT_GATE=PASS
SYNTHETIC_DATA_EXCLUSION=PASS
PRIMARY_SECONDARY_LOGIC=PASS
PARTICIPANT_RANGE_GUARD=PASS
```

No new research-data-safety issue was found in this pass. This is the single most rigorously
audited subsystem in the codebase (three consecutive dedicated audit passes this session).

---

## 7. Static Analysis Engine Audit

Traced pipeline, confirmed by reading `rule-execution-engine.ts` directly (not assumed from
comments):

```
SOURCE
 → SourceParser.detectFramework (real syntax-shape regex on comment/string-stripped code +
    file-path role detection — NOT bare substring matching; documented, tested anti-false-positive
    design, e.g. requires "@Component(" not just the word "component")
 → SourceParser.parseSource (real parser per framework: Babel/TS AST for
    REACT_JSX/NEXT_JS/GENERIC_ESTREE, @vue/compiler-sfc for VUE_SFC, angular-html-parser for
    ANGULAR_TEMPLATE)
 → ASTDetectionEngine + rule applicability filtering (RULE_CATALOG's `frameworks` array)
 → rule execution (per-rule detector functions)
 → diagnostics array (+ injected SYNTAX-PARSE-ERROR / TypeScript compiler diagnostics)
 → DynamicProfiler (sandboxed child-process execution, real perf.now() timing, 3s internal
    timeout — server-only)
 → quality-score.ts (severity-weighted formula: CRITICAL=15, HIGH=8, MEDIUM=3, LOW=1)
 → ScanResult { diagnostics, qualityScore, analysis.figmStatus (COMPLETE/PARTIAL/BLOCKED/
    UNSUPPORTED_FRAMEWORK), analysis.parserStatus }
```

Rule-catalog facts, computed directly from `src/matrix/rule-registry.ts` (not read from any
document):

```
RULE_SET_VERSION=2.1.0 (src/research/research-config.ts, RESEARCH_ARTIFACT_VERSIONS.ruleSetVersion)
TOTAL_RULES=50 (RULE_CATALOG.length, verified programmatically)
ARCHITECTURE_RULES=19 (primaryResearchDomain partition)
PERFORMANCE_RULES=24 (STATIC_PERFORMANCE)
ACCESSIBILITY_RULES=7
```

Severity distribution: HIGH=27, CRITICAL=12, MEDIUM=11, LOW=0 (no LOW-severity rules exist in the
current catalog — worth noting since a "LOW" filter option would show nothing).

`figmStatus`'s honesty design (COMPLETE never asserted merely because zero diagnostics came back;
BLOCKED/PARTIAL/UNSUPPORTED_FRAMEWORK are distinct, real states) is a genuinely good engineering
practice directly confirmed in code, not just claimed.

---

## 8. Rule-by-Rule Audit

All 50 rule IDs (verified, no duplicates): FIGM-PERF-01..06, FIGM-A11Y-01..07, FIGM-NEXT-01..10,
FIGM-REACT-01..11, FIGM-ANG-01..10, FIGM-VUE-01..06.

Every rule carries a real, non-empty `knownLimitation` field (0 of 50 missing it) — an honest,
verifiable catalog design, not a marketing artifact.

`remediationStatus` distribution (from the registry, not documentation):

```
AUTOMATED_FIX_VERIFIED=18
AUTOMATED_FIX_WITH_CAVEAT=9
MANUAL_REVIEW_REQUIRED=23
```

Cross-checked against the actual wired deterministic fixers (`SUPPORTED_RULE_IDS` constants read
directly from each fix engine):

```
RULES_WITH_DETERMINISTIC_FIX=25
  - AstDeterministicFixEngine (TS/JS AST): FIGM-A11Y-01..06, FIGM-PERF-01/02/03/06, FIGM-REACT-02/03/10,
    FIGM-NEXT-01/03/06/10  (17 rules)
  - AngularTemplateFixEngine: FIGM-ANG-03/04/08/10  (4 rules)
  - VueAstFixEngine: FIGM-VUE-01/02/03/04  (4 rules)
RULES_AI_ONLY=~25 (every remaining rule not in a SUPPORTED_RULE_IDS set — routed to AI assistance
  or MANUAL_REVIEW per remediation-decision.ts, not individually re-verified rule-by-rule in this
  pass)
RULES_MANUAL_REVIEW_ONLY=23 (remediationStatus === MANUAL_REVIEW_REQUIRED, per the registry)
```

Note the 25-vs-18 discrepancy between "wired fixer count" and "AUTOMATED_FIX_VERIFIED count": some
`AUTOMATED_FIX_WITH_CAVEAT` rules also have a wired deterministic fixer (the caveat qualifies
*how safely* it fixes, not *whether* a fixer exists) — this is a metadata-nuance, not a
contradiction, but worth the product team's awareness since a naive reader could reasonably expect
`remediationStatus` to be the single source of truth for "has a deterministic fixer."

`RULES_WITH_REAL_AST` / `RULES_WITH_TEXT_FALLBACK`: in the canonical engine (`RuleExecutionEngine`
+ its detectors), all 50 rules run against a real parser AST for their applicable frameworks — no
text/regex fallback was found in the canonical pipeline (the historical Vue text-heuristic gap
documented in `source-parser.ts`'s own comments was already closed by wiring in the real
`@vue/compiler-sfc` parser). **The VS Code extension is a separate matter** — see §17; its
line-text heuristics are not part of this canonical pipeline and were not counted here.

`RULES_WITH_NO_TEST` / `RULES_WITH_NO_NEGATIVE_TEST`: not individually re-derived rule-by-rule in
this pass (50 rules × cross-referencing every test file would be a very large, separate
undertaking). This audit instead relies on, and confirms the continued passing of, the dedicated
aggregate guards already in the test suite: `tests/complete-rule-evaluation.test.ts` ("every
canonical rule must have at least one case; missing: []" — confirmed passing), `tests/rule-catalog-consistency.test.ts`,
`tests/expansion-rules.test.ts`, `tests/expansion-2-rules.test.ts`. These passed in the full suite
run this session (§25). This is a real limitation of this audit pass, not a claim that per-rule
positive/negative coverage was individually re-verified — flagged explicitly rather than
fabricated (see §34's "confuse limitation with bug" distinction).

Known-limitation patterns worth flagging structurally (drawn directly from the `knownLimitation`
field text, not invented): the majority of `INVARIANT_ALLOCATIONS`/loop-scope rules explicitly
document "no data-flow analysis confirms the value is actually invariant" — i.e., the catalog
itself documents its own over-triggering risk on this pattern class, honestly, rather than hiding
it.

---

## 9. Framework Support Audit

| Framework | Parser | Real AST coverage | Text fallbacks (canonical engine) | Known gaps |
|---|---|---|---|---|
| React (JSX/TSX) | Babel/TS via `source-parser.ts` | Full (hooks, components, inline callbacks, memoization patterns all AST-inspected per `react-ast-rules.ts`) | None found | Documented per-rule limitations (no cross-function data-flow) |
| Next.js | Same Babel/TS parser + path-role detection (`app/`/`pages/` segment + `page.(tsx\|jsx...)` filename) | Full — App Router and Pages Router both detected structurally, not by convention-guessing alone | None found | Server/Client Component boundary rules exist (FIGM-NEXT-*); image/link-specific rule coverage not individually re-audited in this pass |
| Angular | `angular-html-parser` (real, error-tolerant AST) for templates; `.component.ts`/inline-template detection | Full for `.component.ts`, inline templates, and external HTML | None found in canonical engine | External-HTML-file linkage to its `.component.ts` was not independently re-verified this pass |
| Vue | `@vue/compiler-sfc`/`@vue/compiler-dom` (real SFC AST) | Full — `<script>`, `<script setup>`, `<template>` all real-parsed; explicitly documented removal of the historical text-heuristic gap | None found (the one historical text-heuristic was replaced, per source-parser.ts's own comment) | `<template lang="pug\|twig\|...">` preprocessing is explicitly unsupported (deliberately, via webpack `IgnorePlugin` — FIGM never needs it since it only feeds plain Vue markup) |
| Svelte | Detected (`.svelte` → `SVELTE`) but explicitly `UNSUPPORTED_FRAMEWORK` — honestly reported via `analysis.figmStatus`, not silently scored as clean | N/A | N/A | Confirmed intentional (dedicated `tests/svelte-unsupported.test.ts`) — a scope limitation, not a bug |

---

## 10. Parser Robustness Audit

- Parse errors become **diagnostics** (`SYNTAX-PARSE-ERROR`, `CRITICAL` severity), not thrown
  exceptions — confirmed directly in `rule-execution-engine.ts:88-114`. A malformed single file
  degrades that file's own scan to a `parserStatus: 'INVALID'` / `figmStatus: 'BLOCKED'` result;
  it does not, by this code path, propagate to crash a caller processing multiple files (each file
  is a separate `analyzeFile(Async)` call).
- Vue/Angular parsers are explicitly documented as error-tolerant (never throw on malformed
  markup) and their own diagnostics are surfaced as parse errors rather than uncaught exceptions.
- `/api/scan`'s own top-level try/catch further isolates a total analysis-engine failure into a
  clean `503 INFRASTRUCTURE_ERROR` response, never leaking a stack trace to the client (confirmed
  in the route file directly, re-read this session).
- Giant files / minified bundles / binary files: no explicit size-based short-circuit was found
  in the parser itself beyond `/api/scan`'s route-level 500KB body cap; a very large *valid* source
  file passed to the CLI directly (not through the HTTP route) has no such cap. This is a real gap
  for the CLI path specifically (finding P-01, P3).
- Memory/CPU risk: `DynamicProfiler`'s sandboxed execution has its own internal 3s timeout and
  runs in a separate child process (confirmed from prior context this session,
  `src/engine/dynamic-profiler.ts` / `profiler-sandbox-runner.cjs`) — this is the correct isolation
  boundary for genuinely running submitted code, and it is the one part of this pipeline that
  executes arbitrary input as real JavaScript, which is why it alone gets process-level isolation.

```
PARSER_FAILURE_ISOLATION=PASS (per-file, diagnostic-based, not exception-based)
WHOLE_SCAN_CRASH_RISK=LOW
UNBOUNDED_PARSE_RISKS=1 (CLI path has no source-size cap; HTTP path is capped at 500KB)
```

---

## 11. Deterministic Remediation Audit

Traced via `sandbox-validation-pipeline.ts` (stage list: `ISOLATION → SYNTAX → PATCH_SCOPE →
COMPILE_AND_RESCAN → FRAMEWORK_STRUCTURAL → TEST`) and `ai-remediation-pipeline.ts`.

- **Violation → candidate patch**: only for rule IDs in a fix engine's `SUPPORTED_RULE_IDS` set.
- **Syntax validation**: a dedicated `SYNTAX` stage exists before scope/compile checks.
- **Patch scope guard**: a real LCS-based change-ratio check (`PATCH_SCOPE` stage), explicitly
  skipped (`NOT_APPLICABLE`, not silently passed) for files under a minimum line count or over a
  `MAX_LINES_FOR_LCS` ceiling (an explicit, documented cost/benefit tradeoff, not an oversight).
- **Framework-structural check runs BEFORE compile+rescan** — confirmed, and the code comment
  explains this ordering was itself a bug fix (a malformed Vue/Angular patch used to be rejected
  first by the generic re-scan with an unhelpful generic reason).
- **Compilation/type validation**: `COMPILE_AND_RESCAN` reuses `RemediationValidator`
  (isolated TypeScript compile diagnostics + a real `RuleExecutionEngine` re-scan + an ESLint
  cross-check) — a genuinely three-layered verification, not a single syntax check masquerading as
  "verified."
- **Re-scan required**: yes, confirmed — `verified: boolean` on the pipeline result is explicitly
  documented as "true only if the patched code was re-scanned and the original violation is
  confirmed gone."
- **Rollback on failure**: the pipeline never mutates the caller's original `code` in place — a
  rejected candidate simply isn't returned as `remediatedCode`; the original is always still
  available to the caller. There is no separate "rollback" step because nothing is committed until
  the caller acts on a `verified: true` result.
- **Idempotence / duplicate patch application**: not independently stress-tested in this pass
  (e.g., applying the same fix twice in a row) — flagged as unverified rather than assumed safe.

```
DETERMINISTIC_FIX_PATH=AST_DETERMINISTIC_FIX (25 rules) -> SandboxValidationPipeline -> verified/rejected
RESCAN_REQUIRED=YES
VERIFIED_SEMANTICS=PASS
PATCH_SCOPE_GUARD=PASS
ROLLBACK_ON_FAILURE=PASS (by construction — no in-place mutation of caller state)
```

---

## 12. AI Remediation Architecture Audit

Confirmed directly from `src/ai/ai-provider-selector.ts`, `ai-remediation-pipeline.ts`, and the
three provider files — **not assumed from any historical document**. There is no Qwen-branded
provider in current code; "Qwen" appears only in code comments describing a *historical, already-
fixed bug* (a Qwen-era response that failed JSON parsing and was mis-surfaced as UNRESOLVED
instead of AI_UNAVAILABLE) — legacy context, not live architecture.

```
CURRENT_PROVIDERS=OLLAMA (local, opt-in), CLAUDE (Anthropic SDK), GEMINI (@google/genai SDK)
DEFAULT_PRECEDENCE=OLLAMA (if OLLAMA_BASE_URL or OLLAMA_MODEL set) > CLAUDE (if ANTHROPIC_API_KEY set) > GEMINI (if GEMINI_API_KEY set) > none (stub, immediate AI_UNAVAILABLE)
ENV_OVERRIDES=AI_PRIMARY_PROVIDER, AI_FALLBACK_PROVIDER (both ignored if they name an unconfigured provider)
DEFAULT_MODEL_PER_PROVIDER=Ollama: qwen2.5-coder:7b (local default, developer-configurable); Gemini: gemini-3.6-flash (documented as verified live against the real API after gemini-2.5-flash started 404ing for new keys); Claude: model selection lives in claude-client.server.ts (not re-read line-by-line this pass, but ANTHROPIC_MODEL env override was seen referenced elsewhere in this session's earlier work — e.g. app/api/research-metrics/route.ts falls back to "Claude Opus 5")
```

- Secrets handled server-side only: confirmed — none of `ANTHROPIC_API_KEY`/`GEMINI_API_KEY`/
  `OLLAMA_BASE_URL` carry a `NEXT_PUBLIC_` prefix; the module header comments explicitly state the
  browser never receives these or the raw provider response.
- Prompts contain only necessary source: `AIPromptBuilder.buildUserContent` truncates to
  `MAX_PROMPT_LENGTH` (100,000 chars for Ollama; not independently re-verified for Claude/Gemini's
  own limits in this pass) and frames the source under an explicit "untrusted data" header —
  confirmed the untrusted-data framing exists in the shared policy instruction, a real prompt-
  injection mitigation (not just an assumption that models will behave).
- Retry amplification: bounded at `MAX_AI_ATTEMPTS = 3` total (1 initial + 2 feedback-informed
  retries) — confirmed a hard constant, not configurable/unbounded.
- Provider failover: `getFallbackProvider()` explicitly never falls back to the same provider that
  just failed, and only triggers on availability failures (429/timeout/auth), never on a
  code-quality rejection (which retries the *same* provider with feedback instead) — a
  well-reasoned, correctly-implemented distinction, confirmed in code.
- Invalid JSON handling: `AIResponseParser` has documented brace-matching recovery logic and is
  explicitly never routed through `eval()`/`Function()` (confirmed by the comment and the absence
  of any such call in that file).
- Hallucinated-patch handling: every provider's output — regardless of confidence score claimed by
  the model — goes through the full sandbox validation pipeline (§11) before being trusted; the
  model's own stated confidence is never used as a substitute for re-scanning.
- Provider response logging: `logRemediationEvent` explicitly logs only ruleId/filePath/framework/
  line/column/stage — never the API key, never full source code (confirmed by reading the function
  and its doc comment, which explicitly states this discipline).

```
AI_PROVIDER_ABSTRACTION=PASS
AI_SECRET_BOUNDARY=PASS
AI_TIMEOUT_HANDLING=PASS (Ollama 120s default/configurable; Claude/Gemini timeouts not re-verified line-by-line this pass but referenced elsewhere as ~45s)
AI_RETRY_POLICY=PASS (bounded at 3, provider-failover never loops back to a failed provider)
AI_PATCH_VALIDATION=PASS
AI_RESCAN_VERIFICATION=PASS
```

---

## 13. Ollama / Local Model Audit

Traced directly from `src/ai/providers/ollama-provider.ts`.

- Activation is opt-in only (`OLLAMA_BASE_URL` or `OLLAMA_MODEL` must be explicitly set) — a
  Vercel deployment that sets neither is completely unaffected, confirmed both by code and by the
  module's own header comment explaining exactly why (127.0.0.1 on Vercel is the function sandbox
  itself, not the developer's machine).
- Health check (`OllamaClient.checkHealth`) is a separate, short-timeout (2s) `/api/tags` probe
  used by `/api/health`, never by the remediation path itself — so a user hitting "Fix" doesn't
  wait out a full generation timeout just to discover Ollama is down (the health route surfaces
  that upfront instead).
- Generation timeout: single bounded `AbortController` timeout, default 120s
  (`OLLAMA_TIMEOUT_MS`-overridable) — **one attempt, not a retry loop internal to this provider**;
  the outer pipeline's own 3-attempt bound (§12) is where any repetition happens, and that repeats
  the *pipeline* (with feedback), not blind identical retries against a known-down endpoint —
  confirmed no code path retries Ollama specifically after a connection-refused/timeout failure
  within a single `generateRemediation` call.
- Failure classification is genuinely granular: `AbortError` (timeout), `ECONNREFUSED` (server
  down), HTTP 404 (model not pulled), a specific CUDA/memory-allocation-failure regex match
  (documented as matching a real, locally-reproduced GTX 1650 4GB VRAM failure), and a generic
  catch-all — every one maps to a clean `AI_UNAVAILABLE` with a categorized, non-stack-trace
  reason string.
- Streaming: non-streaming only (`stream: false`), a single JSON response — simpler and matches
  the shared provider contract used by Claude/Gemini.

```
OLLAMA_LOCAL_DEV=SUPPORTED
OLLAMA_VERCEL_DIRECT=UNSUPPORTED (by design and by network topology — 127.0.0.1 on Vercel is the function's own sandbox)
REMOTE_BRIDGE_REQUIRED=YES (only if a deployment wants Vercel to reach a "local" model at all — OLLAMA_BASE_URL genuinely accepts any reachable URL, so a self-hosted, publicly-reachable Ollama instance would work; no such bridge is provided or documented as a first-class deployment option)
FAIL_FAST_ON_UNAVAILABLE_MODEL=YES (single bounded timeout per attempt, categorized failure, no blind repeated retries against a dead endpoint)
```

This is a deployment/architecture constraint, not a bug — see §34.

---

## 14. Scan/Fix End-to-End Flow Audit

Confirmed via `decideRemediation`/`ai-remediation-pipeline.ts`'s own module doc comment and code
structure (§2 flow B, §11, §12):

```
DETERMINISTIC_FIRST=PASS (AST fixer attempted first for any SUPPORTED_RULE_IDS match; AI is only
  reached for a rule with no deterministic fixer, or when a deterministic attempt genuinely
  declined)
CAN_AI_BYPASS_RULE_ENGINE=NO (every AI-authored patch goes through SandboxValidationPipeline's
  COMPILE_AND_RESCAN stage, which re-invokes the real RuleExecutionEngine — there is no path that
  accepts an AI patch on syntax-check alone)
CAN_AI_FIX_BE_MARKED_VERIFIED_WITHOUT_RESCAN=NO (`verified` is explicitly documented and
  implemented as "re-scanned and the original violation confirmed gone")
```

No path was found that calls an AI provider before FIGM's own rule engine has already identified
the violation being fixed (AI remediation is always invoked with a specific, already-detected
`DiagnosticReport`, never as a first-pass detector).

---

## 15. Input Validation / Abuse Resistance

- **Max source length**: `/api/scan` enforces 500KB (`MAX_CODE_LENGTH`); Ollama's provider
  independently caps prompt length at 100,000 chars. No archive/zip-upload feature exists in this
  codebase (confirmed — no route accepting a `.zip`/multipart archive was found in the route
  inventory), so zip-bomb risk is not applicable.
- **Path traversal**: `/api/report`'s `collectFiles` walks a fixed, hardcoded `samples/sample-spa`
  directory — no user-supplied path component reaches `fs.readFileSync`/`readdirSync` in that
  route. The CLI's `--path` argument is a local developer-supplied argument, not a web-facing
  input, so path traversal there is not a remote-attacker-relevant risk in the same sense.
- **Malicious filenames**: `fileName` from a scan request is used in diagnostic output and as a
  DB column value, not as a filesystem path anywhere in the request-handling routes reviewed —
  no direct filesystem-write-by-filename path was found.
- **Regex DoS**: the framework-detection regexes (§9) are simple, anchored, non-nested-quantifier
  patterns — not an obvious ReDoS shape. The full rule-detector regex surface (dozens of files)
  was not exhaustively re-audited for catastrophic backtracking in this pass — flagged as
  unverified rather than cleared.
- **Parser DoS**: bounded by the 500KB request cap plus the sandboxed profiler's 3s internal
  timeout; a pathological-but-under-500KB input that makes the AST parser itself pathologically
  slow was not stress-tested in this pass.
- **Prompt injection inside source code**: the AI prompt explicitly frames submitted source as
  untrusted data under a dedicated header (§12) — a real mitigation, though (as with any LLM) not
  a hard guarantee against a sufficiently creative injection; the sandbox re-scan (§11/§14) is the
  actual safety backstop regardless of what the model outputs.
- **Output escaping**: no `dangerouslySetInnerHTML` usage was found anywhere in `app/` — diagnostic
  text, filenames, code snippets, and AI-generated explanation text are all rendered through
  normal React JSX text interpolation, which escapes by default. This is a strong, structural XSS
  mitigation, confirmed by absence of the one API that would bypass it.

```
INPUT_VALIDATION=PASS for the scan/fix path specifically; PARTIAL overall (not every one of the
  ~20 write routes had its own body-size/shape validation individually re-verified this pass)
PATH_TRAVERSAL_RISK=LOW
XSS_RISK=LOW (no dangerouslySetInnerHTML found; standard JSX escaping throughout)
DOS_RISK=LOW-MEDIUM (/api/report's fallback recursive scan is a real, rate-limited but non-trivial
  compute cost per authenticated request — see D-01)
PROMPT_INJECTION_RISK=LOW-MEDIUM (mitigated by explicit untrusted-data framing + mandatory
  re-scan verification, but never fully eliminable when an LLM is in the loop)
```

---

## 16. Security Audit

No destructive exploitation was performed. Findings below are read-only code-review conclusions.

| ID | Severity | Path | Issue | Impact | Exploitability | Recommended fix |
|---|---|---|---|---|---|---|
| SEC-01 | P2 | `package.json` deps | Next.js pinned at `^14.1.0`; `npm audit` reports ~20 GHSA advisories against installed Next (DoS, cache poisoning, SSRF-in-rewrites, XSS-in-CSP-nonce-apps, unauthenticated Server Function endpoint disclosure) only resolved by upgrading to Next 16 | Depends on which specific advisories are network-reachable in this app's actual route/middleware configuration — not individually confirmed exploitable here, but the version is objectively behind by a wide margin | Not verified exploitable against this specific app's config; flagged on advisory presence, not a confirmed live PoC | Plan a Next.js major-version upgrade; in the interim, review which advisories touch features this app actually uses (rewrites, Server Actions, Image Optimizer) |
| SEC-02 | P3 | `app/api/report/route.ts:58` | `catch (err: any) { return NextResponse.json({ error: err.message }, ...) }` returns the raw exception message to the client | Minor information disclosure (a `JSON.parse`/`fs` error message could reveal a server file path) | Low — requires triggering an unusual server-side failure | Return a generic message; log `err` server-side only, matching the discipline already used in `/api/scan` |
| SEC-03 | P2 | `src/auth/user-db.ts` | Legacy direct-to-Supabase dual-write side channel (now guarded under `NODE_ENV=test`, but still present and reachable whenever `NEXT_PUBLIC_SUPABASE_URL`+ a key are configured, i.e. in every real deployment) | Architectural: a second, independent write path to `users`/`scan_reports` outside `RepositoryFactory`, using field-mapping logic that must be kept in sync by hand with the Prisma schema | Not an active exploit, but a maintainability/correctness risk (a future schema change could silently desync this path) | Consider removing this dual-write path entirely now that `SupabaseStorageProvider` is the sole intended production write path |
| SEC-04 | P3 | cookie auth fallback | `figm_token` cookie's `Secure`/`HttpOnly`/`SameSite` attributes were not directly re-verified in this pass | Session-cookie hardening gap if this path is ever relied upon (primary auth is Bearer-header, not cookie) | Low under current usage pattern | Verify and, if needed, explicitly set `HttpOnly; Secure; SameSite=Strict` wherever `figm_token` is written |
| SEC-05 | P4 | `openai` dependency | Listed in `package.json` `dependencies`, zero references anywhere in `src`/`app` | Unused attack surface / bundle weight, not itself exploitable | N/A | Remove the unused dependency |

No hardcoded secrets, no leaked service-role key in client-reachable code, no SSRF-shaped
user-controlled-URL fetch, no command injection (the one `execSync` call found uses a fixed,
non-interpolated command string — §15/§10 of the prior GH-Actions-focused audit already covered
CI-side secret handling separately and is not repeated here), no open-redirect pattern found in
this pass, no debug/migration endpoint reachable over HTTP.

---

## 17. Dependency Audit

```
UNUSED_DEPENDENCIES=1 confirmed (`openai` — zero import references found)
DEPRECATED_DEPENDENCIES=0 confirmed via explicit deprecation flag (not exhaustively checked against npm's deprecation metadata for all 29 packages)
KNOWN_VULNERABILITIES_CRITICAL=0
KNOWN_VULNERABILITIES_HIGH=7 (`npm audit --omit=dev`: deepmerge-ts (via @prisma/config→prisma), fast-uri, mysql2 (via prisma's own optional dependency tree, not this app's own DB driver — this app uses `pg`/Postgres, not MySQL), next, postcss (via next))
```
(1 low + 1 moderate also reported — `dompurify` via `monaco-editor`, `fast-uri` low-severity
variant — for a total of 9, matching `npm audit`'s own summary.)

Dependency footprint is otherwise lean (16 runtime + 13 dev = 29 total) — no obvious duplicate
libraries (e.g., only one AST/parse library per framework), no heavy unexpected server/client
bundling issue found in the Next.js build output reviewed this session (bundle sizes in the
100-140KB First Load JS range per route, unremarkable for this feature set).

---

## 18. Next.js / Server-Client Boundary Audit

- `serverComponentsExternalPackages: ['typescript', 'tsx']` (next.config.mjs) keeps the TypeScript
  compiler out of the client bundle deliberately.
- The dynamic-profiler's Node-builtin requires (`child_process`, `fs`, `path`, `url`) are
  explicitly stubbed to `false` **only for the client webpack config** (`!isServer` guard,
  confirmed read directly) — a real, correctly-scoped client/server split, not an accidental
  leak.
- No client-reachable import of `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
  `GEMINI_API_KEY`, `OLLAMA_BASE_URL`, `DATABASE_URL`, or `DIRECT_URL` was found — all AI/DB
  secret reads happen in files with a `.server.ts` suffix or server-only route handlers.
- `NEXT_PUBLIC_*` usage is limited to genuinely public values by Next's own convention:
  `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` (both non-sensitive by Supabase's own
  security model — RLS, not key secrecy, is the real boundary — already discussed in this
  session's GitHub Actions audit), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
- Route runtime settings: multiple routes explicitly set `export const dynamic = 'force-dynamic'`
  — confirmed this pattern is applied consistently enough that a from-scratch production build
  with **zero** DB/Supabase credentials present still succeeds cleanly (empirically re-verified
  this session, not merely inferred).

```
SERVER_CLIENT_BOUNDARY=PASS
SECRET_TO_CLIENT_RISK=LOW
SERVERLESS_COMPATIBILITY=PASS (build succeeds with zero backend credentials present; see §21)
```

---

## 19. Performance / Scalability Audit

- Large-source scans: bounded by the 500KB HTTP cap (§15); CLI path unbounded (§10 finding P-01).
- Concurrent scans: `analyzeFileAsync` explicitly exists to avoid blocking the Node event loop
  under concurrent multi-user load (async `child_process.spawn` vs. the sync `analyzeFile`'s
  `spawnSync`) — a deliberate, documented design choice, confirmed in the doc comment and the
  actual method split.
- AI call latency: Ollama up to 120s per attempt (local-dev-only in practice); Claude/Gemini
  latencies not independently re-measured this pass. The 3-attempt bound (§12) means worst-case
  total AI-remediation latency could be several times a single provider's timeout — a real,
  user-facing latency risk on a slow/degraded provider, not catastrophic but worth surfacing.
- DB connection behavior: `getPrismaClient()` uses a capped `pg.Pool` (`max: 5`) via
  `@prisma/adapter-pg`, explicitly documented as fixing a prior connection-exhaustion incident
  (DIRECT_URL vs. pooled DATABASE_URL confusion) — a real, evidenced fix, not a guess.
  HMR-safe singleton via `globalThis` prevents pool accumulation across dev reloads.
- Serverless time limits: `/api/scan` explicitly sets `maxDuration = 60` with a documented
  rationale (AST parsing + sandbox spawn + potential AI call can exceed a typical default).
- Rate limiting: DB-backed and shared across instances (§4), correctly avoiding the classic
  per-instance in-memory rate-limit weakness except as an explicit, logged fallback.
- Repeated parser instantiation / memory-heavy AST retention: not independently profiled in this
  pass; `SourceParser`/`ASTDetectionEngine` are static-method classes (no evident per-call heavy
  object retention from the code read), but this was not stress-tested.
- Report payload size: `getResearchDataset()`/admin exports return the full unbounded result set
  (§5's N+1/pagination note applies here too, at current ~1,100-scan scale this is not yet a
  practical problem).

```
SCAN_CPU_RISK=LOW-MEDIUM (bounded by 500KB cap + 3s sandbox timeout; CLI path unbounded)
SCAN_MEMORY_RISK=LOW-MEDIUM (not independently profiled under load)
AI_LATENCY_RISK=MEDIUM (up to 3 sequential attempts, each with its own timeout, on a degraded provider)
DB_SCALING_RISK=LOW at current scale; MEDIUM long-term (unbounded reads, no pagination on research/admin exports)
VERCEL_TIMEOUT_RISK=LOW (maxDuration explicitly set and rationale documented; not independently verified against actual worst-case AI+sandbox combined latency)
```

The historical "85-user" assumption referenced in `research-config.ts`'s own comments is
explicitly documented there as a superseded planning figure (current real target is 20 research
participants) — not a live product-capacity assumption anywhere in the runtime code; it does not
affect rate limits, pool sizes, or any other runtime constant, which were all independently
verified above.

---

## 20. Reliability / Error Handling

- Parser errors → diagnostics, not crashes (§10).
- DB unavailable: `RepositoryFactory` fails closed with a clear, actionable error message outside
  dev/test (never a silent fallback in production); `checkRateLimit` degrades gracefully to an
  in-process fallback (logged, not silent) if the DB-backed check itself throws.
- Auth failure: consistent 401/403 JSON responses with a `code` field across every route
  reviewed, never a raw exception.
- AI provider timeout/invalid output: mapped to a clean `AI_UNAVAILABLE`/`PATCH_REJECTED`/
  `UNRESOLVED` status, never an uncaught exception reaching the HTTP layer (confirmed the
  `generateRemediation` doc comment's explicit "never throws" contract, and spot-checked the
  Ollama provider's exhaustive try/catch coverage).
- Malformed source: handled as a parse-error diagnostic, not a 500.
- File too large: explicit 413-class rejection on `/api/scan` (500KB cap).
- Rate-limit reached: explicit 429 with `Retry-After`.
- `/api/report`'s raw `err.message` leak (§16, SEC-02) is the one clear "excessive error
  disclosure" instance found; every other route reviewed returns a clean, generic error message.
- No silent data corruption path was found — writes either succeed and are confirmed, or fail with
  an explicit, surfaced `INFRASTRUCTURE_ERROR`/error response (the `/api/scan` persistence-failure
  handling explicitly documents this "never silently drop" discipline).

```
ERROR_HANDLING=PASS (one P3 message-leak exception noted)
SILENT_FAILURE_PATHS=0 confirmed found
UNBOUNDED_RETRY_PATHS=0 confirmed found (AI: bounded at 3; rate-limiter: no retry, just a 429)
```

---

## 21. Observability / Audit Logging

`AuditLogger.logEvent` writes to the real `audit_logs` Postgres table, with a typed action enum
(`REGISTER`, `LOGIN`, `LOGOUT`, `SCAN_RUN`, `RESEARCH_PARTICIPANT_ASSIGNED`,
`RESEARCH_CONSENT_VERIFIED`, `RESEARCH_CONSENT_REVOKED`, `ACCESS_DENIED`, etc.) — confirmed
directly from `user-db.ts`'s `DBAuditLog` interface. This log also doubles as the rate-limiter's
shared request-count source (§4), so it is genuinely load-bearing infrastructure, not a
write-only afterthought.

- Sensitive-value logging: no direct evidence found of passwords, JWTs, or API keys being written
  to `audit_logs` or to console logs in the files reviewed (`ai-remediation-pipeline.ts`'s explicit
  no-secrets-no-full-source logging discipline was directly confirmed; `audit-logger.ts` itself
  was grepped for password/token/secret/apiKey field references with no hits).
- Admin actions are attributable: every admin mutation reviewed (`RESEARCH_CONSENT_VERIFIED`,
  role changes, password resets) logs the acting admin's `userId`/`email`.
- Failures investigable: server-side `console.error` calls throughout the AI/rate-limiter/storage
  layers carry enough structured context (stage, ruleId, IP, error class) to diagnose from logs
  alone, per the code's own stated discipline.

```
AUDIT_LOGGING=PASS
SENSITIVE_LOGGING_RISK=LOW
```

---

## 22. UI / UX Product Audit

Full click-through QA of every flow was not performed in this audit pass (this is a code/security/
architecture audit, not a manual UX walkthrough) — the following is based on code-level evidence
(component structure, conditional rendering, loading/error states found in the files read this
session and earlier this conversation).

- Landing (`app/page.tsx`): no overclaim language found (§30).
- Login/register/admin/live-scan/research pages: all confirmed to exist and route correctly per
  the architecture map (§2); several (admin, live-scan, user-study) were read in detail earlier
  this session and show real, non-placeholder logic (e.g., admin's explicit "Access Restricted"
  state for a non-2xx auth response, rather than silently rendering an empty dashboard — a
  documented fix for a previously-real gap).
- Error/loading/empty states: confirmed present in the admin dashboard (explicit loading spinner
  state, explicit `authError` rendering, explicit "No real scan data yet" empty state for rule
  analytics) and the research-consent-verification UI (explicit pending/error states with retry).
- A `dashboard-loading-error-accessibility.test.ts` test file exists, implying loading/error UI
  accessibility has dedicated regression coverage — not independently re-verified visually in this
  pass.

```
UX_FLOW_COMPLETENESS=PASS (based on code-level evidence; not a full manual click-through)
UI_OVERCLAIMS=0 confirmed found in the files searched (see §30 — no "Production SaaS"/"ISO
  Verified"/"100% accurate"/"zero false positives" strings found anywhere in app/)
CRITICAL_BROKEN_FLOWS=0 confirmed found (none discovered; a full manual walkthrough was not
  performed, so absence of evidence here is not the same as exhaustive verification)
```

---

## 23. Accessibility of the Product's Own UI

Implementation-level findings only — **no WCAG-compliance claim is made here**.

- `dashboard-loading-error-accessibility.test.ts` and `accessibility-regression.test.ts` exist as
  dedicated test files, implying the team already treats this as a real regression surface, not an
  afterthought.
- The admin dashboard's modal (password reset) was read in detail earlier this session and uses
  `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and a real `<form>` with labeled
  password fields — genuine ARIA usage, not decorative.
- The user-study consent checkbox uses a real `<label>` wrapping the `<input type="checkbox">`
  with visible text, not an icon-only or unlabeled control.
- Tables throughout the admin UI use semantic `<table>`/`<thead>`/`<tbody>`/`<th>` markup
  (confirmed in the admin page read earlier this session), not div-based pseudo-tables.
- Full keyboard-navigation and color-contrast verification was not performed in this pass (that
  requires a rendered-browser check, out of scope for a code-only audit).

---

## 24. CLI Audit

`src/cli/figm-analyze.ts` traced directly.

- Commands/args: `--path`, `--framework`, `--format`, `--threshold`, `--ignore`, `--out`, plus a
  positional path argument — all parsed by a plain, dependency-free `parseCLIArgs` (no external
  arg-parsing library, no obvious injection surface since these are local CLI args, not
  network-supplied).
- Exit codes: `runCLI` returns `0`/`1` deterministically from at least 4 distinct code paths;
  the bin wrapper calls `process.exit(exitCode)` — but **only when
  `process.env.NODE_ENV !== 'test'`**, an explicit, deliberate guard so the test suite can import
  and exercise `runCLI` without killing the test process.
- Autorun guard: confirmed fixed and correct — matches the entry script's exact **basename**
  (`figm-analyze.ts`/`.js`), not a path-substring match. The substring-match version of this bug
  (previously matched any process whose path merely contained "figm-model") is explicitly
  documented as fixed, with the real crash it used to cause explained in the comment. Re-verified
  present and correct in current code, not merely cited from a prior report.
- Quality-gate threshold: `--threshold <number>` is read and (per the CLI's own description)
  gates CI pass/fail — the exact comparison logic was not independently re-read line-by-line in
  this pass.
- `dist/src/cli/figm-analyze.js` exists (a pre-built, committed `dist/` directory) — the packaged
  `bin/figm-analyze.js` wrapper imports from it directly, so the CLI works as packaged today
  without requiring a fresh `tsc` build step, though `dist/` staying in sync with `src/` on future
  changes is a manual-discipline risk (not independently verified as automated via a `prepublish`
  hook or similar in this pass).

```
CLI_STATUS=PASS
CLI_EXIT_CODES_CORRECT=YES
CLI_AUTORUN_GUARD=PASS
```

---

## 25. VS Code Extension Audit

```
VSCODE_EXTENSION_PRESENT=YES (vscode-extension/, packaged as figm-code-inspector-1.0.0.vsix)
EXTENSION_BUILD=NOT_RUN (not compiled/tested in this pass — read-only source review only)
EXTENSION_SECURITY=PASS for network exposure (zero fetch/http calls found anywhere in
  vscode-extension/src/*.ts — the extension never transmits source code anywhere; all analysis is
  local-in-process)
```

**Significant finding, directly evidenced (not inferred):** `diagnostics-provider.ts`'s own
in-code comment reads `// AST rule pattern detection heuristics`, but the actual implementation
immediately below it is pure line-by-line **string-contains** matching — e.g. `lineText.includes('.map(')
&& (lineText.includes('{') || lineText.includes('=>'))`, `lineText.includes('<img') &&
!lineText.includes('width=')`. This is not AST analysis in any sense; it is the exact class of
naive-text-heuristic detection the main product's `source-parser.ts` explicitly documents having
moved *away* from (§9) because of its false-positive/false-negative failure modes. The extension
only implements detection for **5 of the 50 canonical rules**
(FIGM-REACT-02, FIGM-PERF-05, FIGM-PERF-02, FIGM-A11Y-01, FIGM-PERF-04) — the remaining 45 rules
(including the entire Angular/Vue/Next.js-specific catalog) have no VS Code-extension-side
detection at all. The extension does correctly mirror the main product's severity-weighted quality
score formula (`SEVERITY_WEIGHT` constants), with a dedicated cross-repo regression test
(`tests/vscode-score-consistency.test.ts`) guarding that one specific constant from drifting — a
good practice for the one thing it does share, but it underscores that the *detection* logic itself
is not shared or kept in sync at all.

This is a real product-claim risk (§30): if the extension is marketed as "the FIGM engine in your
editor," that is **UNSUPPORTED** by the current code. If it is marketed honestly as "a lightweight
FIGM-rules-aware linter preview," that would be **SUPPORTED**.

---

## 26. Test Suite Audit

Ran sequentially, as instructed (never in parallel):

```
$ npx tsc --noEmit
(no output — clean, exit 0)

$ npm test
# tests 1531
# suites 99
# pass 1531
# fail 0
# skipped 0
duration_ms ≈ 346088 (≈ 5.8 minutes)

$ npm run build
✓ Compiled successfully — no "Failed to compile" / no `error TS` / no FATAL anywhere in the
  build log; route manifest includes /api/admin/research-dataset and all 37 API routes; run
  sequentially, never concurrently with the test run, per the task's own instruction.
```

Test count (1531) differs slightly from an earlier informal estimate (1526) in this document's
draft because the working tree includes 4-5 extra uncommitted test additions
(`tests/thesis-exporter-canonical-guard.test.ts` plus related file edits) from the separate,
concurrent thesis-export work noted in this document's header — not a discrepancy in this audit's
methodology.

No test mutated a canonical source file during this run (only the local, gitignored,
test-only `figm-user-db.json` and its equally test-only Supabase-fallback state are written to by
the suite — confirmed architecture from this session's own earlier P0 audit work). No `.only` or
`.skip` marker was searched for exhaustively across all ~150 test files in this specific pass, but
none was observed in any of the dozens of test files read in depth this session, and the full run
above shows `0 skipped` in its own summary line.

Test-suite composition, by category (inferred from filenames, not individually opened for all
~150 files):

```
TEST_SUITES=99 (node:test describe-block count from the run's own summary)
TESTS_TOTAL=1531
TESTS_PASSED=1531
TESTS_FAILED=0
TESTS_SKIPPED=0
BUILD=PASS (clean compile, no errors, confirmed via full build log inspection)
```

Rough category breakdown by filename pattern: rule/AST/framework detection (~30 files: `*-ast*`,
`*-detection*`, `*-rules*`, `qa-matrix-*`), auth/security (~15 files: `auth-*`, `*security*`,
`idor-*`, `open-redirect-*`, `login-timing-*`), remediation/AI (~20 files: `*fix-engine*`,
`ai-*`, `*-provider*`, `sandbox-*`), research integrity (~15 files: `research-*`,
`participant-*`, `human-study-*`, `qa-baseline-*`, `rq1-*`, `rq4-*`), DB/storage (~8 files:
`*storage-provider*`, `json-migration`, `realtime-storage`, `db-safety-guard`), dashboards/SaaS
(~10 files: `saas-*`, `dashboard-*`), CLI (`cli-analyzer.test.ts`), no dedicated browser/e2e UI
test suite was found (the "e2e"-named file, `live-scan-e2e.test.ts`, is a server-side
Node-test-runner test against the scan pipeline, not a browser-driven end-to-end test).

---

## 27. Test Quality Audit

Based on the dozens of test files read in depth across this session (not all ~150 individually
re-read in this specific pass):

- **Strong**: tests consistently invoke the real repository/storage stack rather than mocking
  critical behavior away (explicit, repeated doc-comment convention: "no mocking" — confirmed in
  `research-dataset-consent-gate.test.ts`, `repeated-scan-attempt-policy.test.ts`, and others).
  Negative tests are common and explicit (e.g., "ASSIGNED-only participant contributes zero rows,"
  "REVOKED participant contributes zero rows even with real scans"). A genuine, real concurrency
  test exists (`participant-provisioning-race.test.ts`, "two concurrent participant sessions never
  resolve to the same participantId"). Authorization tests are explicit and adversarial (e.g.,
  "a non-admin real user cannot set researchStatus to CONSENT_VERIFIED," "a research-participant
  token cannot authenticate as a real user").
- **Gaps found**: this session's own work (see `docs/audit/PRE_STUDY_DATA_INTEGRITY_FINAL.md`)
  found and fixed a real, previously-undetected test-isolation weakness (the local JSON
  test-storage backend does not enforce `participantCode` uniqueness the way Postgres does,
  causing intermittent, environment-dependent false test results) — this was a genuine
  test-quality gap, not hypothetical, and it was only surfaced by actually re-running the suite
  multiple times, not by static review.
- Snapshot-only safety: `angular-template-ast.test.ts` (and 4 others per the earlier Jest
  mis-invocation this session) carry Jest-style `.snap` files under
  `benchmarks/real-world/.repo-clones/` — these belong to *cloned third-party benchmark
  repositories*, not this project's own test suite, and are not evidence of this project relying
  on snapshot testing for its own correctness claims.
- Rule-by-rule positive/negative coverage was not exhaustively re-verified per rule in this pass
  (§8) — relying instead on the passing aggregate guard tests.

```
TEST_QUALITY=STRONG (with one specific, already-remediated gap class identified and fixed this
  session, and one specific, un-re-verified gap: exhaustive per-rule positive/negative coverage)
CRITICAL_COVERAGE_GAPS=1 (per-rule test-coverage completeness not exhaustively re-audited; relies
  on the passing aggregate `complete-rule-evaluation.test.ts` guard)
```

---

## 28. CI/CD Audit

Already the subject of a dedicated, deep audit this session
(`docs/audit/GITHUB_ACTIONS_SECRET_CONTEXT_VERIFICATION.md`). Re-confirmed unchanged:

- Triggers: `push`/`pull_request` on `main`/`master`/`develop`, plus `workflow_dispatch`.
- Steps: checkout → setup-node@22 (cached) → `npm ci` → `prisma generate` (placeholder-URL-safe,
  never connects) → `npm run build` → `npm test` (confirmed **no** `DATABASE_URL`/`DIRECT_URL` in
  this step's env block) → `npm run ci:scan` (the FIGM self-scan quality gate) → artifact upload →
  PR comment.
- No `continue-on-error` was found anywhere in the workflow — a step failure genuinely fails the
  job.
- Secrets used: `DATABASE_URL`, `DIRECT_URL` (Prisma-generate + ci:scan steps only — confirmed in
  the prior audit that `ci:scan`'s own script doesn't actually consume them), `NEXT_PUBLIC_SUPABASE_URL`/
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ci:scan step), `GITHUB_TOKEN` (auto-provided, PR-comment step
  only) — none are echoed/printed anywhere in the workflow.

```
CI_CONFIGURATION=PASS
TEST_DB_ISOLATION_CI=PASS (confirmed: no DB env vars in the test step; independently defended by
  src/db/db-safety-guard.ts even if that ever changed)
QUALITY_GATE_ENFORCED=YES (npm run ci:scan runs after build+test, no continue-on-error)
SECRET_USAGE_CI=PASS
```

---

## 29. Vercel Deployment Audit

```
FULLY_VERCEL_COMPATIBLE:
  - Scanner (/api/scan, RuleExecutionEngine) — confirmed via a from-scratch build with zero
    backend credentials present (empirically verified this session)
  - Deterministic fixer (AST-based fix engines) — pure in-process TS/AST logic, no external
    dependency
  - Claude AI remediation — server-side HTTPS SDK call, no local-network dependency
  - Gemini AI remediation — same
  - CLI — runs fine as a local Node process; not itself deployed to Vercel (a CLI is not a web
    route), listed here only for completeness

VERCEL_COMPATIBLE_WITH_EXTERNAL_SERVICE:
  - Database/persistence — requires a real, external Supabase/Postgres project (DATABASE_URL/
    DIRECT_URL/NEXT_PUBLIC_SUPABASE_* configured as real Vercel env vars); the app fails closed
    (refuses to silently fall back to JSON storage) if these are absent outside dev/test —
    confirmed in RepositoryFactory's own fatal-error path.

LOCAL_ONLY:
  - Ollama AI remediation — genuinely cannot reach a developer's own machine from a Vercel
    function; requires either staying local-dev-only, or the deployment operator standing up
    their own separate, publicly-reachable Ollama endpoint and pointing OLLAMA_BASE_URL at it
    (no such bridge is built or documented in this repo).

NOT_DEPLOYABLE_AS_IMPLEMENTED:
  - VS Code extension — not a Vercel-deployed artifact at all (a separate distribution channel,
    the .vsix package); not applicable to this classification.
```

Other deployment-relevant notes: the dynamic-profiler's sandbox script
(`src/engine/sandbox/profiler-sandbox-runner.cjs`) is explicitly force-included in Vercel's
file-tracing output via `outputFileTracingIncludes` (a real, documented fix for a previously-real
silent-breakage bug where Vercel's tracer wouldn't discover a `spawnSync`-invoked script on its
own). The Vue-compiler webpack `IgnorePlugin` configuration is likewise explicitly documented as
the result of three live-Vercel debugging attempts, not a theoretical concern — this is real,
evidenced production-deployment hardening already done, not a gap.

```
No dedicated Vercel config file (vercel.json) was found in this pass -- deployment relies on
Next.js's own conventions plus the documented next.config.mjs settings above.
```

---

## 30. Environment Variable Matrix

Derived directly from `.env.example` (never printing values) cross-referenced against actual code
usage found this session.

| Variable | Required? | Public/Private | Used by | Dev | Test | Prod | Failure if missing |
|---|---|---|---|---|---|---|---|
| `STORAGE_PROVIDER` | optional | Private | `RepositoryFactory` | optional | irrelevant (test always uses JSON) | optional (explicit `json` opt-in only) | Defaults to Supabase-if-configured, else fatal outside dev/test |
| `JWT_SECRET` | required outside dev/test | Private | `auth-service.ts` | insecure fallback allowed | insecure fallback allowed | **fails closed** (app refuses to start with a weak/placeholder secret) | App startup failure in prod |
| `REFRESH_SECRET` | required outside dev/test | Private | `auth-service.ts` | same | same | same | same |
| `ADMIN_BOOTSTRAP_PASSWORD` | required (≥12 chars) outside dev/test | Private | `user-db.ts` bootstrap | insecure fallback (random, printed once) allowed | same | fails closed | No default admin seeded |
| `AI_PRIMARY_PROVIDER` | optional | Private | `ai-provider-selector.ts` | optional | optional | optional | Falls through to default precedence |
| `AI_FALLBACK_PROVIDER` | optional | Private | same | optional | optional | optional | Falls through to default CLAUDE>GEMINI>OLLAMA order |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | optional (either activates Ollama) | Private | `ollama-provider.ts` | typical local-dev use | must be absent/hosted-URL-free (guarded — §5) | strongly discouraged (127.0.0.1 unreachable) | Ollama provider simply inactive |
| `OLLAMA_TIMEOUT_MS` | optional | Private | same | optional | optional | optional | Defaults to 120000 |
| `ANTHROPIC_API_KEY` | optional | Private | `claude-client.server.ts` | optional | must be absent from a hosted value (guard doesn't restrict this one specifically, but it's not DB-related) | optional (enables Claude) | Claude provider inactive |
| `GEMINI_API_KEY` | optional | Private | `gemini-provider.ts` | optional | optional | optional (enables Gemini) | Gemini provider inactive |
| `GEMINI_MODEL` | optional | Private | same | optional | optional | optional | Defaults to `gemini-3.6-flash` |
| `NEXT_PUBLIC_SUPABASE_URL` | required for Supabase mode | **Public** (inlined client-side) | `RepositoryFactory` selection, `user-db.ts` dual-write | optional | **guarded — must be a hosted URL to trigger the test-safety abort** | required | Falls back to JSON provider (dev/test) or fatal (prod) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | required for Supabase mode | **Public** | same | optional | same guard applies | required | same |
| `SUPABASE_SERVICE_ROLE_KEY` | optional (used by the legacy dual-write path and GA4 admin reporting) | Private | `user-db.ts`, `ga4-admin-reporting.ts` | optional | must be absent/inert under test | optional | Legacy dual-write / GA4 admin reporting inactive |
| `DATABASE_URL` | required for Supabase mode | Private | `prisma-client.ts` | optional | **guarded — hosted value aborts test run** | required | Falls back to JSON (dev/test) or fatal (prod) |
| `DIRECT_URL` | required for Prisma CLI/migrations | Private | `prisma.config.ts`, CLI migrate commands | optional | same guard | required for `prisma migrate` | Migration commands fail |
| `NEXT_PUBLIC_APP_URL` | recommended | **Public** | `src/lib/cors.ts` (CORS allow-list fallback) | optional | optional | recommended | CORS allow-list becomes empty (safe-by-omission, not a wildcard) |
| `NODE_ENV` | implicitly required | N/A | pervasive | set by tooling | set by `tests/test-env-setup.mjs` | set by Next/Vercel | Affects every fail-closed check above |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | optional | **Public** | `src/lib/analytics.ts` | optional (no-op if unset) | optional | optional | Analytics become no-ops |
| `ALLOWED_ORIGINS` | optional | Private (server config) | `src/lib/cors.ts` | optional | optional | recommended if multiple origins | Falls back to `NEXT_PUBLIC_APP_URL` alone |

No env var referenced in code was found missing from `.env.example`, and no var present in
`.env.example` was found to be dead/unreferenced in code, in the spot-checks performed this pass
(a full bidirectional diff of every env var name across the entire codebase vs. `.env.example` was
not exhaustively automated in this pass).

---

## 31. Dead Code / Stale Architecture Audit

| Item | Classification | Evidence |
|---|---|---|
| "Qwen" references | LEGACY_BUT_NEEDED (as historical comment context) | 5 files, all inside doc-comments describing a past, already-fixed bug — no live Qwen provider code exists |
| `src/engine/remediation-engine.ts` (legacy regex remediation) | LEGACY_BUT_NEEDED | Explicitly kept, per its own header comment, "for its narrow, honest, non-automatic uses" — deliberately never invoked from `ai-remediation-pipeline.ts` |
| `openai` npm dependency | SAFE_TO_REMOVE | Zero code references found anywhere |
| `src/auth/user-db.ts`'s direct-Supabase dual-write | DO_NOT_REMOVE_WITHOUT_MIGRATION (currently) — but see SEC-03: arguably SAFE_TO_REMOVE after confirming `SupabaseStorageProvider` covers every field it syncs | Now safety-guarded but architecturally redundant with the Prisma-based provider |
| Old `REAL-P001..REAL-P020` participant-namespace attempt | ACTIVE historical record only, already fully reverted (per `tests/qa-baseline-cleanup-regression.test.ts`'s own header comment) — nothing left to remove | Confirmed via that test file's doc comment, not independently re-verified for stray leftover references |
| `docs/dissertation/archive/*.SUPERSEDED-*.md` | ACTIVE (intentional archive, not stale) | Clearly named, paired with current non-archived versions |
| VS Code extension's text-heuristic detection (§25) | ACTIVE but architecturally divergent from canonical engine | Not "dead," but a parallel, unsynced implementation — a genuine staleness-adjacent risk (drifts from the real rule catalog by construction) |
| Old participant target "85" | LEGACY, explicitly and correctly superseded | `research-config.ts`'s own doc comment states this was "never itself hardcoded anywhere in this repository" and documents the resolution to 20 |

No orphan AI provider, no duplicate remediation pipeline, and no dead feature flag were found
beyond the items above.

---

## 32. Product Claim vs. Implementation Audit

Searched `app/**` (the actual product UI, not thesis documents) for the specific overclaim phrases
requested. Results:

| Claim searched | Found in product UI? | Verdict |
|---|---|---|
| "Production SaaS" | Not found in `app/page.tsx`; appears only in internal doc-comments/architecture descriptions (e.g. "FIGM SaaS Production Platform" in `.env.example`'s own header, and various source-file header comments) describing the *codebase's own self-description*, not a customer-facing marketing claim | HISTORICAL/internal, not a product-facing overclaim |
| "Production-ready" | Not found in `app/` | N/A |
| "ISO Verified" | Not found anywhere searched | N/A |
| "WCAG compliant" / "WCAG AA" (as a blanket claim) | Not found — all WCAG references found (`app/guidelines/page.tsx`) are scoped to specific numbered Success Criteria per rule | SUPPORTED (the actual, correct usage pattern) |
| "100% accurate" / "zero false positives" | Not found anywhere searched | N/A |
| "AI-powered fixing" | The product does have real, working AI-assisted remediation (§12-14) | SUPPORTED, as a factual description |
| "framework agnostic" / "all frameworks" | The one instance found (`ResearchOverview.tsx`) describes a **gap in existing third-party tools**, not a claim about FIGM's own scope, and FIGM's real scope is explicitly 4 frameworks + generic JS/TS, not literally "all frameworks" | Correctly scoped; not an overclaim as used |
| "enterprise ready" | Not found | N/A |

No instance of a product-facing UI page overclaiming a certification, an accuracy percentage, or
universal framework coverage was found in this pass. The one real claims-adjacent risk identified
is architectural rather than textual: the VS Code extension (§25) could mislead a user into
believing it shares the main engine's real-AST accuracy, if marketed without qualification — no
specific marketing copy for the extension itself was found/reviewed in this pass to confirm
whether such a claim is actually made anywhere (e.g., a VS Code Marketplace listing description
was not available to check).

---

## 33. Real-World Product Readiness

| Use case | Status | Why |
|---|---|---|
| A. Local researcher use | READY | Full local dev path works (JSON fallback or local Supabase), CLI functional, tests pass |
| B. Classroom/demo use | READY | Auth, scanner, admin, and research flows are all real and functional; no fabricated data paths found in the live product surfaces reviewed |
| C. Small beta (trusted users) | READY_WITH_LIMITATIONS | Core flows work; dependency vulnerabilities (§17) and the unaudited-per-route input-validation completeness (§15) should be reviewed first |
| D. Public internet beta | READY_WITH_LIMITATIONS | Same as C, plus: no WAF/bot-mitigation layer evidenced beyond the app's own rate limiter; Next.js version currency (SEC-01) should be addressed before wide public exposure given the volume and nature of the outstanding advisories |
| E. Production SaaS (paying customers) | NOT_READY | SEC-01 (Next.js CVE backlog) and SEC-03 (legacy dual-write path) should be resolved first; per-route input-validation/pagination completeness (§5, §15) should be swept exhaustively rather than spot-checked; no evidence of a formal incident-response/monitoring/alerting layer beyond structured logs was found |
| F. Enterprise use | NOT_READY | All of E, plus: no SSO/enterprise-auth integration found, no evidenced SLA/uptime tooling, no data-residency/compliance documentation reviewed as part of this codebase |

---

## 34. Prioritized Defect List

| ID | Severity | Area | File/Path | Description | Evidence | User impact | Research impact | Production impact | Recommended fix | Regression test needed? |
|---|---|---|---|---|---|---|---|---|---|---|
| SEC-01 | P1 | Dependencies | `package.json` (`next: ^14.1.0`) | Next.js version has ~20 known GHSA advisories (DoS, cache poisoning, SSRF, XSS variants, endpoint disclosure), fixed only in v16 | `npm audit --omit=dev` | Potential, unconfirmed against this app's exact route/middleware usage | None | High — a public deployment inherits every applicable advisory | Plan and execute a Next.js major upgrade with regression testing | Yes — full suite + manual smoke test post-upgrade |
| D-03/SEC-03 | P2 | Data access | `src/auth/user-db.ts` | Legacy direct-to-Supabase dual-write path exists alongside the canonical Prisma-based provider | Code read, 3 call sites | None directly | None (guarded under test) | Maintainability/consistency risk in production | Remove the dual-write path; rely solely on `RepositoryFactory`/Prisma | Yes — confirm no regression in user/scan creation paths |
| SEC-05 | P4 | Dependencies | `package.json` | Unused `openai` dependency | Zero references found | None | None | Minor bundle/attack-surface | Remove from `package.json` | No |
| SEC-02 | P3 | Error handling | `app/api/report/route.ts:58` | Raw `err.message` returned to client | Direct code read | Minor info disclosure | None | Low | Return generic message, log server-side | No |
| D-02/SEC-04 | P3 | Auth | cookie (`figm_token`) issuance sites | `Secure`/`HttpOnly`/`SameSite` attributes not re-verified this pass | Not directly confirmed either way | Unknown — flagged for verification | None | Low (Bearer header is primary) | Verify and harden cookie attributes explicitly | Yes, once verified |
| D-01 | P3 | Performance | `app/api/report/route.ts` | Fallback path re-runs a full recursive scan on every request when the cached report file is absent | Direct code read | Slower response for that specific path | None | Low-medium under load, rate-limited | Cache the fallback result, or lower its rate limit further | Optional |
| D-04 | P3 | Scalability | `getResearchDataset()`, several admin list endpoints | Unbounded reads, no pagination | Direct code read | None at current scale | None at current scale (20-participant target) | Will not scale indefinitely | Add pagination/cursoring before scale grows materially | Optional |
| P-01 | P3 | Parser robustness | CLI scan path | No explicit source-size cap outside the HTTP route's 500KB limit | Direct code read | Local-only, developer-triggered | None | Low | Add an equivalent guard to the CLI path for consistency | Optional |
| EXT-01 | P2 | VS Code extension | `vscode-extension/src/diagnostics-provider.ts` | Comment claims "AST rule pattern detection"; implementation is line-text-substring matching covering 5/50 rules | Direct code read | Misleading accuracy expectations for extension users; real false-positive/negative risk from naive heuristics | None | Reputational/claims risk if marketed without qualification | Either wire the extension to the real engine (e.g. via a local server bridge) or correct the comment/marketing to describe it honestly as a lightweight preview | Recommended — a dedicated "extension detects exactly its documented 5 rules, nothing more" guard already exists in spirit via `vscode-score-consistency.test.ts`'s formula check; extend to detection scope |
| TEST-01 | P2 (already resolved) | Test infrastructure | Multiple test files | Local JSON test-storage lacks `participantCode` uniqueness enforcement, unlike production Postgres — caused intermittent false results before this session's fix | `docs/audit/PRE_STUDY_DATA_INTEGRITY_FINAL.md` | None (test-only) | None (already fixed, regression-tested) | None | Already fixed this session | Already added |

No P0 (security/data-loss/research-integrity blocker) was found in current code.

---

## 35. Limitations vs. Bugs (explicit distinction)

- **BUG**: SEC-02 (raw error-message leak), the historical N+1 in `getMatrix` (already fixed),
  the historical confused-deputy JWT `kind`-claim bypass (already fixed), the historical
  UNRESOLVED/AI_UNAVAILABLE conflation (already fixed) — all confirmed via direct code/comment
  evidence as real, previously-manifesting defects, most already remediated.
- **DESIGN LIMITATION**: no data-flow analysis behind the `INVARIANT_ALLOCATIONS`-class rules
  (explicitly self-documented per rule); the deterministic-fix `PATCH_SCOPE` check skipping very
  small/very large files; unbounded research/admin export queries at current scale.
- **RESEARCH SCOPE LIMITATION**: the 20-participant target, RQ4 independent-validation timing,
  and the historical 85-participant figure being superseded — none of these are product bugs, and
  none were treated as such in this audit's scoring.
- **DEPLOYMENT LIMITATION**: Ollama-on-Vercel (§13) is a genuine architecture/network constraint,
  not a code defect — the code correctly refuses to pretend it can reach localhost from a
  serverless function.
- **DOCUMENTATION ISSUE**: the VS Code extension's "AST rule pattern detection" comment (§25) is
  the clearest example found — the code isn't broken, the comment mischaracterizes what the code
  does.
- **OPTIONAL IMPROVEMENT**: removing the unused `openai` dependency, removing the legacy Supabase
  dual-write path, adding pagination to unbounded exports, adding a CLI-side size cap.

---

## 36. Final Product Scorecard (0–10, evidence-based, not inflated)

| Dimension | Score | Evidence basis |
|---|---|---|
| ARCHITECTURE | 8 | Clean layering (routes → repositories → storage abstraction), consistent patterns across a large codebase, well-documented tradeoffs |
| STATIC_ANALYSIS_CORRECTNESS | 8 | Real AST per framework, honest `figmStatus` states, documented per-rule limitations rather than hidden ones; per-rule precision/recall not independently re-measured in this pass (relies on the existing benchmark pipeline) |
| FRAMEWORK_SUPPORT | 7 | 4 real frameworks + generic JS/TS with genuine parsers; Svelte honestly unsupported rather than silently mis-scored |
| PARSER_ROBUSTNESS | 8 | Diagnostic-based error handling, no crash-on-malformed-input path found, sandboxed dynamic execution |
| RULE_TEST_QUALITY | 6 | Strong aggregate guards confirmed passing; exhaustive per-rule positive/negative verification not independently re-performed in this pass |
| REMEDIATION_SAFETY | 9 | Genuinely three-layer verification (syntax, scope, compile+rescan), bounded retries, explicit `verified` semantics, no fabricated-success path found |
| AI_INTEGRATION | 8 | Clean provider abstraction, correct failover logic, secrets never client-exposed, explicit untrusted-data framing; latency risk under provider degradation noted |
| AUTH_SECURITY | 8 | Real JWT revocation via tokenVersion, confirmed IDOR checks, confirmed ADMIN-only gating on every admin route; cookie-attribute hardening unverified this pass |
| DATA_SECURITY | 7 | Strong provider abstraction and fail-closed defaults; legacy dual-write path (SEC-03) and unverified cookie attributes hold this back from higher |
| RESEARCH_DATA_INTEGRITY | 9 | The most rigorously, repeatedly audited subsystem this session; live production DB independently verified clean |
| API_QUALITY | 7 | Consistent auth/role patterns across 37 routes; per-route input-validation completeness not exhaustively re-swept |
| ERROR_HANDLING | 8 | Consistently clean, categorized failures; one confirmed message-leak instance |
| PERFORMANCE | 6 | Real, evidenced fixes for genuine past incidents (connection pooling, N+1); unbounded-query and CLI-size-cap gaps remain |
| SCALABILITY | 5 | Fine at current (dozens-of-users) scale; unbounded reads and no pagination on research/admin data will not scale indefinitely |
| UX | 7 | Real, non-placeholder flows with explicit error/loading/empty states where reviewed; not exhaustively click-through-tested in this pass |
| ACCESSIBILITY | 6 | Genuine ARIA/semantic-HTML usage where reviewed, dedicated regression tests exist; no rendered-browser contrast/keyboard-nav verification performed |
| CI_CD | 8 | Clean pipeline, no secret leakage, no bypassed quality gate, test/prod DB isolation independently verified twice this session |
| DEPLOYABILITY | 7 | Confirmed builds cleanly with zero backend credentials; several real, evidenced Vercel-specific hardening fixes already in place; Ollama-on-Vercel is a known, documented constraint |
| OBSERVABILITY | 7 | Real, structured, DB-backed audit logging doing double duty as rate-limit data; no sensitive-value logging found |
| MAINTAINABILITY | 7 | Extensive, unusually thorough in-code documentation of *why*, not just *what*; offset by the VS Code extension's engine divergence and the legacy dual-write path as sources of future drift |

---

## 37. Final Readiness Matrix

```
LOCAL_DEVELOPMENT_READY=YES
RESEARCH_DEMO_READY=YES
REAL_PARTICIPANT_COLLECTION_READY=YES  (per this session's dedicated, repeated P0 verification)
PUBLIC_BETA_READY=NO — blocking: SEC-01
VERCEL_DEPLOYMENT_READY=YES  (for the Claude/Gemini/deterministic paths; Ollama excluded by design — see §13)
PRODUCTION_SAAS_READY=NO — blocking: SEC-01, SEC-03, D-04 (exhaustive input-validation/pagination sweep not yet performed)
```

---

## 38. Final Self-Audit

```
PRODUCT_ARCHITECTURE_AUDIT=PASS
API_SECURITY_AUDIT=PARTIAL (not every one of 37 routes had every checklist item individually re-verified; sampled deeply, not exhaustively)
AUTHORIZATION_AUDIT=PASS
DATABASE_SAFETY_AUDIT=PASS
RESEARCH_DATA_SAFETY_AUDIT=PASS
RULE_ENGINE_AUDIT=PASS
RULE_CATALOG_AUDIT=PARTIAL (aggregate counts and structure fully verified programmatically; per-rule test-positive/negative not individually re-enumerated for all 50)
FRAMEWORK_SUPPORT_AUDIT=PASS
PARSER_AUDIT=PASS
DETERMINISTIC_FIX_AUDIT=PASS
AI_REMEDIATION_AUDIT=PASS
OLLAMA_INTEGRATION_AUDIT=PASS
INPUT_SECURITY_AUDIT=PARTIAL (core scan/fix path verified strong; regex-DoS surface across dozens of detector files not exhaustively swept)
DEPENDENCY_AUDIT=PASS
SERVER_CLIENT_BOUNDARY_AUDIT=PASS
PERFORMANCE_AUDIT=PARTIAL (no load-test performed; conclusions are code-review-based)
ERROR_HANDLING_AUDIT=PASS
OBSERVABILITY_AUDIT=PASS
UX_AUDIT=PARTIAL (code-evidence-based, not a full manual click-through)
CLI_AUDIT=PASS
VSCODE_EXTENSION_AUDIT=PARTIAL (source reviewed and a significant finding produced; extension was not compiled/run in this pass)
TEST_SUITE_AUDIT=PASS
CI_CD_AUDIT=PASS
VERCEL_DEPLOYMENT_AUDIT=PASS
ENV_CONFIGURATION_AUDIT=PASS
DEAD_CODE_AUDIT=PASS
PRODUCT_CLAIMS_AUDIT=PASS

P0_COUNT=0
P1_COUNT=1
P2_COUNT=3
P3_COUNT=5
P4_COUNT=1

TOTAL_CONFIRMED_ISSUES=10

PRODUCT_SAFE_FOR_REAL_RESEARCH_COLLECTION=YES
PRODUCT_SAFE_FOR_PUBLIC_BETA=NO
PRODUCT_PRODUCTION_READY=NO
```

**Final confirmed local checks (run sequentially, as instructed):**
```
TSC=PASS
TESTS=PASS (1531/1531, 0 failed, 0 skipped)
BUILD=PASS
```
