/**
 * Framework-Independent Guideline Model (FIGM)
 * Ollama Provider — the server-only LOCAL Ollama (qwen2.5-coder) integration boundary
 *
 * Mirrors claude-client.server.ts's own boundary discipline, adapted for Ollama's native HTTP API
 * instead of an SDK: one place the endpoint/model are read, one place the request is shaped, one
 * place the response is validated — nothing else in this codebase talks to a local Ollama server
 * directly. Shares the exact same request/result contract as ClaudeClient/GeminiClient (see
 * ../providers/ai-remediation-provider.ts) so src/ai/ai-provider-selector.ts can hand this provider
 * to src/ai/ai-remediation-pipeline.ts interchangeably with either of them.
 *
 * Uses `POST {OLLAMA_BASE_URL}/api/generate` with `stream: false` — a single non-streaming HTTP
 * call that returns one JSON object (`{ response: "<generated text>", ... }`), not the chat/message
 * array shape `/api/chat` or the Anthropic SDK uses. There is no system/user role split in this
 * endpoint, so the shared policy instruction and the untrusted SOURCE CODE block are concatenated
 * into a single `prompt` string — the untrusted-data framing inside AI_REMEDIATION_POLICY_INSTRUCTION
 * / AIPromptBuilder.buildUserContent (a `### SOURCE CODE (untrusted data...)` header) is what keeps
 * the safety boundary real, not the transport shape.
 *
 * SECURITY (browser isolation): this module runs server-only, exactly like claude-client.server.ts
 * and gemini-provider.ts — nothing in app/ or any Client Component imports it, and the browser never
 * receives OLLAMA_BASE_URL, the raw Ollama response, or any ability to pick a model. The server
 * ALWAYS uses the configured OLLAMA_MODEL (or the DEFAULT_MODEL fallback below); no caller-supplied
 * value can override it — see AIRemediationRequest, which carries no model/provider field at all.
 *
 * ACTIVATION: the provider is enabled ONLY when OLLAMA_BASE_URL or OLLAMA_MODEL is explicitly set
 * (see isOllamaConfigured / AIProviderSelector) — it never activates from its own hardcoded
 * defaults alone. This is deliberate: a Vercel/production deployment that sets neither variable
 * must never attempt to reach 127.0.0.1 (which, on Vercel, is the function sandbox itself, not the
 * developer's machine). Once activated (by setting either var), the OTHER var falls back to a
 * sensible local-dev default — see resolveBaseUrl/resolveModel below.
 */

import { AIPromptBuilder, AI_REMEDIATION_POLICY_INSTRUCTION } from '../prompt-builder.js';
import { AIResponseParser } from '../response-parser.js';
import type { AIRemediationProvider, AIRemediationProviderResult, AIRemediationRequest } from './ai-remediation-provider.js';

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'qwen2.5-coder:7b';

// Overridable via OLLAMA_TIMEOUT_MS. Local CPU/GPU-constrained inference is meaningfully slower
// than a hosted API call, so the default is generous compared to Claude/Gemini's 45s.
function resolveTimeoutMs(): number {
  const raw = process.env.OLLAMA_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120_000;
}
const HEALTH_CHECK_TIMEOUT_MS = 2_000;
const MAX_PROMPT_LENGTH = 100_000;
const MAX_OUTPUT_TOKENS = 16_000;

/** Ollama-specific transport instruction appended to the shared policy — /api/generate has no
 *  structured tool-call contract, so (similar to gemini-provider.ts's own JSON-text request)
 *  this asks for strict raw JSON text, parsed by the same AIResponseParser every provider uses. */
const SYSTEM_INSTRUCTION = `${AI_REMEDIATION_POLICY_INSTRUCTION}

You MUST respond with ONLY a single raw JSON object — no markdown code fences, no prose before or after it. It must match exactly one of these two shapes:

To submit a patch:
{"status": "PATCH", "patch": "<the complete corrected source file content>", "explanation": "<step-by-step description of the fix>", "confidence": <number 0-100>}

To decline:
{"status": "DECLINE", "reason": "<why no safe patch could be produced>"}`;

/** The ONLY signal that enables this provider — see the ACTIVATION note in the file header. */
function isOllamaConfigured(): boolean {
  return !!process.env.OLLAMA_BASE_URL || !!process.env.OLLAMA_MODEL;
}

function resolveBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function resolveModel(): string {
  return process.env.OLLAMA_MODEL || DEFAULT_MODEL;
}

/** Result of a lightweight `/api/tags` probe — used by the health-check route (app/api/health/route.ts)
 *  to report Ollama/model availability BEFORE any remediation attempt is made, never by the
 *  remediation path itself (which always attempts the real call and reports its own failure). */
export interface OllamaHealthStatus {
  configured: boolean;
  baseUrl: string;
  model: string;
  reachable: boolean;
  modelAvailable: boolean;
  error?: string;
}

export class OllamaClient {
  /** True when OLLAMA_BASE_URL or OLLAMA_MODEL is set — mirrors AIProviderSelector's own check so
   *  the selector never has to duplicate this env-reading logic. */
  public static isConfigured(): boolean {
    return isOllamaConfigured();
  }

  /**
   * Lightweight, short-timeout probe (`GET /api/tags`) that never runs a generation — reports
   * whether the local Ollama server is reachable and whether the configured model is actually
   * pulled, so a caller (the health-check route) can surface "Ollama unavailable" cleanly BEFORE
   * a user hits Fix and waits out a full remediation timeout for nothing.
   */
  public static async checkHealth(): Promise<OllamaHealthStatus> {
    const baseUrl = resolveBaseUrl();
    const model = resolveModel();
    if (!isOllamaConfigured()) {
      return { configured: false, baseUrl, model, reachable: false, modelAvailable: false };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
    try {
      const res = await fetch(`${baseUrl}/api/tags`, { signal: controller.signal });
      if (!res.ok) {
        return { configured: true, baseUrl, model, reachable: false, modelAvailable: false, error: `Ollama responded with HTTP ${res.status}.` };
      }
      const body = (await res.json().catch(() => null)) as { models?: Array<{ name?: unknown }> } | null;
      const names = Array.isArray(body?.models) ? body!.models.map((m) => m.name).filter((n): n is string => typeof n === 'string') : [];
      const modelAvailable = names.includes(model);
      return {
        configured: true,
        baseUrl,
        model,
        reachable: true,
        modelAvailable,
        error: modelAvailable ? undefined : `Model "${model}" is not in \`ollama list\` — run \`ollama pull ${model}\`.`,
      };
    } catch (err) {
      const timedOut = err instanceof Error && err.name === 'AbortError';
      return {
        configured: true,
        baseUrl,
        model,
        reachable: false,
        modelAvailable: false,
        error: timedOut ? 'Ollama health check timed out.' : `Ollama is unreachable at ${baseUrl} — is \`ollama serve\` running?`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Requests a single remediation attempt from the local Ollama model. Never throws — every
   * failure mode (not configured, connection refused, timeout, HTTP error, model-load failure,
   * malformed/empty response) is caught and mapped to `{ status: 'AI_UNAVAILABLE', reason }`.
   * Callers must still run any returned PATCH through the full sandbox validation pipeline — this
   * method only talks to Ollama, it approves nothing.
   */
  public static async generateRemediation(request: AIRemediationRequest): Promise<AIRemediationProviderResult> {
    if (!isOllamaConfigured()) {
      return { status: 'AI_UNAVAILABLE', reason: 'OLLAMA_BASE_URL / OLLAMA_MODEL environment variable is not configured.' };
    }

    // Checked against the RAW input length, before buildUserContent's own internal truncation —
    // mirrors claude-client.server.ts / gemini-provider.ts.
    if (request.code.length > MAX_PROMPT_LENGTH) {
      return { status: 'AI_UNAVAILABLE', reason: `Source exceeds the maximum allowed prompt length (${request.code.length} > ${MAX_PROMPT_LENGTH} chars).` };
    }
    const userContent = AIPromptBuilder.buildUserContent(request, MAX_PROMPT_LENGTH);

    const baseUrl = resolveBaseUrl();
    const model = resolveModel();
    const timeoutMs = resolveTimeoutMs();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: `${SYSTEM_INSTRUCTION}\n\n${userContent}`,
          stream: false,
          options: { num_predict: MAX_OUTPUT_TOKENS, temperature: 0.2 },
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          status: 'AI_UNAVAILABLE',
          reason: `Ollama request timed out after ${timeoutMs}ms — the local model may still be loading, or the machine may be under memory pressure.`,
        };
      }
      const cause = (err as { cause?: { code?: string } } | undefined)?.cause;
      const message = err instanceof Error ? err.message : String(err);
      if (cause?.code === 'ECONNREFUSED' || /ECONNREFUSED/i.test(message)) {
        console.error('[ollama-provider] connection refused at', baseUrl);
        return { status: 'AI_UNAVAILABLE', reason: `Ollama server is unreachable at ${baseUrl} — start it with \`ollama serve\`.` };
      }
      console.error('[ollama-provider] Ollama request failed:', message);
      return { status: 'AI_UNAVAILABLE', reason: `Ollama server is unreachable at ${baseUrl} — a network error occurred while contacting the local Ollama endpoint.` };
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const rawBody = await response.text().catch(() => '');
      // Logged in full server-side only, for local diagnosis — never returned verbatim to the
      // caller (see the reason strings below, which are clean/categorized).
      console.error(`[ollama-provider] Ollama returned HTTP ${response.status}:`, rawBody.slice(0, 2000));

      if (response.status === 404) {
        return { status: 'AI_UNAVAILABLE', reason: `Ollama model not found: "${model}". Run: ollama pull ${model}` };
      }
      // Matches the exact CUDA_Host/allocation failure this deployment has hit locally (GTX 1650,
      // 4GB VRAM) — surfaced as a clean, categorized reason instead of the raw llama-server crash
      // text, per the "never expose internal stack traces" requirement.
      if (/CUDA_Host|failed to allocate|llama-server process has terminated/i.test(rawBody)) {
        return {
          status: 'AI_UNAVAILABLE',
          reason: `Ollama failed to load model "${model}" — insufficient memory to allocate the model buffer on this machine. This is a local hardware/runtime limitation, not a code defect.`,
        };
      }
      return { status: 'AI_UNAVAILABLE', reason: `Ollama request failed (HTTP ${response.status}).` };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { status: 'AI_UNAVAILABLE', reason: 'Ollama returned a malformed (non-JSON) response.' };
    }
    if (typeof payload !== 'object' || payload === null) {
      return { status: 'AI_UNAVAILABLE', reason: 'Ollama returned a malformed response body.' };
    }

    const text = (payload as { response?: unknown }).response;
    if (!text || typeof text !== 'string') {
      return { status: 'AI_UNAVAILABLE', reason: 'Ollama returned no response text (empty generation).' };
    }

    // Reuses the exact same validator Claude's and Gemini's output goes through — provider-agnostic
    // (see response-parser.ts's own doc comment).
    return AIResponseParser.parseStructuredRemediation(text);
  }
}

export const ollamaProvider: AIRemediationProvider = {
  providerName: 'OLLAMA',
  generateRemediation: (request) => OllamaClient.generateRemediation(request),
};
