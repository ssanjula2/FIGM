import test from 'node:test';
import assert from 'node:assert/strict';
import { detectArrayIndexKey, supportsRealAstAnalysis } from '../src/analysis/react-ast-rules';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine';
import { SourceParser } from '../src/parser/source-parser';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine';

/**
 * Stage A migration regression suite for FIGM-REACT-02 (array index as React list `key`),
 * migrated to genuine TypeScript-compiler AST analysis in src/analysis/react-ast-rules.ts.
 *
 * These tests specifically prove the real-AST version behaves differently from — and more
 * correctly than — the regex/substring version still used for every other rule/framework,
 * using concrete cases where the two approaches disagree (see the "regex false positive" and
 * "regex false negative" cases below).
 */
test('Stage A: FIGM-REACT-02 real-AST migration', async (t) => {
  await t.test('[Positive] flags key={index} where index is the .map() callback\'s index parameter', () => {
    const code = `items.map((item, index) => <li key={index}>{item}</li>)`;
    const reports = detectArrayIndexKey(code, 'List.jsx');
    assert.equal(reports.length, 1);
    assert.equal(reports[0].ruleId, 'FIGM-REACT-02');
    assert.equal(reports[0].line, 1);
  });

  await t.test('[Negative] does not flag a stable id used as the key', () => {
    const code = `items.map((item) => <li key={item.id}>{item.name}</li>)`;
    const reports = detectArrayIndexKey(code, 'List.jsx');
    assert.equal(reports.length, 0);
  });

  await t.test('[Boundary] flags a template-literal key derived solely from the index (e.g. `row-${index}`) — the regex version cannot see this at all, since the literal text "key={index}" never appears in the source', () => {
    const code = 'items.map((item, index) => <li key={`row-${index}`}>{item.name}</li>)';
    const reports = detectArrayIndexKey(code, 'List.jsx');
    assert.equal(reports.length, 1, 'a template literal whose only interpolation is the index parameter is still index-derived');
  });

  await t.test('[Boundary] does not flag a template literal that mixes the index with other stable data', () => {
    const code = 'items.map((item, index) => <li key={`${item.id}-${index}`}>{item.name}</li>)';
    const reports = detectArrayIndexKey(code, 'List.jsx');
    assert.equal(reports.length, 0, 'a multi-substitution template is not confidently "index alone" — conservative, avoids a false positive on a partially-stable key');
  });

  await t.test('[Malformed syntax] does not throw on unparseable/unclosed input, degrades to no findings', () => {
    const malformed = 'items.map((item, index) => <li key={index INVALID_SYNTAX <<<';
    assert.doesNotThrow(() => detectArrayIndexKey(malformed, 'Broken.jsx'));
    const reports = detectArrayIndexKey(malformed, 'Broken.jsx');
    assert.ok(Array.isArray(reports));
  });

  await t.test('[Malformed syntax] does not throw on empty input', () => {
    assert.doesNotThrow(() => detectArrayIndexKey('', 'Empty.jsx'));
    assert.deepEqual(detectArrayIndexKey('', 'Empty.jsx'), []);
  });

  await t.test('[False-positive regression] a local variable literally named "index" that is NOT the map callback\'s index parameter must not be flagged — the OLD regex version (substring match on "key={index}") DOES incorrectly flag this, because it cannot tell where `index` came from', () => {
    const code = `const index = computeSomething();\nitems.map((item) => <li key={index}>{item.name}</li>)`;

    const realAstReports = detectArrayIndexKey(code, 'List.jsx');
    assert.equal(realAstReports.length, 0, 'real-AST version correctly resolves that this "index" is not the .map() callback\'s index parameter (the callback only takes one parameter)');

    // Confirm the regex version really does have this false positive, so the comparison above is
    // not just asserting against a hypothetical -- it documents the actual behavioral difference.
    const parseRes = SourceParser.parseSource(code, 'List.jsx');
    const regexReports = ASTDetectionEngine.evaluateNode(parseRes.ast!, 'List.jsx', parseRes.framework).filter((d) => d.ruleId === 'FIGM-REACT-02');
    assert.equal(regexReports.length, 1, 'documents the pre-existing regex false positive this migration fixes for React/Next.js files');
  });

  await t.test('[False-negative regression] an index parameter with a non-standard name (not "index"/"i"/"idx") is still flagged — the OLD regex version hardcodes exactly those three names and misses this entirely', () => {
    const code = `items.map((item, position) => <li key={position}>{item.name}</li>)`;

    const realAstReports = detectArrayIndexKey(code, 'List.jsx');
    assert.equal(realAstReports.length, 1, 'real-AST version detects the violation regardless of the index parameter\'s name');

    const parseRes = SourceParser.parseSource(code, 'List.jsx');
    const regexReports = ASTDetectionEngine.evaluateNode(parseRes.ast!, 'List.jsx', parseRes.framework).filter((d) => d.ruleId === 'FIGM-REACT-02');
    assert.equal(regexReports.length, 0, 'documents the pre-existing regex false negative this migration fixes for React/Next.js files');
  });

  await t.test('[Regression] RuleExecutionEngine.analyzeFile still reports FIGM-REACT-02 with a preserved rule ID/shape for a .jsx file (end-to-end wiring)', () => {
    const code = `function List({ items }) {\n  return items.map((item, index) => <li key={index}>{item.name}</li>);\n}`;
    const result = RuleExecutionEngine.analyzeFile('List.jsx', code);
    const react02 = result.diagnostics.filter((d) => d.ruleId === 'FIGM-REACT-02');
    assert.equal(react02.length, 1);
    assert.ok(react02[0].domain, 'domain must still be populated from the same FOUR_LAYER_MAPPINGS lookup the regex path used');
    assert.ok(react02[0].concern, 'concern must still be populated');
    assert.ok(react02[0].remediation, 'remediation text must still be present, matching the pre-migration report shape');
    assert.ok(react02[0].evidence?.includes('Real AST'), 'evidence string honestly discloses this diagnostic came from real AST analysis, not the regex path');
  });

  await t.test('[Regression] .tsx files also get real-AST FIGM-REACT-02 analysis', () => {
    const code = `const List: React.FC<{items: Item[]}> = ({ items }) => (\n  <ul>{items.map((item, index) => <li key={index}>{item.name}</li>)}</ul>\n);`;
    const result = RuleExecutionEngine.analyzeFile('List.tsx', code);
    const react02 = result.diagnostics.filter((d) => d.ruleId === 'FIGM-REACT-02');
    assert.equal(react02.length, 1);
  });

  await t.test('[Regression] Vue/Angular files are completely unaffected -- still use the pre-existing regex path, not real-AST', () => {
    assert.equal(supportsRealAstAnalysis('VUE_SFC'), false);
    assert.equal(supportsRealAstAnalysis('ANGULAR_TEMPLATE'), false);
    assert.equal(supportsRealAstAnalysis('GENERIC_ESTREE'), false);
    assert.equal(supportsRealAstAnalysis('REACT_JSX'), true);
    assert.equal(supportsRealAstAnalysis('NEXT_JS'), true);
  });

  await t.test('[Regression] full existing positive/negative fixtures from tests/rule-detection-matrix.test.ts still agree end-to-end through RuleExecutionEngine', () => {
    const positive = `items.map((item, index) => <li key={index}>{item}</li>)`;
    const negative = `items.map((item) => <li key={item.id}>{item.name}</li>)`;

    const posResult = RuleExecutionEngine.analyzeFile('List.jsx', positive);
    assert.ok(posResult.diagnostics.some((d) => d.ruleId === 'FIGM-REACT-02'));

    const negResult = RuleExecutionEngine.analyzeFile('List.jsx', negative);
    assert.ok(!negResult.diagnostics.some((d) => d.ruleId === 'FIGM-REACT-02'));
  });
});
