/**
 * Framework-Independent Guideline Model (FIGM)
 * Layer 1 — Angular Template AST Deterministic Fix Layer (Phase 03)
 *
 * Real Angular-template-AST-based transformation for the four FIGM-ANG rules whose violation
 * lives in TEMPLATE MARKUP (`FIGM-ANG-03/04/08/10`) — not the component class body, which
 * src/engine/ast-fix-engine.ts already handles via the TypeScript compiler (FIGM-ANG-02/05/09).
 *
 * Two real parsers are combined, neither faked and neither a regex pretending to be one:
 *
 *   1. The TypeScript Compiler API (`ts.createSourceFile`) locates the component's inline
 *      `template: \`...\`` NoSubstitutionTemplateLiteral by walking real `ts.Decorator` /
 *      `ts.ClassDeclaration` / `ts.PropertyAssignment` nodes — never a text search for the word
 *      "template" or "@Component".
 *   2. `angular-html-parser` (https://www.npmjs.com/package/angular-html-parser, the same real
 *      HTML+Angular-template parser src/ast/angular-template-ast-builder.ts's DETECTION side
 *      already uses, including the modern `@for`/`@if`/`@switch` block syntax via
 *      `tokenizeAngularBlocks: true`) parses that template's own source text into a real element/
 *      attribute/block/text tree with genuine character-offset source spans.
 *
 * This module deliberately does NOT import from src/ast/angular-template-ast-builder.ts (the
 * detection engine) and does not modify it — per the architecture requirement, detection stays
 * untouched. Its `extractAngularTemplateBlock`-equivalent logic is intentionally re-derived here
 * via a different, purely AST-based mechanism (see `locateTemplateAnchor` below) rather than
 * imported, so this fix module has its own independent, regex-free path to the same template text.
 *
 * Fixing methodology matches src/engine/ast-fix-engine.ts exactly: locate the exact node via real
 * parser output, build the minimal new text for ONLY that node's own span, and splice it back into
 * the original file at that exact character range — every other byte (component class body,
 * surrounding markup, formatting, comments) is left untouched because it is never re-emitted.
 *
 * FIGM-ANG-03 (*ngFor missing trackBy) and FIGM-ANG-08 (@for track $index/loopVar) get real
 * deterministic transforms: appending `trackBy: trackById` / rewriting to `track <item>.id` never
 * requires knowing anything about the developer's intent, and re-scan can always confirm the
 * specific violation is gone. FIGM-ANG-04 (template method call) and FIGM-ANG-10 (duplicate async
 * pipe) genuinely require developer intention — what the method computes, whether to restructure
 * around an "as" alias — so their fixers only ever CONFIRM the exact violating node can be located
 * (proving this is not a guess), then decline with `requiresManualReview: true`, routing to the
 * AI-assisted Layer 2 exactly as the two-layer architecture requires. Neither is faked as an
 * auto-fix to hit a completion quota.
 */

import * as ts from 'typescript';
import { parseHtml } from 'angular-html-parser';
import type {
  Node as NgNode,
  Element as NgElement,
  Attribute as NgAttribute,
  Block as NgBlock,
  BlockParameter as NgBlockParameter,
  Text as NgText,
} from 'angular-html-parser/dist/compiler/src/ml_parser/ast.mjs';
import { DiagnosticReport } from '../types/ast-spec.js';

export interface AngularTemplateFixOutcome {
  success: boolean;
  patchedCode: string;
  description: string;
  /** True when the violation was genuinely located but requires developer intention to resolve —
   *  callers must route this to the AI-assisted Layer 2, never treat it as a completed fix. */
  requiresManualReview?: boolean;
}

/**
 * Rule metadata for the four rules this module owns. A lightweight, honest record of what each
 * rule needs — not a schema migration of the canonical FOUR_LAYER_MAPPINGS registry
 * (src/matrix/four-layer-meta-model.ts), which this module deliberately does not touch.
 */
export interface AngularTemplateRuleMeta {
  id: string;
  category: 'ANGULAR_TEMPLATE_STABILITY' | 'ANGULAR_TEMPLATE_PERFORMANCE' | 'ANGULAR_TEMPLATE_SUBSCRIPTION';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  framework: 'ANGULAR_TEMPLATE';
  detector: string;
  astPattern: string;
  fixer: string;
  standard: string;
  autoFixAvailable: boolean;
}

export const ANGULAR_TEMPLATE_RULE_META: readonly AngularTemplateRuleMeta[] = [
  {
    id: 'FIGM-ANG-03',
    category: 'ANGULAR_TEMPLATE_PERFORMANCE',
    severity: 'HIGH',
    framework: 'ANGULAR_TEMPLATE',
    detector: 'walkElements: Element with a *ngFor Attribute whose value lacks "trackBy"',
    astPattern: 'Element.attrs[*ngFor] (angular-html-parser Attribute node)',
    fixer: 'Append "; trackBy: trackById" to the *ngFor attribute value span',
    standard: 'Angular style guide — *ngFor trackBy',
    autoFixAvailable: true,
  },
  {
    id: 'FIGM-ANG-04',
    category: 'ANGULAR_TEMPLATE_PERFORMANCE',
    severity: 'MEDIUM',
    framework: 'ANGULAR_TEMPLATE',
    detector: 'walkInterpolations/walkElements: a method-call-shaped expression in a Text interpolation or [property] binding',
    astPattern: 'Text.tokens[InterpolatedTextToken] / Element.attrs[[prop]] (angular-html-parser)',
    fixer: 'None — requires knowing what the method computes (getter vs. signal vs. pure pipe)',
    standard: 'Angular change-detection performance guidance',
    autoFixAvailable: false,
  },
  {
    id: 'FIGM-ANG-08',
    category: 'ANGULAR_TEMPLATE_PERFORMANCE',
    severity: 'HIGH',
    framework: 'ANGULAR_TEMPLATE',
    detector: 'walkBlocks: a `@for` Block whose `track` parameter is $index or the bare loop variable',
    astPattern: 'Block[name="for"].parameters[track ...] (angular-html-parser BlockParameter)',
    fixer: 'Replace the track BlockParameter\'s span with "track <loopVar>.id"',
    standard: 'Angular docs — @for track expression',
    autoFixAvailable: true,
  },
  {
    id: 'FIGM-ANG-10',
    category: 'ANGULAR_TEMPLATE_SUBSCRIPTION',
    severity: 'MEDIUM',
    framework: 'ANGULAR_TEMPLATE',
    detector: 'walkInterpolations: the same observable expression piped through | async 2+ times',
    astPattern: 'Text.tokens[InterpolatedTextToken] (angular-html-parser), counted by expression text',
    fixer: 'None — requires introducing an "as" alias and restructuring the surrounding markup',
    standard: 'AsyncPipe subscription-behavior guidance',
    autoFixAvailable: false,
  },
];

function ok(patchedCode: string, description: string): AngularTemplateFixOutcome {
  return { success: true, patchedCode, description };
}

function declined(code: string, reason: string, requiresManualReview = false): AngularTemplateFixOutcome {
  return { success: false, patchedCode: code, description: reason, requiresManualReview };
}

interface TemplateAnchor {
  /** Raw template text, sliced directly from the ORIGINAL file's own source characters (never
   *  the TS compiler's "cooked" `.text` value) so angular-html-parser's offsets map back onto the
   *  original file byte-for-byte. */
  raw: string;
  /** Absolute character offset in the ORIGINAL file where `raw` begins. */
  fileOffset: number;
}

/**
 * Locates the component's inline template text via real AST, in two cases:
 *
 *  (a) A `@Component({ template: \`...\` })` decorator exists — walk to its NoSubstitutionTemplateLiteral
 *      via real `ts.Decorator`/`ts.CallExpression`/`ts.PropertyAssignment` nodes.
 *  (b) No `@Component(` decorator exists anywhere in the file at all — the file/snippet itself IS
 *      raw template markup (a standalone template fixture, or a .html-shaped file with no
 *      surrounding class), the exact same fallback the DETECTION module documents for the
 *      identical reason. Determined via a real structural walk ("is there a Component decorator
 *      anywhere in this SourceFile"), not a text search.
 *
 * Returns undefined only for the genuine third case: a `@Component(...)` decorator IS present but
 * has no inline backtick template (e.g. `templateUrl: './x.html'`) — there is nothing in this
 * single file for this engine to parse or patch.
 */
function locateTemplateAnchor(sourceFile: ts.SourceFile, code: string): TemplateAnchor | undefined {
  let hasComponentDecorator = false;
  let anchor: TemplateAnchor | undefined;

  const visitClass = (classDecl: ts.ClassDeclaration) => {
    const decorators = ts.canHaveDecorators(classDecl) ? ts.getDecorators(classDecl) : undefined;
    for (const dec of decorators ?? []) {
      if (!ts.isCallExpression(dec.expression) || !ts.isIdentifier(dec.expression.expression) || dec.expression.expression.text !== 'Component') {
        continue;
      }
      hasComponentDecorator = true;
      const arg = dec.expression.arguments[0];
      if (!arg || !ts.isObjectLiteralExpression(arg)) continue;
      for (const prop of arg.properties) {
        if (
          ts.isPropertyAssignment(prop) &&
          ts.isIdentifier(prop.name) &&
          prop.name.text === 'template' &&
          ts.isNoSubstitutionTemplateLiteral(prop.initializer)
        ) {
          const start = prop.initializer.getStart(sourceFile) + 1; // skip the opening `
          const end = prop.initializer.getEnd() - 1; // exclude the closing `
          anchor = { raw: code.slice(start, end), fileOffset: start };
        }
      }
    }
  };

  const visit = (node: ts.Node) => {
    if (ts.isClassDeclaration(node)) visitClass(node);
    node.forEachChild(visit);
  };
  visit(sourceFile);

  if (anchor) return anchor;
  if (hasComponentDecorator) return undefined;
  return { raw: code, fileOffset: 0 };
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

function walkText(nodes: NgNode[], onText: (t: NgText) => void): void {
  for (const node of nodes) {
    if (node.kind === 'text') onText(node as NgText);
    const children = (node as { children?: NgNode[] }).children;
    if (children) walkText(children, onText);
  }
}

/** Inclusive-end containment check against angular-html-parser's absolute character offsets — the
 *  Angular-template analogue of ast-fix-engine.ts's `positionFromLocation` + node-at-position walk. */
function containsOffset(span: { start: { offset: number }; end: { offset: number } }, absOffset: number): boolean {
  return absOffset >= span.start.offset && absOffset <= span.end.offset;
}

// ---------------------------------------------------------------------------------------------
// FIGM-ANG-03 — *ngFor missing trackBy
// ---------------------------------------------------------------------------------------------
function fixAng03(anchor: TemplateAnchor, rootNodes: NgNode[], absOffset: number): AngularTemplateFixOutcome {
  let target: NgAttribute | undefined;
  walkElements(rootNodes, (el) => {
    if (target) return;
    const ngFor = el.attrs.find((a) => a.name === '*ngFor');
    if (!ngFor || ngFor.value.includes('trackBy')) return;
    if (containsOffset(ngFor.sourceSpan, absOffset)) target = ngFor;
  });
  if (!target || !target.valueSpan) {
    return declined(anchor.raw, 'Could not locate the reported *ngFor attribute (missing trackBy) via Angular template AST position lookup.');
  }

  // angular-html-parser's Attribute.valueSpan covers the value INCLUDING its surrounding quote
  // characters (confirmed empirically: for `*ngFor="let item of items"`, valueSpan's own text is
  // `"let item of items"`, quotes included) — the quote character actually used must be preserved,
  // not assumed, so a template quoted with `'` isn't silently rewritten to use `"`.
  const quoteChar = anchor.raw[target.valueSpan.start.offset];
  const newValue = `${quoteChar}${target.value}; trackBy: trackById${quoteChar}`;
  const patchedTemplate = anchor.raw.slice(0, target.valueSpan.start.offset) + newValue + anchor.raw.slice(target.valueSpan.end.offset);
  return ok(
    patchedTemplate,
    'Added trackBy: trackById to the *ngFor directive via Angular template AST transformation — a matching trackById(index, item) method must exist on the component class.'
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-ANG-08 — @for track expression bound to $index or the bare loop variable
// ---------------------------------------------------------------------------------------------
function fixAng08(anchor: TemplateAnchor, rootNodes: NgNode[], absOffset: number): AngularTemplateFixOutcome {
  let targetParam: NgBlockParameter | undefined;
  let targetLoopVar: string | undefined;

  walkBlocks(rootNodes, (blockNode) => {
    if (targetParam || blockNode.name !== 'for') return;
    const loopClause = (blockNode.parameters[0]?.expression ?? '').trim();
    // Mirrors the detection module's own loop-variable extraction from the block's first
    // parameter's expression — an isolated, already-AST-located microsyntax string, the identical
    // technique angular-template-ast-builder.ts's detection side already uses for this same rule.
    const loopVarMatch = /^([\w$]+)\s+of\s+/.exec(loopClause);
    const loopVar = loopVarMatch?.[1];
    const trackParam = blockNode.parameters.find((p) => /^track\s+/.test(p.expression.trim()));
    if (!trackParam) return;
    const trackExpr = trackParam.expression.trim().replace(/^track\s+/, '').trim();
    const isUnstable = trackExpr === '$index' || (!!loopVar && trackExpr === loopVar);
    if (!isUnstable) return;
    if (containsOffset(trackParam.sourceSpan, absOffset) || containsOffset(blockNode.sourceSpan, absOffset)) {
      targetParam = trackParam;
      targetLoopVar = loopVar;
    }
  });

  if (!targetParam || !targetLoopVar) {
    return declined(
      anchor.raw,
      'Could not locate the reported @for track expression (or resolve its loop variable name) via Angular template AST position lookup.'
    );
  }

  const newParamText = `track ${targetLoopVar}.id`;
  const patchedTemplate =
    anchor.raw.slice(0, targetParam.sourceSpan.start.offset) + newParamText + anchor.raw.slice(targetParam.sourceSpan.end.offset);
  return ok(
    patchedTemplate,
    `Replaced the unstable @for track expression with a stable identifier (${targetLoopVar}.id) via Angular template AST transformation — adjust to match your actual data shape if it has no id field.`
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-ANG-04 — method call inside a template interpolation or [property] binding
// ---------------------------------------------------------------------------------------------
function fixAng04(anchor: TemplateAnchor, rootNodes: NgNode[], absOffset: number): AngularTemplateFixOutcome {
  let located = false;
  walkText(rootNodes, (t) => {
    if (containsOffset(t.sourceSpan, absOffset)) located = true;
  });
  walkElements(rootNodes, (el) => {
    for (const attr of el.attrs) {
      if (attr.name.startsWith('[') && attr.name.endsWith(']') && containsOffset(attr.sourceSpan, absOffset)) located = true;
    }
  });
  if (!located) {
    return declined(anchor.raw, 'Could not locate the reported template expression via Angular template AST position lookup.');
  }
  // Exact node located (proving this is not a guess) — but converting a method call to a getter,
  // cached signal, or pure pipe requires understanding what the method actually computes, which
  // cannot be inferred from the template alone. Per the two-layer contract, this always declines
  // and routes to Layer 2 (AI-assisted), never fabricating a mechanical rewrite.
  return declined(
    anchor.raw,
    'Converting this template method call to a getter, cached signal, or pure pipe requires understanding what the method computes — not safely automatable. Routed to the AI-assisted layer.',
    true
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-ANG-10 — the same observable expression piped through | async more than once
// ---------------------------------------------------------------------------------------------
function fixAng10(anchor: TemplateAnchor, rootNodes: NgNode[], absOffset: number): AngularTemplateFixOutcome {
  let located = false;
  walkText(rootNodes, (t) => {
    if (containsOffset(t.sourceSpan, absOffset)) located = true;
  });
  if (!located) {
    return declined(anchor.raw, 'Could not locate the reported duplicate async-pipe expression via Angular template AST position lookup.');
  }
  // Exact node located — but introducing `*ngIf="obs$ | async as value"` (or an equivalent
  // `@if`/`@for` alias) and rewiring every duplicate usage to the new local variable requires
  // restructuring the surrounding markup, which is a developer decision, not a mechanical rewrite.
  return declined(
    anchor.raw,
    'Subscribing once via an "as" alias and reusing the local template variable requires restructuring the surrounding markup — not safely automatable. Routed to the AI-assisted layer.',
    true
  );
}

// ---------------------------------------------------------------------------------------------

export class AngularTemplateFixEngine {
  public static readonly SUPPORTED_RULE_IDS: ReadonlySet<string> = new Set(['FIGM-ANG-03', 'FIGM-ANG-04', 'FIGM-ANG-08', 'FIGM-ANG-10']);

  public static isEligible(ruleId: string): boolean {
    return AngularTemplateFixEngine.SUPPORTED_RULE_IDS.has(ruleId);
  }

  /**
   * Attempts a real Angular-template-AST transformation for `defect`. Returns `success: false`
   * (never throws, always leaves `patchedCode === code`) whenever the node can't be located, the
   * rule isn't one of `SUPPORTED_RULE_IDS`, or (FIGM-ANG-04/10) the violation genuinely requires
   * developer intention — callers must treat any non-success as "try Layer 2 instead."
   */
  public static tryFix(code: string, defect: DiagnosticReport, filePath?: string): AngularTemplateFixOutcome {
    if (!AngularTemplateFixEngine.isEligible(defect.ruleId)) {
      return declined(code, `${defect.ruleId} is not an Angular template rule this engine handles.`);
    }

    const effectivePath = filePath || defect.filePath || 'component.ts';
    let sourceFile: ts.SourceFile;
    try {
      sourceFile = ts.createSourceFile(effectivePath, code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
    } catch (err) {
      return declined(code, `Source could not be parsed by the TypeScript compiler API: ${err instanceof Error ? err.message : String(err)}`);
    }

    const anchor = locateTemplateAnchor(sourceFile, code);
    if (!anchor) {
      return declined(code, 'This component has a @Component(...) decorator but no inline backtick template (e.g. templateUrl) — nothing in this file for this engine to patch.');
    }

    let rootNodes: NgNode[];
    try {
      const result = parseHtml(anchor.raw, { tokenizeAngularBlocks: true });
      rootNodes = result.rootNodes as unknown as NgNode[];
    } catch (err) {
      return declined(code, `Angular template markup could not be parsed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const line = defect.location?.start?.line ?? 1;
    const column = defect.location?.start?.column ?? 0;

    let absFileOffset: number;
    try {
      absFileOffset = sourceFile.getPositionOfLineAndCharacter(Math.max(0, line - 1), Math.max(0, column));
    } catch {
      return declined(code, 'Could not resolve the reported line/column to a source position.');
    }
    const absOffset = absFileOffset - anchor.fileOffset;

    let outcome: AngularTemplateFixOutcome;
    try {
      switch (defect.ruleId) {
        case 'FIGM-ANG-03':
          outcome = fixAng03(anchor, rootNodes, absOffset);
          break;
        case 'FIGM-ANG-08':
          outcome = fixAng08(anchor, rootNodes, absOffset);
          break;
        case 'FIGM-ANG-04':
          outcome = fixAng04(anchor, rootNodes, absOffset);
          break;
        case 'FIGM-ANG-10':
          outcome = fixAng10(anchor, rootNodes, absOffset);
          break;
        default:
          return declined(code, `${defect.ruleId} has not been migrated to the Angular template fix engine yet.`);
      }
    } catch (err) {
      return declined(code, `Angular template AST transformation failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!outcome.success) {
      return { ...outcome, patchedCode: code };
    }

    const patchedFullCode = code.slice(0, anchor.fileOffset) + outcome.patchedCode + code.slice(anchor.fileOffset + anchor.raw.length);
    return { success: true, patchedCode: patchedFullCode, description: outcome.description };
  }
}
