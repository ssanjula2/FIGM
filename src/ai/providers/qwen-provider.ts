/**
 * Framework-Independent Guideline Model (FIGM)
 * Qwen Provider — the server-only Qwen2.5-Coder (Hugging Face Inference) integration boundary
 *
 * Mirrors src/ai/claude-client.server.ts's own boundary discipline for the Hugging Face
 * `@huggingface/inference` SDK: one place the token is read, one place the request is shaped, one
 * place the response is validated — nothing else in this codebase talks to the Hugging Face
 * Inference API directly. Shares the exact same request/result contract as ClaudeClient (see
 * ../providers/ai-remediation-provider.ts) so src/ai/ai-provider-selector.ts can hand either
 * provider to src/ai/ai-remediation-pipeline.ts interchangeably.
 *
 * Uses `InferenceClient.chatCompletion` (OpenAI-compatible chat API) against the configured
 * `HF_MODEL` (default: Qwen/Qwen2.5-Coder-7B-Instruct), with no explicit `provider` argument —
 * that resolves to Hugging Face's own auto-router (a single HTTP call, no extra provider-mapping
 * lookup; see @huggingface/inference's getInferenceProviderMapping.js: `provider === 'auto'` short
 * -circuits straight to the router). This is deliberate, not an oversight: verified live against
 * the Hub API (`GET /api/models/{id}?expand[]=inferenceProviderMapping`) that neither this model
 * nor the prior default is served by Hugging Face's own `hf-inference` backend at all — only by
 * third-party providers (`nscale`/`featherless-ai` for this model). Forcing an explicit
 * `provider: 'hf-inference'` was tried and reproducibly fails with "We have not been able to find
 * inference provider information for model ...", a strictly worse failure than the auto-router's
 * own error. `provider: 'auto'` is the only setting that adapts automatically to whichever
 * provider currently serves a given model, which the auto-router's own request-time provider
 * lookup handles — hardcoding one specific third-party provider name would be more brittle (breaks
 * silently the day that provider stops hosting this model) for no real benefit, since both paths
 * require the same valid `hf_...` token regardless. `response_format` is deliberately NOT
 * requested: the auto-router may forward this call to any of several third-party inference
 * providers, and not all of them honor OpenAI JSON-schema/JSON-object response-format hints
 * identically — relying on a strict instruction in the prompt plus AIResponseParser's
 * already-robust fence-stripping/regex JSON extraction (the same parser Claude's output goes
 * through) is the more portable choice here.
 *
 * SECURITY: HF_TOKEN is read ONLY here, from `process.env` (server-side only — this file is never
 * imported by anything reachable from a Client Component, matching claude-client.server.ts's own
 * module boundary). The token is sent exclusively via the SDK's own Authorization header, is never
 * logged, never included in any thrown error message, and never appears in a result returned to a
 * caller.
 */

import { InferenceClient, InferenceClientRoutingError } from '@huggingface/inference';
import { AIPromptBuilder, AI_REMEDIATION_POLICY_INSTRUCTION } from '../prompt-builder.js';
import { AIResponseParser } from '../response-parser.js';
import type { AIRemediationProvider, AIRemediationProviderResult, AIRemediationRequest } from './ai-remediation-provider.js';

const DEFAULT_MODEL = 'Qwen/Qwen2.5-Coder-7B-Instruct';
// Overridable via QWEN_TIMEOUT_MS (primarily so tests can exercise the timeout path in
// milliseconds instead of real seconds) — same real-world-calibrated default as Claude's own
// resolveTimeoutMs (a full-file JSON patch request is a heavier call than a minimal prompt).
function resolveTimeoutMs(): number {
  const raw = process.env.QWEN_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 45_000;
}
const MAX_PROMPT_LENGTH = 100_000;
const MAX_OUTPUT_TOKENS = 16_000;

/** Qwen-specific transport instruction appended to the shared policy
 *  (AI_REMEDIATION_POLICY_INSTRUCTION) — tells the model HOW to submit its decision on this
 *  provider (a strict JSON text contract, since HF's auto-router does not guarantee a specific
 *  downstream provider supports tool-calling/JSON-schema response formatting identically). */
const SYSTEM_INSTRUCTION = `${AI_REMEDIATION_POLICY_INSTRUCTION}

You MUST respond with ONLY a single raw JSON object — no markdown code fences, no prose before or after it. It must match exactly one of these two shapes:

To submit a patch:
{"status": "PATCH", "patch": "<the complete corrected source file content>", "explanation": "<step-by-step description of the fix>", "confidence": <number 0-100>}

To decline:
{"status": "DECLINE", "reason": "<why no safe patch could be produced>"}

CRITICAL JSON FORMATTING RULE: every field, including "patch", MUST be a standard double-quoted JSON string. Never wrap "patch" (or any field) in backticks or any other template-literal syntax — that is JavaScript syntax, not JSON, and will make your entire response unparseable. Encode every literal newline in "patch" as the two characters \\n, and escape every double-quote character in the source code as \\". Do not use raw, unescaped newlines inside any JSON string value.`;

function scrubToken(message: string, token: string): string {
  if (!token) return message;
  return message.split(token).join('[REDACTED]');
}

export class QwenClient {
  /**
   * Requests a single remediation attempt from Qwen. Never throws — every failure mode
   * (missing/invalid token, network error, timeout, rate limit, provider error, malformed
   * response) is caught and mapped to `{ status: 'AI_UNAVAILABLE', reason }`. Callers must still
   * run any returned PATCH through the full sandbox validation pipeline — this method only talks
   * to Qwen, it approves nothing.
   */
  public static async generateRemediation(request: AIRemediationRequest): Promise<AIRemediationProviderResult> {
    const token = process.env.HF_TOKEN;
    if (!token) {
      return { status: 'AI_UNAVAILABLE', reason: 'HF_TOKEN environment variable is not configured.' };
    }

    // Checked against the RAW input length, before buildUserContent's own internal truncation —
    // truncating first and then measuring the (now-bounded) result would make this guard
    // structurally unable to ever fire, defeating its purpose. Mirrors claude-client.server.ts.
    if (request.code.length > MAX_PROMPT_LENGTH) {
      return { status: 'AI_UNAVAILABLE', reason: `Source exceeds the maximum allowed prompt length (${request.code.length} > ${MAX_PROMPT_LENGTH} chars).` };
    }
    const userContent = AIPromptBuilder.buildUserContent(request, MAX_PROMPT_LENGTH);

    const model = process.env.HF_MODEL || DEFAULT_MODEL;
    const timeoutMs = resolveTimeoutMs();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const client = new InferenceClient(token);
      const response = await client.chatCompletion(
        {
          model,
          messages: [
            { role: 'system', content: SYSTEM_INSTRUCTION },
            { role: 'user', content: userContent },
          ],
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: 0.2,
        },
        { signal: controller.signal },
      );

      const text = response.choices?.[0]?.message?.content;
      if (!text || typeof text !== 'string') {
        return { status: 'AI_UNAVAILABLE', reason: 'Qwen returned no response text (possibly a safety refusal or provider error).' };
      }

      // Reuses the exact same validator Claude's output goes through — provider-agnostic (see
      // response-parser.ts's own doc comment), including its markdown-fence-stripping and regex
      // JSON-extraction fallback, which matters here specifically because no response_format was
      // requested (see file header).
      return AIResponseParser.parseStructuredRemediation(text);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { status: 'AI_UNAVAILABLE', reason: `Qwen API request timed out after ${timeoutMs}ms.` };
      }
      // Thrown client-side by the SDK's auto-router BEFORE any HTTP request is made, whenever
      // HF_TOKEN doesn't look like a real Hugging Face token (real ones always start with "hf_") —
      // see @huggingface/inference's AutoRouterConversationalTask.makeBaseUrl. This has no
      // `httpResponse` (no network call ever happened), so it would otherwise fall through to the
      // generic "network error" branch below — misleading, since it is a permanent configuration
      // problem, not a transient network failure. Reuses the same "authentication failed" phrasing
      // as the 401/403 branch below on purpose, so ai-remediation-pipeline.ts's existing
      // permanent-failure check (which already matches that phrase) stops retrying immediately
      // instead of burning two more identical, guaranteed-to-fail attempts.
      if (err instanceof InferenceClientRoutingError) {
        console.error('[qwen-provider] HF_TOKEN is not a valid-shaped Hugging Face token (auto-router refused it).');
        return {
          status: 'AI_UNAVAILABLE',
          reason: 'Qwen API authentication failed: HF_TOKEN does not look like a valid Hugging Face access token (it must start with "hf_"). Generate one at https://huggingface.co/settings/tokens.',
        };
      }
      // Never surface the raw SDK exception (which could, in principle, echo request details) —
      // return a scrubbed, generic-but-informative reason instead, mirroring
      // claude-client.server.ts's own error-scrubbing discipline.
      const message = err instanceof Error ? err.message : String(err);
      const scrubbed = scrubToken(message, token);
      console.error('[qwen-provider] Qwen API call failed:', scrubbed);

      const status = (err as { httpResponse?: { status?: number } } | undefined)?.httpResponse?.status;
      if (status === 401 || status === 403) {
        return { status: 'AI_UNAVAILABLE', reason: 'Qwen API authentication failed. Check the configured HF_TOKEN.' };
      }
      // Reproduced live (not hypothetical): Hugging Face returns 402 when the configured account
      // has exhausted its monthly included inference credits. Like an auth failure, this cannot
      // possibly resolve within the same remediation attempt's retry window -- ai-remediation-
      // pipeline.ts's permanent-failure check matches "authentication failed" / "billing/quota
      // exhausted" specifically so this stops after one attempt instead of burning two more
      // identical, guaranteed-to-fail retries (and their network latency) on a condition retrying
      // cannot fix.
      if (status === 402) {
        return { status: 'AI_UNAVAILABLE', reason: 'Qwen API billing/quota exhausted (status 402) — the configured account has no remaining inference credits.' };
      }
      if (status === 429) {
        return { status: 'AI_UNAVAILABLE', reason: 'Qwen API rate limit exceeded. Please try again later.' };
      }
      if (typeof status === 'number') {
        return { status: 'AI_UNAVAILABLE', reason: `Qwen API request failed (status ${status}). Please try again later.` };
      }
      return { status: 'AI_UNAVAILABLE', reason: 'Qwen API request failed due to a network error. Please try again later.' };
    } finally {
      clearTimeout(timer);
    }
  }
}

export const qwenProvider: AIRemediationProvider = {
  providerName: 'QWEN',
  generateRemediation: (request) => QwenClient.generateRemediation(request),
};
