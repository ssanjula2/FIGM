/**
 * Framework-Independent Guideline Model (FIGM)
 * Response Parser Module for Gemini LLM Outputs
 */

export interface ParsedAIRemediation {
  remediatedCode: string;
  explanation: string;
  confidenceScore: number;
}

export class AIResponseParser {
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
        throw new Error('Failed to parse Gemini response as valid JSON.');
      }
    }

    const { remediatedCode, explanation, confidenceScore } = jsonObj;

    if (!remediatedCode || typeof remediatedCode !== 'string') {
      throw new Error('Gemini response missing mandatory "remediatedCode" string field.');
    }

    if (!explanation || typeof explanation !== 'string') {
      throw new Error('Gemini response missing mandatory "explanation" string field.');
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
