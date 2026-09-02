/**
 * Framework-Independent Guideline Model (FIGM)
 * AI Remediation Router — Layer 2 entry point
 *
 * The single, explicit source of truth for "which fixing layer handles this rule." Every
 * deterministic Layer 1 engine (TypeScript AST, Angular template AST, Vue AST) gets first refusal
 * on a rule ID; only when NONE of them claim it does a violation route to the AI-assisted layer.
 * This does not change what already happens inside src/ai/ai-remediation-pipeline.ts — it makes
 * the DECISION that was previously three inline `if (Engine.isEligible(...))` checks into one
 * queryable, independently testable function, so "is FIGM-X handled deterministically or by AI"
 * has one authoritative answer instead of being implicit in the pipeline's control flow.
 *
 * Routing is entirely rule-ID-based (never framework-based): a rule ID only ever belongs to one
 * engine's SUPPORTED_RULE_IDS set (React/Next.js + Angular class-body rules in
 * AstDeterministicFixEngine, Angular template rules in AngularTemplateFixEngine, Vue rules in
 * VueAstFixEngine), so the check order below is a precedence list, not a framework dispatch.
 */

import { AstDeterministicFixEngine } from '../engine/ast-fix-engine.js';
import { AngularTemplateFixEngine } from '../engine/angular-template-fix-engine.js';
import { VueAstFixEngine } from '../engine/vue-fix-engine.js';

export type RemediationEngineRoute = 'AST_DETERMINISTIC' | 'ANGULAR_TEMPLATE_AST' | 'VUE_AST' | 'AI_ASSISTED' | 'MANUAL_REVIEW_ONLY';

/**
 * Rules that are genuinely MANUAL_REVIEW_ONLY at the rule level — not merely "no deterministic
 * fixer exists" (that alone means AI_ASSISTED), but cases where even the AI-assisted layer cannot
 * safely attempt a fix given this pipeline's actual capabilities:
 *
 *   - FIGM-NEXT-08 (useSearchParams with no <Suspense> boundary) and FIGM-NEXT-09 (metadata export
 *     in a "use client" file): the correct fix depends on a PARENT file (a layout/page) this
 *     single-file pipeline cannot see or edit — routing to AI here would either produce a patch
 *     for the wrong file or a guess with no way to verify it against the real parent.
 *   - FIGM-REACT-06 (missing effect dependency): React's own guidance is explicit that blindly
 *     adding a dependency can introduce an infinite render loop — a failure mode static
 *     compile/type/re-scan validation does not reliably catch (it is a *runtime* behavior, not a
 *     syntax/type/guideline diagnostic), so an AI patch could pass every sandbox stage and still
 *     be wrong in a way this pipeline cannot detect.
 *
 * Every other rule with no deterministic fixer routes to AI_ASSISTED — including rules the
 * now-legacy RemediationEngine.applyQuickFix's per-instance `requiresManualReview` flag also sets
 * for its OWN (regex-based, pre-AI-integration) reasons. That flag answers "is THIS
 * deterministic template safe for THIS instance," not "should AI, with full sandbox validation,
 * be forbidden from even trying" — conflating the two used to block the AI layer from ever being
 * consulted for the large majority of AI-eligible rules (FIGM-REACT-01/04, FIGM-PERF-05,
 * FIGM-NEXT-02/04/05/07, FIGM-ANG-06/07, FIGM-VUE-02/03/04, and more), discovered live via
 * tests/claude-integration.test.ts actually attempting one of them and finding it was never
 * called at all.
 */
const MANUAL_REVIEW_ONLY_RULE_IDS: ReadonlySet<string> = new Set(['FIGM-NEXT-08', 'FIGM-NEXT-09', 'FIGM-REACT-06']);

export interface RoutingDecision {
  ruleId: string;
  route: RemediationEngineRoute;
  /** Human-readable reason for this routing decision — surfaced in logs/UI so "why did this go to
   *  AI instead of a deterministic fixer" is always answerable. */
  reason: string;
}

export class AIRemediationRouter {
  /**
   * Decides which layer owns a given FIGM rule ID. Never inspects the source code or the specific
   * violation instance — routing is a static, rule-ID-keyed lookup; whether a SPECIFIC violation
   * instance can actually be auto-fixed (e.g. a locatable node, or a genuinely safe AI patch) is
   * decided later: inside the chosen deterministic engine's own `tryFix` (which may still decline
   * and fall through to AI even when routed here as deterministic — see
   * ai-remediation-pipeline.ts's fall-through comments), or inside the sandbox validation pipeline
   * for an AI-authored patch.
   */
  public static route(ruleId: string): RoutingDecision {
    if (AstDeterministicFixEngine.isEligible(ruleId)) {
      return { ruleId, route: 'AST_DETERMINISTIC', reason: `${ruleId} has a real TypeScript-Compiler-API deterministic fixer (src/engine/ast-fix-engine.ts).` };
    }
    if (AngularTemplateFixEngine.isEligible(ruleId)) {
      return { ruleId, route: 'ANGULAR_TEMPLATE_AST', reason: `${ruleId} has a real Angular-template-AST deterministic fixer (src/engine/angular-template-fix-engine.ts).` };
    }
    if (VueAstFixEngine.isEligible(ruleId)) {
      return { ruleId, route: 'VUE_AST', reason: `${ruleId} has a real Vue-AST deterministic fixer (src/engine/vue-fix-engine.ts).` };
    }
    if (MANUAL_REVIEW_ONLY_RULE_IDS.has(ruleId)) {
      return { ruleId, route: 'MANUAL_REVIEW_ONLY', reason: `${ruleId} requires cross-file context or carries a runtime-only failure mode this pipeline cannot safely validate even with AI assistance — see MANUAL_REVIEW_ONLY_RULE_IDS.` };
    }
    return { ruleId, route: 'AI_ASSISTED', reason: `${ruleId} has no deterministic AST fixer — requires developer intention or architectural reasoning, routed to the AI-assisted layer.` };
  }

  /** Convenience predicate: true when `route()` would send this rule ID to a deterministic Layer 1
   *  engine (any of the three), false when it falls through to AI or manual review. */
  public static hasDeterministicFixer(ruleId: string): boolean {
    const route = AIRemediationRouter.route(ruleId).route;
    return route !== 'AI_ASSISTED' && route !== 'MANUAL_REVIEW_ONLY';
  }
}
