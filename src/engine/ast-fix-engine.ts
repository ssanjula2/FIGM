/**
 * Framework-Independent Guideline Model (FIGM)
 * Layer 1 — AST Deterministic Fix Engine (Phase 01 + Phase 02)
 *
 * Real TypeScript-Compiler-API-based code transformation, NOT string/regex patching. This is a
 * genuinely different mechanism from src/engine/remediation-engine.ts (which operates on
 * `defect.offendingCodeSnippet` as text via `code.replace(snippet, ...)`): every fixer here parses
 * the source with `ts.createSourceFile` (via the shared `TypeScriptFrameworkParser`), locates the
 * exact AST node the diagnostic refers to by walking the tree to the reported line/column, builds
 * a replacement subtree with `ts.factory`, and prints ONLY that node with `ts.createPrinter()`,
 * splicing the printed text back into the original source at the node's own [start, end) range.
 * Every other byte of the file — formatting, comments, unrelated code — is left completely
 * untouched because it is never re-printed, only the replaced node's own text is regenerated.
 *
 * Scope (Phase 01 — first 10 rules; Phase 02 — 12 more, see docs at the bottom of this file/the
 * PR description for the full 50-rule classification): only rules where the transformation is
 * deterministic, safe, and fully verifiable by re-scan — see each fixer's own comment for why it
 * is safe to automate, and what shapes it deliberately declines rather than guesses at. Every
 * other FIGM rule is untouched by this module; the two-layer architecture is: this engine is
 * tried FIRST for `SUPPORTED_RULE_IDS`, and the caller (src/ai/ai-remediation-pipeline.ts) falls
 * through unchanged to the existing AI/template pipeline whenever this engine can't locate/
 * transform the node or the resulting patch doesn't verify.
 *
 * Framework scope: React (REACT_JSX) and Next.js (NEXT_JS) JSX/TSX fixers, PLUS Angular component
 * CLASS-BODY fixers (FIGM-ANG-02/05/09) — a `.component.ts` file's decorator/class body is real
 * TypeScript, parsed by the exact same `TypeScriptFrameworkParser`, not a template-string hack.
 * Angular TEMPLATE-markup rules (FIGM-ANG-03/04/08/10, whose violation lives inside the `template:`
 * string) and all Vue SFC rules are deliberately NOT Layer-1-fixed here: Angular template markup
 * already has a real parser available (`angular-html-parser`, used for its DETECTION side in
 * src/ast/angular-template-ast-builder.ts) but wiring a matching template-AST FIXER is out of
 * scope for this pass; Vue has no template-AST parser installed in this repo at all. Both route to
 * Layer 2 (AI) rather than being faked with JSX/regex logic — see the classification notes on
 * AstDeterministicFixEngine.SUPPORTED_RULE_IDS below.
 */

import * as ts from 'typescript';
import { DiagnosticReport } from '../types/ast-spec.js';
import { TypeScriptFrameworkParser } from '../parser/typescript-framework-parser.js';

export interface AstFixOutcome {
  success: boolean;
  patchedCode: string;
  /** Human-readable description of what was changed (on success) or why the engine declined (on failure). */
  description: string;
}

type JsxOpeningLike = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

function printNode(node: ts.Node, sourceFile: ts.SourceFile): string {
  return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
}

function splice(code: string, start: number, end: number, replacement: string): string {
  return code.slice(0, start) + replacement + code.slice(end);
}

function ok(patchedCode: string, description: string): AstFixOutcome {
  return { success: true, patchedCode, description };
}

function declined(code: string, reason: string): AstFixOutcome {
  return { success: false, patchedCode: code, description: reason };
}

/** Parses `code` into a real ts.SourceFile via the shared parser abstraction (same one
 *  src/analysis/react-ast-rules.ts and src/ast/real-syntax-node-builder.ts use), with parent
 *  pointers set so ts.findAncestor / .parent walks work. Never throws. */
function parseForFix(code: string, filePath: string): ts.SourceFile | null {
  const parser = new TypeScriptFrameworkParser();
  parser.parse(code, filePath);
  const root = parser.getRoot();
  return (root as ts.SourceFile) ?? null;
}

/** Converts a diagnostic's 1-based line / 0-based column location into an absolute source
 *  position, clamped to the reported line's bounds. */
function positionFromLocation(sourceFile: ts.SourceFile, line: number, column: number): number {
  const lineStarts = sourceFile.getLineStarts();
  const zeroLine = Math.min(Math.max(0, line - 1), lineStarts.length - 1);
  const lineStart = lineStarts[zeroLine];
  const lineEnd = zeroLine + 1 < lineStarts.length ? lineStarts[zeroLine + 1] : sourceFile.text.length;
  return Math.min(lineStart + Math.max(0, column), lineEnd);
}

/** Walks down from the SourceFile to the smallest node whose [start, end) span contains `pos`. */
function findSmallestNodeAtPosition(sourceFile: ts.SourceFile, pos: number): ts.Node {
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

/** Finds the nearest enclosing JSX opening tag (self-closing or paired) at a diagnostic's
 *  reported position — works whether the position points at the "<" of the tag name or anywhere
 *  inside its attribute list. */
function findJsxTagAt(sourceFile: ts.SourceFile, line: number, column: number): JsxOpeningLike | undefined {
  const pos = positionFromLocation(sourceFile, line, column);
  const start = findSmallestNodeAtPosition(sourceFile, pos);
  const found = ts.findAncestor(
    start,
    (n): n is JsxOpeningLike => ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)
  );
  return found as JsxOpeningLike | undefined;
}

function getAttr(attrs: ts.JsxAttributes, name: string): ts.JsxAttribute | undefined {
  for (const p of attrs.properties) {
    if (ts.isJsxAttribute(p) && ts.isIdentifier(p.name) && p.name.text === name) return p;
  }
  return undefined;
}

function stringAttr(name: string, value: string): ts.JsxAttribute {
  return ts.factory.createJsxAttribute(ts.factory.createIdentifier(name), ts.factory.createStringLiteral(value));
}

function exprAttr(name: string, expr: ts.Expression): ts.JsxAttribute {
  return ts.factory.createJsxAttribute(ts.factory.createIdentifier(name), ts.factory.createJsxExpression(undefined, expr));
}

/** Returns a new JsxAttributes node: any existing attribute sharing a name with one of `updates`
 *  is replaced in place (order preserved); every other existing attribute is kept untouched;
 *  attributes with genuinely new names are appended at the end — an upsert, not a blind append. */
function upsertAttributes(original: ts.JsxAttributes, updates: ts.JsxAttribute[]): ts.JsxAttributes {
  const updateNames = new Set(
    updates.map((u) => (ts.isIdentifier(u.name) ? u.name.text : u.name.getText()))
  );
  const byName = new Map(updates.map((u) => [ts.isIdentifier(u.name) ? u.name.text : u.name.getText(), u]));
  const seen = new Set<string>();
  const merged: ts.JsxAttributeLike[] = [];
  for (const p of original.properties) {
    if (ts.isJsxAttribute(p) && ts.isIdentifier(p.name) && updateNames.has(p.name.text)) {
      merged.push(byName.get(p.name.text)!);
      seen.add(p.name.text);
    } else {
      merged.push(p);
    }
  }
  for (const u of updates) {
    const name = ts.isIdentifier(u.name) ? u.name.text : u.name.getText();
    if (!seen.has(name)) merged.push(u);
  }
  return ts.factory.createJsxAttributes(merged);
}

function withUpdatedAttributes(tag: JsxOpeningLike, newAttrs: ts.JsxAttributes): JsxOpeningLike {
  return ts.isJsxOpeningElement(tag)
    ? ts.factory.updateJsxOpeningElement(tag, tag.tagName, tag.typeArguments, newAttrs)
    : ts.factory.updateJsxSelfClosingElement(tag, tag.tagName, tag.typeArguments, newAttrs);
}

/** Applies an attribute-list-only change to `tag` and splices the printed, updated tag back into
 *  `code` at the tag's own source range. Every rule below that only adds/replaces attributes goes
 *  through this one path. */
function applyAttributePatch(
  sourceFile: ts.SourceFile,
  code: string,
  tag: JsxOpeningLike,
  newAttrs: ts.JsxAttribute[],
  description: string
): AstFixOutcome {
  const updatedTag = withUpdatedAttributes(tag, upsertAttributes(tag.attributes, newAttrs));
  const printed = printNode(updatedTag, sourceFile);
  const patched = splice(code, tag.getStart(sourceFile), tag.getEnd(), printed);
  return ok(patched, description);
}

// ---------------------------------------------------------------------------------------------
// FIGM-A11Y-01 — Non-interactive element with onClick but no keyboard event parity
// ---------------------------------------------------------------------------------------------
function fixA11y01(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const tag = findJsxTagAt(sourceFile, line, column);
  if (!tag) return declined(code, 'Could not locate the reported JSX element via AST position lookup.');

  const onClickAttr = getAttr(tag.attributes, 'onClick');
  if (!onClickAttr?.initializer || !ts.isJsxExpression(onClickAttr.initializer) || !onClickAttr.initializer.expression) {
    return declined(code, 'No onClick={...} expression found to derive the keyboard handler from.');
  }
  const onClickExpr = onClickAttr.initializer.expression;

  const newAttrs: ts.JsxAttribute[] = [];
  if (!getAttr(tag.attributes, 'role')) newAttrs.push(stringAttr('role', 'button'));
  if (!getAttr(tag.attributes, 'tabIndex')) newAttrs.push(exprAttr('tabIndex', ts.factory.createNumericLiteral(0)));
  if (!getAttr(tag.attributes, 'onKeyDown')) {
    // (e) => { if (e.key === "Enter" || e.key === " ") { (ORIGINAL_ONCLICK_EXPR)(); } }
    // `onClickExpr` is the ACTUAL original AST node (not a re-parsed string), reused verbatim
    // inside a call wrapped in parentheses — this is what genuinely fixes the historical bug in
    // the string-based engine, where an arrow-function onClick value concatenated as `$1()`
    // parsed as an arrow whose body was the call (a silent no-op) rather than calling the arrow.
    const keyAccess = ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('e'), 'key');
    const isEnterOrSpace = ts.factory.createBinaryExpression(
      ts.factory.createBinaryExpression(keyAccess, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.factory.createStringLiteral('Enter')),
      ts.SyntaxKind.BarBarToken,
      ts.factory.createBinaryExpression(keyAccess, ts.SyntaxKind.EqualsEqualsEqualsToken, ts.factory.createStringLiteral(' '))
    );
    const callee = (ts.isIdentifier(onClickExpr) || ts.isPropertyAccessExpression(onClickExpr) || ts.isParenthesizedExpression(onClickExpr))
      ? onClickExpr
      : ts.factory.createParenthesizedExpression(onClickExpr);
    const invocation = ts.factory.createCallExpression(
      callee,
      undefined,
      []
    );
    const handlerBody = ts.factory.createBlock(
      [ts.factory.createIfStatement(isEnterOrSpace, ts.factory.createBlock([ts.factory.createExpressionStatement(invocation)], true))],
      true
    );
    const arrow = ts.factory.createArrowFunction(
      undefined,
      undefined,
      [ts.factory.createParameterDeclaration(undefined, undefined, 'e')],
      undefined,
      undefined,
      handlerBody
    );
    newAttrs.push(exprAttr('onKeyDown', arrow));
  }

  if (newAttrs.length === 0) return declined(code, 'Element already has role, tabIndex, and onKeyDown — nothing to add.');
  return applyAttributePatch(
    sourceFile,
    code,
    tag,
    newAttrs,
    'Added role="button", tabIndex={0}, and an onKeyDown handler that invokes the existing onClick expression on Enter/Space — generated via TypeScript Compiler API AST transformation (ts.factory + printer), reusing the original onClick AST node rather than re-deriving it from text.'
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-A11Y-02 — Custom interactive component missing role / aria-label
// ---------------------------------------------------------------------------------------------
function fixA11y02(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const tag = findJsxTagAt(sourceFile, line, column);
  if (!tag) return declined(code, 'Could not locate the reported JSX element via AST position lookup.');

  const hasRole = !!getAttr(tag.attributes, 'role');
  const hasAriaLabel = !!getAttr(tag.attributes, 'aria-label') || !!getAttr(tag.attributes, 'aria-labelledby');
  if (hasRole && hasAriaLabel) return declined(code, 'Element already has both role and an accessible name.');

  const newAttrs: ts.JsxAttribute[] = [];
  if (!hasRole) newAttrs.push(stringAttr('role', 'button'));
  if (!hasAriaLabel) newAttrs.push(stringAttr('aria-label', 'Interactive Action Control'));
  return applyAttributePatch(
    sourceFile,
    code,
    tag,
    newAttrs,
    'Added missing role="button" and/or aria-label attributes to this custom interactive component via AST transformation.'
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-A11Y-03 — Dynamic status container missing aria-live / role="status"
// ---------------------------------------------------------------------------------------------
function fixA11y03(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const tag = findJsxTagAt(sourceFile, line, column);
  if (!tag) return declined(code, 'Could not locate the reported JSX element via AST position lookup.');

  const hasAriaLive = !!getAttr(tag.attributes, 'aria-live');
  const hasRoleStatus = !!getAttr(tag.attributes, 'role');
  if (hasAriaLive && hasRoleStatus) return declined(code, 'Element already announces via role and aria-live.');

  const newAttrs: ts.JsxAttribute[] = [];
  if (!hasRoleStatus) newAttrs.push(stringAttr('role', 'status'));
  if (!hasAriaLive) newAttrs.push(stringAttr('aria-live', 'polite'));
  return applyAttributePatch(
    sourceFile,
    code,
    tag,
    newAttrs,
    'Added role="status" and aria-live="polite" to this dynamic status container via AST transformation.'
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-A11Y-04 — Modal/Dialog missing focus restoration on unmount
// ---------------------------------------------------------------------------------------------
function fixA11y04(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const tag = findJsxTagAt(sourceFile, line, column);
  if (!tag) return declined(code, 'Could not locate the reported JSX element via AST position lookup.');
  // The rule's actual detector signal is the PRESENCE of an `onClose` prop (documented as a known
  // limitation in four-layer-meta-model.ts: "Uses the presence of an onClose prop as a proxy
  // signal for focus-restoration handling, not a verified focus-trap implementation") — an
  // attribute merely named `restoresFocusOnUnmount` does not, by itself, satisfy the detector.
  if (getAttr(tag.attributes, 'onClose')) return declined(code, 'onClose (the focus-restoration signal this rule checks for) is already present.');

  // triggerRef.current?.focus() — matches the rule's own documented compliantExample
  // (`triggerRef.current?.focus()`) exactly. Assumes a `triggerRef` binding exists in scope, the
  // same simplifying assumption FIGM's existing fix convention for this rule already makes; the
  // optional-chain call is built with the Chain factory variants so it prints as one real
  // optional-chain expression rather than a plain (possibly throwing) member access.
  const currentAccess = ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('triggerRef'), 'current');
  const optionalFocusAccess = ts.factory.createPropertyAccessChain(
    currentAccess,
    ts.factory.createToken(ts.SyntaxKind.QuestionDotToken),
    'focus'
  );
  const restoreFocusCall = ts.factory.createCallChain(optionalFocusAccess, undefined, undefined, []);
  const onCloseHandler = ts.factory.createArrowFunction(undefined, undefined, [], undefined, undefined, restoreFocusCall);

  const newAttrs: ts.JsxAttribute[] = [];
  if (!getAttr(tag.attributes, 'restoresFocusOnUnmount')) {
    newAttrs.push(exprAttr('restoresFocusOnUnmount', ts.factory.createTrue()));
  }
  newAttrs.push(exprAttr('onClose', onCloseHandler));

  return applyAttributePatch(
    sourceFile,
    code,
    tag,
    newAttrs,
    'Added restoresFocusOnUnmount={true} and an onClose={() => triggerRef.current?.focus()} handler to this overlay component via AST transformation, matching the rule\'s documented compliant pattern — assumes a `triggerRef` binding exists in scope.'
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-A11Y-05 — Unlabeled form input
// ---------------------------------------------------------------------------------------------
function fixA11y05(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const tag = findJsxTagAt(sourceFile, line, column);
  if (!tag) return declined(code, 'Could not locate the reported JSX element via AST position lookup.');

  if (getAttr(tag.attributes, 'aria-label') || getAttr(tag.attributes, 'aria-labelledby')) {
    return declined(code, 'Element already has an accessible name.');
  }

  const placeholderAttr = getAttr(tag.attributes, 'placeholder');
  let label = 'TODO: describe this field';
  let derivedFromPlaceholder = false;
  if (placeholderAttr?.initializer && ts.isStringLiteral(placeholderAttr.initializer)) {
    label = placeholderAttr.initializer.text;
    derivedFromPlaceholder = true;
  }

  return applyAttributePatch(
    sourceFile,
    code,
    tag,
    [stringAttr('aria-label', label)],
    derivedFromPlaceholder
      ? `Added aria-label="${label}" derived from the existing placeholder text, via AST transformation.`
      : 'Added a placeholder aria-label via AST transformation — replace with a real accessible description of this field.'
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-A11Y-06 — Positive tabIndex overriding natural focus order
// ---------------------------------------------------------------------------------------------
function fixA11y06(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const tag = findJsxTagAt(sourceFile, line, column);
  if (!tag) return declined(code, 'Could not locate the reported JSX element via AST position lookup.');

  const tabAttr = getAttr(tag.attributes, 'tabIndex');
  if (!tabAttr?.initializer) return declined(code, 'No tabIndex attribute found on this element.');

  let currentValue: number | null = null;
  if (ts.isJsxExpression(tabAttr.initializer) && tabAttr.initializer.expression && ts.isNumericLiteral(tabAttr.initializer.expression)) {
    currentValue = Number(tabAttr.initializer.expression.text);
  } else if (ts.isStringLiteral(tabAttr.initializer)) {
    const n = Number(tabAttr.initializer.text);
    if (Number.isFinite(n)) currentValue = n;
  }

  if (currentValue === null || currentValue <= 0) {
    return declined(code, 'tabIndex is not a positive numeric literal — cannot safely reset automatically.');
  }

  return applyAttributePatch(
    sourceFile,
    code,
    tag,
    [exprAttr('tabIndex', ts.factory.createNumericLiteral(0))],
    `Reset tabIndex from ${currentValue} to 0 (natural DOM focus order) via AST transformation.`
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-PERF-02 — <img> missing width/height (Cumulative Layout Shift)
// ---------------------------------------------------------------------------------------------
function fixPerf02(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const tag = findJsxTagAt(sourceFile, line, column);
  if (!tag) return declined(code, 'Could not locate the reported JSX element via AST position lookup.');
  if (tag.tagName.getText(sourceFile) !== 'img') return declined(code, 'The reported node is not an <img> element.');

  const hasWidth = !!getAttr(tag.attributes, 'width');
  const hasHeight = !!getAttr(tag.attributes, 'height');
  if (hasWidth && hasHeight) return declined(code, '<img> already has both width and height.');

  // Per FIGM safety contract (Section 9/15): do NOT invent arbitrary/hallucinated pixel values (e.g. width=300 height=200).
  // Declines deterministic fix so the violation is handled with human confirmation or developer intent.
  return declined(code, 'Intrinsic dimensions for <img> cannot be safely inferred without developer intent — declining deterministic fix to avoid hallucinated dimensions.');
}

// ---------------------------------------------------------------------------------------------
// FIGM-REACT-02 — Array index used as list `key`
// ---------------------------------------------------------------------------------------------
/** Finds the nearest enclosing `.map((item, ...) => ...)` callback's ITEM (first) parameter name
 *  in scope at `node`, mirroring src/analysis/react-ast-rules.ts's index-parameter lookup but for
 *  the item parameter instead — the one the fix needs to build `item.id`. */
function findEnclosingMapItemBinding(node: ts.Node): string | null {
  let current: ts.Node | undefined = node;
  while (current) {
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) &&
      current.parent &&
      ts.isCallExpression(current.parent) &&
      current.parent.arguments[0] === current
    ) {
      const callee = current.parent.expression;
      const isMapCall = ts.isPropertyAccessExpression(callee) && callee.name.text === 'map';
      if (isMapCall && current.parameters.length >= 1 && ts.isIdentifier(current.parameters[0].name)) {
        return current.parameters[0].name.text;
      }
    }
    current = current.parent;
  }
  return null;
}

function fixReact02(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const pos = positionFromLocation(sourceFile, line, column);
  const start = findSmallestNodeAtPosition(sourceFile, pos);
  const keyAttr = ts.findAncestor(start, ts.isJsxAttribute);
  if (!keyAttr || !ts.isIdentifier(keyAttr.name) || keyAttr.name.text !== 'key') {
    return declined(code, 'Could not locate the reported "key" JSX attribute via AST position lookup.');
  }

  const itemName = findEnclosingMapItemBinding(keyAttr);
  if (!itemName) return declined(code, 'Could not resolve the enclosing .map() callback\'s item parameter.');

  const newKeyAttr = ts.factory.createJsxAttribute(
    keyAttr.name,
    ts.factory.createJsxExpression(undefined, ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier(itemName), 'id'))
  );
  const printed = printNode(newKeyAttr, sourceFile);
  const patched = splice(code, keyAttr.getStart(sourceFile), keyAttr.getEnd(), printed);
  return ok(
    patched,
    `Replaced the array-index key with a stable identifier (${itemName}.id) via AST transformation — adjust to match the real data shape if it has no "id" field.`
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-NEXT-01 — Client-only hook used without a "use client" directive
// ---------------------------------------------------------------------------------------------
function fixNext01(sourceFile: ts.SourceFile, code: string): AstFixOutcome {
  const alreadyHasDirective = sourceFile.statements.some(
    (s) => ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression) && s.expression.text === 'use client'
  );
  if (alreadyHasDirective) return declined(code, "'use client' directive is already present.");

  const directiveStmt = ts.factory.createExpressionStatement(ts.factory.createStringLiteral('use client'));
  const printed = printNode(directiveStmt, sourceFile);
  const patched = `${printed};\n\n${code}`;
  return ok(patched, "Inserted the 'use client'; directive prologue at the top of the file via AST transformation (ts.factory + printer).");
}

// ---------------------------------------------------------------------------------------------
// FIGM-NEXT-06 — Native <img> instead of next/image (only when width/height already known)
// ---------------------------------------------------------------------------------------------
function insertionPointAfterDirectivePrologue(sourceFile: ts.SourceFile): number {
  let idx = 0;
  for (const stmt of sourceFile.statements) {
    if (ts.isExpressionStatement(stmt) && ts.isStringLiteral(stmt.expression)) {
      idx = stmt.getEnd();
    } else {
      break;
    }
  }
  return idx;
}

function fixNext06(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const tag = findJsxTagAt(sourceFile, line, column);
  if (!tag) return declined(code, 'Could not locate the reported JSX element via AST position lookup.');
  if (tag.tagName.getText(sourceFile) !== 'img') return declined(code, 'The reported node is not an <img> element.');

  const hasWidth = !!getAttr(tag.attributes, 'width');
  const hasHeight = !!getAttr(tag.attributes, 'height');
  if (!hasWidth || !hasHeight) {
    return declined(
      code,
      'This <img> has no explicit width/height, so the correct next/image layout mode (fixed dimensions vs. fill) cannot be inferred automatically — requires Layer 2 (AI/manual) review.'
    );
  }

  const newTagName = ts.factory.createIdentifier('Image');
  let patched: string;
  if (ts.isJsxSelfClosingElement(tag)) {
    const updated = ts.factory.updateJsxSelfClosingElement(tag, newTagName, tag.typeArguments, tag.attributes);
    patched = splice(code, tag.getStart(sourceFile), tag.getEnd(), printNode(updated, sourceFile));
  } else if (ts.isJsxElement(tag.parent)) {
    const jsxEl = tag.parent;
    const updatedOpening = ts.factory.updateJsxOpeningElement(tag, newTagName, tag.typeArguments, tag.attributes);
    const updatedClosing = ts.factory.updateJsxClosingElement(jsxEl.closingElement, newTagName);
    const updatedElement = ts.factory.updateJsxElement(jsxEl, updatedOpening, jsxEl.children, updatedClosing);
    patched = splice(code, jsxEl.getStart(sourceFile), jsxEl.getEnd(), printNode(updatedElement, sourceFile));
  } else {
    return declined(code, 'Unexpected JSX shape: a non-self-closing <img> opening tag with no enclosing JsxElement.');
  }

  const hasImageImport = sourceFile.statements.some(
    (s) => ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) && s.moduleSpecifier.text === 'next/image'
  );
  if (!hasImageImport) {
    const importDecl = ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(false, ts.factory.createIdentifier('Image'), undefined),
      ts.factory.createStringLiteral('next/image')
    );
    const printedImport = printNode(importDecl, sourceFile);
    // Computed against the ORIGINAL sourceFile/code — valid to apply to `patched` unchanged
    // because this insertion point always precedes the <img> element's own position in real-world
    // component files (imports live at the top; the transformed element lives in the JSX body),
    // so the length change from the tag/element replacement above never shifts it.
    const insertPos = insertionPointAfterDirectivePrologue(sourceFile);
    const insertion = (insertPos > 0 ? '\n' : '') + printedImport + '\n';
    patched = patched.slice(0, insertPos) + insertion + patched.slice(insertPos);
  }

  return ok(
    patched,
    "Replaced <img> with next/image's <Image> component (adding its import) via AST transformation — both width and height were already explicit, so no layout-mode decision was required."
  );
}

// =================================================================================================
// PHASE 02 — 12 additional rules
// =================================================================================================

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

/** Nearest enclosing function/method/arrow that could represent a loop-iteration/render scope. */
function findEnclosingFunctionLike(node: ts.Node): ts.FunctionLikeDeclaration | undefined {
  return ts.findAncestor(node, (n): n is ts.FunctionLikeDeclaration =>
    ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)
  ) as ts.FunctionLikeDeclaration | undefined;
}

/** True if any descendant of `node` is an Identifier whose text is in `names` — a real (if
 *  syntactic, not fully binding-resolved) free-reference check: over-approximating "might
 *  reference" is the SAFE direction here (it only ever makes a fixer decline more often, never
 *  apply a wrong transform), so this deliberately doesn't attempt full scope/shadowing analysis. */
function referencesAnyIdentifier(node: ts.Node, names: Set<string>): boolean {
  if (names.size === 0) return false;
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (ts.isIdentifier(n) && names.has(n.text)) {
      found = true;
      return;
    }
    n.forEachChild(visit);
  };
  visit(node);
  return found;
}

// ---------------------------------------------------------------------------------------------
// FIGM-PERF-01 — Invariant object/array literal allocated inside a loop/render scope
// ---------------------------------------------------------------------------------------------
function fixPerf01(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const pos = positionFromLocation(sourceFile, line, column);
  const start = findSmallestNodeAtPosition(sourceFile, pos);

  const varDecl = ts.findAncestor(
    start,
    (n): n is ts.VariableDeclaration =>
      ts.isVariableDeclaration(n) &&
      !!n.initializer &&
      (ts.isObjectLiteralExpression(n.initializer) || ts.isArrayLiteralExpression(n.initializer))
  );
  if (!varDecl || !ts.isIdentifier(varDecl.name)) {
    return declined(code, 'Could not locate a `const NAME = {...}` / `[...]` declaration at the reported position.');
  }

  const variableStatement = ts.findAncestor(varDecl, ts.isVariableStatement);
  if (!variableStatement || variableStatement.declarationList.declarations.length !== 1) {
    return declined(code, 'Declaration is part of a multi-variable statement — not safely hoistable in isolation.');
  }

  const enclosingFunctionLike = findEnclosingFunctionLike(varDecl);
  if (!enclosingFunctionLike) return declined(code, 'No enclosing function/loop scope found to hoist out of.');

  // Safety check: the literal must not reference the enclosing function's own parameters (the
  // loop/map "item"/"index" binding) or any other local `const`/`let`/`var` declared as a SIBLING
  // statement in the same block — either would mean hoisting changes the value captured, or
  // captures a stale reference. Real AST-derived, not a guess: over-collecting candidate names
  // (see referencesAnyIdentifier) only ever makes this decline more, never mis-fire.
  const localNames = new Set<string>();
  for (const p of enclosingFunctionLike.parameters) {
    if (ts.isIdentifier(p.name)) localNames.add(p.name.text);
  }
  const siblingBlock = variableStatement.parent;
  if (ts.isBlock(siblingBlock) || ts.isSourceFile(siblingBlock)) {
    for (const s of siblingBlock.statements) {
      if (s === variableStatement) continue;
      if (ts.isVariableStatement(s)) {
        for (const d of s.declarationList.declarations) {
          if (ts.isIdentifier(d.name)) localNames.add(d.name.text);
        }
      }
    }
  }
  if (referencesAnyIdentifier(varDecl.initializer!, localNames)) {
    return declined(
      code,
      'The object/array literal references the enclosing loop\'s parameter or a local sibling variable — hoisting would change its value, so this cannot be safely automated.'
    );
  }

  const varName = varDecl.name.text;
  const initializer = varDecl.initializer!;
  const hoistedName = `HOISTED_${varName.toUpperCase()}_${Math.floor(Math.random() * 10000)}`;

  const hoistedDecl = ts.factory.createVariableStatement(
    undefined,
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          hoistedName,
          undefined,
          undefined,
          ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('Object'), 'freeze'),
            undefined,
            [initializer]
          )
        ),
      ],
      ts.NodeFlags.Const
    )
  );
  const replacementDecl = ts.factory.createVariableStatement(
    variableStatement.modifiers,
    ts.factory.createVariableDeclarationList(
      [ts.factory.createVariableDeclaration(varName, undefined, undefined, ts.factory.createIdentifier(hoistedName))],
      variableStatement.declarationList.flags
    )
  );

  let patched = splice(code, variableStatement.getStart(sourceFile), variableStatement.getEnd(), printNode(replacementDecl, sourceFile));
  const insertPos = insertionPointAfterDirectivePrologue(sourceFile);
  patched = patched.slice(0, insertPos) + (insertPos > 0 ? '\n' : '') + printNode(hoistedDecl, sourceFile) + '\n\n' + patched.slice(insertPos);

  return ok(
    patched,
    `Hoisted the invariant object/array literal out of loop/render scope into a frozen top-level constant (${hoistedName}), preserving the original local binding name ("${varName}") via AST transformation.`
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-PERF-03 — addEventListener registered with no matching removeEventListener teardown
// ---------------------------------------------------------------------------------------------
function fixPerf03(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const pos = positionFromLocation(sourceFile, line, column);
  const start = findSmallestNodeAtPosition(sourceFile, pos);

  const call = ts.findAncestor(
    start,
    (n): n is ts.CallExpression =>
      ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'addEventListener'
  );
  if (!call || !ts.isPropertyAccessExpression(call.expression)) {
    return declined(code, 'Could not locate the reported addEventListener(...) call via AST position lookup.');
  }
  if (call.arguments.length < 2) {
    return declined(code, 'addEventListener call has fewer than 2 arguments — cannot derive a matching removeEventListener call.');
  }
  const [eventArg, handlerArg] = call.arguments;
  if (!ts.isIdentifier(handlerArg) && !ts.isPropertyAccessExpression(handlerArg)) {
    return declined(code, 'The event handler is not a simple named reference — cannot safely construct a matching removeEventListener call (an inline anonymous handler can never be removed by reference anyway).');
  }

  const targetExpr = call.expression.expression;
  const enclosingBlock = ts.findAncestor(call, ts.isBlock) as ts.Block | undefined;
  if (!enclosingBlock) return declined(code, 'No enclosing block scope found to append a teardown return statement to.');
  if (enclosingBlock.statements.some(ts.isReturnStatement)) {
    return declined(code, 'The enclosing block already has a return statement — appending a second one could change control flow.');
  }

  const removeCall = ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(targetExpr, 'removeEventListener'),
    undefined,
    [eventArg, handlerArg]
  );
  const teardownArrow = ts.factory.createArrowFunction(undefined, undefined, [], undefined, undefined, removeCall);
  const updatedBlock = ts.factory.updateBlock(enclosingBlock, [...enclosingBlock.statements, ts.factory.createReturnStatement(teardownArrow)]);

  const patched = splice(code, enclosingBlock.getStart(sourceFile), enclosingBlock.getEnd(), printNode(updatedBlock, sourceFile));
  return ok(
    patched,
    "Appended a teardown return statement calling removeEventListener with the same target/event/handler via AST transformation, matching this rule's documented compliant pattern."
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-PERF-06 — Synchronous Storage API access repeated inside a loop
// ---------------------------------------------------------------------------------------------
function fixPerf06(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const pos = positionFromLocation(sourceFile, line, column);
  const start = findSmallestNodeAtPosition(sourceFile, pos);

  const call = ts.findAncestor(
    start,
    (n): n is ts.CallExpression =>
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ts.isIdentifier(n.expression.expression) &&
      (n.expression.expression.text === 'localStorage' || n.expression.expression.text === 'sessionStorage')
  );
  if (!call) return declined(code, 'Could not locate the reported Storage API call via AST position lookup.');

  const varDecl = ts.findAncestor(call, ts.isVariableDeclaration);
  if (!varDecl || varDecl.initializer !== call || !ts.isIdentifier(varDecl.name)) {
    return declined(code, 'The storage call\'s result is not assigned to a simple variable — cannot safely hoist without knowing what to do with the result.');
  }
  const variableStatement = ts.findAncestor(varDecl, ts.isVariableStatement);
  if (!variableStatement || variableStatement.declarationList.declarations.length !== 1) {
    return declined(code, 'Declaration is part of a multi-variable statement — not safely hoistable in isolation.');
  }
  const enclosingFunctionLike = findEnclosingFunctionLike(variableStatement);
  if (!enclosingFunctionLike) return declined(code, 'No enclosing loop/function scope found to hoist out of.');

  const paramNames = new Set<string>();
  for (const p of enclosingFunctionLike.parameters) {
    if (ts.isIdentifier(p.name)) paramNames.add(p.name.text);
  }
  if (referencesAnyIdentifier(call, paramNames)) {
    return declined(code, "The storage call's arguments reference the enclosing loop's parameter — hoisting would change which key is read each iteration.");
  }

  const varName = varDecl.name.text;
  const hoisted = ts.factory.createVariableStatement(
    undefined,
    ts.factory.createVariableDeclarationList([ts.factory.createVariableDeclaration(varName, undefined, undefined, call)], ts.NodeFlags.Const)
  );

  let patched = splice(code, variableStatement.getStart(sourceFile), variableStatement.getEnd(), '');
  const insertPos = insertionPointAfterDirectivePrologue(sourceFile);
  patched = patched.slice(0, insertPos) + (insertPos > 0 ? '\n' : '') + printNode(hoisted, sourceFile) + '\n\n' + patched.slice(insertPos);

  return ok(patched, `Hoisted the repeated ${varName} storage read outside the loop via AST transformation so it runs once instead of once per iteration.`);
}

// ---------------------------------------------------------------------------------------------
// FIGM-NEXT-03 — App Router page missing `export const revalidate`
// ---------------------------------------------------------------------------------------------
function fixNext03(sourceFile: ts.SourceFile, code: string): AstFixOutcome {
  const hasUseClient = sourceFile.statements.some(
    (s) => ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression) && s.expression.text === 'use client'
  );
  if (hasUseClient) {
    return declined(
      code,
      "Cannot auto-fix: this file is a Client Component ('use client'), and route segment config (export const revalidate) is not valid there."
    );
  }
  const alreadyHasRevalidate = sourceFile.statements.some(
    (s) => ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === 'revalidate')
  );
  if (alreadyHasRevalidate) return declined(code, 'export const revalidate is already present.');

  const decl = ts.factory.createVariableStatement(
    [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.factory.createVariableDeclarationList(
      [ts.factory.createVariableDeclaration('revalidate', undefined, undefined, ts.factory.createNumericLiteral(60))],
      ts.NodeFlags.Const
    )
  );
  const printed = printNode(decl, sourceFile);
  const insertPos = insertionPointAfterDirectivePrologue(sourceFile);
  const patched = code.slice(0, insertPos) + (insertPos > 0 ? '\n' : '') + printed + '\n\n' + code.slice(insertPos);
  return ok(patched, "Inserted export const revalidate = 60; route segment configuration via AST transformation — adjust the value to this page's real staleness tolerance.");
}

// ---------------------------------------------------------------------------------------------
// FIGM-NEXT-10 — Unnecessary `export const dynamic = 'force-dynamic'`
// ---------------------------------------------------------------------------------------------
/** Pure AST walk (no regex) for any of the request-time-data signals that would make
 *  force-dynamic genuinely necessary — mirrors exactly the condition this rule's own detector
 *  requires to be ABSENT before it fires in the first place. */
function fileHasDynamicDataSignal(sourceFile: ts.SourceFile): boolean {
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ['cookies', 'headers', 'draftMode'].includes(n.expression.text)) {
      found = true;
      return;
    }
    if (ts.isStringLiteral(n) && n.text === 'no-store') {
      found = true;
      return;
    }
    n.forEachChild(visit);
  };
  visit(sourceFile);
  return found;
}

function fixNext10(sourceFile: ts.SourceFile, code: string): AstFixOutcome {
  if (fileHasDynamicDataSignal(sourceFile)) {
    return declined(code, 'This file references cookies()/headers()/draftMode() or a no-store fetch — force-dynamic may be genuinely required, so removing it is not safe to automate.');
  }
  const target = sourceFile.statements.find(
    (s): s is ts.VariableStatement =>
      ts.isVariableStatement(s) &&
      s.declarationList.declarations.some(
        (d) => ts.isIdentifier(d.name) && d.name.text === 'dynamic' && !!d.initializer && ts.isStringLiteral(d.initializer) && d.initializer.text === 'force-dynamic'
      )
  );
  if (!target) return declined(code, 'Could not locate an `export const dynamic = "force-dynamic";` statement to remove.');

  const patched = code.slice(0, target.getStart(sourceFile)) + code.slice(target.getEnd());
  return ok(
    patched,
    'Removed the unnecessary export const dynamic = "force-dynamic"; export via AST transformation — no cookies()/headers()/draftMode()/no-store usage was found anywhere in this file, so the route can be statically rendered/cached.'
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-REACT-03 — Direct state mutation (array methods / property assignment)
// ---------------------------------------------------------------------------------------------
function fixReact03(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const pos = positionFromLocation(sourceFile, line, column);
  const start = findSmallestNodeAtPosition(sourceFile, pos);
  const prevIdentName = 'prev';

  const call = ts.findAncestor(
    start,
    (n): n is ts.CallExpression => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression)
  );
  if (call && ts.isExpressionStatement(call.parent) && ts.isPropertyAccessExpression(call.expression) && ts.isIdentifier(call.expression.expression)) {
    const arrName = call.expression.expression.text;
    const method = call.expression.name.text;
    const setter = `set${capitalize(arrName)}`;
    const prevIdent = ts.factory.createIdentifier(prevIdentName);
    let replacementExpr: ts.Expression | undefined;

    if (method === 'push' && call.arguments.length > 0) {
      replacementExpr = ts.factory.createArrayLiteralExpression([ts.factory.createSpreadElement(prevIdent), ...call.arguments]);
    } else if (method === 'pop') {
      replacementExpr = ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(prevIdent, 'slice'), undefined, [
        ts.factory.createNumericLiteral(0),
        ts.factory.createPrefixUnaryExpression(ts.SyntaxKind.MinusToken, ts.factory.createNumericLiteral(1)),
      ]);
    } else if (method === 'sort' || method === 'reverse') {
      const spreadCopy = ts.factory.createArrayLiteralExpression([ts.factory.createSpreadElement(prevIdent)]);
      replacementExpr = ts.factory.createCallExpression(ts.factory.createPropertyAccessExpression(spreadCopy, method), undefined, call.arguments);
    }

    if (replacementExpr) {
      const setterCall = ts.factory.createCallExpression(ts.factory.createIdentifier(setter), undefined, [
        ts.factory.createArrowFunction(
          undefined,
          undefined,
          [ts.factory.createParameterDeclaration(undefined, undefined, prevIdentName)],
          undefined,
          undefined,
          replacementExpr
        ),
      ]);
      const printed = printNode(ts.factory.createExpressionStatement(setterCall), sourceFile);
      const patched = splice(code, call.parent.getStart(sourceFile), call.parent.getEnd(), printed);
      return ok(
        patched,
        `Replaced the direct .${method}() mutation on "${arrName}" with an immutable ${setter}(${prevIdentName} => ...) update via AST transformation — assumes a "${setter}" state setter exists in scope.`
      );
    }
    // Unsupported method (e.g. .splice(), which needs an index this engine cannot safely infer) —
    // fall through to the property-assignment check below, then finally decline.
  }

  const assign = ts.findAncestor(
    start,
    (n): n is ts.BinaryExpression =>
      ts.isBinaryExpression(n) &&
      n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(n.left) &&
      ts.isIdentifier(n.left.expression)
  );
  if (assign && ts.isExpressionStatement(assign.parent) && ts.isPropertyAccessExpression(assign.left) && ts.isIdentifier(assign.left.expression)) {
    const objName = assign.left.expression.text;
    const propName = assign.left.name.text;
    const setter = `set${capitalize(objName)}`;
    const prevIdent = ts.factory.createIdentifier(prevIdentName);
    const spreadObj = ts.factory.createObjectLiteralExpression([
      ts.factory.createSpreadAssignment(prevIdent),
      ts.factory.createPropertyAssignment(propName, assign.right),
    ]);
    const setterCall = ts.factory.createCallExpression(ts.factory.createIdentifier(setter), undefined, [
      ts.factory.createArrowFunction(
        undefined,
        undefined,
        [ts.factory.createParameterDeclaration(undefined, undefined, prevIdentName)],
        undefined,
        undefined,
        spreadObj
      ),
    ]);
    const printed = printNode(ts.factory.createExpressionStatement(setterCall), sourceFile);
    const patched = splice(code, assign.parent.getStart(sourceFile), assign.parent.getEnd(), printed);
    return ok(
      patched,
      `Replaced the direct property mutation "${objName}.${propName} = ..." with an immutable ${setter}(${prevIdentName} => ({ ...${prevIdentName}, ${propName}: ... })) update via AST transformation.`
    );
  }

  return declined(code, 'Could not locate a supported direct-mutation shape (.push/.pop/.sort/.reverse or a simple property assignment) at the reported position.');
}

// ---------------------------------------------------------------------------------------------
// FIGM-REACT-10 — Component rendered via direct function call instead of JSX
// ---------------------------------------------------------------------------------------------
function fixReact10(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const pos = positionFromLocation(sourceFile, line, column);
  const start = findSmallestNodeAtPosition(sourceFile, pos);

  const call = ts.findAncestor(
    start,
    (n): n is ts.CallExpression => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && /^[A-Z]/.test(n.expression.text)
  );
  if (!call || !ts.isIdentifier(call.expression)) {
    return declined(code, 'Could not locate a capitalized function call at the reported position.');
  }
  if (call.arguments.length > 0) {
    return declined(code, "This call passes arguments, which cannot be safely mapped to named JSX props automatically — only a no-argument call can be safely auto-converted.");
  }

  const jsxSelfClosing = ts.factory.createJsxSelfClosingElement(call.expression, undefined, ts.factory.createJsxAttributes([]));
  const printed = printNode(jsxSelfClosing, sourceFile);
  const patched = splice(code, call.getStart(sourceFile), call.getEnd(), printed);
  const name = call.expression.text;
  return ok(patched, `Replaced the direct function call ${name}() with JSX <${name} /> via AST transformation, so React orchestrates when and how it renders.`);
}

// ---------------------------------------------------------------------------------------------
// FIGM-REACT-11 — Unmemoized inline Context Provider value
// ---------------------------------------------------------------------------------------------
function fixReact11(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const tag = findJsxTagAt(sourceFile, line, column);
  if (!tag) return declined(code, 'Could not locate the reported JSX element via AST position lookup.');

  const valueAttr = getAttr(tag.attributes, 'value');
  if (!valueAttr?.initializer || !ts.isJsxExpression(valueAttr.initializer) || !valueAttr.initializer.expression) {
    return declined(code, 'No value={...} expression found on this Provider element.');
  }
  const valueExpr = valueAttr.initializer.expression;
  if (!ts.isObjectLiteralExpression(valueExpr) && !ts.isArrayLiteralExpression(valueExpr)) {
    return declined(code, 'The value expression is not an inline object/array literal — nothing to memoize mechanically.');
  }

  // Every free identifier the literal actually reads IS, by definition, one of its real
  // dependencies — not a guess, a direct reading of the literal's own AST. Property-assignment
  // KEY positions (`{ theme: x }`'s `theme`) are excluded; shorthand keys (`{ theme }`, where the
  // one identifier is simultaneously the key and the value reference) are correctly still counted.
  const deps = new Set<string>();
  const IGNORED = new Set(['true', 'false', 'null', 'undefined']);
  const visit = (n: ts.Node) => {
    if (ts.isIdentifier(n) && !IGNORED.has(n.text)) {
      const isExplicitPropertyKey = ts.isPropertyAssignment(n.parent) && n.parent.name === n;
      if (!isExplicitPropertyKey) deps.add(n.text);
    }
    n.forEachChild(visit);
  };
  visit(valueExpr);

  const useMemoCall = ts.factory.createCallExpression(ts.factory.createIdentifier('useMemo'), undefined, [
    ts.factory.createArrowFunction(undefined, undefined, [], undefined, undefined, ts.factory.createParenthesizedExpression(valueExpr)),
    ts.factory.createArrayLiteralExpression([...deps].map((d) => ts.factory.createIdentifier(d))),
  ]);
  const newValueAttr = ts.factory.createJsxAttribute(
    ts.isIdentifier(valueAttr.name) ? valueAttr.name : ts.factory.createIdentifier('value'),
    ts.factory.createJsxExpression(undefined, useMemoCall)
  );

  return applyAttributePatch(
    sourceFile,
    code,
    tag,
    [newValueAttr],
    `Wrapped the inline Context Provider value in useMemo(() => (...), [${[...deps].join(', ')}]) via AST transformation, deriving the dependency array from every identifier actually referenced inside the value literal.`
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-A11Y-07 — Accessible name (aria-label) doesn't contain the element's visible text
// ---------------------------------------------------------------------------------------------
function fixA11y07(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const tag = findJsxTagAt(sourceFile, line, column);
  if (!tag || !ts.isJsxOpeningElement(tag) || !ts.isJsxElement(tag.parent)) {
    return declined(code, "Could not locate a JSX element with visible text children at the reported position.");
  }
  const jsxEl = tag.parent;
  const ariaLabelAttr = getAttr(tag.attributes, 'aria-label');
  if (!ariaLabelAttr) return declined(code, 'No aria-label attribute found on this element.');

  const isAllText = jsxEl.children.every((c) => ts.isJsxText(c));
  if (!isAllText || jsxEl.children.length === 0) {
    return declined(code, "This element's children are not plain text — cannot safely determine its visible text automatically.");
  }
  const visibleText = jsxEl.children
    .map((c) => (c as ts.JsxText).text)
    .join('')
    .trim();
  if (!visibleText) return declined(code, "No non-empty visible text found in this element's children.");

  const newAttr = ts.factory.createJsxAttribute(
    ts.isIdentifier(ariaLabelAttr.name) ? ariaLabelAttr.name : ts.factory.createIdentifier('aria-label'),
    ts.factory.createStringLiteral(visibleText)
  );
  return applyAttributePatch(
    sourceFile,
    code,
    tag,
    [newAttr],
    `Replaced aria-label with the element's own visible text ("${visibleText}") via AST transformation, so the accessible name contains the visible label (WCAG 2.5.3) — verify this is still an adequate accessible name.`
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-ANG-02 — Angular @Component missing ChangeDetectionStrategy.OnPush
// ---------------------------------------------------------------------------------------------
function findComponentDecoratorObjectLiteral(
  classDecl: ts.ClassDeclaration
): { objectLiteral: ts.ObjectLiteralExpression } | undefined {
  const decorators = ts.canHaveDecorators(classDecl) ? ts.getDecorators(classDecl) : undefined;
  for (const dec of decorators ?? []) {
    if (ts.isCallExpression(dec.expression) && ts.isIdentifier(dec.expression.expression) && dec.expression.expression.text === 'Component') {
      const arg = dec.expression.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) return { objectLiteral: arg };
    }
  }
  return undefined;
}

function fixAng02(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const pos = positionFromLocation(sourceFile, line, column);
  const start = findSmallestNodeAtPosition(sourceFile, pos);
  const classDecl = ts.findAncestor(start, ts.isClassDeclaration) ?? sourceFile.statements.find(ts.isClassDeclaration);
  if (!classDecl) return declined(code, 'Could not locate an enclosing class declaration.');

  const found = findComponentDecoratorObjectLiteral(classDecl);
  if (!found) return declined(code, 'Could not locate a @Component({...}) decorator with an object-literal argument.');
  const { objectLiteral } = found;

  const alreadyHasStrategy = objectLiteral.properties.some((p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'changeDetection');
  if (alreadyHasStrategy) return declined(code, 'changeDetection is already configured on this @Component decorator.');

  const newProp = ts.factory.createPropertyAssignment(
    'changeDetection',
    ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('ChangeDetectionStrategy'), 'OnPush')
  );
  const updatedObjectLiteral = ts.factory.updateObjectLiteralExpression(objectLiteral, [newProp, ...objectLiteral.properties]);
  let patched = splice(code, objectLiteral.getStart(sourceFile), objectLiteral.getEnd(), printNode(updatedObjectLiteral, sourceFile));

  const coreImport = sourceFile.statements.find(
    (s): s is ts.ImportDeclaration => ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) && s.moduleSpecifier.text === '@angular/core'
  );
  const namedBindings = coreImport?.importClause?.namedBindings;
  const alreadyImported = !!namedBindings && ts.isNamedImports(namedBindings) && namedBindings.elements.some((e) => e.name.text === 'ChangeDetectionStrategy');

  if (!alreadyImported) {
    // Computed against the ORIGINAL sourceFile/code — valid to apply to `patched` unchanged
    // because an import always precedes the class body in real Angular component files, the same
    // ordering guarantee fixNext06 already relies on for its own import insertion.
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      const updatedNamedImports = ts.factory.updateNamedImports(namedBindings, [
        ...namedBindings.elements,
        ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('ChangeDetectionStrategy')),
      ]);
      patched = splice(patched, namedBindings.getStart(sourceFile), namedBindings.getEnd(), printNode(updatedNamedImports, sourceFile));
    } else {
      const newImport = ts.factory.createImportDeclaration(
        undefined,
        ts.factory.createImportClause(
          false,
          undefined,
          ts.factory.createNamedImports([ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('ChangeDetectionStrategy'))])
        ),
        ts.factory.createStringLiteral('@angular/core')
      );
      const insertPos = insertionPointAfterDirectivePrologue(sourceFile);
      patched = patched.slice(0, insertPos) + (insertPos > 0 ? '\n' : '') + printNode(newImport, sourceFile) + '\n' + patched.slice(insertPos);
    }
  }

  return ok(patched, "Added changeDetection: ChangeDetectionStrategy.OnPush to the @Component decorator via AST transformation, and ensured ChangeDetectionStrategy is imported from '@angular/core'.");
}

// ---------------------------------------------------------------------------------------------
// FIGM-ANG-05 — Direct nativeElement.style mutation bypassing Renderer2
// ---------------------------------------------------------------------------------------------
function matchNativeElementStyleAssignment(n: ts.Node): ts.BinaryExpression | undefined {
  if (!ts.isBinaryExpression(n) || n.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return undefined;
  if (!ts.isPropertyAccessExpression(n.left)) return undefined;
  const styleAccess = n.left.expression;
  if (!ts.isPropertyAccessExpression(styleAccess) || styleAccess.name.text !== 'style') return undefined;
  const nativeElementAccess = styleAccess.expression;
  if (!ts.isPropertyAccessExpression(nativeElementAccess) || nativeElementAccess.name.text !== 'nativeElement') return undefined;
  if (!ts.isPropertyAccessExpression(nativeElementAccess.expression)) return undefined;
  if (nativeElementAccess.expression.expression.kind !== ts.SyntaxKind.ThisKeyword) return undefined;
  return n;
}

function fixAng05(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const pos = positionFromLocation(sourceFile, line, column);
  const start = findSmallestNodeAtPosition(sourceFile, pos);

  let assign: ts.BinaryExpression | undefined;
  let current: ts.Node | undefined = start;
  while (current) {
    assign = matchNativeElementStyleAssignment(current);
    if (assign) break;
    current = current.parent;
  }
  if (!assign || !ts.isExpressionStatement(assign.parent)) {
    return declined(code, 'Could not locate a `this.<ref>.nativeElement.style.<prop> = value` assignment at the reported position — only this shape can be safely auto-fixed.');
  }

  const left = assign.left as ts.PropertyAccessExpression; // this.<ref>.nativeElement.style.<prop>
  const styleProp = left.name.text;
  const styleAccess = left.expression as ts.PropertyAccessExpression; // ...nativeElement.style
  const nativeElementAccess = styleAccess.expression as ts.PropertyAccessExpression; // this.<ref>.nativeElement

  const setStyleCall = ts.factory.createCallExpression(
    ts.factory.createPropertyAccessExpression(ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('this'), 'renderer'), 'setStyle'),
    undefined,
    [nativeElementAccess, ts.factory.createStringLiteral(styleProp), assign.right]
  );
  const printed = printNode(ts.factory.createExpressionStatement(setStyleCall), sourceFile);
  const patched = splice(code, assign.parent.getStart(sourceFile), assign.parent.getEnd(), printed);
  return ok(
    patched,
    `Replaced the direct nativeElement.style.${styleProp} mutation with this.renderer.setStyle(...) via AST transformation — ensure Renderer2 is injected in the constructor as "this.renderer".`
  );
}

// ---------------------------------------------------------------------------------------------
// FIGM-ANG-09 — Mutable Angular signal input/model property
// ---------------------------------------------------------------------------------------------
function fixAng09(sourceFile: ts.SourceFile, code: string, line: number, column: number): AstFixOutcome {
  const pos = positionFromLocation(sourceFile, line, column);
  const start = findSmallestNodeAtPosition(sourceFile, pos);

  const propDecl = ts.findAncestor(
    start,
    (n): n is ts.PropertyDeclaration =>
      ts.isPropertyDeclaration(n) &&
      !!n.initializer &&
      ts.isCallExpression(n.initializer) &&
      ts.isIdentifier(n.initializer.expression) &&
      (n.initializer.expression.text === 'input' || n.initializer.expression.text === 'model')
  );
  if (!propDecl) return declined(code, 'Could not locate an input()/model() signal property declaration at the reported position.');
  if (propDecl.modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword)) {
    return declined(code, 'This property is already declared readonly.');
  }

  const updated = ts.factory.updatePropertyDeclaration(
    propDecl,
    [...(propDecl.modifiers ?? []), ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
    propDecl.name,
    propDecl.questionToken ?? propDecl.exclamationToken,
    propDecl.type,
    propDecl.initializer
  );
  const patched = splice(code, propDecl.getStart(sourceFile), propDecl.getEnd(), printNode(updated, sourceFile));
  return ok(patched, 'Added the readonly modifier via AST transformation so this signal input/model property cannot be accidentally reassigned.');
}

// ---------------------------------------------------------------------------------------------

export class AstDeterministicFixEngine {
  /** The rule IDs this Phase-01 engine has a real AST fixer for. Every other rule falls through
   *  to the existing pipeline (Claude AI, then the string-based RemediationEngine) unchanged. */
  public static readonly SUPPORTED_RULE_IDS: ReadonlySet<string> = new Set([
    'FIGM-A11Y-01',
    'FIGM-A11Y-02',
    'FIGM-A11Y-03',
    'FIGM-A11Y-04',
    'FIGM-A11Y-05',
    'FIGM-A11Y-06',
    'FIGM-PERF-02',
    'FIGM-REACT-02',
    'FIGM-NEXT-01',
    'FIGM-NEXT-06',
    // Phase 02 (12 more — see the file header and the PR's rule-classification table)
    'FIGM-PERF-01',
    'FIGM-PERF-03',
    'FIGM-PERF-06',
    'FIGM-NEXT-03',
    'FIGM-NEXT-10',
    'FIGM-REACT-03',
    'FIGM-REACT-10',
    'FIGM-REACT-11',
    'FIGM-A11Y-07',
    'FIGM-ANG-02',
    'FIGM-ANG-05',
    'FIGM-ANG-09',
  ]);

  public static isEligible(ruleId: string): boolean {
    return AstDeterministicFixEngine.SUPPORTED_RULE_IDS.has(ruleId);
  }

  /**
   * Attempts a real AST transformation for `defect`. Returns `success: false` (never throws, and
   * always leaves `patchedCode === code`) whenever the node can't be safely located or the rule
   * isn't one of `SUPPORTED_RULE_IDS` — callers must treat that as "try Layer 2 instead," not as
   * an error.
   */
  public static tryFix(code: string, defect: DiagnosticReport, filePath?: string): AstFixOutcome {
    if (!AstDeterministicFixEngine.isEligible(defect.ruleId)) {
      return declined(code, `${defect.ruleId} has not been migrated to the AST deterministic fix engine yet.`);
    }

    const effectivePath = filePath || defect.filePath || 'component.tsx';
    const sourceFile = parseForFix(code, effectivePath);
    if (!sourceFile) return declined(code, 'Source could not be parsed by the TypeScript compiler API.');

    const line = defect.location?.start?.line ?? 1;
    const column = defect.location?.start?.column ?? 0;

    try {
      switch (defect.ruleId) {
        case 'FIGM-A11Y-01':
          return fixA11y01(sourceFile, code, line, column);
        case 'FIGM-A11Y-02':
          return fixA11y02(sourceFile, code, line, column);
        case 'FIGM-A11Y-03':
          return fixA11y03(sourceFile, code, line, column);
        case 'FIGM-A11Y-04':
          return fixA11y04(sourceFile, code, line, column);
        case 'FIGM-A11Y-05':
          return fixA11y05(sourceFile, code, line, column);
        case 'FIGM-A11Y-06':
          return fixA11y06(sourceFile, code, line, column);
        case 'FIGM-PERF-02':
          return fixPerf02(sourceFile, code, line, column);
        case 'FIGM-REACT-02':
          return fixReact02(sourceFile, code, line, column);
        case 'FIGM-NEXT-01':
          return fixNext01(sourceFile, code);
        case 'FIGM-NEXT-06':
          return fixNext06(sourceFile, code, line, column);
        case 'FIGM-PERF-01':
          return fixPerf01(sourceFile, code, line, column);
        case 'FIGM-PERF-03':
          return fixPerf03(sourceFile, code, line, column);
        case 'FIGM-PERF-06':
          return fixPerf06(sourceFile, code, line, column);
        case 'FIGM-NEXT-03':
          return fixNext03(sourceFile, code);
        case 'FIGM-NEXT-10':
          return fixNext10(sourceFile, code);
        case 'FIGM-REACT-03':
          return fixReact03(sourceFile, code, line, column);
        case 'FIGM-REACT-10':
          return fixReact10(sourceFile, code, line, column);
        case 'FIGM-REACT-11':
          return fixReact11(sourceFile, code, line, column);
        case 'FIGM-A11Y-07':
          return fixA11y07(sourceFile, code, line, column);
        case 'FIGM-ANG-02':
          return fixAng02(sourceFile, code, line, column);
        case 'FIGM-ANG-05':
          return fixAng05(sourceFile, code, line, column);
        case 'FIGM-ANG-09':
          return fixAng09(sourceFile, code, line, column);
        default:
          return declined(code, `${defect.ruleId} has not been migrated to the AST deterministic fix engine yet.`);
      }
    } catch (err) {
      // Resilient by design, matching every other real-AST module in this codebase (see
      // SourceParser's resilience contract): a pathological input degrades to "no fix produced,"
      // never a crashed request.
      return declined(code, `AST transformation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
