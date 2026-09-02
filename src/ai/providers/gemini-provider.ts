/**
 * Framework-Independent Guideline Model (FIGM)
 * Gemini Provider — the server-only Gemini (Google GenAI SDK) integration boundary
 *
 * Mirrors claude-client.server.ts's own boundary discipline: one place the API key is read, one
 * place the request is shaped, one place the response is validated — nothing else in this codebase
 * talks to the Gemini API directly. Shares the exact same request/result contract as every other
 * provider (see ../providers/ai-remediation-provider.ts) so src/ai/ai-provider-selector.ts can hand
 * this provider to src/ai/ai-remediation-pipeline.ts interchangeably, and — specifically — as the
 * automatic fallback target when Claude becomes unavailable mid-remediation (see
 * ai-provider-selector.ts's getFallbackProvider and ai-remediation-pipeline.ts's retry loop).
 *
 * Uses the official `@google/genai` SDK (`GoogleGenAI.models.generateContent`), NOT a hand-rolled
 * fetch call against the REST endpoint — this is deliberate: the SDK is already a project
 * dependency (see package.json), and reproducing its request shaping/auth header handling by hand
 * (as the now-deleted legacy src/ai/gemini-service.ts once did, appending `?key=...` to the URL)
 * would be strictly worse for no benefit. `responseMimeType: 'application/json'` IS requested here
 * (unlike Qwen's auto-router, which deliberately does NOT request it because it may forward to a
 * third-party backend that doesn't honor it identically) — the Gemini API is a single, first-party
 * backend that supports this reliably, so it is used to reduce (not eliminate — AIResponseParser's
 * fence-stripping/regex fallback still exists as defense in depth) malformed-envelope responses.
 *
 * SECURITY: GEMINI_API_KEY is read ONLY here, from `process.env` (server-side only — this file is
 * never imported by anything reachable from a Client Component, matching every other provider's own
 * module boundary). The key is sent exclusively via the SDK's own request shaping, is never logged,
 * never included in any thrown error message, and never appears in a result returned to a caller.
 */

import { GoogleGenAI, ApiError } from '@google/genai';
import { AIPromptBuilder, AI_REMEDIATION_POLICY_INSTRUCTION } from '../prompt-builder.js';
import { AIResponseParser } from '../response-parser.js';
import type { AIRemediationProvider, AIRemediationProviderResult, AIRemediationRequest } from './ai-remediation-provider.js';

// Verified live against the real Gemini API (2026): "gemini-2.5-flash" now returns a genuine 404
// ("no longer available to new users... use models/gemini-3.6-flash") for this deployment's key —
// not a hypothetical, reproduced by tests/gemini-integration.test.ts's own real E2E run. Kept
// overridable via GEMINI_MODEL for any account still served by a different model.
const DEFAULT_MODEL = 'gemini-3.6-flash';
// Overridable via GEMINI_TIMEOUT_MS — same rationale as Qwen's own resolveTimeoutMs (tests can
// exercise the timeout path in milliseconds instead of real seconds).
function resolveTimeoutMs(): number {
  const raw = process.env.GEMINI_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 45_000;
}
const MAX_PROMPT_LENGTH = 100_000;
const MAX_OUTPUT_TOKENS = 16_000;

/** Gemini-specific transport instruction appended to the shared policy — the SDK call below also
 *  requests `responseMimeType: 'application/json'`, but the instruction is kept explicit anyway
 *  (belt-and-braces, matching every other provider's own transport instruction) since a
 *  model-followed JSON *shape* is still required even when the transport enforces JSON *syntax*. */
const SYSTEM_INSTRUCTION = `${AI_REMEDIATION_POLICY_INSTRUCTION}

You MUST respond with ONLY a single raw JSON object — no markdown code fences, no prose before or after it. It must match exactly one of these two shapes:

To submit a patch:
{"status": "PATCH", "patch": "<the complete corrected source file content>", "explanation": "<step-by-step description of the fix>", "confidence": <number 0-100>}

To decline:
{"status": "DECLINE", "reason": "<why no safe patch could be produced>"}

CRITICAL JSON FORMATTING RULE: every field, including "patch", MUST be a standard double-quoted JSON string. Never wrap "patch" (or any field) in backticks or any other template-literal syntax — that is JavaScript syntax, not JSON, and will make your entire response unparseable. Encode every literal newline in "patch" as the two characters \\n, and escape every double-quote character in the source code as \\". Do not use raw, unescaped newlines inside any JSON string value.`;

function scrubKey(message: string, key: string): string {
  if (!key) return message;
  return message.split(key).join('[REDACTED]');
}

export class GeminiClient {
  /**
   * Requests a single remediation attempt from Gemini. Never throws — every failure mode
   * (missing/invalid key, network error, timeout, rate limit, provider error, malformed response)
   * is caught and mapped to `{ status: 'AI_UNAVAILABLE', reason }`. Callers must still run any
   * returned PATCH through the full sandbox validation pipeline — this method only talks to
   * Gemini, it approves nothing.
   */
  public static async generateRemediation(request: AIRemediationRequest): Promise<AIRemediationProviderResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { status: 'AI_UNAVAILABLE', reason: 'GEMINI_API_KEY environment variable is not configured.' };
    }

    // Checked against the RAW input length, before buildUserContent's own internal truncation —
    // mirrors every other provider's own guard.
    if (request.code.length > MAX_PROMPT_LENGTH) {
      return { status: 'AI_UNAVAILABLE', reason: `Source exceeds the maximum allowed prompt length (${request.code.length} > ${MAX_PROMPT_LENGTH} chars).` };
    }
    const userContent = AIPromptBuilder.buildUserContent(request, MAX_PROMPT_LENGTH);

    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const timeoutMs = resolveTimeoutMs();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const client = new GoogleGenAI({ apiKey });
      const response = await client.models.generateContent({
        model,
        contents: userContent,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.2,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          responseMimeType: 'application/json',
          abortSignal: controller.signal,
        },
      });

      const text = response.text;
      if (!text || typeof text !== 'string') {
        return { status: 'AI_UNAVAILABLE', reason: 'Gemini returned no response text (possibly a safety refusal or provider error).' };
      }

      // Reuses the exact same validator every other provider's output goes through — provider-
      // agnostic (see response-parser.ts's own doc comment), including its markdown-fence-stripping
      // and regex JSON-extraction fallback, defense in depth beyond the requested responseMimeType.
      return AIResponseParser.parseStructuredRemediation(text);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { status: 'AI_UNAVAILABLE', reason: `Gemini API request timed out after ${timeoutMs}ms.` };
      }
      // Never surface the raw SDK exception (which could, in principle, echo request details) —
      // return a scrubbed, generic-but-informative reason instead, mirroring every other
      // provider's own error-scrubbing discipline.
      const message = err instanceof Error ? err.message : String(err);
      const scrubbed = scrubKey(message, apiKey);
      console.error('[gemini-provider] Gemini API call failed:', scrubbed);

      const status = err instanceof ApiError ? err.status : undefined;
      if (status === 401 || status === 403) {
        return { status: 'AI_UNAVAILABLE', reason: 'Gemini API authentication failed. Check the configured GEMINI_API_KEY.' };
      }
      // Reproduced-shape parity with the now-removed Qwen provider's own 402 handling: Google AI
      // Studio / Gemini API returns 429 for both true rate limiting AND quota/billing exhaustion (there is
      // no distinct 402 in this API) — RESOURCE_EXHAUSTED is Google's own error status name for
      // this condition. Treated as a permanent, non-retryable-on-this-provider failure so
      // ai-remediation-pipeline.ts's fallback logic can act on it immediately rather than burning
      // further attempts against an exhausted key.
      if (status === 429 || /RESOURCE_EXHAUSTED/i.test(message)) {
        return { status: 'AI_UNAVAILABLE', reason: 'Gemini API rate limit or quota exhausted (status 429) — the configured account has no remaining capacity.' };
      }
      if (typeof status === 'number') {
        return { status: 'AI_UNAVAILABLE', reason: `Gemini API request failed (status ${status}). Please try again later.` };
      }
      return { status: 'AI_UNAVAILABLE', reason: 'Gemini API request failed due to a network error. Please try again later.' };
    } finally {
      clearTimeout(timer);
    }
  }
}

export const geminiProvider: AIRemediationProvider = {
  providerName: 'GEMINI',
  generateRemediation: (request) => GeminiClient.generateRemediation(request),
};
