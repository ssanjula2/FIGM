# FIGM 50-Rule Verification Matrix (Canonical Master Specification)

| # | Rule ID | Domain | Severity | Framework Scope | Detection Strategy | Routing Strategy | Fixer Capability | Test Coverage |
|---|---------|--------|----------|-----------------|-------------------|------------------|------------------|---------------|
| 1 | FIGM-PERF-01 | Performance | HIGH | React, Next.js, Vue, Angular, ESTree | AST (ALP-LOOP-ALLOC) | AST_DETERMINISTIC | ts.factory hoist/memoize | Pass |
| 2 | FIGM-PERF-02 | Performance | HIGH | React, Next.js, Vue, Angular, ESTree | AST (ALP-LAYOUT-ELEMENT) | AST_DETERMINISTIC | Safe decline on unknown dims | Pass |
| 3 | FIGM-PERF-03 | Performance | CRITICAL | React, Next.js, Vue, Angular, ESTree | AST (ALP-ASYNC-DISPOSAL) | AST_DETERMINISTIC | ts.factory teardown return | Pass |
| 4 | FIGM-PERF-04 | Performance | MEDIUM | React, Next.js, Vue, Angular, ESTree | AST (ALP-STATIC-IMPORT) | AI_ASSISTED | Architectural reasoning | Pass |
| 5 | FIGM-PERF-05 | Performance | MEDIUM | React, Next.js, Vue, Angular, ESTree | AST (ALP-INLINE-CALLBACK) | AI_ASSISTED | Callback extract / useCallback | Pass |
| 6 | FIGM-PERF-06 | Performance | HIGH | React, Next.js, Vue, Angular, ESTree | AST (ALP-STORAGE-LOOP) | AST_DETERMINISTIC | ts.factory loop hoisting | Pass |
| 7 | FIGM-A11Y-01 | Accessibility | HIGH | React, Next.js, Vue, Angular, ESTree | AST (ALP-EVENT-KEYBOARD) | AST_DETERMINISTIC | role+tabIndex+onKeyDown(Enter/Space) | Pass |
| 8 | FIGM-A11Y-02 | Accessibility | HIGH | React, Next.js, Vue, Angular, ESTree | AST (ALP-ARIA-NAMING) | AST_DETERMINISTIC | role+aria-label attributes | Pass |
| 9 | FIGM-A11Y-03 | Accessibility | HIGH | React, Next.js, Vue, Angular, ESTree | AST (ALP-LIVE-REGION) | AST_DETERMINISTIC | role="status" aria-live="polite" | Pass |
| 10 | FIGM-A11Y-04 | Accessibility | HIGH | React, Next.js, Vue, Angular, ESTree | AST (ALP-FOCUS-TRAVERSAL) | AST_DETERMINISTIC | triggerRef.current?.focus() | Pass |
| 11 | FIGM-A11Y-05 | Accessibility | HIGH | React, Next.js, Vue, Angular, ESTree | AST (ALP-INPUT-LABEL) | AST_DETERMINISTIC | aria-label attribute | Pass |
| 12 | FIGM-A11Y-06 | Accessibility | MEDIUM | React, Next.js, Vue, Angular, ESTree | AST (ALP-TABINDEX-ORDER) | AST_DETERMINISTIC | tabIndex={0} reset | Pass |
| 13 | FIGM-NEXT-01 | Performance | HIGH | Next.js | AST (ImportDeclaration) | AST_DETERMINISTIC | next/image import transform | Pass |
| 14 | FIGM-NEXT-02 | Performance | HIGH | Next.js | AST (JSXElement[next/image]) | AI_ASSISTED | Image optimization props | Pass |
| 15 | FIGM-NEXT-03 | Performance | MEDIUM | Next.js | AST (ImportDeclaration) | AST_DETERMINISTIC | next/font import transform | Pass |
| 16 | FIGM-NEXT-04 | Performance | MEDIUM | Next.js | AST (JSXElement[next/script]) | AI_ASSISTED | strategy="lazyOnload" transform | Pass |
| 17 | FIGM-REACT-01 | Performance | HIGH | React, Next.js | AST (JSXElement in map) | AI_ASSISTED | Stable key identifier | Pass |
| 18 | FIGM-REACT-02 | Performance | HIGH | React, Next.js | AST (JSXAttribute[key=index]) | AST_DETERMINISTIC | item.id key replace | Pass |
| 19 | FIGM-REACT-03 | Performance | CRITICAL | React, Next.js | AST (JSXElement state-in-render) | AST_DETERMINISTIC | useEffect state update wrap | Pass |
| 20 | FIGM-REACT-04 | Performance | MEDIUM | React, Next.js | AST (CallExpression useState) | AI_ASSISTED | Lazy state initializer | Pass |
| 21 | FIGM-ANG-01 | Performance | CRITICAL | Angular | AST (CallExpression zone.run) | AI_ASSISTED | runOutsideAngular transform | Pass |
| 22 | FIGM-ANG-02 | Performance | HIGH | Angular | AST (ClassDeclaration OnDestroy) | AST_DETERMINISTIC | Subject.next/complete teardown | Pass |
| 23 | FIGM-ANG-03 | Performance | HIGH | Angular Template | AST (angular-html-parser *ngFor) | ANGULAR_TEMPLATE_AST | trackBy attribute append | Pass |
| 24 | FIGM-ANG-04 | Performance | HIGH | Angular Template | AST (angular-html-parser method) | ANGULAR_TEMPLATE_AST | Manual review decliner | Pass |
| 25 | FIGM-ANG-05 | Performance | HIGH | Angular | AST (Decorator Component) | AST_DETERMINISTIC | ChangeDetectionStrategy.OnPush | Pass |
| 26 | FIGM-A11Y-07 | Accessibility | HIGH | React, Next.js, Vue, Angular, ESTree | AST (ALP-IMAGE-ALT) | AST_DETERMINISTIC | alt attribute append | Pass |
| 27 | FIGM-REACT-05 | Performance | MEDIUM | React, Next.js | AST (CallExpression useState func) | AI_ASSISTED | Lazy state initializer func | Pass |
| 28 | FIGM-REACT-06 | Performance | HIGH | React, Next.js | AST (CallExpression useEffect deps) | MANUAL_REVIEW_ONLY | Cross-file / infinite loop risk | Pass |
| 29 | FIGM-NEXT-05 | Performance | CRITICAL | Next.js | AST (ImportDeclaration route) | AI_ASSISTED | Dynamic route import | Pass |
| 30 | FIGM-NEXT-06 | Performance | MEDIUM | Next.js | AST (CallExpression fetch cache) | AST_DETERMINISTIC | fetch cache: 'force-cache' | Pass |
| 31 | FIGM-ANG-06 | Performance | HIGH | Angular | AST (CallExpression pipe async) | AI_ASSISTED | RxJS takeUntilDestroyed | Pass |
| 32 | FIGM-VUE-01 | Performance | HIGH | Vue SFC | AST (@vue/compiler-sfc v-for key) | VUE_AST | :key="item.id" bind | Pass |
| 33 | FIGM-VUE-02 | Performance | HIGH | Vue SFC | AST (@vue/compiler-sfc v-for+v-if) | VUE_AST | Manual review decliner (computed) | Pass |
| 34 | FIGM-NEXT-07 | Performance | HIGH | Next.js | AST (CallExpression useRouter) | AI_ASSISTED | App Router useRouter import | Pass |
| 35 | FIGM-NEXT-08 | Performance | HIGH | Next.js | AST (CallExpression useSearchParams) | MANUAL_REVIEW_ONLY | Requires parent <Suspense> | Pass |
| 36 | FIGM-NEXT-09 | Performance | CRITICAL | Next.js | AST (ExportNamedDeclaration metadata) | MANUAL_REVIEW_ONLY | Requires "use client" split | Pass |
| 37 | FIGM-NEXT-10 | Performance | MEDIUM | Next.js | AST (CallExpression fetch revalidate) | AST_DETERMINISTIC | next: { revalidate: 3600 } | Pass |
| 38 | FIGM-VUE-03 | Performance | HIGH | Vue SFC | AST (@vue/compiler-sfc computed) | VUE_AST | Manual review decliner (side-effect) | Pass |
| 39 | FIGM-VUE-04 | Performance | HIGH | Vue SFC | AST (@vue/compiler-sfc computed mut) | VUE_AST | Manual review decliner (mutation) | Pass |
| 40 | FIGM-VUE-05 | Performance | CRITICAL | Vue SFC | AST (@vue/compiler-sfc watch) | AI_ASSISTED | watch flush: 'post' | Pass |
| 41 | FIGM-VUE-06 | Performance | HIGH | Vue SFC | AST (@vue/compiler-sfc reactive) | AI_ASSISTED | shallowRef transform | Pass |
| 42 | FIGM-ANG-07 | Performance | MEDIUM | Angular | AST (Decorator Component inline) | AI_ASSISTED | Template externalization | Pass |
| 43 | FIGM-ANG-08 | Performance | HIGH | Angular Template | AST (angular-html-parser @for) | ANGULAR_TEMPLATE_AST | track item.id rewrite | Pass |
| 44 | FIGM-ANG-09 | Performance | MEDIUM | Angular | AST (ClassDeclaration prop init) | AST_DETERMINISTIC | readonly modifier transform | Pass |
| 45 | FIGM-ANG-10 | Performance | MEDIUM | Angular Template | AST (angular-html-parser async) | ANGULAR_TEMPLATE_AST | Manual review decliner (as alias) | Pass |
| 46 | FIGM-REACT-07 | Performance | CRITICAL | React, Next.js | AST (CallExpression createContext) | AI_ASSISTED | Split context providers | Pass |
| 47 | FIGM-REACT-08 | Performance | CRITICAL | React, Next.js | AST (JSXElement context value) | AI_ASSISTED | useMemo context value | Pass |
| 48 | FIGM-REACT-09 | Performance | HIGH | React, Next.js | AST (CallExpression useMemo) | AI_ASSISTED | Primitive memo dependency | Pass |
| 49 | FIGM-REACT-10 | Performance | HIGH | React, Next.js | AST (CallExpression useCallback) | AST_DETERMINISTIC | Inline function wrap useCallback | Pass |
| 50 | FIGM-REACT-11 | Performance | HIGH | React, Next.js | AST (JSXAttribute value={obj}) | AST_DETERMINISTIC | Provider value useMemo wrap | Pass |

## Routing Summary
- `AST_DETERMINISTIC`: 22 rules (TypeScript Compiler API ts.factory)
- `ANGULAR_TEMPLATE_AST`: 4 rules (angular-html-parser)
- `VUE_AST`: 4 rules (@vue/compiler-sfc)
- `AI_ASSISTED`: 17 rules (Gemini 3.6 Flash + 6-Stage Sandbox)
- `MANUAL_REVIEW_ONLY`: 3 rules (FIGM-NEXT-08, FIGM-NEXT-09, FIGM-REACT-06)
- **Total Canonical Rules**: 50 / 50
