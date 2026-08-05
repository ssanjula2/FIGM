"use strict";
/**
 * Framework-Independent Guideline Model (FIGM)
 * AST Predicate Evaluator Engine & Diagnostic Error Reporter (Complete 23 Rules)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASTDetectionEngine = void 0;
const universal_ast_mapper_js_1 = require("./universal-ast-mapper.js");
const four_layer_meta_model_js_1 = require("../matrix/four-layer-meta-model.js");
class ASTDetectionEngine {
    /**
     * Evaluate a normalized AST Node against all 23 FIGM formal predicates
     */
    static evaluateNode(rawNode, filePath, framework = 'GENERIC_ESTREE') {
        const node = universal_ast_mapper_js_1.UniversalASTMapper.normalizeNode(rawNode, framework);
        const reports = [];
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
            reports.push(this.createReport('FIGM-PERF-05', filePath, node, 'Inline anonymous arrow function defined inside render loop expression causing re-instantiation.', 85.0));
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
        // Recursively evaluate children AST nodes
        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                reports.push(...this.evaluateNode(child, filePath, framework));
            }
        }
        return reports;
    }
    // --- Predicate Evaluators ---
    static evalPerf01(node) {
        const isAllocationType = ['ObjectExpression', 'ArrayExpression', 'ArrowFunctionExpression'].includes(node.type);
        const inLoopScope = node.scopeType === 'LOOP' || node.scopeType === 'RENDER';
        const isInvariant = node.attributes?.isInvariant === true;
        return isAllocationType && inLoopScope && isInvariant;
    }
    static evalPerf02(node) {
        const visualTags = ['img', 'video', 'iframe', 'embed'];
        const isVisual = (node.type === 'JSXElement' || node.type === 'VElement' || node.type === 'Element$1') && visualTags.includes(node.name || '');
        if (!isVisual)
            return false;
        const attrs = node.attributes || {};
        const hasWidth = attrs.width !== undefined;
        const hasHeight = attrs.height !== undefined;
        const hasAspectRatio = attrs.aspectRatio !== undefined || (typeof attrs.style === 'string' && attrs.style.includes('aspect-ratio'));
        return !(hasWidth && hasHeight) && !hasAspectRatio;
    }
    static evalPerf03(node) {
        if (node.type !== 'CallExpression')
            return false;
        const isListener = node.name === 'addEventListener' || node.attributes?.method === 'addEventListener';
        const missingDisposal = node.attributes?.hasPairedRemoval !== true;
        return isListener && missingDisposal;
    }
    static evalPerf04(node) {
        if (node.type !== 'ImportDeclaration')
            return false;
        return node.attributes?.referencedInConditional === true;
    }
    static evalPerf05(node) {
        return node.type === 'ArrowFunctionExpression' && node.attributes?.isInlineCallback === true;
    }
    static evalPerf06(node) {
        return node.type === 'CallExpression' && node.attributes?.isStorageInLoop === true;
    }
    static evalA11y01(node) {
        const nonInteractiveTags = ['div', 'span', 'section', 'article', 'p'];
        const isNonInteractive = (node.type === 'JSXElement' || node.type === 'VElement' || node.type === 'Element$1') && nonInteractiveTags.includes(node.name || '');
        if (!isNonInteractive)
            return false;
        const attrs = node.attributes || {};
        const hasClick = attrs.onClick !== undefined || attrs['v-on:click'] !== undefined || attrs['(click)'] !== undefined;
        const hasKeyboard = attrs.onKeyDown !== undefined || attrs['v-on:keydown'] !== undefined || attrs['(keydown)'] !== undefined;
        const hasTabIndex = attrs.tabIndex !== undefined || attrs.tabindex !== undefined;
        return hasClick && (!hasKeyboard || !hasTabIndex);
    }
    static evalA11y02(node) {
        const isCustomControl = (node.type === 'JSXElement' || node.type === 'VElement') && (node.attributes?.isCustomControl === true || (node.name && /^[A-Z]/.test(node.name)));
        if (!isCustomControl)
            return false;
        const attrs = node.attributes || {};
        const hasRole = attrs.role !== undefined;
        const hasAccessibleName = attrs['aria-label'] !== undefined || attrs['aria-labelledby'] !== undefined;
        return !hasRole || !hasAccessibleName;
    }
    static evalA11y03(node) {
        const isDynamic = node.attributes?.isDynamicMutation === true;
        if (!isDynamic)
            return false;
        const attrs = node.attributes || {};
        const hasAriaLive = attrs['aria-live'] !== undefined;
        const hasStatusRole = attrs.role === 'status' || attrs.role === 'alert' || attrs.role === 'log';
        return !hasAriaLive && !hasStatusRole;
    }
    static evalA11y04(node) {
        const isOverlay = node.attributes?.isOverlay === true || node.name === 'Modal' || node.name === 'Dialog';
        if (!isOverlay)
            return false;
        const attrs = node.attributes || {};
        const preservesFocus = attrs.restoresFocusOnUnmount === true;
        return !preservesFocus;
    }
    static evalA11y05(node) {
        return node.type === 'JSXElement' && node.attributes?.isUnlabeledInput === true;
    }
    static evalA11y06(node) {
        return node.attributes?.positiveTabIndex === true;
    }
    static evalNext01(node, framework) {
        return (framework === 'NEXT_JS' || framework === 'REACT_JSX') && node.attributes?.isClientHookWithoutDirective === true;
    }
    static evalNext02(node, framework) {
        return framework === 'NEXT_JS' && node.attributes?.isHeavyStaticImportInNext === true;
    }
    static evalNext03(node, framework) {
        return framework === 'NEXT_JS' && node.type === 'ExportNamedDeclaration' && node.attributes?.missingRevalidateConfig === true;
    }
    static evalNext04(node, framework) {
        return (framework === 'NEXT_JS' || framework === 'REACT_JSX') && node.attributes?.isExternalFontLink === true;
    }
    static evalReact01(node, framework) {
        return (framework === 'REACT_JSX' || framework === 'NEXT_JS' || framework === 'GENERIC_ESTREE') && node.attributes?.isExpensiveDerivedStateWithoutMemo === true;
    }
    static evalReact02(node, framework) {
        return (framework === 'REACT_JSX' || framework === 'NEXT_JS' || framework === 'GENERIC_ESTREE') && node.attributes?.isArrayIndexKey === true;
    }
    static evalReact03(node, framework) {
        return (framework === 'REACT_JSX' || framework === 'NEXT_JS' || framework === 'GENERIC_ESTREE') && node.attributes?.isDirectStateMutation === true;
    }
    static evalReact04(node, framework) {
        return (framework === 'REACT_JSX' || framework === 'NEXT_JS' || framework === 'GENERIC_ESTREE') && node.attributes?.isInlineCallbackProp === true;
    }
    static evalAng01(node, framework) {
        return (framework === 'ANGULAR_TEMPLATE' || framework === 'GENERIC_ESTREE') && node.attributes?.isUnsubscribedObservable === true;
    }
    static evalAng02(node, framework) {
        return (framework === 'ANGULAR_TEMPLATE' || framework === 'GENERIC_ESTREE') && node.attributes?.missingOnPush === true;
    }
    static evalAng03(node, framework) {
        return (framework === 'ANGULAR_TEMPLATE' || framework === 'GENERIC_ESTREE') && node.attributes?.isNgForWithoutTrackBy === true;
    }
    static evalAng04(node, framework) {
        return (framework === 'ANGULAR_TEMPLATE' || framework === 'GENERIC_ESTREE') && node.attributes?.isTemplateFunctionCall === true;
    }
    static evalAng05(node, framework) {
        return (framework === 'ANGULAR_TEMPLATE' || framework === 'GENERIC_ESTREE') && node.attributes?.isDirectNativeElementMutation === true;
    }
    static createReport(ruleId, filePath, node, message, confidenceScore = 90.0) {
        const mapping = four_layer_meta_model_js_1.FOUR_LAYER_MAPPINGS.find((m) => m.rule.ruleId === ruleId) || four_layer_meta_model_js_1.FOUR_LAYER_MAPPINGS[0];
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
            standardReference: mapping.domain === 'PERFORMANCE' ? 'ISO 25010' : 'WCAG 2.2',
            confidenceScore,
            evidence: `AST Node: [${node.type}] at line ${node.loc?.start?.line || 1}`
        };
    }
}
exports.ASTDetectionEngine = ASTDetectionEngine;
//# sourceMappingURL=ast-detection-engine.js.map