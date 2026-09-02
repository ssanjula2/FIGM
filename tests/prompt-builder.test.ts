import test from 'node:test';
import assert from 'node:assert/strict';
import { AIPromptBuilder, AI_REMEDIATION_POLICY_INSTRUCTION } from '../src/ai/prompt-builder.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/**
 * Focused regression coverage for the minimal-patch prompt hardening (root cause: Qwen2.5-Coder-7B
 * genuinely fixes the reported violation but wraps the fix in a full-file rewrite — reformatted
 * quotes/indentation, renamed locals, added comments — which the sandbox's PATCH_SCOPE stage
 * (src/ai/sandbox-validation-pipeline.ts's checkPatchScope, a real 60% changed-lines ceiling that
 * this fix never weakens) correctly rejects as "not a scoped fix"). Tests the PROMPT side only —
 * see tests/ai-provider-fallback.test.ts's "H/I" case for the full pipeline-level reproduction/fix
 * (oversized rewrite rejected -> escalating feedback -> a genuinely minimal patch accepted).
 */

function makeDefect(overrides: Partial<DiagnosticReport> = {}): DiagnosticReport {
  return {
    ruleId: 'FIGM-REACT-01',
    ruleName: 'Memoize Expensive Derived Computations',
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    severity: 'HIGH',
    filePath: 'src/List.jsx',
    location: { start: { line: 12, column: 17 }, end: { line: 12, column: 44 } },
    offendingCodeSnippet: 'const sorted = items.sort((a, b) => a - b);',
    message: 'n/a',
    remediation: 'Wrap heavy derived data computations inside React.useMemo.',
    standardReference: 'n/a',
    ...overrides,
  } as DiagnosticReport;
}

const CODE = 'function List({ items }) {\n  const sorted = items.sort((a, b) => a - b);\n  return null;\n}';

test('AI_REMEDIATION_POLICY_INSTRUCTION — shared minimal-patch policy', async (t) => {
  await t.test('states the real 60% sandbox threshold and explicit anti-rewrite rules', () => {
    assert.ok(/60%/.test(AI_REMEDIATION_POLICY_INSTRUCTION), 'must tell the model the real enforced threshold, not a vague "be minimal"');
    assert.ok(/reproduced EXACTLY|EXACTLY as it appears/i.test(AI_REMEDIATION_POLICY_INSTRUCTION));
    assert.ok(/do not reformat/i.test(AI_REMEDIATION_POLICY_INSTRUCTION));
    assert.ok(/do not rename unrelated/i.test(AI_REMEDIATION_POLICY_INSTRUCTION));
    assert.ok(/not permission to rewrite/i.test(AI_REMEDIATION_POLICY_INSTRUCTION), '"complete file" must be explicitly clarified as a format requirement, not a rewrite license');
  });
});

test('AIPromptBuilder.buildUserContent — retry feedback', async (t) => {
  await t.test('no previousAttempt: no feedback block at all', () => {
    const content = AIPromptBuilder.buildUserContent({ defect: makeDefect(), code: CODE, framework: 'REACT_JSX' }, 100_000);
    assert.equal(content.includes('PREVIOUS ATTEMPT FEEDBACK'), false);
  });

  await t.test('a non-scope failure (e.g. COMPILE_AND_RESCAN) uses the existing generic feedback wording, unchanged', () => {
    const content = AIPromptBuilder.buildUserContent(
      {
        defect: makeDefect(),
        code: CODE,
        framework: 'REACT_JSX',
        previousAttempt: { patch: 'const x = 1;', failureStage: 'COMPILE_AND_RESCAN', failureDetail: 'Introduced a new type error.' },
      },
      100_000
    );
    assert.ok(content.includes('### PREVIOUS ATTEMPT FEEDBACK\n'));
    assert.ok(content.includes('Validation stage: COMPILE_AND_RESCAN'));
    assert.ok(content.includes('Introduced a new type error.'));
    assert.equal(content.includes('EXCESSIVE SCOPE'), false, 'only a PATCH_SCOPE failure gets the dedicated scope wording');
  });

  await t.test('a PATCH_SCOPE failure gets the dedicated "REJECTED FOR EXCESSIVE SCOPE" feedback, carrying the sandbox\'s real changed-line numbers', () => {
    const scopeDetail = 'Patch changed/added/removed 32 of 25 lines (128%), exceeding the 60% minimal-patch threshold — looks like a broader rewrite rather than a scoped fix for one violation.';
    const content = AIPromptBuilder.buildUserContent(
      {
        defect: makeDefect(),
        code: CODE,
        framework: 'REACT_JSX',
        previousAttempt: { patch: 'const x = 1;', failureStage: 'PATCH_SCOPE', failureDetail: scopeDetail, sameStageFailureStreak: 1 },
      },
      100_000
    );
    assert.ok(content.includes('EXCESSIVE SCOPE'));
    assert.ok(content.includes(scopeDetail), 'must carry the sandbox\'s own real numbers, never fabricate different ones');
    assert.ok(/SUBSTANTIALLY SMALLER/.test(content));
    assert.equal(content.includes('FINAL attempt'), false, 'a first scope failure (streak=1) must not claim this is the final attempt');
  });

  await t.test('a SECOND consecutive PATCH_SCOPE failure escalates to a stronger, distinct "final attempt" message', () => {
    const base = {
      defect: makeDefect(),
      code: CODE,
      framework: 'REACT_JSX',
    } as const;
    const firstFailure = AIPromptBuilder.buildUserContent(
      { ...base, previousAttempt: { patch: 'a', failureStage: 'PATCH_SCOPE', failureDetail: 'changed 20 of 25 lines (80%)', sameStageFailureStreak: 1 } },
      100_000
    );
    const secondFailure = AIPromptBuilder.buildUserContent(
      { ...base, previousAttempt: { patch: 'b', failureStage: 'PATCH_SCOPE', failureDetail: 'changed 22 of 25 lines (88%)', sameStageFailureStreak: 2 } },
      100_000
    );
    assert.ok(/FINAL attempt/i.test(secondFailure));
    assert.ok(/last TWO patches/i.test(secondFailure));
    assert.notEqual(firstFailure, secondFailure, 'escalating retries must not resend byte-identical feedback');
  });

  await t.test('sameStageFailureStreak omitted (e.g. a caller that constructs the shape directly) defaults to a first-time (non-escalated) scope message, never throws', () => {
    const content = AIPromptBuilder.buildUserContent(
      {
        defect: makeDefect(),
        code: CODE,
        framework: 'REACT_JSX',
        previousAttempt: { patch: 'a', failureStage: 'PATCH_SCOPE', failureDetail: 'changed 20 of 25 lines (80%)' },
      },
      100_000
    );
    assert.ok(content.includes('EXCESSIVE SCOPE'));
    assert.equal(content.includes('FINAL attempt'), false);
  });
});
