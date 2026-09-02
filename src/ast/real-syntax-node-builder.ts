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
import { buildAngularTemplateRealSyntaxNodes } from './angular-template-ast-builder.js';
import { buildVueTemplateRealSyntaxNodes } from './vue-template-ast-builder.js';

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
  /** True when this file has SOME real, positive evidence of React/JSX content -- a `.jsx`/`.tsx`
   *  extension (REACT_JSX/NEXT_JS), a real `import ... from 'react'`, or actual JSX syntax in a
   *  plain `.js`/`.ts` file. Same signal findStateLikeNames computes for FIGM-REACT-03's `setX(...)`
   *  naming-convention gate, reused by FIGM-REACT-01 (buildReact01) for the same reason: a
   *  GENERIC_ESTREE file with zero React evidence (a build config, a Vue/vanilla-JS script) gets no
   *  benefit of the doubt before a React-specific remediation ("wrap in React.useMemo") is proposed. */
  hasReactContext: boolean;
  /** True when this file has real, positive evidence of being an Angular class file -- see
   *  `hasAngularContext`'s doc comment for the exact evidence and why FIGM-ANG-07 (buildAng07)
   *  specifically needs this gate while the other Angular rules sharing GENERIC_ESTREE eligibility
   *  do not. */
  hasAngularContext: boolean;
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
// FIGM-A11Y-04's own canonical spec (figm-spec.json / four-layer-meta-model.ts's astNodeType:
// 'JSXElement[name="Modal|Dialog|Overlay|Drawer"]') has always documented all four tag names --
// the code only ever implemented two of them (Modal/Dialog). Phase 2 (AST/Rule Coverage Gaps)
// closes that spec-vs-code gap; this is not an independent broadening decision (contrast with
// FIGM-A11Y-02's CUSTOM_CONTROL_TAG_PREFIXES below, whose narrower-than-generic scope is instead
// explicitly disclosed as an accepted knownLimitation in the spec itself, and is left unchanged).
const OVERLAY_TAG_PREFIXES = ['Modal', 'Dialog', 'Overlay', 'Drawer'];
const ARRAY_MUTATION_METHODS = new Set(['push', 'splice', 'pop', 'shift', 'unshift', 'sort']);

/** The legacy detector matches via `cTrimmed.includes('<Custom')` etc. -- a PREFIX match on the
 *  tag name (so `<CustomDropdown>` matches equally well as `<Custom>`), not an exact tag-name
 *  match. Preserved exactly (see docs/architecture/AST_MIGRATION_MAP.md §8 -- this migration
 *  changes detection *mechanism*, not detection *scope*). */
function startsWithAny(tag: string, prefixes: string[]): boolean {
  return prefixes.some((p) => tag.startsWith(p));
}

/** Collects every identifier NAME bound by a `ts.BindingName` -- a plain identifier
 *  (`item`) or an arbitrarily nested destructuring pattern (`{ id, meta: { tag } }`, `[a, b]`) --
 *  into `names`. Used to resolve exactly which names a loop/iteration-callback binds, so
 *  buildPerf01's invariance check can recognize a reference to any of them, not just a bare
 *  single-identifier loop variable. */
function collectBoundNames(binding: ts.BindingName, names: Set<string>): void {
  if (ts.isIdentifier(binding)) {
    names.add(binding.text);
    return;
  }
  for (const el of binding.elements) {
    if (ts.isOmittedExpression(el)) continue;
    collectBoundNames(el.name, names);
  }
}

/** The names bound by the nearest enclosing loop/array-iteration-callback that `node` sits inside
 *  -- e.g. `item` for `items.map(item => ...)` or `.forEach(({ id }) => ...)`, or the declared
 *  variable for `for (const item of items)`/`for (let i = 0; ...)`. Empty for `while`/`do` (which
 *  bind no per-iteration variable of their own) or when no enclosing loop exists at all. */
function loopBoundNames(node: ts.Node): Set<string> {
  const names = new Set<string>();
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (isArrayIterationCallback(current)) {
      for (const param of (current as ts.ArrowFunction | ts.FunctionExpression).parameters) {
        collectBoundNames(param.name, names);
      }
      return names;
    }
    if (ts.isForOfStatement(current) || ts.isForInStatement(current)) {
      const init = current.initializer;
      if (ts.isVariableDeclarationList(init)) {
        for (const decl of init.declarations) collectBoundNames(decl.name, names);
      }
      return names;
    }
    if (ts.isForStatement(current)) {
      if (current.initializer && ts.isVariableDeclarationList(current.initializer)) {
        for (const decl of current.initializer.declarations) collectBoundNames(decl.name, names);
      }
      return names;
    }
    if (isLoopStatement(current) || ts.isFunctionLike(current)) return names; // while/do, or exited the loop into an enclosing function
    current = current.parent;
  }
  return names;
}

/** True if any property VALUE inside `obj` references one of `boundNames` -- a real, per-item
 *  dependency on the loop's own iteration variable, which makes the object genuinely non-hoistable
 *  regardless of how deeply the reference is nested (`item.id`, `{ ...item }`, `fn(item)`, etc.).
 *  Deliberately narrow (identifier-reference matching against a known bound-name set, not general
 *  data-flow/alias analysis): sufficient to catch the direct "built from the loop variable" shape
 *  the rule's own name and existing false-positive report describe, without the much larger
 *  architectural undertaking full data-flow tracking (aliasing, reassignment, calls returning a
 *  derived value) would require -- see this rule's entry in AST_MIGRATION_MAP.md and the Phase 2
 *  task's own instruction not to overengineer past what the rule's documented intent needs. */
function referencesAnyBoundName(obj: ts.ObjectLiteralExpression, boundNames: Set<string>): boolean {
  if (boundNames.size === 0) return false;
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (ts.isIdentifier(n) && boundNames.has(n.text)) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop)) visit(prop.initializer);
    else if (ts.isShorthandPropertyAssignment(prop)) visit(prop.name);
    else if (ts.isSpreadAssignment(prop)) visit(prop.expression);
    if (found) break;
  }
  return found;
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

  // Phase 2 (AST/Rule Coverage Gaps) data-flow improvement: a declaration whose object literal is
  // built directly FROM the loop's own per-iteration variable (`items.map(item => { const cfg =
  // { id: item.id }; return cfg; })`) is not actually invariant/hoistable -- the audit's own
  // reported false positive. Checked only against the NEAREST enclosing loop/iteration-callback's
  // bound name(s), not full cross-scope data-flow (see referencesAnyBoundName's doc comment).
  if (referencesAnyBoundName(node, loopBoundNames(node))) return;

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
function collectReactHookBindings(sourceFile: ts.SourceFile): { hookCallNames: Set<string>; namespaceNames: Set<string>; hasRealReactImport: boolean } {
  const hookCallNames = new Set<string>(['useState']); // bare fallback if no traceable 'react' import exists
  const namespaceNames = new Set<string>();
  let hasRealReactImport = false;

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === 'react') {
      hasRealReactImport = true;
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
  return { hookCallNames, namespaceNames, hasRealReactImport };
}

/** True if the file contains any real JSX syntax node at all (`<Foo/>`, `<div>...</div>`,
 *  `<>...</>`). Used, alongside `hasRealReactImport`, as the minimum-bar React-context check
 *  before trusting the weaker `setX(...)` naming-convention state-evidence signal below --
 *  a real AST check, not a text/substring heuristic. */
function containsJsx(sourceFile: ts.SourceFile): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

const ANGULAR_CLASS_DECORATORS = new Set(['Component', 'Injectable', 'Directive', 'Pipe', 'NgModule']);

/** Real, file-wide evidence this file is an actual Angular class file -- an `@angular/core` import,
 *  or a decorator call matching one of the five class-level Angular decorators. Mirrors
 *  `hasReactContext`'s rationale exactly: FIGM-ANG-07 (buildAng07 below) is eligible on
 *  GENERIC_ESTREE (see `ANGULAR_CLASS_FRAMEWORKS`) precisely so its Angular-shaped concern still
 *  reaches a `.ts` file with no `.component.ts`-style filename, but its own detection predicate
 *  (`IsConstructor(n) AND ContainsNonTrivialStatement(Body(n))`) has no Angular-specific syntax
 *  requirement at all -- unlike every other Angular rule sharing that eligibility (FIGM-ANG-01/02/
 *  05/06/09), whose predicates each require actual Angular-specific syntax (RxJS `.subscribe()`,
 *  `ChangeDetectionStrategy`, `Renderer2`, `@Pipe`, `input()`/`model()`) to match at all, and so are
 *  structurally incapable of firing on a plain non-Angular class. Confirmed via a real-world
 *  re-scan (`javascript-algorithms`, a zero-Angular plain-JS repository): FIGM-ANG-07 fired 11
 *  times on ordinary data-structure class constructors (`Sort.js`, `BloomFilter.js`,
 *  `HashTable.js`, ...) recommending "move to ngOnInit" -- nonsensical advice for code with no
 *  Angular runtime. This gate closes exactly that false-positive class without narrowing ANG-07's
 *  genuine Angular-context detection at all (a real `.component.ts`/`ANGULAR_TEMPLATE` file, or any
 *  GENERIC_ESTREE `.ts` file that actually imports from `@angular/core` or carries one of these
 *  decorators, is unaffected). */
function hasAngularContext(sourceFile: ts.SourceFile): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === '@angular/core') {
      found = true;
      return;
    }
    if (ts.isDecorator(node)) {
      const expr = node.expression;
      const callee = ts.isCallExpression(expr) ? expr.expression : expr;
      if (ts.isIdentifier(callee) && ANGULAR_CLASS_DECORATORS.has(callee.text)) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
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
 *  improvement even though it is not a perfect binder.
 *
 *  The `setX(...)` naming-convention signal (evidence kind 2) is additionally gated on the file
 *  having SOME real React/JSX context (`hasReactContext` below) -- without this gate, a plain
 *  vanilla-JS file that merely happens to define its own unrelated `function setCardsData(cards)
 *  {...}` (a common, entirely non-React naming convention: `setX` for "the function that updates
 *  X", not React's hook setter) got misclassified as React state evidence purely by name
 *  coincidence. Confirmed live: `benchmarks/real-world` re-scan of `bradtraversy/vanillawebprojects`
 *  found exactly this in `memory-cards/script.js` (`cardsData.push(newCard); setCardsData(cardsData)`,
 *  zero JSX, zero React import, GENERIC_ESTREE framework) after the file-wide-evidence fix above
 *  otherwise eliminated the rest of that benchmark's FIGM-REACT-03 false positives. The
 *  `useState`-destructuring signal (evidence kind 1) needs no such gate -- it already requires an
 *  actual call to something literally named/aliased `useState` in a destructuring-assignment shape,
 *  which is not a pattern vanilla JS/config files produce by accident. */
function findStateLikeNames(sourceFile: ts.SourceFile, framework: FrameworkType): Set<string> {
  const { hookCallNames, namespaceNames, hasRealReactImport } = collectReactHookBindings(sourceFile);
  // REACT_JSX/NEXT_JS is itself already real React context: it's only reached via a `.jsx`/`.tsx`
  // file extension or a real React-content marker in detectFramework (source-parser.ts) -- e.g. a
  // literal `.jsx` fixture with no import statement in the snippet (several of this rule's own
  // committed test fixtures) still deserves the setX(...) naming-convention signal, since the file
  // extension itself is deliberate, explicit React authoring intent, not a coincidence. GENERIC_
  // ESTREE (plain .js/.ts with none of those markers) gets no such benefit of the doubt.
  const hasReactContext = framework === 'REACT_JSX' || framework === 'NEXT_JS' || hasRealReactImport || containsJsx(sourceFile);
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
    } else if (hasReactContext && ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
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

/** True if `receiver` is a bare identifier starting with an uppercase letter -- the near-universal
 *  JS/TS convention for a class, namespace, or static-API object (`Vue`, `Array`, `Object`, `Math`,
 *  `React`, a component reference), never a plain array-holding variable (which would be camelCase
 *  by the same near-universal convention). Real, reproducible false positive found via
 *  `benchmarks/real-world/SPOT_CHECK.md` #14: `Vue.filter(key, filters[key])` -- Vue's global
 *  filter-*registration* API (`Vue.filter(name, fn)`), not `Array.prototype.filter` -- was matched
 *  purely because the property name `filter` matched, with no check that the receiver could
 *  plausibly be an array. Deliberately narrow and structural (a naming-convention check on the
 *  immediate receiver, not a hardcoded list of specific library names): `Array.from(x).filter(fn)`
 *  is unaffected, since its `.filter` receiver is a `CallExpression`, not a bare identifier. */
function isLikelyNonArrayNamespaceReceiver(receiver: ts.Expression): boolean {
  return ts.isIdentifier(receiver) && /^[A-Z]/.test(receiver.text);
}

/** True if `node` is itself the receiver of an immediately-chained further derived-computation
 *  call (e.g. `node` is the `items.filter(a)` in `items.filter(a).sort(b)`). Such a node must NOT
 *  get its own diagnostic: it is not a separate violation, it is the same logical derived-
 *  computation chain the outer call (`.sort(b)`) already reports, and that outer node's own source
 *  span already covers this inner call's text. Without this check, a real `ts.SourceFile` AST
 *  walk visits both the outer and inner `CallExpression` nodes of one chain and each independently
 *  satisfies `DERIVED_COMPUTATION_METHODS`, producing two overlapping FIGM-REACT-01 diagnostics for
 *  what a developer perceives as one violation. Deliberately narrow: it only suppresses a node when
 *  the very next link in the member-access chain is ALSO a derived-computation method call -- a
 *  non-derived method in between (e.g. `.filter(a).map(b).sort(c)`) breaks the chain and both
 *  `.filter()` and `.sort()` are correctly still reported as distinct nodes, and a derived call
 *  used as an *argument* (not a receiver) to something else is never suppressed either. */
function isReceiverOfChainedDerivedComputation(node: ts.CallExpression): boolean {
  const parent = node.parent;
  if (!parent || !ts.isPropertyAccessExpression(parent) || parent.expression !== node) return false;
  const grandparent = parent.parent;
  if (!grandparent || !ts.isCallExpression(grandparent) || grandparent.expression !== parent) return false;
  return DERIVED_COMPUTATION_METHODS.has(parent.name.text);
}

function buildReact01(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isCallExpression(node)) return;
  if (!isPropertyAccessChain(node.expression)) return;
  if (!DERIVED_COMPUTATION_METHODS.has(node.expression.name.text)) return;
  if (isLikelyNonArrayNamespaceReceiver(node.expression.expression)) return;
  // Confirmed real-world-benchmark finding (SPOT_CHECK.md #6/#18): a GENERIC_ESTREE file with zero
  // React evidence (a standalone Node build script, a vanilla-JS DOM script) still satisfied this
  // predicate on an ordinary `.sort()`/`.filter()`/`.reduce()` call, producing a nonsensical "wrap
  // in React.useMemo" remediation for a file that has no React runtime at all. REACT_JSX/NEXT_JS
  // are unaffected -- those framework values are themselves already real React evidence (a `.jsx`/
  // `.tsx` extension or a real React-content marker in detectFramework), so this only narrows the
  // GENERIC_ESTREE case, which gets no benefit of the doubt without a real import/JSX signal.
  if (ctx.framework === 'GENERIC_ESTREE' && !ctx.hasReactContext) return;
  if (hasUseMemoAncestor(node)) return;
  if (isReceiverOfChainedDerivedComputation(node)) return;
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
// Group 5 (research-backed expansion set): FIGM-A11Y-07, FIGM-REACT-05, FIGM-REACT-06,
// FIGM-NEXT-05, FIGM-NEXT-06, FIGM-ANG-06. FIGM-VUE-01/02 are NOT here -- they stay
// LEGACY_TEXT_HEURISTIC in source-parser.ts (no Vue template AST available; see
// docs/research/EXPANSION_RESEARCH_TRACEABILITY.md for why).
// ---------------------------------------------------------------------------------------------

/** Real (non-whitespace/comment) text content of a JSX child, or undefined if the child is not a
 *  literal JsxText node (i.e. a dynamic `{expr}` child, which this rule deliberately does not
 *  attempt to evaluate statically -- see FIGM-A11Y-07's knownLimitation). */
function jsxLiteralTextChild(children: ts.NodeArray<ts.JsxChild>): string | undefined {
  for (const child of children) {
    if (ts.isJsxText(child)) {
      const text = child.text.replace(/\s+/g, ' ').trim();
      if (text.length > 0) return text;
    }
  }
  return undefined;
}

function buildA11y07(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isJsxElement(node)) return; // self-closing elements have no children -> no visible text
  const opening = node.openingElement;
  const attrs = jsxAttributes(opening);
  const ariaLabelAttr = findJsxAttribute(attrs, 'aria-label');
  if (!ariaLabelAttr) return;
  const ariaLabelValue = jsxAttributeValue(ariaLabelAttr);
  if (typeof ariaLabelValue !== 'string' || ariaLabelValue.trim().length === 0) return;
  const visibleText = jsxLiteralTextChild(node.children);
  if (!visibleText) return;
  const mismatch = !ariaLabelValue.toLowerCase().includes(visibleText.toLowerCase());
  if (!mismatch) return;
  // `name` is deliberately a neutral lowercase placeholder, NOT the real (possibly uppercase,
  // e.g. <CustomDropdown>) tag name -- evalA11y07 doesn't read node.name at all, but evalA11y02's
  // predicate has a loose `node.name && /^[A-Z]/.test(node.name)` fallback that treats ANY
  // uppercase-tag JSXElement node as a "custom control" candidate regardless of which builder
  // produced it. Using the real tag name here caused a live cross-rule false positive: the
  // existing FIGM-A11Y-02 negative fixture `<CustomDropdown role="combobox" aria-label="Choose
  // Option" ...>Custom Select</CustomDropdown>` (role/aria-label both present, so FIGM-A11Y-02
  // correctly does not fire on ITS OWN node) also genuinely trips FIGM-A11Y-07 (the visible text
  // "Custom Select" isn't contained in aria-label "Choose Option") -- but this rule's OWN node
  // only carries isAccessibleNameMismatch/visibleText/ariaLabel attributes, not role/aria-label,
  // so evalA11y02 mis-evaluated on this second, unrelated node too and reported a phantom
  // FIGM-A11Y-02 violation. The real tag name (needed only for cosmetic display) is preserved
  // in the `codeSnippet` attribute below, which is what createReport actually shows the user.
  // buildA11y03 already established this exact "synthesize a neutral name" precedent for the
  // same reason (see its `name: 'div'`, always, regardless of the real tag).
  pushNode(ctx, node, {
    type: 'JSXElement',
    name: 'span',
    scopeType: classifyScope(node),
    attributes: {
      isAccessibleNameMismatch: true,
      codeSnippet: lineTextFor(ctx, node),
      visibleText,
      ariaLabel: ariaLabelValue,
    },
  });
}

const STATE_SETTER_RE = /^set[A-Z]/;

/** True iff `callee` resolves (by identifier text, or `React.useEffect`/alias) to React's
 *  `useEffect` hook. Deliberately simpler than findStateLikeNames' full aliased-import tracing --
 *  a bare name/namespace check is enough here since useEffect (unlike useState) is never
 *  destructured into a differently-named local in any real-world pattern this engine has evidence
 *  for; kept consistent with buildNext01's existing CLIENT_HOOK_NAMES-style bare-name check. */
function isUseEffectCallee(callee: ts.Expression): boolean {
  if (ts.isIdentifier(callee)) return callee.text === 'useEffect';
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text === 'useEffect';
  return false;
}

function buildReact05(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isCallExpression(node) || !isUseEffectCallee(node.expression)) return;
  const fn = node.arguments[0];
  if (!fn || (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn))) return;
  const body = fn.body;
  if (!body || !ts.isBlock(body)) return; // a concise-body arrow effect can't be a bare setState call
  if (body.statements.length !== 1) return;
  const stmt = body.statements[0];
  if (!ts.isExpressionStatement(stmt) || !ts.isCallExpression(stmt.expression)) return;
  const setterCallee = stmt.expression.expression;
  if (!ts.isIdentifier(setterCallee) || !STATE_SETTER_RE.test(setterCallee.text)) return;
  pushNode(ctx, node, {
    type: 'CallExpression',
    name: 'useEffect',
    scopeType: classifyScope(node),
    attributes: { isEffectDerivedState: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

/** Names destructured directly from the enclosing component function's FIRST parameter, e.g.
 *  `function Profile({ userId, name })` -> {userId, name}. Returns an empty set for anything not
 *  a plain object-binding-pattern parameter (a single `props` identifier parameter, accessed via
 *  `props.x`, is out of scope for this pass -- see FIGM-REACT-06's knownLimitation). */
function destructuredPropNames(fn: ts.Node | undefined): Set<string> {
  const names = new Set<string>();
  if (!fn || !ts.isFunctionLike(fn)) return names;
  const param0 = (fn as ts.SignatureDeclaration).parameters[0];
  if (!param0 || !ts.isObjectBindingPattern(param0.name)) return names;
  for (const el of param0.name.elements) {
    if (ts.isIdentifier(el.name)) names.add(el.name.text);
  }
  return names;
}

/** Nearest enclosing function-like ancestor of `node` that is itself a plausible component
 *  (returns JSX, per functionReturnsJsx) -- walks past the effect callback itself. */
function nearestEnclosingComponentFunction(node: ts.Node): ts.SignatureDeclaration | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionLike(current) && functionReturnsJsx(current as ts.SignatureDeclaration)) {
      return current as ts.SignatureDeclaration;
    }
    current = current.parent;
  }
  return undefined;
}

/** Every plain Identifier reference inside `body`, not crossing into a nested function boundary
 *  (a prop read inside a nested inline callback is a separate closure concern this rule doesn't
 *  attempt to reason about). */
function collectReferencedIdentifiers(body: ts.Node): Set<string> {
  const names = new Set<string>();
  const visit = (n: ts.Node) => {
    if (n !== body && ts.isFunctionLike(n)) return;
    if (ts.isIdentifier(n) && !ts.isPropertyAccessExpression(n.parent)) names.add(n.text);
    else if (ts.isIdentifier(n) && ts.isPropertyAccessExpression(n.parent) && n.parent.expression === n) names.add(n.text);
    ts.forEachChild(n, visit);
  };
  visit(body);
  return names;
}

function dependencyArrayNames(node: ts.CallExpression): Set<string> | undefined {
  const depsArg = node.arguments[1];
  if (!depsArg || !ts.isArrayLiteralExpression(depsArg)) return undefined;
  const names = new Set<string>();
  for (const el of depsArg.elements) {
    if (ts.isIdentifier(el)) names.add(el.text);
  }
  return names;
}

function buildReact06(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isCallExpression(node) || !isUseEffectCallee(node.expression)) return;
  const fn = node.arguments[0];
  if (!fn || (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn))) return;
  const deps = dependencyArrayNames(node);
  if (!deps) return; // no dependency array at all is a different, deliberate idiom -- not this rule's concern
  const body = fn.body;
  if (!body) return;
  const propNames = destructuredPropNames(nearestEnclosingComponentFunction(node));
  if (propNames.size === 0) return;
  const referenced = collectReferencedIdentifiers(body);
  const missing = [...propNames].find((p) => referenced.has(p) && !deps.has(p) && !STATE_SETTER_RE.test(p));
  if (!missing) return;
  pushNode(ctx, node, {
    type: 'CallExpression',
    name: 'useEffect',
    scopeType: classifyScope(node),
    attributes: { isEffectMissingDependency: true, missingDependency: missing, codeSnippet: lineTextFor(ctx, node) },
  });
}

const SERVER_ONLY_MODULES = new Set([
  'fs', 'node:fs', 'fs/promises', 'node:fs/promises',
  'path', 'node:path',
  'crypto', 'node:crypto',
  'net', 'node:net',
  'child_process', 'node:child_process',
  'dns', 'node:dns',
  'tls', 'node:tls',
  'http2', 'node:http2',
  'server-only',
]);

function buildNext05(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return;
  if (!hasUseClientDirective(ctx.sourceFile)) return;
  if (!SERVER_ONLY_MODULES.has(node.moduleSpecifier.text)) return;
  pushNode(ctx, node, {
    type: 'ImportDeclaration',
    name: node.moduleSpecifier.text,
    scopeType: classifyScope(node),
    attributes: { isServerOnlyImportInClientBoundary: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

function buildNext06(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
  if (jsxTagName(node) !== 'img') return;
  const attrs = jsxAttributes(node);
  const widthAttr = findJsxAttribute(attrs, 'width');
  const heightAttr = findJsxAttribute(attrs, 'height');
  const attributes: Record<string, unknown> = { isNativeImgInNextJs: true, codeSnippet: lineTextFor(ctx, node) };
  if (widthAttr) attributes.width = jsxAttributeValue(widthAttr);
  if (heightAttr) attributes.height = jsxAttributeValue(heightAttr);
  // `name` is deliberately NOT 'img' -- evalPerf02 matches any JSXElement node named
  // img/video/iframe/embed regardless of which builder produced it, so a second 'img'-named node
  // for the exact same tag (this one) caused FIGM-PERF-02 to fire TWICE on one un-dimensioned
  // <img> (once from buildPerf02's own node, once from this one) -- a live-reproduced duplicate
  // diagnostic, same root cause and same "synthesize a neutral name" fix as buildA11y07 above.
  // evalNext06 itself never reads node.name, so this is safe for FIGM-NEXT-06's own detection.
  pushNode(ctx, node, {
    type: 'JSXElement',
    name: 'span',
    scopeType: classifyScope(node),
    attributes,
  });
}

function buildAng06(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isDecorator(node)) return;
  const expr = node.expression;
  if (!ts.isCallExpression(expr) || !ts.isIdentifier(expr.expression) || expr.expression.text !== 'Pipe') return;
  const arg = expr.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) return;
  const pureProp = arg.properties.find(
    (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'pure'
  );
  if (!pureProp || pureProp.initializer.kind !== ts.SyntaxKind.FalseKeyword) return;
  pushNode(ctx, node, {
    type: 'ClassDeclaration',
    name: 'Pipe',
    scopeType: 'MODULE',
    attributes: { isImpurePipe: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

// ---------------------------------------------------------------------------------------------
// Group 6 (second expansion pass, Next.js): FIGM-NEXT-07, FIGM-NEXT-08, FIGM-NEXT-09, FIGM-NEXT-10
// ---------------------------------------------------------------------------------------------

function buildNext07(ctx: BuilderContext, node: ts.Node): void {
  if (!hasUseClientDirective(ctx.sourceFile)) return;
  if (!ts.isFunctionDeclaration(node) || !node.body) return;
  const isAsync = !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
  if (!isAsync) return;
  if (!functionReturnsJsx(node)) return;
  pushNode(ctx, node, {
    type: 'FunctionDeclaration',
    name: node.name?.text ?? 'anonymous',
    scopeType: 'MODULE',
    attributes: { isAsyncClientComponent: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

function fileHasJsxElementNamed(sourceFile: ts.SourceFile, tagName: string): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && jsxTagName(node) === tagName) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/** Root-level (not per-node) check, matching buildNext03Root's own convention -- only the FIRST
 *  useSearchParams() call site is reported per file, since the file-wide "is there a Suspense
 *  boundary anywhere" question is a single fact, not a per-call-site one. */
function buildNext08Root(ctx: BuilderContext): void {
  if (fileHasJsxElementNamed(ctx.sourceFile, 'Suspense')) return;
  let callSite: ts.CallExpression | undefined;
  const visit = (node: ts.Node) => {
    if (callSite) return;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useSearchParams') {
      callSite = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(ctx.sourceFile);
  if (!callSite) return;
  pushNode(ctx, callSite, {
    type: 'CallExpression',
    name: 'useSearchParams',
    scopeType: classifyScope(callSite),
    attributes: { isUnsuspendedSearchParams: true, codeSnippet: lineTextFor(ctx, callSite) },
  });
}

const METADATA_EXPORT_NAMES = new Set(['generateMetadata', 'generateViewport']);

function fileMetadataExportNode(sourceFile: ts.SourceFile): ts.Node | undefined {
  for (const stmt of sourceFile.statements) {
    if (ts.isVariableStatement(stmt)) {
      const isExported = !!stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (isExported && stmt.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === 'metadata')) {
        return stmt;
      }
    }
    if (ts.isFunctionDeclaration(stmt)) {
      const isExported = !!stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (isExported && stmt.name && METADATA_EXPORT_NAMES.has(stmt.name.text)) {
        return stmt;
      }
    }
  }
  return undefined;
}

function buildNext09Root(ctx: BuilderContext): void {
  if (!hasUseClientDirective(ctx.sourceFile)) return;
  const node = fileMetadataExportNode(ctx.sourceFile);
  if (!node) return;
  pushNode(ctx, node, {
    type: 'ExportNamedDeclaration',
    name: 'metadata',
    scopeType: 'MODULE',
    attributes: { isMetadataInClientBoundary: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

function fileHasRequestTimeApiCall(code: string): boolean {
  if (/\bcookies\s*\(/.test(code) || /\bheaders\s*\(/.test(code) || /\bdraftMode\s*\(/.test(code)) return true;
  if (/cache\s*:\s*['"]no-store['"]/.test(code)) return true;
  if (/next\s*:\s*\{[^}]*revalidate\s*:\s*0/.test(code)) return true;
  return false;
}

function buildNext10Root(ctx: BuilderContext): void {
  let dynamicNode: ts.Node | undefined;
  for (const stmt of ctx.sourceFile.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    const isExported = !!stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExported) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (
        ts.isIdentifier(decl.name) &&
        decl.name.text === 'dynamic' &&
        decl.initializer &&
        ts.isStringLiteral(decl.initializer) &&
        decl.initializer.text === 'force-dynamic'
      ) {
        dynamicNode = stmt;
      }
    }
  }
  if (!dynamicNode) return;
  if (fileHasRequestTimeApiCall(ctx.code)) return;
  pushNode(ctx, dynamicNode, {
    type: 'ExportNamedDeclaration',
    name: 'dynamic',
    scopeType: 'MODULE',
    attributes: { isUnjustifiedForceDynamic: true, codeSnippet: lineTextFor(ctx, dynamicNode) },
  });
}

// ---------------------------------------------------------------------------------------------
// Group 6 (second expansion pass, Angular class-body): FIGM-ANG-07, FIGM-ANG-09
// (FIGM-ANG-08/FIGM-ANG-10 are template-markup rules -- LEGACY_TEXT_HEURISTIC in source-parser.ts)
// ---------------------------------------------------------------------------------------------

function buildAng07(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isConstructorDeclaration(node) || !node.body) return;
  // Confirmed real-world false-positive class (javascript-algorithms, a zero-Angular plain-JS
  // repository -- 11 findings on ordinary data-structure class constructors, e.g. Sort.js,
  // BloomFilter.js, HashTable.js, none related to Angular in any way): unlike every other Angular
  // rule sharing GENERIC_ESTREE eligibility, this predicate has no Angular-specific syntax
  // requirement of its own, so a GENERIC_ESTREE file needs real, positive Angular evidence before
  // this fires at all -- see hasAngularContext's doc comment.
  if (ctx.framework === 'GENERIC_ESTREE' && !ctx.hasAngularContext) return;
  const hasCallExpression = (stmt: ts.Node): boolean => {
    let found = false;
    const visit = (n: ts.Node) => {
      if (found) return;
      if (ts.isCallExpression(n)) {
        found = true;
        return;
      }
      ts.forEachChild(n, visit);
    };
    visit(stmt);
    return found;
  };
  // A bare `this.x = y;` field assignment is trivial; ANY CallExpression inside a constructor
  // statement (a service method call, subscribe(), an HTTP-shaped call) is not -- see
  // FIGM-ANG-07's knownLimitation for why this is deliberately broad rather than trying to
  // distinguish "cheap" from "expensive" calls.
  const hasNonTrivialLogic = node.body.statements.some(hasCallExpression);
  if (!hasNonTrivialLogic) return;
  pushNode(ctx, node, {
    type: 'ClassDeclaration',
    name: 'constructor',
    scopeType: 'MODULE',
    attributes: { isComplexConstructorLogic: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

function buildAng09(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isPropertyDeclaration(node)) return;
  if (!node.initializer || !ts.isCallExpression(node.initializer)) return;
  const callee = node.initializer.expression;
  if (!ts.isIdentifier(callee) || (callee.text !== 'input' && callee.text !== 'model')) return;
  const hasReadonly = !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword);
  if (hasReadonly) return;
  pushNode(ctx, node, {
    type: 'ClassDeclaration',
    name: callee.text,
    scopeType: 'MODULE',
    attributes: { isMutableSignalInput: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

// ---------------------------------------------------------------------------------------------
// Group 6 (second expansion pass, React): FIGM-REACT-07 .. FIGM-REACT-11
// ---------------------------------------------------------------------------------------------

const HOOK_NAME_RE = /^use[A-Z0-9]/;

/** Own binding name of a function-like node, where determinable: a FunctionDeclaration's own
 *  name, or the identifier a function/arrow EXPRESSION is assigned to via `const name = ...`.
 *  Returns undefined for an anonymous callback argument, matching functionOwnName's limited
 *  scope everywhere else in this file. */
function functionOwnName(fn: ts.Node): string | undefined {
  if (ts.isFunctionDeclaration(fn) && fn.name) return fn.name.text;
  const parent = fn.parent;
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  return undefined;
}

/** True if `fn` is a legitimate place to call a Hook: a custom Hook (name starts with "use") or
 *  a component (returns JSX, per functionReturnsJsx -- already used throughout this file for the
 *  identical "is this a component" question). */
function isValidHookHost(fn: ts.Node): boolean {
  const name = functionOwnName(fn);
  if (name && HOOK_NAME_RE.test(name)) return true;
  return ts.isFunctionLike(fn) && functionReturnsJsx(fn as ts.SignatureDeclaration);
}

function buildReact07(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || !HOOK_NAME_RE.test(node.expression.text)) return;
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isIfStatement(current) || ts.isConditionalExpression(current) || isLoopStatement(current) || ts.isSwitchStatement(current) || ts.isCatchClause(current)) {
      pushNode(ctx, node, {
        type: 'CallExpression',
        name: (node.expression as ts.Identifier).text,
        scopeType: classifyScope(node),
        attributes: { isMisplacedHookCall: true, codeSnippet: lineTextFor(ctx, node) },
      });
      return;
    }
    if (ts.isFunctionLike(current)) {
      // Reached the nearest enclosing function boundary. This half of the predicate is about a
      // Hook called from inside a NESTED, ordinary function -- e.g. a `.forEach` callback or a
      // helper defined inside the real component -- not about whether `current` itself "looks
      // like" a component. A Hook called as a direct top-level statement of `current` is, by
      // definition, at that function's own top level; whether `current` further up is nested
      // inside something else is a separate, orthogonal question this predicate does not decide
      // for `current` itself (only for an inner function found on a later iteration).
      //
      // Confirmed as a real, reproducible false positive (not a fixture-shape artifact): the
      // catalog's own FIGM-REACT-07 compliantExample -- `function Profile({ isActive }) { const
      // [count, setCount] = useState(0); if (isActive) { ... } }`, a Hook called as literally the
      // first statement of Profile's body, no nesting at all -- was being flagged solely because
      // `isValidHookHost` requires a `use`-prefixed name or a JSX return, and this bare example has
      // neither (see audit/SYNTHETIC-GUIDELINE-COVERAGE-REPORT.md for the full reproduction).
      // isValidHookHost still correctly gates a genuinely NESTED function (there IS a further
      // function-like ancestor above `current`), which is the only case that check was ever meant
      // to cover -- see the two existing [TP] "nested ordinary function" cases in
      // tests/expansion-2-rules.test.ts, both still green after this change.
      let outer: ts.Node | undefined = current.parent;
      while (outer && !ts.isFunctionLike(outer)) outer = outer.parent;
      const currentIsNestedInAnotherFunction = !!outer;
      if (currentIsNestedInAnotherFunction && !isValidHookHost(current)) {
        pushNode(ctx, node, {
          type: 'CallExpression',
          name: (node.expression as ts.Identifier).text,
          scopeType: classifyScope(node),
          attributes: { isMisplacedHookCall: true, codeSnippet: lineTextFor(ctx, node) },
        });
      }
      return;
    }
    current = current.parent;
  }
}

function buildReact08(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isExpressionStatement(node)) return;
  const expr = node.expression;
  const componentFn = nearestEnclosingComponentFunction(node);
  if (!componentFn) return;
  const propNames = destructuredPropNames(componentFn);
  if (propNames.size === 0) return;

  const isProvablePropTarget = (target: ts.Expression): boolean => {
    if (isExcludedMutationTarget(target)) return false;
    const root = getRootIdentifierName(target);
    return !!root && propNames.has(root);
  };

  if (ts.isCallExpression(expr) && isPropertyAccessChain(expr.expression) && ARRAY_MUTATION_METHODS.has(expr.expression.name.text)) {
    if (!isProvablePropTarget(expr.expression.expression)) return;
    pushNode(ctx, node, {
      type: 'ExpressionStatement',
      name: 'mutateProp',
      scopeType: classifyScope(node),
      attributes: { isDirectPropMutation: true, codeSnippet: lineTextFor(ctx, node) },
    });
    return;
  }
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.EqualsToken && isPropertyAccessChain(expr.left)) {
    if (!isProvablePropTarget(expr.left)) return;
    pushNode(ctx, node, {
      type: 'ExpressionStatement',
      name: 'mutateProp',
      scopeType: classifyScope(node),
      attributes: { isDirectPropMutation: true, codeSnippet: lineTextFor(ctx, node) },
    });
  }
}

const RENDER_SIDE_EFFECT_MEMBER_CALLS: Array<{ objectText: string; methodText: string }> = [
  { objectText: 'localStorage', methodText: 'setItem' },
  { objectText: 'sessionStorage', methodText: 'setItem' },
];

function isRenderSideEffectCall(node: ts.CallExpression): boolean {
  if (ts.isIdentifier(node.expression) && node.expression.text === 'fetch') return true;
  if (isPropertyAccessChain(node.expression)) {
    const obj = node.expression.expression;
    if (ts.isIdentifier(obj)) {
      return RENDER_SIDE_EFFECT_MEMBER_CALLS.some((c) => c.objectText === obj.text && c.methodText === (node.expression as ts.PropertyAccessExpression).name.text);
    }
  }
  return false;
}

/** Nearest function-like ancestor of `node` (the same walk classifyScope does internally, but
 *  returning the node itself rather than just its RENDER/FUNCTION classification) -- needed so
 *  buildReact09 can additionally check whether that function is async. */
function nearestFunctionLikeAncestor(node: ts.Node): ts.Node | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionLike(current)) return current;
    current = current.parent;
  }
  return undefined;
}

function buildReact09(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isCallExpression(node) || !isRenderSideEffectCall(node)) return;
  // classifyScope walks up to the NEAREST function-like ancestor and classifies by whether THAT
  // function returns JSX -- a call already inside a useEffect/event-handler callback therefore
  // classifies as FUNCTION (that inner callback doesn't return JSX), not RENDER, so this check
  // correctly excludes the legitimate cases without any extra "am I inside an Effect" walk.
  if (classifyScope(node) !== 'RENDER') return;
  // An ASYNC component function is a Next.js Server Component (a plain React/Client Component
  // cannot be async at all -- see FIGM-NEXT-07), which renders once on the server; fetching data
  // directly in its body is the documented, correct Next.js pattern, not a purity violation --
  // live-reproduced false positive: `export default async function Page() { const posts = await
  // fetch(...); return <PostList posts={posts} />; }` (this rule's own FIGM-NEXT-10 compliant
  // example) was originally flagged here before this exclusion was added.
  const owner = nearestFunctionLikeAncestor(node);
  const isAsyncOwner = !!owner && ts.canHaveModifiers(owner) && !!ts.getModifiers(owner)?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
  if (isAsyncOwner) return;
  pushNode(ctx, node, {
    type: 'CallExpression',
    name: node.expression.getText(ctx.sourceFile),
    scopeType: 'RENDER',
    attributes: { isRenderSideEffect: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

function collectInFileComponentNames(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name && /^[A-Z]/.test(node.name.text) && functionReturnsJsx(node)) {
      names.add(node.name.text);
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      /^[A-Z]/.test(node.name.text) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
      functionReturnsJsx(node.initializer)
    ) {
      names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
}

function isInsideJsxExpressionContainer(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isJsxExpression(current)) return true;
    if (ts.isFunctionLike(current)) return false; // don't cross into a nested, non-JSX callback scope
    current = current.parent;
  }
  return false;
}

function buildReact10(ctx: BuilderContext, node: ts.Node, inFileComponentNames: Set<string>): void {
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || !/^[A-Z]/.test(node.expression.text)) return;
  if (!inFileComponentNames.has(node.expression.text)) return;
  if (!isInsideJsxExpressionContainer(node)) return;
  pushNode(ctx, node, {
    type: 'CallExpression',
    name: node.expression.text,
    scopeType: classifyScope(node),
    attributes: { isComponentCalledAsFunction: true, hasArgs: node.arguments.length > 0, codeSnippet: lineTextFor(ctx, node) },
  });
}

function buildReact11(ctx: BuilderContext, node: ts.Node): void {
  if (!ts.isJsxAttribute(node)) return;
  if (node.name.getText(ctx.sourceFile) !== 'value') return;
  const owner = node.parent?.parent;
  if (!owner || (!ts.isJsxOpeningElement(owner) && !ts.isJsxSelfClosingElement(owner))) return;
  if (!jsxTagName(owner).endsWith('.Provider')) return;
  const init = node.initializer;
  if (!init || !ts.isJsxExpression(init) || !init.expression) return;
  const expr = unwrapParens(init.expression);
  if (!ts.isObjectLiteralExpression(expr) && !ts.isArrayLiteralExpression(expr)) return;
  pushNode(ctx, node, {
    type: 'JSXAttribute',
    name: 'value',
    scopeType: classifyScope(node),
    attributes: { isUnmemoizedContextValue: true, codeSnippet: lineTextFor(ctx, node) },
  });
}

// ---------------------------------------------------------------------------------------------
// Group 7 (second expansion pass, Vue <script> block): FIGM-VUE-03 .. FIGM-VUE-06
//
// No @vue/compiler-sfc dependency required: a .vue file's <script>/<script setup> block content
// IS plain TypeScript/JavaScript, so it is extracted with a simple regex boundary-find and
// re-parsed with the SAME TypeScriptFrameworkParser class every other real-AST rule in this file
// already uses -- this is a genuine, honest REAL_AST claim (the extracted TEXT is parsed by the
// real compiler; only locating WHERE that text starts in the original file is a text-level
// operation, unavoidable for any multi-language container format without a format-aware parser).
// The <template> block (FIGM-VUE-01/02) stays LEGACY_TEXT_HEURISTIC -- that genuinely needs a
// real Vue template parser, which this environment could not install (no npm registry access;
// see docs/research/EXPANSION_2_RESEARCH_TRACEABILITY.md).
// ---------------------------------------------------------------------------------------------

function extractVueScriptBlock(code: string): { content: string; lineOffset: number } | undefined {
  const match = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/.exec(code);
  if (!match) return undefined;
  const openTagEnd = match.index + match[0].indexOf('>') + 1;
  const startLine = code.slice(0, openTagEnd).split(/\r?\n/).length;
  return { content: match[1], lineOffset: startLine - 1 };
}

const VUE_ARRAY_MUTATORS = new Set(['push', 'splice', 'pop', 'shift', 'unshift', 'sort']);

/** True iff `expr` is EXACTLY `<name>.value` for some name in `validNames` -- used to find the
 *  array-mutator call TARGET (e.g. the `sortedItems.value` object `.push()` is called on). */
function isExactDotValue(expr: ts.Expression, validNames: Set<string>): string | undefined {
  if (!ts.isPropertyAccessExpression(expr) || expr.name.text !== 'value' || !ts.isIdentifier(expr.expression)) return undefined;
  return validNames.has(expr.expression.text) ? expr.expression.text : undefined;
}

/** True iff `expr` is a chain that goes THROUGH `<name>.value` but is not `<name>.value` itself
 *  (e.g. `sortedItems.value.foo`) -- deliberately excludes a bare `sortedItems.value = x`
 *  reassignment, which Vue's OWN reactivity system already runtime-warns about on its own; see
 *  FIGM-VUE-04's knownLimitation for why that exclusion is the whole point of this rule. */
function isDeeperThanDotValue(expr: ts.Expression, validNames: Set<string>): string | undefined {
  if (isExactDotValue(expr, validNames)) return undefined;
  let base: ts.Expression = expr;
  while (ts.isPropertyAccessExpression(base) || ts.isElementAccessExpression(base)) {
    const inner: ts.Expression = ts.isPropertyAccessExpression(base) ? base.expression : (base as ts.ElementAccessExpression).expression;
    const hit = isExactDotValue(inner, validNames);
    if (hit) return hit;
    base = inner;
  }
  return undefined;
}

/** Walks all the way down an access chain to its root identifier and checks membership --
 *  unlike the computed-ref case above, props mutation has no special "already runtime-warned at
 *  exactly one depth" carve-out to replicate, so any depth counts (see FIGM-VUE-05's rule
 *  description: `props.todo.done = true` is the rule's own canonical example). */
function propsChainRootName(expr: ts.Expression, validNames: Set<string>): string | undefined {
  let base: ts.Expression = expr;
  while (ts.isPropertyAccessExpression(base) || ts.isElementAccessExpression(base)) {
    base = ts.isPropertyAccessExpression(base) ? base.expression : (base as ts.ElementAccessExpression).expression;
  }
  return ts.isIdentifier(base) && validNames.has(base.text) ? base.text : undefined;
}

function vueGetterBlockOf(call: ts.CallExpression): ts.Block | undefined {
  const arg0 = call.arguments[0];
  if (arg0 && (ts.isArrowFunction(arg0) || ts.isFunctionExpression(arg0)) && arg0.body && ts.isBlock(arg0.body)) {
    return arg0.body;
  }
  if (arg0 && ts.isObjectLiteralExpression(arg0)) {
    // Writable computed: { get: () => {...}, set: (v) => {...} } -- only the getter is checked;
    // the setter's entire purpose is to cause a side effect, so it is deliberately not scanned.
    const getProp = arg0.properties.find((p): p is ts.MethodDeclaration | ts.PropertyAssignment =>
      (ts.isMethodDeclaration(p) || ts.isPropertyAssignment(p)) && !!p.name && ts.isIdentifier(p.name) && p.name.text === 'get'
    );
    if (getProp && ts.isMethodDeclaration(getProp) && getProp.body) return getProp.body;
    if (
      getProp &&
      ts.isPropertyAssignment(getProp) &&
      (ts.isArrowFunction(getProp.initializer) || ts.isFunctionExpression(getProp.initializer)) &&
      getProp.initializer.body &&
      ts.isBlock(getProp.initializer.body)
    ) {
      return getProp.initializer.body;
    }
  }
  return undefined;
}

function vueComputedBodyHasSideEffect(body: ts.Block): boolean {
  return body.statements.some((stmt) => {
    let found = false;
    const visit = (n: ts.Node) => {
      if (found) return;
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        if (ts.isPropertyAccessExpression(n.left) && n.left.name.text === 'value') {
          found = true;
          return;
        }
      }
      if (ts.isCallExpression(n)) {
        const callee = n.expression;
        if (ts.isIdentifier(callee) && callee.text === 'fetch') {
          found = true;
          return;
        }
        if (
          ts.isPropertyAccessExpression(callee) &&
          ts.isIdentifier(callee.expression) &&
          (callee.expression.text === 'localStorage' || callee.expression.text === 'sessionStorage') &&
          callee.name.text === 'setItem'
        ) {
          found = true;
          return;
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(stmt);
    return found;
  });
}

function isWithinComputedDefinition(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isCallExpression(current) && ts.isIdentifier(current.expression) && current.expression.text === 'computed') return true;
    current = current.parent;
  }
  return false;
}

/**
 * Builds FIGM-VUE-03/04/05/06's ASTNode set from a .vue file's extracted <script> block. Never
 * throws (mirrors buildRealSyntaxNodes' own guarantee); returns an empty list if there is no
 * <script> block or it fails to parse.
 */
export function buildVueScriptRealSyntaxNodes(code: string, filePath: string): ASTNode[] {
  const block = extractVueScriptBlock(code);
  if (!block) return [];

  const parser = new TypeScriptFrameworkParser();
  parser.parse(block.content, filePath);
  const root = parser.getRoot() as ts.SourceFile | null;
  if (!root) return [];

  const nodes: ASTNode[] = [];
  const originalLines = code.split(/\r?\n/);

  const push = (node: ts.Node, astNode: RealAstNodeInput): void => {
    const local = parser.getSourceRange(node);
    nodes.push({
      ...astNode,
      loc: {
        start: { line: local.start.line + block.lineOffset, column: local.start.column },
        end: { line: local.end.line + block.lineOffset, column: local.end.column },
      },
      sourceKind: 'REAL_AST',
    });
  };
  const snippetFor = (node: ts.Node): string => {
    const local = parser.getSourceRange(node);
    const realLine = local.start.line + block.lineOffset;
    return (originalLines[realLine - 1] ?? node.getText(root)).trim();
  };

  const computedNames = new Set<string>();
  const propsNames = new Set<string>();
  const collectBindings = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression)) {
      if (node.initializer.expression.text === 'computed') computedNames.add(node.name.text);
      if (node.initializer.expression.text === 'defineProps') propsNames.add(node.name.text);
    }
    ts.forEachChild(node, collectBindings);
  };
  collectBindings(root);

  const visitAll = (node: ts.Node) => {
    // FIGM-VUE-03: side effect inside computed() getter
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'computed') {
      const body = vueGetterBlockOf(node);
      if (body && vueComputedBodyHasSideEffect(body)) {
        push(node, { type: 'CallExpression', name: 'computed', attributes: { isComputedSideEffect: true, codeSnippet: snippetFor(node) } });
      }
    }

    if (!isWithinComputedDefinition(node)) {
      // FIGM-VUE-04 (computed result mutation) / FIGM-VUE-05 (prop mutation): assignment shape
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        if (isDeeperThanDotValue(node.left, computedNames)) {
          push(node, { type: 'BinaryExpression', name: 'mutateComputed', attributes: { isComputedResultMutation: true, codeSnippet: snippetFor(node) } });
        }
        if (propsChainRootName(node.left, propsNames)) {
          push(node, { type: 'BinaryExpression', name: 'mutateProp', attributes: { isPropMutation: true, codeSnippet: snippetFor(node) } });
        }
      }
      // FIGM-VUE-04 / FIGM-VUE-05: array-mutator call shape
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && VUE_ARRAY_MUTATORS.has(node.expression.name.text)) {
        const target = node.expression.expression;
        if (isExactDotValue(target, computedNames)) {
          push(node, { type: 'CallExpression', name: 'mutateComputed', attributes: { isComputedResultMutation: true, codeSnippet: snippetFor(node) } });
        }
        if (propsChainRootName(target, propsNames)) {
          push(node, { type: 'CallExpression', name: 'mutateProp', attributes: { isPropMutation: true, codeSnippet: snippetFor(node) } });
        }
      }
    }

    // FIGM-VUE-06: arrow function used as an Options API methods{} property
    if (ts.isExportAssignment(node) && !node.isExportEquals && ts.isObjectLiteralExpression(node.expression)) {
      const methodsProp = node.expression.properties.find(
        (p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'methods'
      );
      if (methodsProp && ts.isObjectLiteralExpression(methodsProp.initializer)) {
        for (const m of methodsProp.initializer.properties) {
          if (ts.isPropertyAssignment(m) && ts.isArrowFunction(m.initializer)) {
            push(m, {
              type: 'ArrowFunction',
              name: ts.isIdentifier(m.name) ? m.name.text : 'method',
              attributes: { isArrowOptionsMethod: true, codeSnippet: snippetFor(m) },
            });
          }
        }
      }
    }

    ts.forEachChild(node, visitAll);
  };
  visitAll(root);

  return nodes;
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
  // VUE_SFC is a special case: canAttemptRealAstParse (below) correctly excludes it from the
  // whole-file TypeScript parse attempt every other framework goes through (a raw .vue file,
  // template markup and all, is not valid TS/JSX) -- but its <script> block content alone IS,
  // so FIGM-VUE-03..06 get real detection via buildVueScriptRealSyntaxNodes's own, separate,
  // self-contained parse of just that extracted block. FIGM-VUE-01/02 (template-markup rules)
  // get the analogous treatment via buildVueTemplateRealSyntaxNodes, a real @vue/compiler-dom
  // parse of the <template> block -- the same "extract a sub-language and parse it with its own
  // real parser" pattern used for both halves of this file and for Angular's inline template.
  // Returns here rather than falling through to the whole-file parse below, which would fail on
  // the surrounding <template>/<style> markup.
  if (framework === 'VUE_SFC') {
    return {
      nodes: [...buildVueScriptRealSyntaxNodes(code, filePath), ...buildVueTemplateRealSyntaxNodes(code, filePath)],
      diagnostics: [],
    };
  }

  if (!canAttemptRealAstParse(framework)) {
    return { nodes: [], diagnostics: [] };
  }

  const parser = new TypeScriptFrameworkParser();
  parser.parse(code, filePath);
  const root = parser.getRoot();
  if (!root) {
    return { nodes: [], diagnostics: parser.getDiagnostics() };
  }

  // Same "does this file have real React evidence" signal findStateLikeNames computes internally
  // for its own setX(...) naming-convention gate -- computed once more here (a cheap, import/JSX-
  // only pass, not a second full walk) so buildReact01 can reuse it without reaching into
  // findStateLikeNames' private logic.
  const hasReactContext =
    framework === 'REACT_JSX' || framework === 'NEXT_JS' ||
    collectReactHookBindings(root as ts.SourceFile).hasRealReactImport ||
    containsJsx(root as ts.SourceFile);

  // ANGULAR_TEMPLATE files are already Angular by construction (framework detection already
  // required real Angular evidence to assign that value); only GENERIC_ESTREE needs the file-wide
  // scan, mirroring hasReactContext's own framework-vs-scan split.
  const hasAngularContextValue =
    framework === 'ANGULAR_TEMPLATE' || hasAngularContext(root as ts.SourceFile);

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
    stateLikeNames: findStateLikeNames(root as ts.SourceFile, framework),
    hasReactContext,
    hasAngularContext: hasAngularContextValue,
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
  // Group 5 eligibility: FIGM-REACT-05/06 apply to the same three frameworks as FIGM-REACT-01/03
  // (REACT_JSX/NEXT_JS/GENERIC_ESTREE) -- deliberately NOT ANGULAR_TEMPLATE, unlike generalEligible,
  // since useEffect-shaped derived-state/dependency bugs are a React-hooks-specific concern with
  // no Angular equivalent.
  const react0506Eligible = framework === 'REACT_JSX' || framework === 'NEXT_JS' || framework === 'GENERIC_ESTREE';
  // Group 6/7 eligibility (second expansion pass): FIGM-REACT-07..11 apply to the same three
  // frameworks as FIGM-REACT-05/06 above -- same rationale (React-hooks/JSX-specific concerns).
  const react0711Eligible = react0506Eligible;
  const inFileComponentNames = react0711Eligible ? collectInFileComponentNames(ctx.sourceFile) : new Set<string>();

  if (nextEligibleStrict) {
    buildNext03Root(ctx);
    buildNext08Root(ctx);
    buildNext09Root(ctx);
    buildNext10Root(ctx);
  }

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
      buildA11y07(ctx, node);
    }
    if (angularEligible) {
      buildAng01(ctx, node);
      buildAng02(ctx, node);
      buildAng05(ctx, node);
      buildAng06(ctx, node);
      buildAng07(ctx, node);
      buildAng09(ctx, node);
    }
    if (nextEligibleStrict) {
      buildNext01(ctx, node);
      buildNext02(ctx, node);
      buildNext05(ctx, node);
      buildNext06(ctx, node);
      buildNext07(ctx, node);
    }
    if (nextEligibleNext04) {
      buildNext04(ctx, node);
    }
    if (react0506Eligible) {
      buildReact05(ctx, node);
      buildReact06(ctx, node);
    }
    if (react0711Eligible) {
      buildReact07(ctx, node);
      buildReact08(ctx, node);
      buildReact09(ctx, node);
      buildReact10(ctx, node, inFileComponentNames);
      buildReact11(ctx, node);
    }
  });

  // FIGM-ANG-03/04/08/10 (template-markup rules) -- real AST via a SEPARATE parse of the file's
  // extracted inline template block (angular-html-parser), the same "extract a sub-language's
  // text and re-parse it" pattern buildVueScriptRealSyntaxNodes already established for Vue.
  // Deliberately gated on the same angularEligible condition as the class-body Angular rules
  // above (ANGULAR_TEMPLATE and GENERIC_ESTREE, matching FIGM-ANG-03/04's own existing framework
  // predicate in ASTDetectionEngine) rather than a narrower one -- extractAngularTemplateBlock is
  // a safe no-op on any file with no inline `template: \`...\`` property, no `@Component(`
  // decorator, and a non-`.html` filename (fixed real-world defect -- see its own doc comment).
  if (angularEligible) {
    ctx.nodes.push(...buildAngularTemplateRealSyntaxNodes(code, filePath));
  }

  return { nodes: ctx.nodes, diagnostics: parser.getDiagnostics() };
}
