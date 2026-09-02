/**
 * Framework-Independent Guideline Model (FIGM)
 * Unified Remediation Decision — the ONE authoritative typed object answering "how should THIS
 * violation INSTANCE be remediated," for every caller (the pipeline, the UI, tests).
 *
 * AIRemediationRouter.route() already answers the rule-ID-level question ("which layer, if any,
 * has a fixer for FIGM-X in general") — see that file's own doc comment: it is explicitly a
 * static, rule-ID-keyed lookup that never inspects the actual violation instance. Before this
 * module existed, "did the routed deterministic engine's fixer actually work for THIS specific
 * defect/code" was answered separately, inline, inside ai-remediation-pipeline.ts's own
 * if-statements — i.e. the real per-violation decision was distributed across several unrelated
 * branches rather than being one queryable object. decideRemediation() closes that gap: it
 * actually attempts the routed deterministic engine against this exact `code`/`defect`, and folds
 * both the rule-level route and the instance-level outcome into one RemediationDecision, so
 * `decision.strategy` alone always tells a caller which ONE path this specific violation takes —
 * never "AST_DETERMINISTIC in general, but you still have to check whether it actually worked."
 */

import { DiagnosticReport } from '../types/ast-spec.js';
import { AIRemediationRouter, RemediationEngineRoute } from './ai-remediation-router.js';
import { AstDeterministicFixEngine, AstFixOutcome } from '../engine/ast-fix-engine.js';
import { AngularTemplateFixEngine } from '../engine/angular-template-fix-engine.js';
import { VueAstFixEngine } from '../engine/vue-fix-engine.js';
import { LexicalTypoFixEngine } from '../engine/lexical-typo-fix-engine.js';

/** 'LEXICAL_TYPO_FIX' is this module's own addition, never returned by AIRemediationRouter.route()
 *  itself -- see LexicalTypoFixEngine's own header. Distinguished from 'AST_DETERMINISTIC' (which
 *  always means AstDeterministicFixEngine specifically, a FIGM-rule-only engine) purely for honest
 *  observability: logs/UI can tell "a single-token compiler-suggested correction" apart from "a real
 *  FIGM AST transform" even though both set deterministicFixAvailable=true and follow the identical
 *  verified apply/re-scan path (AIRemediationPipeline.remediateDefect's Path 1). */
export type RemediationStrategy = RemediationEngineRoute | 'LEXICAL_TYPO_FIX';

/** Structural shape shared by AstFixOutcome / AngularTemplateFixOutcome / VueFixOutcome — each
 *  engine's own outcome type carries extra fields, but every caller of decideRemediation() only
 *  ever needs these three. */
export interface DeterministicFixOutcome {
  success: boolean;
  patchedCode: string;
  description: string;
}

export interface RemediationDecision {
  ruleId: string;
  /** The ONE strategy this specific violation instance takes — not merely "which engine claims
   *  this rule ID in general" (that is `AIRemediationRouter.route()`'s job). When a deterministic
   *  engine is routed at the rule level but declines for this instance's actual AST shape, the
   *  strategy here is already narrowed to 'AI_ASSISTED', matching what actually happens next. */
  strategy: RemediationStrategy;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Human-readable justification, always populated — surfaced in logs/UI so "why did this
   *  violation take this path" is always answerable without re-deriving it. */
  reason: string;
  /** True once a real AST node for this instance was located by a deterministic engine — even if
   *  that engine ultimately declined to transform it (e.g. developer intent required). */
  astAvailable: boolean;
  /** True only when a deterministic engine produced an ACCEPTED patch for this exact instance. */
  deterministicFixAvailable: boolean;
  aiAllowed: boolean;
  requiresManualReview: boolean;
  /** Present only when `deterministicFixAvailable` is true — the actual patch the deterministic
   *  engine produced, so callers (the pipeline) reuse it instead of invoking the engine twice. */
  deterministicOutcome?: DeterministicFixOutcome;
}

function runDeterministicEngine(
  route: 'AST_DETERMINISTIC' | 'ANGULAR_TEMPLATE_AST' | 'VUE_AST',
  code: string,
  defect: DiagnosticReport,
  filePath?: string
): AstFixOutcome {
  switch (route) {
    case 'AST_DETERMINISTIC':
      return AstDeterministicFixEngine.tryFix(code, defect, filePath);
    case 'ANGULAR_TEMPLATE_AST':
      return AngularTemplateFixEngine.tryFix(code, defect, filePath);
    case 'VUE_AST':
      return VueAstFixEngine.tryFix(code, defect, filePath);
  }
}

/**
 * Computes the ONE RemediationDecision for `defect` as it actually appears in `code`. Never
 * throws — a deterministic engine that can't safely locate/transform the node simply narrows the
 * decision to AI_ASSISTED, exactly like a rule with no deterministic engine at all.
 */
export function decideRemediation(code: string, defect: DiagnosticReport, filePath?: string): RemediationDecision {
  const routing = AIRemediationRouter.route(defect.ruleId);

  if (routing.route === 'MANUAL_REVIEW_ONLY') {
    return {
      ruleId: defect.ruleId,
      strategy: 'MANUAL_REVIEW_ONLY',
      confidence: 'LOW',
      reason: routing.reason,
      astAvailable: false,
      deterministicFixAvailable: false,
      aiAllowed: false,
      requiresManualReview: true,
    };
  }

  if (routing.route === 'AI_ASSISTED') {
    // Every GENERAL_CODE_ERROR diagnostic (never a FIGM rule -- see LexicalTypoFixEngine.isEligible)
    // routes here by definition (no FIGM-specific deterministic engine claims a TYPE-TS-<code> or
    // SYNTAX-PARSE-ERROR ruleId). Before falling all the way through to AI, try the narrow,
    // instance-level lexical-typo fixer -- it only ever succeeds when the REAL TypeScript compiler
    // itself already proposed an unambiguous "Did you mean" correction (see that engine's own
    // header for exactly how "unambiguous" is decided), so this can never apply a guessed fix.
    if (LexicalTypoFixEngine.isEligible(defect)) {
      const lexicalOutcome = LexicalTypoFixEngine.tryFix(code, defect);
      if (lexicalOutcome.success) {
        return {
          ruleId: defect.ruleId,
          strategy: 'LEXICAL_TYPO_FIX',
          confidence: 'HIGH',
          reason: lexicalOutcome.description,
          astAvailable: true,
          deterministicFixAvailable: true,
          aiAllowed: false,
          requiresManualReview: false,
          deterministicOutcome: lexicalOutcome,
        };
      }
      // Declined (no suggestion, or an unresolvable disagreement between diagnostics) -- fall
      // through to AI_ASSISTED below, folding the decline reason in for observability, exactly
      // like a declined FIGM deterministic engine does further down in this function.
      return {
        ruleId: defect.ruleId,
        strategy: 'AI_ASSISTED',
        confidence: 'MEDIUM',
        reason: `${routing.reason} A deterministic lexical-typo fix was attempted but declined: ${lexicalOutcome.description}`,
        astAvailable: false,
        deterministicFixAvailable: false,
        aiAllowed: true,
        requiresManualReview: false,
      };
    }
    return {
      ruleId: defect.ruleId,
      strategy: 'AI_ASSISTED',
      confidence: 'MEDIUM',
      reason: routing.reason,
      astAvailable: false,
      deterministicFixAvailable: false,
      aiAllowed: true,
      requiresManualReview: false,
    };
  }

  // routing.route is one of the three deterministic engine routes — try it against THIS instance.
  const outcome = runDeterministicEngine(routing.route, code, defect, filePath);

  if (outcome.success) {
    return {
      ruleId: defect.ruleId,
      strategy: routing.route,
      confidence: 'HIGH',
      reason: routing.reason,
      astAvailable: true,
      deterministicFixAvailable: true,
      aiAllowed: false,
      requiresManualReview: false,
      deterministicOutcome: outcome,
    };
  }

  // The rule-level route claimed a deterministic engine, but this instance's actual AST shape
  // wasn't safely transformable (e.g. developer intent required, or the node couldn't be located)
  // — narrow the decision to AI_ASSISTED rather than reporting a strategy that won't actually run.
  return {
    ruleId: defect.ruleId,
    strategy: 'AI_ASSISTED',
    confidence: 'MEDIUM',
    reason: `${routing.reason} However this specific violation instance's deterministic fixer declined: ${outcome.description}`,
    astAvailable: true,
    deterministicFixAvailable: false,
    aiAllowed: true,
    requiresManualReview: false,
    deterministicOutcome: outcome,
  };
}
