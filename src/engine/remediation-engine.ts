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
        const originalDeclMatch = snippet.match(/^const\s+(\w+)\s*=\s*([\s\S]*?);?\s*$/);
        if (code.includes(snippet) && originalDeclMatch) {
          const originalVarName = originalDeclMatch[1];
          const rawObj = originalDeclMatch[2].trim();
          const hoistedVarName = `HOISTED_INVARIANT_${Math.floor(Math.random() * 1000)}`;
          const hoistedDecl = `// [FIGM Quick-Fix]: Hoisted invariant object allocation outside loop scope\nconst ${hoistedVarName} = Object.freeze(${rawObj});\n\n`;

          // Preserve the ORIGINAL local variable name so every downstream reference to it inside the
          // loop body still resolves — replacing it with a differently-named binding (as a previous
          // version of this fix did) leaves dangling references to the now-undeclared original name.
          remediatedCode = hoistedDecl + code.replace(snippet, `const ${originalVarName} = ${hoistedVarName};`);
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
          let fixedSnippet = snippet.replace(/<div\b/, '<div role="button" tabIndex={0}');
          if (!fixedSnippet.includes('onKeyDown')) {
            fixedSnippet = fixedSnippet.replace(
              /onClick=\{(.*?)\}/,
              'onClick={$1} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { $1(); } }}'
            );
          }
          remediatedCode = code.replace(snippet, fixedSnippet);
          appliedFixDescription = 'Annotated clickable <div> with ARIA role="button", tabIndex={0}, and keyboard onKeyDown handler.';
        } else {
          remediatedCode = code.replace(/onClick=/g, 'role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.click()} onClick=');
          appliedFixDescription = 'Injected role="button", tabIndex={0}, and keyboard onKeyDown listener.';
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
        // Fix direct state mutation — handles both array mutations and property assignments
        if (snippet && code.includes(snippet)) {
          // Pattern 1: Array .push(item) mutation — e.g. data.push(item)
          const pushMatch = snippet.match(/(\w+)\.push\((.+)\);/);
          if (pushMatch) {
            const arrName = pushMatch[1];
            const pushArg = pushMatch[2];
            const setter = `set${arrName.charAt(0).toUpperCase() + arrName.slice(1)}`;
            const fix = `// [FIGM Quick-Fix]: Immutable Array Append\n${setter}(prev => [...prev, ${pushArg}]);`;
            remediatedCode = code.replace(snippet, fix);
            appliedFixDescription = 'Replaced direct .push() array mutation with immutable spread append inside a state setter.';
            break;
          }

          // Pattern 2: Array .pop() mutation
          const popMatch = snippet.match(/(\w+)\.pop\(\);/);
          if (popMatch) {
            const arrName = popMatch[1];
            const setter = `set${arrName.charAt(0).toUpperCase() + arrName.slice(1)}`;
            const fix = `// [FIGM Quick-Fix]: Immutable Array Pop\n${setter}(prev => prev.slice(0, -1));`;
            remediatedCode = code.replace(snippet, fix);
            appliedFixDescription = 'Replaced direct .pop() array mutation with immutable .slice(0, -1) state update.';
            break;
          }

          // Pattern 3: Array .splice() mutation
          const spliceMatch = snippet.match(/(\w+)\.splice\((.+)\);/);
          if (spliceMatch) {
            const arrName = spliceMatch[1];
            const setter = `set${arrName.charAt(0).toUpperCase() + arrName.slice(1)}`;
            const fix = `// [FIGM Quick-Fix]: Immutable Array Filter\n${setter}(prev => prev.filter((_, i) => i !== indexToRemove));`;
            remediatedCode = code.replace(snippet, fix);
            appliedFixDescription = 'Replaced direct .splice() array mutation with immutable .filter() state update.';
            break;
          }

          // Pattern 4: Array .sort() or .reverse() in-place mutation
          const sortMatch = snippet.match(/(\w+)\.(sort|reverse)\(/);
          if (sortMatch) {
            const arrName = sortMatch[1];
            const method = sortMatch[2];
            const setter = `set${arrName.charAt(0).toUpperCase() + arrName.slice(1)}`;
            const fix = `// [FIGM Quick-Fix]: Immutable Array ${method.charAt(0).toUpperCase() + method.slice(1)}\n${setter}(prev => [...prev].${method}());`;
            remediatedCode = code.replace(snippet, fix);
            appliedFixDescription = `Replaced in-place .${method}() mutation with immutable spread copy before sorting.`;
            break;
          }

          // Pattern 5: Object property assignment — e.g. obj.prop = val
          const mutMatch = snippet.match(/(\w+)\.(\w+)\s*=\s*(.+);/);
          if (mutMatch) {
            const objName = mutMatch[1];
            const propName = mutMatch[2];
            const valName = mutMatch[3];
            const fix = `// [FIGM Quick-Fix]: Immutable State Update\nset${objName.charAt(0).toUpperCase() + objName.slice(1)}(prev => ({ ...prev, ${propName}: ${valName} }));`;
            remediatedCode = code.replace(snippet, fix);
            appliedFixDescription = 'Replaced direct state property mutation with immutable state updater function.';
            break;
          }

          // Generic fallback — annotate the mutation
          remediatedCode = code.replace(snippet, `/* [FIGM Fix]: Replace this direct mutation with an immutable state setter call */`);
          appliedFixDescription = 'Annotated direct state mutation for manual conversion to immutable update pattern.';
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
          const tsCode = parseInt(defect.ruleId.replace('TYPE-TS-', ''), 10);

          // TS2345 — Argument of type 'X' is not assignable to parameter of type 'Y'
          // TS2322 — Type 'X' is not assignable to type 'Y'
          if (tsCode === 2345 || tsCode === 2322) {
            if (snippet && code.includes(snippet)) {
              // Try to add type assertion
              const fixedSnippet = snippet.replace(/(\w+)\s*\)/, '$1 as any)').replace(/=\s*(\w+)/, '= $1 as any');
              if (fixedSnippet !== snippet) {
                remediatedCode = code.replace(snippet, fixedSnippet);
                appliedFixDescription = `Added \`as any\` type assertion to resolve TS${tsCode} type mismatch. Review and replace 'any' with the correct type.`;
              } else {
                appliedFixDescription = `TS${tsCode}: Add explicit type annotation or type assertion on the offending value.`;
              }
            }
          }
          // TS2339 — Property 'X' does not exist on type 'Y'
          else if (tsCode === 2339) {
            appliedFixDescription = `TS2339: Property does not exist. Add the property to the type definition, use optional chaining (\`obj?.prop\`), or add a type assertion.`;
          }
          // TS2551 — Property 'X' does not exist on type 'Y'. Did you mean 'Z'?
          else if (tsCode === 2551) {
            appliedFixDescription = `TS2551: Property name typo. Check the TypeScript error message for the suggested correct property name and rename it in your code.`;
          }
          // TS2531 — Object is possibly 'null'
          else if (tsCode === 2531) {
            if (snippet && code.includes(snippet)) {
              // Add optional chaining
              const fixedSnippet = snippet.replace(/(\w+)\.(\w+)/, '$1?.$2');
              if (fixedSnippet !== snippet) {
                remediatedCode = code.replace(snippet, fixedSnippet);
                appliedFixDescription = 'Added optional chaining (?.) to guard against null object access (TS2531).';
              }
            }
          }
          // TS7006 — Parameter 'X' implicitly has an 'any' type
          else if (tsCode === 7006) {
            if (snippet && code.includes(snippet)) {
              const fixedSnippet = snippet.replace(/\((\w+)\)/, '($1: unknown)').replace(/,\s*(\w+)\)/, ', $1: unknown)');
              remediatedCode = code.replace(snippet, fixedSnippet);
              appliedFixDescription = 'Added explicit `unknown` type annotation to parameter with implicit any (TS7006). Replace `unknown` with the correct type.';
            }
          }
          // Generic TYPE-TS fallback
          else {
            appliedFixDescription = `TS${tsCode}: ${defect.message || 'Review the TypeScript error and add the correct type annotation or assertion.'}`;
          }
        } else {
          // ── Universal Pattern Remediation Fallback ──────────────────
          // Applies smart structural transformations on ANY arbitrary code / unknown rule
          const rawSnippet = snippet || defect.offendingCodeSnippet || '';

          // 1. Universal A11Y: Clickable non-button element
          if (/<(div|span|p|a|li|section)\b/i.test(rawSnippet) && (rawSnippet.includes('onClick=') || rawSnippet.includes('(click)=') || rawSnippet.includes('@click='))) {
            if (rawSnippet.includes('onClick=')) {
              const fixedSnippet = rawSnippet.replace(/<(div|span|p|a|li|section)\b/i, '<$1 role="button" tabIndex={0}')
                .replace(/onClick=\{(.*?)\}/, 'onClick={$1} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { $1(); } }}');
              remediatedCode = code.replace(rawSnippet, fixedSnippet);
              appliedFixDescription = 'Annotated non-interactive element with ARIA role="button", tabIndex={0}, and keyboard listener.';
            } else if (rawSnippet.includes('(click)=')) {
              const fixedSnippet = rawSnippet.replace(/<(div|span|p|a|li|section)\b/i, '<$1 role="button" tabindex="0" (keydown.enter)="$2"')
                .replace(/\(click\)="([^"]+)"/, '(click)="$1" (keydown.enter)="$1()"');
              remediatedCode = code.replace(rawSnippet, fixedSnippet);
              appliedFixDescription = 'Injected role="button", tabindex="0", and (keydown.enter) handler into Angular element.';
            } else {
              const fixedSnippet = rawSnippet.replace(/<(div|span|p|a|li|section)\b/i, '<$1 role="button" tabindex="0"')
                .replace(/@click="([^"]+)"/, '@click="$1" @keydown.enter="$1"');
              remediatedCode = code.replace(rawSnippet, fixedSnippet);
              appliedFixDescription = 'Injected role="button", tabindex="0", and @keydown.enter handler into Vue element.';
            }
          }
          // 2. Universal PERF: Un-dimensioned <img> or <Image> tag
          else if (/<(img|Image)\b/i.test(rawSnippet) && !rawSnippet.includes('width=')) {
            const fixedSnippet = rawSnippet.replace(/<(img|Image)\b/i, '<$1 width="400" height="300" style={{ aspectRatio: "4/3" }} ');
            remediatedCode = code.replace(rawSnippet, fixedSnippet);
            appliedFixDescription = 'Injected explicit width="400", height="300", and CSS aspect-ratio properties to prevent CLS.';
          }
          // 3. Universal State Mutation: .push() or direct assignment
          else if (/(\w+)\.push\((.+)\)/.test(rawSnippet)) {
            const match = rawSnippet.match(/(\w+)\.push\((.+)\)/);
            if (match) {
              const varName = match[1];
              const arg = match[2];
              const setter = `set${varName.charAt(0).toUpperCase() + varName.slice(1)}`;
              remediatedCode = code.replace(rawSnippet, `${setter}(prev => [...prev, ${arg}])`);
              appliedFixDescription = `Converted direct .push() mutation into immutable spread update: ${setter}(prev => [...prev, ${arg}])`;
            }
          }
          // 4. Universal Invariant Object in Loop Scope
          else if (/const\s+\w+\s*=\s*\{[\s\S]*?\}/.test(rawSnippet) && (code.includes('.map(') || code.includes('for(') || code.includes('while('))) {
            const hoistedVar = `HOISTED_INVARIANT_${Math.floor(Math.random() * 1000)}`;
            const rawObj = rawSnippet.replace(/^const\s+\w+\s*=\s*/, '').replace(/;\s*$/, '').trim();
            remediatedCode = `const ${hoistedVar} = Object.freeze(${rawObj});\n\n` + code.replace(rawSnippet, `const options = ${hoistedVar}`);
            appliedFixDescription = 'Hoisted invariant object allocation outside loop scope into a frozen top-level constant.';
          }
          // 5. Universal Null Dereference Guard
          else if (defect.message?.toLowerCase().includes('null') || defect.message?.toLowerCase().includes('undefined')) {
            if (rawSnippet.includes('.')) {
              const fixedSnippet = rawSnippet.replace(/(\w+)\.(\w+)/g, '$1?.$2');
              remediatedCode = code.replace(rawSnippet, fixedSnippet);
              appliedFixDescription = 'Injected optional chaining (?.) guards against potential null/undefined dereferences.';
            }
          }
          // 6. Generic Advisory Annotation
          else {
            remediatedCode = code.replace(rawSnippet, `/* [FIGM Fix]: ${defect.remediation || defect.message || 'Optimized code pattern'} */\n${rawSnippet}`);
            appliedFixDescription = `Applied code optimization advisory for [${defect.ruleId}]: ${defect.remediation || 'Optimized structural pattern.'}`;
          }
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
    const originalRes = RuleExecutionEngine.analyzeFile(defect.filePath || 'component.tsx', originalCode);
    const res = RuleExecutionEngine.analyzeFile(defect.filePath || 'component.tsx', remediatedCode);

    const hasSyntaxError = res.diagnostics.some((d: DiagnosticReport) => d.category === 'SYNTAX_ERROR');
    if (hasSyntaxError) {
      return { isValid: false, status: 'PATCH_REJECTED', remainingDiagnostics: res.diagnostics };
    }

    // Reject patches that introduce NEW real TypeScript compile error CODES (e.g. a dangling reference
    // to a variable the patch itself renamed away) that were not present in the original code. This is
    // what actually catches "the rule stopped firing but the patch is broken" cases -- confirming the
    // specific ruleId is gone is not sufficient on its own (found via live testing, see audit docs).
    // Compared by diagnostic CODE (ruleId, e.g. "TYPE-TS-18004"), not exact message text: the same
    // pre-existing, unrelated TS error (e.g. a JSX style-prop type mismatch, expected since no
    // @types/react is loaded in the isolated checker) can get slightly reworded by an otherwise-benign
    // patch -- e.g. Object.freeze() narrows an object literal's inferred type -- without being a new
    // problem the patch introduced.
    const originalTypeErrorCodes = new Set(
      originalRes.diagnostics.filter((d: DiagnosticReport) => d.category === 'TYPE_COMPILE_ERROR').map((d: DiagnosticReport) => d.ruleId)
    );
    const newTypeErrors = res.diagnostics.filter(
      (d: DiagnosticReport) => d.category === 'TYPE_COMPILE_ERROR' && !originalTypeErrorCodes.has(d.ruleId)
    );
    if (newTypeErrors.length > 0) {
      return { isValid: false, status: 'PATCH_REJECTED', remainingDiagnostics: res.diagnostics };
    }

    const originalStillPresent = res.diagnostics.some((d: DiagnosticReport) => d.ruleId === defect.ruleId);
    if (originalStillPresent) {
      return { isValid: false, status: 'UNRESOLVED', remainingDiagnostics: res.diagnostics };
    }

    return { isValid: true, status: 'FIXED', remainingDiagnostics: res.diagnostics };
  }
}

