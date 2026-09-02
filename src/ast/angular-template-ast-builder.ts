/**
 * Framework-Independent Guideline Model (FIGM)
 * Angular Template Real-AST Builder (Scientific Hardening Pass — Phase 5)
 *
 * Upgrades FIGM-ANG-03, FIGM-ANG-04, FIGM-ANG-08, FIGM-ANG-10 from LEGACY_TEXT_HEURISTIC to
 * REAL_AST, using `angular-html-parser` (https://www.npmjs.com/package/angular-html-parser) — a
 * real HTML+Angular-template parser extracted from Angular's own compiler, published and
 * maintained independently by the Prettier project's maintainers for exactly this purpose (their
 * Angular template formatter). It parses real element/attribute/structural-directive/interpolation
 * syntax AND the modern `@for`/`@if`/`@switch` control-flow block syntax (via
 * `tokenizeAngularBlocks: true`) with genuine source spans — not a second regex layer pretending
 * to be a parser.
 *
 * This does NOT replace src/ast/real-syntax-node-builder.ts's TypeScript-compiler path for
 * Angular component CLASS bodies (FIGM-ANG-01/02/05/06/07/09) — those already have real AST via
 * the TS compiler, since a .component.ts file's class body is real TypeScript. This module only
 * covers the four rules whose violation shape lives in TEMPLATE MARKUP, which the TS compiler
 * treats as opaque string-literal text.
 *
 * Scope, honestly disclosed: only an INLINE template (`template: \`...\`` backtick property on
 * the @Component decorator) in the SAME file is parsed — a template supplied via a separate
 * `templateUrl: '...'` file is invisible to this single-file scan, exactly the same limitation
 * the legacy heuristic already had (see docs/research/EXPANSION_3_SCIENTIFIC_HARDENING.md).
 */

import { parseHtml } from 'angular-html-parser';
import type { Node as NgNode, Element as NgElement, Attribute as NgAttribute, Block as NgBlock, Text as NgText } from 'angular-html-parser/dist/compiler/src/ml_parser/ast.mjs';
import type { ASTNode } from '../types/ast-spec.js';

/** Extracts a Component's inline `template: \`...\`` backtick block and the 1-indexed line in the
 *  ORIGINAL file where that block's content begins -- the exact same "extract a sub-language's
 *  text and remember where it started" pattern buildVueScriptRealSyntaxNodes already established
 *  for Vue's <script> block, applied here to Angular's inline template instead. Deliberately only
 *  matches a backtick-delimited value: single/double-quoted template strings are vanishingly rare
 *  for genuinely multi-line HTML and, per stripCommentsAndStrings' own documented behavior
 *  elsewhere in this codebase, only a backtick `template:`/`styles:`-shaped (colon-assigned)
 *  string is treated as real markup rather than blanked string data in the first place. */
function extractAngularTemplateBlock(code: string, filePath: string): { content: string; lineOffset: number } | undefined {
  const match = /template\s*:\s*`([\s\S]*?)`/.exec(code);
  if (match) {
    const backtickIndex = match.index + match[0].indexOf('`');
    const startLine = code.slice(0, backtickIndex + 1).split(/\r?\n/).length;
    return { content: match[1], lineOffset: startLine - 1 };
  }
  // No inline `template: \`...\`` property found. Three distinct real cases produce this:
  //  (a) a genuine component TS file using an external `templateUrl: './x.html'` -- the file
  //      contains no template markup at all, so there is nothing to scan (real-AST or legacy),
  //      confirmed by the presence of an `@Component(` decorator with no inline template.
  //  (b) the file genuinely IS (or stands in for, in an isolated test) raw template markup -- a
  //      standalone `.html` template file, or a `.component.ts`/`.component.html`-named file
  //      (this codebase's own established Angular-component naming convention, also used as an
  //      Angular-detection signal elsewhere -- see detectFramework) supplying bare template
  //      content with no `@Component(` wrapper, exactly how this codebase's own test suite
  //      (`tests/rule-detection-matrix.test.ts` et al.) exercises FIGM-ANG-03/04/08/10 in
  //      isolation. The legacy heuristic this replaces scanned such content directly with no
  //      `template:` requirement, so real-AST parity requires the same: fall back to treating the
  //      whole input as the template, with no line offset -- but ONLY when the filename says this
  //      is actually template-shaped, not by mere absence of a `template:`/`@Component(` match.
  //  (c) **the bug this comment replaces**: a PLAIN `.ts` file that is neither a component nor a
  //      template at all -- a service, config, interceptor, model, etc. with no Angular decorator
  //      AND no `.component.*` filename (confirmed via a real-world re-scan: `app.config.ts`,
  //      `user.service.ts`, and similar files in `angular-realworld-example-app` were previously
  //      fed to `angular-html-parser` in full, which then misread ordinary TypeScript interface/
  //      object-literal `{`/`}` braces as malformed Angular template/ICU syntax -- "Unexpected
  //      character EOF... unescaped {", "Invalid ICU message" -- on files containing zero
  //      template markup). Case (b)'s fallback previously had no way to distinguish this from a
  //      real standalone template file/snippet; it now requires the filename to actually indicate
  //      template-shaped content.
  if (/@Component\s*\(/.test(code)) return undefined;
  if (/\.html?$/i.test(filePath) || /\.component\.(ts|html?)$/i.test(filePath)) {
    return { content: code, lineOffset: 0 };
  }
  return undefined;
}

interface AngularBuilderState {
  nodes: ASTNode[];
  originalLines: string[];
  lineOffset: number;
}

function pushAngularNode(state: AngularBuilderState, span: { start: { line: number; col: number } }, astNode: { type: string; name?: string; attributes: Record<string, unknown> }): void {
  const realLine = span.start.line + 1 + state.lineOffset; // angular-html-parser's line is 0-indexed
  state.nodes.push({
    ...astNode,
    scopeType: 'GLOBAL',
    loc: { start: { line: realLine, column: span.start.col }, end: { line: realLine, column: span.start.col + 1 } },
    sourceKind: 'REAL_AST',
  });
}

function snippetAt(state: AngularBuilderState, span: { start: { line: number } }): string {
  const realLine = span.start.line + 1 + state.lineOffset;
  return (state.originalLines[realLine - 1] ?? '').trim();
}

const ARRAY_METHOD_CALL_RE = /\b[A-Za-z_$][\w$]*\s*\(/;

/** True for an interpolation/binding expression that contains a genuine method-call shape --
 *  deliberately the same scope as the legacy heuristic it replaces (FIGM-ANG-04's original
 *  `cTrimmed.includes('()')` check): a bare call-with-parens, not a general "any identifier"
 *  match, so a plain property read like `{{ user.name }}` is never flagged. */
function looksLikeMethodCall(expr: string): boolean {
  return ARRAY_METHOD_CALL_RE.test(expr);
}

type NgSourceSpan = { start: { line: number; col: number } };

/** Walks every Text node's real interpolation tokens (angular-html-parser's InterpolatedTextToken,
 *  type 8 confirmed empirically to be the `{{ ... }}` token kind, with `parts[1]` holding the
 *  actual expression text between the delimiters) and calls `onExpr` for each, with real source
 *  location -- the single shared walk both FIGM-ANG-04 and FIGM-ANG-10 are built from.
 *
 *  Passes the individual TOKEN's own `sourceSpan`, not the enclosing text node's. A single text
 *  node can hold multiple `{{ ... }}` tokens (e.g. `{{ a() }} and {{ b() }}` is one DOM text node
 *  with two interpolation tokens) -- using the text node's span for every token inside it collapses
 *  genuinely different interpolations (different expressions, different character offsets, and on
 *  a multi-line text run potentially different LINES) onto one identical, wrong location. Confirmed
 *  empirically: angular-html-parser gives each token its own accurate `sourceSpan` already. */
function walkInterpolations(nodes: NgNode[], onExpr: (expr: string, span: NgSourceSpan) => void): void {
  for (const node of nodes) {
    if (node.kind === 'text') {
      const textNode = node as NgText;
      for (const token of textNode.tokens as unknown as Array<{ type: number; parts: string[]; sourceSpan: NgSourceSpan }>) {
        if (token.type === 8 && token.parts.length >= 2) {
          onExpr(token.parts[1].trim(), token.sourceSpan);
        }
      }
    }
    const children = (node as { children?: NgNode[] }).children;
    if (children) walkInterpolations(children, onExpr);
  }
}

function walkElements(nodes: NgNode[], onElement: (el: NgElement) => void): void {
  for (const node of nodes) {
    if (node.kind === 'element') {
      const el = node as NgElement;
      onElement(el);
      walkElements(el.children, onElement);
    } else {
      const children = (node as { children?: NgNode[] }).children;
      if (children) walkElements(children, onElement);
    }
  }
}

function walkBlocks(nodes: NgNode[], onBlock: (block: NgBlock) => void): void {
  for (const node of nodes) {
    if (node.kind === 'block') {
      const block = node as NgBlock;
      onBlock(block);
      walkBlocks(block.children, onBlock);
    } else {
      const children = (node as { children?: NgNode[] }).children;
      if (children) walkBlocks(children, onBlock);
    }
  }
}

export interface AngularTemplateParseError {
  line: number;
  column: number;
  message: string;
}

/**
 * Real Angular template structural errors -- angular-html-parser's own diagnostics (the exact same
 * parser + errors SandboxValidationPipeline's FRAMEWORK_STRUCTURAL stage already trusts to validate
 * AI-generated patches), now also surfaced for the initial detection scan. Previously only
 * `rootNodes` was read from a parse and `result.errors` was silently discarded, so a genuinely
 * malformed inline template (real, reproducible case: a mismatched closing tag) produced ZERO
 * diagnostics from the main scan -- unlike React/TSX (a TypeScript compile-time syntax error) and
 * Vue (`@vue/compiler-sfc`'s own errors, already wired into SourceParser.parseSource), which both
 * correctly surface a genuine structural/syntax error for equivalent malformed input. Mirrors that
 * same "real parser's own errors" precedent for Angular. Never throws; returns an empty array if
 * there is no inline template or the parse produces nothing usable.
 */
export function getAngularTemplateParseErrors(code: string, filePath: string): AngularTemplateParseError[] {
  const block = extractAngularTemplateBlock(code, filePath);
  if (!block) return [];
  try {
    const result = parseHtml(block.content, { tokenizeAngularBlocks: true });
    return result.errors.map((err) => ({
      line: err.span.start.line + 1 + block.lineOffset,
      column: err.span.start.col,
      message: err.msg,
    }));
  } catch {
    return [];
  }
}

/**
 * Builds FIGM-ANG-03/04/08/10's ASTNode set from a component file's extracted inline Angular
 * template. Never throws (angular-html-parser is error-tolerant like the TypeScript compiler
 * path); returns an empty list if there is no inline template or parsing produces nothing usable.
 */
export function buildAngularTemplateRealSyntaxNodes(code: string, filePath: string): ASTNode[] {
  const block = extractAngularTemplateBlock(code, filePath);
  if (!block) return [];

  let rootNodes: NgNode[];
  try {
    const result = parseHtml(block.content, { tokenizeAngularBlocks: true });
    rootNodes = result.rootNodes as unknown as NgNode[];
  } catch {
    return [];
  }

  const state: AngularBuilderState = {
    nodes: [],
    originalLines: code.split(/\r?\n/),
    lineOffset: block.lineOffset,
  };

  // --- FIGM-ANG-03: *ngFor missing trackBy (legacy microsyntax attribute) ---
  walkElements(rootNodes, (el) => {
    const ngFor = el.attrs.find((a: NgAttribute) => a.name === '*ngFor');
    if (!ngFor) return;
    if (ngFor.value.includes('trackBy')) return;
    pushAngularNode(state, ngFor.sourceSpan, {
      type: 'JSXAttribute',
      name: '*ngFor',
      attributes: { isNgForWithoutTrackBy: true, codeSnippet: snippetAt(state, ngFor.sourceSpan) },
    });
  });

  // --- FIGM-ANG-04: method call in interpolation or property binding ---
  walkInterpolations(rootNodes, (expr, span) => {
    if (!looksLikeMethodCall(expr)) return;
    pushAngularNode(state, span, {
      type: 'Interpolation',
      name: 'templateFunctionCall',
      attributes: { isTemplateFunctionCall: true, codeSnippet: snippetAt(state, span) },
    });
  });
  walkElements(rootNodes, (el) => {
    for (const attr of el.attrs) {
      // Property binding `[prop]="expr"` only -- deliberately excludes event bindings
      // `(event)="handler()"`, whose entire purpose is to call something on interaction, not on
      // every change-detection cycle; matches the legacy heuristic's own `]="` (not `)="`) scope.
      if (!attr.name.startsWith('[') || !attr.name.endsWith(']')) continue;
      if (!looksLikeMethodCall(attr.value)) continue;
      pushAngularNode(state, attr.sourceSpan, {
        type: 'Interpolation',
        name: 'templateFunctionCall',
        attributes: { isTemplateFunctionCall: true, codeSnippet: snippetAt(state, attr.sourceSpan) },
      });
    }
  });

  // --- FIGM-ANG-08: @for track expression bound to $index or the bare loop variable ---
  walkBlocks(rootNodes, (blockNode) => {
    if (blockNode.name !== 'for') return;
    const loopClause = blockNode.parameters[0]?.expression ?? '';
    const loopVarMatch = /^([\w$]+)\s+of\s+/.exec(loopClause.trim());
    const loopVar = loopVarMatch?.[1];
    const trackParam = blockNode.parameters.find((p) => /^track\s+/.test(p.expression.trim()));
    if (!trackParam) return; // angular-html-parser only produces a valid Block at all for syntax
    // that already includes `track` -- the compiler-enforced-required case (NG5002) confirmed in
    // the second expansion pass's research is corroborated here structurally: this parser has no
    // representation for a `@for` without one.
    const trackExpr = trackParam.expression.trim().replace(/^track\s+/, '').trim();
    const isUnstable = trackExpr === '$index' || (!!loopVar && trackExpr === loopVar);
    if (!isUnstable) return;
    pushAngularNode(state, trackParam.sourceSpan, {
      type: 'Interpolation',
      name: '@for',
      attributes: { isUnstableForTrack: true, codeSnippet: snippetAt(state, blockNode.sourceSpan) },
    });
  });

  // --- FIGM-ANG-10: the same observable expression piped through | async more than once ---
  const asyncPipeOccurrences: Array<{ expr: string; span: NgSourceSpan }> = [];
  walkInterpolations(rootNodes, (expr, span) => {
    const matches = [...expr.matchAll(/([\w.$]+)\s*\|\s*async\b/g)];
    for (const m of matches) asyncPipeOccurrences.push({ expr: m[1], span });
  });
  const counts = new Map<string, number>();
  for (const occ of asyncPipeOccurrences) counts.set(occ.expr, (counts.get(occ.expr) ?? 0) + 1);
  const duplicateExprs = new Set([...counts.entries()].filter(([, c]) => c >= 2).map(([e]) => e));
  for (const occ of asyncPipeOccurrences) {
    if (!duplicateExprs.has(occ.expr)) continue;
    pushAngularNode(state, occ.span, {
      type: 'Interpolation',
      name: 'async',
      attributes: { isDuplicateAsyncPipe: true, codeSnippet: snippetAt(state, occ.span) },
    });
  }

  return state.nodes;
}
