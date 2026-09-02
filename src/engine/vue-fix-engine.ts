/**
 * Framework-Independent Guideline Model (FIGM)
 * Layer 1 — Vue AST Deterministic Fix Engine (Phase 04)
 *
 * Real Vue-3-AST-based transformation for FIGM-VUE-01..04, built entirely on
 * src/ast/vue-framework-adapter.ts (itself built on `@vue/compiler-sfc` + `@vue/compiler-dom` for
 * `<template>`, and the TypeScript Compiler API for `<script>`/`<script setup>`) — never a regex
 * or hand-rolled tokenizer standing in for a real parser.
 *
 * Methodology matches src/engine/ast-fix-engine.ts and src/engine/angular-template-fix-engine.ts
 * exactly: locate the exact node via real parser output, build the minimal new text for ONLY that
 * node's own span, splice it back into the original file at that exact character range. Every
 * other byte — the rest of the template, the whole script block, formatting, comments — is left
 * untouched because it is never re-emitted.
 *
 * FIGM-VUE-01 (missing/unstable v-for :key) gets a real deterministic transform: adding or
 * replacing a `:key` binding never requires knowing anything about the developer's intent, and
 * re-scan can always confirm the specific violation is gone.
 *
 * FIGM-VUE-02 (v-if + v-for on the same element), FIGM-VUE-03 (side effect inside a computed()
 * getter), and FIGM-VUE-04 (direct mutation of a computed ref's own .value) all genuinely require
 * developer intention — see each fixer's own comment — matching this exact codebase's own
 * pre-existing, independently-reached judgment for these three rules in
 * src/engine/remediation-engine.ts's per-rule case comments. Their fixers only ever CONFIRM the
 * exact violating node can be located (proving this is not a lookup failure), then decline with
 * `requiresManualReview: true`, routing to the AI-assisted Layer 2 — never fabricating a
 * mechanical rewrite to hit a completion quota.
 */

import * as ts from 'typescript';
import { NodeTypes, type ElementNode, type ExpressionNode } from '@vue/compiler-dom';
import { DiagnosticReport } from '../types/ast-spec.js';
import { parseVueComponent, walkVueElements, findDirective, findKeyDirective, lineColumnToOffset, type VueComponentAst } from '../ast/vue-framework-adapter.js';

export interface VueFixOutcome {
  success: boolean;
  patchedCode: string;
  description: string;
  /** True when the violation was genuinely located but requires developer intention to resolve —
   *  callers must route this to the AI-assisted Layer 2, never treat it as a completed fix. */
  requiresManualReview?: boolean;
}

export interface VueRuleMeta {
  id: string;
  category: 'VUE_TEMPLATE_STABILITY' | 'VUE_REACTIVITY';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  framework: 'VUE_SFC';
  detector: string;
  astPattern: string;
  fixer: string;
  standard: string;
  autoFixAvailable: boolean;
}

export const VUE_RULE_META: readonly VueRuleMeta[] = [
  {
    id: 'FIGM-VUE-01',
    category: 'VUE_TEMPLATE_STABILITY',
    severity: 'HIGH',
    framework: 'VUE_SFC',
    detector: 'walkVueElements: an ElementNode with a "for" DirectiveNode whose :key is missing or bound to the loop index',
    astPattern: 'ElementNode.props[DirectiveNode(name="for"|"bind",arg="key")] (@vue/compiler-core RootNode)',
    fixer: 'Insert/replace the :key binding\'s span with "<item>.id", <item> resolved from DirectiveNode.forParseResult.value',
    standard: 'Vue.js Style Guide — Priority A: v-for key',
    autoFixAvailable: true,
  },
  {
    id: 'FIGM-VUE-02',
    category: 'VUE_TEMPLATE_STABILITY',
    severity: 'HIGH',
    framework: 'VUE_SFC',
    detector: 'walkVueElements: an ElementNode carrying both a "for" and an "if" DirectiveNode',
    astPattern: 'ElementNode.props[DirectiveNode(name="for")] & ElementNode.props[DirectiveNode(name="if")]',
    fixer: 'None — filtering into a computed vs. moving v-if to a wrapping <template> is a developer decision',
    standard: 'Vue.js Style Guide — Priority A: v-if with v-for',
    autoFixAvailable: false,
  },
  {
    id: 'FIGM-VUE-03',
    category: 'VUE_REACTIVITY',
    severity: 'HIGH',
    framework: 'VUE_SFC',
    detector: '(script AST) a computed() getter body containing a side effect (ref mutation or I/O)',
    astPattern: 'ts.CallExpression("computed") in the <script setup>/<script> TypeScript AST',
    fixer: 'None — the side effect belongs in a watch()/handler, which requires understanding the surrounding logic',
    standard: 'Vue.js docs — Computed Properties (getters must be side-effect-free)',
    autoFixAvailable: false,
  },
  {
    id: 'FIGM-VUE-04',
    category: 'VUE_REACTIVITY',
    severity: 'MEDIUM',
    framework: 'VUE_SFC',
    detector: '(script AST) an assignment into a computed ref\'s own .value contents from outside its definition',
    astPattern: 'ts.BinaryExpression (EqualsToken) targeting a computed ref\'s .value in the <script> TypeScript AST',
    fixer: 'None — the correct underlying source ref to mutate instead is app-specific',
    standard: 'Vue.js docs — Computed Properties (writable computed / underlying source of truth)',
    autoFixAvailable: false,
  },
];

function ok(patchedCode: string, description: string): VueFixOutcome {
  return { success: true, patchedCode, description };
}

function declined(code: string, reason: string, requiresManualReview = false): VueFixOutcome {
  return { success: false, patchedCode: code, description: reason, requiresManualReview };
}

function containsOffset(span: { start: { offset: number }; end: { offset: number } }, absOffset: number): boolean {
  return absOffset >= span.start.offset && absOffset <= span.end.offset;
}

/** A v-for alias (item/key/index) is always a bare identifier — a SimpleExpressionNode — never a
 *  CompoundExpressionNode; this narrows that real-typed union rather than casting past it. */
function simpleExprContent(node: ExpressionNode | undefined): string | undefined {
  return node && node.type === NodeTypes.SIMPLE_EXPRESSION ? node.content : undefined;
}

/** Real TS-AST node-at-position walk — the Vue-script-block analogue of
 *  ast-fix-engine.ts's `findSmallestNodeAtPosition`, duplicated locally (a small, self-contained
 *  tree walk, not detection logic) rather than imported, so this engine has no dependency on the
 *  React/Next fix engine's internals. */
function findSmallestTsNodeAtPosition(sourceFile: ts.SourceFile, pos: number): ts.Node {
  let best: ts.Node = sourceFile;
  const visit = (node: ts.Node) => {
    const start = node.getStart(sourceFile);
    const end = node.getEnd();
    if (pos >= start && pos < end) {
      best = node;
      node.forEachChild(visit);
    }
  };
  sourceFile.forEachChild(visit);
  return best;
}

// ---------------------------------------------------------------------------------------------
// FIGM-VUE-01 — v-for missing/unstable :key
// ---------------------------------------------------------------------------------------------
function fixVue01(component: VueComponentAst, absOffset: number): VueFixOutcome {
  if (!component.templateRoot) return declined(component.raw, 'No <template> block found to patch.');

  let target: ElementNode | undefined;
  walkVueElements(component.templateRoot.children, (el) => {
    if (target) return;
    if (findDirective(el, 'for') && containsOffset(el.loc, absOffset)) target = el;
  });
  if (!target) {
    return declined(component.raw, 'Could not locate the reported v-for element via Vue template AST position lookup.');
  }

  const forDir = findDirective(target, 'for')!;
  const itemVar = simpleExprContent(forDir.forParseResult?.value);
  if (!itemVar) {
    return declined(component.raw, 'Could not resolve the v-for loop item variable name via Vue template AST — cannot safely build a stable key expression.');
  }
  // Vue's for-parse result labels the SECOND positional destructured variable "key" for both the
  // array form `(item, index) in items` and the object form `(value, key) in obj` — confirmed
  // empirically against @vue/compiler-core's own parseForExpression, which packs any 2-slot
  // destructure into the same `.key` field regardless of iterable shape.
  const indexVar = simpleExprContent(forDir.forParseResult?.key);

  const keyDir = findKeyDirective(target);
  if (!keyDir) {
    const insertion = ` :key="${itemVar}.id"`;
    const patched = component.raw.slice(0, forDir.loc.end.offset) + insertion + component.raw.slice(forDir.loc.end.offset);
    return ok(
      patched,
      `Added :key="${itemVar}.id" to the v-for element via Vue template AST transformation — adjust to match your actual data shape if it has no id field.`
    );
  }

  const keyContent = simpleExprContent(keyDir.exp);
  const keyIsUnstable = !!indexVar && keyContent === indexVar;
  if (!keyIsUnstable || !keyDir.exp) {
    return declined(component.raw, 'The existing :key binding is not bound to the loop index — nothing unsafe to automatically change.');
  }

  const patched = component.raw.slice(0, keyDir.exp.loc.start.offset) + `${itemVar}.id` + component.raw.slice(keyDir.exp.loc.end.offset);
  return ok(
    patched,
    `Replaced the unstable :key (bound to the loop index) with a stable identifier (${itemVar}.id) via Vue template AST transformation — adjust to match your actual data shape if it has no id field.`
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-VUE-02 — v-if and v-for on the same element
// ---------------------------------------------------------------------------------------------
function fixVue02(component: VueComponentAst, absOffset: number): VueFixOutcome {
  if (!component.templateRoot) return declined(component.raw, 'No <template> block found to patch.');

  let located = false;
  walkVueElements(component.templateRoot.children, (el) => {
    if (located) return;
    if (findDirective(el, 'for') && findDirective(el, 'if') && containsOffset(el.loc, absOffset)) located = true;
  });
  if (!located) {
    return declined(component.raw, 'Could not locate an element with both v-for and v-if via Vue template AST position lookup.');
  }
  // Exact element located — but the correct rewrite (filter the source into a computed property
  // and iterate that instead, vs. move v-if to a wrapping <template> to conditionally hide the
  // whole list) depends on which behavior the developer actually intends, which this engine
  // cannot infer from the markup alone. Matches this codebase's own pre-existing, independently
  // documented judgment for this exact rule (see remediation-engine.ts's FIGM-VUE-02 case).
  return declined(
    component.raw,
    "Filtering the source into a computed property (if the loop should simply skip some items) vs. moving v-if to a wrapping <template> (if the goal is hiding the whole list) requires knowing developer intent — not safely automatable. Routed to the AI-assisted layer.",
    true
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-VUE-03 — side effect inside a computed() getter
// ---------------------------------------------------------------------------------------------
function fixVue03(component: VueComponentAst, absOffset: number): VueFixOutcome {
  if (!component.scriptSourceFile) return declined(component.raw, 'No <script>/<script setup> block found to patch.');
  const scriptPos = absOffset - component.scriptFileOffset;
  if (scriptPos < 0 || scriptPos > component.scriptSourceFile.text.length) {
    return declined(component.raw, 'Reported position falls outside the script block.');
  }
  const node = findSmallestTsNodeAtPosition(component.scriptSourceFile, scriptPos);
  if (node === component.scriptSourceFile) {
    return declined(component.raw, 'Could not locate the reported computed() call via TypeScript AST position lookup.');
  }
  // Exact node located — but moving the side effect into a watch()/event handler requires
  // understanding what the surrounding logic actually needs, which this engine cannot infer.
  // Matches this codebase's own pre-existing judgment for this exact rule.
  return declined(
    component.raw,
    'Moving this side effect out of the computed() getter into a watch() or event handler requires understanding the surrounding logic — not safely automatable. Routed to the AI-assisted layer.',
    true
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-VUE-04 — direct mutation of a computed ref's own .value
// ---------------------------------------------------------------------------------------------
function fixVue04(component: VueComponentAst, absOffset: number): VueFixOutcome {
  if (!component.scriptSourceFile) return declined(component.raw, 'No <script>/<script setup> block found to patch.');
  const scriptPos = absOffset - component.scriptFileOffset;
  if (scriptPos < 0 || scriptPos > component.scriptSourceFile.text.length) {
    return declined(component.raw, 'Reported position falls outside the script block.');
  }
  const node = findSmallestTsNodeAtPosition(component.scriptSourceFile, scriptPos);
  if (node === component.scriptSourceFile) {
    return declined(component.raw, 'Could not locate the reported mutation via TypeScript AST position lookup.');
  }
  // Exact node located — but the correct underlying source ref to mutate instead is app-specific.
  // Matches this codebase's own pre-existing judgment for this exact rule.
  return declined(
    component.raw,
    "Mutating the underlying source ref this computed derives from (instead of the computed's own .value) requires knowing which ref that is — not safely automatable. Routed to the AI-assisted layer.",
    true
  );
}

// ---------------------------------------------------------------------------------------------

export class VueAstFixEngine {
  public static readonly SUPPORTED_RULE_IDS: ReadonlySet<string> = new Set(['FIGM-VUE-01', 'FIGM-VUE-02', 'FIGM-VUE-03', 'FIGM-VUE-04']);

  public static isEligible(ruleId: string): boolean {
    return VueAstFixEngine.SUPPORTED_RULE_IDS.has(ruleId);
  }

  /**
   * Attempts a real Vue-AST transformation for `defect`. Returns `success: false` (never throws,
   * always leaves `patchedCode === code`) whenever the node can't be located, the rule isn't one
   * of `SUPPORTED_RULE_IDS`, or (FIGM-VUE-02/03/04) the violation genuinely requires developer
   * intention — callers must treat any non-success as "try Layer 2 instead."
   */
  public static tryFix(code: string, defect: DiagnosticReport, filePath?: string): VueFixOutcome {
    if (!VueAstFixEngine.isEligible(defect.ruleId)) {
      return declined(code, `${defect.ruleId} is not a Vue rule this engine handles.`);
    }

    const effectivePath = filePath || defect.filePath || 'component.vue';
    let component: VueComponentAst;
    try {
      component = parseVueComponent(code, effectivePath);
    } catch (err) {
      return declined(code, `Vue SFC could not be parsed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const line = defect.location?.start?.line ?? 1;
    const column = defect.location?.start?.column ?? 0;
    const absOffset = lineColumnToOffset(code, line, column);

    let outcome: VueFixOutcome;
    try {
      switch (defect.ruleId) {
        case 'FIGM-VUE-01':
          outcome = fixVue01(component, absOffset);
          break;
        case 'FIGM-VUE-02':
          outcome = fixVue02(component, absOffset);
          break;
        case 'FIGM-VUE-03':
          outcome = fixVue03(component, absOffset);
          break;
        case 'FIGM-VUE-04':
          outcome = fixVue04(component, absOffset);
          break;
        default:
          return declined(code, `${defect.ruleId} has not been migrated to the Vue AST fix engine yet.`);
      }
    } catch (err) {
      return declined(code, `Vue AST transformation failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return outcome;
  }
}
