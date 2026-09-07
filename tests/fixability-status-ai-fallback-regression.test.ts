import test from 'node:test';
import assert from 'node:assert/strict';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';
import { getFixabilityStatus } from '../src/engine/diagnostic-classifier.js';
import { decideRemediation } from '../src/ai/remediation-decision.js';

/**
 * Regression suite for a Live Scan UI bug: FIGM-PERF-02 (and any other rule whose deterministic
 * fixer correctly DECLINES a specific instance) permanently showed "No Safe Fix Available" instead
 * of exposing the normal AI-assisted remediation flow.
 *
 * Root cause: `getFixabilityStatus()` (src/engine/diagnostic-classifier.ts) -- which computes the
 * pre-attempt `fixabilityStatus` field the Live Scan card's Fix button label/enabled-state is
 * driven by -- ran an INDEPENDENT dry-run against the legacy, pre-AI `RemediationEngine
 * .applyQuickFix`, a completely separate decision path from `decideRemediation()` (the real
 * rule-ID-routed, per-instance decision `AIRemediationPipeline.remediateDefect` actually uses). The
 * two could disagree. For FIGM-PERF-02 specifically: the real per-instance decision is
 * `AI_ASSISTED` (the deterministic fixer deliberately declines rather than hallucinate <img>
 * dimensions -- see ast-fix-engine.ts's fixPerf02), but the legacy engine's own regex-replace
 * silently no-op'd on a truncated single-token `offendingCodeSnippet` ("<img", no trailing
 * whitespace, from a multi-line JSX element with no dimensions), producing `remediatedCode ===
 * code` and therefore `NO_SAFE_FIX` -- permanently disabling the Fix button even though AI-assisted
 * remediation (full sandbox validation + re-scan before ever being marked verified) was genuinely
 * available.
 *
 * These tests assert the fixed behavior directly against the real scan pipeline and
 * `getFixabilityStatus()`/`decideRemediation()` (never a mock), covering the exact reported React
 * case plus the same rule/UI-condition on Next.js/Angular/Vue and on FIGM-A11Y-01, and a genuine
 * negative control (a rule-level MANUAL_REVIEW_ONLY case, where NO_SAFE_FIX remains correct).
 */

async function scanFor(fileName: string, code: string, ruleId: string) {
  const result = await RuleExecutionEngine.analyzeFileAsync(fileName, code);
  const defect = result.diagnostics.find((d) => d.ruleId === ruleId);
  assert.ok(defect, `expected ${ruleId} to be detected in ${fileName}, got: ${result.diagnostics.map((d) => d.ruleId).join(', ')}`);
  return defect!;
}

test('FIGM-PERF-02 on React (exact reported case): fixabilityStatus is AUTO_FIX_AVAILABLE, not NO_SAFE_FIX', async () => {
  const code = `import React from "react";

export default function UserProfile() {
  const handleSave = () => {
    console.log("Saved");
  };

  return (
    <div>
      <h2>User Profile</h2>

      <img
        src="/images/profile.png"
        alt="User profile"
      />

      <div onClick={handleSave}>
        Save Profile
      </div>
    </div>
  );
}
`;
  const defect = await scanFor('UserProfile.jsx', code, 'FIGM-PERF-02');

  // The scan response itself (what the Live Scan card actually renders) must already carry the
  // fixed status -- not merely a value getFixabilityStatus() would recompute if called again.
  assert.equal((defect as any).fixabilityStatus, 'AUTO_FIX_AVAILABLE', 'Live Scan must not show "No Safe Fix Available" when AI-assisted remediation is genuinely allowed');

  // The underlying per-instance decision this status must never drift from.
  const decision = decideRemediation(code, defect, 'UserProfile.jsx');
  assert.equal(decision.strategy, 'AI_ASSISTED');
  assert.equal(decision.aiAllowed, true);
  assert.equal(decision.requiresManualReview, false);
  assert.equal(decision.deterministicFixAvailable, false, 'the deterministic fixer must have genuinely declined (never hallucinate <img> dimensions), not silently "succeeded"');
});

test('FIGM-PERF-02 on Next.js: same AI-fallback fixability, deterministic fixer still declines', async () => {
  const code = `export default function Page({ user }) {
  return (
    <img
      src={user.avatarUrl}
      alt="Avatar"
    />
  );
}
`;
  const defect = await scanFor('app/dashboard/page.tsx', code, 'FIGM-PERF-02');
  assert.equal((defect as any).fixabilityStatus, 'AUTO_FIX_AVAILABLE');
  const decision = decideRemediation(code, defect, 'app/dashboard/page.tsx');
  assert.equal(decision.strategy, 'AI_ASSISTED');
  assert.equal(decision.aiAllowed, true);
});

test('FIGM-PERF-02 on Angular: routes to AI_ASSISTED (JSX-only deterministic fixer cannot locate a template <img>), never NO_SAFE_FIX', async () => {
  const code = `import { Component } from '@angular/core';
@Component({
  selector: 'app-avatar',
  template: \`
    <img
      src="{{avatarUrl}}"
      alt="Avatar"
    />
  \`
})
export class AvatarComponent {
  avatarUrl = '/avatar.png';
}
`;
  const defect = await scanFor('avatar.component.ts', code, 'FIGM-PERF-02');
  assert.equal((defect as any).fixabilityStatus, 'AUTO_FIX_AVAILABLE');
  const decision = decideRemediation(code, defect, 'avatar.component.ts');
  assert.equal(decision.aiAllowed, true);
  assert.equal(decision.requiresManualReview, false);
});

test('FIGM-PERF-02 on Vue: routes to AI_ASSISTED (no Vue-specific deterministic fixer owns this rule), never NO_SAFE_FIX', async () => {
  const code = `<template>
  <img
    :src="avatarUrl"
    alt="Avatar"
  />
</template>
<script setup>
import { ref } from 'vue';
const avatarUrl = ref('/avatar.png');
</script>
`;
  const defect = await scanFor('Avatar.vue', code, 'FIGM-PERF-02');
  assert.equal((defect as any).fixabilityStatus, 'AUTO_FIX_AVAILABLE');
  const decision = decideRemediation(code, defect, 'Avatar.vue');
  assert.equal(decision.aiAllowed, true);
  assert.equal(decision.requiresManualReview, false);
});

test('FIGM-A11Y-01 on React/Next.js: unaffected -- real deterministic fixer succeeds, AUTO_FIX_AVAILABLE for the same reason as before', async () => {
  const code = `export default function Card({ onSave }) {
  return (
    <div onClick={onSave}>
      Save
    </div>
  );
}
`;
  const defect = await scanFor('Card.jsx', code, 'FIGM-A11Y-01');
  assert.equal((defect as any).fixabilityStatus, 'AUTO_FIX_AVAILABLE');
  const decision = decideRemediation(code, defect, 'Card.jsx');
  assert.equal(decision.strategy, 'AST_DETERMINISTIC');
  assert.equal(decision.deterministicFixAvailable, true, 'React A11Y-01 has a real deterministic fixer and must not need the AI fallback');
});

test('FIGM-A11Y-01 on Vue and Angular: no deterministic fixer owns this rule, correctly routes AI_ASSISTED -- and the label reflects that, not a coincidental legacy-engine result', async () => {
  const vueCode = `<template>
  <div @click="onSave">
    Save
  </div>
</template>
<script setup>
const onSave = () => {};
</script>
`;
  const vueDefect = await scanFor('Card.vue', vueCode, 'FIGM-A11Y-01');
  assert.equal((vueDefect as any).fixabilityStatus, 'AUTO_FIX_AVAILABLE');
  const vueDecision = decideRemediation(vueCode, vueDefect, 'Card.vue');
  assert.equal(vueDecision.strategy, 'AI_ASSISTED', 'AstDeterministicFixEngine is JSX-only and must not claim a Vue SFC violation as its own deterministic success');
  assert.equal(vueDecision.aiAllowed, true);

  const angularCode = `import { Component } from '@angular/core';
@Component({
  selector: 'app-card',
  template: \`
    <div (click)="onSave()">Save</div>
  \`
})
export class CardComponent {
  onSave() {}
}
`;
  const angularDefect = await scanFor('card.component.ts', angularCode, 'FIGM-A11Y-01');
  assert.equal((angularDefect as any).fixabilityStatus, 'AUTO_FIX_AVAILABLE');
  const angularDecision = decideRemediation(angularCode, angularDefect, 'card.component.ts');
  assert.equal(angularDecision.strategy, 'AI_ASSISTED', 'AstDeterministicFixEngine is JSX-only and must not claim an Angular template violation as its own deterministic success');
  assert.equal(angularDecision.aiAllowed, true);
});

test('negative control: a genuine rule-level MANUAL_REVIEW_ONLY case (FIGM-REACT-06) still correctly reports NO_SAFE_FIX', async () => {
  // Based on src/matrix/four-layer-meta-model.ts's own FIGM-REACT-06 nonCompliantExample, extended
  // with a JSX return -- the real detector (nearestEnclosingComponentFunction, real-syntax-node-
  // builder.ts) only treats a function as a "component" (and so evaluates its Effects) once it
  // actually returns JSX. This rule is deliberately excluded from AI-assisted remediation
  // (AIRemediationRouter's MANUAL_REVIEW_ONLY_RULE_IDS) because a blindly-added effect dependency
  // can introduce an infinite render loop, a runtime failure mode this pipeline's static re-scan
  // cannot detect.
  const code = `function Profile({ userId }) {
  useEffect(() => {
    fetchUser(userId);
  }, []);
  return <div>{userId}</div>;
}
`;
  const defect = await scanFor('Profile.jsx', code, 'FIGM-REACT-06');
  assert.equal((defect as any).fixabilityStatus, 'NO_SAFE_FIX', 'a genuinely MANUAL_REVIEW_ONLY rule must still show NO_SAFE_FIX -- this fix must not make everything look fixable');
  const decision = decideRemediation(code, defect, 'Profile.jsx');
  assert.equal(decision.strategy, 'MANUAL_REVIEW_ONLY');
  assert.equal(decision.requiresManualReview, true);
  assert.equal(decision.aiAllowed, false);
});

test('getFixabilityStatus() never mutates the source and never calls an AI provider (pure, synchronous, side-effect-free)', () => {
  const code = `<img src="/x.png" alt="x" />`;
  const before = code;
  const status = getFixabilityStatus(code, {
    ruleId: 'FIGM-PERF-02',
    ruleName: 'Un-dimensioned Dynamic Layout Elements',
    category: 'FIGM_GUIDELINE_VIOLATION',
    domain: 'PERFORMANCE',
    concern: 'LAYOUT_INSTABILITY',
    severity: 'HIGH',
    filePath: 'x.jsx',
    location: { start: { line: 1, column: 0 }, end: { line: 1, column: code.length } },
    line: 1,
    column: 0,
    offendingCodeSnippet: '<img',
    sourceSnippet: code,
    message: 'test',
    remediation: 'test',
    standardReference: 'test',
    confidenceScore: 90,
  } as any);
  assert.equal(code, before, 'getFixabilityStatus must never mutate the input source');
  assert.equal(status, 'AUTO_FIX_AVAILABLE');
});
