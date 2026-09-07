import test from 'node:test';
import assert from 'node:assert/strict';
import { AIRemediationPipeline } from '../src/ai/ai-remediation-pipeline.js';
import { AIPatchValidator } from '../src/ai/patch-validator.js';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/**
 * Regression coverage for a real production incident: a Gemini-generated Vue AI remediation
 * candidate for FIGM-A11Y-01 (Keyboard Event Parity on Pointer Handlers) contained TWO complete
 * Vue SFC structures concatenated together (the model appended a full "corrected" copy of the
 * component after the original instead of editing it in place) -- @vue/compiler-sfc correctly
 * rejected it with "Single file component can contain only one <template> element" / "...only one
 * <script setup> element".
 *
 * Root cause (see src/ai/patch-validator.ts's own doc comment): the cheap PRE_FILTER stage
 * (AIPatchValidator.validatePatch) only ever checked `!parseResult.ast` from
 * SourceParser.parseSource -- which is ALWAYS truthy for a Vue file, even a structurally invalid
 * one, since that parser degrades gracefully (records real problems in `parseErrors` instead of
 * throwing). The heavier sandbox's own FRAMEWORK_STRUCTURAL stage
 * (src/ai/sandbox-validation-pipeline.ts) already called @vue/compiler-sfc directly and DID reject
 * the bad patch correctly -- this was a real safety net, working as intended -- but the cheap
 * pre-filter that exists specifically to catch this earlier never did.
 *
 * Fixed by: (1) a Vue-SFC-specific structural check added to AIPatchValidator.validatePatch,
 * scoped to `.vue` files only (never affects React/Next.js/Angular validation), and (2) an explicit
 * SFC structural requirement added to the shared AI prompt (src/ai/prompt-builder.ts), shown only
 * when framework === 'VUE_SFC', to reduce the chance of the model producing this shape at all.
 *
 * This file never mocks the sandbox, the deterministic engines, or FIGM's own rule engine -- only
 * the outbound Gemini network call is mocked (same pattern as
 * tests/deterministic-fix-routing.test.ts), so every validation/rejection/acceptance decision below
 * is the REAL pipeline's own real decision.
 */

// The exact reproduction fixture from the production incident report.
const USER_PROFILE_VUE = `<template>
  <div class="user-profile">
    <h2>User Profile</h2>

    <img
      src="/images/profile.png"
      alt="User profile"
      width="120"
      height="120"
    />

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

// The minimal, correct remediation: the non-interactive <div> click handler becomes a native
// <button> -- nothing else changes.
const USER_PROFILE_VUE_FIXED = `<template>
  <div class="user-profile">
    <h2>User Profile</h2>

    <img
      src="/images/profile.png"
      alt="User profile"
      width="120"
      height="120"
    />

    <input
      v-model="name"
      aria-label="User name"
    />

    <button @click="saveProfile">
      Save Profile
    </button>
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

// Exact reproduction of the real defect: the original SFC immediately followed by a second,
// "corrected" copy -- no separator, matching the production report's literal `</script><template>`
// junction.
const DUPLICATE_SFC_PATCH = `${USER_PROFILE_VUE.trim()}\n${USER_PROFILE_VUE_FIXED.trim()}\n`;

function getReactA11y01Defect(): DiagnosticReport {
  const result = RuleExecutionEngine.analyzeFile('UserProfile.vue', USER_PROFILE_VUE);
  const defect = result.diagnostics.find((d) => d.ruleId === 'FIGM-A11Y-01');
  if (!defect) throw new Error('Test fixture setup failed: expected FIGM-A11Y-01 not detected.');
  return defect;
}

function geminiChatResponse(content: string): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: content }] }, finishReason: 'STOP', index: 0 }] }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

/** Mocks only the outbound Gemini network call; queues one scripted response per call so a
 *  multi-attempt retry sequence (bad patch, then a corrected one) can be reproduced deterministically. */
function mockGeminiFetchSequence(responses: Array<() => Response>) {
  const original = global.fetch;
  let callIndex = 0;
  (global as any).fetch = async (url: string) => {
    if (!String(url).includes('generativelanguage.googleapis.com')) {
      throw new Error(`Unexpected non-Gemini fetch call in this test: ${url}`);
    }
    const handler = responses[Math.min(callIndex, responses.length - 1)];
    callIndex += 1;
    return handler();
  };
  return {
    restore: () => {
      global.fetch = original;
    },
    calls: () => callIndex,
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

test('the clean reproduction fixture itself is valid Vue and detects exactly the expected FIGM-A11Y-01 violation', () => {
  const result = RuleExecutionEngine.analyzeFile('UserProfile.vue', USER_PROFILE_VUE);
  const a11y01 = result.diagnostics.find((d) => d.ruleId === 'FIGM-A11Y-01');
  assert.ok(a11y01, 'FIGM-A11Y-01 (Keyboard Event Parity on Pointer Handlers) must be detected on the clickable <div>');
  assert.equal(a11y01!.ruleName, 'Keyboard Event Parity on Pointer Handlers');
  assert.equal(a11y01!.offendingCodeSnippet, '<div @click="saveProfile">');
});

test('AIPatchValidator.validatePatch rejects a duplicated-SFC candidate at the cheap pre-filter stage (the actual bug fixed here)', () => {
  const result = AIPatchValidator.validatePatch(USER_PROFILE_VUE, DUPLICATE_SFC_PATCH, 'UserProfile.vue');
  assert.equal(result.isValid, false);
  assert.match(result.reason || '', /only one <template> element/);
  assert.match(result.reason || '', /only one <script setup> element/);
});

test('AIPatchValidator.validatePatch accepts the clean, minimal, single-SFC corrected patch', () => {
  const result = AIPatchValidator.validatePatch(USER_PROFILE_VUE, USER_PROFILE_VUE_FIXED, 'UserProfile.vue');
  assert.equal(result.isValid, true, result.reason);
});

test('AIPatchValidator.validatePatch is unaffected for non-Vue files (React/TSX) -- the new check is scoped to .vue only', () => {
  const originalReact = `function Widget() {\n  return <div onClick={handleClick}>Click</div>;\n}\n`;
  const patchedReact = `function Widget() {\n  return <button onClick={handleClick}>Click</button>;\n}\n`;
  const result = AIPatchValidator.validatePatch(originalReact, patchedReact, 'Widget.tsx');
  assert.equal(result.isValid, true, result.reason);
});

test('end-to-end: a duplicated-SFC AI response is never accepted -- original code remains unchanged after all attempts', async () => {
  const defect = getReactA11y01Defect();
  // Every attempt returns the same duplicated-SFC shape -- reproduces a model that keeps making
  // the same structural mistake even with retry feedback.
  const mock = mockGeminiFetchSequence([
    () =>
      geminiChatResponse(
        JSON.stringify({
          status: 'PATCH',
          patch: DUPLICATE_SFC_PATCH,
          explanation: 'Replaced the div with a button for keyboard accessibility.',
          confidence: 90,
        })
      ),
  ]);
  try {
    const result = await withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(USER_PROFILE_VUE, defect, 'VUE_SFC'));

    assert.equal(result.verified, false, 'a duplicated SFC must never be accepted as a verified fix');
    assert.notEqual(result.engineType, 'AI_ASSISTED_FIX', 'engineType must never report AI_ASSISTED_FIX for a rejected patch');
    assert.equal(result.remediatedCode, USER_PROFILE_VUE, 'the original source must be returned completely unchanged when validation fails');
    assert.ok(mock.calls() >= 1);
  } finally {
    mock.restore();
  }
});

test('end-to-end: after a duplicated-SFC attempt is rejected, a corrected minimal single-SFC retry is accepted, verified, and re-scan confirms the violation is gone', async () => {
  const defect = getReactA11y01Defect();
  const mock = mockGeminiFetchSequence([
    () =>
      geminiChatResponse(
        JSON.stringify({
          status: 'PATCH',
          patch: DUPLICATE_SFC_PATCH,
          explanation: 'Replaced the div with a button for keyboard accessibility.',
          confidence: 90,
        })
      ),
    () =>
      geminiChatResponse(
        JSON.stringify({
          status: 'PATCH',
          patch: USER_PROFILE_VUE_FIXED,
          explanation: 'Replaced the non-interactive clickable <div> with a native <button>, preserving the exact same @click handler and surrounding markup.',
          confidence: 96,
        })
      ),
  ]);
  try {
    const result = await withEnv(BASE_ENV, () => AIRemediationPipeline.remediateDefect(USER_PROFILE_VUE, defect, 'VUE_SFC'));

    assert.equal(result.engineType, 'AI_ASSISTED_FIX');
    assert.equal(result.provider, 'GEMINI');
    assert.equal(result.verified, true);
    assert.equal(result.verificationStatus, 'FIXED');
    assert.equal(mock.calls(), 2, 'exactly two attempts: the rejected duplicate, then the accepted correction');

    // Exactly one <template> / one <script setup> in the accepted patch -- never a duplicated SFC.
    assert.equal((result.remediatedCode.match(/<template[\s>]/g) || []).length, 1);
    assert.equal((result.remediatedCode.match(/<script setup[\s>]/g) || []).length, 1);

    // Re-scan with the real rule engine confirms the original violation is actually gone.
    const rescan = RuleExecutionEngine.analyzeFile('UserProfile.vue', result.remediatedCode);
    assert.ok(!rescan.diagnostics.some((d) => d.ruleId === 'FIGM-A11Y-01'), 'FIGM-A11Y-01 must no longer be detected after the fix');
  } finally {
    mock.restore();
  }
});
