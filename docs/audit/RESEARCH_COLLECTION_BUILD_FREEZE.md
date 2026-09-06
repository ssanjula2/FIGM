# FIGM Research-Collection Build — Freeze Record

Date/time: 2026-09-06
Branch: `main`
Base commit: `2887a66ada624f48cf8946ff94a310dc78de3e93` (`chore(research): finalize thesis stages
and harden study data integrity`)

**Immutable commit hash status:** NOT YET ASSIGNED. The working tree reviewed and verified in
`docs/audit/RESEARCH_COLLECTION_BUILD_FINALIZATION.md` contains uncommitted changes on top of the
base commit above (both this pass's product fixes and a separate, pre-existing, unrelated
thesis-export workstream). This build cannot receive a final immutable commit hash — and therefore
cannot be tagged — until those reviewed changes are committed. Per instruction, that commit is not
made automatically; see the finalization report's "Exact Next Step After Freeze."

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
RESEARCH_COLLECTION_BUILD_READY=YES (pending commit -- see "Immutable commit hash status" above)
```

This record should be re-read and cross-checked against the actual commit hash once the reviewed
changes are committed, so a future reader never confuses "the build that was verified" with "an
uncommitted, potentially-since-changed working tree."
