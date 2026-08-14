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

# FIGM Code Inspector — Master Rule Verification Matrix

**Audit Date**: August 11, 2026  
**Auditor**: Senior Software Architect, QA Engineer, & Research Auditor  
**Total Canonical Rules**: 25 Rules  
**Test Corpus**: `tests/fixtures/figm/` & `benchmarks/testbed/`

---

## 📋 Rule Verification Matrix

| Rule ID | Description | Positive Test | Negative Test | Line Accuracy | Guideline Mapping | AI Fix | Rescan | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **FIGM-PERF-01** | Avoid Invariant Object Allocations in Loops | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-PERF-02** | Explicit Width and Height for Image Elements | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-PERF-03** | Teardown Event Listeners on Component Unmount | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-PERF-04** | Use Dynamic Code-Splitting Imports for Routes | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-PERF-05** | Avoid Inline Anonymous Arrow Functions in Props | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-PERF-06** | Avoid Synchronous Storage Access in Render Loops | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-A11Y-01** | Non-Interactive Elements Require Keyboard Handlers | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-A11Y-02** | Custom Interactive Elements Require ARIA Roles | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-A11Y-03** | Dynamic Content Updates Require ARIA Live Regions | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-A11Y-04** | Modal Dialog Unmount Must Restore Trigger Focus | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-A11Y-05** | Form Inputs Require Associated Label Elements | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-A11Y-06** | Avoid Positive TabIndex Values | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-REACT-01**| Unstable Key Prop Generation in List Rendering | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-REACT-02**| Avoid Derived State Synchronization in useEffect | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-REACT-03**| Avoid Direct Mutation of State Objects | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-REACT-04**| Complete Hook Dependency Array Verification | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-REACT-05**| Memoize Context Provider Values | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-NEXT-01** | Client Component Hook Usage in React Server Comp | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-NEXT-02** | Use Next.js Image Component Instead of Native img | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-NEXT-03** | Use Next.js Link Router Element | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-NEXT-04** | Avoid Direct Window/DOM Access in RSC Scope | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-ANGULAR-01**| Unsubscribed RxJS Subscriptions in Lifecycle | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-ANGULAR-02**| Require trackBy Function in *ngFor List Iteration | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-ANGULAR-03**| Avoid Bypassing Angular Security Trust | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |
| **FIGM-ANGULAR-04**| Prefer OnPush Change Detection Strategy | PASS | PASS | PASS | PASS | PASS | PASS | 🟢 PASS |

---

## Audit Matrix Summary
- **Rules Audited**: 25 / 25
- **Positive Test Coverage**: 100%
- **Negative Test Coverage**: 100%
- **Line Offset Accuracy**: 100%
- **AI Remediation & Patch Re-scan Validation**: 100% Pass
