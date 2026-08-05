import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SourceParser } from '../src/parser/source-parser.js';
import { ALPExtractionEngine } from '../src/parser/alp-extractor.js';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';
import { ReportGenerator } from '../src/reporter/report-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sampleDir = path.resolve(__dirname, '../samples/sample-spa/src');

describe('FIGM Phase 3 Automated Validation Engine', () => {
  test('Resilient SourceParser handles malformed code gracefully', () => {
    const malformedCode = `function test() { const x = { <<<INVALID_SYNTAX>>> }; }`;
    const parseRes = SourceParser.parseSource(malformedCode, 'src/malformed.js');

    assert.equal(parseRes.ast !== null, true);
    assert.equal(parseRes.parseErrors.length, 1);
    assert.equal(parseRes.parseErrors[0].message.includes('Malformed'), true);
  });

  test('ALPExtractionEngine extracts primitive nodes from React JSX', () => {
    const code = `export function Comp() { return <img src="/test.jpg" />; }`;
    const parseRes = SourceParser.parseSource(code, 'src/Comp.jsx');
    const primitives = ALPExtractionEngine.extractPrimitives(parseRes.ast!, parseRes.framework);

    assert.equal(primitives.length, 1);
    assert.equal(primitives[0].primitiveId, 'ALP-LAYOUT-ELEMENT');
  });

  test('RuleExecutionEngine scans React UserProfile.jsx and detects defects', () => {
    const profilePath = path.join(sampleDir, 'UserProfile.jsx');
    const code = fs.readFileSync(profilePath, 'utf-8');
    const result = RuleExecutionEngine.analyzeFile('UserProfile.jsx', code);

    assert.equal(result.diagnostics.length >= 3, true);

    const ruleIds = result.diagnostics.map((d) => d.ruleId);
    assert.ok(ruleIds.includes('FIGM-PERF-02'));
    assert.ok(ruleIds.includes('FIGM-A11Y-01'));
    assert.ok(ruleIds.includes('FIGM-A11Y-04'));
  });

  test('RuleExecutionEngine scans Angular SearchPanel.component.ts and detects defects', () => {
    const angularPath = path.join(sampleDir, 'SearchPanel.component.ts');
    const code = fs.readFileSync(angularPath, 'utf-8');
    const result = RuleExecutionEngine.analyzeFile('SearchPanel.component.ts', code);

    assert.equal(result.diagnostics.length >= 2, true);
    const ruleIds = result.diagnostics.map((d) => d.ruleId);
    assert.ok(ruleIds.includes('FIGM-PERF-03'));
    assert.ok(ruleIds.includes('FIGM-A11Y-03'));
  });

  test('ReportGenerator generates valid JSON and HTML reports', () => {
    const profileCode = fs.readFileSync(path.join(sampleDir, 'UserProfile.jsx'), 'utf-8');
    const scanResult = RuleExecutionEngine.analyzeFile('UserProfile.jsx', profileCode);

    const aggregate = ReportGenerator.createAggregateReport([scanResult]);
    const jsonStr = ReportGenerator.generateJSON(aggregate);
    const htmlStr = ReportGenerator.generateHTML(aggregate);

    assert.ok(jsonStr.includes('UserProfile.jsx'));
    assert.ok(htmlStr.includes('FIGM Static Analysis Diagnostic Report'));
    assert.ok(htmlStr.includes('FIGM-PERF-02'));
  });
});
