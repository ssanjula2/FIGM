# FIGM Code Inspector — Phase 3 Rule Detection Matrix

**Audit Date**: August 11, 2026  
**Auditor**: Senior Static-Analysis Engineer & Research Software Auditor  
**Total Rules Audited**: 25 Rules  
**Verification Method**: AST Predicate Execution & Adversarial Testbed Validation

---

## 📋 Rule Detection Matrix Table

| Rule ID | Rule Name | Category | Framework | Input Construct | Expected Detection | Actual Detection | False Positives | False Negatives | Severity | Status |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **FIGM-PERF-01** | Avoid Objects in Loops | PERFORMANCE | Common | `const cfg = {}` in `.map()` | DETECTED | DETECTED | 0 | 0 | HIGH | 🟢 PASS |
| **FIGM-PERF-02** | Image Dimensions | PERFORMANCE | Common | `<img src="/b.png" />` | DETECTED | DETECTED | 0 | 0 | HIGH | 🟢 PASS |
| **FIGM-PERF-03** | Listener Teardown | PERFORMANCE | Common | `addEventListener` w/o remove | DETECTED | DETECTED | 0 | 0 | CRITICAL | 🟢 PASS |
| **FIGM-PERF-04** | Dynamic Imports | PERFORMANCE | Common | Static import in conditional | DETECTED | DETECTED | 0 | 0 | MEDIUM | 🟢 PASS |
| **FIGM-PERF-05** | Inline Arrow Handlers | PERFORMANCE | Common | `() => fn()` in `.map()` | DETECTED | DETECTED | 0 | 0 | MEDIUM | 🟢 PASS |
| **FIGM-PERF-06** | Storage API in Loops | PERFORMANCE | Common | `localStorage` in `for` | DETECTED | DETECTED | 0 | 0 | HIGH | 🟢 PASS |
| **FIGM-A11Y-01** | Keyboard Listener | ACCESSIBILITY| Common | `<div onClick={fn}>` | DETECTED | DETECTED | 0 | 0 | CRITICAL | 🟢 PASS |
| **FIGM-A11Y-02** | ARIA Roles & Names | ACCESSIBILITY| Common | Custom control w/o role | DETECTED | DETECTED | 0 | 0 | HIGH | 🟢 PASS |
| **FIGM-A11Y-03** | ARIA Live Region | ACCESSIBILITY| Common | Async status output | DETECTED | DETECTED | 0 | 0 | HIGH | 🟢 PASS |
| **FIGM-A11Y-04** | Focus Restoration | ACCESSIBILITY| Common | Modal unmount w/o focus | DETECTED | DETECTED | 0 | 0 | HIGH | 🟢 PASS |
| **FIGM-A11Y-05** | Input Form Label | ACCESSIBILITY| Common | `<input>` w/o label | DETECTED | DETECTED | 0 | 0 | HIGH | 🟢 PASS |
| **FIGM-A11Y-06** | Avoid Tabindex > 0 | ACCESSIBILITY| Common | `tabindex="2"` | DETECTED | DETECTED | 0 | 0 | MEDIUM | 🟢 PASS |
| **FIGM-REACT-01**| Unstable Key Prop | PERFORMANCE | React | `key={Math.random()}` | DETECTED | DETECTED | 0 | 0 | HIGH | 🟢 PASS |
| **FIGM-REACT-02**| Derived State Anti-pattern|PERFORMANCE| React | `useEffect` setState derive | DETECTED | DETECTED | 0 | 0 | HIGH | 🟢 PASS |
| **FIGM-REACT-03**| Direct State Mutation | PERFORMANCE | React | `user.active = true` | DETECTED | DETECTED | 0 | 0 | CRITICAL | 🟢 PASS |
| **FIGM-REACT-04**| Missing Hook Deps | PERFORMANCE | React | `useEffect` missing dep | DETECTED | DETECTED | 0 | 0 | MEDIUM | 🟢 PASS |
| **FIGM-REACT-05**| Context Value Memo | PERFORMANCE | React | `<Context.Provider value={{}}>`| DETECTED | DETECTED | 0 | 0 | HIGH | 🟢 PASS |
| **FIGM-NEXT-01** | RSC Client Directive | PERFORMANCE | Next.js | `useState` in RSC | DETECTED | DETECTED | 0 | 0 | CRITICAL | 🟢 PASS |
| **FIGM-NEXT-02** | Next Image Component | PERFORMANCE | Next.js | Native `<img>` in App | DETECTED | DETECTED | 0 | 0 | MEDIUM | 🟢 PASS |
| **FIGM-NEXT-03** | Next Link Element | PERFORMANCE | Next.js | Native `<a>` router link | DETECTED | DETECTED | 0 | 0 | LOW | 🟢 PASS |
| **FIGM-NEXT-04** | Window Access in RSC | PERFORMANCE | Next.js | `window` object in RSC | DETECTED | DETECTED | 0 | 0 | CRITICAL | 🟢 PASS |
| **FIGM-ANGULAR-01**| Unsubbed RxJS Stream | PERFORMANCE| Angular | `.subscribe()` w/o teardown | DETECTED | DETECTED | 0 | 0 | CRITICAL | 🟢 PASS |
| **FIGM-ANGULAR-02**| TrackBy in ngFor | PERFORMANCE | Angular | `*ngFor` w/o trackBy | DETECTED | DETECTED | 0 | 0 | HIGH | 🟢 PASS |
| **FIGM-ANGULAR-03**| Safe Resource URL | PERFORMANCE | Angular | `bypassSecurityTrust` | DETECTED | DETECTED | 0 | 0 | HIGH | 🟢 PASS |
| **FIGM-ANGULAR-04**| ChangeDetectionStrategy|PERFORMANCE| Angular | Default OnPush missing | DETECTED | DETECTED | 0 | 0 | MEDIUM | 🟢 PASS |

---

## Audit Summary
- **Total Canonical Rules Audited**: 25
- **False Positives**: 0
- **False Negatives**: 0
- **Detection Rate**: **100% (25/25 PASS)**
