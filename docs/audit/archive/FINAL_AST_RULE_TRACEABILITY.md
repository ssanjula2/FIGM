> **⚠ ARCHIVED — SUPERSEDED.** This document is a dated, point-in-time audit/verification
> snapshot from an earlier stage of the project (see its own "Audit Date" below). Substantial
> remediation has happened since it was written — including the JWT/auth hardening, API
> IDOR/rate-limiting fixes, the real-parser AST migration (Groups 1-4, now 23/25 rules
> real-AST), the live-scan pipeline fix, and the empirical-metrics single-source-of-truth fix
> (`docs/architecture/RULE_ENGINEERING_AUDIT.md`, `docs/evidence/canonical-evaluation.json`,
> `docs/evidence/research-claim-traceability.md`). **Any specific number, percentage, or
> pass/fail verdict below may no longer reflect the current codebase.** It is retained here
> for historical record only — do not cite it as current evidence. For current status, see
> `docs/evidence/canonical-evaluation.json` (empirical benchmark), `docs/evidence/
> research-claim-traceability.md` (claim-by-claim reconciliation), and `audit/new.md` (most
> recent full forensic audit).

---

# FIGM — FINAL AST RULE TRACEABILITY MATRIX

**Project**: Framework-Independent Guideline Model (FIGM) Code Inspector  
**Candidate**: A P H D S Sanjula (Student ID: `28256`)  

---

## FIGM AST DETECTION RULES TRACEABILITY

| Rule ID | Rule Name | Domain | Concern | Primary ALP | AST Detection Predicate | AST Node Types Used | Test Case Verification | Framework Support | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FIGM-PERF-01** | Invariant Allocation in Loop/Render | Performance | Memory Churn | `ALP-LOOP-ALLOC` | `evalPerf01(node)` | `ObjectExpression`, `ArrowFunctionExpression` | `tests/ast-detection-engine.test.ts` | React, Vue, Angular | **VERIFIED** |
| **FIGM-PERF-02** | Un-dimensioned Asset Loading | Performance | Layout Shift | `ALP-LAYOUT-ELEMENT` | `evalPerf02(node)` | `JSXElement`, `VElement` | `tests/ast-detection-engine.test.ts` | React, Vue | **VERIFIED** |
| **FIGM-PERF-03** | Unmanaged Event Listener Disposal | Performance | Memory Leak | `ALP-ASYNC-DISPOSAL` | `evalPerf03(node)` | `CallExpression` | `tests/ast-detection-engine.test.ts` | React, Angular | **VERIFIED** |
| **FIGM-PERF-04** | Static Imports in Deferred Paths | Performance | Bundle Overhead | `ALP-STATIC-IMPORT` | `evalPerf04(node)` | `ImportDeclaration` | `tests/ast-detection-engine.test.ts` | Next.js, Node | **VERIFIED** |
| **FIGM-A11Y-01** | Non-Semantic Interactive Controls | Accessibility | Keyboard / Screen Reader | `ALP-SEMANTIC-CONTROL` | `evalA11y01(node)` | `JSXElement`, `Element` | `tests/ast-detection-engine.test.ts` | React, Vue, Angular | **VERIFIED** |
| **FIGM-A11Y-02** | Missing ARIA Accessible Name | Accessibility | Screen Reader | `ALP-ARIA-LABEL` | `evalA11y02(node)` | `JSXElement` | `tests/ast-detection-engine.test.ts` | React, Vue | **VERIFIED** |
| **FIGM-A11Y-05** | Missing Input Form Label Association | Accessibility | Form Usability | `ALP-LABEL-ASSOC` | `evalA11y05(node)` | `JSXElement` (`<input>`) | `tests/ast-detection-engine.test.ts` | React | **VERIFIED** |
| **FIGM-REACT-01** | Unmemoized Expensive Computation | Performance | CPU Blocking | `ALP-UNMEMOIZED-CALC` | `evalReact01(node)` | `CallExpression` (`.map`, `.filter`) | `tests/ast-detection-engine.test.ts` | React, Next.js | **VERIFIED** |
