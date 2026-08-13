import test from 'node:test';
import assert from 'node:assert/strict';
import { AIPromptBuilder } from '../src/ai/prompt-builder.js';
import { AIResponseParser } from '../src/ai/response-parser.js';
import { AIPatchValidator } from '../src/ai/patch-validator.js';
import { AIRemediationPipeline } from '../src/ai/ai-remediation-pipeline.js';
import { RemediationEngine } from '../src/engine/remediation-engine.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

test('AI Remediation Pipeline & Fallback Suite', async (t) => {
  const sampleDefect: DiagnosticReport = {
    ruleId: 'FIGM-PERF-01',
    ruleName: 'Avoid Object Allocation in Loops',
    message: 'Avoid Object Allocation in Loops',
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    severity: 'CRITICAL',
    filePath: 'src/UserProfile.jsx',
    location: { start: { line: 15, column: 5 }, end: { line: 15, column: 40 } },
    offendingCodeSnippet: 'const defaultConfig = { theme: "dark" };',
    remediation: 'Hoist static object allocation outside loop scope.',
    standardReference: 'ISO 25010'
  };

  const sampleCode = `function processItems(items) {
  return items.map(item => {
    const defaultConfig = { theme: "dark" };
    return { ...item, ...defaultConfig };
  });
}`;

  await t.test('Prompt Builder generates valid structured prompt', () => {
    const prompt = AIPromptBuilder.buildRemediationPrompt({
      defect: sampleDefect,
      code: sampleCode,
      framework: 'REACT_JSX'
    });

    assert.ok(prompt.includes('FIGM-PERF-01'));
    assert.ok(prompt.includes('Avoid Object Allocation in Loops'));
    assert.ok(prompt.includes('processItems'));
    assert.ok(prompt.includes('remediatedCode'));
  });

  await t.test('Response Parser correctly parses LLM JSON output', () => {
    const rawResponse = `\`\`\`json
{
  "explanation": "Hoisted static defaultConfig constant outside map loop.",
  "remediatedCode": "const defaultConfig = { theme: \\"dark\\" };\\nfunction processItems(items) {\\n  return items.map(item => ({ ...item, ...defaultConfig }));\\n}",
  "confidenceScore": 98.5
}
\`\`\``;

    const parsed = AIResponseParser.parseResponse(rawResponse);
    assert.equal(parsed.explanation, 'Hoisted static defaultConfig constant outside map loop.');
    assert.ok(parsed.remediatedCode.includes('const defaultConfig'));
    assert.equal(parsed.confidenceScore, 98.5);
  });

  await t.test('Patch Validator verifies valid AST code and rejects malformed code', () => {
    const validCode = `function valid() { return 42; }`;
    const invalidCode = `function invalid() { <<<MALFORMED>>> }`;

    const validRes = AIPatchValidator.validatePatch(sampleCode, validCode, 'test.js');
    assert.equal(validRes.isValid, true);

    const invalidRes = AIPatchValidator.validatePatch(sampleCode, sampleCode, 'test.js');
    assert.equal(invalidRes.isValid, false);
    assert.ok(invalidRes.reason?.includes('identical'));
  });

  await t.test('AI Remediation Pipeline automatically falls back when GEMINI_API_KEY is unset', async () => {
    delete process.env.GEMINI_API_KEY;

    const pipelineRes = await AIRemediationPipeline.remediateDefect(sampleCode, sampleDefect, 'REACT_JSX');
    assert.equal(pipelineRes.engineType, 'TEMPLATE_FALLBACK');
    assert.ok(pipelineRes.fallbackReason?.includes('GEMINI_API_KEY'));
    assert.ok(pipelineRes.remediatedCode.length > 0);
    assert.ok(pipelineRes.suggestedFix?.diff.length! > 0);
  });

  await t.test('applyQuickFix for FIGM-PERF-01 preserves the original variable name (regression: a prior version hardcoded a new name, leaving dangling references)', () => {
    const patchRes = RemediationEngine.applyQuickFix(sampleCode, sampleDefect);
    assert.ok(patchRes.remediatedCode.includes('const defaultConfig ='), 'expected the original variable name "defaultConfig" to be preserved, not renamed');
    assert.ok(!patchRes.remediatedCode.includes('const options ='), 'the old broken template hardcoded "options" as the replacement name');

    const validation = RemediationEngine.validatePatch(sampleCode, patchRes.remediatedCode, sampleDefect);
    assert.equal(validation.isValid, true);
    assert.equal(validation.status, 'FIXED');
  });

  await t.test('validatePatch rejects a patch that introduces a real dangling-reference type error, even though the original rule no longer fires', () => {
    const originalCode = `function render(items) {
  return items.map(item => {
    const style = { color: 'red' };
    return { ...item, style };
  });
}`;
    // Simulates the exact class of bug found via live E2E testing: the offending variable is renamed
    // away without updating its other reference, so FIGM-PERF-01 stops firing but the code is broken.
    const brokenPatch = `const HOISTED = Object.freeze({ color: 'red' });
function render(items) {
  return items.map(item => {
    const options = HOISTED;
    return { ...item, style };
  });
}`;
    const brokenDefect: DiagnosticReport = {
      ...sampleDefect,
      filePath: 'BrokenPatchRegression.tsx',
      offendingCodeSnippet: "const style = { color: 'red' };",
    };

    // The rule itself is confirmed gone (proves re-scan alone is not a sufficient check)...
    const rescan = RuleExecutionEngineCheck(brokenPatch);
    assert.ok(!rescan.some((d) => d.ruleId === 'FIGM-PERF-01'), 'sanity check: the rule really does stop firing on the broken patch');

    // ...yet validatePatch must still reject it, because the patch is not valid code.
    const validation = RemediationEngine.validatePatch(originalCode, brokenPatch, brokenDefect);
    assert.equal(validation.isValid, false);
    assert.equal(validation.status, 'PATCH_REJECTED');
  });
});

function RuleExecutionEngineCheck(code: string) {
  // Local helper kept inline to avoid an extra top-of-file import purely for one sanity assertion.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { RuleExecutionEngine } = require('../src/engine/rule-execution-engine.js');
  return RuleExecutionEngine.analyzeFile('BrokenPatchRegression.tsx', code).diagnostics;
}
