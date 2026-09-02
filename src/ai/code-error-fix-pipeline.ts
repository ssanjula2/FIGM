/**
 * Framework-Independent Guideline Model (FIGM)
 * Pipeline B -- General Code Error Fixer
 *
 * Scope: every genuine source-code/compiler/parser diagnostic that is NOT one of the 25 FIGM
 * research rules (currently: SYNTAX-PARSE-ERROR, TYPE-TS-<code>). A genuinely separate entry point
 * from FigmFixPipeline (Pipeline A) -- see that file's header for why both delegate to the same
 * underlying verified apply/re-scan machinery while remaining distinct classes with their own scope
 * guard. This pipeline must never force a FIGM rule ID onto a general error, and never reports a
 * FIGM-style "verified fixed" without the same real re-scan verification FIGM fixes go through.
 */

import { DiagnosticReport } from '../types/ast-spec.js';
import { AIRemediationPipeline, AIRemediationPipelineResult } from './ai-remediation-pipeline.js';
import { isCanonicalFigmRuleId } from '../engine/diagnostic-classifier.js';
import { buildRepresentativeDiagnostic } from '../engine/general-error-grouping.js';

export class CodeErrorFixPipeline {
  /**
   * Compiler/Parser Diagnostic -> Apply Safe Fix / Suggested Fix -> Re-scan -> Compiler
   * Verification -> FIGM Verification -> Result. Refuses outright if handed one of the 25 canonical
   * FIGM rule IDs -- the mirror-image scope guard of FigmFixPipeline.apply, so a FIGM violation can
   * never be silently routed through the general-error fixer either.
   *
   * `allDiagnostics` (optional): the FULL diagnostic list from the same real scan `defect` came
   * from (e.g. app/api/scan/route.ts's own `scanResult.diagnostics`, computed moments earlier in
   * the same request against this exact `code`) -- when supplied, `defect` is enriched via
   * general-error-grouping.ts's buildRepresentativeDiagnostic with any OTHER diagnostics on the same
   * source line, so a single underlying defect (e.g. one keyword typo producing three separate
   * TypeScript diagnostics) is remediated as ONE target instead of three independent attempts, and
   * the eventual re-scan verification (see remediation-validation.server.ts) requires every one of
   * them to be gone, not just `defect`'s own ruleId. Omitting it (or passing an array that doesn't
   * actually contain `defect`) is always safe -- `defect` is used completely unmodified in that
   * case, identical to this method's pre-grouping behavior.
   */
  public static async apply(
    code: string,
    defect: DiagnosticReport,
    framework: string,
    allDiagnostics?: DiagnosticReport[]
  ): Promise<AIRemediationPipelineResult> {
    if (isCanonicalFigmRuleId(defect.ruleId)) {
      throw new Error(
        `CodeErrorFixPipeline received a FIGM rule defect (ruleId "${defect.ruleId}"). ` +
        'FIGM rule violations must go through FigmFixPipeline instead.'
      );
    }
    const representative = allDiagnostics ? buildRepresentativeDiagnostic(defect, allDiagnostics) : defect;
    return AIRemediationPipeline.remediateDefect(code, representative, framework);
  }
}
