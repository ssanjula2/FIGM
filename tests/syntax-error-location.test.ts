import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceParser } from '../src/parser/source-parser.js';

/**
 * Regression coverage for src/parser/source-parser.ts's `validateSyntax` unclosed-bracket
 * fallback (the brace/paren-counting path reached only when none of the earlier single-line
 * heuristics already matched).
 *
 * REGRESSION (found via live user report, reproduced and root-caused): this used to report
 * EVERY unclosed brace/paren at `{ line: lines.length, column: 1 }` — unconditionally the LAST
 * line of the file, regardless of where the actual unmatched bracket is. On a real, larger file
 * with e.g. an unclosed `(` early on, this produced exactly the reported symptom — "Unclosed
 * parenthesis '(' / Location: L216:C1" for a file whose real problem was nowhere near line 216 —
 * and the offendingCodeSnippet extracted from that wrong line (often blank or unrelated) was then
 * embedded verbatim in the Qwen remediation prompt alongside the real current source, causing Qwen
 * to correctly notice the snippet didn't match anything and decline ("the provided source does not
 * contain the exact offending code snippet"). Fixed by tracking the real source position of every
 * open bracket and reporting the outermost one still unmatched at EOF.
 */

test('Unclosed-bracket syntax error location accuracy', async (t) => {
  await t.test('reports the actual opening-brace location, not the last line of the file', () => {
    const code = `function List({ items }) {\n  const sorted = items.sort((a, b) => a - b);\n  return (\n    <ul>\n      {sorted.map((n) => <li key={n}>{n}</li>)}\n    </ul>\n`; // missing closing } for the function body
    const result = SourceParser.parseSource(code, 'Broken.tsx');
    assert.equal(result.parseErrors.length, 1);
    const err = result.parseErrors[0];
    assert.equal(err.line, 1, `expected the unclosed brace's real line (1), got ${err.line}`);
    assert.notEqual(err.line, code.split('\n').length, 'must not fall back to reporting the last line of the file');
    const snippet = code.split('\n')[err.line - 1];
    assert.ok(snippet.includes('{'), 'the extracted offending-code snippet must actually contain the unclosed bracket');
  });

  await t.test('reports an unclosed paren at its real (mid-file) location on a large file — reproduces the exact reported bug shape', () => {
    const lines: string[] = [];
    lines.push(`import React from 'react';`);
    lines.push(``);
    lines.push(`function Example() {`);
    lines.push(`  return (`); // real problem: line 4
    lines.push(`    <div>Hello</div>`);
    for (let i = 0; i < 200; i++) lines.push(`  // padding line ${i}`);
    lines.push(`}`);
    const code = lines.join('\n');

    const result = SourceParser.parseSource(code, 'BigBroken.tsx');
    assert.equal(result.parseErrors.length, 1);
    const err = result.parseErrors[0];
    assert.equal(err.line, 4, `expected line 4 (the real "return (" that never closed), got ${err.line}`);
    assert.ok(/unclosed parenthesis/i.test(err.message));
    assert.notEqual(err.line, code.split('\n').length, 'must not report L206 (the last line) like the original bug did');
    const snippet = code.split('\n')[err.line - 1];
    assert.ok(code.includes(snippet.trim()) && snippet.includes('return ('), `expected the real offending line, got: ${JSON.stringify(snippet)}`);
  });

  await t.test('a brace/paren that only appears inside a string literal or comment does not produce a false positive', () => {
    const code = `function ok() {\n  const s = "a string with an unmatched ( paren and { brace";\n  // a comment with an unmatched ( paren too\n  return s;\n}\n`;
    const result = SourceParser.parseSource(code, 'Clean.tsx');
    assert.equal(result.parseErrors.length, 0, `expected no false-positive syntax errors, got: ${JSON.stringify(result.parseErrors)}`);
  });

  await t.test('brace errors are still reported ahead of paren errors when both are unclosed (unchanged priority)', () => {
    const code = `function broken( {\n  return 1;\n`;
    const result = SourceParser.parseSource(code, 'Both.tsx');
    // The earlier single-line heuristic (`function\s+\w*\s*\(\s*\{$`) matches this exact shape and
    // fires first, before the bracket-counting fallback is even reached -- confirms that
    // pre-existing, more-specific heuristic still takes precedence and was not disturbed.
    assert.ok(result.parseErrors.length >= 1);
    assert.ok(/function parameter list|Unclosed curly brace/i.test(result.parseErrors[0].message));
  });
});
