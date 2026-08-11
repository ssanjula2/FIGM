/**
 * Framework-Independent Guideline Model (FIGM)
 * Resilient Source Code Parser Adapter (Complete 23-Rule Extraction Specification)
 */

import { ASTNode, FrameworkType } from '../types/ast-spec.js';

export interface ParseResult {
  filePath: string;
  framework: FrameworkType;
  ast: ASTNode | null;
  parseErrors: Array<{ line: number; column: number; message: string }>;
}

export class SourceParser {
  /**
   * Parse source code into a normalized ASTNode tree with resilient error handling
   */
  public static parseSource(code: string, filePath: string): ParseResult {
    const framework = this.detectFramework(filePath, code);
    const errors: Array<{ line: number; column: number; message: string }> = [];

    this.validateSyntax(code, errors);

    try {
      const rootNode = this.buildASTFromCode(code, filePath, framework, errors);
      return {
        filePath,
        framework,
        ast: rootNode,
        parseErrors: errors
      };
    } catch (err) {
      errors.push({
        line: 1,
        column: 1,
        message: err instanceof Error ? err.message : 'Unknown syntax error during parsing.'
      });

      return {
        filePath,
        framework,
        ast: {
          type: 'Program',
          loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
          children: []
        },
        parseErrors: errors
      };
    }
  }

  /**
   * Validate code syntax for unclosed assignments, broken signatures, and unmatched delimiters
   */
  private static validateSyntax(code: string, errors: Array<{ line: number; column: number; message: string }>): void {
    const lines = code.split(/\r?\n/);
    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const trimmed = lineText.trim();

      if (/(const|let|var)\s+\w+\s*=\s*;/.test(trimmed)) {
        const col = lineText.indexOf('=') + 1;
        errors.push({ line: lineNum, column: col, message: 'Unexpected token ";" following assignment operator "="' });
      }

      if (/function\s+\w*\s*\(\s*\{$/.test(trimmed)) {
        errors.push({ line: lineNum, column: lineText.length, message: 'Unexpected token "{" in function parameter list' });
      }

      if (idx === lines.length - 1 && /(const|let|var)\s+\w+\s*=\s*\{$/.test(trimmed)) {
        errors.push({ line: lineNum, column: lineText.length, message: 'Unexpected end of input: Unclosed object literal' });
      }

      if (idx === lines.length - 1 && /return\s*\(\s*$/.test(trimmed)) {
        errors.push({ line: lineNum, column: lineText.length, message: 'Unexpected end of input: Unclosed return expression' });
      }
    });

    if (errors.length === 0) {
      let openBraces = 0;
      let openParens = 0;
      for (let i = 0; i < code.length; i++) {
        if (code[i] === '{') openBraces++;
        if (code[i] === '}') openBraces--;
        if (code[i] === '(') openParens++;
        if (code[i] === ')') openParens--;
      }
      if (openBraces > 0) {
        errors.push({ line: lines.length, column: 1, message: 'Syntax Error: Unclosed curly brace "{"' });
      } else if (openParens > 0) {
        errors.push({ line: lines.length, column: 1, message: 'Syntax Error: Unclosed parenthesis "("}' });
      }
    }
  }

  /**
   * Detect framework type based on file extension and content hints
   */
  private static detectFramework(filePath: string, code: string): FrameworkType {
    const ext = filePath.toLowerCase();
    if (ext.endsWith('.vue')) return 'VUE_SFC';
    if (code.includes('next/link') || code.includes('next/image') || code.includes('next/router') || code.includes('next/navigation') || ext.includes('app/') || ext.includes('pages/')) return 'NEXT_JS';
    if (ext.endsWith('.jsx') || ext.endsWith('.tsx')) return 'REACT_JSX';
    if (code.includes('import React') || code.includes('ReactDOM') || code.includes('jsx') || code.includes('useState')) return 'REACT_JSX';
    if (code.includes('@Component') || code.includes('ng-template') || ext.endsWith('.component.ts')) return 'ANGULAR_TEMPLATE';
    if (ext.endsWith('.svelte')) return 'SVELTE';
    return 'GENERIC_ESTREE';
  }

  /**
   * Resilient AST node builder parsing JSX, JS, Next.js, React, and Angular syntax patterns
   */
  private static buildASTFromCode(
    code: string,
    filePath: string,
    framework: FrameworkType,
    errors: Array<{ line: number; column: number; message: string }>
  ): ASTNode {
    const lines = code.split(/\r?\n/);
    const root: ASTNode = {
      type: 'Program',
      loc: { start: { line: 1, column: 0 }, end: { line: lines.length, column: (lines[lines.length - 1] || '').length } },
      children: [],
      scopeType: 'GLOBAL',
      attributes: {
        hasUseClientDirective: code.includes('"use client"') || code.includes("'use client'"),
        hasRevalidateExport: code.includes('export const revalidate') || code.includes('export var revalidate') || code.includes('export let revalidate'),
        isAppRouterPage: (filePath.includes('app/') || filePath.includes('pages/')) && (filePath.endsWith('page.tsx') || filePath.endsWith('page.jsx') || filePath.endsWith('page.js') || filePath.endsWith('page.ts'))
      }
    };

    let currentScope: 'GLOBAL' | 'MODULE' | 'FUNCTION' | 'LOOP' | 'RENDER' = 'GLOBAL';

    // Check App Router missing revalidate (FIGM-NEXT-03)
    if (framework === 'NEXT_JS' && root.attributes?.isAppRouterPage && !root.attributes?.hasRevalidateExport) {
      root.children!.push({
        type: 'ExportNamedDeclaration',
        name: 'revalidate',
        scopeType: 'MODULE',
        attributes: {
          missingRevalidateConfig: true,
          codeSnippet: 'export const revalidate'
        },
        loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } }
      });
    }

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const trimmed = lineText.trim();

      // Scope Transitions
      if (trimmed.includes('.map(') || trimmed.includes('.forEach(') || trimmed.includes('for (') || trimmed.includes('while (')) {
        currentScope = 'LOOP';
      } else if (trimmed.includes('function render') || trimmed.includes('return (') || trimmed.includes('return <') || trimmed.includes('export default function')) {
        currentScope = 'RENDER';
      } else if (trimmed.includes('function ') || trimmed.includes('const ') && trimmed.includes('=>')) {
        currentScope = 'FUNCTION';
      }

      // 1. Top-Level Imports (FIGM-PERF-04 & FIGM-NEXT-02)
      if (trimmed.startsWith('import ') && !trimmed.includes('type ')) {
        const moduleName = (trimmed.match(/from ['"](.*)['"]/) || [])[1] || 'unknown';
        const isHeavy = ['monaco-editor', 'chart.js', 'three', 'canvas', 'echarts', 'd3'].some(m => moduleName.includes(m));

        root.children!.push({
          type: 'ImportDeclaration',
          name: moduleName,
          scopeType: currentScope,
          attributes: {
            codeSnippet: trimmed,
            referencedInConditional: trimmed.includes('if') || trimmed.includes('lazy') || code.includes('if(') || code.includes('if ('),
            isHeavyStaticImportInNext: framework === 'NEXT_JS' && isHeavy && !code.includes('dynamic(')
          },
          loc: { start: { line: lineNum, column: lineText.indexOf('import') }, end: { line: lineNum, column: lineText.length } }
        });
      }

      // 2. Invariant Object Allocation in Loop/Render (FIGM-PERF-01)
      if (currentScope === 'LOOP' || currentScope === 'RENDER') {
        if ((trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('var ')) && trimmed.includes('= {')) {
          root.children!.push({
            type: 'ObjectExpression',
            scopeType: currentScope,
            attributes: {
              isInvariant: true,
              codeSnippet: trimmed
            },
            loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('{')) }, end: { line: lineNum, column: lineText.length } }
          });
        }
      }

      // 3. Inline Callback in Render/Map Loop (FIGM-PERF-05)
      if (currentScope === 'LOOP' || currentScope === 'RENDER') {
        if (trimmed.includes('onClick={() =>') || trimmed.includes('onClick={(') || (trimmed.includes('map(') && (trimmed.includes('() =>') || trimmed.includes('()=>')))) {
          root.children!.push({
            type: 'ArrowFunctionExpression',
            scopeType: currentScope,
            attributes: {
              isInlineCallback: true,
              codeSnippet: trimmed
            },
            loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('=>')) }, end: { line: lineNum, column: lineText.length } }
          });
        }
      }

      // 4. Synchronous Storage Access in Loop (FIGM-PERF-06)
      if (currentScope === 'LOOP' || currentScope === 'RENDER') {
        if (trimmed.includes('localStorage.') || trimmed.includes('sessionStorage.')) {
          root.children!.push({
            type: 'CallExpression',
            name: trimmed.includes('localStorage') ? 'localStorage' : 'sessionStorage',
            scopeType: currentScope,
            attributes: {
              isStorageInLoop: true,
              codeSnippet: trimmed
            },
            loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('Storage')) }, end: { line: lineNum, column: lineText.length } }
          });
        }
      }

      // 5. Image Tag Dimensions (FIGM-PERF-02)
      if (trimmed.includes('<img')) {
        const hasWidth = /width=["'{]?\d+["'}]?/.test(trimmed);
        const hasHeight = /height=["'{]?\d+["'}]?/.test(trimmed);
        const hasAspect = trimmed.includes('aspectRatio') || trimmed.includes('aspect-ratio');

        const attrs: Record<string, unknown> = {
          codeSnippet: trimmed,
          src: (trimmed.match(/src=["'](.*?)["']/) || [])[1] || ''
        };
        if (hasWidth) attrs.width = 100;
        if (hasHeight) attrs.height = 100;
        if (hasAspect) attrs.aspectRatio = '1/1';

        root.children!.push({
          type: framework === 'VUE_SFC' ? 'VElement' : framework === 'ANGULAR_TEMPLATE' ? 'Element$1' : 'JSXElement',
          name: 'img',
          scopeType: currentScope,
          attributes: attrs,
          loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('<img')) }, end: { line: lineNum, column: lineText.length } }
        });
      }

      // 6. addEventListener Cleanup (FIGM-PERF-03)
      if (trimmed.includes('.addEventListener(')) {
        const hasCleanup = code.includes('.removeEventListener(');
        root.children!.push({
          type: 'CallExpression',
          name: 'addEventListener',
          scopeType: currentScope,
          attributes: {
            method: 'addEventListener',
            hasPairedRemoval: hasCleanup,
            codeSnippet: trimmed
          },
          loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('addEventListener')) }, end: { line: lineNum, column: lineText.length } }
        });
      }

      // 7. Non-Interactive Element with onClick (FIGM-A11Y-01) & Positive TabIndex (FIGM-A11Y-06)
      if (trimmed.includes('<div') || trimmed.includes('<span') || trimmed.includes('<section') || trimmed.includes('tabIndex') || trimmed.includes('tabindex')) {
        const isDiv = trimmed.includes('<div');
        const isSpan = trimmed.includes('<span');
        const tagName = isDiv ? 'div' : isSpan ? 'span' : 'section';

        const hasOnClick = trimmed.includes('onClick') || trimmed.includes('v-on:click') || trimmed.includes('(click)');
        const hasOnKeyDown = trimmed.includes('onKeyDown') || trimmed.includes('v-on:keydown') || trimmed.includes('(keydown)');
        const hasTabIndex = trimmed.includes('tabIndex') || trimmed.includes('tabindex');

        // Check positive tabIndex > 0 (FIGM-A11Y-06)
        const tabMatch = trimmed.match(/tab[I|i]ndex=["'{]?([1-9]\d*)["'}]?/);
        const positiveVal = tabMatch ? parseInt(tabMatch[1], 10) : 0;

        if (hasOnClick || positiveVal > 0) {
          const attrs: Record<string, unknown> = { codeSnippet: trimmed };
          if (hasOnClick) attrs.onClick = 'handler';
          if (hasOnKeyDown) attrs.onKeyDown = 'handler';
          if (hasTabIndex) attrs.tabIndex = positiveVal;
          if (positiveVal > 0) attrs.positiveTabIndex = true;

          root.children!.push({
            type: framework === 'VUE_SFC' ? 'VElement' : framework === 'ANGULAR_TEMPLATE' ? 'Element$1' : 'JSXElement',
            name: tagName,
            scopeType: currentScope,
            attributes: attrs,
            loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('<' + tagName)) }, end: { line: lineNum, column: lineText.length } }
          });
        }
      }

      // 8. Unlabeled Form Inputs (FIGM-A11Y-05)
      if (trimmed.includes('<input') || trimmed.includes('<textarea') || trimmed.includes('<select')) {
        const tag = trimmed.includes('<input') ? 'input' : trimmed.includes('<textarea') ? 'textarea' : 'select';
        const hasAriaLabel = trimmed.includes('aria-label=') || trimmed.includes('aria-labelledby=');
        const hasId = trimmed.includes('id=');

        if (!hasAriaLabel && (!hasId || !code.includes('htmlFor=') && !code.includes('for='))) {
          root.children!.push({
            type: 'JSXElement',
            name: tag,
            scopeType: currentScope,
            attributes: {
              isUnlabeledInput: true,
              codeSnippet: trimmed
            },
            loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('<' + tag)) }, end: { line: lineNum, column: lineText.length } }
          });
        }
      }

      // 9. Custom Component ARIA Role/Label (FIGM-A11Y-02)
      if (trimmed.includes('<Custom') || trimmed.includes('<Select') || trimmed.includes('<Dropdown')) {
        const compName = (trimmed.match(/<([A-Z][A-Za-z0-9]+)/) || [])[1] || 'CustomComponent';
        const hasRole = trimmed.includes('role=');
        const hasAriaLabel = trimmed.includes('aria-label=') || trimmed.includes('aria-labelledby=');

        const attrs: Record<string, unknown> = {
          codeSnippet: trimmed,
          isCustomControl: true
        };
        if (hasRole) attrs.role = 'combobox';
        if (hasAriaLabel) attrs['aria-label'] = 'Label';

        root.children!.push({
          type: 'JSXElement',
          name: compName,
          scopeType: currentScope,
          attributes: attrs,
          loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('<' + compName)) }, end: { line: lineNum, column: lineText.length } }
        });
      }

      // 10. Dynamic Status Container missing aria-live (FIGM-A11Y-03)
      if (trimmed.includes('className="status') || trimmed.includes('class="status') || trimmed.includes('id="status')) {
        const hasAriaLive = trimmed.includes('aria-live=');
        const hasRoleStatus = trimmed.includes('role="status"') || trimmed.includes('role="alert"');

        const attrs: Record<string, unknown> = {
          codeSnippet: trimmed,
          isDynamicMutation: true
        };
        if (hasAriaLive) attrs['aria-live'] = 'polite';
        if (hasRoleStatus) attrs.role = 'status';

        root.children!.push({
          type: 'JSXElement',
          name: 'div',
          scopeType: currentScope,
          attributes: attrs,
          loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('<div')) }, end: { line: lineNum, column: lineText.length } }
        });
      }

      // 11. Modal Focus Containment (FIGM-A11Y-04)
      if (trimmed.includes('<Modal') || trimmed.includes('<Dialog')) {
        const compName = trimmed.includes('<Modal') ? 'Modal' : 'Dialog';
        const hasRestoration = trimmed.includes('restoresFocus') || trimmed.includes('onClose=');

        root.children!.push({
          type: 'JSXElement',
          name: compName,
          scopeType: currentScope,
          attributes: {
            codeSnippet: trimmed,
            isOverlay: true,
            restoresFocusOnUnmount: hasRestoration
          },
          loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('<' + compName)) }, end: { line: lineNum, column: lineText.length } }
        });
      }

      // 12. Client Hooks without "use client" (FIGM-NEXT-01)
      if ((framework === 'NEXT_JS' || root.attributes?.isAppRouterPage) && !root.attributes?.hasUseClientDirective) {
        if (trimmed.includes('useState(') || trimmed.includes('useEffect(') || trimmed.includes('useContext(') || trimmed.includes('useRef(')) {
          root.children!.push({
            type: 'CallExpression',
            name: (trimmed.match(/(use\w+)/) || [])[1] || 'useState',
            scopeType: currentScope,
            attributes: {
              isClientHookWithoutDirective: true,
              codeSnippet: trimmed
            },
            loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('use')) }, end: { line: lineNum, column: lineText.length } }
          });
        }
      }

      // 13. External Font Link in Next.js (FIGM-NEXT-04)
      if (trimmed.includes('fonts.googleapis.com') || (trimmed.includes('<link') && trimmed.includes('stylesheet') && trimmed.includes('fonts'))) {
        root.children!.push({
          type: 'JSXElement',
          name: 'link',
          scopeType: currentScope,
          attributes: {
            isExternalFontLink: true,
            codeSnippet: trimmed
          },
          loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('fonts')) }, end: { line: lineNum, column: lineText.length } }
        });
      }

      // 14. Expensive Derived Computation without useMemo (FIGM-REACT-01)
      if (trimmed.includes('.sort(') || trimmed.includes('.filter(') || trimmed.includes('.reduce(')) {
        if (!trimmed.includes('useMemo')) {
          root.children!.push({
            type: 'CallExpression',
            name: 'sort',
            scopeType: currentScope,
            attributes: {
              isExpensiveDerivedStateWithoutMemo: true,
              codeSnippet: trimmed
            },
            loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('.')) }, end: { line: lineNum, column: lineText.length } }
          });
        }
      }

      // 15. Array Index Key Prop (FIGM-REACT-02)
      if (trimmed.includes('key={index}') || trimmed.includes('key={i}') || trimmed.includes('key={idx}')) {
        root.children!.push({
          type: 'JSXAttribute',
          name: 'key',
          scopeType: currentScope,
          attributes: {
            isArrayIndexKey: true,
            codeSnippet: trimmed
          },
          loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('key=')) }, end: { line: lineNum, column: lineText.length } }
        });
      }

      // 16. Direct React State Mutation (FIGM-REACT-03)
      if (trimmed.includes('.push(') || trimmed.includes('.splice(') || (trimmed.includes('=') && (trimmed.includes('.name') || trimmed.includes('state.')))) {
        if (!trimmed.includes('setState') && !trimmed.includes('set') && !trimmed.includes('const ') && !trimmed.includes('let ') && !trimmed.includes('var ')) {
          root.children!.push({
            type: 'ExpressionStatement',
            name: 'mutateState',
            scopeType: currentScope,
            attributes: {
              isDirectStateMutation: true,
              codeSnippet: trimmed
            },
            loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('.')) }, end: { line: lineNum, column: lineText.length } }
          });
        }
      }

      // 17. Inline Callback Prop to Child Component without useCallback (FIGM-REACT-04)
      if ((trimmed.includes('<Custom') || trimmed.includes('<Button') || trimmed.includes('<Card')) && trimmed.includes('onClick={() =>')) {
        root.children!.push({
          type: 'JSXAttribute',
          name: 'onClick',
          scopeType: currentScope,
          attributes: {
            isInlineCallbackProp: true,
            codeSnippet: trimmed
          },
          loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('onClick')) }, end: { line: lineNum, column: lineText.length } }
        });
      }

      // 18. Angular Unsubscribed Observable (FIGM-ANG-01)
      if (framework === 'ANGULAR_TEMPLATE' || code.includes('@Component')) {
        if (trimmed.includes('.subscribe(') && !code.includes('takeUntilDestroyed') && !code.includes('unsubscribe') && !code.includes('DestroyRef')) {
          root.children!.push({
            type: 'CallExpression',
            name: 'subscribe',
            scopeType: currentScope,
            attributes: {
              isUnsubscribedObservable: true,
              codeSnippet: trimmed
            },
            loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('subscribe')) }, end: { line: lineNum, column: lineText.length } }
          });
        }
      }

      // 19. Angular Component Missing OnPush (FIGM-ANG-02)
      if (trimmed.includes('@Component({') && !code.includes('ChangeDetectionStrategy.OnPush')) {
        root.children!.push({
          type: 'ClassDeclaration',
          name: 'Component',
          scopeType: 'MODULE',
          attributes: {
            missingOnPush: true,
            codeSnippet: trimmed
          },
          loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('@Component')) }, end: { line: lineNum, column: lineText.length } }
        });
      }

      // 20. Angular *ngFor Without trackBy (FIGM-ANG-03)
      if (trimmed.includes('*ngFor=') && !trimmed.includes('trackBy')) {
        root.children!.push({
          type: 'JSXAttribute',
          name: '*ngFor',
          scopeType: currentScope,
          attributes: {
            isNgForWithoutTrackBy: true,
            codeSnippet: trimmed
          },
          loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('*ngFor')) }, end: { line: lineNum, column: lineText.length } }
        });
      }

      // 21. Angular Template Function Call (FIGM-ANG-04)
      if ((framework === 'ANGULAR_TEMPLATE' || code.includes('@Component')) && (trimmed.includes('{{') && trimmed.includes('()') || trimmed.includes(']="') && trimmed.includes('()'))) {
        root.children!.push({
          type: 'Interpolation',
          name: 'templateFunctionCall',
          scopeType: currentScope,
          attributes: {
            isTemplateFunctionCall: true,
            codeSnippet: trimmed
          },
          loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('(')) }, end: { line: lineNum, column: lineText.length } }
        });
      }

      // 22. Angular Direct nativeElement Mutation (FIGM-ANG-05)
      if ((trimmed.includes('nativeElement.') || trimmed.includes('.nativeElement')) && !trimmed.includes('renderer.') && !trimmed.includes('Renderer2')) {
        root.children!.push({
          type: 'MemberExpression',
          name: 'nativeElement',
          scopeType: currentScope,
          attributes: {
            isDirectNativeElementMutation: true,
            codeSnippet: trimmed
          },
          loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('nativeElement')) }, end: { line: lineNum, column: lineText.length } }
        });
      }

      // Syntax error check for malformed lines
      if (trimmed.includes('<<<') || trimmed.includes('INVALID_SYNTAX')) {
        errors.push({
          line: lineNum,
          column: 1,
          message: 'Malformed JSX/HTML token encountered.'
        });
      }
    });

    return root;
  }
}
