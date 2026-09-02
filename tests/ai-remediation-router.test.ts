import test from 'node:test';
import assert from 'node:assert/strict';
import { AIRemediationRouter } from '../src/ai/ai-remediation-router.js';
import { AstDeterministicFixEngine } from '../src/engine/ast-fix-engine.js';
import { AngularTemplateFixEngine } from '../src/engine/angular-template-fix-engine.js';
import { VueAstFixEngine } from '../src/engine/vue-fix-engine.js';

test('AI Remediation Router — Layer 2 entry point', async (t) => {
  await t.test('routes every AstDeterministicFixEngine rule ID to AST_DETERMINISTIC', () => {
    for (const ruleId of AstDeterministicFixEngine.SUPPORTED_RULE_IDS) {
      const decision = AIRemediationRouter.route(ruleId);
      assert.equal(decision.route, 'AST_DETERMINISTIC', `${ruleId} should route to AST_DETERMINISTIC`);
      assert.equal(decision.ruleId, ruleId);
      assert.ok(decision.reason.length > 0);
    }
  });

  await t.test('routes every AngularTemplateFixEngine rule ID to ANGULAR_TEMPLATE_AST', () => {
    for (const ruleId of AngularTemplateFixEngine.SUPPORTED_RULE_IDS) {
      const decision = AIRemediationRouter.route(ruleId);
      assert.equal(decision.route, 'ANGULAR_TEMPLATE_AST', `${ruleId} should route to ANGULAR_TEMPLATE_AST`);
    }
  });

  await t.test('routes every VueAstFixEngine rule ID to VUE_AST', () => {
    for (const ruleId of VueAstFixEngine.SUPPORTED_RULE_IDS) {
      const decision = AIRemediationRouter.route(ruleId);
      assert.equal(decision.route, 'VUE_AST', `${ruleId} should route to VUE_AST`);
    }
  });

  await t.test('routes a rule ID with no deterministic fixer to AI_ASSISTED', () => {
    // FIGM-REACT-01 (expensive derived computation without useMemo) is deliberately NOT in any
    // Layer-1 engine's SUPPORTED_RULE_IDS — the correct dependency array cannot be safely
    // inferred, so it must fall through to AI.
    assert.equal(AstDeterministicFixEngine.isEligible('FIGM-REACT-01'), false);
    assert.equal(AngularTemplateFixEngine.isEligible('FIGM-REACT-01'), false);
    assert.equal(VueAstFixEngine.isEligible('FIGM-REACT-01'), false);

    const decision = AIRemediationRouter.route('FIGM-REACT-01');
    assert.equal(decision.route, 'AI_ASSISTED');
    assert.ok(decision.reason.toLowerCase().includes('ai-assisted'));
  });

  await t.test('routes the 3 genuinely rule-level manual-review-only rules to MANUAL_REVIEW_ONLY, not AI_ASSISTED', () => {
    // FIGM-NEXT-08/09 need a parent file this single-file pipeline can't see; FIGM-REACT-06's
    // failure mode (an infinite render loop) is runtime-only and static validation can't catch it.
    for (const ruleId of ['FIGM-NEXT-08', 'FIGM-NEXT-09', 'FIGM-REACT-06']) {
      const decision = AIRemediationRouter.route(ruleId);
      assert.equal(decision.route, 'MANUAL_REVIEW_ONLY', `${ruleId} should route to MANUAL_REVIEW_ONLY`);
    }
  });

  await t.test('a rule with no deterministic fixer that is NOT rule-level manual-only still routes to AI_ASSISTED (regression: this used to be silently blocked)', () => {
    // Found live via tests/claude-integration.test.ts: FIGM-REACT-01 has no deterministic fixer,
    // is not one of the 3 manual-only rules, and must therefore actually reach Claude — the
    // pipeline's hard guard used to (incorrectly) also block this rule via the legacy
    // RemediationEngine's per-instance requiresManualReview flag.
    // Note: FIGM-VUE-02/03/04 and FIGM-ANG-04/10 are NOT in this list — they route to VUE_AST /
    // ANGULAR_TEMPLATE_AST at the router level (their engine has a real locator for them), even
    // though that engine's tryFix always declines for these specific rules; only AFTER that
    // decline does the pipeline itself fall through to AI, which is the pipeline's job to test,
    // not the router's.
    for (const ruleId of ['FIGM-REACT-01', 'FIGM-REACT-04', 'FIGM-PERF-05', 'FIGM-NEXT-02', 'FIGM-NEXT-04', 'FIGM-NEXT-05', 'FIGM-NEXT-07']) {
      const decision = AIRemediationRouter.route(ruleId);
      assert.equal(decision.route, 'AI_ASSISTED', `${ruleId} should route to AI_ASSISTED, not be blocked as manual-only`);
    }
  });

  await t.test('hasDeterministicFixer matches route() for a deterministic, an AI-only, and a manual-only rule', () => {
    assert.equal(AIRemediationRouter.hasDeterministicFixer('FIGM-A11Y-01'), true);
    assert.equal(AIRemediationRouter.hasDeterministicFixer('FIGM-REACT-01'), false);
    assert.equal(AIRemediationRouter.hasDeterministicFixer('FIGM-REACT-06'), false);
  });

  await t.test('the three deterministic rule-ID sets are mutually disjoint (a rule ID never belongs to more than one engine)', () => {
    const sets = [
      [...AstDeterministicFixEngine.SUPPORTED_RULE_IDS],
      [...AngularTemplateFixEngine.SUPPORTED_RULE_IDS],
      [...VueAstFixEngine.SUPPORTED_RULE_IDS],
    ];
    const seen = new Set<string>();
    for (const set of sets) {
      for (const ruleId of set) {
        assert.ok(!seen.has(ruleId), `${ruleId} appears in more than one Layer-1 engine's SUPPORTED_RULE_IDS`);
        seen.add(ruleId);
      }
    }
  });
});
