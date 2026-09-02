/**
 * Framework-Independent Guideline Model (FIGM)
 * AI Remediation Provider — the abstraction every Layer 2 AI backend implements
 *
 * src/ai/ai-remediation-pipeline.ts never talks to a specific AI vendor SDK directly; it talks to
 * whichever AIRemediationProvider src/ai/ai-provider-selector.ts hands it. This is what lets Gemini
 * (src/ai/providers/gemini-provider.ts) sit alongside Claude (src/ai/providers/claude-provider.ts,
 * wrapping the pre-existing src/ai/claude-client.server.ts) and a local Ollama model
 * (src/ai/providers/ollama-provider.ts) without any provider knowing the others exist, and without
 * the pipeline, sandbox validation, or response parsing changing at all.
 *
 * The request/result shapes are intentionally identical to the pre-existing
 * ClaudeRemediationRequest / ClaudeRemediationResult contract (src/ai/claude-client.server.ts) —
 * that contract was already provider-agnostic (see response-parser.ts's own doc comment), so this
 * interface just names it for reuse rather than inventing a new shape.
 */

import { DiagnosticReport } from '../../types/ast-spec.js';
import type { PreviousAttemptFeedback } from '../prompt-builder.js';
import type { StructuredRemediationResult } from '../response-parser.js';

export interface AIRemediationRequest {
  defect: DiagnosticReport;
  code: string;
  framework: string;
  /** Present only on a retry — see AIPromptBuilder.buildUserContent. */
  previousAttempt?: PreviousAttemptFeedback;
}

/** PATCH | DECLINE | AI_UNAVAILABLE — see response-parser.ts's StructuredRemediationResult for the
 *  authoritative, provider-agnostic definition. */
export type AIRemediationProviderResult = StructuredRemediationResult;

/** 'NONE' names the no-op stub provider (src/ai/ai-provider-selector.ts's `noProvider`) returned
 *  when none of OLLAMA_BASE_URL/OLLAMA_MODEL, ANTHROPIC_API_KEY, or GEMINI_API_KEY is configured —
 *  a real, honest "no AI backend was even attempted" state, deliberately distinct from any real
 *  provider's name. */
export type AIProviderName = 'CLAUDE' | 'OLLAMA' | 'GEMINI' | 'NONE';

export interface AIRemediationProvider {
  /** Surfaced in pipeline results/logs (see AIRemediationPipelineResult['provider']) so "which AI
   *  actually produced/attempted this fix" is always answerable — never inferred from engineType
   *  alone, which is deliberately provider-neutral. */
  readonly providerName: AIProviderName;
  /**
   * Requests a single remediation attempt. Must never throw — every failure mode (missing/invalid
   * credentials, network error, timeout, rate limit, safety refusal, malformed output) is caught
   * internally and mapped to `{ status: 'AI_UNAVAILABLE', reason }`. Approves nothing: the caller
   * (AIRemediationPipeline) always runs any returned PATCH through the full sandbox validation
   * pipeline before it can ever be applied.
   */
  generateRemediation(request: AIRemediationRequest): Promise<AIRemediationProviderResult>;
}
