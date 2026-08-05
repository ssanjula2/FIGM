"use strict";
/**
 * Framework-Independent Guideline Model (FIGM)
 * Unified AI Code Remediation Orchestrator with Deterministic Fallback
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIRemediationPipeline = void 0;
const remediation_engine_js_1 = require("../engine/remediation-engine.js");
const prompt_builder_js_1 = require("./prompt-builder.js");
const gemini_service_js_1 = require("./gemini-service.js");
const response_parser_js_1 = require("./response-parser.js");
const patch_validator_js_1 = require("./patch-validator.js");
const patch_generator_js_1 = require("../engine/patch-generator.js");
class AIRemediationPipeline {
    /**
     * Generates code fix using Gemini 2.5 Flash, automatically falling back to RemediationEngine on failure
     */
    static async remediateDefect(code, defect, framework = 'GENERIC') {
        const startLine = defect.location?.start?.line || 1;
        // Check if GEMINI_API_KEY is available
        if (!process.env.GEMINI_API_KEY) {
            return this.executeFallback(code, defect, 'GEMINI_API_KEY environment variable is not configured.');
        }
        try {
            // 1. Build Prompt
            const prompt = prompt_builder_js_1.AIPromptBuilder.buildRemediationPrompt({ defect, code, framework });
            // 2. Call Gemini Service
            const geminiRes = await gemini_service_js_1.GeminiService.generateContent(prompt);
            // 3. Parse Response
            const parsed = response_parser_js_1.AIResponseParser.parseResponse(geminiRes.rawText);
            // 4. Validate Patch
            const validation = patch_validator_js_1.AIPatchValidator.validatePatch(code, parsed.remediatedCode, defect.filePath);
            if (!validation.isValid) {
                return this.executeFallback(code, defect, `Gemini patch validation failed: ${validation.reason}`);
            }
            // 5. Synthesize Unified Git Diff
            const suggestedFix = patch_generator_js_1.PatchGenerator.generateGitDiff(defect.filePath || 'component.tsx', code, parsed.remediatedCode, startLine, `[Gemini 2.5 Flash AI Fix]: ${parsed.explanation}`);
            return {
                ruleId: defect.ruleId,
                originalCode: code,
                remediatedCode: parsed.remediatedCode,
                appliedFixDescription: parsed.explanation,
                suggestedFix,
                engineType: 'GEMINI_2_5_FLASH',
                confidenceScore: parsed.confidenceScore
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.warn(`[FIGM AI PIPELINE] Gemini API failed (${errorMsg}). Falling back to deterministic remediation engine.`);
            return this.executeFallback(code, defect, errorMsg);
        }
    }
    /**
     * Executes deterministic fallback to RemediationEngine
     */
    static executeFallback(code, defect, reason) {
        const fallbackRes = remediation_engine_js_1.RemediationEngine.applyQuickFix(code, defect);
        return {
            ...fallbackRes,
            engineType: 'TEMPLATE_FALLBACK',
            confidenceScore: 90.0,
            fallbackReason: reason
        };
    }
}
exports.AIRemediationPipeline = AIRemediationPipeline;
//# sourceMappingURL=ai-remediation-pipeline.js.map