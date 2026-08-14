# Formal AST Rule Grammar & Predicate Abstraction Specification

## Executive Overview
Phase 2 translates FIGM's 25 core guidelines into mathematical first-order logic predicates over Abstract Syntax Tree ($\mathcal{G}_{\text{AST}}$) node sets and Control Flow Graph ($\mathcal{G}_{\text{CFG}}$) reachability paths. Section 2 below works through 8 representative predicates (the original Performance and Accessibility universal rules) in full first-order-logic derivation detail, as a worked example of the formalization method. The complete, always-current set of all 25 formal predicates -- generated directly from `FORMAL_PREDICATES_MAP` in `src/matrix/four-layer-meta-model.ts`, the same live registry the detection engine itself reads -- is rendered in full in `docs/dissertation/chapter4_implementation.tex` (regenerate via `npm run export-docs`) and in `figm-spec.json`'s `rules[].formalMathematicalPredicate` field (regenerate via `npm run generate-spec`). This file is intentionally not hand-extended to all 25, to avoid a second hand-maintained copy of predicates that could drift from the live registry.

---

## 1. Formal Mathematical Domain Definitions

Let $\mathcal{G}_{\text{AST}} = (N, E)$ represent an Abstract Syntax Tree where:
* $N$ is the set of all AST nodes.
* $E \subseteq N \times N$ is the set of directed parent-to-child structural AST edges.
* $\text{type}(n) \in \Sigma_{\text{AST}}$ denotes the node type identifier of node $n \in N$.
* $\mathcal{S}(n) \in \{ \text{GLOBAL}, \text{MODULE}, \text{FUNCTION}, \text{LOOP}, \text{RENDER}, \text{BLOCK} \}$ denotes the enclosing scope classification of $n$.
* $\text{Attrs}(n): \text{String} \rightarrow \text{Value}$ returns property/attribute values of $n$.
* $\text{Ancestors}(n) = \{ a \in N \mid (a, \dots, n) \text{ is a path in } E \}$.
* $\mathcal{G}_{\text{CFG}} = (V, E_{\text{CFG}})$ represents the Control Flow Graph corresponding to $\mathcal{G}_{\text{AST}}$.

---

## 2. Formal Mathematical Detection Predicates

### 2.1 FIGM-PERF-01: Invariant Object Allocation in Iteration Scopes (`ALP-LOOP-ALLOC`)

#### Mathematical Predicate
$$\forall n \in N, \quad P_{\text{PERF-01}}(n) \iff \Big( \text{type}(n) \in \{ \text{ObjectExpression}, \text{ArrayExpression}, \text{ArrowFunctionExpression}, \text{FunctionExpression} \} \Big) \land \exists a \in \text{Ancestors}(n) : \Big( \mathcal{S}(a) \in \{ \text{LOOP}, \text{RENDER} \} \Big) \land \neg \text{UsesLoopVariable}(n, a)$$

#### First-Order Logic Breakdown
A node $n$ violates `FIGM-PERF-01` if and only if $n$ instantiates a new object literal, array literal, or closure expression, $n$ is contained within an iteration or render ancestor scope $a$, and $n$ does not dynamically reference iteration-variant variables bound by $a$.

---

### 2.2 FIGM-PERF-02: Un-dimensioned Dynamic Layout Elements (`ALP-LAYOUT-ELEMENT`)

#### Mathematical Predicate
$$\forall n \in N, \quad P_{\text{PERF-02}}(n) \iff \Big( \text{IsVisualElement}(n) \Big) \land \neg \Big( \text{HasDimensionAttr}(n, \text{"width"}) \land \text{HasDimensionAttr}(n, \text{"height"}) \Big) \land \neg \text{HasStyleAttr}(n, \text{"aspectRatio"})$$

Where:
$$\text{IsVisualElement}(n) \iff \text{type}(n) \in \{ \text{JSXElement}, \text{VElement}, \text{Element\$1} \} \land \text{TagName}(n) \in \{ \text{"img"}, \text{"video"}, \text{"iframe"}, \text{"embed"} \}$$

#### First-Order Logic Breakdown
A node $n$ violates `FIGM-PERF-02` if and only if $n$ represents a visual media/layout element AST node, but lacks both explicit width/height attributes and explicit CSS `aspectRatio` dimension style properties.

---

### 2.3 FIGM-PERF-03: Unbounded Event Listener Disposal (`ALP-ASYNC-DISPOSAL`)

#### Mathematical Predicate
$$\forall n \in N, \quad P_{\text{PERF-03}}(n) \iff \Big( \text{IsListenerRegistration}(n) \Big) \land \neg \exists d \in \text{TeardownScope}(\mathcal{S}(n)) : \text{IsPairedRemoval}(n, d)$$

Where:
$$\text{IsListenerRegistration}(n) \iff \text{type}(n) = \text{CallExpression} \land \text{MethodName}(n) \in \{ \text{"addEventListener"}, \text{"subscribe"}, \text{"setInterval"} \}$$

#### First-Order Logic Breakdown
A node $n$ violates `FIGM-PERF-03` if $n$ registers an asynchronous target event listener or subscription inside a component scope $\mathcal{S}(n)$, but no matching cleanup/disposal invocation $d$ exists in the unmount/teardown CFG exit paths of $\mathcal{S}(n)$.

---

### 2.4 FIGM-PERF-04: Static Imports in Deferred Execution Paths (`ALP-STATIC-IMPORT`)

#### Mathematical Predicate
$$\forall n \in N, \quad P_{\text{PERF-04}}(n) \iff \Big( \text{type}(n) = \text{ImportDeclaration} \Big) \land \exists c \in N : \Big( \text{IsConditionalScope}(c) \land \text{ReferencesModule}(c, n) \Big)$$

#### First-Order Logic Breakdown
A static import declaration node $n$ violates `FIGM-PERF-04` if the module exported by $n$ is referenced strictly within conditional (`if`, `switch`, dynamic event) execution paths $c$, indicating the module should be dynamically loaded via `import()`.

---

### 2.5 FIGM-A11Y-01: Keyboard Event Parity on Pointer Handlers (`ALP-EVENT-KEYBOARD`)

#### Mathematical Predicate
$$\forall n \in N, \quad P_{\text{A11Y-01}}(n) \iff \Big( \text{IsNonInteractiveElement}(n) \land \text{HasPointerHandler}(n) \Big) \land \neg \Big( \text{HasKeyboardHandler}(n) \land \text{HasTabIndex}(n) \Big)$$

Where:
$$\text{IsNonInteractiveElement}(n) \iff \text{TagName}(n) \in \{ \text{"div"}, \text{"span"}, \text{"section"}, \text{"article"}, \text{"p"}, \text{"a"} \text{ (without href)} \}$$

#### First-Order Logic Breakdown
A node $n$ violates `FIGM-A11Y-01` if $n$ is a non-interactive element that binds a pointer click handler (`onClick`, `onMouseDown`), but fails to bind equivalent keyboard handlers (`onKeyDown`, `onKeyPress`) or specify `tabindex="0"`.

---

### 2.6 FIGM-A11Y-02: Accessible Name and Role for Custom UI Controls (`ALP-ARIA-NAMING`)

#### Mathematical Predicate
$$\forall n \in N, \quad P_{\text{A11Y-02}}(n) \iff \Big( \text{IsCustomInteractiveControl}(n) \Big) \land \neg \Big( \text{HasAttr}(n, \text{"role"}) \land \big( \text{HasAttr}(n, \text{"aria-label"}) \lor \text{HasAttr}(n, \text{"aria-labelledby"}) \big) \Big)$$

#### First-Order Logic Breakdown
A custom interactive control element node $n$ violates `FIGM-A11Y-02` unless it defines both an explicit ARIA `role` attribute and an accessible name attribute (`aria-label` or `aria-labelledby`).

---

### 2.7 FIGM-A11Y-03: ARIA Live Announcer for Dynamic Mutations (`ALP-LIVE-REGION`)

#### Mathematical Predicate
$$\forall n \in N, \quad P_{\text{A11Y-03}}(n) \iff \Big( \text{IsDynamicStatusContainer}(n) \Big) \land \neg \Big( \text{HasAttr}(n, \text{"aria-live"}) \lor \text{Role}(n) \in \{ \text{"status"}, \text{"alert"}, \text{"log"} \} \Big)$$

#### First-Order Logic Breakdown
A container node $n$ that receives dynamic asynchronous status or feedback mutations violates `FIGM-A11Y-03` if it lacks `aria-live` or explicit ARIA status role attributes.

---

### 2.8 FIGM-A11Y-04: Dynamic Focus Containment and Traversal (`ALP-FOCUS-TRAVERSAL`)

#### Mathematical Predicate
$$\forall n \in N, \quad P_{\text{A11Y-04}}(n) \iff \Big( \text{IsOverlayOrModalNode}(n) \Big) \land \neg \Big( \text{HasFocusTrap}(n) \land \text{RestoresFocusOnUnmount}(n) \Big)$$

#### First-Order Logic Breakdown
An overlay or modal element node $n$ violates `FIGM-A11Y-04` if it opens without containing focus or unmounts without programmatically restoring focus to the originating trigger element.

---

## 3. Abstract Syntax Node Mapping Matrix

| Framework | Native AST Node Type | FIGM ALP Target | Selector Pattern / Query |
| :--- | :--- | :--- | :--- |
| **React JSX** | `JSXElement[openingElement.name.name="div"]` | `ALP-EVENT-KEYBOARD` | `JSXElement:has(JSXAttribute[name.name="onClick"]):not(:has(JSXAttribute[name.name="onKeyDown"]))` |
| **React JSX** | `JSXElement[openingElement.name.name="img"]` | `ALP-LAYOUT-ELEMENT` | `JSXElement[openingElement.name.name="img"]:not(:has(JSXAttribute[name.name="width"]))` |
| **Vue SFC** | `VElement[name="div"]` | `ALP-EVENT-KEYBOARD` | `VElement[name="div"]:has(VDirective[key.name.name="on"][key.argument.name="click"])` |
| **Vue SFC** | `VElement[name="img"]` | `ALP-LAYOUT-ELEMENT` | `VElement[name="img"]:not(:has(VAttribute[key.name="width"]))` |
| **Angular** | `Element$1[name="div"]` | `ALP-EVENT-KEYBOARD` | `Element$1[name="div"]:has(BoundEvent[name="click"])` |
| **ESTree JS** | `CallExpression[callee.property.name="addEventListener"]` | `ALP-ASYNC-DISPOSAL` | `CallExpression[callee.property.name="addEventListener"]` |
| **ESTree JS** | `ImportDeclaration` | `ALP-STATIC-IMPORT` | `ImportDeclaration` |
