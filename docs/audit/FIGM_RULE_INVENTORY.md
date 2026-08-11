# FIGM Code Inspector — Authoritative Rule Inventory & Coverage Audit

**Audit Date**: August 11, 2026  
**Total Canonical Rules Implemented**: **25 Rules** (6 Cross-Framework Perf, 6 Cross-Framework A11y, 5 React, 4 Next.js, 4 Angular)  
**Supported Frameworks**: React, Next.js, Angular, Vue.js (Vue SFC)

---

## Authoritative Rule Registry Table

| Rule ID | Rule Name | Framework Domain | Target Construct | Implementation File | Implemented? | Tested? | Fix Available? |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| **FIGM-PERF-01** | Avoid Objects in Loops | Common / Perf | `Loop / Render` | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-PERF-02** | Dimensions on Images | Common / Perf | `<img> / <Image>` | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-PERF-03** | Listener Teardown | Common / Perf | `addEventListener` | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-PERF-04** | Dynamic Imports | Common / Perf | Conditional Import | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-PERF-05** | Inline Arrow Callbacks | Common / Perf | Render Loop Arrow | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-PERF-06** | Storage API in Loops | Common / Perf | `localStorage` | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-A11Y-01** | Keyboard Listener | Common / A11y | `onClick` on Div | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-A11Y-02** | ARIA Roles & Names | Common / A11y | Custom Control | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-A11Y-03** | ARIA Live Announcer | Common / A11y | Dynamic Region | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-A11Y-04** | Focus Restoration | Common / A11y | Modal Component | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-A11Y-05** | Input Form Labeling | Common / A11y | `<input>` element | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-A11Y-06** | Avoid Tabindex > 0 | Common / A11y | `tabindex` | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-REACT-01** | Unstable Key Prop | React | `.map()` JSX | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-REACT-02** | Derived State Anti-pattern | React | `useEffect` setState | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-REACT-03** | Direct State Mutation | React | State Assignment | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-REACT-04** | Missing Hook Dependency | React | `useEffect` deps | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-REACT-05** | Context Value Memoization | React | `<Context.Provider>`| `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-NEXT-01** | Client Component Directive | Next.js | `useState` in RSC | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-NEXT-02** | Next Image Component | Next.js | Native `<img>` | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-NEXT-03** | Next Link Navigation | Next.js | `<a>` tag router | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-NEXT-04** | Window Access in RSC | Next.js | `window` object | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-ANGULAR-01** | Unsubbed RxJS Stream | Angular | `Observable.subscribe`| `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-ANGULAR-02** | TrackBy in ngFor | Angular | `*ngFor` directive | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-ANGULAR-03** | Safe Resource URL | Angular | `bypassSecurity` | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |
| **FIGM-ANGULAR-04** | ChangeDetectionStrategy | Angular | `@Component` config | `src/ast/ast-detection-engine.ts` | Yes | Yes | Yes |

---

## Framework Audit & Labeling Status

- **React**: Full AST + ALP + 5 Framework Rules (Supported)
- **Next.js**: Full App/Pages Router AST + 4 Framework Rules (Supported)
- **Angular**: Component Template AST + 4 Framework Rules (Supported)
- **Vue.js**: Vue SFC (Single File Component) AST Template/Script Parser + Common Rules (Supported)
