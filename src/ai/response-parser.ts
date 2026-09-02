/**
 * Framework-Independent Guideline Model (FIGM)
 * Response Parser Module for AI Remediation Outputs
 *
 * Provider-agnostic: validates the {status, patch, explanation, confidence} / {status, reason}
 * shape itself, not anything specific to a particular LLM provider's SDK or transport. Called
 * directly by every AI remediation provider (src/ai/providers/{claude,gemini,ollama}-provider.ts,
 * plus the pre-existing src/ai/claude-client.server.ts the claude-provider.ts wraps) via
 * src/ai/ai-provider-selector.ts's AIRemediationProvider abstraction — never specific to one vendor.
 */

export interface ParsedAIRemediation {
  remediatedCode: string;
  explanation: string;
  confidenceScore: number;
}

/**
 * The structured {status: PATCH|DECLINE} output contract shared by every AI remediation caller
 * (see src/ai/claude-client.server.ts's SUBMIT_REMEDIATION_TOOL). A model saying "fixed",
 * "should compile", or reporting high confidence means nothing on its own — every PATCH here
 * still has to pass the full sandbox validation pipeline before anything is accepted.
 */
export type StructuredRemediationResult =
  | { status: 'PATCH'; patch: string; explanation: string; confidence: number }
  | { status: 'DECLINE'; reason: string }
  | { status: 'AI_UNAVAILABLE'; reason: string };

export class AIResponseParser {
  /**
   * Parses the AI provider's structured {status: "PATCH"|"DECLINE", ...} JSON response (the
   * claude-client.server.ts contract). Never throws — any malformed/incomplete response is mapped
   * to `AI_UNAVAILABLE` rather than propagating a parse exception, matching this pipeline's
   * "never crash on AI output" contract.
   */
  public static parseStructuredRemediation(rawText: string): StructuredRemediationResult {
    if (!rawText || typeof rawText !== 'string') {
      return { status: 'AI_UNAVAILABLE', reason: 'AI remediation call returned no response text.' };
    }

    let jsonObj: unknown;
    try {
      jsonObj = JSON.parse(AIResponseParser.stripMarkdownFences(rawText.trim()));
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      let recovered: unknown;
      let recoveredOk = false;
      if (match) {
        try {
          recovered = JSON.parse(match[0]);
          recoveredOk = true;
        } catch {
          recoveredOk = false;
        }
      }
      if (!recoveredOk) {
        // Reproduced live against Qwen2.5-Coder-7B-Instruct: it emits the surrounding JSON shape
        // correctly but sometimes serializes the multiline "patch" value using JS template-literal
        // backticks (the syntax it is most used to emitting for embedded multiline code) instead of
        // a properly escaped JSON string — e.g. `"patch": \`...\`,` — which is not valid JSON and
        // breaks both JSON.parse and the brace-matching fallback above. This is a real, consistently
        // reproduced model failure mode (not hypothetical), so it gets a dedicated, targeted
        // recovery rather than being silently dropped as AI_UNAVAILABLE. The recovered patch string
        // is treated exactly like any other successfully-parsed patch — same return shape, and still
        // subject to the full sandbox validation pipeline downstream. See
        // tryRecoverBacktickWrappedPatch's own doc comment for exactly how the extraction works.
        const backtickRecovery = AIResponseParser.tryRecoverBacktickWrappedPatch(rawText);
        if (backtickRecovery) {
          return backtickRecovery;
        }
        return { status: 'AI_UNAVAILABLE', reason: 'AI remediation response was not valid JSON.' };
      }
      jsonObj = recovered;
    }

    if (typeof jsonObj !== 'object' || jsonObj === null) {
      return { status: 'AI_UNAVAILABLE', reason: 'AI remediation response JSON was not an object.' };
    }
    const obj = jsonObj as Record<string, unknown>;

    if (obj.status === 'DECLINE') {
      if (typeof obj.reason !== 'string' || obj.reason.trim().length === 0) {
        return { status: 'AI_UNAVAILABLE', reason: 'AI remediation returned status DECLINE with no reason field.' };
      }
      return { status: 'DECLINE', reason: obj.reason.trim() };
    }

    if (obj.status === 'PATCH') {
      if (typeof obj.patch !== 'string' || obj.patch.trim().length === 0) {
        return { status: 'AI_UNAVAILABLE', reason: 'AI remediation returned status PATCH with an empty or missing "patch" field.' };
      }
      if (typeof obj.explanation !== 'string' || obj.explanation.trim().length === 0) {
        return { status: 'AI_UNAVAILABLE', reason: 'AI remediation returned status PATCH with no "explanation" field.' };
      }
      const confidenceRaw = obj.confidence;
      const confidence = typeof confidenceRaw === 'number' ? confidenceRaw : Number(confidenceRaw);
      if (!Number.isFinite(confidence)) {
        return { status: 'AI_UNAVAILABLE', reason: 'AI remediation returned status PATCH with a non-numeric "confidence" field.' };
      }
      return {
        status: 'PATCH',
        patch: AIResponseParser.stripMarkdownFences(obj.patch),
        explanation: obj.explanation.trim(),
        confidence: Math.min(100, Math.max(0, confidence)),
      };
    }

    return { status: 'AI_UNAVAILABLE', reason: `AI remediation response had an unrecognized "status" value: ${JSON.stringify(obj.status)}.` };
  }

  /**
   * Last-resort recovery for a specific, real, reproduced malformed-JSON shape: `"status": "PATCH"`
   * with the "patch" value wrapped in backticks (a JS template literal) instead of a double-quoted
   * JSON string, e.g.:
   *
   *   { "status": "PATCH", "patch": `const x = 1;\nconst y = 2;`, "explanation": "...", "confidence": 90 }
   *
   * Only ever reached after both the strict JSON.parse and brace-matched JSON.parse attempts in
   * parseStructuredRemediation have already failed. Returns undefined (never throws) whenever the
   * text doesn't match this specific shape, so the caller falls through to the existing
   * AI_UNAVAILABLE result unchanged.
   *
   * The regex's `[\s\S]*` between the two field anchors is greedy, not lazy, so it resolves to the
   * LAST backtick immediately preceding `,"explanation"` rather than the first backtick found —
   * this is what keeps the extraction correct even when the patched source code itself contains a
   * backtick (e.g. a JS/TS template literal being added or edited by the patch), which a naive
   * "find the next backtick" scan would truncate on.
   *
   * This is pure string extraction, never eval()/Function()/dynamic import on the AI output — the
   * recovered "patch" string is returned through the exact same StructuredRemediationResult shape
   * as a normal parse, so it still goes through the full sandbox validation pipeline like any other
   * candidate patch (see ai-remediation-pipeline.ts) before it could ever be applied.
   */
  private static tryRecoverBacktickWrappedPatch(rawText: string): StructuredRemediationResult | undefined {
    const text = AIResponseParser.stripMarkdownFences(rawText.trim());
    if (!/"status"\s*:\s*"PATCH"/.test(text)) {
      return undefined;
    }

    const match = text.match(
      /"patch"\s*:\s*`([\s\S]*)`\s*,\s*"explanation"\s*:\s*(?:`([\s\S]*?)`|"((?:[^"\\]|\\.)*)")/
    );
    if (!match) {
      return undefined;
    }

    const patch = match[1];
    if (!patch || patch.trim().length === 0) {
      return undefined;
    }
    const explanationRaw = match[2] ?? match[3] ?? '';
    const explanation = explanationRaw.trim();
    if (!explanation) {
      return undefined;
    }

    const confidenceMatch = text.match(/"confidence"\s*:\s*(-?[0-9]+(?:\.[0-9]+)?)/);
    const confidence = confidenceMatch ? Number(confidenceMatch[1]) : NaN;
    if (!Number.isFinite(confidence)) {
      return undefined;
    }

    return {
      status: 'PATCH',
      patch: AIResponseParser.stripMarkdownFences(patch),
      explanation,
      confidence: Math.min(100, Math.max(0, confidence)),
    };
  }

  /**
   * Parses and validates raw LLM JSON text response
   */
  public static parseResponse(rawText: string): ParsedAIRemediation {
    if (!rawText || typeof rawText !== 'string') {
      throw new Error('Response parser received null or invalid input.');
    }

    // Clean markdown fences if present
    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/^```\w*\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');
    cleaned = cleaned.trim();

    let jsonObj: any;
    try {
      jsonObj = JSON.parse(cleaned);
    } catch (err) {
      // Fallback regex extraction if raw output includes extra text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonObj = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse AI remediation response as valid JSON.');
      }
    }

    const { remediatedCode, explanation, confidenceScore } = jsonObj;

    if (!remediatedCode || typeof remediatedCode !== 'string') {
      throw new Error('AI remediation response missing mandatory "remediatedCode" string field.');
    }

    if (!explanation || typeof explanation !== 'string') {
      throw new Error('AI remediation response missing mandatory "explanation" string field.');
    }

    const parsedConfidence = typeof confidenceScore === 'number' ? confidenceScore : parseFloat(confidenceScore) || 90.0;

    return {
      remediatedCode: this.stripMarkdownFences(remediatedCode),
      explanation: explanation.trim(),
      confidenceScore: Math.min(100, Math.max(50, parsedConfidence))
    };
  }

  /**
   * Utility to strip leftover code block ticks inside remediatedCode strings
   */
  private static stripMarkdownFences(code: string): string {
    let result = code.trim();
    if (result.startsWith('```')) {
      result = result.replace(/^```[a-zA-Z]*\n?/, '');
    }
    if (result.endsWith('```')) {
      result = result.replace(/\n?```$/, '');
    }
    return result.trim();
  }
}
