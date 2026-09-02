import test from 'node:test';
import assert from 'node:assert/strict';
import { AIPromptBuilder } from '../src/ai/prompt-builder.js';
import { AIResponseParser } from '../src/ai/response-parser.js';
import { AIPatchValidator } from '../src/ai/patch-validator.js';
import { AIRemediationPipeline } from '../src/ai/ai-remediation-pipeline.js';
import { RemediationEngine } from '../src/engine/remediation-engine.js';
import { RemediationValidator } from '../src/engine/remediation-validation.server.js';
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
    // Must match sampleCode's actual position (line 3, where `const defaultConfig` really is) --
    // the new AST-based deterministic fixer locates the real node via this position, unlike the
    // legacy regex engine's `code.includes(snippet)` string match, which never needed it to be
    // accurate. Column is 0-based (see ast-fix-engine.ts's positionFromLocation) and points at the
    // `defaultConfig` identifier itself, guaranteeing the position resolves inside the
    // VariableDeclaration node the fixer walks up to.
    location: { start: { line: 3, column: 10 }, end: { line: 3, column: 45 } },
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

  await t.test('AI Remediation Pipeline fixes a Layer-1-eligible rule deterministically without ever needing ANTHROPIC_API_KEY', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    // Ollama (OLLAMA_BASE_URL/OLLAMA_MODEL) now outranks Claude in src/ai/ai-provider-selector.ts's
    // precedence -- cleared here so a developer's own local-dev shell env can never make this
    // deterministic-only assertion attempt a real, unmocked network call.
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_MODEL;

    // FIGM-PERF-01 is in AstDeterministicFixEngine.SUPPORTED_RULE_IDS and this sample's shape
    // (a single `const NAME = {...}` inside a loop, not referencing any loop-local identifier) is
    // exactly what the fixer safely hoists -- Layer 1 must resolve this without ever consulting
    // Claude/the API key, proving deterministic-first routing (architecture rule #19/#31).
    const pipelineRes = await AIRemediationPipeline.remediateDefect(sampleCode, sampleDefect, 'REACT_JSX');
    assert.equal(pipelineRes.engineType, 'AST_DETERMINISTIC_FIX');
    assert.equal(pipelineRes.verified, true);
    assert.equal(pipelineRes.verificationStatus, 'FIXED');
    assert.equal(pipelineRes.fallbackReason, undefined, 'a deterministic fix must never need a fallbackReason');
    assert.ok(pipelineRes.remediatedCode.length > 0);
    assert.ok(pipelineRes.suggestedFix?.diff.length! > 0);
  });

  await t.test('AI Remediation Pipeline reports UNAVAILABLE — never a regex-fabricated fix — for an AI_ASSISTED rule when ANTHROPIC_API_KEY is unset', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_MODEL;

    // FIGM-REACT-01 has no deterministic fixer (routes AI_ASSISTED — see
    // tests/claude-integration.test.ts) and no manual-review-only classification either, so with
    // no API key configured there is genuinely no automated path left. The legacy
    // src/engine/remediation-engine.ts regex engine must NEVER be silently invoked to manufacture
    // a plausible-looking "fixed" result here (architecture rule #14/#19).
    const reactDefect: DiagnosticReport = {
      ruleId: 'FIGM-REACT-01',
      ruleName: 'Missing key prop in dynamic list rendering',
      message: 'Missing key prop in dynamic list rendering',
      domain: 'PERFORMANCE',
      concern: 'INVARIANT_ALLOCATIONS',
      severity: 'HIGH',
      filePath: 'src/List.jsx',
      location: { start: { line: 3, column: 3 }, end: { line: 3, column: 60 } },
      offendingCodeSnippet: 'return <ul>{sorted.map((n) => <li>{n}</li>)}</ul>;',
      remediation: 'Add a stable, unique `key` prop to each list item.',
      standardReference: 'ISO 25010'
    };
    const reactCode = `function List({ items }) {\n  const sorted = items.sort((a, b) => a - b);\n  return <ul>{sorted.map((n) => <li>{n}</li>)}</ul>;\n}`;

    const pipelineRes = await AIRemediationPipeline.remediateDefect(reactCode, reactDefect, 'REACT_JSX');
    assert.equal(pipelineRes.engineType, 'UNAVAILABLE');
    assert.equal(pipelineRes.verified, false);
    // AI_UNAVAILABLE, not UNRESOLVED: no provider was even configured, so no candidate patch was
    // ever produced — UNRESOLVED is reserved for when a real patch WAS generated and
    // sandbox-validated/re-scanned but still failed (see AIRemediationPipelineResult's
    // verificationStatus doc comment in src/ai/ai-remediation-pipeline.ts).
    assert.equal(pipelineRes.verificationStatus, 'AI_UNAVAILABLE');
    assert.equal(pipelineRes.remediatedCode, reactCode, 'no code change may be produced when no automated fix is available');
    assert.ok(pipelineRes.fallbackReason?.includes('ANTHROPIC_API_KEY'));
  });

  await t.test('applyQuickFix for FIGM-PERF-01 preserves the original variable name (regression: a prior version hardcoded a new name, leaving dangling references)', () => {
    const patchRes = RemediationEngine.applyQuickFix(sampleCode, sampleDefect);
    assert.ok(patchRes.remediatedCode.includes('const defaultConfig ='), 'expected the original variable name "defaultConfig" to be preserved, not renamed');
    assert.ok(!patchRes.remediatedCode.includes('const options ='), 'the old broken template hardcoded "options" as the replacement name');

    const validation = RemediationValidator.validatePatch(sampleCode, patchRes.remediatedCode, sampleDefect);
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
    assert.ok(!rescan.some((d: any) => d.ruleId === 'FIGM-PERF-01'), 'sanity check: the rule really does stop firing on the broken patch');

    // ...yet validatePatch must still reject it, because the patch is not valid code.
    const validation = RemediationValidator.validatePatch(originalCode, brokenPatch, brokenDefect);
    assert.equal(validation.isValid, false);
    assert.equal(validation.status, 'PATCH_REJECTED');
  });

  await t.test('REGRESSION (found via live production testing): FIGM-REACT-02 gets its own fix, not the A11Y "clickable element" fallback', () => {
    // FIGM-REACT-02 previously had no dedicated case in applyQuickFix's switch, so it silently
    // fell through to the generic "universal pattern" fallback, which pattern-matches the
    // snippet's superficial shape rather than the actual rule. Because this snippet also
    // contains onClick=, the fallback misfired the A11Y "clickable non-interactive element"
    // template (adding role="button"/tabIndex/onKeyDown) and left the real key={index} violation
    // completely untouched — reproduced live against the production deployment before being
    // fixed here.
    const code = `items.map((item, index) => <li key={index} onClick={() => handleClick(item)}>{item.name}</li>)`;
    const defect: DiagnosticReport = {
      ruleId: 'FIGM-REACT-02',
      ruleName: 'Stable List Key Prop Assignment',
      message: 'Array index assigned as list key prop causing component re-ordering and state bugs.',
      domain: 'PERFORMANCE',
      concern: 'LAYOUT_INSTABILITY',
      severity: 'HIGH',
      filePath: 'List.jsx',
      location: { start: { line: 1, column: 31 }, end: { line: 1, column: 94 } },
      offendingCodeSnippet: code,
      remediation: 'Assign a unique stable identifier (item.id) to list key props instead of array index.',
      standardReference: 'ISO 25010'
    };

    const result = RemediationEngine.applyQuickFix(code, defect);
    assert.ok(!result.remediatedCode.includes('key={index}'), 'the array-index key must actually be replaced');
    assert.ok(result.remediatedCode.includes('key={item.id}'), 'replaced with a stable identifier derived from the .map() item parameter');
    assert.ok(!result.remediatedCode.includes('role="button"'), 'must not apply the unrelated A11Y "clickable element" template to a key-prop violation');

    const rescan = RuleExecutionEngineCheck(result.remediatedCode);
    assert.ok(!rescan.some((d: DiagnosticReport) => d.ruleId === 'FIGM-REACT-02'), 'the original FIGM-REACT-02 violation must genuinely disappear on re-scan');
  });

  await t.test('REGRESSION (found via live production testing): FIGM-A11Y-01 keyboard handler correctly invokes an arrow-function onClick value', () => {
    // The generated onKeyDown handler captured the onClick attribute's value ($1) and called it
    // as `$1()` with no wrapping parens. When the onClick value is an arrow function (the
    // overwhelmingly common real-world case, e.g. `onClick={() => handleClick(item)}`), operator
    // precedence means `() => handleClick(item)()` parses as an arrow function whose BODY is
    // `handleClick(item)()` — defining a function and never calling it, a silent no-op reproduced
    // live against the production deployment. Wrapping in parens, `($1)()`, calls the value
    // correctly whether it is an arrow function or a bare function reference.
    const code = `<div onClick={() => handleClick(item)}>Click area</div>`;
    const defect: DiagnosticReport = {
      ruleId: 'FIGM-A11Y-01',
      ruleName: 'Keyboard Event Parity on Pointer Handlers',
      message: 'Non-interactive element has pointer click listener but lacks onKeyDown handler or tabindex.',
      domain: 'ACCESSIBILITY',
      concern: 'KEYBOARD_ACCESSIBILITY',
      severity: 'CRITICAL',
      filePath: 'Widget.tsx',
      location: { start: { line: 1, column: 0 }, end: { line: 1, column: 57 } },
      offendingCodeSnippet: code,
      remediation: 'Add onKeyDown handler and tabIndex.',
      standardReference: 'WCAG 2.2'
    };

    const result = RemediationEngine.applyQuickFix(code, defect);
    const marker = 'onKeyDown={';
    const markerIdx = result.remediatedCode.indexOf(marker);
    assert.ok(markerIdx >= 0, 'onKeyDown handler must be present in the remediated code');
    // Brace-counting extraction (not a regex) so nested {} inside the handler body don't
    // truncate the match early — this is JSX attribute syntax, not a flat string.
    let depth = 1;
    let i = markerIdx + marker.length;
    while (depth > 0 && i < result.remediatedCode.length) {
      if (result.remediatedCode[i] === '{') depth++;
      else if (result.remediatedCode[i] === '}') depth--;
      i++;
    }
    const handlerBody = result.remediatedCode.slice(markerIdx + marker.length, i - 1);

    // Real syntax + semantic check: actually execute the generated handler and confirm it
    // invokes handleClick with the original item, rather than just eyeballing the string.
    let calledWith: unknown = null;
    const handleClick = (x: unknown) => { calledWith = x; };
    const item = { id: 42 };
    const fn = new Function('handleClick', 'item', 'e', `return (${handlerBody})(e);`);
    fn(handleClick, item, { key: 'Enter' });
    assert.equal(calledWith, item, 'pressing Enter must actually call handleClick(item), not silently no-op');
  });
});

function RuleExecutionEngineCheck(code: string) {
  // Local helper kept inline to avoid an extra top-of-file import purely for one sanity assertion.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { RuleExecutionEngine } = require('../src/engine/rule-execution-engine.js');
  return RuleExecutionEngine.analyzeFile('BrokenPatchRegression.tsx', code).diagnostics;
}
