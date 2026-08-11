# FIGM Code Inspector — Supervisor Demonstration Checklist

**Audit Date**: August 11, 2026  
**Purpose**: Step-by-step procedure for demonstrating live code inspection, syntax error detection, TS compiler diagnostics, guideline rules, complexity metrics, and AI fix validation to university supervisors and thesis examiners.

---

## 📋 Demonstration Step-by-Step Procedure

### Test 1 — Syntax Error Handling
- **Input Snippet**:
  ```tsx
  const x = ;
  ```
- **Action**: Paste into live scanner at `/live-scan` or `/user-study`.
- **Expected Outcome**:
  - Displays **Syntax Parse Error** badge (Red).
  - Shows line 1, column position.
  - Does NOT silently return 0 violations or pretend code is valid.
- **Status**: 🟢 PASS

---

### Test 2 — TypeScript Compiler Diagnostics
- **Input Snippet**:
  ```ts
  const age: number = "twenty";
  ```
- **Action**: Click Scan.
- **Expected Outcome**:
  - Displays **TypeScript Compiler Error (TYPE-TS-2322)** badge.
  - Displays disclaimer: *"Project context unavailable — type checking is limited to the supplied file."*
  - Separates compiler error from FIGM architectural rules.
- **Status**: 🟢 PASS

---

### Test 3 — React Direct State Mutation
- **Input Snippet**:
  ```tsx
  function Profile({ user }) {
    const handleClick = () => {
      user.profile.active = true;
    };
    return <button onClick={handleClick}>Update</button>;
  }
  ```
- **Action**: Click Scan.
- **Expected Outcome**:
  - Triggers **FIGM-REACT-03: Direct State Mutation Violation**.
  - Highlights `user.profile.active = true;`.
- **Status**: 🟢 PASS

---

### Test 4 — Next.js Server Component Violation
- **Input Snippet**:
  ```tsx
  import { useState } from 'react';
  export default function Header() {
    const [open, setOpen] = useState(false);
    return <header>Nav</header>;
  }
  ```
- **Action**: Click Scan as Next.js file (`header.tsx`).
- **Expected Outcome**:
  - Triggers **FIGM-NEXT-01: React Hook in Server Component**.
  - Recommends adding `"use client"` directive at top of file.
- **Status**: 🟢 PASS

---

### Test 5 — Angular RxJS Subscription Teardown
- **Input Snippet**:
  ```ts
  @Component({ selector: 'app-list' })
  export class ListComponent implements OnInit {
    ngOnInit() {
      this.service.getData().subscribe(data => this.items = data);
    }
  }
  ```
- **Action**: Click Scan.
- **Expected Outcome**:
  - Triggers **FIGM-ANGULAR-01: Unsubscribed RxJS Stream**.
  - Recommends `takeUntilDestroyed` or async pipe.
- **Status**: 🟢 PASS

---

### Test 6 — Vue SFC Parsing & Inspection
- **Input Snippet**:
  ```html
  <template>
    <div @click="openMenu">Menu</div>
  </template>
  <script>
  export default { methods: { openMenu() {} } }
  </script>
  ```
- **Action**: Upload as `Menu.vue`.
- **Expected Outcome**:
  - Detects framework as `VUE_SFC`.
  - Triggers **FIGM-A11Y-01** (Non-interactive element with click listener).
- **Status**: 🟢 PASS

---

### Test 7 — Web Accessibility (WCAG 2.2 AA)
- **Input Snippet**:
  ```tsx
  export function Action() {
    return <div onClick={doAction}>Click Me</div>;
  }
  ```
- **Action**: Click Scan.
- **Expected Outcome**:
  - Triggers **FIGM-A11Y-01: Keyboard Listener Missing**.
  - Standard reference: `WCAG 2.2 AA (Success Criterion 2.1.1 Keyword)`.
- **Status**: 🟢 PASS

---

### Test 8 — Code Complexity Profiling
- **Input Snippet**:
  ```ts
  function evaluate(a, b, c) {
    if (a > 0) {
      for (let i = 0; i < 10; i++) {
        if (b && c) while (c > 0) c--;
      }
    }
    return a;
  }
  ```
- **Action**: View Code Complexity Section.
- **Expected Outcome**:
  - Calculates Cyclomatic Complexity (e.g. 5+).
  - Displays Nesting Depth, LOC, and Risk Rating (`MEDIUM` / `HIGH`).
- **Status**: 🟢 PASS

---

### Test 9 — AI Patch Remediation
- **Input Snippet**: Invariant object in loop (`FIGM-PERF-01`).
- **Action**: Click "Apply AI Quick-Fix".
- **Expected Outcome**:
  - Generates patch hoisting object outside loop.
- **Status**: 🟢 PASS

---

### Test 10 — Re-scan After AI Fix
- **Action**: Re-scan remediated code.
- **Expected Outcome**:
  - Verifies 0 syntax errors.
  - Verifies FIGM-PERF-01 violation is cleared.
  - Displays Status: **FIXED**.
- **Status**: 🟢 PASS
