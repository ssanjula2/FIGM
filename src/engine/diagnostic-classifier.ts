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
import { RemediationEngine } from './remediation-engine.js';
import { LexicalTypoFixEngine } from './lexical-typo-fix-engine.js';

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
 * Derives a pre-attempt fixability classification WITHOUT calling Claude or mutating any state --
 * a single pure, synchronous dry-run of the deterministic engine (RemediationEngine.applyQuickFix
 * itself performs no I/O and has no side effects), so this can never drift from what the real "Fix"
 * button will actually attempt. Applies uniformly to BOTH diagnostic domains (FIGM_RULE and
 * GENERAL_CODE_ERROR) -- ambiguity about the right fix is not unique to compiler errors.
 *
 *  - NO_SAFE_FIX: the deterministic engine produced no candidate patch at all
 *    (remediatedCode === code) -- there is nothing to show but an explanation of why automatic
 *    correction cannot be guaranteed. The source is never touched for this status.
 *  - SUGGESTED_FIX_ONLY: the engine DID produce a candidate transform, but flagged it as unsafe to
 *    auto-apply (multiple valid interpretations exist -- e.g. a useMemo dependency array it cannot
 *    reliably infer, or a per-item closure it cannot reliably curry). The candidate is shown for
 *    review; AIRemediationPipeline.remediateDefect enforces server-side that this status can never
 *    be reported as `verified: true` (see its own guard), so the source can never be modified
 *    automatically for this status even if an AI-generated patch happens to validate.
 *  - AUTO_FIX_AVAILABLE: the deterministic engine produced a real, unambiguous structural transform
 *    -- the same patch the "Fix" button will attempt to apply/verify/rollback.
 *
 * GENERAL_CODE_ERROR defects are checked against LexicalTypoFixEngine FIRST, before the legacy
 * RemediationEngine.applyQuickFix dry-run below -- mirroring remediation-decision.ts's own real
 * online precedence (LexicalTypoFixEngine is tried before AI for exactly this diagnostic domain).
 * Root-caused live: RemediationEngine.applyQuickFix's TYPE-TS-<code> branch only special-cases a
 * handful of codes (2345/2322/2339/2551/2531/7006) and silently leaves `remediatedCode` unchanged
 * for anything else -- including TS1435/TS1434/TS2552 "Did you mean 'X'?" keyword-typo diagnostics,
 * which LexicalTypoFixEngine (added later, wired into the real remediation path) already fixes
 * deterministically. Without this check, a genuinely auto-fixable typo (e.g. `cont` for `const`)
 * was permanently misreported NO_SAFE_FIX and its "Fix" button disabled, even though the real
 * pipeline would have fixed it instantly if given the chance -- a real drift between this pre-
 * attempt prediction and what the "Fix" button actually does, which this function's own doc
 * comment above promises can never happen. */
export function getFixabilityStatus(code: string, defect: DiagnosticReport): FixabilityStatus {
  if (LexicalTypoFixEngine.isEligible(defect) && LexicalTypoFixEngine.tryFix(code, defect).success) {
    return 'AUTO_FIX_AVAILABLE';
  }
  const dryRun = RemediationEngine.applyQuickFix(code, defect);
  if (dryRun.remediatedCode === code) return 'NO_SAFE_FIX';
  if (dryRun.requiresManualReview) return 'SUGGESTED_FIX_ONLY';
  return 'AUTO_FIX_AVAILABLE';
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
