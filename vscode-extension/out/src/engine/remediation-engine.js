"use strict";
/**
 * Framework-Independent Guideline Model (FIGM)
 * Automated Remediation & Quick-Fix Engine
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemediationEngine = void 0;
const patch_generator_js_1 = require("./patch-generator.js");
class RemediationEngine {
    /**
     * Applies an automated quick-fix transformation to source code for a given diagnostic defect
     */
    static applyQuickFix(code, defect) {
        let remediatedCode = code;
        let appliedFixDescription = 'Applied automated code transformation.';
        const snippet = defect.offendingCodeSnippet.trim();
        const startLine = defect.location?.start?.line || 1;
        switch (defect.ruleId) {
            case 'FIGM-PERF-01': {
                // Hoist invariant object literal outside loop scope
                if (code.includes(snippet)) {
                    const hoistedVarName = `HOISTED_INVARIANT_${Math.floor(Math.random() * 1000)}`;
                    const hoistedDecl = `// [FIGM Quick-Fix]: Hoisted invariant object allocation outside loop scope\nconst ${hoistedVarName} = Object.freeze(${snippet.replace(/^const\s+\w+\s*=\s*/, '')});\n\n`;
                    remediatedCode = hoistedDecl + code.replace(snippet, `${hoistedVarName}`);
                    appliedFixDescription = 'Hoisted static object literal out of loop scope into a frozen top-level constant.';
                }
                else {
                    remediatedCode = code.replace(/const\s+(\w+)\s*=\s*(\{[\s\S]*?\});/g, '/* [FIGM Quick-Fix]: Hoisted static invariant */\nconst $1 = React.useMemo(() => ($2), []);');
                    appliedFixDescription = 'Wrapped invariant object allocation in useMemo memoization boundary.';
                }
                break;
            }
            case 'FIGM-PERF-02': {
                // Inject width and height attributes into img or visual element
                if (code.includes(snippet)) {
                    let fixedSnippet = snippet;
                    if (!snippet.includes('width=')) {
                        fixedSnippet = fixedSnippet.replace(/<img\s+/, '<img width="300" height="200" style={{ aspectRatio: "150/100" }} ');
                    }
                    remediatedCode = code.replace(snippet, fixedSnippet);
                    appliedFixDescription = 'Injected explicit width, height, and CSS aspect-ratio attributes to prevent Cumulative Layout Shift (CLS).';
                }
                else {
                    remediatedCode = code.replace(/<img\s+/g, '<img width="300" height="200" style={{ aspectRatio: "150/100" }} ');
                    appliedFixDescription = 'Injected explicit width and height attributes to un-dimensioned <img> tags.';
                }
                break;
            }
            case 'FIGM-PERF-03': {
                // Add removeEventListener teardown cleanup
                if (code.includes(snippet)) {
                    const handlerMatch = snippet.match(/addEventListener\((['"][^'"]+['"]),\s*([^)]+)\)/);
                    const eventName = handlerMatch ? handlerMatch[1] : "'resize'";
                    const handlerName = handlerMatch ? handlerMatch[2] : 'handleResize';
                    const fixedSnippet = `// [FIGM Quick-Fix]: Automatic Event Teardown\nuseEffect(() => {\n  ${snippet}\n  return () => window.removeEventListener(${eventName}, ${handlerName});\n}, []);`;
                    remediatedCode = code.replace(snippet, fixedSnippet);
                    appliedFixDescription = 'Encapsulated listener registration within useEffect with automatic removeEventListener disposal cleanup.';
                }
                else {
                    remediatedCode = code + '\n// [FIGM Quick-Fix]: Remember to invoke removeEventListener in unmount lifecycle routine.';
                    appliedFixDescription = 'Added event disposal teardown advisory.';
                }
                break;
            }
            case 'FIGM-PERF-04': {
                // Convert static import to dynamic import()
                if (code.includes(snippet)) {
                    const importMatch = snippet.match(/import\s+(\{?\s*\w+\s*\}?)\s+from\s+(['"][^'"]+['"]);/);
                    if (importMatch) {
                        const compName = importMatch[1];
                        const modPath = importMatch[2];
                        const fixedSnippet = `// [FIGM Quick-Fix]: Converted to dynamic lazy load\nconst ${compName} = React.lazy(() => import(${modPath}));`;
                        remediatedCode = code.replace(snippet, fixedSnippet);
                    }
                    else {
                        remediatedCode = `// [FIGM Quick-Fix]: Lazy loaded module\n` + code.replace(snippet, `/* lazy */ import(${snippet.replace('import ', '')})`);
                    }
                    appliedFixDescription = 'Converted top-level static import into a dynamic lazy import() code-splitting boundary.';
                }
                break;
            }
            case 'FIGM-A11Y-01': {
                // Add keyboard listener and tabIndex to click handler
                if (code.includes(snippet)) {
                    let fixedSnippet = snippet.replace(/<div\b/, '<button type="button" tabIndex={0}');
                    if (!fixedSnippet.includes('onKeyDown')) {
                        fixedSnippet = fixedSnippet.replace(/onClick=\{(.*?)\}/, 'onClick={$1} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { $1(); } }}');
                    }
                    remediatedCode = code.replace(snippet, fixedSnippet);
                    appliedFixDescription = 'Converted non-interactive <div> to a native <button> with tabIndex={0} and keyboard onKeyDown handler.';
                }
                else {
                    remediatedCode = code.replace(/onClick=/g, 'tabIndex={0} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.click()} onClick=');
                    appliedFixDescription = 'Injected tabIndex={0} and keyboard onKeyDown listener to click handler.';
                }
                break;
            }
            case 'FIGM-A11Y-02': {
                // Add role and aria-label attributes to custom controls
                if (code.includes(snippet)) {
                    let fixedSnippet = snippet;
                    if (!snippet.includes('role=')) {
                        fixedSnippet = fixedSnippet.replace(/<([A-Z]\w+|div)\b/, '<$1 role="button" aria-label="Interactive Action Control" ');
                    }
                    remediatedCode = code.replace(snippet, fixedSnippet);
                    appliedFixDescription = 'Injected explicit role="button" and aria-label="Interactive Action Control" attributes.';
                }
                else {
                    remediatedCode = code.replace(/<Modal\b/g, '<Modal role="dialog" aria-label="Interactive Modal Dialog" aria-modal="true" ');
                    appliedFixDescription = 'Added ARIA role="dialog" and aria-label annotations to custom Modal component.';
                }
                break;
            }
            case 'FIGM-A11Y-03': {
                // Add aria-live="polite" and role="status"
                if (code.includes(snippet)) {
                    const fixedSnippet = snippet.replace(/<div\b/, '<div role="status" aria-live="polite" ');
                    remediatedCode = code.replace(snippet, fixedSnippet);
                    appliedFixDescription = 'Annotated dynamic output status container with role="status" and aria-live="polite".';
                }
                else {
                    remediatedCode = code.replace(/class="status-banner"/g, 'class="status-banner" role="status" aria-live="polite"');
                    appliedFixDescription = 'Injected aria-live="polite" announcer region to dynamic status container.';
                }
                break;
            }
            case 'FIGM-A11Y-04': {
                // Restore focus on unmount
                if (code.includes(snippet)) {
                    const fixedSnippet = snippet.replace(/<Modal\b/, '<Modal restoresFocusOnUnmount={true} onClose={() => triggerRef.current?.focus()} ');
                    remediatedCode = code.replace(snippet, fixedSnippet);
                    appliedFixDescription = 'Injected restoresFocusOnUnmount={true} and programmatic trigger element focus restoration callback.';
                }
                else {
                    remediatedCode = code.replace(/<Modal\b/g, '<Modal restoresFocusOnUnmount={true} ');
                    appliedFixDescription = 'Injected focus restoration callback property on modal dialog component.';
                }
                break;
            }
            default:
                appliedFixDescription = 'No specific quick-fix rule transformation defined.';
        }
        const suggestedFix = patch_generator_js_1.PatchGenerator.generateGitDiff(defect.filePath || 'component.tsx', code, remediatedCode, startLine, appliedFixDescription);
        return {
            ruleId: defect.ruleId,
            originalCode: code,
            remediatedCode,
            appliedFixDescription,
            suggestedFix,
        };
    }
}
exports.RemediationEngine = RemediationEngine;
//# sourceMappingURL=remediation-engine.js.map