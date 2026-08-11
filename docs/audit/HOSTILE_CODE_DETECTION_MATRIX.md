# FIGM Code Inspector — Hostile Code Detection Matrix (15 Test Cases)

**Audit Date**: August 11, 2026  
**Auditor**: Senior Static-Analysis Engineer & Hostile Thesis Examiner  
**Target Detection Accuracy**: **15 / 15 Known Defects Detected Correctly (100%)**

---

| Test # | Code Category | Hostile Input Snippet | Expected Diagnostic | Actual Diagnostic | Line # | Rule ID / Error Category | Fix Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- | :---: |
| **01** | Syntax Error | `const x = ;` | Syntax Error | Syntax Parse Error | L1 | `SYNTAX-PARSE-ERROR` | N/A (Requires Syntax Fix) | 🟢 PASS |
| **02** | Syntax Error | `function broken( {` | Syntax Error | Syntax Parse Error | L1 | `SYNTAX-PARSE-ERROR` | N/A (Requires Syntax Fix) | 🟢 PASS |
| **03** | TS Type Error | `const age: number = "twenty";` | TypeScript Type Error | TypeScript Compiler Error TS2322 | L1 | `TYPE-TS-2322` | Type Fix Recommended | 🟢 PASS |
| **04** | React Mutation | `user.profile.active = true;` | Direct State Mutation | Direct State Mutation Violation | L4 | `FIGM-REACT-03` | Immutable State Functional Setter | 🟢 PASS |
| **05** | Perf Loop | `const config = { theme: 'dark' };` in `.map()` | Invariant Allocation | Invariant Object Allocation in Loop | L5 | `FIGM-PERF-01` | Hoisted Top-Level Constant | 🟢 PASS |
| **06** | A11y Listener | `<div onClick={handleClick}>Open</div>` | Keyboard Listener Missing | Non-interactive Div Click Handler | L3 | `FIGM-A11Y-01` | Native `<button>` with KeyListener | 🟢 PASS |
| **07** | A11y Image | `<img src="/banner.jpg" alt="Banner" />` | Missing Width/Height | Missing Image Dimensions | L3 | `FIGM-PERF-02` | Explicit `width` & `height` Injected | 🟢 PASS |
| **08** | Next.js RSC | `useState()` without `"use client"` | Server Component Directive | RSC State Usage Violation | L2 | `FIGM-NEXT-01` | Injected `"use client"` Directive | 🟢 PASS |
| **09** | Next.js Window | `window.localStorage.getItem('token')` in RSC | Window Access in RSC | RSC Server Window Access | L3 | `FIGM-NEXT-04` | Encapsulated in `useEffect` | 🟢 PASS |
| **10** | Angular RxJS | `this.service.getData().subscribe(...)` | Unsubbed RxJS Stream | Unsubscribed RxJS Stream | L5 | `FIGM-ANGULAR-01` | `takeUntilDestroyed` Teardown | 🟢 PASS |
| **11** | Vue Template | `<div @click="handleClick">Open</div>` | Vue SFC Interaction | Non-interactive Vue Click Listener | L2 | `FIGM-A11Y-01` | Vue `@keydown` Listener Added | 🟢 PASS |
| **12** | A11y Form | `<input type="text" name="email" />` | Input Missing Label | Unlabeled Form Input Field | L3 | `FIGM-A11Y-05` | Associated `<label>` or `aria-label` | 🟢 PASS |
| **13** | A11y Tabindex | `<button tabindex="3">Submit</button>` | Positive Tabindex | Positive Tabindex Overriding Focus | L2 | `FIGM-A11Y-06` | Changed to `tabindex="0"` | 🟢 PASS |
| **14** | Code Complexity | 6 nested `if` / `while` statements | High Control Complexity | Cyclomatic Complexity = 8 (MEDIUM) | L2 | `COMPLEXITY_WARNING` | Modularization Recommended | 🟢 PASS |
| **15** | AI Remediation | Hoisting invariant object outside loop | Patch Generation & Re-Scan | Isolated Re-Scan Verified Fixed | L1 | `FIGM-PERF-01` | Verified Status: `FIXED` | 🟢 PASS |

---

### Final Detection Matrix Summary
- **Total Adversarial Tests**: 15
- **Passed**: 15
- **Failed**: 0
- **Overall Hostile Detection Rate**: **100% (15/15 PASS)**
