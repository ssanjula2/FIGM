import test from 'node:test';
import assert from 'node:assert/strict';
import { AIResponseParser } from '../src/ai/response-parser.js';

/**
 * Coverage for AIResponseParser.parseStructuredRemediation — the provider-agnostic {status:
 * PATCH|DECLINE} contract every AI remediation provider (Claude, Qwen, ...) is validated through.
 * Includes a dedicated regression test (see "recovers a real reproduced Qwen response...") for a
 * real, reproduced Qwen2.5-Coder-7B-Instruct failure: it emits a syntactically correct JSON
 * envelope but serializes the multiline "patch" value using JS template-literal backticks instead
 * of a properly escaped JSON string, which is not valid JSON. Captured live via a real Hugging
 * Face request (FIGM-PERF-05 / ReactBenchmark.jsx, all 3 retry attempts produced this exact shape)
 * before response-parser.ts gained tryRecoverBacktickWrappedPatch to recover it.
 */

test('AIResponseParser.parseStructuredRemediation', async (t) => {
  await t.test('Test 1 — pure JSON DECLINE', () => {
    const result = AIResponseParser.parseStructuredRemediation(
      JSON.stringify({ status: 'DECLINE', reason: 'Requires developer intent.' })
    );
    assert.equal(result.status, 'DECLINE');
    assert.ok(result.status === 'DECLINE' && result.reason === 'Requires developer intent.');
  });

  await t.test('Test 2 — markdown-fenced JSON DECLINE', () => {
    const raw = '```json\n' + JSON.stringify({ status: 'DECLINE', reason: 'Requires developer intent.' }) + '\n```';
    const result = AIResponseParser.parseStructuredRemediation(raw);
    assert.equal(result.status, 'DECLINE');
  });

  await t.test('Test 3 — PATCH containing braces (object literal)', () => {
    const result = AIResponseParser.parseStructuredRemediation(
      JSON.stringify({ status: 'PATCH', patch: 'const obj = { value: 1 };', explanation: 'Fixed the object.', confidence: 90 })
    );
    assert.equal(result.status, 'PATCH');
    assert.ok(result.status === 'PATCH' && result.patch === 'const obj = { value: 1 };');
  });

  await t.test('Test 4 — PATCH containing JSX', () => {
    const result = AIResponseParser.parseStructuredRemediation(
      JSON.stringify({ status: 'PATCH', patch: 'return <Component value={user.name} />;', explanation: 'Fixed JSX.', confidence: 90 })
    );
    assert.equal(result.status, 'PATCH');
    assert.ok(result.status === 'PATCH' && result.patch === 'return <Component value={user.name} />;');
  });

  await t.test('Test 5 — PATCH containing a realistic multiline TypeScript file', () => {
    const patch = `import { useMemo } from 'react';\n\nexport function List({ items }: { items: number[] }) {\n  const sorted = useMemo(() => [...items].sort((a, b) => a - b), [items]);\n  return (\n    <ul>\n      {sorted.map((n) => (\n        <li key={n}>{n}</li>\n      ))}\n    </ul>\n  );\n}\n`;
    const result = AIResponseParser.parseStructuredRemediation(
      JSON.stringify({ status: 'PATCH', patch, explanation: 'Wrapped the derived sort in useMemo.', confidence: 92 })
    );
    assert.equal(result.status, 'PATCH');
    // stripMarkdownFences trims leading/trailing whitespace as part of its existing, pre-existing
    // fence-stripping contract — trailing newlines are not preserved verbatim.
    assert.ok(result.status === 'PATCH' && result.patch === patch.trim());
  });

  await t.test('Test 6 — invalid JSON never throws, returns AI_UNAVAILABLE', () => {
    assert.doesNotThrow(() => AIResponseParser.parseStructuredRemediation('this is not JSON at all { still not'));
    const result = AIResponseParser.parseStructuredRemediation('this is not JSON at all { still not');
    assert.equal(result.status, 'AI_UNAVAILABLE');
  });

  await t.test('Test 7 — PATCH missing required fields (explanation/confidence) is rejected, not accepted with defaults', () => {
    const result = AIResponseParser.parseStructuredRemediation(JSON.stringify({ status: 'PATCH', patch: 'const x = 1;' }));
    assert.equal(result.status, 'AI_UNAVAILABLE');
  });

  await t.test('Test 8 (mandatory regression) — recovers a real reproduced Qwen response: valid envelope, "patch" wrapped in backticks instead of a JSON string', () => {
    // Captured live from Qwen2.5-Coder-7B-Instruct via the real Hugging Face Inference API
    // (FIGM-PERF-05 on ReactBenchmark.jsx) — reproduced identically across all 3 retry attempts,
    // not a one-off flake. Before both JSON.parse attempts existed to fail, this response was
    // classified AI_UNAVAILABLE with reason "AI remediation response was not valid JSON.", which
    // is exactly the production bug this test guards against regressing.
    const raw = '```json\n' +
      '{\n' +
      '  "status": "PATCH",\n' +
      '  "patch": `\n' +
      "import React, { useState, useEffect } from 'react';\n" +
      "import HeavyAnalytics from 'heavy-analytics-lib';\n" +
      'export function ReactBenchmark({ items, user, isModalOpen }) {\n' +
      '  const [data, setData] = useState([]);\n' +
      '  useEffect(() => {\n' +
      "    window.addEventListener('scroll', () => console.log('Scrolling'));\n" +
      '  }, []);\n' +
      '  const exportHandler = () => handleExport(true);\n' +
      '  return (\n' +
      '    <div className="react-benchmark">\n' +
      '      <img src={user.avatar} alt="User Avatar" />\n' +
      '      <div onClick={exportHandler} className="export-btn">\n' +
      '        Export Analytics Data\n' +
      '      </div>\n' +
      '    </div>\n' +
      '  );\n' +
      '}\n' +
      '`,\n' +
      '  "explanation": "Extracted the anonymous callback into a named function `exportHandler` and used it in the `onClick` attribute.",\n' +
      '  "confidence": 90\n' +
      '}\n' +
      '```';

    const result = AIResponseParser.parseStructuredRemediation(raw);
    assert.equal(result.status, 'PATCH', `expected recovered PATCH, got: ${JSON.stringify(result)}`);
    assert.ok(result.status === 'PATCH' && result.patch.includes("export function ReactBenchmark"));
    assert.ok(result.status === 'PATCH' && result.patch.includes('exportHandler'));
    assert.ok(result.status === 'PATCH' && !result.patch.includes('`'), 'the recovered patch string must not retain the wrapping backticks');
    assert.ok(result.status === 'PATCH' && result.explanation.includes('exportHandler'));
    assert.ok(result.status === 'PATCH' && result.confidence === 90);
  });

  await t.test('backtick recovery still works when the patched source itself contains a backtick (nested template literal)', () => {
    // Guards the greedy-regex design choice in tryRecoverBacktickWrappedPatch: it must resolve to
    // the LAST backtick immediately preceding `,"explanation"`, not the first backtick found —
    // otherwise a patch that itself adds/edits a JS template literal would be truncated mid-file.
    const raw =
      '{\n' +
      '  "status": "PATCH",\n' +
      '  "patch": `const greeting = `Hello, ${name}!`;\nconsole.log(greeting);`,\n' +
      '  "explanation": "Added a template literal greeting.",\n' +
      '  "confidence": 85\n' +
      '}';

    const result = AIResponseParser.parseStructuredRemediation(raw);
    assert.equal(result.status, 'PATCH', `expected recovered PATCH, got: ${JSON.stringify(result)}`);
    assert.ok(result.status === 'PATCH' && result.patch.includes('console.log(greeting);'));
  });

  await t.test('a backtick-wrapped PATCH with no parseable confidence still safely falls back to AI_UNAVAILABLE, never throws', () => {
    const raw =
      '{\n' +
      '  "status": "PATCH",\n' +
      '  "patch": `const x = 1;`,\n' +
      '  "explanation": "no confidence field at all"\n' +
      '}';
    assert.doesNotThrow(() => AIResponseParser.parseStructuredRemediation(raw));
    const result = AIResponseParser.parseStructuredRemediation(raw);
    assert.equal(result.status, 'AI_UNAVAILABLE');
  });
});
