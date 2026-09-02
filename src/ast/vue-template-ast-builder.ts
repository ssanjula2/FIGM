/**
 * Framework-Independent Guideline Model (FIGM)
 * Vue Template Real-AST Builder
 *
 * Upgrades FIGM-VUE-01 (unstable/missing v-for :key) and FIGM-VUE-02 (v-if combined with v-for on
 * the same element) from LEGACY_TEXT_HEURISTIC to REAL_AST, reusing the exact same real
 * `@vue/compiler-dom` template AST (`parseVueComponent`/`walkVueElements`/`findDirective`/
 * `findKeyDirective` from vue-framework-adapter.ts) that src/engine/vue-fix-engine.ts already uses
 * to LOCATE these two violations for fixing — this builder produces the matching DETECTION-side
 * nodes so the initial scan and the fix-verification path agree on the exact same real AST, not
 * two independently-maintained notions of "where the violation is."
 *
 * This does NOT touch FIGM-VUE-03/04/05/06 — those are `<script>`/`<script setup>` rules and
 * already have real AST via src/ast/real-syntax-node-builder.ts's buildVueScriptRealSyntaxNodes.
 * This module only covers the two rules whose violation shape lives in TEMPLATE MARKUP, which a
 * TypeScript parse of the script block never sees at all.
 *
 * Mirrors angular-template-ast-builder.ts's structure (a dedicated small builder for one
 * framework's template-markup rules, called from real-syntax-node-builder.ts's main entry point)
 * rather than folding this into that already-large file.
 */

import { NodeTypes, type ElementNode, type ExpressionNode, type SourceLocation } from '@vue/compiler-dom';
import { parseVueComponent, walkVueElements, findDirective, findKeyDirective } from './vue-framework-adapter.js';
import type { ASTNode } from '../types/ast-spec.js';

/** A v-for alias (item/key/index) is always a bare identifier — a SimpleExpressionNode — never a
 *  CompoundExpressionNode. Local copy of the identical helper in vue-fix-engine.ts (a small,
 *  self-contained accessor, not detection logic) so this detection-side builder has no dependency
 *  on the fix engine's internals, matching that file's own stated rationale for its local copies. */
function simpleExprContent(node: ExpressionNode | undefined): string | undefined {
  return node && node.type === NodeTypes.SIMPLE_EXPRESSION ? node.content : undefined;
}

/** Vue's compiler-core Position is 1-indexed for both line and column (confirmed empirically);
 *  FIGM's ASTNode.loc is 1-indexed line / 0-indexed column (see
 *  TypeScriptFrameworkParser.getSourceRange for the convention every other real-AST builder in
 *  this codebase follows). */
function toFigmLoc(loc: SourceLocation): ASTNode['loc'] {
  return {
    start: { line: loc.start.line, column: Math.max(0, loc.start.column - 1) },
    end: { line: loc.end.line, column: Math.max(0, loc.end.column - 1) },
  };
}

function snippetAt(originalLines: string[], loc: SourceLocation): string {
  return (originalLines[loc.start.line - 1] ?? '').trim();
}

/**
 * Builds FIGM-VUE-01/02's ASTNode set from a `.vue` file's real `<template>` AST. Never throws:
 * `parseVueComponent` already degrades to an undefined templateRoot on a pathological input
 * (matching this codebase's resilience contract for every other real-AST builder), in which case
 * this returns an empty list rather than propagating an exception.
 */
export function buildVueTemplateRealSyntaxNodes(code: string, filePath: string): ASTNode[] {
  const component = parseVueComponent(code, filePath);
  if (!component.templateRoot) return [];

  const nodes: ASTNode[] = [];
  const originalLines = code.split(/\r?\n/);

  walkVueElements(component.templateRoot.children, (el: ElementNode) => {
    const forDir = findDirective(el, 'for');
    if (!forDir) return;

    // FIGM-VUE-01: v-for with no :key, or :key bound to the loop's own index/second-destructured
    // variable — the exact same "unstable key" definition vue-fix-engine.ts's fixVue01 uses (see
    // that function's own comment on why Vue's for-parse result always calls the second
    // positional destructured variable "key" regardless of array/object iteration shape).
    const indexVar = simpleExprContent(forDir.forParseResult?.key);
    const keyDir = findKeyDirective(el);
    const keyContent = keyDir ? simpleExprContent(keyDir.exp) : undefined;
    const keyIsUnstable = !keyDir || (!!indexVar && keyContent === indexVar);
    if (keyIsUnstable) {
      nodes.push({
        type: 'VForElement',
        name: el.tag,
        loc: toFigmLoc(el.loc),
        attributes: { isVForUnstableKey: true, codeSnippet: snippetAt(originalLines, el.loc) },
        sourceKind: 'REAL_AST',
      });
    }

    // FIGM-VUE-02: the same element also carries a v-if directive.
    if (findDirective(el, 'if')) {
      nodes.push({
        type: 'VForElement',
        name: el.tag,
        loc: toFigmLoc(el.loc),
        attributes: { isVForWithVIf: true, codeSnippet: snippetAt(originalLines, el.loc) },
        sourceKind: 'REAL_AST',
      });
    }
  });

  return nodes;
}
