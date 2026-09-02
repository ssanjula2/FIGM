/**
 * Framework-Independent Guideline Model (FIGM)
 * AI Provider Selector — the ONE place that decides which Layer 2 AI backend is "active"
 *
 * src/ai/ai-remediation-pipeline.ts never reads OLLAMA_BASE_URL/OLLAMA_MODEL/ANTHROPIC_API_KEY/
 * GEMINI_API_KEY itself and never imports a specific provider directly — it asks this module for
 * "the active provider" (and, on a mid-remediation provider failure, "the fallback provider") and
 * calls whatever comes back. This is a deliberately static, environment-keyed decision (which
 * provider is CONFIGURED), analogous in spirit to AIRemediationRouter.route() (which deterministic
 * ENGINE, if any, owns a rule ID) — neither one inspects the actual violation/request.
 *
 * Default precedence for getActiveProvider(): local Ollama (OLLAMA_BASE_URL or OLLAMA_MODEL set) is
 * preferred when configured, since setting either variable is a deliberate, explicit
 * local-development opt-in — it can never happen by accident (see ollama-provider.ts's ACTIVATION
 * note: unset defaults alone never enable it, so a Vercel/production deployment that sets neither
 * variable is completely unaffected). Falling back to Claude (ANTHROPIC_API_KEY) so an existing
 * deployment that only configured Claude keeps working unchanged, then Gemini (GEMINI_API_KEY) —
 * the provider this deployment's .env actually provisions for hosted use (see ENV_VARIABLES.md) —
 * as the final default-precedence option for a deployment that configured only that. When none is
 * configured, a stub provider is returned that resolves AI_UNAVAILABLE immediately, with no network
 * call, exactly like every real provider's own "missing credential/config" short-circuit.
 *
 * AI_PRIMARY_PROVIDER / AI_FALLBACK_PROVIDER (both optional): explicit overrides for a deployment
 * that wants to pin exactly which provider serves first, and which one src/ai/ai-remediation-
 * pipeline.ts's retry loop switches to when the primary becomes unavailable mid-remediation (HTTP
 * 429, timeout, auth/config failure — never on a real code-quality rejection like PATCH_SCOPE
 * or an unresolved rescan, which stay on the SAME provider and use the existing retry-feedback
 * mechanism instead — see ai-remediation-pipeline.ts's own retry loop for that distinction). Only
 * ever used when they name a provider that is ACTUALLY configured (a typo or an unconfigured name
 * falls through to the default behavior below, never silently disabling a real deployment). When
 * AI_FALLBACK_PROVIDER is not set, getFallbackProvider() defaults to the first actually-configured
 * provider in CLAUDE → GEMINI → OLLAMA order, skipping whichever one IS the primary that just
 * failed — this covers every primary (not only Claude), so a deployment pinned to
 * AI_PRIMARY_PROVIDER=GEMINI or OLLAMA still gets a real fallback when a second provider is
 * configured, instead of going straight to AI_UNAVAILABLE.
 */

import { claudeProvider } from './providers/claude-provider.js';
import { geminiProvider } from './providers/gemini-provider.js';
import { ollamaProvider, OllamaClient } from './providers/ollama-provider.js';
import type { AIRemediationProvider, AIProviderName } from './providers/ai-remediation-provider.js';

const noProvider: AIRemediationProvider = {
  providerName: 'NONE',
  generateRemediation: async () => ({
    status: 'AI_UNAVAILABLE',
    reason:
      'No AI remediation provider is configured (set OLLAMA_BASE_URL/OLLAMA_MODEL for a local Ollama model, ANTHROPIC_API_KEY for Claude, or GEMINI_API_KEY for Gemini, as a server environment variable).',
  }),
};

/** Resolves a provider by NAME only when it is actually configured (never returns a provider whose
 *  own credential/config is missing) — the single place AI_PRIMARY_PROVIDER/AI_FALLBACK_PROVIDER
 *  are interpreted, shared by both explicit-override paths below. */
function resolveConfiguredProviderByName(name: string | undefined): AIRemediationProvider | undefined {
  switch ((name || '').trim().toUpperCase()) {
    case 'OLLAMA':
      return OllamaClient.isConfigured() ? ollamaProvider : undefined;
    case 'CLAUDE':
      return process.env.ANTHROPIC_API_KEY ? claudeProvider : undefined;
    case 'GEMINI':
      return process.env.GEMINI_API_KEY ? geminiProvider : undefined;
    default:
      return undefined;
  }
}

export class AIProviderSelector {
  /** True when at least one AI remediation provider is configured — used by callers (e.g. the
   *  health-check route) that want to report Layer 2 availability without actually invoking it. */
  public static isAnyProviderConfigured(): boolean {
    return OllamaClient.isConfigured() || !!process.env.ANTHROPIC_API_KEY || !!process.env.GEMINI_API_KEY;
  }

  /** Resolves the active (first-attempt) provider. AI_PRIMARY_PROVIDER, when set to a provider
   *  that is actually configured, takes explicit precedence over the default ordering below. See
   *  the module doc comment for the full precedence/override rules. */
  public static getActiveProvider(): AIRemediationProvider {
    const explicitPrimary = resolveConfiguredProviderByName(process.env.AI_PRIMARY_PROVIDER);
    if (explicitPrimary) {
      return explicitPrimary;
    }
    if (OllamaClient.isConfigured()) {
      return ollamaProvider;
    }
    if (process.env.ANTHROPIC_API_KEY) {
      return claudeProvider;
    }
    if (process.env.GEMINI_API_KEY) {
      return geminiProvider;
    }
    return noProvider;
  }

  /**
   * Resolves the fallback provider to switch to when `primary` reports a provider-AVAILABILITY
   * failure (never a code-quality one — see the module doc comment). AI_FALLBACK_PROVIDER, when set
   * to a DIFFERENT, actually-configured provider, is used explicitly. Otherwise falls through to a
   * default precedence — CLAUDE, then GEMINI, then OLLAMA — skipping whichever of those IS `primary`
   * and returning the first of the rest that is actually configured. This covers every primary, not
   * only CLAUDE: a live deployment pinned to AI_PRIMARY_PROVIDER=GEMINI with a working
   * ANTHROPIC_API_KEY also configured now genuinely falls back to Claude instead of going straight to
   * AI_UNAVAILABLE on a transient Gemini outage/quota exhaustion — previously this method only ever
   * special-cased primary === 'CLAUDE', so that exact live-pinned-Gemini configuration had no coded
   * fallback branch at all. OLLAMA is included in the default chain (last) since it is only ever
   * "configured" when a developer deliberately set OLLAMA_BASE_URL/OLLAMA_MODEL themselves — the
   * same explicit opt-in getActiveProvider() relies on to give it top precedence there. Returns
   * undefined when there is nothing safe to fall back to, including when the resolved fallback would
   * be the SAME provider that just failed (falling back to yourself is not a fallback) — the caller
   * (ai-remediation-pipeline.ts) treats undefined as "no further attempt is possible," never retries
   * the same failed provider under a different name, and never loops.
   */
  public static getFallbackProvider(primary: AIProviderName): AIRemediationProvider | undefined {
    const explicitFallback = resolveConfiguredProviderByName(process.env.AI_FALLBACK_PROVIDER);
    if (explicitFallback && explicitFallback.providerName !== primary) {
      return explicitFallback;
    }
    if (explicitFallback) {
      return undefined; // explicitly configured, but it names the SAME provider that just failed
    }
    for (const name of ['CLAUDE', 'GEMINI', 'OLLAMA'] as const) {
      if (name === primary) continue;
      const candidate = resolveConfiguredProviderByName(name);
      if (candidate) return candidate;
    }
    return undefined;
  }
}
