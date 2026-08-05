"use strict";
/**
 * Framework-Independent Guideline Model (FIGM)
 * Patch Validator Module for AI Code Remediation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIPatchValidator = void 0;
const source_parser_js_1 = require("../parser/source-parser.js");
class AIPatchValidator {
    /**
     * Performs multi-stage validation on generated AI remediated code
     */
    static validatePatch(originalCode, remediatedCode, filePath = 'component.tsx') {
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
        // 4. Basic Syntax & AST Parsing Validation
        try {
            const parseResult = source_parser_js_1.SourceParser.parseSource(remediatedCode, filePath);
            if (!parseResult.ast) {
                return { isValid: false, reason: 'Remediated code failed basic AST syntax parsing.' };
            }
        }
        catch (err) {
            return { isValid: false, reason: `AST Parsing error: ${err instanceof Error ? err.message : 'Unknown'}` };
        }
        return { isValid: true };
    }
}
exports.AIPatchValidator = AIPatchValidator;
//# sourceMappingURL=patch-validator.js.map