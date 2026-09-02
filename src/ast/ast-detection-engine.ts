/**
 * Framework-Independent Guideline Model (FIGM)
 * AST Predicate Evaluator Engine & Diagnostic Error Reporter (Complete 50 Rules)
 */

import { ASTNode, DiagnosticReport, FrameworkType } from '../types/ast-spec.js';
import { UniversalASTMapper } from './universal-ast-mapper.js';
import { FOUR_LAYER_MAPPINGS } from '../matrix/four-layer-meta-model.js';
import { getStandardReference } from '../matrix/standard-clause-mapping.js';

export class ASTDetectionEngine {
  /**
   * Evaluate a normalized AST Node against all 25 FIGM formal predicates
   */
  public static evaluateNode(
    rawNode: ASTNode,
    filePath: string,
    framework: FrameworkType = 'GENERIC_ESTREE'
  ): DiagnosticReport[] {
    const node = UniversalASTMapper.normalizeNode(rawNode, framework);
    const reports: DiagnosticReport[] = [];

    // --- UNIVERSAL COMMON RULES ---
    if (this.evalPerf01(node)) {
      reports.push(this.createReport('FIGM-PERF-01', filePath, node, 'Object or closure literal instantiated inside loop/render iteration scope without hoisting.', 95.0));
    }
    if (this.evalPerf02(node)) {
      reports.push(this.createReport('FIGM-PERF-02', filePath, node, 'Visual media element missing explicit width/height or aspect-ratio attributes causing CLS.', 92.0));
    }
    if (this.evalPerf03(node)) {
      reports.push(this.createReport('FIGM-PERF-03', filePath, node, 'Event listener registered without matching disposal/teardown handler in unmount scope.', 98.0));
    }
    if (this.evalPerf04(node)) {
      reports.push(this.createReport('FIGM-PERF-04', filePath, node, 'Static module import used inside conditional execution scope; should use dynamic import().', 88.0));
    }
    if (this.evalPerf05(node)) {
      reports.push(this.createReport('FIGM-PERF-05', filePath, node, 'Inline anonymous arrow function defined in render scope (loop or non-loop) causing re-instantiation on every render.', 85.0));
    }
    if (this.evalPerf06(node)) {
      reports.push(this.createReport('FIGM-PERF-06', filePath, node, 'Synchronous Web Storage API accessed repeatedly inside iterative loop scope.', 90.0));
    }

    if (this.evalA11y01(node)) {
      reports.push(this.createReport('FIGM-A11Y-01', filePath, node, 'Non-interactive element has pointer click listener but lacks onKeyDown handler or tabindex.', 96.0));
    }
    if (this.evalA11y02(node)) {
      reports.push(this.createReport('FIGM-A11Y-02', filePath, node, 'Custom interactive control element missing explicit ARIA role and accessible name (aria-label).', 94.0));
    }
    if (this.evalA11y03(node)) {
      reports.push(this.createReport('FIGM-A11Y-03', filePath, node, 'Dynamic status or result container receives async mutations without aria-live region announcer.', 91.0));
    }
    if (this.evalA11y04(node)) {
      reports.push(this.createReport('FIGM-A11Y-04', filePath, node, 'Modal or dynamic overlay component unmounts without programmatically restoring focus.', 95.0));
    }
    if (this.evalA11y05(node)) {
      reports.push(this.createReport('FIGM-A11Y-05', filePath, node, 'Form input field missing associated label element or explicit aria-label attribute.', 97.0));
    }
    if (this.evalA11y06(node)) {
      reports.push(this.createReport('FIGM-A11Y-06', filePath, node, 'Positive tabindex > 0 overrides natural document focus navigation order.', 93.0));
    }

    // --- NEXT.JS RULES ---
    if (this.evalNext01(node, framework)) {
      reports.push(this.createReport('FIGM-NEXT-01', filePath, node, 'React state/lifecycle hook called inside Next.js file lacking "use client" directive.', 99.0));
    }
    if (this.evalNext02(node, framework)) {
      reports.push(this.createReport('FIGM-NEXT-02', filePath, node, 'Heavy browser module imported statically in Next.js instead of next/dynamic with ssr: false.', 90.0));
    }
    if (this.evalNext03(node, framework)) {
      reports.push(this.createReport('FIGM-NEXT-03', filePath, node, 'Next.js App Router page missing export const revalidate route segment configuration.', 85.0));
    }
    if (this.evalNext04(node, framework)) {
      reports.push(this.createReport('FIGM-NEXT-04', filePath, node, 'External Google Fonts loaded via CSS link tag causing layout shift; use next/font.', 92.0));
    }

    // --- REACT RULES ---
    if (this.evalReact01(node, framework)) {
      reports.push(this.createReport('FIGM-REACT-01', filePath, node, 'Expensive derived array computation inside render routine should be wrapped in useMemo.', 88.0));
    }
    if (this.evalReact02(node, framework)) {
      reports.push(this.createReport('FIGM-REACT-02', filePath, node, 'Array index assigned as list key prop causing component re-ordering and state bugs.', 96.0));
    }
    if (this.evalReact03(node, framework)) {
      reports.push(this.createReport('FIGM-REACT-03', filePath, node, 'Direct mutation of React state variable skips component re-renders.', 99.0));
    }
    if (this.evalReact04(node, framework)) {
      reports.push(this.createReport('FIGM-REACT-04', filePath, node, 'Callback prop passed inline to child component without React.useCallback wrapper.', 87.0));
    }

    // --- ANGULAR RULES ---
    if (this.evalAng01(node, framework)) {
      reports.push(this.createReport('FIGM-ANG-01', filePath, node, 'RxJS subscription created inside Angular component missing unsubscribe or takeUntilDestroyed.', 98.0));
    }
    if (this.evalAng02(node, framework)) {
      reports.push(this.createReport('FIGM-ANG-02', filePath, node, 'Angular component missing ChangeDetectionStrategy.OnPush specification.', 92.0));
    }
    if (this.evalAng03(node, framework)) {
      reports.push(this.createReport('FIGM-ANG-03', filePath, node, 'Angular *ngFor structural iteration directive missing trackBy function reference.', 95.0));
    }
    if (this.evalAng04(node, framework)) {
      reports.push(this.createReport('FIGM-ANG-04', filePath, node, 'Component method call inside Angular HTML template executes on every change detection cycle.', 90.0));
    }
    if (this.evalAng05(node, framework)) {
      reports.push(this.createReport('FIGM-ANG-05', filePath, node, 'Direct ElementRef nativeElement DOM manipulation bypasses Angular Renderer2 security.', 97.0));
    }

    // --- RESEARCH-BACKED EXPANSION SET (8 rules) ---
    if (this.evalA11y07(node, framework)) {
      reports.push(this.createReport('FIGM-A11Y-07', filePath, node, 'Accessible name (aria-label) does not contain the element\'s visible text label (WCAG 2.5.3).', 89.0));
    }
    if (this.evalReact05(node, framework)) {
      reports.push(this.createReport('FIGM-REACT-05', filePath, node, 'useEffect body consists solely of a state-setter call; this derived value can be computed during render instead.', 84.0));
    }
    if (this.evalReact06(node, framework)) {
      reports.push(this.createReport('FIGM-REACT-06', filePath, node, 'useEffect reads a component prop that is missing from its dependency array.', 82.0));
    }
    if (this.evalNext05(node, framework)) {
      reports.push(this.createReport('FIGM-NEXT-05', filePath, node, 'Node.js server-only module imported into a file marked "use client".', 94.0));
    }
    if (this.evalNext06(node, framework)) {
      reports.push(this.createReport('FIGM-NEXT-06', filePath, node, 'Native <img> element used in a Next.js file instead of the next/image Image component.', 86.0));
    }
    if (this.evalAng06(node, framework)) {
      reports.push(this.createReport('FIGM-ANG-06', filePath, node, 'Angular @Pipe declared with pure: false runs its transform on every change-detection cycle.', 90.0));
    }
    if (this.evalVue01(node, framework)) {
      reports.push(this.createReport('FIGM-VUE-01', filePath, node, 'v-for directive missing a stable :key binding, or bound to the loop index.', 80.0));
    }
    if (this.evalVue02(node, framework)) {
      reports.push(this.createReport('FIGM-VUE-02', filePath, node, 'v-for and v-if directives used together on the same template element.', 83.0));
    }

    // --- SECOND RESEARCH-BACKED EXPANSION SET (17 rules) ---
    if (this.evalNext07(node, framework)) {
      reports.push(this.createReport('FIGM-NEXT-07', filePath, node, 'Component function declared async inside a "use client" file; Client Components do not support async functions.', 93.0));
    }
    if (this.evalNext08(node, framework)) {
      reports.push(this.createReport('FIGM-NEXT-08', filePath, node, 'useSearchParams() called with no <Suspense> boundary visible in this file.', 78.0));
    }
    if (this.evalNext09(node, framework)) {
      reports.push(this.createReport('FIGM-NEXT-09', filePath, node, 'Metadata API export/function present in a file marked "use client".', 94.0));
    }
    if (this.evalNext10(node, framework)) {
      reports.push(this.createReport('FIGM-NEXT-10', filePath, node, 'export const dynamic = "force-dynamic" with no visible request-time dependency in this file.', 74.0));
    }
    if (this.evalVue03(node, framework)) {
      reports.push(this.createReport('FIGM-VUE-03', filePath, node, 'computed() getter body contains a side effect (mutates another ref, or performs an I/O call).', 85.0));
    }
    if (this.evalVue04(node, framework)) {
      reports.push(this.createReport('FIGM-VUE-04', filePath, node, 'Direct mutation of a computed ref\'s .value contents from outside its own definition.', 82.0));
    }
    if (this.evalVue05(node, framework)) {
      reports.push(this.createReport('FIGM-VUE-05', filePath, node, 'Direct mutation of a defineProps()-bound prop.', 90.0));
    }
    if (this.evalVue06(node, framework)) {
      reports.push(this.createReport('FIGM-VUE-06', filePath, node, 'Arrow function used as an Options API method; `this` will not be bound to the component instance.', 92.0));
    }
    if (this.evalAng07(node, framework)) {
      reports.push(this.createReport('FIGM-ANG-07', filePath, node, 'Non-trivial logic in component constructor; move it to ngOnInit or a well-named method.', 80.0));
    }
    if (this.evalAng08(node, framework)) {
      reports.push(this.createReport('FIGM-ANG-08', filePath, node, '@for track expression bound to the index or the bare loop variable instead of a stable identifier.', 84.0));
    }
    if (this.evalAng09(node, framework)) {
      reports.push(this.createReport('FIGM-ANG-09', filePath, node, 'Signal input property missing the readonly modifier.', 88.0));
    }
    if (this.evalAng10(node, framework)) {
      reports.push(this.createReport('FIGM-ANG-10', filePath, node, 'The same observable expression is piped through | async more than once in this template.', 76.0));
    }
    if (this.evalReact07(node, framework)) {
      reports.push(this.createReport('FIGM-REACT-07', filePath, node, 'Hook called inside a conditional, loop, or nested function instead of the top level.', 91.0));
    }
    if (this.evalReact08(node, framework)) {
      reports.push(this.createReport('FIGM-REACT-08', filePath, node, 'Direct mutation of a destructured component prop.', 89.0));
    }
    if (this.evalReact09(node, framework)) {
      reports.push(this.createReport('FIGM-REACT-09', filePath, node, 'I/O or storage call executed directly in the render body instead of an event handler or Effect.', 83.0));
    }
    if (this.evalReact10(node, framework)) {
      reports.push(this.createReport('FIGM-REACT-10', filePath, node, 'Component function called directly instead of rendered as JSX.', 87.0));
    }
    if (this.evalReact11(node, framework)) {
      reports.push(this.createReport('FIGM-REACT-11', filePath, node, 'Context Provider value prop is an unmemoized inline object/array literal.', 86.0));
    }

    // Recursively evaluate children AST nodes
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        reports.push(...this.evaluateNode(child, filePath, framework));
      }
    }

    return reports;
  }

  // --- Predicate Evaluators ---

  private static evalPerf01(node: ASTNode): boolean {
    const isAllocationType = ['ObjectExpression', 'ArrayExpression', 'ArrowFunctionExpression'].includes(node.type);
    const inLoopScope = node.scopeType === 'LOOP' || node.scopeType === 'RENDER';
    const isInvariant = node.attributes?.isInvariant === true;
    return isAllocationType && inLoopScope && isInvariant;
  }

  private static evalPerf02(node: ASTNode): boolean {
    const visualTags = ['img', 'video', 'iframe', 'embed'];
    const isVisual = (node.type === 'JSXElement' || node.type === 'VElement' || node.type === 'Element$1') && visualTags.includes(node.name || '');
    if (!isVisual) return false;

    const attrs = node.attributes || {};
    const hasWidth = attrs.width !== undefined;
    const hasHeight = attrs.height !== undefined;
    const hasAspectRatio = attrs.aspectRatio !== undefined || (typeof attrs.style === 'string' && attrs.style.includes('aspect-ratio'));

    return !(hasWidth && hasHeight) && !hasAspectRatio;
  }

  private static evalPerf03(node: ASTNode): boolean {
    if (node.type !== 'CallExpression') return false;
    const isListener = node.name === 'addEventListener' || node.attributes?.method === 'addEventListener';
    const missingDisposal = node.attributes?.hasPairedRemoval !== true;
    return isListener && missingDisposal;
  }

  private static evalPerf04(node: ASTNode): boolean {
    if (node.type !== 'ImportDeclaration') return false;
    return node.attributes?.referencedInConditional === true;
  }

  private static evalPerf05(node: ASTNode): boolean {
    return node.type === 'ArrowFunctionExpression' && node.attributes?.isInlineCallback === true;
  }

  private static evalPerf06(node: ASTNode): boolean {
    return node.type === 'CallExpression' && node.attributes?.isStorageInLoop === true;
  }

  private static evalA11y01(node: ASTNode): boolean {
    const nonInteractiveTags = ['div', 'span', 'section', 'article', 'p'];
    const isNonInteractive = (node.type === 'JSXElement' || node.type === 'VElement' || node.type === 'Element$1') && nonInteractiveTags.includes(node.name || '');
    if (!isNonInteractive) return false;

    const attrs = node.attributes || {};
    const hasClick = attrs.onClick !== undefined || attrs['v-on:click'] !== undefined || attrs['(click)'] !== undefined;
    const hasKeyboard = attrs.onKeyDown !== undefined || attrs['v-on:keydown'] !== undefined || attrs['(keydown)'] !== undefined;
    const hasTabIndex = attrs.tabIndex !== undefined || attrs.tabindex !== undefined;

    return hasClick && (!hasKeyboard || !hasTabIndex);
  }

  private static evalA11y02(node: ASTNode): boolean {
    // Gate strictly on the isCustomControl flag that buildA11y02 (and its legacy heuristic
    // equivalent) set for real Custom/Select/Dropdown-tag nodes. A prior fallback here --
    // `node.name starts with an uppercase letter` -- matched ANY component node regardless of
    // which rule's builder produced it (evaluateNode runs every eval* against every pushed node),
    // so a node built by buildA11y04 for a compliant `<Modal role="dialog" aria-label="...">`
    // (which never populates role/aria-label -- that's not its job) was misread as "missing"
    // those attributes and flagged FIGM-A11Y-02 even though they were present in the source.
    // Live-verified: benchmarks/testbed/ReactBenchmark.jsx's fully-compliant Modal element.
    const isCustomControl = (node.type === 'JSXElement' || node.type === 'VElement') && node.attributes?.isCustomControl === true;
    if (!isCustomControl) return false;

    const attrs = node.attributes || {};
    const hasRole = attrs.role !== undefined;
    const hasAccessibleName = attrs['aria-label'] !== undefined || attrs['aria-labelledby'] !== undefined;

    return !hasRole || !hasAccessibleName;
  }

  private static evalA11y03(node: ASTNode): boolean {
    const isDynamic = node.attributes?.isDynamicMutation === true;
    if (!isDynamic) return false;

    const attrs = node.attributes || {};
    const hasAriaLive = attrs['aria-live'] !== undefined;
    const hasStatusRole = attrs.role === 'status' || attrs.role === 'alert' || attrs.role === 'log';

    return !hasAriaLive && !hasStatusRole;
  }

  private static evalA11y04(node: ASTNode): boolean {
    // The `isOverlay` attribute (set by both the real-AST and legacy builders whenever the tag
    // matches the canonical Modal/Dialog/Overlay/Drawer allow-list) is the actual detection
    // signal; this `node.name` fallback exists only for a node reaching this predicate with the
    // attribute unset for some other reason, so it is kept in sync with the same four names
    // rather than the stale two-name subset it previously listed.
    const isOverlay = node.attributes?.isOverlay === true || node.name === 'Modal' || node.name === 'Dialog' || node.name === 'Overlay' || node.name === 'Drawer';
    if (!isOverlay) return false;

    const attrs = node.attributes || {};
    const preservesFocus = attrs.restoresFocusOnUnmount === true;
    return !preservesFocus;
  }

  private static evalA11y05(node: ASTNode): boolean {
    return node.type === 'JSXElement' && node.attributes?.isUnlabeledInput === true;
  }

  private static evalA11y06(node: ASTNode): boolean {
    return node.attributes?.positiveTabIndex === true;
  }

  private static evalNext01(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'NEXT_JS' || framework === 'REACT_JSX') && node.attributes?.isClientHookWithoutDirective === true;
  }

  private static evalNext02(node: ASTNode, framework: FrameworkType): boolean {
    return framework === 'NEXT_JS' && node.attributes?.isHeavyStaticImportInNext === true;
  }

  private static evalNext03(node: ASTNode, framework: FrameworkType): boolean {
    return framework === 'NEXT_JS' && node.type === 'ExportNamedDeclaration' && node.attributes?.missingRevalidateConfig === true;
  }

  private static evalNext04(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'NEXT_JS' || framework === 'REACT_JSX') && node.attributes?.isExternalFontLink === true;
  }

  private static evalReact01(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'REACT_JSX' || framework === 'NEXT_JS' || framework === 'GENERIC_ESTREE') && node.attributes?.isExpensiveDerivedStateWithoutMemo === true;
  }

  private static evalReact02(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'REACT_JSX' || framework === 'NEXT_JS' || framework === 'GENERIC_ESTREE') && node.attributes?.isArrayIndexKey === true;
  }

  private static evalReact03(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'REACT_JSX' || framework === 'NEXT_JS' || framework === 'GENERIC_ESTREE') && node.attributes?.isDirectStateMutation === true;
  }

  private static evalReact04(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'REACT_JSX' || framework === 'NEXT_JS' || framework === 'GENERIC_ESTREE') && node.attributes?.isInlineCallbackProp === true;
  }

  private static evalAng01(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'ANGULAR_TEMPLATE' || framework === 'GENERIC_ESTREE') && node.attributes?.isUnsubscribedObservable === true;
  }

  private static evalAng02(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'ANGULAR_TEMPLATE' || framework === 'GENERIC_ESTREE') && node.attributes?.missingOnPush === true;
  }

  private static evalAng03(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'ANGULAR_TEMPLATE' || framework === 'GENERIC_ESTREE') && node.attributes?.isNgForWithoutTrackBy === true;
  }

  private static evalAng04(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'ANGULAR_TEMPLATE' || framework === 'GENERIC_ESTREE') && node.attributes?.isTemplateFunctionCall === true;
  }

  private static evalAng05(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'ANGULAR_TEMPLATE' || framework === 'GENERIC_ESTREE') && node.attributes?.isDirectNativeElementMutation === true;
  }

  // --- Research-backed expansion set predicate evaluators ---

  private static evalA11y07(node: ASTNode, framework: FrameworkType): boolean {
    if (framework !== 'REACT_JSX' && framework !== 'NEXT_JS') return false;
    return node.attributes?.isAccessibleNameMismatch === true;
  }

  private static evalReact05(node: ASTNode, framework: FrameworkType): boolean {
    if (framework !== 'REACT_JSX' && framework !== 'NEXT_JS' && framework !== 'GENERIC_ESTREE') return false;
    return node.attributes?.isEffectDerivedState === true;
  }

  private static evalReact06(node: ASTNode, framework: FrameworkType): boolean {
    if (framework !== 'REACT_JSX' && framework !== 'NEXT_JS' && framework !== 'GENERIC_ESTREE') return false;
    return node.attributes?.isEffectMissingDependency === true;
  }

  private static evalNext05(node: ASTNode, framework: FrameworkType): boolean {
    return framework === 'NEXT_JS' && node.attributes?.isServerOnlyImportInClientBoundary === true;
  }

  private static evalNext06(node: ASTNode, framework: FrameworkType): boolean {
    return framework === 'NEXT_JS' && node.attributes?.isNativeImgInNextJs === true;
  }

  private static evalAng06(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'ANGULAR_TEMPLATE' || framework === 'GENERIC_ESTREE') && node.attributes?.isImpurePipe === true;
  }

  private static evalVue01(node: ASTNode, framework: FrameworkType): boolean {
    return framework === 'VUE_SFC' && node.attributes?.isVForUnstableKey === true;
  }

  private static evalVue02(node: ASTNode, framework: FrameworkType): boolean {
    return framework === 'VUE_SFC' && node.attributes?.isVForWithVIf === true;
  }

  // --- Second research-backed expansion set predicate evaluators ---

  private static evalNext07(node: ASTNode, framework: FrameworkType): boolean {
    return framework === 'NEXT_JS' && node.attributes?.isAsyncClientComponent === true;
  }

  private static evalNext08(node: ASTNode, framework: FrameworkType): boolean {
    return framework === 'NEXT_JS' && node.attributes?.isUnsuspendedSearchParams === true;
  }

  private static evalNext09(node: ASTNode, framework: FrameworkType): boolean {
    return framework === 'NEXT_JS' && node.attributes?.isMetadataInClientBoundary === true;
  }

  private static evalNext10(node: ASTNode, framework: FrameworkType): boolean {
    return framework === 'NEXT_JS' && node.attributes?.isUnjustifiedForceDynamic === true;
  }

  private static evalVue03(node: ASTNode, framework: FrameworkType): boolean {
    return framework === 'VUE_SFC' && node.attributes?.isComputedSideEffect === true;
  }

  private static evalVue04(node: ASTNode, framework: FrameworkType): boolean {
    return framework === 'VUE_SFC' && node.attributes?.isComputedResultMutation === true;
  }

  private static evalVue05(node: ASTNode, framework: FrameworkType): boolean {
    return framework === 'VUE_SFC' && node.attributes?.isPropMutation === true;
  }

  private static evalVue06(node: ASTNode, framework: FrameworkType): boolean {
    return framework === 'VUE_SFC' && node.attributes?.isArrowOptionsMethod === true;
  }

  private static evalAng07(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'ANGULAR_TEMPLATE' || framework === 'GENERIC_ESTREE') && node.attributes?.isComplexConstructorLogic === true;
  }

  private static evalAng08(node: ASTNode, framework: FrameworkType): boolean {
    return framework === 'ANGULAR_TEMPLATE' && node.attributes?.isUnstableForTrack === true;
  }

  private static evalAng09(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'ANGULAR_TEMPLATE' || framework === 'GENERIC_ESTREE') && node.attributes?.isMutableSignalInput === true;
  }

  private static evalAng10(node: ASTNode, framework: FrameworkType): boolean {
    return framework === 'ANGULAR_TEMPLATE' && node.attributes?.isDuplicateAsyncPipe === true;
  }

  private static evalReact07(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'REACT_JSX' || framework === 'NEXT_JS' || framework === 'GENERIC_ESTREE') && node.attributes?.isMisplacedHookCall === true;
  }

  private static evalReact08(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'REACT_JSX' || framework === 'NEXT_JS' || framework === 'GENERIC_ESTREE') && node.attributes?.isDirectPropMutation === true;
  }

  private static evalReact09(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'REACT_JSX' || framework === 'NEXT_JS' || framework === 'GENERIC_ESTREE') && node.attributes?.isRenderSideEffect === true;
  }

  private static evalReact10(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'REACT_JSX' || framework === 'NEXT_JS' || framework === 'GENERIC_ESTREE') && node.attributes?.isComponentCalledAsFunction === true;
  }

  private static evalReact11(node: ASTNode, framework: FrameworkType): boolean {
    return (framework === 'REACT_JSX' || framework === 'NEXT_JS' || framework === 'GENERIC_ESTREE') && node.attributes?.isUnmemoizedContextValue === true;
  }

  private static createReport(
    ruleId: string,
    filePath: string,
    node: ASTNode,
    message: string,
    confidenceScore: number = 90.0
  ): DiagnosticReport {
    const mapping = FOUR_LAYER_MAPPINGS.find((m) => m.rule.ruleId === ruleId) || FOUR_LAYER_MAPPINGS[0];
    return {
      ruleId,
      ruleName: mapping.rule.ruleName,
      domain: mapping.domain,
      concern: mapping.concern,
      severity: mapping.rule.severity,
      filePath,
      location: node.loc || { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
      offendingCodeSnippet: node.attributes?.codeSnippet ? String(node.attributes.codeSnippet) : `<${node.name || node.type} />`,
      message,
      remediation: mapping.rule.remediation,
      // See standard-clause-mapping.ts for why this is now a real per-concern WCAG SC number or
      // ISO 25010 sub-characteristic (where independently verifiable) instead of a blanket
      // domain-level "ISO 25010"/"WCAG 2.2" string.
      standardReference: getStandardReference(mapping.domain, mapping.concern),
      confidenceScore,
      // AST Migration Phase 8: never claim "AST" for a node this migration hasn't actually
      // touched. node.sourceKind is only set ('REAL_AST') by src/ast/real-syntax-node-builder.ts;
      // every node still produced by SourceParser's legacy regex loop has no sourceKind at all,
      // which is surfaced honestly here as 'LEGACY_TEXT_HEURISTIC' rather than silently omitted
      // (omitting it would make it easy to *assume* AST provenance by default -- see
      // DetectionSourceKind's doc comment in src/types/ast-spec.ts).
      sourceKind: node.sourceKind ?? 'LEGACY_TEXT_HEURISTIC',
      evidence:
        node.sourceKind === 'REAL_AST'
          ? `Real AST (TypeScript compiler): [${node.type}] at line ${node.loc?.start?.line || 1}`
          : `Legacy text-heuristic pattern match: [${node.type}] at line ${node.loc?.start?.line || 1}`
    };
  }
}
