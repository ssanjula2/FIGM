/**
 * Framework-Independent Guideline Model (FIGM)
 * Stage A Migration — Genuine TypeScript-Compiler-API AST Analysis for React/JS/TS
 *
 * This module is FIGM's first real-AST-backed rule implementation. Every other rule in
 * src/ast/ast-detection-engine.ts decides "did this violation occur" by reading boolean flags
 * that src/parser/source-parser.ts set via regex/substring matching on individual source lines —
 * see docs/audit/AST_ARCHITECTURE_AUDIT.md for the full trace and rule-by-rule classification.
 * That is real, working pattern-based analysis, but it is not AST-based: the "ASTNode" tree it
 * produces is a synthetic shape (real `type`/`loc`/`attributes` fields) populated from text
 * matches, not from a parser that actually understands JavaScript/JSX grammar or scope.
 *
 * FIGM-REACT-02 ("array index used as list `key`") is migrated here to use the real `typescript`
 * compiler API (`ts.createSourceFile` + a real AST visitor), because it is the rule where that
 * distinction has a directly demonstrable, testable effect: detecting "is this JSX attribute's
 * expression exactly the index parameter bound by the enclosing `.map((item, N) => ...)`
 * callback" requires understanding real parameter binding and lexical scope, not just seeing the
 * literal substrings "key={index}" / "key={i}" / "key={idx}" the regex version hardcodes. See
 * tests/react-ast-rules.test.ts for concrete cases the regex version gets wrong that this gets
 * right (a differently-named index parameter; a same-named-but-unrelated local variable; a
 * template-literal key) and cases both correctly agree on (existing regression fixtures).
 *
 * This module deliberately does NOT attempt to migrate every rule at once (see the phased
 * migration plan referenced above) — it is scoped to exactly one rule, for exactly the two
 * frameworks (`REACT_JSX`, `NEXT_JS`) where genuine JSX/TSX parsing applies, and is wired in
 * additively by RuleExecutionEngine (it replaces only FIGM-REACT-02's regex-based diagnostics for
 * those two frameworks; every other rule and every other framework is completely unaffected).
 */

import * as ts from 'typescript';
import { DiagnosticReport, FrameworkType } from '../types/ast-spec.js';
import { FOUR_LAYER_MAPPINGS } from '../matrix/four-layer-meta-model.js';
import { getStandardReference } from '../matrix/standard-clause-mapping.js';

const SUPPORTED_FRAMEWORKS: FrameworkType[] = ['REACT_JSX', 'NEXT_JS'];

export function supportsRealAstAnalysis(framework: FrameworkType): boolean {
  return SUPPORTED_FRAMEWORKS.includes(framework);
}

/**
 * True if `expr` is exactly a reference to `indexName` (a bare identifier), or a template
 * literal whose only interpolation is a bare reference to `indexName` (e.g. `` `row-${index}` ``
 * — a common real-world pattern the old substring check `key={index}` cannot see at all, since
 * the literal text "key={index}" never appears in that source).
 */
function expressionIsIndexDerived(expr: ts.Expression, indexName: string): boolean {
  if (ts.isIdentifier(expr)) {
    return expr.text === indexName;
  }
  if (ts.isTemplateExpression(expr)) {
    if (expr.templateSpans.length !== 1) return false;
    const span = expr.templateSpans[0];
    return ts.isIdentifier(span.expression) && span.expression.text === indexName;
  }
  return false;
}

/** Finds the nearest enclosing `.map((item, <index>) => ...)` callback's index parameter name that is in scope at `node`, or null if `node` isn't inside one. */
function findEnclosingMapIndexBinding(node: ts.Node): string | null {
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
      if (isMapCall && current.parameters.length >= 2) {
        const indexParam = current.parameters[1];
        if (ts.isIdentifier(indexParam.name)) {
          return indexParam.name.text;
        }
      }
    }
    current = current.parent;
  }
  return null;
}

function buildReport(sourceFile: ts.SourceFile, filePath: string, attrNode: ts.JsxAttribute): DiagnosticReport {
  const mapping = FOUR_LAYER_MAPPINGS.find((m) => m.rule.ruleId === 'FIGM-REACT-02')!;
  const start = attrNode.getStart(sourceFile);
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
  const endPos = sourceFile.getLineAndCharacterOfPosition(attrNode.getEnd());
  const lineText = sourceFile.text.split(/\r?\n/)[line] ?? attrNode.getText(sourceFile);

  return {
    ruleId: 'FIGM-REACT-02',
    ruleName: mapping.rule.ruleName,
    category: 'FIGM_GUIDELINE_VIOLATION',
    domain: mapping.domain,
    concern: mapping.concern,
    severity: mapping.rule.severity,
    filePath,
    location: {
      start: { line: line + 1, column: character },
      end: { line: endPos.line + 1, column: endPos.character },
    },
    line: line + 1,
    column: character,
    offendingCodeSnippet: lineText.trim(),
    sourceSnippet: lineText.trim(),
    message: 'Array index assigned as list key prop causing component re-ordering and state bugs.',
    remediation: mapping.rule.remediation,
    standardReference: getStandardReference(mapping.domain, mapping.concern),
    confidenceScore: 96.0,
    evidence: `Real AST (TypeScript compiler): JsxAttribute "key" at ${sourceFile.fileName}:${line + 1} resolves to the enclosing .map() callback's index parameter`,
    fixAvailable: true,
  };
}

/**
 * Detects FIGM-REACT-02 (array index used as React list `key`) via genuine TypeScript-compiler
 * AST traversal. Never throws: the TypeScript parser is error-tolerant by design (it produces a
 * best-effort SourceFile with syntax errors recorded as diagnostics rather than throwing), and
 * this function additionally wraps traversal in try/catch so a pathological input can never take
 * down the caller — it degrades to "no findings from this detector" rather than crashing the scan.
 */
export function detectArrayIndexKey(code: string, filePath: string): DiagnosticReport[] {
  const reports: DiagnosticReport[] = [];

  try {
    const scriptKind = filePath.endsWith('.tsx') || filePath.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TSX;
    const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.ES2022, true, scriptKind);

    const visit = (node: ts.Node) => {
      if (ts.isJsxAttribute(node) && node.name.getText(sourceFile) === 'key' && node.initializer) {
        const init = node.initializer;
        if (ts.isJsxExpression(init) && init.expression) {
          const indexName = findEnclosingMapIndexBinding(node);
          if (indexName && expressionIsIndexDerived(init.expression, indexName)) {
            reports.push(buildReport(sourceFile, filePath, node));
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  } catch {
    // Resilient by design (matches SourceParser's resilience contract) -- a pathological input
    // yields zero findings from this detector rather than a crashed scan.
    return [];
  }

  return reports;
}
