# Structural Taxonomy of Single Page Application (SPA) Quality Defects

## Executive Overview
Single Page Applications (SPAs) execute complex state management, client-side routing, dynamic rendering, and event handling within a unified web browser environment. Unlike traditional multi-page architectures where page transitions reload the DOM and reset client state, SPAs preserve long-lived runtime contexts. This persistence creates specific architectural vulnerabilities in both **Performance** and **Accessibility**.

The Framework-Independent Guideline Model (FIGM) establishes a rigorous taxonomy categorizing SPA defects across two primary domains, ten core architectural concerns (six Performance, four Accessibility), and AST-level Abstract Language Primitives (ALPs) underpinning the 50 canonical FIGM rules.

---

## 1. SPA Performance Defect Domain

Performance defects in SPAs degrade runtime responsiveness, increase memory footprint, induce browser main-thread jank, and impede network efficiency. ISO 25010 categorizes these under *Performance Efficiency* (Time Behaviour, Resource Utilization, Capacity).

```
+-------------------------------------------------------------------------+
|                        SPA PERFORMANCE DOMAIN                           |
+-------------------+-------------------+-------------------+-------------+
|   Bundle Size     |    Async Leaks    |     Invariant     |   Layout    |
|   (Network &      |   (Memory & GC    |    Allocations    | Instability |
|   Parse Cost)     |    Retention)     |   (Main Thread)   | (CLS & UX)  |
+-------------------+-------------------+-------------------+-------------+
```

### 1.1 Bundle Size (Code Splitting & Dynamic Imports)
* **Architectural Concern**: Synchronous inclusion of heavy, non-critical modules into initial application chunks increases First Contentful Paint (FCP) and Time to Interactive (TTI).
* **Root Cause**: Top-level static imports (`import { BigLib } from 'big-lib'`) inside routes, modal views, or conditional utility blocks prevent AST bundlers from creating lazy-loaded chunks.
* **Impact**: Excessive network payload transfer, main-thread JavaScript parse and compilation delay on initial load.
* **ISO 25010 Mapping**: *Resource Utilization (Network & Memory)*.

### 1.2 Async Leaks (Event Listeners & Un-disposed Subscriptions)
* **Architectural Concern**: Long-lived single-page runtimes accumulate detached event listeners, uncleared timers (`setInterval`), and active observable subscriptions across client routing events.
* **Root Cause**: Registration of global target listeners (`window.addEventListener('resize', ...)`) or stream listeners inside component lifecycle scopes without explicit tear-down/disposal logic in unmount boundaries.
* **Impact**: Unbounded heap memory usage growth, garbage collection thrashing, multiple duplicate callback executions, potential browser crashes during extended SPA sessions.
* **ISO 25010 Mapping**: *Resource Utilization (Memory Leakage)*.

### 1.3 Invariant Allocations (Loop & Render Scope Instantiations)
* **Architectural Concern**: Re-creating object literals, array definitions, regex patterns, or inline closure handlers inside high-frequency execution loops or dynamic rendering pipelines.
* **Root Cause**: Defining static constants or helper functions inside render iteration scopes (e.g. `items.map(item => ({ config: { id: item.id } }))`).
* **Impact**: High frequency of short-lived object allocations leading to CPU cache misses, rapid heap generation churn, and frequent Garbage Collection (GC) pauses causing main-thread frame drops.
* **ISO 25010 Mapping**: *Time Behaviour (Latency & Frame Rate Consistency)*.

### 1.4 Layout Instability (Cumulative Layout Shift - CLS)
* **Architectural Concern**: Visual displacement of already-rendered layout elements as async data, media, or dynamic components load into the DOM tree.
* **Root Cause**: Instantiating dynamic elements (images, dynamic wrappers, embedded frames) without explicit dimension attributes (`width`, `height`, `aspect-ratio`, or CSS structural placeholders).
* **Impact**: High Cumulative Layout Shift (CLS) scores, user mis-clicks, poor visual predictability, degradation of Core Web Vitals.
* **ISO 25010 Mapping**: *Usability & Time Behaviour*.

### 1.5 Resource Utilization (Synchronous Storage Access)
* **Architectural Concern**: Blocking main-thread reads of synchronous browser storage APIs from inside high-frequency execution paths.
* **Root Cause**: Calling `localStorage.getItem`/`sessionStorage.getItem` repeatedly inside loop or render-iteration scopes instead of caching the value once.
* **Impact**: Main-thread stalls proportional to iteration count, degraded input responsiveness during scroll/animation.
* **ISO 25010 Mapping**: *Resource Utilization (CPU/Main-Thread)*.

### 1.6 Architecture (Framework Contract Violations)
* **Architectural Concern**: Code that violates a framework's own structural contract for how state, hydration, or caching must be declared -- a category distinct from raw runtime cost, since the defect is architectural non-compliance rather than an allocation or leak.
* **Root Cause**: Using client-only React hooks in a Next.js file without a `"use client"` directive, an App Router page missing an explicit route-segment revalidation declaration, an Angular component missing an explicit change-detection strategy, or Angular code manipulating the DOM directly instead of through `Renderer2`.
* **Impact**: Build-time errors, unpredictable hydration behavior, stale cached content, or SSR/security guarantees silently bypassed.
* **ISO 25010 Mapping**: *Time Behaviour & Maintainability (Architectural Conformance)*.

---

## 2. SPA Accessibility (A11y) Defect Domain

Accessibility defects in SPAs impair users relying on assistive technologies (screen readers, keyboard navigation, dynamic focus tracking). WCAG 2.2 defines normative Success Criteria (SC) for web accessibility.

```
+-------------------------------------------------------------------------+
|                       SPA ACCESSIBILITY DOMAIN                          |
+-------------------+-------------------+-------------------+-------------+
|    SC 2.1.1      |    SC 4.1.2      |    SC 4.1.3      |  SC 2.4.3   |
|     Keyboard      |   Name, Role,     |  Status Messages  |    Focus    |
|   Accessibility   |      Value        |  (ARIA Live)      |    Order    |
+-------------------+-------------------+-------------------+-------------+
```

### 2.1 WCAG 2.2 SC 2.1.1 Keyboard (Operable)
* **Architectural Concern**: Dynamic interactive elements created with non-interactive HTML elements (`<div>`, `<span>`, `<a>` without `href`) that respond only to pointer events (`onClick`, `onPointerDown`).
* **Root Cause**: Binding click handlers without parallel keydown listeners (`Enter`, `Space`) or `tabindex="0"` attributes on non-native interactive AST nodes.
* **Impact**: Keyboard-only users and assistive hardware cannot focus or trigger interactive application features.
* **WCAG 2.2 Mapping**: *SC 2.1.1 Keyboard (Level A)*.

### 2.2 WCAG 2.2 SC 4.1.2 Name, Role, Value (Robust)
* **Architectural Concern**: Custom interactive SPA UI components (custom dropdowns, toggles, tab panels) lacking explicit ARIA roles, states, and accessible names.
* **Root Cause**: Building UI controls without `role="..."`, `aria-label`, `aria-labelledby`, or dynamic state bindings (`aria-expanded`, `aria-selected`, `aria-checked`).
* **Impact**: Screen readers convey custom components as generic elements, failing to convey function or current interaction state to visually impaired users.
* **WCAG 2.2 Mapping**: *SC 4.1.2 Name, Role, Value (Level A)*.

### 2.3 WCAG 2.2 SC 4.1.3 Status Messages (Robust)
* **Architectural Concern**: Asynchronous state changes (form validation outputs, filter updates, toast notifications, search completions) occurring dynamically without page reload.
* **Root Cause**: Dynamically mutating or injecting DOM status nodes without wrapping them in ARIA live regions (`aria-live="polite"`, `aria-live="assertive"`, or `role="status"`/`role="alert"`).
* **Impact**: Screen reader users receive no auditory indication that screen content or system state has changed asynchronously.
* **WCAG 2.2 Mapping**: *SC 4.1.3 Status Messages (Level AA)*.

### 2.4 WCAG 2.2 SC 2.4.3 Focus Order (Navigable)
* **Architectural Concern**: SPA route transitions, modal dialog popups, or dynamic section insertion destroying or resetting logical keyboard focus position.
* **Root Cause**: Inserting dynamic elements into DOM nodes outside the current DOM focus hierarchy, unmounting focused nodes without programmatically re-focusing, or introducing negative `tabindex` anomalies.
* **Impact**: Focus jumps unexpectedly to `<body>`, gets trapped, or bypasses newly inserted modal content during keyboard navigation.
* **WCAG 2.2 Mapping**: *SC 2.4.3 Focus Order (Level A)*.

---

## 3. Structural Data Model Mapping

The structural taxonomy is formalized in TypeScript (`src/types/taxonomy.ts`) providing unified type contracts for:
1. `DomainType` & `ConcernType` enumerations.
2. `AbstractLanguagePrimitive` (ALP) definitions.
3. `GuidelineMetadata` with standard traceability flags.
4. `FIGMMasterSpecification` schema contracts.
