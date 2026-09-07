/**
 * Framework-Independent Guideline Model (FIGM)
 * Patch Validator Module for AI Code Remediation
 */

import { SourceParser } from '../parser/source-parser.js';
import { assertSingleVueSfcStructure } from '../parser/vue-sfc-parser.js';

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

export class AIPatchValidator {
  /**
   * Performs multi-stage validation on generated AI remediated code
   */
  public static validatePatch(originalCode: string, remediatedCode: string, filePath: string = 'component.tsx'): ValidationResult {
    // 1. Non-empty check
    if (!remediatedCode || remediatedCode.trim().length === 0) {
      return { isValid: false, reason: 'Remediated code is empty.' };
    }

    // 2. Markdown fence check
    if (remediatedCode.includes('```')) {
      return { isValid: false, reason: 'Remediated code contains raw markdown fences.' };
    }

    // 3. Difference check (Must differ from original code)
    if (originalCode.trim() === remediatedCode.trim()) {
      return { isValid: false, reason: 'Remediated code is identical to original source code.' };
    }

    // 4. Vue SFC structural check -- a real production incident: a Gemini-generated Vue patch
    // containing TWO complete <template>/<script setup> blocks (the model appended a full
    // "corrected" SFC after the original instead of editing it in place) reached this pre-filter
    // undetected. Step 5 below only ever checked `!parseResult.ast`, and SourceParser.parseSource
    // degrades gracefully for a structurally-invalid Vue file (always returns a truthy stub `ast`,
    // recording the real problem in `parseErrors` instead of throwing) -- so this stage silently
    // passed a candidate that was never valid, relying entirely on the heavier sandbox's own
    // FRAMEWORK_STRUCTURAL stage (src/ai/sandbox-validation-pipeline.ts) to catch it later, which it
    // did (this is exactly the safety net that already prevented the bad patch from ever being
    // applied). This closes the gap at the cheap pre-filter stage too, using the same real
    // @vue/compiler-sfc-backed parser directly (parseVueSfc) rather than SourceParser's `parseErrors`
    // bucket, which also mixes in generic React/JS syntax heuristics -- scoping this to `.vue` files
    // only means it can never affect React/Next.js/Angular patch validation.
    if (filePath.endsWith('.vue')) {
      const structural = assertSingleVueSfcStructure(remediatedCode, filePath);
      if (!structural.valid) {
        return { isValid: false, reason: `Remediated Vue SFC is structurally invalid: ${structural.reason}` };
      }
    }

    // 5. Basic Syntax & AST Parsing Validation
    try {
      const parseResult = SourceParser.parseSource(remediatedCode, filePath);
      if (!parseResult.ast) {
        return { isValid: false, reason: 'Remediated code failed basic AST syntax parsing.' };
      }
    } catch (err) {
      return { isValid: false, reason: `AST Parsing error: ${err instanceof Error ? err.message : 'Unknown'}` };
    }

    return { isValid: true };
  }
}
