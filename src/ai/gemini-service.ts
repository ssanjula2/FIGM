/**
 * Framework-Independent Guideline Model (FIGM)
 * Gemini Service Integration - API Client for Gemini 2.5 Flash
 */

export interface GeminiResponse {
  rawText: string;
  model: string;
  statusCode: number;
}

export class GeminiService {
  private static readonly MODEL_NAME = 'gemini-2.5-flash';
  private static readonly API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

  /**
   * Invokes Gemini 2.5 Flash API with structured parameters
   */
  public static async generateContent(prompt: string): Promise<GeminiResponse> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.');
    }

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      }
    };

    const url = `${this.API_ENDPOINT}/${this.MODEL_NAME}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API HTTP Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new Error('Gemini API returned an empty or unparseable response body.');
    }

    return {
      rawText: candidateText,
      model: this.MODEL_NAME,
      statusCode: response.status
    };
  }
}
