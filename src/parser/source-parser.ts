/**
 * Framework-Independent Guideline Model (FIGM)
 * Resilient Source Code Parser Adapter (Complete 23-Rule Extraction Specification)
 */

import { ASTNode, FrameworkType } from '../types/ast-spec.js';
import {
  buildRealSyntaxNodes,
  isGeneralJsRealAstEligible,
  isJsxRealAstEligible,
  isAngularClassRealAstEligible,
} from '../ast/real-syntax-node-builder.js';

/**
 * Per-rule real-AST eligibility gates (AST Migration Phases 4-7). When a rule is real-AST-eligible
 * for the current file's framework, the legacy regex/substring block below that used to detect it
 * is skipped for that framework -- `buildRealSyntaxNodes` (src/ast/real-syntax-node-builder.ts)
 * produces the equivalent ASTNode instead, appended to `root.children` at the end of
 * `buildASTFromCode`. Every other framework/rule combination is completely untouched: this is an
 * additive, framework-gated swap, not a rewrite of the legacy loop. See
 * docs/architecture/AST_MIGRATION_MAP.md for the full per-rule rationale.
 */
const REAL_AST_NEXT01_04_FRAMEWORKS: FrameworkType[] = ['NEXT_JS', 'REACT_JSX'];

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
  type State = 'CODE' | 'LINE_COMMENT' | 'BLOCK_COMMENT' | 'STRING' | 'HTML_COMMENT';
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
      // Vue SFC `<template>` blocks (and Angular inline HTML) use HTML comments, not `//`/`/*
      // */` -- without this, example/demo markup inside `<!-- ... -->` survives into cleanLines
      // and the legacy text-heuristic rules (e.g. FIGM-A11Y-01's `@click=` match) fire on text
      // that was never live markup (found via live black-box "code with comments" testing on a
      // Vue fixture: a `<!-- demo: <div @click="x"> ... -->` comment was reported as a real
      // CRITICAL violation).
      if (ch === '<' && code.slice(i, i + 4) === '<!--') {
        for (let k = 0; k < 4; k++) out[i + k] = ' ';
        state = 'HTML_COMMENT';
        i += 4;
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
        // A quoted string that is the first argument to `addEventListener(`/`removeEventListener(`
        // is the event-type name (e.g. 'scroll', 'resize') — structural code FIGM-PERF-03 reads
        // to pair listener registration with its matching teardown by event type, not display
        // text. Missing this exception silently broke event-type-aware cleanup pairing: the
        // string was blanked before the pairing regex ever saw it (found while fixing FIGM-PERF-03's
        // event-type-blind pairing bug — see the QA matrix adversarial fixture in
        // tests/qa-matrix-boundary-adversarial.test.ts).
        const isEventListenerArg = /\.(add|remove)EventListener\(\s*$/.test(lookbehind);
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
          stringBlank = !(isAttrStyle || isModuleSpecifier || isDirectivePrologue || isEventListenerArg);
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

    if (state === 'HTML_COMMENT') {
      if (ch === '-' && code.slice(i, i + 3) === '-->') {
        out[i] = ' '; out[i + 1] = ' '; out[i + 2] = ' ';
        state = 'CODE';
        i += 3;
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
  let conditionalFloor = -1; // depth at which we entered the current `if`/`catch` block; -1 = not inside one
  let sawConditionalUsage = false;
  let sawUnconditionalUsage = false;

  for (const line of lines) {
    const isImportLine = /^\s*import\s/.test(line);
    // A `catch` block is exactly as conditional/deferred as an `if` block -- it only executes
    // when the guarded `try` throws -- but was invisible here (found via live black-box testing:
    // FIGM's own live-scan page statically imported RemediationEngine, used only inside a catch
    // block, adding ~1MB to that page's client bundle; this rule should have caught it and
    // didn't). `catch {` (no binding) and `catch (e) {` both match.
    const isIfLine = /\bif\s*\(/.test(line) || /\bcatch\s*[({]/.test(line);
    if (conditionalFloor === -1 && isIfLine) {
      conditionalFloor = depth;
    }

    // Bug found via QA matrix adversarial testing: excluding the ENTIRE `if (...)` line from
    // usage counting (not just the condition) meant the extremely common single-line-body shape
    // `if (cond) { Heavy.load(); }` was invisible to this check -- the usage and its guarding
    // `if` share one physical line, so `isIfLine` suppressed it entirely and the import was
    // never flagged as conditional-only. `conditionalFloor` is already set above (before this
    // check runs) for the line that opens the `if`, so a same-line usage now correctly resolves
    // through the same conditionalFloor !== -1 branch a later, separate-line usage would.
    if (!isImportLine && nameRegexes.some((re) => re.test(line))) {
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

    // AST Migration Phases 4-7: real-AST detection for the migrated rule subset (see
    // docs/architecture/AST_MIGRATION_MAP.md). Computed once up front; the per-rule eligibility
    // gates below (useRealAstGeneral/Jsx/Angular/Next*) suppress only the specific legacy blocks
    // this now supersedes, for exactly the frameworks where a real parse is possible -- every
    // other rule/framework combination below is unmodified regex/substring detection.
    const realAst = buildRealSyntaxNodes(code, filePath, framework);
    const useRealAstGeneral = isGeneralJsRealAstEligible(framework);
    const useRealAstJsx = isJsxRealAstEligible(framework);
    const useRealAstAngular = isAngularClassRealAstEligible(framework);
    // FIGM-NEXT-01's real trigger condition is NEXT_JS-only in practice (see the detailed
    // rationale in real-syntax-node-builder.ts's buildRealSyntaxNodes) -- a plain REACT_JSX file
    // must never get an (incorrect) FIGM-NEXT-01 candidate just because it calls useState/useEffect.
    const useRealAstNext01 = framework === 'NEXT_JS';
    const useRealAstNext04 = REAL_AST_NEXT01_04_FRAMEWORKS.includes(framework);
    const useRealAstNext02 = framework === 'NEXT_JS';
    // AST Migration Group 4 (docs/architecture/AST_MIGRATION_MAP.md §5/§6, implemented in
    // docs/architecture/RULE_ENGINEERING_AUDIT.md): the seven rules deferred from Groups 1-3.
    // Named aliases (rather than reusing useRealAstGeneral/useRealAstJsx directly at each call
    // site) match this file's existing useRealAstNext01/02/04 convention and keep each rule's
    // real-AST eligibility self-documenting at its own gate.
    const useRealAstPerf03 = useRealAstGeneral;
    const useRealAstPerf05 = useRealAstJsx;
    const useRealAstPerf06 = useRealAstGeneral;
    const useRealAstA11y05 = useRealAstJsx;
    const useRealAstA11y06 = useRealAstJsx;
    const useRealAstReact01 = useRealAstGeneral;
    const useRealAstReact04 = useRealAstJsx;

    // Check App Router missing revalidate (FIGM-NEXT-03) -- superseded by buildNext03Root inside
    // buildRealSyntaxNodes for NEXT_JS (see real-syntax-node-builder.ts); this legacy check now
    // only still matters for a hypothetical non-NEXT_JS framework value that nonetheless has
    // isAppRouterPage set, which cannot occur given how detectFramework assigns NEXT_JS, but is
    // left as a harmless no-op guard rather than deleted, to avoid asserting a stronger invariant
    // than the rest of this file currently guarantees elsewhere.
    if (
      framework === 'NEXT_JS' &&
      root.attributes?.isAppRouterPage &&
      !root.attributes?.hasRevalidateExport &&
      !root.attributes?.hasUseClientDirective
    ) {
      if (!useRealAstNext02) {
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
    }

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const trimmed = lineText.trim();
      const cleanLineFull = cleanLines[idx] || '';
      const cTrimmed = cleanLineFull.trim();

      // Scope Transitions
      // Bug found via the real-world 4-fixture ground-truth benchmark (VueBenchmark.vue): Vue's
      // template-level `v-for="item in products"` loop directive never matched any of the JS-
      // syntax loop triggers below, so a genuine invariant object allocated inside a v-for was
      // silently invisible to FIGM-PERF-01 -- confirmed as the benchmark's one remaining false
      // negative (see benchmarks/ground-truth.json, VueBenchmark.vue line 11).
      if (cTrimmed.includes('.map(') || cTrimmed.includes('.forEach(') || cTrimmed.includes('for (') || cTrimmed.includes('while (') || cTrimmed.includes('v-for=')) {
        currentScope = 'LOOP';
      } else if (cTrimmed.includes('function render') || cTrimmed.includes('return (') || cTrimmed.includes('return <') || cTrimmed.includes('export default function')) {
        currentScope = 'RENDER';
      } else if (cTrimmed.includes('function ') || cTrimmed.includes('const ') && cTrimmed.includes('=>')) {
        currentScope = 'FUNCTION';
      }

      // 1. Top-Level Imports (FIGM-PERF-04 & FIGM-NEXT-02)
      // FIGM-PERF-04 is real-AST-migrated for useRealAstGeneral frameworks (see buildPerf04 in
      // real-syntax-node-builder.ts); FIGM-NEXT-02 is real-AST-migrated for NEXT_JS (buildNext02).
      // Each attribute below is only computed via the legacy regex path when its own rule is NOT
      // real-AST-eligible for this framework, so a single import line is never counted twice.
      if (cTrimmed.startsWith('import ') && !cTrimmed.includes('type ')) {
        const moduleName = (trimmed.match(/from ['"](.*)['"]/) || [])[1] || 'unknown';
        const importedNames = extractImportedBindingNames(trimmed);

        const attrs: Record<string, unknown> = { codeSnippet: trimmed };
        if (!useRealAstGeneral) {
          attrs.referencedInConditional = isReferencedInsideConditionalBlock(cleanCode, importedNames);
        }
        if (!useRealAstNext02) {
          // useRealAstNext02 is exactly `framework === 'NEXT_JS'`, so this attribute can only
          // ever be meaningfully true when useRealAstNext02 is also true (i.e. real-AST-owned) --
          // this legacy branch exists solely so non-NEXT_JS frameworks still get an (always-false,
          // structurally inert) attribute rather than an undefined one, matching the original
          // unconditional-computation shape.
          attrs.isHeavyStaticImportInNext = false;
        }

        root.children!.push({
          type: 'ImportDeclaration',
          name: moduleName,
          scopeType: currentScope,
          attributes: attrs,
          loc: { start: { line: lineNum, column: lineText.indexOf('import') }, end: { line: lineNum, column: lineText.length } }
        });
      }

      // 2. Invariant Object Allocation in Loop/Render (FIGM-PERF-01)
      // Bug found via QA matrix huge-file stress testing: `cTrimmed.startsWith('const ')`
      // required the declaration to be the very first token on the physical line, so the
      // extremely common single-line-arrow-body shape (`items.map(item => { const cfg = {...};
      // return x; })`) was silently invisible to this HIGH-severity rule -- confirmed as a real
      // false negative (see tests/qa-matrix-cross-cutting.test.ts), not just a contrived edge
      // case. A word-boundary-aware regex anchored on the declaration keyword, matched anywhere
      // in the line, catches both the single-line and original multi-line (declaration-starts-
      // the-line) shapes identically.
      if (currentScope === 'LOOP' || currentScope === 'RENDER') {
        // Vue templates allocate an invariant object via a bound attribute expression
        // (`:style="{ color: 'blue' }"`), not a JS `const/let/var` declaration -- a structurally
        // different violation shape than the JSX/script-side pattern above, also found via the
        // real-world ground-truth benchmark's VueBenchmark.vue fixture. The isJsDeclaration
        // branch is real-AST-migrated for useRealAstGeneral frameworks (buildPerf01); the
        // Vue-only isVueAttrBinding branch is unaffected (VUE_SFC is never real-AST-eligible).
        const isJsDeclaration = !useRealAstGeneral && /\b(const|let|var)\s+\w+\s*=\s*\{/.test(cTrimmed);
        const isVueAttrBinding = /:[\w-]+\s*=\s*["']\{/.test(cTrimmed);
        if (isJsDeclaration || isVueAttrBinding) {
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
      // Real-AST-migrated (buildPerf05) for useRealAstPerf05 (== useRealAstJsx) frameworks;
      // unchanged for VUE_SFC/ANGULAR_TEMPLATE/GENERIC_ESTREE.
      if (!useRealAstPerf05 && (currentScope === 'LOOP' || currentScope === 'RENDER')) {
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
      // Real-AST-migrated (buildPerf06) for useRealAstPerf06 (== useRealAstGeneral) frameworks;
      // unchanged for VUE_SFC.
      if (!useRealAstPerf06 && (currentScope === 'LOOP' || currentScope === 'RENDER')) {
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
      // Real-AST-migrated (buildPerf02) for useRealAstJsx frameworks (REACT_JSX/NEXT_JS), where
      // <img> is guaranteed to be real parsed JSX. Left active here for every other framework,
      // including ANGULAR_TEMPLATE, whose <img> usage typically lives inside an inline template
      // *string* the class-body AST parser cannot see into (see AST_MIGRATION_MAP.md §5).
      if (!useRealAstJsx && cTrimmed.includes('<img')) {
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
      // Real-AST-migrated (buildPerf03) for useRealAstPerf03 (== useRealAstGeneral) frameworks;
      // unchanged for VUE_SFC.
      if (!useRealAstPerf03 && cTrimmed.includes('.addEventListener(')) {
        // Bug found via QA matrix adversarial testing: checking `cleanCode.includes('.removeEventListener(')`
        // treats ANY removeEventListener call anywhere in the file as cleanup for EVERY
        // addEventListener call, regardless of event type -- so a component with both a 'scroll'
        // listener (never cleaned up) and an unrelated 'resize' listener (properly cleaned up)
        // silently hid the real 'scroll' leak. Pairing by the event-type string literal is a
        // meaningfully closer approximation without requiring full data-flow analysis.
        const eventNameMatch = cTrimmed.match(/\.addEventListener\(\s*['"]([^'"]+)['"]/);
        const eventName = eventNameMatch?.[1];
        const hasCleanup = eventName
          ? new RegExp(`\\.removeEventListener\\(\\s*['"]${eventName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(cleanCode)
          : cleanCode.includes('.removeEventListener(');
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

        // Vue recognizes both the explicit `v-on:click` directive and the `@click` shorthand for
        // the identical binding — only the explicit form was checked here, so a real, common Vue
        // accessibility violation written with the shorthand (the more idiomatic, far more common
        // real-world form) silently evaded FIGM-A11Y-01 entirely. Same for the keydown equivalent
        // (`@keydown.enter`, already assumed to exist by RemediationEngine's Vue fix template).
        //
        // FIGM-A11Y-01 (the onClick/onKeyDown pair) is real-AST-migrated for useRealAstJsx
        // frameworks (buildA11y01 in real-syntax-node-builder.ts) -- this legacy path no longer
        // sets onClick/onKeyDown for those frameworks, to avoid a duplicate diagnostic. It still
        // fully applies for VUE_SFC/ANGULAR_TEMPLATE (@click/(click) are not real JSX/TS syntax
        // the TypeScript parser understands). FIGM-A11Y-06 (positiveTabIndex) is now also
        // real-AST-migrated (buildA11y06) for useRealAstA11y06 (== useRealAstJsx) frameworks --
        // both flags below are forced false for JSX frameworks, so this entire push becomes
        // inert for them (both rules it used to serve are now produced by real-syntax-node-builder
        // instead); still fully applies for VUE_SFC/ANGULAR_TEMPLATE.
        const hasOnClick = !useRealAstJsx && (attrsText.includes('onClick') || attrsText.includes('v-on:click') || attrsText.includes('@click') || attrsText.includes('(click)'));
        // Angular's idiomatic keyboard-activation pattern uses the event-filter modifier syntax
        // `(keydown.enter)`/`(keydown.space)` rather than a bare `(keydown)` -- a real Angular
        // dev following that (very common) convention was previously still flagged by
        // FIGM-A11Y-01 as having NO keyboard handler at all, since the exact-substring check
        // `includes('(keydown)')` (with the closing paren immediately after "keydown") never
        // matches `(keydown.enter)` (found via live black-box fix-and-rescan testing: applying
        // RemediationEngine's own Angular FIGM-A11Y-01 fix template, which emits exactly this
        // modifier syntax, left the rule re-firing as UNRESOLVED against its own patch).
        const hasOnKeyDown = !useRealAstJsx && (attrsText.includes('onKeyDown') || attrsText.includes('v-on:keydown') || attrsText.includes('@keydown') || attrsText.includes('(keydown)') || attrsText.includes('(keydown.'));
        const hasTabIndex = attrsText.includes('tabIndex') || attrsText.includes('tabindex');

        // Check positive tabIndex > 0 (FIGM-A11Y-06)
        const tabMatch = attrsText.match(/tab[I|i]ndex=["'{]?([1-9]\d*)["'}]?/);
        const positiveVal = !useRealAstA11y06 && tabMatch ? parseInt(tabMatch[1], 10) : 0;

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
      } else if (!useRealAstA11y06 && (cTrimmed.includes('tabIndex') || cTrimmed.includes('tabindex'))) {
        // Positive tabIndex on an element that isn't div/span/section is still relevant to
        // FIGM-A11Y-06 (but, unlike before, is no longer mislabeled as a div/span/section for
        // FIGM-A11Y-01 purposes just because tabIndex text appeared somewhere on the line).
        // Real-AST-migrated (buildA11y06) for useRealAstA11y06 (== useRealAstJsx) frameworks;
        // unchanged for VUE_SFC/ANGULAR_TEMPLATE.
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
      // Real-AST-migrated (buildA11y05) for useRealAstA11y05 (== useRealAstJsx) frameworks;
      // unchanged for VUE_SFC/ANGULAR_TEMPLATE.
      if (!useRealAstA11y05 && (cTrimmed.includes('<input') || cTrimmed.includes('<textarea') || cTrimmed.includes('<select'))) {
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
      // Real-AST-migrated (buildA11y02) for useRealAstJsx frameworks; unchanged elsewhere.
      if (!useRealAstJsx && (cTrimmed.includes('<Custom') || cTrimmed.includes('<Select') || cTrimmed.includes('<Dropdown'))) {
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
      // Real-AST-migrated (buildA11y03) for useRealAstJsx frameworks; unchanged elsewhere.
      if (!useRealAstJsx && (cTrimmed.includes('className="status') || cTrimmed.includes('class="status') || cTrimmed.includes('id="status'))) {
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
      // Real-AST-migrated (buildA11y04) for useRealAstJsx frameworks; unchanged elsewhere.
      if (!useRealAstJsx && (cTrimmed.includes('<Modal') || cTrimmed.includes('<Dialog'))) {
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
      // Real-AST-migrated (buildNext01) for useRealAstNext01 frameworks (NEXT_JS only -- see the
      // rationale in real-syntax-node-builder.ts). useRealAstNext01 is exactly `framework ===
      // 'NEXT_JS'`, and isAppRouterPage being true always implies detectFramework already
      // classified the file NEXT_JS, so `!useRealAstNext01` alone (framework narrowed to non-
      // NEXT_JS) already makes the original `framework === 'NEXT_JS' ||` half of this condition
      // unreachable; kept only the isAppRouterPage half, both to satisfy the compiler and because
      // it is the only half that could ever matter here.
      if (!useRealAstNext01 && root.attributes?.isAppRouterPage && !root.attributes?.hasUseClientDirective) {
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
      // Real-AST-migrated (buildNext04) for useRealAstNext04 frameworks; unchanged elsewhere.
      if (!useRealAstNext04 && (cTrimmed.includes('fonts.googleapis.com') || (cTrimmed.includes('<link') && cTrimmed.includes('stylesheet') && cTrimmed.includes('fonts')))) {
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
      // Real-AST-migrated (buildReact01) for useRealAstReact01 (== useRealAstGeneral) frameworks;
      // unchanged for VUE_SFC.
      if (!useRealAstReact01 && (cTrimmed.includes('.sort(') || cTrimmed.includes('.filter(') || cTrimmed.includes('.reduce('))) {
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
      // Bug found via the real-world 4-fixture ground-truth benchmark (ReactBenchmark.jsx line 39,
      // `return <span key={item.id} style={itemConfig}>{item.name}</span>;`): the old check fired
      // on ANY line containing both an "=" character ANYWHERE (including JSX `key=`/`style=` prop
      // syntax) and the substring ".name"/"state." ANYWHERE (including a plain JSX read like
      // `{item.name}`), so a JSX render expression that merely displays `item.name` was
      // misclassified as a state mutation. Fixed by requiring ".name"/"state.<prop>" to be
      // immediately followed by a real single "=" assignment operator (not "==", "===", or a JSX
      // attribute's "={"), which is what an actual property mutation (`user.name = 'x'`,
      // `state.foo = 'x'`) looks like and a JSX read never does.
      // Real-AST-migrated (buildReact03) for useRealAstGeneral frameworks; unchanged elsewhere.
      const isMutationMethod = !useRealAstGeneral && (cTrimmed.includes('.push(') || cTrimmed.includes('.splice(') || cTrimmed.includes('.pop(') || cTrimmed.includes('.shift(') || cTrimmed.includes('.unshift(') || cTrimmed.includes('.sort('));
      const isPropAssignment = !useRealAstGeneral && (/^\s*\w+(\.\w+)+\s*=\s*/.test(cTrimmed) || /\.name\s*=(?!=)/.test(cTrimmed) || /\bstate\.\w+\s*=(?!=)/.test(cTrimmed));
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
      // Real-AST-migrated (buildReact04) for useRealAstReact04 (== useRealAstJsx) frameworks;
      // unchanged for VUE_SFC/ANGULAR_TEMPLATE.
      if (!useRealAstReact04 && (cTrimmed.includes('<Custom') || cTrimmed.includes('<Button') || cTrimmed.includes('<Card')) && cTrimmed.includes('onClick={() =>')) {
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
      // Real-AST-migrated (buildAng01) for useRealAstAngular frameworks (ANGULAR_TEMPLATE /
      // GENERIC_ESTREE, matching evalAng01's own gate); unchanged for every other framework.
      if (!useRealAstAngular && (framework === 'ANGULAR_TEMPLATE' || cleanCode.includes('@Component'))) {
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
      // Real-AST-migrated (buildAng02) for useRealAstAngular frameworks; unchanged elsewhere.
      if (!useRealAstAngular && cTrimmed.includes('@Component({') && !cleanCode.includes('ChangeDetectionStrategy.OnPush')) {
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
      // Real-AST-migrated (buildAng05) for useRealAstAngular frameworks; unchanged elsewhere.
      if (!useRealAstAngular && (cTrimmed.includes('nativeElement.') || cTrimmed.includes('.nativeElement')) && !cTrimmed.includes('renderer.') && !cTrimmed.includes('Renderer2')) {
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

    // Append every real-AST-derived node (see top of this method) after the legacy line loop, so
    // ASTDetectionEngine/ALPExtractionEngine's flat root.children traversal sees both sets
    // uniformly. Each node already carries sourceKind: 'REAL_AST'; every node pushed by the loop
    // above implicitly has no sourceKind set (treated as unknown/legacy provenance -- see
    // DetectionSourceKind's doc comment in src/types/ast-spec.ts) rather than being retroactively
    // labeled, since this pass did not touch its detection logic.
    root.children!.push(...realAst.nodes);

    return root;
  }
}
