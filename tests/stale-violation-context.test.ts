import test from 'node:test';
import assert from 'node:assert/strict';
import { AIRemediationPipeline } from '../src/ai/ai-remediation-pipeline.js';
import { FigmFixPipeline } from '../src/ai/figm-fix-pipeline.js';
import { CodeErrorFixPipeline } from '../src/ai/code-error-fix-pipeline.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/**
 * Regression coverage for the STALE_VIOLATION_CONTEXT guard added to
 * AIRemediationPipeline.remediateDefect (src/ai/ai-remediation-pipeline.ts).
 *
 * Root cause this guards against (found via live investigation, not hypothetical): a `defect`
 * describes a violation found against SOME earlier snapshot of the source (a completed scan); the
 * live-scan UI's auto-scan is debounced 1.5s, so a caller can genuinely submit a `code` that has
 * already moved on from the snapshot `defect.offendingCodeSnippet`/`location` was computed
 * against. Before this guard existed, that mismatched pair was sent straight into
 * decideRemediation() — a deterministic AST fixer locates its target purely from
 * defect.location, so on drifted code it could silently patch a DIFFERENT node that happens to sit
 * at that now-stale line/column; an AI provider is handed an offendingCodeSnippet that plain
 * doesn't exist in the source it's also shown, producing a correct-but-confusing DECLINE
 * ("the provided source does not contain the exact offending code snippet").
 *
 * These tests never touch the network — the guard fires (or doesn't) before any provider is ever
 * consulted, which is itself part of what's being verified.
 */

function makeDefect(overrides: Partial<DiagnosticReport> = {}): DiagnosticReport {
  return {
    ruleId: 'FIGM-REACT-01',
    ruleName: 'Memoize Expensive Derived Computations',
    message: 'n/a',
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    severity: 'HIGH',
    filePath: 'src/List.jsx',
    location: { start: { line: 2, column: 17 }, end: { line: 2, column: 44 } },
    offendingCodeSnippet: 'const sorted = items.sort((a, b) => a - b);',
    remediation: 'Wrap heavy derived data computations inside React.useMemo.',
    standardReference: 'ISO 25010',
    ...overrides,
  } as DiagnosticReport;
}

test('Stale violation context guard', async (t) => {
  await t.test('rejects immediately (no provider consulted) when the offending snippet is no longer in the source', async () => {
    const staleCode = `function List({ items }) {\n  return <ul>{items.map((n) => <li>{n}</li>)}</ul>;\n}`; // the sort() line was already removed
    const result = await AIRemediationPipeline.remediateDefect(staleCode, makeDefect(), 'REACT_JSX');
    assert.equal(result.engineType, 'UNAVAILABLE');
    assert.equal(result.verified, false);
    assert.equal(result.verificationStatus, 'UNRESOLVED');
    assert.equal(result.remediatedCode, staleCode, 'original (current) source must be returned unchanged');
    assert.ok(result.fallbackReason?.includes('STALE_VIOLATION_CONTEXT'));
  });

  await t.test('proceeds normally (reaches real remediation) when the offending snippet still matches the current source', async () => {
    const freshCode = `function List({ items }) {\n  const sorted = items.sort((a, b) => a - b);\n  return <ul>{sorted.map((n) => <li>{n}</li>)}</ul>;\n}`;
    delete process.env.ANTHROPIC_API_KEY;
    const result = await AIRemediationPipeline.remediateDefect(freshCode, makeDefect(), 'REACT_JSX');
    // No AI provider configured in this test process -- proves the guard did NOT short-circuit here
    // (it would have reported STALE_VIOLATION_CONTEXT instead) and the pipeline genuinely reached
    // the AI_ASSISTED path and only failed there for the expected, unrelated reason.
    assert.equal(result.engineType, 'UNAVAILABLE');
    assert.ok(!result.fallbackReason?.includes('STALE_VIOLATION_CONTEXT'), `expected to reach the real AI path, got: ${result.fallbackReason}`);
  });

  await t.test('a defect with no offendingCodeSnippet at all is never treated as stale (nothing to compare)', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const code = `function List({ items }) {\n  return <ul></ul>;\n}`;
    const result = await AIRemediationPipeline.remediateDefect(code, makeDefect({ offendingCodeSnippet: '' }), 'REACT_JSX');
    assert.ok(!result.fallbackReason?.includes('STALE_VIOLATION_CONTEXT'));
  });

  await t.test('FigmFixPipeline inherits the guard (it delegates straight to remediateDefect)', async () => {
    const staleCode = `function List({ items }) {\n  return <ul>{items.map((n) => <li>{n}</li>)}</ul>;\n}`;
    const result = await FigmFixPipeline.apply(staleCode, makeDefect(), 'REACT_JSX');
    assert.ok(result.fallbackReason?.includes('STALE_VIOLATION_CONTEXT'));
    assert.equal(result.remediatedCode, staleCode);
  });

  await t.test('CodeErrorFixPipeline inherits the guard (it delegates straight to remediateDefect)', async () => {
    const staleDefect = makeDefect({
      ruleId: 'SYNTAX-PARSE-ERROR',
      ruleName: 'Syntax Parse Error',
      offendingCodeSnippet: '  return items.map(item => item);', // text that used to be on the broken line
    });
    const staleCode = `function fixed(items) {\n  return items.filter(Boolean);\n}`; // completely different body now
    const result = await CodeErrorFixPipeline.apply(staleCode, staleDefect, 'GENERIC_ESTREE');
    assert.ok(result.fallbackReason?.includes('STALE_VIOLATION_CONTEXT'));
    assert.equal(result.remediatedCode, staleCode);
  });
});
