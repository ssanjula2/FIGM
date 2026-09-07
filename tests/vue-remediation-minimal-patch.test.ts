import test from 'node:test';
import assert from 'node:assert/strict';
import { AIRemediationPipeline } from '../src/ai/ai-remediation-pipeline.js';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/**
 * Comprehensive regression coverage for Vue SFC AI remediation always operating as a minimal,
 * localized patch and never duplicating/appending a full second SFC -- see
 * src/parser/vue-sfc-parser.ts's assertSingleVueSfcStructure and src/ai/patch-validator.ts /
 * src/ai/sandbox-validation-pipeline.ts, both of which now share that one definition.
 *
 * Every scenario below uses the exact reproduction fixture and rules (FIGM-A11Y-01, FIGM-PERF-02)
 * from the real production report. Only the outbound Gemini network call is ever mocked -- routing
 * (src/ai/ai-remediation-router.ts), the deterministic engines (both FIGM-A11Y-01 and FIGM-PERF-02
 * are confirmed, by direct source inspection, to ALWAYS decline for these instances --
 * fixA11y01 looks for a React-style `onClick={...}` JSX expression attribute, which Vue's
 * `@click="..."` directive syntax never produces; fixPerf02 unconditionally declines per its own
 * "never hallucinate dimensions" safety contract -- so both rules genuinely reach the AI-assisted
 * path on a Vue file, this is not a routing quirk this suite works around), patch validation, and
 * FIGM's own rule engine are all real.
 */

const ORIGINAL_VUE = `<template>
  <div class="user-profile">
    <h2>User Profile</h2>

    <img src="/images/profile.png" />

    <input
      v-model="name"
      aria-label="User name"
    />

    <div @click="saveProfile">
      Save Profile
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const name = ref("Test User");

function saveProfile() {
  console.log("Saved:", name.value);
}
</script>
`;

// Minimal, localized fix: ONLY the clickable <div>/</div> becomes <button type="button">/</button>.
// Every other line is byte-identical to ORIGINAL_VUE.
const FIXED_A11Y01 = ORIGINAL_VUE
  .replace('<div @click="saveProfile">', '<button type="button" @click="saveProfile">')
  .replace('      Save Profile\n    </div>\n  </div>\n</template>', '      Save Profile\n    </button>\n  </div>\n</template>');

// Minimal, localized fix: ONLY the <img> tag gains width/height. Every other line unchanged.
const FIXED_PERF02 = ORIGINAL_VUE.replace(
  '<img src="/images/profile.png" />',
  '<img src="/images/profile.png" width="120" height="120" />'
);

function getDefect(code: string, ruleId: string): DiagnosticReport {
  const result = RuleExecutionEngine.analyzeFile('UserProfile.vue', code);
  const defect = result.diagnostics.find((d) => d.ruleId === ruleId);
  if (!defect) throw new Error(`Test fixture setup failed: expected ${ruleId} not detected.`);
  return defect;
}

function templateCount(code: string): number {
  return (code.match(/<template[\s>]/g) || []).length;
}
function scriptSetupCount(code: string): number {
  return (code.match(/<script\s+setup[\s>]/g) || []).length;
}

function geminiChatResponse(content: string): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: content }] }, finishReason: 'STOP', index: 0 }] }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

/** Mocks only the outbound Gemini network call; queues one scripted response per call (repeating
 *  the last one if more calls happen than responses provided) and records every request body sent,
 *  so a retry sequence's OWN prompt content can be inspected -- not just the responses. */
function mockGeminiFetchSequence(responses: Array<() => Response>) {
  const original = global.fetch;
  const requestBodies: string[] = [];
  let callIndex = 0;
  (global as any).fetch = async (url: string, init?: RequestInit) => {
    if (!String(url).includes('generativelanguage.googleapis.com')) {
      throw new Error(`Unexpected non-Gemini fetch call in this test: ${url}`);
    }
    if (init?.body) requestBodies.push(String(init.body));
    const handler = responses[Math.min(callIndex, responses.length - 1)];
    callIndex += 1;
    return handler();
  };
  return {
    restore: () => {
      global.fetch = original;
    },
    calls: () => callIndex,
    requestBodies,
  };
}

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const originals: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) originals[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return fn().finally(() => {
    for (const [k, v] of Object.entries(originals)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

const BASE_ENV = {
  OLLAMA_BASE_URL: undefined,
  OLLAMA_MODEL: undefined,
  AI_PRIMARY_PROVIDER: undefined,
  AI_FALLBACK_PROVIDER: undefined,
  ANTHROPIC_API_KEY: undefined,
  GEMINI_API_KEY: 'gm_test_key_not_real',
};

function patchResponse(patch: string, explanation = 'Minimal targeted fix.', confidence = 95): () => Response {
  return () => geminiChatResponse(JSON.stringify({ status: 'PATCH', patch, explanation, confidence }));
}

// --- F.1 & F.2: clean Vue SFC detects each violation, and a minimal fix resolves it ------------

test('F.1: clean Vue SFC + FIGM-A11Y-01 -- detected, minimally fixed (button, single SFC), unrelated findings untouched', async () => {
  const defect = getDefect(ORIGINAL_VUE, 'FIGM-A11Y-01');
  const mock = mockGeminiFetchSequence([patchResponse(FIXED_A11Y01)]);
  try {
    const result = await withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(ORIGINAL_VUE, defect, 'VUE_SFC'));

    assert.equal(result.engineType, 'AI_ASSISTED_FIX');
    assert.equal(result.provider, 'GEMINI');
    assert.equal(result.verified, true);
    assert.equal(result.verificationStatus, 'FIXED');
    assert.equal(templateCount(result.remediatedCode), 1, 'F.8: exactly one <template>');
    assert.ok(scriptSetupCount(result.remediatedCode) <= 1, 'F.9: at most one <script setup>');
    // The pipeline's own response parser trims outer whitespace off every accepted patch
    // (src/ai/response-parser.ts's stripMarkdownFences) -- a harmless, pre-existing, content-
    // neutral normalization, so compare with the same trimming rather than expecting a trailing
    // newline to survive.
    assert.equal(result.remediatedCode.trim(), FIXED_A11Y01.trim(), 'must be a pure minimal edit, not a reconstructed file');

    const rescan = RuleExecutionEngine.analyzeFile('UserProfile.vue', result.remediatedCode);
    assert.ok(!rescan.diagnostics.some((d) => d.ruleId === 'FIGM-A11Y-01'), 'F.10: target violation removed');
    assert.ok(rescan.diagnostics.some((d) => d.ruleId === 'FIGM-PERF-02'), 'F.11: unrelated FIGM-PERF-02 finding must remain');
    assert.ok(rescan.diagnostics.some((d) => d.ruleId === 'FIGM-A11Y-05'), 'F.11: unrelated FIGM-A11Y-05 finding must remain');
  } finally {
    mock.restore();
  }
});

test('F.2: clean Vue SFC + FIGM-PERF-02 -- detected, minimally fixed (width/height, single SFC), unrelated findings untouched', async () => {
  const defect = getDefect(ORIGINAL_VUE, 'FIGM-PERF-02');
  const mock = mockGeminiFetchSequence([patchResponse(FIXED_PERF02)]);
  try {
    const result = await withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(ORIGINAL_VUE, defect, 'VUE_SFC'));

    assert.equal(result.engineType, 'AI_ASSISTED_FIX');
    assert.equal(result.provider, 'GEMINI');
    assert.equal(result.verified, true);
    assert.equal(result.verificationStatus, 'FIXED');
    assert.equal(templateCount(result.remediatedCode), 1, 'F.8: exactly one <template>');
    assert.ok(scriptSetupCount(result.remediatedCode) <= 1, 'F.9: at most one <script setup>');
    assert.equal(result.remediatedCode.trim(), FIXED_PERF02.trim(), 'must be a pure minimal edit, not a reconstructed file');

    const rescan = RuleExecutionEngine.analyzeFile('UserProfile.vue', result.remediatedCode);
    assert.ok(!rescan.diagnostics.some((d) => d.ruleId === 'FIGM-PERF-02'), 'F.10: target violation removed');
    assert.ok(rescan.diagnostics.some((d) => d.ruleId === 'FIGM-A11Y-01'), 'F.11: unrelated FIGM-A11Y-01 finding must remain');
    assert.ok(rescan.diagnostics.some((d) => d.ruleId === 'FIGM-A11Y-05'), 'F.11: unrelated FIGM-A11Y-05 finding must remain');
  } finally {
    mock.restore();
  }
});

// --- F.3 & F.4: legitimate full-file responses (the expected contract) are accepted, never ------
// --- rejected merely for being "the complete file" -- only a STRUCTURALLY INVALID one is. -------

test('F.3: Gemini returning a full, valid, single SFC (the expected "complete file" contract) is accepted as pure replacement, never concatenated', async () => {
  const defect = getDefect(ORIGINAL_VUE, 'FIGM-A11Y-01');
  const mock = mockGeminiFetchSequence([patchResponse(FIXED_A11Y01)]);
  try {
    const result = await withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(ORIGINAL_VUE, defect, 'VUE_SFC'));
    assert.equal(result.verified, true);
    // Exact equality (modulo the pipeline's own outer-whitespace trim -- see F.1's comment) proves
    // the accepted code IS the model's full-file response verbatim -- never original+patch
    // concatenated, never patch+original.
    assert.equal(result.remediatedCode.trim(), FIXED_A11Y01.trim());
    assert.ok(!result.remediatedCode.includes(ORIGINAL_VUE), 'must never contain the original as a literal substring alongside the fix');
  } finally {
    mock.restore();
  }
});

test('F.4: Gemini wrapping the patch value in ```vue fences is stripped correctly and accepted', async () => {
  const defect = getDefect(ORIGINAL_VUE, 'FIGM-A11Y-01');
  const fencedPatch = '```vue\n' + FIXED_A11Y01 + '```';
  const mock = mockGeminiFetchSequence([patchResponse(fencedPatch)]);
  try {
    const result = await withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(ORIGINAL_VUE, defect, 'VUE_SFC'));
    assert.equal(result.verified, true);
    assert.equal(result.verificationStatus, 'FIXED');
    assert.ok(!result.remediatedCode.includes('```'), 'markdown fences must be fully stripped from the accepted code');
    assert.equal(templateCount(result.remediatedCode), 1);
    assert.equal(result.remediatedCode.trim(), FIXED_A11Y01.trim());
  } finally {
    mock.restore();
  }
});

// --- F.5 & F.6: the real production defect shapes are rejected, original left untouched ---------

test('F.5: Gemini returning a duplicated SFC (original + a second full copy) is rejected -- F.12: original source unchanged', async () => {
  const defect = getDefect(ORIGINAL_VUE, 'FIGM-A11Y-01');
  const duplicatedSfc = `${ORIGINAL_VUE.trim()}\n${FIXED_A11Y01.trim()}\n`;
  const mock = mockGeminiFetchSequence([patchResponse(duplicatedSfc)]);
  try {
    const result = await withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(ORIGINAL_VUE, defect, 'VUE_SFC'));
    assert.equal(result.verified, false);
    assert.notEqual(result.engineType, 'AI_ASSISTED_FIX');
    assert.equal(result.remediatedCode, ORIGINAL_VUE, 'F.12: original source must remain byte-identical when the candidate is rejected');
  } finally {
    mock.restore();
  }
});

test('F.6: a candidate containing the exact "</script><template>" concatenation artifact is rejected -- original source unchanged', async () => {
  const defect = getDefect(ORIGINAL_VUE, 'FIGM-A11Y-01');
  // Byte-for-byte reproduction of the reported artifact: no separator between the two SFCs at all.
  const concatenated = ORIGINAL_VUE.trim() + FIXED_A11Y01.trim();
  assert.ok(concatenated.includes('</script><template>'), 'test setup: fixture must actually contain the literal artifact being tested');

  const mock = mockGeminiFetchSequence([patchResponse(concatenated)]);
  try {
    const result = await withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(ORIGINAL_VUE, defect, 'VUE_SFC'));
    assert.equal(result.verified, false);
    assert.equal(result.remediatedCode, ORIGINAL_VUE, 'F.12: original source must remain byte-identical when the candidate is rejected');
  } finally {
    mock.restore();
  }
});

// --- F.7: retries never accumulate/append the previous (rejected) candidate ---------------------

test('F.7: retry attempts never accumulate/append the previous rejected candidate -- each request\'s SOURCE CODE is the original, unchanged', async () => {
  const defect = getDefect(ORIGINAL_VUE, 'FIGM-A11Y-01');
  const duplicatedSfc = `${ORIGINAL_VUE.trim()}\n${FIXED_A11Y01.trim()}\n`;
  const mock = mockGeminiFetchSequence([patchResponse(duplicatedSfc), patchResponse(FIXED_A11Y01)]);
  try {
    const result = await withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(ORIGINAL_VUE, defect, 'VUE_SFC'));
    assert.equal(result.verified, true);
    assert.equal(mock.calls(), 2);
    assert.equal(mock.requestBodies.length, 2);

    for (const body of mock.requestBodies) {
      // Every request's own prompt content must embed the ORIGINAL source verbatim under SOURCE
      // CODE -- never a growing/mutated copy across attempts.
      assert.ok(body.includes('User Profile'), 'each request must carry the real source code');
      // The prompt is JSON-escaped inside the Gemini request body -- check for the escaped form of
      // the rejected duplicate's own distinguishing content instead of the raw string.
      const escapedRejectedMarker = JSON.stringify(FIXED_A11Y01).slice(1, -1); // strip the outer quotes JSON.stringify adds
      const occurrences = (body.match(new RegExp(escapedRejectedMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      assert.ok(occurrences <= 1, 'the rejected candidate\'s full code must never be embedded verbatim in a later request (only its failure REASON may be)');
    }
    // The two requests must not be identical (the second carries retry feedback the first didn't).
    assert.notEqual(mock.requestBodies[0], mock.requestBodies[1]);
  } finally {
    mock.restore();
  }
});

test('F.7b: the `code` argument passed to remediateDefect is never mutated across the retry loop', async () => {
  const defect = getDefect(ORIGINAL_VUE, 'FIGM-A11Y-01');
  const originalSnapshot = ORIGINAL_VUE;
  const duplicatedSfc = `${ORIGINAL_VUE.trim()}\n${FIXED_A11Y01.trim()}\n`;
  const mock = mockGeminiFetchSequence([patchResponse(duplicatedSfc), patchResponse(duplicatedSfc), patchResponse(FIXED_A11Y01)]);
  try {
    await withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(ORIGINAL_VUE, defect, 'VUE_SFC'));
    assert.equal(ORIGINAL_VUE, originalSnapshot, 'the caller\'s own source string must never be mutated by the pipeline');
  } finally {
    mock.restore();
  }
});

// --- Scope guard: this suite must never touch React/Next.js/Angular remediation -----------------

test('scope guard: FIGM-A11Y-01 on a React file is routed to the deterministic AST engine, never touching any Vue-specific structural check', async () => {
  const reactCode = `function Widget() {\n  return <div onClick={handleClick}>Click</div>;\n}\n`;
  const result = RuleExecutionEngine.analyzeFile('Widget.jsx', reactCode);
  const reactDefect = result.diagnostics.find((d) => d.ruleId === 'FIGM-A11Y-01');
  assert.ok(reactDefect, 'test setup: React fixture must trigger FIGM-A11Y-01');

  const originalLog = console.log;
  const lines: string[] = [];
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  try {
    // Whatever the final outcome for this exact fixture (an unrelated, pre-existing detail of
    // fixA11y01's own re-scan behavior, not something this Vue-remediation fix touches), routing
    // itself must send FIGM-A11Y-01 on a REACT_JSX file to the deterministic engine, never to any
    // Vue-specific code path -- assertSingleVueSfcStructure is never called for a non-.vue filePath
    // (see patch-validator.ts's own `.vue`-only guard, covered directly in
    // tests/vue-sfc-duplicate-patch-rejection.test.ts's own scope-guard test).
    await AIRemediationPipeline.remediateDefect(reactCode, reactDefect!, 'REACT_JSX');
    assert.ok(lines.some((l) => l.includes('stage=ROUTED') && l.includes('strategy=AST_DETERMINISTIC')));
    assert.ok(lines.some((l) => l.includes('stage=DETERMINISTIC_ATTEMPTED')));
  } finally {
    console.log = originalLog;
  }
});
