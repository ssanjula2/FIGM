/**
 * Framework-Independent Guideline Model (FIGM)
 * Pipeline A -- FIGM Rule Fixer
 *
 * Scope: ONLY the 50 canonical FIGM research rules. A genuinely separate entry point from
 * CodeErrorFixPipeline (Pipeline B) -- see src/engine/diagnostic-classifier.ts for the
 * authoritative FIGM_RULE / GENERAL_CODE_ERROR classification both pipelines are built on. Both
 * ultimately verify a candidate patch through the same real detect -> apply -> re-scan -> verify
 * machinery (AIRemediationPipeline / RemediationEngine), which already cross-validates that a fix
 * does not introduce a NEW syntax error, a NEW type error, or a NEW guideline violation -- but each
 * pipeline is its own class with its own scope guard, so a general compiler error can never be
 * routed through the FIGM fixer (or vice versa) even by a caller mistake.
 */

import { DiagnosticReport } from '../types/ast-spec.js';
import { AIRemediationPipeline, AIRemediationPipelineResult } from './ai-remediation-pipeline.js';
import { isCanonicalFigmRuleId } from '../engine/diagnostic-classifier.js';

export class FigmFixPipeline {
  /**
   * Detect -> Apply FIGM Fix -> Update Source -> Re-run FIGM Analysis -> Re-run Compiler Analysis
   * -> Verify -> Result. Refuses outright (no fallback, no silent reclassification) if handed
   * anything other than one of the 50 canonical FIGM rule IDs -- this is the scope guard that
   * makes "NEVER place a general compiler error inside this system" a real, enforced invariant
   * rather than only a UI convention.
   */
  public static async apply(
    code: string,
    defect: DiagnosticReport,
    framework: string
  ): Promise<AIRemediationPipelineResult> {
    if (!isCanonicalFigmRuleId(defect.ruleId)) {
      throw new Error(
        `FigmFixPipeline received a non-FIGM defect (ruleId "${defect.ruleId}"). ` +
        'General code errors must go through CodeErrorFixPipeline instead.'
      );
    }
    return AIRemediationPipeline.remediateDefect(code, defect, framework);
  }
}
