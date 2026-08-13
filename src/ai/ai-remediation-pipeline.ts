/**
 * Framework-Independent Guideline Model (FIGM)
 * Unified AI Code Remediation Orchestrator with Deterministic Fallback
 */

import { DiagnosticReport } from '../types/ast-spec.js';
import { RemediationEngine, RemediationResult } from '../engine/remediation-engine.js';
import { AIPromptBuilder } from './prompt-builder.js';
import { GeminiService } from './gemini-service.js';
import { AIResponseParser } from './response-parser.js';
import { AIPatchValidator } from './patch-validator.js';
import { PatchGenerator } from '../engine/patch-generator.js';

export interface AIRemediationPipelineResult extends RemediationResult {
  engineType: 'GEMINI_2_5_FLASH' | 'TEMPLATE_FALLBACK';
  confidenceScore: number;
  fallbackReason?: string;
  /** True only if the patched code was re-scanned and the original violation (defect.ruleId) is confirmed gone. */
  verified: boolean;
  verificationStatus: 'FIXED' | 'PATCH_REJECTED' | 'UNRESOLVED';
}

export class AIRemediationPipeline {
  /**
   * Generates code fix using Gemini 2.5 Flash, automatically falling back to RemediationEngine on failure
   */
  public static async remediateDefect(
    code: string,
    defect: DiagnosticReport,
    framework: string = 'GENERIC'
  ): Promise<AIRemediationPipelineResult> {
    const startLine = defect.location?.start?.line || 1;

    // Check if GEMINI_API_KEY is available
    if (!process.env.GEMINI_API_KEY) {
      return this.executeFallback(code, defect, 'GEMINI_API_KEY environment variable is not configured.');
    }

    try {
      // 1. Build Prompt
      const prompt = AIPromptBuilder.buildRemediationPrompt({ defect, code, framework });

      // 2. Call Gemini Service
      const geminiRes = await GeminiService.generateContent(prompt);

      // 3. Parse Response
      const parsed = AIResponseParser.parseResponse(geminiRes.rawText);

      // 4. Validate Patch (syntax/shape)
      const validation = AIPatchValidator.validatePatch(code, parsed.remediatedCode, defect.filePath);
      if (!validation.isValid) {
        return this.executeFallback(code, defect, `Gemini patch validation failed: ${validation.reason}`);
      }

      // 5. Re-scan the patched code and confirm the ORIGINAL violation is actually resolved.
      // A patch that parses fine but leaves the same ruleId present (or introduces a syntax error)
      // must not be reported as a successful fix.
      const verification = RemediationEngine.validatePatch(code, parsed.remediatedCode, defect);
      if (!verification.isValid) {
        return this.executeFallback(code, defect, `Gemini patch did not resolve ${defect.ruleId} on re-scan (${verification.status}).`);
      }

      // 6. Synthesize Unified Git Diff
      const suggestedFix = PatchGenerator.generateGitDiff(
        defect.filePath || 'component.tsx',
        code,
        parsed.remediatedCode,
        startLine,
        `[Gemini 2.5 Flash AI Fix]: ${parsed.explanation}`
      );

      return {
        ruleId: defect.ruleId,
        originalCode: code,
        remediatedCode: parsed.remediatedCode,
        appliedFixDescription: parsed.explanation,
        suggestedFix,
        engineType: 'GEMINI_2_5_FLASH',
        confidenceScore: parsed.confidenceScore,
        verified: true,
        verificationStatus: verification.status,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[FIGM AI PIPELINE] Gemini API failed (${errorMsg}). Falling back to deterministic remediation engine.`);
      return this.executeFallback(code, defect, errorMsg);
    }
  }

  /**
   * Executes deterministic fallback to RemediationEngine
   */
  private static executeFallback(
    code: string,
    defect: DiagnosticReport,
    reason: string
  ): AIRemediationPipelineResult {
    const fallbackRes = RemediationEngine.applyQuickFix(code, defect);
    const verification = RemediationEngine.validatePatch(code, fallbackRes.remediatedCode, defect);

    return {
      ...fallbackRes,
      engineType: 'TEMPLATE_FALLBACK',
      confidenceScore: verification.isValid ? 90.0 : 40.0,
      fallbackReason: reason,
      verified: verification.isValid,
      verificationStatus: verification.status,
    };
  }
}
