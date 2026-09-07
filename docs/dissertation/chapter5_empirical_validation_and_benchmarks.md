# Chapter 5: Testing and Evaluation

## 5.1 Chapter Overview

This chapter reports the technical testing and internal evaluation evidence for the implementation described in Chapter 4: the automated test suite and its coverage categories, a representative sample of individual test cases, the internal controlled benchmark's Precision/Recall/F1 result, verification of the remediation pipeline's re-scan guarantee, a technical (non-accuracy) characterisation of running the tool against a real-world repository corpus, and build/type-check evidence. This chapter is a technical verification chapter, not the dissertation's results chapter: interpretation of the four research questions — including RQ1's FCP/TTI findings and the final judgement on RQ3/RQ4 — is reserved for Chapter 6. Where this chapter refers to RQ1 or RQ4 at all, it is only to state what technical infrastructure exists and was exercised, never to report or interpret a research finding.

## 5.2 Testing Strategy

FIGM's testing strategy combines four verification layers, each targeting a different correctness concern:

1. **Unit and detection-level testing** — verifying that each of the 50 canonical rules fires (and does not fire) correctly against hand-authored positive and negative fixtures, per framework, using Node's built-in test runner (`node --test`).
2. **An internal controlled benchmark** — a single, deterministic, automated pass (`src/eval/evaluation-runner.ts`) re-scoring the entire rule catalogue against hand-labelled ground truth on every test run, so detection accuracy against the project's own specification is re-verified continuously rather than checked only once (§5.5).
3. **Integration and pipeline testing** — exercising the full scan and remediation pipelines end to end, including real network calls to the configured AI providers during the test run itself (not mocked), so the remediation verification gate is tested against genuine provider behaviour, not a stand-in.
4. **Build and static verification** — a full TypeScript compilation check and a production build, confirming the codebase is internally type-consistent and deployable, independently of the test suite's own pass/fail result.

Test isolation is enforced structurally, not only by convention: automated tests never reach a real, hosted database. `npm test` sets no `DATABASE_URL`/`SUPABASE_URL`, so the storage-provider abstraction (Chapter 4, §4.10) falls back to the local JSON-file provider by default; independently of that default, `src/db/db-safety-guard.ts` provides a defense-in-depth check (`assertSafeTestDatabaseEnvironment`) that throws before any Postgres connection is ever constructed if `NODE_ENV === 'test'` and a connection variable resolves to a real, hosted Supabase project, closing the specific residual gap where a CI job's own environment configuration could otherwise leak a production connection string into a test run.

## 5.3 Automated Test Suite

The current automated test suite comprises **99 suites and 1,526 individual tests**, run via Node's built-in test runner (`node --test`, invoked through `tsx` for TypeScript transpilation, at a deliberately serialized concurrency of one). A full, isolated run of the complete suite produced:

```
# suites 99
# tests 1526
# pass 1526
# fail 0
```

This is the current, live-verified result (§5.4 gives one representative regression this run depends on having fixed). It supersedes any earlier count and should not be conflated with historical milestones from earlier in the project's development.

### 5.3.1 Rule and Parser Tests

Cover each of the 50 canonical rules' detection predicate against hand-authored positive (violation) and negative (compliant) fixtures, per applicable framework, plus dedicated regression tests for previously-identified false positives and false negatives (for example, a substring appearing only inside a comment, or an index parameter bound under a non-standard name).

### 5.3.2 Framework Detection and AST Tests

Cover `SourceParser.detectFramework()`'s classification logic (Chapter 4, §4.5.1) — including the Next.js-vs-React distinction, Svelte's detected-but-unsupported status, and Angular/Vue structural detection — and the real-AST builders themselves, including their behaviour on malformed input (an unclosed tag, incomplete destructuring, nested arrow functions), which must degrade gracefully rather than throw.

### 5.3.3 API, Authentication, and Authorization Tests

Cover the JWT issuance/verification logic, role-based authorization on admin routes, rate limiting, and several specific, previously-real regressions: a caller cannot self-assign the `ADMIN` role at registration, a research-participant session token cannot authenticate on an ordinary product route or an admin route, and access-control/ownership checks are enforced server-side rather than relying on the UI to hide a control.

### 5.3.4 Remediation Tests

Cover the deterministic-first routing decision, the AI-provider selection and fallback precedence, the sandbox validation pipeline's individual stages, and — critically — the end-to-end outcome of a remediation attempt under both success and failure conditions, including genuine, non-mocked calls to the configured AI providers during the test run itself.

### 5.3.5 Research-Data Integrity Tests

Cover the research-dataset inclusion filter (consent status, consent timestamp, and the `P001`–`P020` real-study range guard specifically, as distinct from the broader participant-identifier shape pattern used elsewhere), the exclusion of revoked participants and out-of-range/QA fixture codes, the PRIMARY/SECONDARY repeated-scan classification, participant-matrix consistency (§5.4), and the admin-only authorization gate on the research-dataset export route.

## 5.4 Representative Test Cases

Table 5.1 lists one representative test per area required by this stage, quoting each test's actual name from a live, passing run rather than a paraphrase.

**Table 5.1.** Representative test cases.

| Test Area | Representative Test | Purpose | Expected Outcome | Verified Outcome |
|---|---|---|---|---|
| React AST rule | "REGRESSION (found via live production testing): FIGM-REACT-02 gets its own fix, not the A11Y 'clickable element' fallback" | Confirm the dedicated real-AST array-index-key detector (Chapter 4, §4.6.1) is not shadowed by an unrelated rule's fixer | FIGM-REACT-02's own fixer handles its own violation | PASS |
| Angular parsing | "an unclosed tag inside the template never throws — angular-html-parser is error-tolerant" | Confirm the Angular template-markup parser degrades gracefully on malformed input | No exception; a best-effort result is returned | PASS |
| Vue real-AST detection | "[TP] fires when v-for has no :key binding" (FIGM-VUE-01) | Confirm Vue template rules fire via the real `@vue/compiler-dom` AST, not a text heuristic | Violation detected | PASS |
| Framework detection | "FIGM-NEXT-01 restricted to NEXT_JS, never plain REACT_JSX" | Confirm Next.js is classified as a distinct framework from React, not conflated with it | Rule scoped correctly by framework | PASS |
| Remediation verification | "B/G/L: Claude auth failure → automatic Gemini fallback → Gemini produces a genuinely minimal patch → sandbox PASS, compile PASS, FIGM rescan confirms the violation absent → FIXED (same pipeline, not a separate one)" | Confirm the fallback precedence (§5.6) and the re-scan-before-verified gate both hold under a genuine primary-provider failure | Fallback engages; patch accepted only after re-scan confirms the violation is gone | PASS |
| Remediation rejection | "J/K: Claude auth failure → Gemini never produces a valid fix... sandbox/rescan reject both, final result is never FIXED, and the original code is returned completely unmodified" | Confirm a failed remediation attempt never fabricates a "fixed" result | Terminal `UNAVAILABLE`/`UNRESOLVED`, source unchanged | PASS |
| Auth/admin isolation | "a research-participant token cannot authenticate as a real user on an ordinary (role-unrestricted) authenticated route — the confused-deputy fix" | Confirm the `kind`-claim rejection isolating research-participant sessions from ordinary sessions (Chapter 4, §4.9) | Token rejected on ordinary routes | PASS |
| Research-data consent/range guard | "a fresh session is assigned P001 when that exact slot is free" / "P020 is a valid target slot within the participant matrix" | Confirm the real-study range is exactly `P001`–`P020` | Correct slot assignment at both boundaries | PASS |
| Participant matrix consistency | "the batched matrix still reports the correct submission count for a participant with real submissions" | Confirm `getMatrix()` and `getDetail()` agree on submission count for the same participant (regression example, §5.4.1) | Matrix and detail view agree | PASS (fixed this stage — see §5.4.1) |
| PRIMARY/SECONDARY classification | "first eligible post-consent scan of a fixture is chosen as PRIMARY" | Confirm the earliest eligible scan per participant×fixture pair is classified PRIMARY | Correct classification | PASS |

This table is illustrative, not exhaustive; the full suite (§5.3) covers substantially more than these ten cases.

### 5.4.1 Regression Example: Participant-Matrix Consistency

One test in Table 5.1 is included specifically as an example of regression hardening performed during this project's own testing stage, not as a research finding. `ParticipantRepository.getMatrix()` previously built its participant lookup as a `Map` constructed from `[code, user]` pairs, which keeps the *last* entry for a duplicate key; `ParticipantRepository.getDetail()` resolves the same code via an `Array.find`-based lookup, which keeps the *first*. Real production Postgres enforces `participantCode` as a unique column (Chapter 4, §4.10), so two rows sharing a code cannot exist there; the local JSON test-storage backend used only during automated testing did not enforce this same uniqueness, and could accumulate more than one row sharing a code across repeated test runs. When that happened, the two methods could silently resolve to two different physical rows and disagree on submission counts. Both the production lookup logic and the affected test's own fixture-cleanup logic were corrected to resolve duplicates consistently (first-occurrence-wins, matching `getDetail()`), and the fix was verified stable across repeated runs before being folded into the suite-wide result reported in §5.3. **No real production data was affected or at risk** — the underlying ambiguity this regression exercises is only reachable on the local JSON test-storage backend, which real deployed Postgres data never uses.

## 5.5 Internal Controlled Benchmark

FIGM's canonical internal benchmark re-scores the entire 50-rule catalogue on every test run, using `benchmarks/testbed/` (hand-authored fixtures) scored against `benchmarks/ground-truth.json` (hand-labelled expected violations), via a deterministic script (`src/eval/evaluation-runner.ts`) that re-runs the live rule-execution engine and diffs its output against the ground truth — no cached or hand-typed confusion matrix is used at any step. The current, live-verified result:

| Metric | Value |
|---|---|
| True Positives (TP) | 65 |
| False Positives (FP) | 0 |
| False Negatives (FN) | 0 |
| Precision | 100% |
| Recall | 100% |
| F1-Score | 100% |
| Rule coverage | 50 / 50 |

**This is an internal controlled fixture benchmark, and is described as such throughout this dissertation, never as an unqualified accuracy claim.** Three points are stated explicitly:

- The fixtures in `benchmarks/testbed/` and the hand-labels in `benchmarks/ground-truth.json` were both authored by this project, not by an independent third party.
- This benchmark validates that each rule's implementation behaves as its own formal specification (Chapter 3, §3.3.3) intends — a genuine, reproducible measurement of internal consistency — not independent external validation that FIGM correctly handles real-world code it was not built and tuned against.
- **This result is never used as evidence toward RQ4** (§5.5.1). This dissertation does not state "FIGM is 100% accurate"; every reference to this figure is qualified as the internal, self-authored benchmark result it is.

### 5.5.1 RQ4 Boundary

RQ4 asks to what extent the tool's accuracy compares against **independent, real human expert review**, using Precision, Recall, and F1-score computed against expert-supplied labels (Chapter 3, §3.6). The internal benchmark above cannot answer this question by construction, since it is not independent of the tool under test. As of this writing, the independent expert-validation protocol exists and is frozen (67 cases, 1,717 case×rule judgement rows — Chapter 3, §3.6), but **no real independent expert submission has been received**; RQ4 therefore remains **PENDING**, and no external Precision/Recall/F1 figure is stated anywhere in this dissertation. This status is a data-collection outcome, reported in full in Chapter 6, not a technical-testing result reported here.

### 5.5.2 A Superseded, Disqualified Benchmark

A separate, older internal script (`src/eval/functional-validator.ts`) previously produced a different figure — 25/50 rule coverage, 96.15% Precision, 100% Recall, 98.04% F1 — using its own hard-coded fixture array, which was never extended when the canonical catalogue grew to 50 rules. This figure is **obsolete and is not used anywhere in this dissertation**. It is noted here only as a brief provenance/audit note: the discrepancy was traced to that script's stale, half-sized fixture set, not to any defect in the current, canonical benchmark reported in §5.5 above, and the two must not be confused with one another.

## 5.6 Remediation Verification

Two remediation architectures must be kept distinct, and this dissertation is careful throughout to do so:

**A. Current production remediation architecture** (Chapter 4, §4.7–§4.8): for a detected violation, a deterministic AST-based fixer is attempted first; if none applies, and the rule is not one of the small, explicitly manual-review-only set, the violation is routed to AI-assisted remediation via a three-provider abstraction (Ollama, Claude, Gemini, in a configurable precedence order). Every candidate patch — deterministic or AI-generated — passes a multi-stage validation pipeline (isolation, syntax, minimal-patch scope, framework-structural check, compile-and-re-scan, and an associated test where one exists) before it can be marked `VERIFIED`. **The re-scan stage is unconditional**: a patch is accepted only if a genuine re-scan through the live rule-execution engine confirms the original violation is gone and no new violation has been introduced. This was confirmed directly, both by static inspection of the code (Chapter 4, §4.7.3) and, this session, by observing genuine, non-mocked test runs in which a real provider failure (an authentication error) correctly triggered the documented fallback precedence, and a patch that compiled but left the target violation in place was correctly rejected rather than accepted (Table 5.1's "J/K" case).

**B. The legacy fix-success-rate benchmark** (`benchmarks/fix-success-rate.ts`, via `src/engine/remediation-engine.ts`'s `RemediationEngine.applyQuickFix`): a separate, older utility that measures a different remediation entry point from the one described in A above, run once per rule against that rule's own single canonical example. Its current, verified classification of the 50 rules:

| Classification | Count |
|---|---|
| Rule does not fire on its own canonical example (excluded from the remaining counts) | 12 |
| Requires manual review (this legacy path declines to auto-attempt) | 18 |
| Auto-attempted | 20 |
| — of which verified as fixed | 19 |
| **Total** | **50** |

**This legacy benchmark's counts must not be presented as the current production remediation architecture's coverage.** In particular, the current production architecture's own hard-coded manual-review-only rule set (Chapter 4, §4.7.1) contains only 3 rule identifiers — a different, smaller number again, because it reflects a different code path's policy, not this legacy benchmark's outcome classification. An earlier draft of this material stated "the other 30 correctly route to manual review by rule design" — this figure does not match either this benchmark's own 18, or the production architecture's 3, and is not used in this dissertation.

## 5.7 Real-World Repository Technical Validation

Independently of the accuracy questions in §5.5, FIGM's static validation tool was run, unmodified, against a corpus of 21 real, publicly available open-source repositories (15 primary-framework — React 5, Next.js 5, Angular 5 — plus 6 additional implementation-support — Vue 3, Generic JavaScript/TypeScript 3), to characterise the tool's **robustness, execution behaviour, and rule activity against real, third-party code it was not built or tuned against**. The verified, current result:

| Metric | Value |
|---|---|
| Repositories | 21 |
| Files scanned | 2,512 |
| Files with parse errors | 117 |
| Engine crashes | 0 |
| Total findings | 2,649 |
| — Architecture | 393 |
| — Static Performance | 1,578 |
| — Accessibility | 678 |
| Distinct rules triggered | 36 / 50 |

This is reported here as **technical execution evidence** — the tool completed a full corpus scan without crashing, parsed the overwhelming majority of files successfully, and exercised 36 of its 50 rules against genuine, independently-written code. **No Precision, Recall, or F1-score is computed or claimed from this corpus**, because no independently labelled ground truth exists for it; a small (n=18), purposively-diverse manual spot-check exists separately (`benchmarks/real-world/SPOT_CHECK.md`) but is explicitly disclosed there as too small to generalise into an accuracy figure. This corpus's role in answering RQ3, and its interpretation alongside RQ3's other evidence, is reported in Chapter 6, not here.

## 5.8 Build and Type Verification

Two static-verification checks were run, independently of the test suite:

- `npx tsc --noEmit`: **PASS** — zero type errors across the codebase.
- `npm run build`: **PASS** — a full production build completed successfully, generating a complete route manifest.

These results confirm the codebase is internally type-consistent and that a deployable production build can be produced from the current source tree. **Neither result implies anything about a live deployment's actual behaviour** — deployment-specific evidence (the Vercel configuration, environment-variable categories, and CI/CD scope) is reported in Chapter 4, §4.12, and is not repeated here.

## 5.9 Limitations of Technical Evaluation

The technical evaluation in this chapter has the following disclosed boundaries:

1. **Internal-benchmark circularity.** The §5.5 result is a measurement of internal consistency between FIGM's detectors and this project's own hand-authored expectations for them, not independent external validation.
2. **No independent ground truth for the real-world corpus.** The §5.7 result characterises execution robustness and rule activity, not detection accuracy, for the 21-repository corpus.
3. **Static findings are risk indicators, not runtime measurements.** Every finding this chapter's testing evidence covers is a source-code static-analysis result; none of it measures First Contentful Paint, Time to Interactive, or any other runtime/Core Web Vitals metric (Chapter 3, §3.3.4). RQ1's runtime measurement is a separate experiment, reported in Chapter 6.
4. **Automated accessibility detection covers a statically detectable WCAG 2.2-aligned subset.** No claim of full WCAG 2.2 conformance is made or should be inferred from any figure in this chapter.
5. **RQ4's independent expert validation is a separate, currently pending activity.** Nothing in this chapter substitutes for it, and no external accuracy figure is stated here.

None of these boundaries invalidates the legitimate internal testing this chapter reports — a 1,526/1,526 passing suite, a clean type-check, a clean production build, and a reproducible 50/50-rule internal benchmark are genuine, verified technical results in their own right; they simply answer a narrower question than full research validation, and this chapter is careful not to overstate which question each result actually answers.

## 5.10 Chapter Summary

This chapter reported the technical testing and internal evaluation evidence supporting the implementation described in Chapter 4: a 1,526-test, 99-suite automated suite (currently passing cleanly, following the regression fix documented in §5.4.1), representative test cases spanning rule detection, framework parsing, remediation verification, authentication/authorization, and research-data integrity, the canonical internal controlled benchmark (100% Precision/Recall/F1 against hand-labelled ground truth across all 50 rules, explicitly disclosed as internal and non-substitutive for RQ4), a technical characterisation of the tool's behaviour against a real-world 21-repository corpus, and clean build/type-check results. Chapter 6 now interprets these results, together with the RQ1 controlled experiment and the RQ4 independent-validation status, against the four research questions this dissertation set out to answer.
