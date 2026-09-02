/**
 * Framework-Independent Guideline Model (FIGM)
 * Claude Client — the ONE server-only Claude (Anthropic) integration boundary
 *
 * Every other module that needs an AI-generated remediation goes through
 * `ClaudeClient.generateRemediation()`. Nothing else in this codebase instantiates the Anthropic
 * SDK client directly, builds a raw Claude HTTP request, or parses a raw Claude response — that is
 * deliberate: one controlled abstraction, one place the API key is read, one place a request is
 * shaped, one place a response is validated. This replaces the former Gemini integration
 * (src/ai/gemini-client.server.ts) — same request/result contract, same caller, different provider.
 *
 * Uses the official `@anthropic-ai/sdk` package. The remediation decision is requested via a single
 * forced tool call (`submit_remediation`, `strict: true`) rather than free-form text + JSON parsing
 * — this guarantees the response is well-formed JSON matching the declared shape before it ever
 * reaches AIResponseParser, the same validator the prior Gemini integration used (its parser is
 * provider-agnostic: it validates a `{status, patch, explanation, confidence}` / `{status, reason}`
 * shape, not anything Gemini-specific).
 *
 * SECURITY: ANTHROPIC_API_KEY is read ONLY here, from `process.env` (server-side only — this file is
 * never imported by anything reachable from a Client Component; see the module boundary notes on
 * src/engine/remediation-validation.server.ts, the same pattern applied here). The key is sent
 * exclusively via the SDK's `x-api-key` HTTP header, is never logged, never included in any thrown
 * error message, and never appears in a ClaudeRemediationResult returned to a caller.
 */

import Anthropic from '@anthropic-ai/sdk';
import { DiagnosticReport } from '../types/ast-spec.js';
import { AIPromptBuilder, AI_REMEDIATION_POLICY_INSTRUCTION, type PreviousAttemptFeedback } from './prompt-builder.js';
import { AIResponseParser, type StructuredRemediationResult } from './response-parser.js';

const DEFAULT_MODEL = 'claude-opus-5';
// Overridable via ANTHROPIC_TIMEOUT_MS (primarily so tests can exercise the timeout path in
// milliseconds instead of real seconds) — falls back to the same real-world-calibrated default the
// prior Gemini integration used (a full-file JSON patch request, with system instruction + rule
// context + source code, is a heavier call than a minimal prompt).
function resolveTimeoutMs(): number {
  const raw = process.env.ANTHROPIC_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 45_000;
}
const MAX_PROMPT_LENGTH = 100_000;
// Generous enough that a full-file patch + explanation rarely truncates mid-JSON, still bounded.
const MAX_OUTPUT_TOKENS = 16_000;

export interface ClaudeRemediationRequest {
  defect: DiagnosticReport;
  code: string;
  framework: string;
  /** Present only on a retry: the previous rejected patch and exactly why it was rejected, so the
   *  model can correct itself without re-explaining the whole violation from scratch. Never
   *  includes secrets, internal file-system paths, or unbounded logs — see
   *  AIPromptBuilder.buildUserContent. */
  previousAttempt?: PreviousAttemptFeedback;
}

/** PATCH | DECLINE | AI_UNAVAILABLE — see response-parser.ts's StructuredRemediationResult for the
 *  authoritative definition (shared, not duplicated) and the distinction between DECLINE (the
 *  model considered the violation and chose not to produce a patch) and AI_UNAVAILABLE (no usable
 *  response could be obtained at all: missing/invalid key, network failure, timeout, rate limit,
 *  safety refusal, malformed output). */
export type ClaudeRemediationResult = StructuredRemediationResult;

/** Forces a single, schema-validated tool call instead of relying on the model to emit loose JSON
 *  in its text response — `strict: true` guarantees the input Claude sends conforms to this shape
 *  before AIResponseParser ever sees it. */
const SUBMIT_REMEDIATION_TOOL: Anthropic.Tool = {
  name: 'submit_remediation',
  description:
    'Submit the remediation decision for the violation described in the RULE CONTEXT: either a minimal corrected patch, or a decline with reason. Always call this tool exactly once — never respond with plain text.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['PATCH', 'DECLINE'] },
      patch: { type: 'string', description: 'The complete corrected source file content. Required when status is PATCH.' },
      explanation: { type: 'string', description: 'Step-by-step description of the fix. Required when status is PATCH.' },
      confidence: { type: 'number', description: 'Self-reported confidence 0-100. Required when status is PATCH. Informational only — never used to bypass validation.' },
      reason: { type: 'string', description: 'Why no safe patch could be produced. Required when status is DECLINE.' },
    },
    required: ['status'],
    additionalProperties: false,
  },
};

/** Claude-specific transport instruction appended to the shared policy (AI_REMEDIATION_POLICY_INSTRUCTION)
 *  — tells the model HOW to submit its decision on this provider (a forced tool call), which is
 *  deliberately not part of the shared, provider-agnostic policy text. */
const SYSTEM_INSTRUCTION = `${AI_REMEDIATION_POLICY_INSTRUCTION}

You MUST respond by calling the submit_remediation tool exactly once. Do not respond with plain text.`;

export class ClaudeClient {
  /**
   * Requests a single remediation attempt from Claude. Never throws — every failure mode
   * (missing/invalid key, network error, timeout, rate limit, safety refusal, malformed tool
   * input, schema violation) is caught and mapped to `{ status: 'AI_UNAVAILABLE', reason }`.
   * Callers must still run any returned PATCH through the full sandbox validation pipeline — this
   * method only talks to Claude, it approves nothing.
   */
  public static async generateRemediation(request: ClaudeRemediationRequest): Promise<ClaudeRemediationResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { status: 'AI_UNAVAILABLE', reason: 'ANTHROPIC_API_KEY environment variable is not configured.' };
    }

    // Checked against the RAW input length, before buildUserContent's own internal truncation —
    // truncating first and then measuring the (now-bounded) result would make this guard
    // structurally unable to ever fire, defeating its purpose.
    if (request.code.length > MAX_PROMPT_LENGTH) {
      return { status: 'AI_UNAVAILABLE', reason: `Source exceeds the maximum allowed prompt length (${request.code.length} > ${MAX_PROMPT_LENGTH} chars).` };
    }
    const userContent = AIPromptBuilder.buildUserContent(request, MAX_PROMPT_LENGTH);

    const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
    const timeoutMs = resolveTimeoutMs();

    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create(
        {
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: SYSTEM_INSTRUCTION,
          messages: [{ role: 'user', content: userContent }],
          tools: [SUBMIT_REMEDIATION_TOOL],
          tool_choice: { type: 'tool', name: 'submit_remediation' },
        },
        { timeout: timeoutMs },
      );

      if (response.stop_reason === 'refusal') {
        return { status: 'AI_UNAVAILABLE', reason: 'Claude declined to respond (possibly a safety refusal or content filter).' };
      }

      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === 'submit_remediation',
      );
      if (!toolUse) {
        return { status: 'AI_UNAVAILABLE', reason: 'Claude returned no structured response (possibly a safety refusal or content filter).' };
      }

      // Reuses the exact same validator the prior Gemini integration relied on — it is
      // provider-agnostic (validates the {status, patch, explanation, confidence} / {status,
      // reason} shape, not anything Gemini-specific) — so the raw tool input is re-serialized to
      // text and fed through the one tested path rather than duplicating shape validation here.
      return AIResponseParser.parseStructuredRemediation(JSON.stringify(toolUse.input));
    } catch (err) {
      // Never surface the raw SDK exception (which could, in principle, echo request details) —
      // return a scrubbed, generic-but-informative reason instead. Ordered most-specific-first so
      // retryable (timeout, rate limit, connection, 5xx) and non-retryable (auth) failures map to
      // distinct, accurate messages instead of one catch-all string.
      if (err instanceof Anthropic.APIConnectionTimeoutError) {
        return { status: 'AI_UNAVAILABLE', reason: `Claude API request timed out after ${timeoutMs}ms.` };
      }
      if (err instanceof Anthropic.AuthenticationError) {
        console.error('[claude-client] Claude API authentication failed:', err.message);
        return { status: 'AI_UNAVAILABLE', reason: 'Claude API authentication failed. Check the configured API key.' };
      }
      if (err instanceof Anthropic.RateLimitError) {
        console.error('[claude-client] Claude API rate limited:', err.message);
        return { status: 'AI_UNAVAILABLE', reason: 'Claude API rate limit exceeded. Please try again later.' };
      }
      if (err instanceof Anthropic.APIConnectionError) {
        console.error('[claude-client] Claude API connection failed:', err.message);
        return { status: 'AI_UNAVAILABLE', reason: 'Claude API request failed due to a network error. Please try again later.' };
      }
      // The raw SDK/HTTP exception (verbose provider JSON) must never reach the client -- log it
      // server-side only, in full (after key redaction), for diagnosis, and return a clean,
      // categorized reason a UI can show directly.
      const message = err instanceof Error ? err.message : String(err);
      const scrubbed = message.replace(new RegExp(escapeRegExp(apiKey), 'g'), '[REDACTED]');
      console.error('[claude-client] Claude API call failed:', scrubbed);
      const reason = err instanceof Anthropic.APIError ? `Claude API request failed (status ${err.status ?? 'unknown'}). Please try again later.` : 'Claude API request failed. Please try again later.';
      return { status: 'AI_UNAVAILABLE', reason };
    }
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
