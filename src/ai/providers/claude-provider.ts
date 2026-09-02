/**
 * Framework-Independent Guideline Model (FIGM)
 * Claude Provider — AIRemediationProvider adapter over the pre-existing ClaudeClient
 *
 * Deliberately a thin wrapper, not a rewrite: src/ai/claude-client.server.ts remains the one
 * server-only Claude integration boundary (API key handling, request shaping, error scrubbing) —
 * this file only adapts its existing static `generateRemediation` method to the
 * AIRemediationProvider shape so src/ai/ai-provider-selector.ts can hand it to the pipeline
 * interchangeably with GeminiClient/OllamaClient.
 */

import { ClaudeClient } from '../claude-client.server.js';
import type { AIRemediationProvider } from './ai-remediation-provider.js';

export const claudeProvider: AIRemediationProvider = {
  providerName: 'CLAUDE',
  generateRemediation: (request) => ClaudeClient.generateRemediation(request),
};
