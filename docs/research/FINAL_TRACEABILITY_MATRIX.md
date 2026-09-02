# Final Traceability Matrix

Statuses: VERIFIED / PARTIAL / MISSING / NOT_TESTED / HUMAN_DATA_PENDING / EXPERIMENT_PENDING / HUMAN_CONFIRMATION_REQUIRED / NOT_APPLICABLE

**Updated 2026-09-03**: the Proposal (`Research Proposal new.docx`) and Interim 02
(`28256_Interim 02.docx`) were read in full this session and confirm **Set B is authoritative**
(see `FINAL_RESEARCH_CONTRACT.md` Section 1 and `docs/audit/FINAL_RESEARCH_CONTRACT_RECONCILIATION_REPORT.md`).
"Proposal Req." and "Interim 02 State" columns below are now filled with real sourced values where
this reconciliation touched a row; rows not part of this reconciliation still read "UNKNOWN" because
they were not re-verified this pass, not because no answer exists. Where Set A (current dissertation
wording) and Set B (now-confirmed authoritative wording) diverge, both are still addressed, but Set
B is marked as authoritative rather than presented as an open, symmetric ambiguity.

**Further updated 2026-09-03 (same day, following turn):** the researcher explicitly confirmed (1)
the final participant target is 20 (a later approved research-scope decision, Proposal/Interim02's
80-100 preserved as historical baseline) and (2) formal ethics approval exists. Both rows below are
updated accordingly. See `docs/audit/STAGE_1_RESEARCH_CONTRACT_CLOSE_REPORT.md`.

| Requirement | Authoritative Source | Proposal Req. | Interim 02 State | Current Implementation | Test Evidence | Evaluation Evidence | Status | Remaining Work |
|---|---|---|---|---|---|---|---|---|
| Main Research Question | **RESOLVED: Set B, sourced from Interim02 §1.4** (Proposal does not state one separately, does not contradict) | Not stated separately | §1.4, stated explicitly | Aim statement compatible with both (§2) | — | — | **VERIFIED (source)** / dissertation text not yet updated | Add to `chapter1_introduction.md` |
| RQ1 | **RESOLVED: Set B is authoritative, verbatim in both Proposal §2.3 and Interim02 §1.4** (Set A, in the current dissertation, is now confirmed to be an unapproved divergence) | §2.3: FCP/TTI, explicit | §1.4: identical | Formalization: real (50-rule meta-model, this is Set A's framing). FCP/TTI (authoritative Set B): not built | `tests/wcag-mapping-integrity.test.ts`, rule-catalog tests | `figm-spec.json`, `docs/evidence/canonical-evaluation.json` | **PARTIAL** (Set A framing) / **MISSING** (authoritative Set B) | Build RQ1 FCP/TTI experiment (human decision on experimental factors required first); correct dissertation Set A → Set B |
| RQ2 | **RESOLVED: Set B authoritative** (WCAG-aligned framework-agnostic pattern standardization) | §2.3: explicit | §1.4: identical | Tool comparison table exists (Ch.5 §5.2, serves the now-superseded Set A framing). WCAG-aligned patterns exist (7 A11Y rules, corrected mapping this session) — this directly serves the authoritative Set B | `tests/wcag-mapping-integrity.test.ts` | `figm-spec.json` A11Y section | **ANSWERED** (Set B, WCAG patterns) / Set A's tool-comparison framing now superseded | Correct dissertation Set A → Set B |
| RQ3 | Consistent in spirit both sets; Proposal/Interim02 wording matches "Set B" pre-deployment-detection framing | §2.3: explicit | §1.4: identical | Deterministic-first routing verified; AI patch verification chain verified, no false-VERIFIED path found | `tests/sandbox-validation-pipeline.test.ts`, `tests/remediation-engine-regressions.test.ts` | Real pipeline trace, this and prior sessions | **VERIFIED** (core mechanism) | — |
| RQ4 | **RESOLVED: Set B authoritative** — P/R/F1 vs. manual expert review explicitly required | §2.3: explicit | §1.4: identical | Usability infra real, 0 participants (serves now-superseded Set A framing). Expert-annotation infra real, 0 submissions — this directly serves the authoritative Set B | `tests/anti-hardcoding-guard.test.ts`, `tests/user-study-canonical-path.test.ts` | `research/analysis/usability-results.json` (honest 0), `research/independent-annotation/results/STATUS.md` (PENDING) | **HUMAN_DATA_PENDING** (authoritative Set B: recruit real experts) | Real expert annotators (Set B priority); correct dissertation Set A → Set B |
| Aim | Compatible both sets; Proposal §2.2/Interim02 §1.6 confirm the top-level aim, dissertation elaborates the means | §2.2: stated | §1.6: consistent | Real 4-layer meta-model + verified remediation pipeline (elaboration of Proposal's aim, not a contradiction) | Full suite | `figm-spec.json` | **VERIFIED** | Optional: add explicit traceability link in dissertation text |
| OBJ1-4 | **RESOLVED: Proposal §2.3 / Interim02 §1.7.1-1.7.4, consistent, mirror RQ1-4** — dissertation currently has none (lists 4 retrospective "Contributions" instead) | §2.3: OBJ1-4 stated | §1.7.1-1.7.4: same 4, reworded | See RQ1-4 rows | — | — | **MISSING from dissertation** | Add Objectives 1-4 to `chapter1_introduction.md` |
| Framework-independent model | Both | UNKNOWN | UNKNOWN | 4-layer meta-model real, `primaryResearchDomain` taxonomy fixed this session | `tests/rule-catalog-consistency.test.ts` | `figm-spec.json` | **VERIFIED** (model) / **PARTIAL** (uniform detection — 15/50 rules framework-gated, precisely documented this session) | — |
| React | Both | Primary | Primary | FULL — real-AST, deterministic+AI fix, real-world evidence | Multiple | `benchmarks/real-world/raw-results/` | **VERIFIED** | — |
| Next.js | Both | Primary | Primary | FULL | Multiple | Same | **VERIFIED** | — |
| Angular | Both | Primary | Primary | FULL — template rules real-AST via `angular-html-parser` for ANG-03/04/08/10; class-body rules real-AST generally; but 6/24 static-perf + several architecture rules fall back to legacy on Angular specifically (see corrected `chapter3_methodology.md` §3.2.1) | Multiple | Same | **VERIFIED core** / **PARTIAL uniform detection** | Extend real-AST to Angular template context for the JSX-gated rule subset if desired |
| Vue extension | Both (additional support) | Additional | Additional | PARTIAL — 6/6 Vue-specific rules real-AST; universal rules (15) legacy on Vue | Multiple | Same | **VERIFIED as scoped** (correctly not primary) | — |
| Architecture | Set B explicit domain | UNKNOWN | UNKNOWN | 19 rules, own `primaryResearchDomain` bucket (new this session) | `tests/wcag-mapping-integrity.test.ts` | `figm-spec.json` | **PARTIAL** (0/19 adversarial tests) | Add adversarial coverage |
| Code Quality | Overlaps Architecture | UNKNOWN | UNKNOWN | Same 19-rule bucket | Same | Same | **PARTIAL** | Same |
| Performance | Both | UNKNOWN | UNKNOWN | 24-rule STATIC_PERFORMANCE bucket real; 0 runtime | Multiple | `figm-spec.json` | **PARTIAL** (static) / **MISSING** (runtime) | RQ1 experiment if required |
| Accessibility | Both | UNKNOWN | UNKNOWN | 7 rules, WCAG mapping corrected this session | `tests/wcag-mapping-integrity.test.ts` (8 tests) | `figm-spec.json` | **PARTIAL** | — |
| WCAG 2.2 | Both | UNKNOWN | UNKNOWN | Per-rule SC mapping now correct and rationale-backed (was broken: all 7 collapsed onto SC 2.1.1, fixed this session) | `tests/wcag-mapping-integrity.test.ts` | `figm-spec.json` | **VERIFIED (mapping correctness)** / never "full compliance" | — |
| Static analysis | Both | UNKNOWN | UNKNOWN | Real pipeline, 0 crashes on 843 real files (prior real-world run) + this session's fresh re-run (Section below) | Full suite | Real-world raw results | **VERIFIED** | — |
| Rendering strategies | Set B RQ1 | UNKNOWN | UNKNOWN | Not measured (no runtime infra) | — | — | **MISSING** | Human decision required (experimental factors) |
| State-management strategies | Set B RQ1 | UNKNOWN | UNKNOWN | Not measured | — | — | **MISSING** | Same |
| FCP | Set B RQ1 | UNKNOWN | UNKNOWN | Proxy formula only, explicitly disclosed as such in UI | — | — | **MISSING** | Same |
| TTI | Set B RQ1 | UNKNOWN | UNKNOWN | Not measured | — | — | **MISSING** | Same; exact TTI methodology unresolved (Section 41 stop condition) |
| AST parsing | Both | UNKNOWN | UNKNOWN | Real (TS compiler, `@vue/compiler-dom`, `angular-html-parser`) | Multiple | — | **VERIFIED** | — |
| Common representation | Both | UNKNOWN | UNKNOWN | `ASTNode` shared shape across all builders | Multiple | — | **VERIFIED** | — |
| Rule execution | Both | UNKNOWN | UNKNOWN | `RuleExecutionEngine`, real, `figmStatus` honest states | Multiple | — | **VERIFIED** | — |
| Diagnostics | Both | UNKNOWN | UNKNOWN | Real, per-violation, severity/location/remediation | Multiple | — | **VERIFIED** | — |
| Recommendations | Both | UNKNOWN | UNKNOWN | Real, per-rule `remediation` text | — | — | **VERIFIED** | — |
| Deterministic remediation | Both | UNKNOWN | UNKNOWN | ≥30/50 rules (this session's precise count) | `tests/ast-fix-engine.test.ts` etc. | — | **VERIFIED** | — |
| AI-assisted remediation | Both | UNKNOWN | UNKNOWN | Claude primary/Gemini fallback, deterministic-first routing | `tests/ai-remediation*.test.ts` | — | **VERIFIED** | — |
| Validation | Both | UNKNOWN | UNKNOWN | Full sandbox chain, no false-VERIFIED found | `tests/sandbox-validation-pipeline.test.ts` | — | **VERIFIED** | — |
| Re-scan | Both | UNKNOWN | UNKNOWN | Real re-scan, rejects on new violations too | `tests/remediation-engine-regressions.test.ts` | — | **VERIFIED** | — |
| Controlled benchmark | Both | UNKNOWN | UNKNOWN | TP=65/FP=0/FN=0, math re-verified, 100% researcher-authored, 0 negative fixtures | `tests/rule-detection-matrix.test.ts` | `benchmarks/ground-truth.json` | **PARTIAL** (self-fulfilling by construction) | Add negative fixtures |
| Real repositories | Both | **§4.3: 20-30, explicit** | **§3.4: ~20-30, explicit, consistent with Proposal** | 21 (15 primary-framework), expanded and re-run 2026-09-03 (Stage 5) with current engine | `benchmarks/real-world/run-real-world-benchmark.ts` | See below | **MET — target RESOLVED (20-30), current count 21** | RQ4 expert ground truth remains the separate outstanding accuracy requirement (below) |
| Expert ground truth | Both | **§2.3 RQ4: required, explicit** | **§1.4 RQ4: required, identical** | Infrastructure real, 0 submissions | — | `research/independent-annotation/results/STATUS.md` | **HUMAN_DATA_PENDING — requirement RESOLVED as mandatory** | Recruit annotator(s) |
| Precision | Both | UNKNOWN | UNKNOWN | 100% on controlled (self-fulfilling); 39-72% on n=18 real-world spot-check | — | `SPOT_CHECK.md` | **PARTIAL** | Larger real-world sample, expert ground truth |
| Recall | Both | UNKNOWN | UNKNOWN | Same caveats | — | Same | **PARTIAL** | Same |
| F1 | Both | UNKNOWN | UNKNOWN | Same caveats | — | Same | **PARTIAL** | Same |
| Human usability study | Set A RQ4 primarily; participant target per §4.3/§5.2 (historical baseline) | **§4.3/§5.2: 80-100, explicit (historical baseline, preserved)** | **§1.9.2/§3.4/§3.6.1/§3.6.2: ~80-100, explicit, consistent with Proposal, confirmed not yet conducted** | Full pipeline real, consent server-enforced (this session's prior pass), 0 real participants. **Code target = 20 — RESOLVED 2026-09-03 as a later approved research-scope decision (researcher-confirmed), not a conflict** | `tests/user-study-*.test.ts` | `research/analysis/usability-results.json` | **HUMAN_DATA_PENDING (recruitment); participant-target RESOLVED** | Real recruitment against the confirmed 20-participant target |
| SUS | Set A RQ4 | UNKNOWN | UNKNOWN | Real formula, verified against synthetic vectors only | `tests/anti-hardcoding-guard.test.ts` | — | **HUMAN_DATA_PENDING** | Same |
| Cronbach's alpha | Set A RQ4 | UNKNOWN | UNKNOWN | Same | Same | — | **HUMAN_DATA_PENDING** | Same |
| GA4 | Task instructions only | UNKNOWN | UNKNOWN | Implemented, privacy-tested, not live-verified | `tests/analytics-payload-safety.test.ts` | — | **VERIFIED (implementation)** / **NOT_TESTED (live)** | Live verification once deployed |
| Consent | Ethics req. | UNKNOWN | UNKNOWN | Server-enforced via session token (prior session pass) | `tests/anti-hardcoding-guard.test.ts` | — | **VERIFIED (mechanism)** | Ethics approval itself still pending |
| Privacy | Ethics req. | UNKNOWN | UNKNOWN | No PII collected by design; GA4 payload-safe | Multiple | — | **VERIFIED (mechanism)** | — |
| Ethics | Explicit req. | Not captured in extracted text | **§3.6.2: explicit protocol (voluntary, informed, no sensitive PII, aggregated, secure) — matches current implementation** | `ETHICS_APPROVAL_STATUS = CONFIRMED_BY_RESEARCHER` (researcher-confirmed 2026-09-03); `ETHICS_APPROVAL_REFERENCE = TO_BE_RECORDED` (number/date/committee not yet supplied, not fabricated) | — | — | Protocol: **VERIFIED (design)**; approval: **CONFIRMED** | Record the formal reference number when supplied (non-blocking) |
| Web application | Both | UNKNOWN | UNKNOWN | Real Next.js app, builds clean this session | Full suite + build | — | **VERIFIED** | — |
| CLI | Both | UNKNOWN | UNKNOWN | `src/cli/figm-analyze.ts`, same engine as web | `tests/cli-analyzer.test.ts` | — | **VERIFIED** | — |
| VS Code integration | Both | UNKNOWN | UNKNOWN | `vscode-extension/` present, rule catalog synced | — | — | **NOT_TESTED this session** | Verify extension build/package separately |
| Admin/research interface | Both | UNKNOWN | UNKNOWN | Real, server-authorized, no fabricated stats found this pass | `tests/admin-research-dashboard.test.ts` | — | **VERIFIED** | — |
| User/participant interface | Both | UNKNOWN | UNKNOWN | Consent gate + retry-on-failure (prior session), task tracking (this session, GA4) | Multiple | — | **VERIFIED (mechanism)** | Live browser walkthrough pending |

## Real-world repository re-run (this session)

See `benchmarks/real-world/raw-results/_combined-summary.json` (regenerated) and the archived prior
run at `benchmarks/real-world/raw-results-archive/2026-08-25-pre-final-pass/` (preserved, not
overwritten) for the before/after comparison. Full numbers reported in the accompanying
implementation report once the run completed.
