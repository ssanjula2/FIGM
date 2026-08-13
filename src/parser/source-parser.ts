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

/** Extracts local binding names introduced by a single `import ...` statement line. */
function extractImportedBindingNames(importLine: string): string[] {
  const names: string[] = [];
  const namespaceMatch = importLine.match(/import\s+\*\s+as\s+(\w+)/);
  if (namespaceMatch) names.push(namespaceMatch[1]);
  const defaultMatch = importLine.match(/import\s+(\w+)\s*(?:,|from)/);
  if (defaultMatch) names.push(defaultMatch[1]);
  const namedMatch = importLine.match(/\{([^}]*)\}/);
  if (namedMatch) {
    for (const part of namedMatch[1].split(',')) {
      const p = part.trim();
      if (!p) continue;
      const asMatch = p.match(/(\w+)\s+as\s+(\w+)/);
      names.push(asMatch ? asMatch[2] : p.split(/\s+/)[0]);
    }
  }
  return names.filter(Boolean);
}

/**
 * Character-level lexer that blanks out comment text and (most) string-literal content while
 * preserving the code's exact length/line structure, so every existing `indexOf`/column
 * calculation downstream keeps working unmodified. This is the root-cause fix for the
 * "trigger substring appears inside a comment or string" false-positive class documented in
 * docs/audit/ADVERSARIAL_DETECTION_AUDIT.md: every rule below decides whether it fires by
 * substring-matching a source line, so a comment or string containing e.g. "<img" or
 * "addEventListener(" was structurally indistinguishable from real code.
 *
 * One deliberate exception: a quoted string immediately preceded by `identifier=` with no
 * space (the universal JSX/HTML attribute-value shape, e.g. `role="status"`, `src="/x.png"`)
 * is left untouched. Without this, blanking every string would also blank real JSX attribute
 * values that other rules legitimately read (aria-label text, src paths, className values),
 * turning a false-positive fix into a new false-negative bug. A JS string *assignment*
 * (`const snippet = "..."`, which is how the audit's adversarial fixtures embed example
 * markup as documentation/display text) is not written that way — it has whitespace around
 * `=` — so it is correctly blanked.
 */
function stripCommentsAndStrings(code: string): string {
  const n = code.length;
  const out: string[] = new Array(n);
  type State = 'CODE' | 'LINE_COMMENT' | 'BLOCK_COMMENT' | 'STRING';
  let state: State = 'CODE';
  let stringQuote = '';
  let stringBlank = true;
  let i = 0;

  while (i < n) {
    const ch = code[i];
    const next = i + 1 < n ? code[i + 1] : '';

    if (state === 'CODE') {
      if (ch === '/' && next === '/') {
        out[i] = ' '; out[i + 1] = ' ';
        state = 'LINE_COMMENT';
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        out[i] = ' '; out[i + 1] = ' ';
        state = 'BLOCK_COMMENT';
        i += 2;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        const prev = i > 0 ? code[i - 1] : '';
        const prevPrev = i > 1 ? code[i - 2] : '';
        const isAttrStyle = prev === '=' && /\w/.test(prevPrev);
        // A quoted string directly after `from`/`import`/`require(` is a module specifier
        // (e.g. `import { redirect } from 'next/navigation'`) — real structural code that
        // several rules/framework-detection heuristics read, not display text, so it must not
        // be blanked even though it doesn't have the JSX-attribute `identifier=` shape.
        const lookbehind = code.slice(Math.max(0, i - 24), i);
        const isModuleSpecifier = /\b(from|import)\s*$/.test(lookbehind) || /\brequire\(\s*$/.test(lookbehind);
        // A directive prologue (`"use client"`, `"use server"`, `"use strict"`) is a language-
        // level structural marker, not string DATA, even though it's syntactically just a bare
        // string-literal expression statement — the exact shape a display-text assignment is
        // NOT. Missing this exception silently broke every "use client"-gated rule (confirmed by
        // the real negative-fixture matrix in tests/rule-detection-matrix.test.ts: a file with a
        // genuine "use client" directive still fired FIGM-NEXT-01 because hasUseClientDirective's
        // `cleanCode.includes('"use client"')` check no longer matched the blanked string).
        const isDirectivePrologue = new RegExp(`^(use client|use server|use strict)${ch}`).test(code.slice(i + 1));
        if (ch === '`') {
          // Template literals need their own rule: unlike a quoted string (almost always
          // literal string DATA), a backtick is routinely used to hold real embedded markup a
          // rule must see — most notably an Angular `template:`/`styles:` decorator property
          // (colon-assigned) or a tagged template (styled.div`...`, gql`...`, immediately after
          // an identifier/`)`/`]`, no operator). A PLAIN `const x = \`...\`` assignment (an "="
          // with whitespace on both sides) is the same "assign display/example text to a
          // variable" shape the audit's confirmed string-literal false positives used, just
          // with backticks instead of quotes (found live in app/accessibility/page.tsx's
          // `sampleBadCode` demo string) — so it is blanked the same way a quoted string is.
          const isPropertyValue = /:\s*$/.test(lookbehind);
          const isTaggedTemplate = prev !== '' && /[\w)\]]/.test(prev) && prev !== '=';
          const isPlainAssignment = /=\s*$/.test(lookbehind);
          stringBlank = isPlainAssignment && !isPropertyValue && !isTaggedTemplate;
        } else {
          stringBlank = !(isAttrStyle || isModuleSpecifier || isDirectivePrologue);
        }
        stringQuote = ch;
        out[i] = ch;
        state = 'STRING';
        i++;
        continue;
      }
      out[i] = ch;
      i++;
      continue;
    }

    if (state === 'LINE_COMMENT') {
      if (ch === '\n' || ch === '\r') {
        out[i] = ch;
        state = 'CODE';
      } else {
        out[i] = ' ';
      }
      i++;
      continue;
    }

    if (state === 'BLOCK_COMMENT') {
      if (ch === '*' && next === '/') {
        out[i] = ' '; out[i + 1] = ' ';
        state = 'CODE';
        i += 2;
        continue;
      }
      out[i] = (ch === '\n' || ch === '\r') ? ch : ' ';
      i++;
      continue;
    }

    // state === 'STRING'
    if (ch === '\\' && i + 1 < n) {
      out[i] = stringBlank ? ' ' : ch;
      out[i + 1] = stringBlank ? ' ' : code[i + 1];
      i += 2;
      continue;
    }
    if (stringQuote === '`' && ch === '$' && next === '{') {
      // Template-literal substitution holds real code (not string data) — copy it through
      // verbatim (including any string data ultimately nested inside(edge case, not blanked
      // separately) rather than trying to fully re-tokenize it.
      out[i] = '$'; out[i + 1] = '{';
      i += 2;
      let depth = 1;
      while (i < n && depth > 0) {
        if (code[i] === '{') depth++;
        else if (code[i] === '}') depth--;
        out[i] = code[i];
        i++;
      }
      continue;
    }
    if (ch === stringQuote) {
      out[i] = ch;
      state = 'CODE';
      i++;
      continue;
    }
    out[i] = stringBlank ? ((ch === '\n' || ch === '\r') ? ch : ' ') : ch;
    i++;
  }

  return out.join('');
}

/**
 * Scans forward from a JSX opening tag's start column (e.g. the "<" of "<div") across
 * subsequent lines to find the tag's full attribute text, up to the tag-closing ">" — tracking
 * "{}" depth so a ">" inside an attribute expression (e.g. `onClick={() => {}}`, whose arrow
 * itself contains ">") isn't mistaken for the tag close. This directly fixes the confirmed
 * false negative in ADVERSARIAL_DETECTION_AUDIT.md: real formatter-produced JSX (Prettier et
 * al.) routinely puts an element's opening tag and its onClick prop on separate physical
 * lines, which a single-line substring check structurally cannot see across.
 */
function scanJsxOpenTagAttrs(cleanLines: string[], startLineIdx: number, tagStartCol: number, maxLookaheadLines = 25): string {
  let braceDepth = 0;
  let buffer = '';
  for (let li = startLineIdx; li < cleanLines.length && li < startLineIdx + maxLookaheadLines; li++) {
    const line = cleanLines[li];
    const from = li === startLineIdx ? tagStartCol : 0;
    for (let ci = from; ci < line.length; ci++) {
      const c = line[ci];
      if (c === '{') braceDepth++;
      else if (c === '}') braceDepth = Math.max(0, braceDepth - 1);
      else if (c === '>' && braceDepth === 0) {
        return buffer + c;
      }
      buffer += c;
    }
    buffer += '\n';
  }
  return buffer;
}

/**
 * Bounded heuristic: true only if every reference to `bindingNames` in the file falls strictly
 * inside an `if (...) { ... }` block (by brace depth) AND at least one such reference exists.
 * A binding used both inside and outside conditionals (e.g. NextResponse used in both an error
 * branch and the success path) is NOT flagged — only a binding that is exclusively conditional,
 * matching the rule's actual intent ("heavy/optional dependency only needed behind a branch,
 * should be a dynamic import() instead of paying its cost on every load").
 */
function isReferencedInsideConditionalBlock(fullCode: string, bindingNames: string[]): boolean {
  if (bindingNames.length === 0) return false;
  const nameRegexes = bindingNames.map((n) => new RegExp(`\\b${n}\\b`));
  const lines = fullCode.split(/\r?\n/);
  let depth = 0;
  let conditionalFloor = -1; // depth at which we entered the current `if` block; -1 = not inside one
  let sawConditionalUsage = false;
  let sawUnconditionalUsage = false;

  for (const line of lines) {
    const isImportLine = /^\s*import\s/.test(line);
    const isIfLine = /\bif\s*\(/.test(line);
    if (conditionalFloor === -1 && isIfLine) {
      conditionalFloor = depth;
    }

    if (!isImportLine && !isIfLine && nameRegexes.some((re) => re.test(line))) {
      if (conditionalFloor !== -1) sawConditionalUsage = true;
      else sawUnconditionalUsage = true;
    }

    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (conditionalFloor !== -1 && depth <= conditionalFloor) {
          conditionalFloor = -1;
        }
      }
    }
  }
  return sawConditionalUsage && !sawUnconditionalUsage;
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
   * Detect framework type based on file extension, route-role, and content hints.
   * Note: path substrings like "app/" or "pages/" are not enough evidence by themselves,
   * because a regular component can live under those folders in a non-Next.js project.
   */
  private static detectFramework(filePath: string, code: string): FrameworkType {
    const normalizedPath = filePath.toLowerCase();
    const fileName = normalizedPath.split(/[\\/]/).pop() || normalizedPath;
    // Framework classification must be decided from real code, not comment prose — a plain .ts
    // file with a comment mentioning "@Component" was previously misclassified as Angular
    // (ADVERSARIAL_DETECTION_AUDIT.md finding #1).
    const lowerCode = stripCommentsAndStrings(code).toLowerCase();

    if (normalizedPath.endsWith('.vue')) return 'VUE_SFC';
    if (normalizedPath.endsWith('.svelte')) return 'SVELTE';

    const isAngularHint =
      lowerCode.includes('@component') ||
      lowerCode.includes('ng-template') ||
      lowerCode.includes('trackby') ||
      lowerCode.includes('rxjs') ||
      fileName.endsWith('.component.ts') ||
      fileName.endsWith('.component.tsx') ||
      fileName.endsWith('.component.js');

    if (isAngularHint) return 'ANGULAR_TEMPLATE';

    const hasAppRouteSegment = /(?:^|[\\/])app[\\/]/.test(normalizedPath);
    const hasPagesRouteSegment = /(?:^|[\\/])pages[\\/]/.test(normalizedPath);

    const nextPageRole =
      hasAppRouteSegment &&
      /(?:^|[\\/])page\.(tsx|jsx|ts|js)$/.test(fileName);

    const nextPagesRole =
      hasPagesRouteSegment &&
      /(?:^|[\\/])page\.(tsx|jsx|ts|js)$/.test(fileName);

    const nextContentHint =
      lowerCode.includes('next/link') ||
      lowerCode.includes('next/image') ||
      lowerCode.includes('next/router') ||
      lowerCode.includes('next/navigation') ||
      lowerCode.includes('from "next/') ||
      lowerCode.includes("from 'next/") ||
      lowerCode.includes('next/font') ||
      lowerCode.includes('export const metadata') ||
      lowerCode.includes('export const dynamic') ||
      lowerCode.includes('export const revalidate') ||
      lowerCode.includes('getserversideprops') ||
      lowerCode.includes('getstaticprops');

    if (nextPageRole || nextPagesRole || nextContentHint) return 'NEXT_JS';

    if (normalizedPath.endsWith('.jsx') || normalizedPath.endsWith('.tsx')) return 'REACT_JSX';
    if (
      lowerCode.includes('import react') ||
      lowerCode.includes('reactdom') ||
      lowerCode.includes('jsx') ||
      lowerCode.includes('usestate') ||
      lowerCode.includes('useeffect') ||
      lowerCode.includes('usememo') ||
      lowerCode.includes('usecallback')
    ) return 'REACT_JSX';

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
    // `clean*` holds the same source with comment text and non-attribute string-literal content
    // blanked out (see stripCommentsAndStrings doc comment). Every rule trigger below decides
    // "does this violation exist" against the CLEAN line/code, so a comment or string containing
    // a trigger substring can no longer fire a rule. Original `trimmed`/`lineText` are still used
    // for anything user-facing (codeSnippet, column offsets, extracted attribute values) so real
    // diagnostics keep showing real source text.
    const cleanCode = stripCommentsAndStrings(code);
    const cleanLines = cleanCode.split(/\r?\n/);
    const root: ASTNode = {
      type: 'Program',
      loc: { start: { line: 1, column: 0 }, end: { line: lines.length, column: (lines[lines.length - 1] || '').length } },
      children: [],
      scopeType: 'GLOBAL',
      attributes: {
        hasUseClientDirective: cleanCode.includes('"use client"') || cleanCode.includes("'use client'"),
        hasRevalidateExport: cleanCode.includes('export const revalidate') || cleanCode.includes('export var revalidate') || cleanCode.includes('export let revalidate'),
        isAppRouterPage: (/(?:^|[\\/])app[\\/]/.test(filePath.toLowerCase()) || /(?:^|[\\/])pages[\\/]/.test(filePath.toLowerCase())) &&
          (filePath.toLowerCase().endsWith('page.tsx') || filePath.toLowerCase().endsWith('page.jsx') || filePath.toLowerCase().endsWith('page.js') || filePath.toLowerCase().endsWith('page.ts'))
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
      const cleanLineFull = cleanLines[idx] || '';
      const cTrimmed = cleanLineFull.trim();

      // Scope Transitions
      if (cTrimmed.includes('.map(') || cTrimmed.includes('.forEach(') || cTrimmed.includes('for (') || cTrimmed.includes('while (')) {
        currentScope = 'LOOP';
      } else if (cTrimmed.includes('function render') || cTrimmed.includes('return (') || cTrimmed.includes('return <') || cTrimmed.includes('export default function')) {
        currentScope = 'RENDER';
      } else if (cTrimmed.includes('function ') || cTrimmed.includes('const ') && cTrimmed.includes('=>')) {
        currentScope = 'FUNCTION';
      }

      // 1. Top-Level Imports (FIGM-PERF-04 & FIGM-NEXT-02)
      if (cTrimmed.startsWith('import ') && !cTrimmed.includes('type ')) {
        const moduleName = (trimmed.match(/from ['"](.*)['"]/) || [])[1] || 'unknown';
        const isHeavy = ['monaco-editor', 'chart.js', 'three', 'canvas', 'echarts', 'd3'].some(m => moduleName.includes(m));
        const importedNames = extractImportedBindingNames(trimmed);

        root.children!.push({
          type: 'ImportDeclaration',
          name: moduleName,
          scopeType: currentScope,
          attributes: {
            codeSnippet: trimmed,
            referencedInConditional: isReferencedInsideConditionalBlock(cleanCode, importedNames),
            isHeavyStaticImportInNext: framework === 'NEXT_JS' && isHeavy && !cleanCode.includes('dynamic(')
          },
          loc: { start: { line: lineNum, column: lineText.indexOf('import') }, end: { line: lineNum, column: lineText.length } }
        });
      }

      // 2. Invariant Object Allocation in Loop/Render (FIGM-PERF-01)
      if (currentScope === 'LOOP' || currentScope === 'RENDER') {
        if ((cTrimmed.startsWith('const ') || cTrimmed.startsWith('let ') || cTrimmed.startsWith('var ')) && cTrimmed.includes('= {')) {
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
        if (cTrimmed.includes('onClick={() =>') || cTrimmed.includes('onClick={(') || (cTrimmed.includes('map(') && (cTrimmed.includes('() =>') || cTrimmed.includes('()=>')))) {
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
        if (cTrimmed.includes('localStorage.') || cTrimmed.includes('sessionStorage.')) {
          root.children!.push({
            type: 'CallExpression',
            name: cTrimmed.includes('localStorage') ? 'localStorage' : 'sessionStorage',
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
      if (cTrimmed.includes('<img')) {
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
      if (cTrimmed.includes('.addEventListener(')) {
        const hasCleanup = cleanCode.includes('.removeEventListener(');
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
      // Scans forward across lines (not just this one) to find the tag's full attribute text,
      // because real formatter-produced JSX (Prettier et al.) routinely puts the opening tag
      // and its onClick prop on separate physical lines — the confirmed false negative in
      // ADVERSARIAL_DETECTION_AUDIT.md. A single-line check would silently miss that violation.
      const tagStartMatch = cleanLineFull.match(/<(div|span|section)\b/);
      // A "<div"-shaped match immediately preceded by "/" is a regex literal delimiter (e.g.
      // `/<div\b/` in a remediation template), never real JSX — valid JSX/HTML never has a bare
      // "/" directly before an opening tag's "<". Without this guard, the multi-line scan below
      // would chase the regex literal's characters looking for a tag-closing ">" and could latch
      // onto an unrelated ">" (or "=>") much further down the file, producing a spurious match
      // (confirmed false positive found in src/engine/remediation-engine.ts during this fix).
      const isRegexLiteralMatch = !!tagStartMatch && tagStartMatch.index! > 0 && cleanLineFull[tagStartMatch.index! - 1] === '/';
      if (tagStartMatch && !isRegexLiteralMatch) {
        const tagName = tagStartMatch[1];
        const tagStartCol = tagStartMatch.index ?? 0;
        const attrsText = scanJsxOpenTagAttrs(cleanLines, idx, tagStartCol);

        const hasOnClick = attrsText.includes('onClick') || attrsText.includes('v-on:click') || attrsText.includes('(click)');
        const hasOnKeyDown = attrsText.includes('onKeyDown') || attrsText.includes('v-on:keydown') || attrsText.includes('(keydown)');
        const hasTabIndex = attrsText.includes('tabIndex') || attrsText.includes('tabindex');

        // Check positive tabIndex > 0 (FIGM-A11Y-06)
        const tabMatch = attrsText.match(/tab[I|i]ndex=["'{]?([1-9]\d*)["'}]?/);
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
      } else if (cTrimmed.includes('tabIndex') || cTrimmed.includes('tabindex')) {
        // Positive tabIndex on an element that isn't div/span/section is still relevant to
        // FIGM-A11Y-06 (but, unlike before, is no longer mislabeled as a div/span/section for
        // FIGM-A11Y-01 purposes just because tabIndex text appeared somewhere on the line).
        const tabMatch = cTrimmed.match(/tab[I|i]ndex=["'{]?([1-9]\d*)["'}]?/);
        const positiveVal = tabMatch ? parseInt(tabMatch[1], 10) : 0;
        if (positiveVal > 0) {
          root.children!.push({
            type: framework === 'VUE_SFC' ? 'VElement' : framework === 'ANGULAR_TEMPLATE' ? 'Element$1' : 'JSXElement',
            name: 'element',
            scopeType: currentScope,
            attributes: { codeSnippet: trimmed, tabIndex: positiveVal, positiveTabIndex: true },
            loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('tabIndex')) }, end: { line: lineNum, column: lineText.length } }
          });
        }
      }

      // 8. Unlabeled Form Inputs (FIGM-A11Y-05)
      if (cTrimmed.includes('<input') || cTrimmed.includes('<textarea') || cTrimmed.includes('<select')) {
        const tag = trimmed.includes('<input') ? 'input' : trimmed.includes('<textarea') ? 'textarea' : 'select';
        const hasAriaLabel = cTrimmed.includes('aria-label=') || cTrimmed.includes('aria-labelledby=');
        const hasId = cTrimmed.includes('id=');

        if (!hasAriaLabel && (!hasId || !cleanCode.includes('htmlFor=') && !cleanCode.includes('for='))) {
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
      if (cTrimmed.includes('<Custom') || cTrimmed.includes('<Select') || cTrimmed.includes('<Dropdown')) {
        const compName = (trimmed.match(/<([A-Z][A-Za-z0-9]+)/) || [])[1] || 'CustomComponent';
        const hasRole = cTrimmed.includes('role=');
        const hasAriaLabel = cTrimmed.includes('aria-label=') || cTrimmed.includes('aria-labelledby=');

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
      if (cTrimmed.includes('className="status') || cTrimmed.includes('class="status') || cTrimmed.includes('id="status')) {
        const hasAriaLive = cTrimmed.includes('aria-live=');
        const hasRoleStatus = cTrimmed.includes('role="status"') || cTrimmed.includes('role="alert"');

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
      if (cTrimmed.includes('<Modal') || cTrimmed.includes('<Dialog')) {
        const compName = trimmed.includes('<Modal') ? 'Modal' : 'Dialog';
        const hasRestoration = cTrimmed.includes('restoresFocus') || cTrimmed.includes('onClose=');

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
        if (cTrimmed.includes('useState(') || cTrimmed.includes('useEffect(') || cTrimmed.includes('useContext(') || cTrimmed.includes('useRef(')) {
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
      if (cTrimmed.includes('fonts.googleapis.com') || (cTrimmed.includes('<link') && cTrimmed.includes('stylesheet') && cTrimmed.includes('fonts'))) {
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
      if (cTrimmed.includes('.sort(') || cTrimmed.includes('.filter(') || cTrimmed.includes('.reduce(')) {
        if (!cTrimmed.includes('useMemo')) {
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
      if (cTrimmed.includes('key={index}') || cTrimmed.includes('key={i}') || cTrimmed.includes('key={idx}')) {
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
      const isMutationMethod = cTrimmed.includes('.push(') || cTrimmed.includes('.splice(') || cTrimmed.includes('.pop(') || cTrimmed.includes('.shift(') || cTrimmed.includes('.unshift(') || cTrimmed.includes('.sort(');
      const isPropAssignment = /^\s*\w+(\.\w+)+\s*=\s*/.test(cTrimmed) || (cTrimmed.includes('=') && (cTrimmed.includes('.name') || cTrimmed.includes('state.')));
      if (isMutationMethod || isPropAssignment) {
        if (!cTrimmed.includes('setState') && !cTrimmed.startsWith('set') && !cTrimmed.startsWith('const ') && !cTrimmed.startsWith('let ') && !cTrimmed.startsWith('var ') && !cTrimmed.includes('==') && !cTrimmed.includes(':')) {
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
      if ((cTrimmed.includes('<Custom') || cTrimmed.includes('<Button') || cTrimmed.includes('<Card')) && cTrimmed.includes('onClick={() =>')) {
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
      if (framework === 'ANGULAR_TEMPLATE' || cleanCode.includes('@Component')) {
        if (cTrimmed.includes('.subscribe(') && !cleanCode.includes('takeUntilDestroyed') && !cleanCode.includes('unsubscribe') && !cleanCode.includes('DestroyRef')) {
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
      if (cTrimmed.includes('@Component({') && !cleanCode.includes('ChangeDetectionStrategy.OnPush')) {
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
      if (cTrimmed.includes('*ngFor=') && !cTrimmed.includes('trackBy')) {
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
      if ((framework === 'ANGULAR_TEMPLATE' || cleanCode.includes('@Component')) && (cTrimmed.includes('{{') && cTrimmed.includes('()') || cTrimmed.includes(']="') && cTrimmed.includes('()'))) {
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
      if ((cTrimmed.includes('nativeElement.') || cTrimmed.includes('.nativeElement')) && !cTrimmed.includes('renderer.') && !cTrimmed.includes('Renderer2')) {
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
      // 23. AST Control Flow Statements for Cyclomatic & Cognitive Complexity
      if (/\bif\s*\(/.test(trimmed)) {
        root.children!.push({
          type: 'IfStatement',
          scopeType: currentScope,
          attributes: { codeSnippet: trimmed },
          loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('if')) }, end: { line: lineNum, column: lineText.length } }
        });
      }
      if (/\bfor\s*\(/.test(trimmed)) {
        root.children!.push({
          type: 'ForStatement',
          scopeType: currentScope,
          attributes: { codeSnippet: trimmed },
          loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('for')) }, end: { line: lineNum, column: lineText.length } }
        });
      }
      if (/\bwhile\s*\(/.test(trimmed)) {
        root.children!.push({
          type: 'WhileStatement',
          scopeType: currentScope,
          attributes: { codeSnippet: trimmed },
          loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('while')) }, end: { line: lineNum, column: lineText.length } }
        });
      }
      if (/\bcase\s+/.test(trimmed)) {
        root.children!.push({
          type: 'SwitchCase',
          test: true,
          scopeType: currentScope,
          attributes: { codeSnippet: trimmed },
          loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('case')) }, end: { line: lineNum, column: lineText.length } }
        });
      }
      if (/\bcatch\s*\(/.test(trimmed)) {
        root.children!.push({
          type: 'CatchClause',
          scopeType: currentScope,
          attributes: { codeSnippet: trimmed },
          loc: { start: { line: lineNum, column: Math.max(0, lineText.indexOf('catch')) }, end: { line: lineNum, column: lineText.length } }
        });
      }
    });

    return root;
  }
}
