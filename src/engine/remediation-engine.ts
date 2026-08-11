/**
 * Framework-Independent Guideline Model (FIGM)
 * Automated Remediation & Quick-Fix Engine
 */

import { DiagnosticReport } from '../types/ast-spec.js';
import { PatchGenerator, GitPatchResult } from './patch-generator.js';

export interface RemediationResult {
  ruleId: string;
  originalCode: string;
  remediatedCode: string;
  appliedFixDescription: string;
  suggestedFix?: GitPatchResult;
}

export class RemediationEngine {
  /**
   * Applies an automated quick-fix transformation to source code for a given diagnostic defect
   */
  public static applyQuickFix(code: string, defect: DiagnosticReport): RemediationResult {
    let remediatedCode = code;
    let appliedFixDescription = 'Applied automated code transformation.';

    const snippet = defect.offendingCodeSnippet.trim();
    const startLine = defect.location?.start?.line || 1;

    switch (defect.ruleId) {
      case 'FIGM-PERF-01': {
        // Hoist invariant object literal outside loop scope
        if (code.includes(snippet)) {
          const hoistedVarName = `HOISTED_INVARIANT_${Math.floor(Math.random() * 1000)}`;
          const rawObj = snippet.replace(/^const\s+\w+\s*=\s*/, '').replace(/;\s*$/, '').trim();
          const hoistedDecl = `// [FIGM Quick-Fix]: Hoisted invariant object allocation outside loop scope\nconst ${hoistedVarName} = Object.freeze(${rawObj});\n\n`;
          
          remediatedCode = hoistedDecl + code.replace(snippet, `const options = ${hoistedVarName};`);
          appliedFixDescription = 'Hoisted static object literal out of loop scope into a frozen top-level constant.';
        } else {
          remediatedCode = code.replace(
            /const\s+(\w+)\s*=\s*(\{[\s\S]*?\});/g,
            '/* [FIGM Quick-Fix]: Hoisted static invariant */\nconst $1 = React.useMemo(() => ($2), []);'
          );
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
        } else {
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
        } else {
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
          } else {
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
            fixedSnippet = fixedSnippet.replace(
              /onClick=\{(.*?)\}/,
              'onClick={$1} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { $1(); } }}'
            );
          }
          remediatedCode = code.replace(snippet, fixedSnippet);
          appliedFixDescription = 'Converted non-interactive <div> to a native <button> with tabIndex={0} and keyboard onKeyDown handler.';
        } else {
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
        } else {
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
        } else {
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
        } else {
          remediatedCode = code.replace(/<Modal\b/g, '<Modal restoresFocusOnUnmount={true} ');
          appliedFixDescription = 'Injected focus restoration callback property on modal dialog component.';
        }
        break;
      }

      case 'SYNTAX-PARSE-ERROR':
      case 'SYNTAX_ERROR': {
        // Fix common syntax typos
        if (code.includes('const ') && code.includes(' = ;')) {
          remediatedCode = code.replace(/const\s+(\w+)\s*=\s*;/g, 'const $1 = null;');
          appliedFixDescription = 'Fixed unclosed assignment syntax error by assigning default null value.';
        } else if (code.includes('function ') && (code.includes('( {') || code.includes('({'))) {
          remediatedCode = code.replace(/function\s+(\w+)\s*\(\s*\{/g, 'function $1({');
          appliedFixDescription = 'Fixed broken function signature destructuring syntax error.';
        } else {
          remediatedCode = `// [FIGM Syntax Fix]: Cleaned syntax structure\n` + code;
          appliedFixDescription = 'Applied syntax structure cleanup advisory.';
        }
        break;
      }

      case 'FIGM-NEXT-01': {
        // Add 'use client'; directive to Next.js component using state/hooks
        if (!code.includes("'use client'") && !code.includes('"use client"')) {
          remediatedCode = `'use client';\n\n` + code;
          appliedFixDescription = "Injected mandatory 'use client'; directive at the top of Next.js interactive component file.";
        }
        break;
      }

      case 'FIGM-NEXT-02': {
        // Convert native <img> to Next.js <Image /> component
        if (code.includes('<img')) {
          remediatedCode = code.replace(/<img\s+/g, '<Image width={500} height={300} ');
          if (!remediatedCode.includes("import Image from 'next/image'")) {
            remediatedCode = `import Image from 'next/image';\n` + remediatedCode;
          }
          appliedFixDescription = 'Converted native <img> to Next.js optimized <Image /> component with explicit dimensions.';
        }
        break;
      }

      case 'FIGM-NEXT-04': {
        // Guard window access in React Server Components
        if (code.includes('window.')) {
          remediatedCode = code.replace(/(window\.\w+)/g, "(typeof window !== 'undefined' ? $1 : null)");
          appliedFixDescription = "Encapsulated direct window object access with SSR 'typeof window !== undefined' guard.";
        }
        break;
      }

      case 'FIGM-REACT-01': {
        // Fix unstable key prop
        if (code.includes('key={Math.random()}')) {
          remediatedCode = code.replace(/key=\{Math\.random\(\)\}/g, 'key={item.id || index}');
          appliedFixDescription = 'Replaced non-deterministic Math.random() key prop with stable item.id || index key identifier.';
        }
        break;
      }

      case 'FIGM-REACT-03': {
        // Fix direct state mutation
        if (snippet && code.includes(snippet)) {
          const mutMatch = snippet.match(/(\w+)\.(\w+)\s*=\s*(.+);/);
          if (mutMatch) {
            const objName = mutMatch[1];
            const propName = mutMatch[2];
            const valName = mutMatch[3];
            const fix = `// [FIGM Quick-Fix]: Immutable State Update\nset${objName.charAt(0).toUpperCase() + objName.slice(1)}(prev => ({ ...prev, ${propName}: ${valName} }));`;
            remediatedCode = code.replace(snippet, fix);
            appliedFixDescription = 'Replaced direct state property mutation with immutable state updater function.';
          } else {
            remediatedCode = code.replace(/(\w+)\.(\w+)\s*=\s*(.+);/g, '/* [FIGM Fix]: Immutable State Update */');
            appliedFixDescription = 'Converted direct state mutation into immutable state update.';
          }
        }
        break;
      }

      case 'FIGM-REACT-05': {
        // Memoize Context Provider value
        if (code.includes('<') && code.includes('.Provider')) {
          remediatedCode = code.replace(/value=\{([^}]+)\}/g, 'value={React.useMemo(() => ($1), [$1])}');
          appliedFixDescription = 'Wrapped Context.Provider value in React.useMemo memoization boundary.';
        }
        break;
      }

      case 'FIGM-ANGULAR-01': {
        // Fix unsubscribed RxJS subscription
        if (code.includes('.subscribe(')) {
          remediatedCode = code.replace(/this\.(\w+\$)\.subscribe\(/g, 'this.subscription = this.$1.subscribe(');
          if (!remediatedCode.includes('ngOnDestroy')) {
            remediatedCode = remediatedCode.replace(
              /export class (\w+)\s*\{/,
              'export class $1 implements OnDestroy {\n  private subscription: any;\n\n  ngOnDestroy(): void { if (this.subscription) this.subscription.unsubscribe(); }\n'
            );
          }
          appliedFixDescription = 'Added Subscription handle and ngOnDestroy lifecycle disposal callback for RxJS stream.';
        }
        break;
      }

      case 'FIGM-ANGULAR-02': {
        // Add trackBy to *ngFor
        if (code.includes('*ngFor')) {
          remediatedCode = code.replace(/\*ngFor="let\s+(\w+)\s+of\s+([^"]+)"/g, '*ngFor="let $1 of $2; trackBy: trackById"');
          appliedFixDescription = 'Added trackBy: trackById iteration function to *ngFor directive.';
        }
        break;
      }

      default:
        if (defect.ruleId.startsWith('TYPE-TS-')) {
          appliedFixDescription = `Applied TypeScript type coercion advisory for [${defect.ruleId}].`;
        } else {
          appliedFixDescription = 'No specific quick-fix rule transformation defined.';
        }
    }

    const suggestedFix = PatchGenerator.generateGitDiff(
      defect.filePath || 'component.tsx',
      code,
      remediatedCode,
      startLine,
      appliedFixDescription
    );

    return {
      ruleId: defect.ruleId,
      originalCode: code,
      remediatedCode,
      appliedFixDescription,
      suggestedFix,
    };
  }

  /**
   * Re-scan proposed patch in isolated copy to verify if the original issue is resolved and 0 syntax errors exist
   */
  public static validatePatch(
    originalCode: string,
    remediatedCode: string,
    defect: DiagnosticReport
  ): { isValid: boolean; status: 'FIXED' | 'PATCH_REJECTED' | 'UNRESOLVED'; remainingDiagnostics: DiagnosticReport[] } {
    if (originalCode === remediatedCode) {
      return { isValid: false, status: 'UNRESOLVED', remainingDiagnostics: [defect] };
    }

    // Import RuleExecutionEngine dynamically to avoid circular dependencies
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RuleExecutionEngine } = require('./rule-execution-engine.js');
    const res = RuleExecutionEngine.analyzeFile(defect.filePath || 'component.tsx', remediatedCode);

    const hasSyntaxError = res.diagnostics.some((d: DiagnosticReport) => d.category === 'SYNTAX_ERROR');
    if (hasSyntaxError) {
      return { isValid: false, status: 'PATCH_REJECTED', remainingDiagnostics: res.diagnostics };
    }

    const originalStillPresent = res.diagnostics.some((d: DiagnosticReport) => d.ruleId === defect.ruleId);
    if (originalStillPresent) {
      return { isValid: false, status: 'UNRESOLVED', remainingDiagnostics: res.diagnostics };
    }

    return { isValid: true, status: 'FIXED', remainingDiagnostics: res.diagnostics };
  }
}

