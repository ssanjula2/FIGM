"use strict";
/**
 * Framework-Independent Guideline Model (FIGM)
 * AI Prompt Builder for Gemini Code Remediation Engine
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIPromptBuilder = void 0;
class AIPromptBuilder {
    /**
     * Constructs a structured prompt for Gemini asking for a compliant code fix
     */
    static buildRemediationPrompt(input) {
        const { defect, code, framework } = input;
        return `
You are an expert Senior Software Architect and Automated Code Remediation Engine for Single-Page Applications (${framework}).

A static analysis rule violation was detected in the following source code:

### VIOLATION DETAILS:
- **Rule ID**: ${defect.ruleId}
- **Rule Name**: ${defect.ruleName}
- **Domain**: ${defect.domain}
- **Severity**: ${defect.severity}
- **Target Line**: ${defect.location?.start?.line || 1}
- **Offending Code Snippet**: \`${defect.offendingCodeSnippet}\`
- **Standard Reference**: ${defect.standardReference || 'ISO 25010 / WCAG 2.1 AA'}
- **Remediation Directive**: ${defect.remediation}

---

### ORIGINAL SOURCE CODE:
\`\`\`${framework === 'REACT_JSX' ? 'tsx' : framework === 'ANGULAR_TEMPLATE' ? 'typescript' : 'javascript'}
${code}
\`\`\`

---

### INSTRUCTIONS:
1. Explain the root cause of the violation and why it impacts performance, accessibility, or security.
2. Provide the COMPLETE corrected source code that resolves the violation while preserving 100% of original functionality.
3. Follow FIGM best practice guidelines.
4. Respond strictly in the following JSON format:

{
  "explanation": "<Clear step-by-step description of the fix>",
  "remediatedCode": "<Full corrected source code without markdown fences>",
  "confidenceScore": <Number between 80 and 100>
}
`;
    }
}
exports.AIPromptBuilder = AIPromptBuilder;
//# sourceMappingURL=prompt-builder.js.map