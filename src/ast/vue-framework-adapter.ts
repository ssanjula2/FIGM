/**
 * Framework-Independent Guideline Model (FIGM)
 * Vue Framework Adapter (Phase 04)
 *
 * Unifies the two real ASTs a Vue 3 Single-File Component is actually made of into one per-file
 * view the fix engine can query without caring which sub-parser produced which half:
 *
 *   - the TEMPLATE half: `@vue/compiler-core`'s `RootNode` (via `@vue/compiler-dom`), covering
 *     `<template>` — elements, directives (`v-for`, `v-if`, `:key`, ...), interpolations.
 *   - the SCRIPT half: a real `ts.SourceFile`, covering `<script>`/`<script setup>` — parsed with
 *     the TypeScript Compiler API, the same `ts.createSourceFile(..., ts.ScriptKind.TSX)` call
 *     src/parser/typescript-framework-parser.ts already uses for React/Next/Angular class bodies.
 *
 * This mirrors the role `TypeScriptFrameworkParser` plays for the single-tree frameworks: a
 * consistent adapter surface over a real parser, not a second detection layer. It intentionally
 * does not implement the shared `FrameworkParser<T>` contract from src/parser/framework-parser.ts
 * — a Vue SFC's AST is genuinely two separate trees over two separate sub-languages (template
 * markup vs. script code), not one homogeneous tree that interface assumes.
 */

import * as ts from 'typescript';
import { NodeTypes, type RootNode, type ElementNode, type DirectiveNode, type TemplateChildNode } from '@vue/compiler-dom';
import { parseVueSfc, getPrimaryScriptBlock, lineColumnToOffset } from '../parser/vue-sfc-parser.js';

export interface VueComponentAst {
  /** The full, original .vue file source — every offset below is absolute against this string. */
  raw: string;
  /** `<template>`'s real element/directive AST, or undefined if there is no template block. */
  templateRoot: RootNode | undefined;
  /** The primary script block's real TypeScript AST (`<script setup>` preferred over `<script>`),
   *  or undefined if the component has no script block at all. */
  scriptSourceFile: ts.SourceFile | undefined;
  /** Absolute character offset in `raw` where `scriptSourceFile`'s text begins — add this to any
   *  position from `scriptSourceFile` to get a real offset into `raw`. */
  scriptFileOffset: number;
}

/**
 * Parses a `.vue` file into the unified view above. Never throws: `parseVueSfc` already degrades
 * to `undefined` on a pathological input, and this function mirrors that by returning a
 * `VueComponentAst` with both halves `undefined` rather than propagating an exception — matching
 * the resilience contract every other real-AST module in this codebase follows.
 */
export function parseVueComponent(code: string, filePath: string): VueComponentAst {
  const parsed = parseVueSfc(code, filePath);
  if (!parsed) {
    return { raw: code, templateRoot: undefined, scriptSourceFile: undefined, scriptFileOffset: 0 };
  }

  const templateRoot = parsed.descriptor.template?.ast;

  const scriptBlock = getPrimaryScriptBlock(parsed.descriptor);
  let scriptSourceFile: ts.SourceFile | undefined;
  let scriptFileOffset = 0;
  if (scriptBlock) {
    scriptFileOffset = scriptBlock.loc.start.offset;
    try {
      scriptSourceFile = ts.createSourceFile(filePath, scriptBlock.content, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
    } catch {
      scriptSourceFile = undefined;
    }
  }

  return { raw: code, templateRoot, scriptSourceFile, scriptFileOffset };
}

/** Recursively visits every ElementNode (real HTML/component tags) in the template tree. */
export function walkVueElements(nodes: TemplateChildNode[], onElement: (el: ElementNode) => void): void {
  for (const node of nodes) {
    if (node.type === NodeTypes.ELEMENT) {
      onElement(node);
      walkVueElements(node.children, onElement);
    } else if ('children' in node && Array.isArray((node as { children?: unknown[] }).children)) {
      walkVueElements((node as unknown as { children: TemplateChildNode[] }).children, onElement);
    }
  }
}

/** Finds a directive by its normalized name (e.g. "for", "if") on an element's own props list —
 *  never its DOM attributes (AttributeNode), only real DirectiveNode entries. */
export function findDirective(el: ElementNode, name: string): DirectiveNode | undefined {
  return el.props.find((p): p is DirectiveNode => p.type === NodeTypes.DIRECTIVE && p.name === name);
}

/** Finds a `:key` / `v-bind:key` binding — a DirectiveNode named "bind" whose arg is the static
 *  identifier "key", never a plain `key="literal"` DOM attribute (which Vue does not treat as a
 *  list key at all). */
export function findKeyDirective(el: ElementNode): DirectiveNode | undefined {
  return el.props.find(
    (p): p is DirectiveNode =>
      p.type === NodeTypes.DIRECTIVE && p.name === 'bind' && !!p.arg && p.arg.type === NodeTypes.SIMPLE_EXPRESSION && p.arg.isStatic && p.arg.content === 'key'
  );
}

export { lineColumnToOffset };
