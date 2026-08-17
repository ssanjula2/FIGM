/**
 * Framework-Independent Guideline Model (FIGM)
 * Real-Syntax ASTNode Builder (AST Migration Phases 4-7)
 *
 * Walks a genuine `ts.SourceFile` (via TypeScriptFrameworkParser) and emits `ASTNode` objects in
 * the SAME shape/attribute-key contract `SourceParser.buildASTFromCode`'s regex loop used to
 * produce, so `ASTDetectionEngine`, `ALPExtractionEngine`, and `RemediationEngine` need no
 * changes at all -- only *how* a node's attributes get populated changes (real parse vs. regex).
 * See docs/architecture/AST_MIGRATION_MAP.md for the full rationale and the rule-by-rule
 * feasibility table this module implements.
 *
 * Every node this module produces has `sourceKind: 'REAL_AST'`. It intentionally does NOT cover
 * every rule -- see FRAMEWORKS_* below and the migration map's §5 for exactly which rules/
 * frameworks remain on the legacy regex path in `source-parser.ts` (VUE_SFC entirely, Angular
 * template-markup rules FIGM-ANG-03/04, and every rule not yet in a migrated group).
 */

import * as ts from 'typescript';
import { ASTNode, FrameworkType } from '../types/ast-spec.js';
import { TypeScriptFrameworkParser } from '../parser/typescript-framework-parser.js';

/** Rules whose violation shape only exists as real JSX syntax (an element/attribute) -- migrated
 *  only for the two frameworks where JSX is expected. GENERIC_ESTREE/ANGULAR_TEMPLATE files that
 *  happen not to contain JSX simply produce no matching nodes either way; frameworks NOT in this
 *  list keep using the legacy text-scan for these specific rules (see source-parser.ts), so an
 *  Angular file's *inline template string* (invisible to the class-body AST) is still covered. */
const JSX_FRAMEWORKS: FrameworkType[] = ['REACT_JSX', 'NEXT_JS'];

/** Rules whose violation shape is plain JS/TS syntax (object literals, imports, assignments) --
 *  these exist in the real script/class-body content of all four of these frameworks. */
const GENERAL_JS_FRAMEWORKS: FrameworkType[] = ['REACT_JSX', 'NEXT_JS', 'GENERIC_ESTREE', 'ANGULAR_TEMPLATE'];

/** Rules scoped to Angular component class bodies (decorators, RxJS calls, ElementRef access). */
const ANGULAR_CLASS_FRAMEWORKS: FrameworkType[] = ['ANGULAR_TEMPLATE', 'GENERIC_ESTREE'];

export function isJsxRealAstEligible(framework: FrameworkType): boolean {
  return JSX_FRAMEWORKS.includes(framework);
}
export function isGeneralJsRealAstEligible(framework: FrameworkType): boolean {
  return GENERAL_JS_FRAMEWORKS.includes(framework);
}
export function isAngularClassRealAstEligible(framework: FrameworkType): boolean {
  return ANGULAR_CLASS_FRAMEWORKS.includes(framework);
}

/** Any framework whose raw file content is genuinely parseable as TypeScript/JSX source at all.
 *  VUE_SFC (`<template>...`) and SVELTE are never real-AST-parsed -- see migration map §2/§5. */
export function canAttemptRealAstParse(framework: FrameworkType): boolean {
  return framework !== 'VUE_SFC' && framework !== 'SVELTE';
}

type ScopeType = 'GLOBAL' | 'MODULE' | 'FUNCTION' | 'LOOP' | 'RENDER';

function isLoopStatement(node: ts.Node): boolean {
  return (
    ts.isForStatement(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node)
  );
}

const ITERATION_METHODS = new Set(['map', 'forEach', 'filter', 'reduce']);

function isArrayIterationCallback(node: ts.Node): boolean {
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) return false;
  const parent = node.parent;
  if (!parent || !ts.isCallExpression(parent) || parent.arguments[0] !== node) return false;
  const callee = parent.expression;
  return ts.isPropertyAccessExpression(callee) && ITERATION_METHODS.has(callee.name.text);
}

function unwrapParens(expr: ts.Expression): ts.Expression {
  let current: ts.Expression = expr;
  while (ts.isParenthesizedExpression(current)) current = current.expression;
  return current;
}

function isJsxLike(node: ts.Node): boolean {
  return ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node);
}

/** True if `fn`'s body returns JSX somewhere in its own (non-nested-function) statements, or is
 *  itself a JSX expression body (`() => <div/>`). This is the real-AST stand-in for the legacy
 *  parser's "function render / return ( / return < / export default function" line triggers. */
function functionReturnsJsx(fn: ts.SignatureDeclaration): boolean {
  const body = (fn as ts.FunctionLikeDeclarationBase).body;
  if (!body) return false;
  if (!ts.isBlock(body)) {
    return isJsxLike(unwrapParens(body as ts.Expression));
  }
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (node !== body && ts.isFunctionLike(node)) return; // do not cross into nested functions
    if (ts.isReturnStatement(node) && node.expression && isJsxLike(unwrapParens(node.expression))) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return found;
}

/** Real-AST equivalent of the legacy line-scanner's LOOP/RENDER/FUNCTION/GLOBAL scope bucket --
 *  computed from genuine ancestor containment instead of a sequential per-line state machine. */
function classifyScope(node: ts.Node): ScopeType {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (isLoopStatement(current) || isArrayIterationCallback(current)) return 'LOOP';
    if (ts.isFunctionLike(current)) {
      return functionReturnsJsx(current as ts.SignatureDeclaration) ? 'RENDER' : 'FUNCTION';
    }
    current = current.parent;
  }
  return 'GLOBAL';
}

function jsxTagName(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string {
  return node.tagName.getText();
}

function jsxAttributes(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement): ts.JsxAttribute[] {
  return node.attributes.properties.filter(ts.isJsxAttribute);
}

function findJsxAttribute(attrs: ts.JsxAttribute[], name: string): ts.JsxAttribute | undefined {
  return attrs.find((a) => a.name.getText() === name);
}

/** Real value when the attribute's initializer is a simple literal, otherwise `true` (presence
 *  marker) -- matches the legacy builder's own placeholder-value behavior (ASTDetectionEngine's
 *  predicates only ever check `!== undefined`, never the actual value, except where noted). */
function jsxAttributeValue(attr: ts.JsxAttribute): unknown {
  const init = attr.initializer;
  if (!init) return true;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression) {
    if (ts.isNumericLiteral(init.expression)) return Number(init.expression.text);
    if (ts.isStringLiteral(init.expression)) return init.expression.text;
    return true;
  }
  return true;
}

interface BuilderContext {
  parser: TypeScriptFrameworkParser;
  sourceFile: ts.SourceFile;
  code: string;
  lines: string[];
  framework: FrameworkType;
  nodes: ASTNode[];
  /** Names FIGM-REACT-03 (buildReact03) has positive, file-wide evidence are React state --
   *  see findStateLikeNames' doc comment for exactly what counts as evidence. Computed once per
   *  file, not per mutation site. */
  stateLikeNames: Set<string>;
}

function lineTextFor(ctx: BuilderContext, node: ts.Node): string {
  const range = ctx.parser.getSourceRange(node);
  return (ctx.lines[range.start.line - 1] ?? node.getText(ctx.sourceFile)).trim();
}

/** Deliberately NOT `Omit<ASTNode, 'loc' | 'sourceKind'>` -- ASTNode's `[key: string]: unknown`
 *  index signature makes Omit/Pick collapse named properties down to `unknown`, silently
 *  defeating type-checking on every pushNode call site. */
interface RealAstNodeInput {
  type: string;
  name?: string;
  scopeType?: ASTNode['scopeType'];
  attributes?: Record<string, unknown>;
}

function pushNode(ctx: BuilderContext, node: ts.Node, astNode: RealAstNodeInput): void {
  const range = ctx.parser.getSourceRange(node);
  ctx.nodes.push({
    ...astNode,
    loc: range,
    sourceKind: 'REAL_AST',
  });
}

// ---------------------------------------------------------------------------------------------
// Group 1 (priority list): FIGM-REACT-03, FIGM-A11Y-01, FIGM-A11Y-02, FIGM-A11Y-03,
// FIGM-A11Y-04, FIGM-PERF-01, FIGM-PERF-02, FIGM-PERF-04
// ---------------------------------------------------------------------------------------------

const NON_INTERACTIVE_TAGS = new Set(['div', 'span', 'section', 'article', 'p']);
const VISUAL_MEDIA_TAGS = new Set(['img', 'video', 'iframe', 'embed']);
const CUSTOM_CONTROL_TAG_PREFIXES = ['Custom', 'Select', 'Dropdown'];
const OVERLAY_TAG_PREFIXES = ['Modal', 'Dialog'];
const ARRAY_MUTATION_METHODS = new Set(['push', 'splice', 'pop', 'shift', 'unshift', 'sort']);

/** The legacy detector matches via `cTrimmed.includes('<Custom')` etc. -- a PREFIX match on the
 *  tag name (so `<CustomDropdown>` matches equally well as `<Custom>`), not an exact tag-name
 *  match. Preserved exactly (see docs/architecture/AST_MIGRATION_MAP.md §8 -- this migration
 *  changes detection *mechanism*, not detection *scope*). */
function startsWithAny(tag: string, prefixes: string[]): boolean {
  return prefixes.some((p) => tag.startsWith(p));
}

function buildPerf01(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isObjectLiteralExpression(node)) return;
  // Legacy detector's trigger is `/\b(const|let|var)\s+\w+\s*=\s*\{/` -- i.e. only an object
  // literal that is the initializer of a variable DECLARATION, not e.g. a bare `return {...}` or
  // an object literal passed as a call argument. Preserved exactly (a broader "any object literal
  // in loop scope" scope would be a real, undocumented behavior change with no existing test
  // coverage backing it -- see AST_MIGRATION_MAP.md §8 -- and was caught by
  // tests/ai-remediation.test.ts's validatePatch regression, which asserts the *fixed* code's
  // remaining `return { ...item, ...defaultConfig }` must NOT itself be flagged).
  const parent = node.parent;
  const isDeclarationInitializer = !!parent && ts.isVariableDeclaration(parent) && parent.initializer === node;
  if (!isDeclarationInitializer) return;

  const scope = classifyScope(node);
  if (scope !== 'LOOP' && scope !== 'RENDER') return;
  pushNode(ctx, node, {
    type: 'ObjectExpression',
    scopeType: scope,
    attributes: { isInvariant: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

function buildPerf02(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
  const tag = jsxTagName(node);
  if (!VISUAL_MEDIA_TAGS.has(tag)) return;

  const attrs = jsxAttributes(node);
  const widthAttr = findJsxAttribute(attrs, 'width');
  const heightAttr = findJsxAttribute(attrs, 'height');
  const styleAttr = findJsxAttribute(attrs, 'style');
  const styleText = styleAttr ? styleAttr.getText(ctx.sourceFile) : '';
  const hasAspectRatio =
    !!findJsxAttribute(attrs, 'aspectRatio') ||
    styleText.includes('aspectRatio') ||
    styleText.includes('aspect-ratio');

  const attributes: Record<string, unknown> = {
    codeSnippet: lineTextFor(ctx, node),
    src: (() => {
      const srcAttr = findJsxAttribute(attrs, 'src');
      const v = srcAttr ? jsxAttributeValue(srcAttr) : '';
      return typeof v === 'string' ? v : '';
    })(),
  };
  if (widthAttr) attributes.width = jsxAttributeValue(widthAttr);
  if (heightAttr) attributes.height = jsxAttributeValue(heightAttr);
  if (hasAspectRatio) attributes.aspectRatio = '1/1';

  pushNode(ctx, node, {
    type: ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node) ? 'JSXElement' : 'JSXElement',
    name: tag,
    scopeType: classifyScope(node),
    attributes,
  });
}

/** Extracts every local binding name introduced by an ImportDeclaration's import clause (default
 *  import, namespace import, named imports incl. `as` aliases) -- the real-AST equivalent of
 *  extractImportedBindingNames' regex parsing in source-parser.ts. */
function importedBindingNames(decl: ts.ImportDeclaration): string[] {
  const names: string[] = [];
  const clause = decl.importClause;
  if (!clause) return names;
  if (clause.name) names.push(clause.name.text);
  const bindings = clause.namedBindings;
  if (bindings) {
    if (ts.isNamespaceImport(bindings)) {
      names.push(bindings.name.text);
    } else if (ts.isNamedImports(bindings)) {
      for (const el of bindings.elements) {
        names.push(el.name.text);
      }
    }
  }
  return names;
}

/** True iff every real reference to any of `names` in the file has an IfStatement among its
 *  ancestors, AND at least one such reference exists. Real-AST equivalent of
 *  isReferencedInsideConditionalBlock -- structurally cannot miss a same-line `if (Binding)`
 *  usage or a brace-less `if (cond) use();` body, both documented regressions the legacy line
 *  scanner had to be specifically patched for. */
function isExclusivelyConditionallyReferenced(ctx: BuilderContext, decl: ts.ImportDeclaration, names: string[]): boolean {
  if (names.length === 0) return false;
  const nameSet = new Set(names);
  let sawConditional = false;
  let sawUnconditional = false;

  const isPartOfImportClause = (id: ts.Identifier): boolean => {
    let p: ts.Node | undefined = id.parent;
    while (p) {
      if (p === decl) return true;
      p = p.parent;
    }
    return false;
  };

  // A `catch` clause is exactly as conditional/deferred as an `if` block -- it only executes
  // when the guarded `try` throws -- but was invisible here (found via live black-box testing:
  // FIGM's own live-scan page statically imported RemediationEngine, used only inside a catch
  // block, adding ~1MB to that page's client bundle; this rule should have caught it and
  // didn't, on the very framework -- GENERIC_ESTREE/REACT_JSX/NEXT_JS -- that routes through
  // this real-AST path rather than the legacy line-heuristic one).
  const hasIfStatementAncestor = (node: ts.Node): boolean => {
    let current: ts.Node | undefined = node.parent;
    while (current) {
      if (ts.isIfStatement(current) || ts.isCatchClause(current)) return true;
      current = current.parent;
    }
    return false;
  };

  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && nameSet.has(node.text) && !isPartOfImportClause(node)) {
      if (hasIfStatementAncestor(node)) sawConditional = true;
      else sawUnconditional = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(ctx.sourceFile);

  return sawConditional && !sawUnconditional;
}

function buildPerf04(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isImportDeclaration(node)) return;
  if (!ts.isStringLiteral(node.moduleSpecifier)) return;
  const names = importedBindingNames(node);
  const referencedInConditional = isExclusivelyConditionallyReferenced(ctx, node, names);
  if (!referencedInConditional) return; // legacy builder also only ever pushes when this is true implicitly via evalPerf04

  pushNode(ctx, node, {
    type: 'ImportDeclaration',
    name: node.moduleSpecifier.text,
    scopeType: classifyScope(node),
    attributes: {
      codeSnippet: lineTextFor(ctx, node),
      referencedInConditional: true,
    },
  });
}

function attributeHasKey(attrs: ts.JsxAttribute[], ...keys: string[]): boolean {
  return keys.some((k) => attrs.some((a) => a.name.getText() === k));
}

function buildA11y01(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
  const tag = jsxTagName(node);
  if (!NON_INTERACTIVE_TAGS.has(tag)) return;
  const attrs = jsxAttributes(node);
  const hasOnClick = attributeHasKey(attrs, 'onClick');
  if (!hasOnClick) return;
  const hasOnKeyDown = attributeHasKey(attrs, 'onKeyDown');
  const hasTabIndex = attributeHasKey(attrs, 'tabIndex');

  pushNode(ctx, node, {
    type: 'JSXElement',
    name: tag,
    scopeType: classifyScope(node),
    attributes: {
      codeSnippet: lineTextFor(ctx, node),
      onClick: 'handler',
      ...(hasOnKeyDown ? { onKeyDown: 'handler' } : {}),
      ...(hasTabIndex ? { tabIndex: 0 } : {}),
    },
  });
}

function buildA11y02(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
  const tag = jsxTagName(node);
  if (!startsWithAny(tag, CUSTOM_CONTROL_TAG_PREFIXES)) return;
  const attrs = jsxAttributes(node);
  const roleAttr = findJsxAttribute(attrs, 'role');
  const ariaLabelAttr = findJsxAttribute(attrs, 'aria-label') || findJsxAttribute(attrs, 'aria-labelledby');

  const attributes: Record<string, unknown> = { codeSnippet: lineTextFor(ctx, node), isCustomControl: true };
  if (roleAttr) attributes.role = jsxAttributeValue(roleAttr);
  if (ariaLabelAttr) attributes['aria-label'] = jsxAttributeValue(ariaLabelAttr);

  pushNode(ctx, node, { type: 'JSXElement', name: tag, scopeType: classifyScope(node), attributes });
}

function buildA11y03(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
  const attrs = jsxAttributes(node);
  const classAttr = findJsxAttribute(attrs, 'className') || findJsxAttribute(attrs, 'class');
  const idAttr = findJsxAttribute(attrs, 'id');
  // Same over-approximation as the legacy detector (documented KNOWN LIMITATION, deliberately
  // preserved -- see docs/architecture/AST_MIGRATION_MAP.md §8): a literal-string class/id value
  // that merely STARTS WITH "status" is treated as a dynamic status container.
  const classVal = classAttr ? jsxAttributeValue(classAttr) : undefined;
  const idVal = idAttr ? jsxAttributeValue(idAttr) : undefined;
  const looksLikeStatusContainer =
    (typeof classVal === 'string' && classVal.startsWith('status')) ||
    (typeof idVal === 'string' && idVal.startsWith('status'));
  if (!looksLikeStatusContainer) return;

  const ariaLiveAttr = findJsxAttribute(attrs, 'aria-live');
  const roleAttr = findJsxAttribute(attrs, 'role');
  const roleVal = roleAttr ? jsxAttributeValue(roleAttr) : undefined;

  const attributes: Record<string, unknown> = { codeSnippet: lineTextFor(ctx, node), isDynamicMutation: true };
  if (ariaLiveAttr) attributes['aria-live'] = jsxAttributeValue(ariaLiveAttr);
  if (typeof roleVal === 'string' && (roleVal === 'status' || roleVal === 'alert')) attributes.role = roleVal;

  pushNode(ctx, node, { type: 'JSXElement', name: 'div', scopeType: classifyScope(node), attributes });
}

function buildA11y04(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
  const tag = jsxTagName(node);
  if (!startsWithAny(tag, OVERLAY_TAG_PREFIXES)) return;
  const attrs = jsxAttributes(node);
  // Same documented KNOWN LIMITATION as the legacy detector: presence of onClose is accepted as
  // a proxy for focus-restoration logic, without verifying the handler body actually restores it.
  const hasRestoration = attributeHasKey(attrs, 'restoresFocus', 'onClose');

  pushNode(ctx, node, {
    type: 'JSXElement',
    name: tag,
    scopeType: classifyScope(node),
    attributes: { codeSnippet: lineTextFor(ctx, node), isOverlay: true, restoresFocusOnUnmount: hasRestoration },
  });
}

function isPropertyAccessChain(expr: ts.Expression): expr is ts.PropertyAccessExpression {
  return ts.isPropertyAccessExpression(expr);
}

// Root identifiers this rule must never attribute a mutation to, because they are unambiguously
// NOT a React state variable no matter what gets assigned on them or called on them -- found via
// live black-box testing on FIGM's own codebase: `router.push('/guidelines')` (the standard
// Next.js/React Router navigation call, matched because `.push` is also an array-mutation method
// name) and `document.body.style.overflow = 'hidden'` (a standard scroll-lock pattern, matched
// because it's a plain `obj.prop = value` assignment) were both flagged CRITICAL "direct state
// mutation" -- a false positive severe enough to spam warnings in almost any real Next.js app,
// since `router.push` is one of the most common calls in the framework.
const NON_STATE_ROOT_IDENTIFIERS = new Set([
  'document', 'window', 'navigator', 'location', 'history',
  'localStorage', 'sessionStorage', 'router',
]);

/** Walks a (possibly chained) member-access expression down to its root identifier, e.g.
 *  `document.body.style` -> "document", `router.push` -> "router", `user.profile.name` ->
 *  "user". Returns undefined for anything that doesn't bottom out at a plain identifier (a call
 *  result, `this`, etc.), which this rule already didn't have a meaningful root-name check for. */
function getRootIdentifierName(expr: ts.Expression): string | undefined {
  let current: ts.Expression = expr;
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    current = current.expression;
  }
  return ts.isIdentifier(current) ? current.text : undefined;
}

/** `somethingRef.current.foo = value` / `somethingRef.current.method()` is the standard React
 *  idiom for imperatively driving a DOM node or mutable ref container (video playback position,
 *  focus, scroll position, a timer handle...) -- categorically not React state, regardless of
 *  the ref variable's own name, which (unlike `document`/`router`) can't be captured by a fixed
 *  identifier allow-list. */
function isRefCurrentAccess(expr: ts.Expression): boolean {
  let current: ts.Expression = expr;
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    if (ts.isPropertyAccessExpression(current) && current.name.text === 'current') return true;
    current = current.expression;
  }
  return false;
}

function isExcludedMutationTarget(expr: ts.Expression): boolean {
  const root = getRootIdentifierName(expr);
  if (root && NON_STATE_ROOT_IDENTIFIERS.has(root)) return true;
  return isRefCurrentAccess(expr);
}

/** `this.state.foo = x` / `this.state.list.push(x)` / bare `this.state = x` -- the classic
 *  class-component direct-state-mutation anti-pattern (the idiomatic fix is `this.setState(...)`).
 *  Unlike a hook-based `useState` variable, `this.state` is a fixed, reserved property name, so
 *  this needs no file-wide search -- it's structurally decidable from the expression alone: walk
 *  down to the segment immediately adjacent to `this` and check it's literally `state`. */
function isThisStateAccess(expr: ts.Expression): boolean {
  const segments: string[] = [];
  let current: ts.Expression = expr;
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    if (ts.isPropertyAccessExpression(current)) segments.push(current.name.text);
    current = current.expression;
  }
  return current.kind === ts.SyntaxKind.ThisKeyword && segments[segments.length - 1] === 'state';
}

/** Real (aliasing-aware) resolution of which local call-expression names are actually React's
 *  `useState` hook -- both a bare `import { useState } from 'react'` and a renamed
 *  `import { useState as useLocalState } from 'react'` resolve to the SAME hook, and a codebase
 *  can equally validly call it as `React.useState(...)`/`SomeAlias.useState(...)` via a default or
 *  namespace import. Reading only the literal text `"useState"` (as a regex/text heuristic would)
 *  misses the aliased-import case entirely -- this walks the real import declarations instead. */
function collectReactHookBindings(sourceFile: ts.SourceFile): { hookCallNames: Set<string>; namespaceNames: Set<string> } {
  const hookCallNames = new Set<string>(['useState']); // bare fallback if no traceable 'react' import exists
  const namespaceNames = new Set<string>();

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === 'react') {
      const clause = node.importClause;
      if (clause) {
        if (clause.name) namespaceNames.add(clause.name.text); // import React from 'react'
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) {
          namespaceNames.add(bindings.name.text); // import * as React from 'react'
        } else if (bindings && ts.isNamedImports(bindings)) {
          for (const el of bindings.elements) {
            if ((el.propertyName ?? el.name).text === 'useState') hookCallNames.add(el.name.text); // local (possibly aliased) name
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { hookCallNames, namespaceNames };
}

/** Real, file-wide search for every local identifier this file has actual positive evidence is
 *  React state -- the allowlist that replaces the old "flag every property assignment/array
 *  mutation unless the root name is on a fixed denylist" behavior. Two independent kinds of
 *  evidence, either sufficient on its own:
 *
 *  1. The identifier is the FIRST element of a `const [x, setX] = useState(...)` (or aliased/
 *     `React.useState(...)`) destructuring, found anywhere in the file -- the real hook binding.
 *  2. A call to `set${Capitalize(x)}(...)` exists anywhere in the file -- React's near-universal
 *     naming convention for a state setter, kept as a second signal because a hook can also come
 *     from a custom wrapper (`const [x, setX] = useMyHook()`) this function can't trace to a real
 *     `useState` call, and because several of this rule's own committed regression-test fixtures
 *     exercise `setX(x)` immediately after the mutation without an explicit `useState(...)` call
 *     in the same snippet -- both are real signals a maintainer would recognize as "this is state,"
 *     not merely least-effort test-fixture compatibility.
 *
 *  This is a documented, file-wide *name* search, not full lexical-scope/type-checker binding
 *  resolution (which this AST-only pass doesn't have) -- it can still under- or over-match if two
 *  unrelated functions in the same file happen to reuse an identifier name, but it converts the
 *  false-positive surface from "any property assignment anywhere, including files with zero React
 *  content" (the confirmed real-world-benchmark finding: `Button.defaultProps =`, `module.exports
 *  =`, a Karma config, `ctx.fillStyle =`, and FIGM's own `rows.push()` local-array diff builder)
 *  down to "an identifier this file has actual evidence is state," which is a bounded, principled
 *  improvement even though it is not a perfect binder. */
function findStateLikeNames(sourceFile: ts.SourceFile): Set<string> {
  const { hookCallNames, namespaceNames } = collectReactHookBindings(sourceFile);
  const names = new Set<string>();

  const isHookCall = (callee: ts.Expression): boolean => {
    if (ts.isIdentifier(callee)) return hookCallNames.has(callee.text);
    if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'useState') {
      return ts.isIdentifier(callee.expression) && namespaceNames.has(callee.expression.text);
    }
    return false;
  };

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isArrayBindingPattern(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      isHookCall(node.initializer.expression)
    ) {
      const first = node.name.elements[0];
      if (first && ts.isBindingElement(first) && ts.isIdentifier(first.name)) {
        names.add(first.name.text);
      }
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const calleeName = node.expression.text;
      if (/^set[A-Z]/.test(calleeName)) {
        names.add(calleeName[3].toLowerCase() + calleeName.slice(4));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
}

function isProvableStateTarget(ctx: BuilderContext, expr: ts.Expression): boolean {
  if (isThisStateAccess(expr)) return true;
  const root = getRootIdentifierName(expr);
  return !!root && ctx.stateLikeNames.has(root);
}

function buildReact03(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isExpressionStatement(node)) return;
  const expr = node.expression;

  // Shape A: arr.push(x) / arr.splice(...) / etc.
  if (ts.isCallExpression(expr) && isPropertyAccessChain(expr.expression) && ARRAY_MUTATION_METHODS.has(expr.expression.name.text)) {
    if (node.getText(ctx.sourceFile).includes('setState')) return; // preserved legacy exclusion
    if (isExcludedMutationTarget(expr.expression.expression)) return;
    if (!isProvableStateTarget(ctx, expr.expression.expression)) return;
    pushNode(ctx, node, {
      type: 'ExpressionStatement',
      name: 'mutateState',
      scopeType: classifyScope(node),
      attributes: { isDirectStateMutation: true, codeSnippet: lineTextFor(ctx, node) },
    });
    return;
  }

  // Shape B: obj.prop = value (real assignment, structurally distinct from ==/===/object-literal
  // properties by SyntaxKind -- no text-based exclusion needed for those cases, unlike the regex
  // version this replaces).
  if (
    ts.isBinaryExpression(expr) &&
    expr.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    isPropertyAccessChain(expr.left)
  ) {
    if (node.getText(ctx.sourceFile).includes('setState')) return; // preserved legacy exclusion
    if (isExcludedMutationTarget(expr.left)) return;
    if (!isProvableStateTarget(ctx, expr.left)) return;
    pushNode(ctx, node, {
      type: 'ExpressionStatement',
      name: 'mutateState',
      scopeType: classifyScope(node),
      attributes: { isDirectStateMutation: true, codeSnippet: lineTextFor(ctx, node) },
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Group 4 (this pass): FIGM-PERF-03, FIGM-PERF-05, FIGM-PERF-06, FIGM-A11Y-05, FIGM-A11Y-06,
// FIGM-REACT-01, FIGM-REACT-04. All seven were classified "Yes, feasible" (no new dependency
// needed) in docs/architecture/AST_MIGRATION_MAP.md §2 but explicitly deferred to "Groups 4+" in
// §5/§6. See docs/architecture/RULE_ENGINEERING_AUDIT.md for the full rule-by-rule rationale,
// including every deliberate, documented semantic refinement made below (never a silent one).
// ---------------------------------------------------------------------------------------------

function stringLiteralArg0(call: ts.CallExpression): string | undefined {
  const arg0 = call.arguments[0];
  return arg0 && ts.isStringLiteral(arg0) ? arg0.text : undefined;
}

/** File-wide search for a `removeEventListener` call matching `eventName` (or, when the
 *  triggering `addEventListener`'s own event-type argument isn't a string literal, ANY
 *  `removeEventListener` call at all) -- byte-identical semantics to the legacy detector's
 *  regex-based pairing (deliberately NOT upgraded to true lexical/data-flow scope pairing, which
 *  would be a real, undocumented behavior change -- see AST_MIGRATION_MAP.md §8 precedent). */
function hasPairedRemovalForEventType(ctx: BuilderContext, eventName: string | undefined): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (
      ts.isCallExpression(node) &&
      isPropertyAccessChain(node.expression) &&
      node.expression.name.text === 'removeEventListener'
    ) {
      const removedEvent = stringLiteralArg0(node);
      if (eventName === undefined || removedEvent === eventName) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ctx.sourceFile);
  return found;
}

function buildPerf03(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isCallExpression(node)) return;
  if (!isPropertyAccessChain(node.expression) || node.expression.name.text !== 'addEventListener') return;
  const eventName = stringLiteralArg0(node);
  const hasCleanup = hasPairedRemovalForEventType(ctx, eventName);
  pushNode(ctx, node, {
    type: 'CallExpression',
    name: 'addEventListener',
    scopeType: classifyScope(node),
    attributes: { method: 'addEventListener', hasPairedRemoval: hasCleanup, codeSnippet: lineTextFor(ctx, node) },
  });
}

/** Matches a React event-handler-shaped JSX attribute name (`onClick`, `onChange`, `onKeyDown`,
 *  ...). DOCUMENTED SCOPE REFINEMENT: the legacy detector only ever matched the literal substring
 *  `onClick={` -- an inline arrow passed to `onMouseDown`/`onChange`/any other handler prop inside
 *  a loop was invisible to this rule even though it is the exact same anti-pattern the rule (and
 *  its formal predicate `IsInlineCallback(n) AND Scope(n) in {LOOP, RENDER}`, which is not
 *  onClick-specific) describes. See RULE_ENGINEERING_AUDIT.md §FIGM-PERF-05. */
function isJsxHandlerAttributeName(name: string): boolean {
  return /^on[A-Z]/.test(name);
}

function buildPerf05(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isArrowFunction(node)) return;
  const parent = node.parent;
  if (!parent || !ts.isJsxExpression(parent)) return;
  const grandparent = parent.parent;
  if (!grandparent || !ts.isJsxAttribute(grandparent)) return;
  if (!isJsxHandlerAttributeName(grandparent.name.getText())) return;
  const scope = classifyScope(node);
  if (scope !== 'LOOP' && scope !== 'RENDER') return;
  pushNode(ctx, node, {
    type: 'ArrowFunctionExpression',
    scopeType: scope,
    attributes: { isInlineCallback: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

const STORAGE_OBJECTS = new Set(['localStorage', 'sessionStorage']);

function buildPerf06(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isCallExpression(node)) return;
  if (!isPropertyAccessChain(node.expression)) return;
  const obj = node.expression.expression;
  if (!ts.isIdentifier(obj) || !STORAGE_OBJECTS.has(obj.text)) return;
  const scope = classifyScope(node);
  if (scope !== 'LOOP' && scope !== 'RENDER') return;
  pushNode(ctx, node, {
    type: 'CallExpression',
    name: obj.text,
    scopeType: scope,
    attributes: { isStorageInLoop: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

const LABELABLE_TAGS = new Set(['input', 'textarea', 'select']);

/** Same crude, non-value-matched presence check as the legacy detector: true if `htmlFor=` or
 *  `for=` appears ANYWHERE in the file, without verifying it actually pairs with THIS element's
 *  `id`. Deliberately NOT upgraded to true id/htmlFor value-matching in this pass -- see
 *  RULE_ENGINEERING_AUDIT.md §FIGM-A11Y-05 for why that stays a documented, preserved
 *  over-approximation rather than a silent scope change. */
function fileWideIncludesHtmlForOrFor(ctx: BuilderContext): boolean {
  return ctx.code.includes('htmlFor=') || ctx.code.includes('for=');
}

function buildA11y05(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
  const tag = jsxTagName(node);
  if (!LABELABLE_TAGS.has(tag)) return;
  const attrs = jsxAttributes(node);
  if (attributeHasKey(attrs, 'aria-label', 'aria-labelledby')) return;
  const hasId = attributeHasKey(attrs, 'id');
  if (hasId && fileWideIncludesHtmlForOrFor(ctx)) return;
  pushNode(ctx, node, {
    type: 'JSXElement',
    name: tag,
    scopeType: classifyScope(node),
    attributes: { isUnlabeledInput: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

/** Real numeric value of a `tabIndex`/`tabindex` JSX attribute from either shape
 *  (`tabIndex="5"` or `tabIndex={5}`); `undefined` for anything not a plain literal (e.g. a
 *  variable or `{-1}`'s PrefixUnaryExpression, which the legacy regex also never matched). */
function tabIndexNumericValue(attr: ts.JsxAttribute): number | undefined {
  const init = attr.initializer;
  if (!init) return undefined;
  const literalTextToNumber = (text: string): number | undefined => {
    const n = Number(text);
    return Number.isFinite(n) ? n : undefined;
  };
  if (ts.isStringLiteral(init)) return literalTextToNumber(init.text);
  if (ts.isJsxExpression(init) && init.expression) {
    if (ts.isNumericLiteral(init.expression)) return literalTextToNumber(init.expression.text);
    if (ts.isStringLiteral(init.expression)) return literalTextToNumber(init.expression.text);
  }
  return undefined;
}

function buildA11y06(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isJsxAttribute(node)) return;
  const attrName = node.name.getText();
  if (attrName !== 'tabIndex' && attrName !== 'tabindex') return;
  const numeric = tabIndexNumericValue(node);
  if (numeric === undefined || !(numeric > 0)) return;
  const owner = node.parent?.parent;
  const tag = owner && (ts.isJsxOpeningElement(owner) || ts.isJsxSelfClosingElement(owner)) ? jsxTagName(owner) : 'element';
  pushNode(ctx, node, {
    type: 'JSXElement',
    name: tag,
    scopeType: classifyScope(node),
    attributes: { codeSnippet: lineTextFor(ctx, node), tabIndex: numeric, positiveTabIndex: true },
  });
}

const DERIVED_COMPUTATION_METHODS = new Set(['sort', 'filter', 'reduce']);

/** True if `node` is lexically nested inside a `useMemo(...)`/`React.useMemo(...)` call's
 *  arguments. DOCUMENTED IMPROVEMENT over the legacy same-PHYSICAL-LINE substring check
 *  (`!cTrimmed.includes('useMemo')`): a real ancestor walk correctly recognizes a multi-line
 *  `useMemo(() => {\n  ...\n  items.sort(...)\n}, [items])` body (a false positive under the old
 *  same-line check) and is immune to an unrelated `useMemo` appearing elsewhere on the same
 *  physical line as an unmemoized computation (a false negative under the old check). See
 *  RULE_ENGINEERING_AUDIT.md §FIGM-REACT-01. */
function hasUseMemoAncestor(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isCallExpression(current)) {
      const callee = current.expression;
      const calleeName = ts.isIdentifier(callee) ? callee.text : isPropertyAccessChain(callee) ? callee.name.text : undefined;
      if (calleeName === 'useMemo') return true;
    }
    current = current.parent;
  }
  return false;
}

function buildReact01(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isCallExpression(node)) return;
  if (!isPropertyAccessChain(node.expression)) return;
  if (!DERIVED_COMPUTATION_METHODS.has(node.expression.name.text)) return;
  if (hasUseMemoAncestor(node)) return;
  pushNode(ctx, node, {
    type: 'CallExpression',
    name: node.expression.name.text,
    scopeType: classifyScope(node),
    attributes: { isExpensiveDerivedStateWithoutMemo: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

/** Same tag-prefix allow-list as the legacy detector (`<Custom*>`/`<Button*>`/`<Card*>`), scoped
 *  to `onClick` only (not generalized to other handler props -- unlike FIGM-PERF-05 above, the
 *  rule's own nonCompliantExample and every existing ground-truth fixture are onClick-specific,
 *  so broadening here would be an undocumented scope change, not a demonstrable bug fix). */
const REACT04_TAG_PREFIXES = ['Custom', 'Button', 'Card'];

function buildReact04(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isJsxAttribute(node)) return;
  if (node.name.getText() !== 'onClick') return;
  const init = node.initializer;
  if (!init || !ts.isJsxExpression(init) || !init.expression || !ts.isArrowFunction(init.expression)) return;
  const owner = node.parent?.parent;
  if (!owner || (!ts.isJsxOpeningElement(owner) && !ts.isJsxSelfClosingElement(owner))) return;
  const tag = jsxTagName(owner);
  if (!startsWithAny(tag, REACT04_TAG_PREFIXES)) return;
  pushNode(ctx, node, {
    type: 'JSXAttribute',
    name: 'onClick',
    scopeType: classifyScope(node),
    attributes: { isInlineCallbackProp: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

// ---------------------------------------------------------------------------------------------
// Group 2: FIGM-ANG-01, FIGM-ANG-02, FIGM-ANG-05 (Angular component class body only --
// FIGM-ANG-03/04 need real Angular *template* markup parsing, which stays LEGACY_TEXT_HEURISTIC;
// see docs/architecture/AST_MIGRATION_MAP.md §5).
// ---------------------------------------------------------------------------------------------

function fileWideTextIncludesAny(ctx: BuilderContext, ...needles: string[]): boolean {
  return needles.some((n) => ctx.code.includes(n));
}

function buildAng01(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isCallExpression(node)) return;
  if (!isPropertyAccessChain(node.expression) || node.expression.name.text !== 'subscribe') return;
  const hasManagedTeardown = fileWideTextIncludesAny(ctx, 'takeUntilDestroyed', 'unsubscribe', 'DestroyRef');
  if (hasManagedTeardown) return;
  pushNode(ctx, node, {
    type: 'CallExpression',
    name: 'subscribe',
    scopeType: classifyScope(node),
    attributes: { isUnsubscribedObservable: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

function buildAng02(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isDecorator(node)) return;
  const expr = node.expression;
  if (!ts.isCallExpression(expr) || !ts.isIdentifier(expr.expression) || expr.expression.text !== 'Component') return;
  const arg = expr.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) return;
  const argText = arg.getText(ctx.sourceFile);
  if (argText.includes('ChangeDetectionStrategy.OnPush')) return;
  pushNode(ctx, node, {
    type: 'ClassDeclaration',
    name: 'Component',
    scopeType: 'MODULE',
    attributes: { missingOnPush: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

function buildAng05(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isPropertyAccessExpression(node) || node.name.text !== 'nativeElement') return;
  // "Guarded by Renderer2" is approximated the same way the legacy detector does: presence of
  // renderer./Renderer2 text on the same physical line as the nativeElement access.
  const line = lineTextFor(ctx, node);
  if (line.includes('renderer.') || line.includes('Renderer2')) return;
  pushNode(ctx, node, {
    type: 'MemberExpression',
    name: 'nativeElement',
    scopeType: classifyScope(node),
    attributes: { isDirectNativeElementMutation: true, codeSnippet: line },
  });
}

// ---------------------------------------------------------------------------------------------
// Group 3: FIGM-NEXT-01, FIGM-NEXT-02, FIGM-NEXT-03, FIGM-NEXT-04
// ---------------------------------------------------------------------------------------------

const CLIENT_HOOK_NAMES = new Set(['useState', 'useEffect', 'useContext', 'useRef']);
const HEAVY_MODULES = ['monaco-editor', 'chart.js', 'three', 'canvas', 'echarts', 'd3'];

function hasUseClientDirective(sourceFile: ts.SourceFile): boolean {
  for (const stmt of sourceFile.statements) {
    if (!ts.isExpressionStatement(stmt)) break; // directive prologue must be leading statements
    if (ts.isStringLiteral(stmt.expression) && stmt.expression.text === 'use client') return true;
    if (!ts.isStringLiteral(stmt.expression)) break;
  }
  return false;
}

function buildNext01(ctx: BuilderContext, node: ts.Node): void {
  if (hasUseClientDirective(ctx.sourceFile)) return;
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return;
  const name = node.expression.text;
  if (!CLIENT_HOOK_NAMES.has(name)) return;
  pushNode(ctx, node, {
    type: 'CallExpression',
    name,
    scopeType: classifyScope(node),
    attributes: { isClientHookWithoutDirective: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

function buildNext02(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return;
  const moduleName = node.moduleSpecifier.text;
  const isHeavy = HEAVY_MODULES.some((m) => moduleName.includes(m));
  if (!isHeavy) return;
  const alreadyDynamic = ctx.code.includes('dynamic(');
  if (alreadyDynamic) return;
  pushNode(ctx, node, {
    type: 'ImportDeclaration',
    name: moduleName,
    scopeType: classifyScope(node),
    attributes: { codeSnippet: lineTextFor(ctx, node), isHeavyStaticImportInNext: true },
  });
}

function hasRevalidateExport(sourceFile: ts.SourceFile): boolean {
  for (const stmt of sourceFile.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    const isExported = !!stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExported) continue;
    if (stmt.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === 'revalidate')) {
      return true;
    }
  }
  return false;
}

function isAppRouterPageFile(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  const underAppOrPages = /(?:^|[\\/])app[\\/]/.test(normalized) || /(?:^|[\\/])pages[\\/]/.test(normalized);
  return underAppOrPages && /(?:^|[\\/])page\.(tsx|jsx|ts|js)$/.test(normalized.split(/[\\/]/).pop() || '');
}

/** Root-level (not per-node) check -- there is no single "missing" AST node to visit, so this is
 *  called once per file, matching the legacy builder's own root.attributes-driven synthetic
 *  ExportNamedDeclaration node for this rule. */
function buildNext03Root(ctx: BuilderContext): void {
  if (ctx.framework !== 'NEXT_JS') return;
  if (!isAppRouterPageFile(ctx.sourceFile.fileName)) return;
  if (hasRevalidateExport(ctx.sourceFile)) return;
  // Route segment config exports (`revalidate`, `dynamic`, etc.) are only valid in a Server
  // Component page -- Next.js rejects them entirely from a file marked 'use client' ("You are
  // attempting to export ... from a component marked with 'use client'"). Flagging a Client
  // Component page for a "missing" export it is not even allowed to have is a false positive:
  // there is no single-line fix that makes the file correct, only an architecture change (move
  // the data fetch/revalidate config to a Server Component page/layout that renders this client
  // component), which is a human decision, not something this rule can safely auto-detect here.
  if (hasUseClientDirective(ctx.sourceFile)) return;
  ctx.nodes.push({
    type: 'ExportNamedDeclaration',
    name: 'revalidate',
    scopeType: 'MODULE',
    attributes: { missingRevalidateConfig: true, codeSnippet: 'export const revalidate' },
    loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
    sourceKind: 'REAL_AST',
  });
}

function buildNext04(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
  if (jsxTagName(node) !== 'link') return;
  const attrs = jsxAttributes(node);
  const hrefAttr = findJsxAttribute(attrs, 'href');
  const relAttr = findJsxAttribute(attrs, 'rel');
  const hrefVal = hrefAttr ? jsxAttributeValue(hrefAttr) : '';
  const relVal = relAttr ? jsxAttributeValue(relAttr) : '';
  const isGoogleFonts = typeof hrefVal === 'string' && hrefVal.includes('fonts.googleapis.com');
  const isFontsStylesheet =
    typeof relVal === 'string' && relVal.includes('stylesheet') && typeof hrefVal === 'string' && hrefVal.includes('font');
  if (!isGoogleFonts && !isFontsStylesheet) return;
  pushNode(ctx, node, {
    type: 'JSXElement',
    name: 'link',
    scopeType: classifyScope(node),
    attributes: { isExternalFontLink: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

// ---------------------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------------------

export interface RealAstBuildResult {
  nodes: ASTNode[];
  diagnostics: ReturnType<TypeScriptFrameworkParser['getDiagnostics']>;
}

/**
 * Builds every real-AST-migrated rule's ASTNode set for one source file. Never throws (the
 * underlying TypeScriptFrameworkParser guarantees this); returns an empty node list if the file
 * could not be parsed at all rather than a partial/misleading tree.
 */
export function buildRealSyntaxNodes(code: string, filePath: string, framework: FrameworkType): RealAstBuildResult {
  if (!canAttemptRealAstParse(framework)) {
    return { nodes: [], diagnostics: [] };
  }

  const parser = new TypeScriptFrameworkParser();
  parser.parse(code, filePath);
  const root = parser.getRoot();
  if (!root) {
    return { nodes: [], diagnostics: parser.getDiagnostics() };
  }

  const ctx: BuilderContext = {
    parser,
    // TypeScriptFrameworkParser's root is always a ts.SourceFile at runtime; the FrameworkParser<T>
    // interface types getRoot() as the generic TNode (ts.Node) so the abstraction stays honest
    // about not promising a more specific type than the interface contract does.
    sourceFile: root as ts.SourceFile,
    code,
    lines: code.split(/\r?\n/),
    framework,
    nodes: [],
    stateLikeNames: findStateLikeNames(root as ts.SourceFile),
  };

  const jsxEligible = isJsxRealAstEligible(framework);
  const generalEligible = isGeneralJsRealAstEligible(framework);
  const angularEligible = isAngularClassRealAstEligible(framework);
  // FIGM-NEXT-01's legacy trigger (source-parser.ts item 12) only ever creates a candidate node
  // when `framework === 'NEXT_JS' || root.attributes.isAppRouterPage` -- and isAppRouterPage
  // being true always implies detectFramework already classified the file NEXT_JS (both checks
  // test the same app/pages + page.* filename shape), so in practice this is NEXT_JS-only, NEVER
  // plain REACT_JSX, even though evalNext01's own predicate is more permissive. Confirmed by a
  // real regression: without this restriction, every REACT_JSX file using useState/useEffect
  // (i.e. nearly all of them) was incorrectly flagged FIGM-NEXT-01, which the legacy parser never
  // did. FIGM-NEXT-04's legacy trigger (item 13) has no such restriction and evalNext04 itself
  // allows REACT_JSX, so it keeps the broader gate.
  const nextEligibleStrict = framework === 'NEXT_JS';
  const nextEligibleNext04 = framework === 'NEXT_JS' || framework === 'REACT_JSX';

  if (nextEligibleStrict) buildNext03Root(ctx);

  parser.visit((node) => {
    if (generalEligible) {
      buildPerf01(ctx, node);
      buildPerf04(ctx, node);
      buildReact03(ctx, node);
      buildPerf03(ctx, node);
      buildPerf06(ctx, node);
      buildReact01(ctx, node);
    }
    if (jsxEligible) {
      buildPerf02(ctx, node);
      buildA11y01(ctx, node);
      buildA11y02(ctx, node);
      buildA11y03(ctx, node);
      buildA11y04(ctx, node);
      buildPerf05(ctx, node);
      buildA11y05(ctx, node);
      buildA11y06(ctx, node);
      buildReact04(ctx, node);
    }
    if (angularEligible) {
      buildAng01(ctx, node);
      buildAng02(ctx, node);
      buildAng05(ctx, node);
    }
    if (nextEligibleStrict) {
      buildNext01(ctx, node);
      buildNext02(ctx, node);
    }
    if (nextEligibleNext04) {
      buildNext04(ctx, node);
    }
  });

  return { nodes: ctx.nodes, diagnostics: parser.getDiagnostics() };
}
