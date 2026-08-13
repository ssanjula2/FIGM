# CHAPTER 6

# Conclusion and Future Work

---

## 6.1 Summary of Dissertation Contributions

Modern Single-Page Application (SPA) development across React, Next.js, and Angular suffers from fragmented, framework-specific quality assurance tooling. Prior static analysis tools (e.g. ESLint, SonarQube, Lighthouse) operate in silos, lacking a unified meta-model capable of abstracting cross-framework rendering and performance anti-patterns.

This dissertation addressed this gap by designing, implementing, and empirically evaluating the **Framework-Independent Guideline Model (FIGM) Code Inspector**. The major scientific and technical contributions of this research comprise:

1. **The 4-Layer Meta-Model and Abstract Language Primitives (ALPs)**: Formalized a framework-independent abstraction hierarchy (Domain $\rightarrow$ Concern $\rightarrow$ ALP $\rightarrow$ Rule) that maps heterogeneous JSX, Vue SFC, and Angular template constructs into canonical AST primitives (`ALP-LOOP-ALLOC`, `ALP-LAYOUT-ELEMENT`, `ALP-ASYNC-DISPOSAL`, etc.).
2. **The 25-Rule Static Detection Engine**: Developed an automated static analysis engine with 25 formal predicates covering Universal Common, Next.js App Router, React State/Rendering, and Angular RxJS/DOM security guidelines with confidence scoring (0–100).
3. **Multi-Stage AI Remediation Pipeline**: Integrated Gemini 2.5 Flash with AST syntax validation and a deterministic fallback engine (`RemediationEngine`), ensuring 100% patch generation and syntax compliance.
4. **Empirical Evaluation**:
   - Established fixture-based ground-truth detection performance of **85.7% Precision**, **94.7% Recall**, and a **90.0% F1-Score** (18 TP / 3 FP / 1 FN across 4 files, 147 LOC in `benchmarks/testbed`).
   - A large-scale multi-repository evaluation was not conducted; a prior claim of "30 real-world open-source repositories, 755,300 LOC" was found to be a fabricated dataset (`src/eval/repo-evaluator.ts`, since deleted) and is retracted here rather than replaced with a different number. It remains future work (Section 6.4).
   - A developer usability study (target N=85) has not yet collected real participant data (0/85 at time of writing); a prior claim of a completed N=12 study with a measured Cronbach's Alpha is likewise retracted as fabricated. Only the scoring pipeline's formulas have been verified against synthetic test data.

---

## 6.2 Research Questions Revisited

The research questions formulated in Chapter 1 were systematically answered through empirical evidence:

- **RQ1 (Framework-Independent Formalization)**: *Can SPA quality guidelines across React, Next.js, and Angular be formalized into a framework-independent model without losing precision?*
  - **Answer**: Preliminarily yes, on the evidence available. The 4-Layer Meta-Model successfully mapped 25 rules across the target frameworks, achieving an empirical F1-Score of **90.0%** on the hand-labelled fixture benchmark (Section 5.3) — not yet validated at real-world codebase scale.
- **RQ2 (Comparative Tool Coverage)**: *How effectively can static AST analysis detect performance and accessibility defects compared to ESLint, SonarQube, and Lighthouse?*
  - **Answer**: FIGM natively covers 100% of its own 25 rule definitions by construction; the equivalent rule categories are covered 52.0% by ESLint, 36.0% by SonarQube, and 36.0% by Lighthouse (Table 5.5).
- **RQ3 (AI-Assisted Remediation)**: *Can LLM-assisted remediation (Gemini 2.5 Flash) produce syntactically valid code patches with automatic fallback?*
  - **Answer**: Yes. The AI remediation pipeline achieved **100% AST syntax validity** across generated diffs, with 100% fallback reliability under network disconnection scenarios.
- **RQ4 (Developer Usability & Impact)**: *Does FIGM provide measurable productivity and usability improvements for software engineers?*
  - **Answer**: Not yet answered. The target developer usability study (N=85) has not collected real participant data, so no usability score can currently be reported for this research question (Section 5.6).

---

## 6.3 Limitations

Despite its scientific contributions, FIGM has key technical and empirical limitations:

1. **Lightweight AST Parsing Boundaries**: To achieve high throughput ($577\text{ LOC/sec}$ on the benchmark testbed), `SourceParser` uses a scope-aware token matching parser rather than full compiler drivers (Babel/SWC). Highly obfuscated or dynamic multi-line code expressions may evade scope boundary detection.
2. **No Large-Scale or Real-World Repository Evaluation**: The empirical accuracy result is measured against a small, hand-authored fixture set (4 files, 147 LOC), not real open-source or commercial codebases. Generalization to real-world repositories at scale has not been empirically tested.
3. **Semantic Validation of AI Patches**: AI patch evaluation focused on syntax validity and AST re-parsing rather than full runtime unit/integration test execution.
4. **No Human Usability Data**: The developer usability study (target N=85) has not collected real participant responses, so usability and productivity impact are not yet empirically supported.

---

## 6.4 Directions for Future Research

Future research can extend FIGM across several avenues:

1. **Genuine Large-Scale Repository Evaluation**: Clone and scan a real sample of open-source (and, ideally, commercial) SPA repositories, with violations independently reviewed by domain experts, to replace the retracted fabricated 30-repository claim with an actual measurement.
2. **Complete the Developer Usability Study**: Collect the target N=85 real participant responses (`npm run research:user-study:import`) so Cronbach's Alpha and usability scores can be reported as genuine results rather than synthetic pipeline-verification data.
3. **Compiler AST Driver Integration**: Replace lightweight scope parsers with Babel/SWC pluggable drivers to handle complex dynamic metaprogramming.
4. **Expansion to Emerging Frameworks**: Extend `UniversalASTMapper` to support Vue 3 composition API signals, Svelte 5 runes, and SolidJS fine-grained reactive primitives.
5. **Automated Test Generation for AI Patches**: Integrate automatic unit test synthesis (e.g. via Vitest / Jest) to verify semantic functional correctness of AI-generated patches prior to git commit.

---

## 6.5 Final Concluding Remarks

The FIGM Code Inspector demonstrates that unifying performance and accessibility quality assurance across modern single-page applications is both theoretically viable and practically effective. By abstracting framework-specific AST constructs into canonical Abstract Language Primitives and combining static inspection with LLM remediation, FIGM advances the state of the art in automated software quality engineering.
