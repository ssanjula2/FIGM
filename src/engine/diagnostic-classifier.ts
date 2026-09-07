/**
 * Framework-Independent Guideline Model (FIGM)
 * Diagnostic Kind Classifier -- authoritative separation of the two independent diagnostic
 * domains the Live Scan surfaces:
 *
 *  - FIGM_RULE: a violation of one of the 50 canonical FIGM research rules (RuleExecutionEngine
 *    dispatches these via ASTDetectionEngine / react-ast-rules.ts).
 *  - GENERAL_CODE_ERROR: a genuine source-code/compiler/parser diagnostic that is NOT one of the
 *    50 FIGM rules (currently: SourceParser's SYNTAX-PARSE-ERROR, and TypeCheckerService's
 *    TYPE-TS-<code> entries).
 *
 * Classification is membership-based against the live rule registry (FOUR_LAYER_MAPPINGS), not a
 * `ruleId.startsWith('FIGM-')` string check -- so a future non-FIGM diagnostic that happened to be
 * named with a "FIGM-"-shaped id could never be misclassified, and the FIGM count is guaranteed to
 * mean exactly "one of the 50 canonical rule IDs," never an approximation of it.
 */

import { DiagnosticReport } from '../types/ast-spec.js';
import { FOUR_LAYER_MAPPINGS } from '../matrix/four-layer-meta-model.js';
import { decideRemediation } from '../ai/remediation-decision.js';

export type DiagnosticKind = 'FIGM_RULE' | 'GENERAL_CODE_ERROR';

export type FixabilityStatus = 'AUTO_FIX_AVAILABLE' | 'SUGGESTED_FIX_ONLY' | 'NO_SAFE_FIX';

const CANONICAL_FIGM_RULE_IDS: ReadonlySet<string> = new Set(
  FOUR_LAYER_MAPPINGS.map((m) => m.rule.ruleId)
);

/** The single source of truth for "is this ruleId one of the 50 canonical FIGM research rules." */
export function isCanonicalFigmRuleId(ruleId: string): boolean {
  return CANONICAL_FIGM_RULE_IDS.has(ruleId);
}

export function classifyDiagnosticKind(ruleId: string): DiagnosticKind {
  return isCanonicalFigmRuleId(ruleId) ? 'FIGM_RULE' : 'GENERAL_CODE_ERROR';
}

/**
 * Derives a pre-attempt fixability classification WITHOUT calling an AI provider or mutating any
 * state -- delegates to decideRemediation(), the SAME rule-ID-routed, per-instance decision
 * AIRemediationPipeline.remediateDefect itself uses to decide what the "Fix" button will actually
 * attempt, so this can never drift from real behavior. Applies uniformly to BOTH diagnostic domains
 * (FIGM_RULE and GENERAL_CODE_ERROR) -- AIRemediationRouter.route() already routes any non-FIGM
 * ruleId (TYPE-TS-<code>, SYNTAX-PARSE-ERROR) to AI_ASSISTED by definition, and decideRemediation()
 * already tries LexicalTypoFixEngine first for exactly that domain -- so no separate handling is
 * needed here.
 *
 * Previously this ran an INDEPENDENT dry-run against the legacy, pre-AI RemediationEngine
 * .applyQuickFix -- a second decision path that could (and did) disagree with the real pipeline.
 * Root-caused live for FIGM-PERF-02: the real per-instance decision is decideRemediation() ->
 * AI_ASSISTED (its deterministic fixer deliberately DECLINES rather than hallucinate <img>
 * dimensions -- see ast-fix-engine.ts's fixPerf02), but the legacy engine's own FIGM-PERF-02
 * regex-replace silently produced a no-op for a truncated single-token offendingCodeSnippet (e.g.
 * "<img" with no trailing whitespace, captured from a multi-line JSX element) -- so
 * `remediatedCode === code` and this function permanently reported NO_SAFE_FIX, disabling the Live
 * Scan "Fix" button even though AI-assisted remediation (with full sandbox validation + re-scan
 * before ever being marked verified) was genuinely available. A declined deterministic fixer must
 * route to whatever decideRemediation() says next (AI_ASSISTED, or for the small MANUAL_REVIEW_ONLY
 * set, genuinely nothing) -- never be conflated with "no fix exists at all."
 *
 *  - NO_SAFE_FIX: decideRemediation() found no automated path at all for this instance (rule-level
 *    MANUAL_REVIEW_ONLY -- see AIRemediationRouter's own doc comment for the specific rules and
 *    why this small set cannot be safely attempted even with AI assistance). The source is never
 *    touched for this status.
 *  - AUTO_FIX_AVAILABLE: decideRemediation() found either a real, already-produced deterministic
 *    patch for this instance, or an AI-assisted attempt is allowed -- both are attempted, verified
 *    via the same full sandbox + re-scan pipeline, and applied only once VERIFIED, by the same
 *    "Fix" button this status enables.
 *  - SUGGESTED_FIX_ONLY: retained in the type for UI/API compatibility, but decideRemediation() has
 *    no state that maps to it -- every non-MANUAL_REVIEW_ONLY instance either has a verified
 *    deterministic patch or a real AI-assisted attempt path, never an ambiguous preview-only
 *    candidate that can structurally never be applied. */
export function getFixabilityStatus(code: string, defect: DiagnosticReport): FixabilityStatus {
  const decision = decideRemediation(code, defect, defect.filePath);
  return decision.requiresManualReview ? 'NO_SAFE_FIX' : 'AUTO_FIX_AVAILABLE';
}

/**
 * Human-facing compiler/parser diagnostic code for a GENERAL_CODE_ERROR defect (e.g. "TS2322" for
 * ruleId "TYPE-TS-2322", or "SYNTAX" for a SYNTAX-PARSE-ERROR) -- never meaningful for a FIGM rule,
 * whose ruleId (e.g. "FIGM-REACT-02") is already the right thing to display as-is.
 */
export function compilerDiagnosticCode(ruleId: string): string {
  if (ruleId.startsWith('TYPE-TS-')) return `TS${ruleId.slice('TYPE-TS-'.length)}`;
  if (ruleId === 'SYNTAX-PARSE-ERROR' || ruleId === 'SYNTAX_ERROR') return 'SYNTAX';
  return ruleId;
}
