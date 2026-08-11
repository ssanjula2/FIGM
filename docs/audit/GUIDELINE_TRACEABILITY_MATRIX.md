# FIGM Code Inspector — Phase 7 Guideline Traceability Matrix

**Audit Date**: August 11, 2026  
**Auditor**: Senior Static-Analysis Engineer & Research Software Auditor  
**Standard References**: ISO/IEC 25010:2023 & WCAG 2.2 AA Guidelines  

---

## 📋 Standard Traceability Matrix

| Rule ID | Rule Name | Domain | Concern | Standard Reference | Standard Clause | Explanation | Automated Fix |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **FIGM-PERF-01** | Objects in Loops | PERFORMANCE | RESOURCE_UTILIZATION | ISO/IEC 25010 | 8.2 Performance Efficiency | Invariant allocation in loops increases garbage collection pressure. | Yes |
| **FIGM-PERF-02** | Image Dimensions | PERFORMANCE | LAYOUT_INSTABILITY | ISO/IEC 25010 | 8.2 Performance Efficiency | Un-dimensioned images cause Cumulative Layout Shift (CLS). | Yes |
| **FIGM-PERF-03** | Listener Teardown | PERFORMANCE | ASYNC_LEAKS | ISO/IEC 25010 | 8.2 Performance Efficiency | Un-cleared event listeners cause memory leaks on unmount. | Yes |
| **FIGM-PERF-04** | Dynamic Imports | PERFORMANCE | BUNDLE_SIZE | ISO/IEC 25010 | 8.2 Performance Efficiency | Static imports in conditional paths inflate initial JS bundle. | Yes |
| **FIGM-PERF-05** | Inline Arrow Handlers| PERFORMANCE | RESOURCE_UTILIZATION | ISO/IEC 25010 | 8.2 Performance Efficiency | Arrow functions in render loops cause unnecessary re-renders. | Yes |
| **FIGM-PERF-06** | Storage API in Loops | PERFORMANCE | RESOURCE_UTILIZATION | ISO/IEC 25010 | 8.2 Performance Efficiency | Synchronous storage access inside loops blocks main thread. | Yes |
| **FIGM-A11Y-01** | Keyboard Listener | ACCESSIBILITY| KEYBOARD_ACCESSIBILITY | WCAG 2.2 AA | SC 2.1.1 Keyboard | Non-interactive element click handler lacks keyboard listener. | Yes |
| **FIGM-A11Y-02** | ARIA Roles & Names | ACCESSIBILITY| NAME_ROLE_VALUE | WCAG 2.2 AA | SC 4.1.2 Name, Role, Value | Custom interactive element lacks ARIA role or label. | Yes |
| **FIGM-A11Y-03** | ARIA Live Announcer | ACCESSIBILITY| STATUS_MESSAGES | WCAG 2.2 AA | SC 4.1.3 Status Messages | Dynamic async updates missing aria-live announcer. | Yes |
| **FIGM-A11Y-04** | Focus Restoration | ACCESSIBILITY| FOCUS_ORDER | WCAG 2.2 AA | SC 2.4.3 Focus Order | Modal unmount fails to restore focus to trigger element. | Yes |
| **FIGM-A11Y-05** | Input Form Labeling | ACCESSIBILITY| NAME_ROLE_VALUE | WCAG 2.2 AA | SC 1.3.1 Info and Relationships | Form input missing explicit label element or aria-label. | Yes |
| **FIGM-A11Y-06** | Avoid Tabindex > 0 | ACCESSIBILITY| FOCUS_ORDER | WCAG 2.2 AA | SC 2.4.3 Focus Order | Positive tabindex alters natural document focus order. | Yes |
| **FIGM-REACT-01**| Unstable Key Prop | PERFORMANCE | RESOURCE_UTILIZATION | ISO/IEC 25010 | 8.2 Performance Efficiency | Unstable keys cause total DOM node destruction & re-creation. | Yes |
| **FIGM-REACT-02**| Derived State | PERFORMANCE | ARCHITECTURE | ISO/IEC 25010 | 8.1 Maintainability | Syncing props to state in useEffect causes redundant render pass. | Yes |
| **FIGM-REACT-03**| Direct State Mutation| PERFORMANCE | ARCHITECTURE | ISO/IEC 25010 | 8.1 Maintainability | Mutating state directly breaks React reconciliation. | Yes |
| **FIGM-REACT-04**| Missing Hook Deps | PERFORMANCE | ARCHITECTURE | ISO/IEC 25010 | 8.1 Maintainability | Stale closure hazards from undeclared hook dependencies. | Yes |
| **FIGM-REACT-05**| Context Value Memo | PERFORMANCE | RESOURCE_UTILIZATION | ISO/IEC 25010 | 8.2 Performance Efficiency | Un-memoized context values re-render all consumer components. | Yes |
| **FIGM-NEXT-01** | RSC Client Directive | PERFORMANCE | ARCHITECTURE | ISO/IEC 25010 | 8.1 Maintainability | State hooks used in React Server Component without directive. | Yes |
| **FIGM-NEXT-02** | Next Image Component| PERFORMANCE | LAYOUT_INSTABILITY | ISO/IEC 25010 | 8.2 Performance Efficiency | Native `<img>` used in App Router instead of `<Image />`. | Yes |
| **FIGM-NEXT-03** | Next Link Router | PERFORMANCE | BUNDLE_SIZE | ISO/IEC 25010 | 8.2 Performance Efficiency | Native `<a>` tag triggers full page reload instead of client nav. | Yes |
| **FIGM-NEXT-04** | Window Access in RSC | PERFORMANCE | ARCHITECTURE | ISO/IEC 25010 | 8.1 Maintainability | Accessing `window` in RSC causes SSR hydration errors. | Yes |
| **FIGM-ANGULAR-01**| Unsubbed RxJS Stream| PERFORMANCE | ASYNC_LEAKS | ISO/IEC 25010 | 8.2 Performance Efficiency | Long-lived RxJS subscriptions leak memory on destroy. | Yes |
| **FIGM-ANGULAR-02**| TrackBy in ngFor | PERFORMANCE | RESOURCE_UTILIZATION | ISO/IEC 25010 | 8.2 Performance Efficiency | `*ngFor` without `trackBy` re-renders full DOM list on change. | Yes |
| **FIGM-ANGULAR-03**| Safe Resource URL | PERFORMANCE | ARCHITECTURE | ISO/IEC 25010 | 8.1 Maintainability | `bypassSecurityTrust` bypasses Angular XSS sanitization. | Yes |
| **FIGM-ANGULAR-04**| ChangeDetection | PERFORMANCE | RESOURCE_UTILIZATION | ISO/IEC 25010 | 8.2 Performance Efficiency | Default change detection checks entire tree on any event. | Yes |
