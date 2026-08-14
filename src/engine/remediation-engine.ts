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
  /** True when a safe automatic fix is not possible (e.g. a useMemo dependency array that
   *  cannot be reliably inferred) — callers must surface this as MANUAL_REVIEW_REQUIRED rather
   *  than attempting to verify/claim a complete automated fix. */
  requiresManualReview?: boolean;
}

export class RemediationEngine {
  /**
   * Applies an automated quick-fix transformation to source code for a given diagnostic defect
   */
  public static applyQuickFix(code: string, defect: DiagnosticReport): RemediationResult {
    let remediatedCode = code;
    let appliedFixDescription = 'Applied automated code transformation.';
    let requiresManualReview = false;

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
        // Inject width and height attributes into img or visual element. FIGM-PERF-02's real
        // trigger condition (evalPerf02) only requires width AND height both present (or an
        // aspect-ratio) — width+height alone is sufficient, so the fix stops there. An earlier
        // version also injected a `style={{ aspectRatio: ... }}` object-literal prop, which was
        // unnecessary for satisfying the rule and, found via the real detect->remediate->re-scan
        // verification run, caused the isolated single-file TypeScript checker to spuriously
        // report TYPE-TS-2875 on the patched JSX, rejecting an otherwise-correct patch.
        if (code.includes(snippet)) {
          let fixedSnippet = snippet;
          if (!snippet.includes('width=')) {
            fixedSnippet = fixedSnippet.replace(/<img\s+/, '<img width="300" height="200" ');
          }
          remediatedCode = code.replace(snippet, fixedSnippet);
          appliedFixDescription = 'Injected explicit width and height attributes to prevent Cumulative Layout Shift (CLS).';
        } else {
          remediatedCode = code.replace(/<img\s+/g, '<img width="300" height="200" ');
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

      case 'FIGM-PERF-05': {
        // Inline anonymous arrow function inside a render/map loop. A correct fix means hoisting
        // it into a stable, memoized handler — but the callback typically closes over the current
        // loop item (e.g. `onClick={() => handleClick(item.id)}`), so a real fix needs the
        // handler to be curried/bound per-item (e.g. via a data-attribute + a single stable
        // top-level handler, or useCallback keyed correctly per item) — which cannot be safely
        // inferred from the snippet alone without risking a stale-closure bug. Flagged for manual
        // review rather than generating a plausible-looking but potentially wrong rewrite.
        requiresManualReview = true;
        if (code.includes(snippet)) {
          remediatedCode = code.replace(
            snippet,
            `// [FIGM Manual Review Required]: Extract this inline callback into a stable handler (e.g. a top-level function keyed by the item's id, or useCallback with the correct per-item dependency) — cannot be safely automated because it closes over the current loop item.\n${snippet}`
          );
        }
        appliedFixDescription = 'Manual review required: extract this inline render-loop callback into a stable, correctly-memoized handler. This cannot be safely automated because the callback closes over the current loop item.';
        break;
      }

      case 'FIGM-PERF-06': {
        // Synchronous Web Storage API accessed inside a loop — hoist the read/write outside the
        // loop when it does not depend on the loop variable (the common real case: reading the
        // same key on every iteration, e.g. an auth token).
        if (code.includes(snippet)) {
          const declMatch = snippet.match(/^(const|let|var)\s+(\w+)\s*=\s*((?:local|session)Storage\.\w+\([^)]*\));?\s*$/);
          if (declMatch) {
            const [, decl, varName, storageCall] = declMatch;
            const hoistedDecl = `// [FIGM Quick-Fix]: Hoisted repeated Storage API read outside loop scope\n${decl} ${varName} = ${storageCall};\n\n`;
            remediatedCode = hoistedDecl + code.replace(snippet, '');
            appliedFixDescription = `Hoisted the repeated ${varName} storage read outside the loop so it runs once instead of once per iteration.`;
          } else {
            appliedFixDescription = 'Hoist this Storage API call outside the loop if its result does not depend on the current loop iteration; otherwise cache the result across iterations.';
          }
        } else {
          appliedFixDescription = 'Hoist this Storage API call outside the loop if its result does not depend on the current loop iteration; otherwise cache the result across iterations.';
        }
        break;
      }

      case 'FIGM-A11Y-01': {
        // Add keyboard listener and tabIndex to click handler
        if (code.includes(snippet)) {
          let fixedSnippet = snippet.replace(/<div\b/, '<div role="button" tabIndex={0}');
          if (!fixedSnippet.includes('onKeyDown')) {
            // The captured group ($1) is the onClick attribute's VALUE expression, which is
            // routinely an arrow function (e.g. `() => handleClick(item)`) rather than a bare
            // function reference. Calling it as `$1()` without wrapping parens is a real,
            // live-reproduced bug: due to operator precedence, `() => handleClick(item)()`
            // parses as an arrow function whose BODY is `handleClick(item)()` — it defines a
            // function and never calls it, a silent no-op. Wrapping in parens, `($1)()`, calls
            // the value correctly whether it's an arrow function or a bare reference.
            fixedSnippet = fixedSnippet.replace(
              /onClick=\{(.*?)\}/,
              'onClick={$1} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { ($1)(); } }}'
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

      case 'FIGM-REACT-02': {
        // Replace an array-index (or loop-index-variable) key with a stable identifier derived
        // from the .map() callback's item parameter — the actual fix FIGM-REACT-02 asks for.
        // Previously this rule had NO case here at all and silently fell through to the generic
        // "universal fallback" below, which pattern-matches the code's superficial shape rather
        // than the rule being fixed — live-reproduced misfiring the A11Y "clickable element"
        // template on a key-prop violation because the snippet also happened to contain onClick.
        if (code.includes(snippet)) {
          const mapParamMatch = snippet.match(/\.map\(\s*\(?\s*(\w+)/);
          const itemVar = mapParamMatch ? mapParamMatch[1] : 'item';
          const fixedSnippet = snippet.replace(/key=\{\s*(index|i|idx)\s*\}/, `key={${itemVar}.id}`);
          remediatedCode = code.replace(snippet, fixedSnippet);
          appliedFixDescription = `Replaced array-index key with a stable identifier (${itemVar}.id).`;
        } else {
          remediatedCode = code.replace(/key=\{\s*(index|i|idx)\s*\}/g, 'key={item.id}');
          appliedFixDescription = 'Replaced array-index key props with a stable identifier placeholder (item.id) — adjust to match your actual data shape.';
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
          // Match the snippet's ACTUAL opening tag name, not a hardcoded `<div`. The rule fires on
          // any dynamic status container, not only <div> (e.g. a Vue/React `<span class="status-...">`
          // -- live-reproduced: a `<div\b` regex against a `<span ...>` snippet never matches, so
          // `fixedSnippet === snippet` and the subsequent `code.replace(snippet, fixedSnippet)` is a
          // silent no-op that changes nothing, while still reporting an appliedFixDescription as if
          // it had worked (the pipeline's own re-scan does correctly catch this as `verified: false`,
          // but the code itself was never patched).
          const fixedSnippet = snippet.replace(/<(\w+)\b/, '<$1 role="status" aria-live="polite"');
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

      case 'FIGM-A11Y-05': {
        // Unlabeled form input — inject an explicit aria-label derived from context where
        // possible (placeholder text is the most reliable per-element hint available at the
        // snippet level), otherwise a generic placeholder the developer must fill in.
        if (code.includes(snippet)) {
          const placeholderMatch = snippet.match(/placeholder=["']([^"']+)["']/);
          const label = placeholderMatch ? placeholderMatch[1] : 'TODO: describe this field';
          const fixedSnippet = snippet.replace(/<(input|textarea|select)\b/, `<$1 aria-label="${label}"`);
          remediatedCode = code.replace(snippet, fixedSnippet);
          appliedFixDescription = placeholderMatch
            ? `Injected aria-label="${label}" derived from the existing placeholder text.`
            : 'Injected a placeholder aria-label — replace with a real accessible description of this field.';
        } else {
          remediatedCode = code.replace(/<(input|textarea|select)\b/g, '<$1 aria-label="TODO: describe this field"');
          appliedFixDescription = 'Injected placeholder aria-label attributes — replace with real accessible descriptions.';
        }
        break;
      }

      case 'FIGM-A11Y-06': {
        // Positive tabIndex overrides natural focus order — reset to 0 (focusable in natural DOM
        // order) rather than guessing an intended custom order, which would just be a different
        // instance of the same anti-pattern.
        if (code.includes(snippet)) {
          const fixedSnippet = snippet.replace(/tab[Ii]ndex=(["'{])[1-9]\d*(["'}])/, 'tabIndex=$10$2');
          remediatedCode = code.replace(snippet, fixedSnippet);
          appliedFixDescription = 'Reset the positive tabIndex to 0 (natural DOM focus order) instead of an arbitrary custom order.';
        } else {
          remediatedCode = code.replace(/tab[Ii]ndex=(["'{])[1-9]\d*(["'}])/g, 'tabIndex=$10$2');
          appliedFixDescription = 'Reset positive tabIndex values to 0 (natural DOM focus order).';
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
        // The live FIGM-NEXT-02 rule (isHeavyStaticImportInNext in source-parser.ts) flags a
        // heavy module imported statically in a Next.js file instead of loaded lazily — this
        // case previously converted native <img> tags to next/image's <Image>, a fix for a
        // completely unrelated concern (an old-taxonomy mismatch, the same class of bug found
        // and fixed for FIGM-REACT-01/FIGM-NEXT-04 above).
        //
        // A first fix wrapped every heavy import unconditionally in `next/dynamic`. That was
        // found to be genuinely WRONG, not just risky, by live-testing it against the rule's own
        // real target module list (monaco-editor, chart.js, three, canvas, echarts, d3): every
        // one of these is a vanilla JS library, not a React component. `next/dynamic` is
        // specifically for lazy-loading a COMPONENT (its type signature expects the imported
        // module to resolve to `{ default: ComponentType } | ComponentType`) — wrapping a vanilla
        // library in it produces code that fails real type-checking (reproduced live against the
        // actual installed `monaco-editor` package, not a hypothetical). The genuinely correct
        // fix depends on how the binding is actually used elsewhere in the file (as a component,
        // vs. as a plain API surface loaded inside an effect/handler) — information this snippet-
        // level template cannot see, so this is flagged for manual review rather than guessing.
        requiresManualReview = true;
        const importMatch = snippet.match(/import\s+(\w+)\s+from\s+(['"][^'"]+['"]);?/);
        const compName = importMatch ? importMatch[1] : 'the imported binding';
        const modPath = importMatch ? importMatch[2] : "'the-module'";
        if (code.includes(snippet)) {
          remediatedCode = code.replace(
            snippet,
            `// [FIGM Manual Review Required]: If ${compName} is rendered as a React component, wrap it: const ${compName} = dynamic(() => import(${modPath}), { ssr: false }) (requires: import dynamic from 'next/dynamic'). If it is a vanilla library (the common case for monaco-editor/chart.js/three/canvas/echarts/d3), load it lazily instead, e.g. inside a useEffect: useEffect(() => { import(${modPath}).then((mod) => { /* use mod */ }); }, []). Which applies depends on how ${compName} is actually used below — not safely inferable from this line alone.\n${snippet}`
          );
        }
        appliedFixDescription = `Manual review required: ${compName} needs a lazy-loading strategy, but which one (next/dynamic for a component vs. a plain lazy import() for a vanilla library) depends on how it is used elsewhere in the file — not safely inferable from the import line alone.`;
        break;
      }

      case 'FIGM-NEXT-03': {
        // Missing `export const revalidate` on an App Router page. The diagnostic's snippet is a
        // synthetic marker ('export const revalidate'), not a real source line — the whole point
        // is that the real line is absent — so the fix always inserts it at the top of the file.
        // 60 seconds is a conservative, commonly-recommended default; the developer should tune
        // it to the page's real staleness tolerance.
        remediatedCode = `export const revalidate = 60; // [FIGM Quick-Fix]: adjust to this page's real staleness tolerance\n\n${code}`;
        appliedFixDescription = 'Added export const revalidate = 60 route segment configuration — adjust the value to this page\'s real staleness tolerance.';
        break;
      }

      case 'FIGM-NEXT-04': {
        // The live FIGM-NEXT-04 rule (isExternalFontLink in source-parser.ts) flags an external
        // Google Fonts <link> tag — this case previously guarded `window.` access instead, a fix
        // for a completely unrelated concern (the same old-taxonomy mismatch found and fixed for
        // FIGM-REACT-01/FIGM-NEXT-02 above; found via the real detect->remediate->re-scan
        // verification run across all 25 rules, not assumed).
        requiresManualReview = true;
        const familyMatch = snippet.match(/family=([^&"']+)/);
        if (familyMatch && code.includes(snippet)) {
          const family = familyMatch[1].split(':')[0].replace(/\+/g, ' ');
          const exportName = family.replace(/\s+/g, '');
          const varName = exportName.charAt(0).toLowerCase() + exportName.slice(1);
          const importDecl = `import { ${exportName} } from 'next/font/google';\nconst ${varName} = ${exportName}({ subsets: ['latin'] });\n\n`;
          remediatedCode = importDecl + code.replace(
            snippet,
            `{/* [FIGM Manual Review Required]: apply className={${varName}.className} to the real <html> or <body> element — cannot be safely automated without knowing where it belongs in the JSX tree. */}`
          );
          appliedFixDescription = `Replaced the external Google Fonts <link> with a next/font/google import (${exportName}) — apply className={${varName}.className} to the appropriate <html>/<body> element manually.`;
        } else {
          appliedFixDescription = 'Manual review required: replace this external Google Fonts <link> with a next/font/google import and apply its className to the appropriate element.';
        }
        break;
      }

      case 'FIGM-REACT-01': {
        // The live FIGM-REACT-01 rule (isExpensiveDerivedStateWithoutMemo in source-parser.ts)
        // flags an expensive derived computation (.sort()/.filter()/.reduce()) in render with no
        // useMemo — this case previously fixed `key={Math.random()}` instead, a violation that
        // does not correspond to what the rule actually detects (a leftover from an older rule
        // taxonomy), so real FIGM-REACT-01 violations were never actually remediated.
        //
        // A correct fix means wrapping the computation in `useMemo(() => EXPR, [deps])`, but the
        // real dependency array cannot be safely inferred from the snippet alone — guessing wrong
        // (e.g. an empty array) produces a stale-closure bug that can be worse than the original
        // missing-memoization issue. This is not safely automatable, so it is flagged for manual
        // review (requiresManualReview) rather than faking a complete fix that would pass a naive
        // "does the rule still fire" re-scan check by coincidence of the word "useMemo" appearing
        // on the line.
        requiresManualReview = true;
        if (code.includes(snippet)) {
          remediatedCode = code.replace(
            snippet,
            `// [FIGM Manual Review Required]: Wrap in React.useMemo(() => { ... }, [/* real dependencies */]) — the dependency array cannot be safely inferred automatically.\n${snippet}`
          );
        }
        appliedFixDescription = 'Manual review required: wrap this expensive derived computation in React.useMemo() with the correct dependency array. This cannot be safely automated because the real dependencies cannot be reliably inferred from the code alone.';
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

      case 'FIGM-REACT-04': {
        // Inline callback prop passed to a custom component without useCallback. A safe fix
        // requires knowing the real dependency array — the same constraint as FIGM-PERF-01 and
        // FIGM-REACT-01 above — so this is flagged for manual review rather than guessing an
        // empty dependency array, which risks a stale-closure bug if the callback actually closes
        // over a changing value.
        requiresManualReview = true;
        if (code.includes(snippet)) {
          remediatedCode = code.replace(
            snippet,
            `// [FIGM Manual Review Required]: Wrap this inline callback in React.useCallback(fn, [/* real dependencies */]) — cannot be safely automated because the dependency array cannot be reliably inferred.\n${snippet}`
          );
        }
        appliedFixDescription = 'Manual review required: wrap this inline callback prop in React.useCallback() with the correct dependency array. This cannot be safely automated because the real dependencies cannot be reliably inferred from the code alone.';
        break;
      }

      // NOTE: this case previously existed under the nonexistent rule ID 'FIGM-ANGULAR-01' (the
      // real ID is 'FIGM-ANG-01') — its logic was correct for what it does, just registered under
      // an ID the live engine never actually emits, so it was completely unreachable dead code.
      case 'FIGM-ANG-01': {
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

      case 'FIGM-ANG-02': {
        // Add ChangeDetectionStrategy.OnPush to the @Component decorator.
        if (code.includes('@Component({')) {
          remediatedCode = code.replace(
            /@Component\(\{/,
            '@Component({\n  changeDetection: ChangeDetectionStrategy.OnPush,'
          );
          // Must check the ORIGINAL `code`, not `remediatedCode` -- the decorator edit just above
          // already inserted the literal text "ChangeDetectionStrategy.OnPush" into remediatedCode,
          // so checking remediatedCode here was always trivially true and this import-injection
          // block could never run, live-reproduced as broken output (`ChangeDetectionStrategy` used
          // in the decorator but never imported, so the "fixed" file does not compile) even though
          // FIGM's own re-scan reported `verified: true` (its ANG-02 detector only checks for the
          // decorator property's text, not import correctness).
          if (!code.includes('ChangeDetectionStrategy')) {
            if (/from\s+['"]@angular\/core['"]/.test(remediatedCode)) {
              remediatedCode = remediatedCode.replace(
                /import\s*\{([^}]*)\}\s*from\s*['"]@angular\/core['"]/,
                (_m: string, names: string) => `import {${names.includes('ChangeDetectionStrategy') ? names : names + ', ChangeDetectionStrategy'}} from '@angular/core'`
              );
            } else {
              remediatedCode = `import { ChangeDetectionStrategy } from '@angular/core';\n${remediatedCode}`;
            }
          }
          appliedFixDescription = 'Added changeDetection: ChangeDetectionStrategy.OnPush to the @Component decorator.';
        }
        break;
      }

      // Previously existed under the nonexistent rule ID 'FIGM-ANGULAR-02' (the real ID for
      // "*ngFor without trackBy" is 'FIGM-ANG-03', not 'FIGM-ANG-02' which is "missing OnPush").
      case 'FIGM-ANG-03': {
        // Add trackBy to *ngFor
        if (code.includes('*ngFor')) {
          remediatedCode = code.replace(/\*ngFor="let\s+(\w+)\s+of\s+([^"]+)"/g, '*ngFor="let $1 of $2; trackBy: trackById"');
          appliedFixDescription = 'Added trackBy: trackById iteration function to *ngFor directive — a matching trackById(index, item) method must exist on the component class.';
        }
        break;
      }

      case 'FIGM-ANG-04': {
        // A method call inside an Angular template ({{ computeTotal() }}) re-executes on every
        // change-detection cycle. A correct fix means converting it to a getter, a memoized
        // signal, or a pure pipe — which requires understanding what the method actually does,
        // not safely inferable from the template snippet alone.
        requiresManualReview = true;
        if (code.includes(snippet)) {
          remediatedCode = code.replace(
            snippet,
            `<!-- [FIGM Manual Review Required]: Convert this method call to a getter, a cached signal, or a pure pipe — re-executing on every change-detection cycle cannot be safely auto-fixed without knowing what the method computes. -->\n${snippet}`
          );
        }
        appliedFixDescription = 'Manual review required: convert this template method call to a getter, cached signal, or pure pipe. This cannot be safely automated without knowing what the method computes.';
        break;
      }

      case 'FIGM-ANG-05': {
        // Direct nativeElement DOM mutation bypasses Angular's Renderer2 abstraction (breaks
        // server-side rendering / Web Worker rendering). The common, well-defined sub-case —
        // setting a single style property — has a safe, mechanical Renderer2 equivalent; other
        // shapes (innerHTML, setAttribute, classList, ...) are flagged for manual review since a
        // generic textual rewrite risks getting the Renderer2 method/argument order wrong.
        const styleMatch = snippet.match(/this\.(\w+)\.nativeElement\.style\.(\w+)\s*=\s*(.+?);?\s*$/);
        if (styleMatch) {
          const [, elRef, styleProp, value] = styleMatch;
          const fixedSnippet = `this.renderer.setStyle(this.${elRef}.nativeElement, '${styleProp}', ${value});`;
          remediatedCode = code.replace(snippet, fixedSnippet);
          appliedFixDescription = `Replaced direct nativeElement.style.${styleProp} mutation with this.renderer.setStyle() — ensure Renderer2 is injected in the constructor.`;
        } else {
          requiresManualReview = true;
          if (code.includes(snippet)) {
            remediatedCode = code.replace(
              snippet,
              `// [FIGM Manual Review Required]: Replace this direct nativeElement mutation with the matching Renderer2 method (setProperty/setAttribute/appendChild/etc.) — cannot be safely automated for this mutation shape.\n${snippet}`
            );
          }
          appliedFixDescription = 'Manual review required: replace this direct nativeElement mutation with the matching Renderer2 method. Only the common style-property-assignment shape can be safely auto-fixed.';
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
              // Wrap the captured handler value in parens before invoking it — see the identical,
              // live-reproduced fix in the FIGM-A11Y-01 case above for why `$1()` alone is broken
              // whenever the onClick value is an arrow function rather than a bare reference.
              const fixedSnippet = rawSnippet.replace(/<(div|span|p|a|li|section)\b/i, '<$1 role="button" tabIndex={0}')
                .replace(/onClick=\{(.*?)\}/, 'onClick={$1} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { ($1)(); } }}');
              remediatedCode = code.replace(rawSnippet, fixedSnippet);
              appliedFixDescription = 'Annotated non-interactive element with ARIA role="button", tabIndex={0}, and keyboard listener.';
            } else if (rawSnippet.includes('(click)=')) {
              // Two bugs fixed here: the tag-annotation replace referenced a nonexistent second
              // capture group ($2 — the regex only has one), silently injecting an empty
              // `(keydown.enter)=""`; and the handler was invoked twice ("$1()" appended to a
              // captured value that, per Angular template convention, already ends in "()", e.g.
              // `(click)="doSomething()"` -> "doSomething()()" — calling the return value).
              const clickMatch = rawSnippet.match(/\(click\)="([^"]+)"/);
              const handlerExpr = clickMatch ? clickMatch[1] : '';
              let fixedSnippet = rawSnippet.replace(/<(div|span|p|a|li|section)\b/i, '<$1 role="button" tabindex="0"');
              if (handlerExpr) {
                fixedSnippet = fixedSnippet.replace(/\(click\)="([^"]+)"/, `(click)="${handlerExpr}" (keydown.enter)="${handlerExpr}"`);
              }
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
      requiresManualReview,
    };
  }

  /**
   * Re-scan proposed patch in isolated copy to verify if the original issue is resolved and 0 syntax errors exist.
   * `requiresManualReview` (from RemediationResult) short-circuits straight to MANUAL_REVIEW_REQUIRED — a rule
   * whose safe fix depends on information that cannot be reliably inferred (e.g. a useMemo dependency array)
   * must never be reported as FIXED merely because the specific ruleId happens to stop firing on re-scan.
   */
  public static validatePatch(
    originalCode: string,
    remediatedCode: string,
    defect: DiagnosticReport,
    requiresManualReview = false
  ): { isValid: boolean; status: 'FIXED' | 'PATCH_REJECTED' | 'UNRESOLVED' | 'MANUAL_REVIEW_REQUIRED'; remainingDiagnostics: DiagnosticReport[] } {
    if (requiresManualReview) {
      return { isValid: false, status: 'MANUAL_REVIEW_REQUIRED', remainingDiagnostics: [defect] };
    }

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

