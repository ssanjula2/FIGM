import test from 'node:test';
import assert from 'node:assert/strict';
import { AIProviderSelector } from '../src/ai/ai-provider-selector.js';

/**
 * Unit coverage for src/ai/ai-provider-selector.ts — the ONE place that decides which Layer 2 AI
 * backend (Ollama, Claude, Gemini, or neither) is active, purely from environment configuration.
 * Never calls a real provider; only asserts routing/precedence and the no-network-call
 * "unconfigured" short-circuit.
 */

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const originals: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) originals[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(originals)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// Every test below explicitly clears OLLAMA_BASE_URL/OLLAMA_MODEL unless a test is specifically
// exercising Ollama precedence — otherwise a developer's own .env.local (which sets these for
// local development) would leak into this file's assertions about Claude/Gemini/none.
const NO_OLLAMA = { OLLAMA_BASE_URL: undefined, OLLAMA_MODEL: undefined };

test('AIProviderSelector', async (t) => {
  await t.test('prefers Ollama when OLLAMA_MODEL is configured, even if ANTHROPIC_API_KEY and GEMINI_API_KEY are also set', () => {
    withEnv({ OLLAMA_BASE_URL: undefined, OLLAMA_MODEL: 'qwen2.5-coder:7b', ANTHROPIC_API_KEY: 'sk-ant-test', GEMINI_API_KEY: 'gm_test' }, () => {
      const provider = AIProviderSelector.getActiveProvider();
      assert.equal(provider.providerName, 'OLLAMA');
    });
  });

  await t.test('prefers Ollama when only OLLAMA_BASE_URL is configured (OLLAMA_MODEL defaults)', () => {
    withEnv({ OLLAMA_BASE_URL: 'http://127.0.0.1:11434', OLLAMA_MODEL: undefined, ANTHROPIC_API_KEY: 'sk-ant-test', GEMINI_API_KEY: 'gm_test' }, () => {
      const provider = AIProviderSelector.getActiveProvider();
      assert.equal(provider.providerName, 'OLLAMA');
    });
  });

  await t.test('prefers Claude when ANTHROPIC_API_KEY is configured and Ollama is not, even if GEMINI_API_KEY is also set', () => {
    withEnv({ ...NO_OLLAMA, ANTHROPIC_API_KEY: 'sk-ant-test', GEMINI_API_KEY: 'gm_test' }, () => {
      const provider = AIProviderSelector.getActiveProvider();
      assert.equal(provider.providerName, 'CLAUDE');
    });
  });

  await t.test('falls back to Gemini when only GEMINI_API_KEY is configured', () => {
    withEnv({ ...NO_OLLAMA, ANTHROPIC_API_KEY: undefined, GEMINI_API_KEY: 'gm_test' }, () => {
      const provider = AIProviderSelector.getActiveProvider();
      assert.equal(provider.providerName, 'GEMINI');
    });
  });

  await t.test('selects Claude when only ANTHROPIC_API_KEY is configured', () => {
    withEnv({ ...NO_OLLAMA, ANTHROPIC_API_KEY: 'sk-ant-test', GEMINI_API_KEY: undefined }, () => {
      const provider = AIProviderSelector.getActiveProvider();
      assert.equal(provider.providerName, 'CLAUDE');
    });
  });

  await t.test('returns a no-op provider that resolves AI_UNAVAILABLE with no network call when none is configured', async () => {
    await withEnv({ ...NO_OLLAMA, ANTHROPIC_API_KEY: undefined, GEMINI_API_KEY: undefined }, async () => {
      const provider = AIProviderSelector.getActiveProvider();
      assert.equal(provider.providerName, 'NONE');
      const result = await provider.generateRemediation({
        defect: {
          ruleId: 'FIGM-REACT-01',
          ruleName: 'test',
          domain: 'PERFORMANCE',
          concern: 'ARCHITECTURE',
          severity: 'MEDIUM',
          filePath: 'x.tsx',
          location: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
          offendingCodeSnippet: 'x',
          message: 'n/a',
          remediation: 'n/a',
          standardReference: 'n/a',
        } as any,
        code: 'const x = 1;',
        framework: 'REACT_JSX',
      });
      assert.equal(result.status, 'AI_UNAVAILABLE');
      assert.ok('reason' in result && result.reason.includes('OLLAMA_BASE_URL'));
      assert.ok('reason' in result && result.reason.includes('ANTHROPIC_API_KEY'));
      assert.ok('reason' in result && result.reason.includes('GEMINI_API_KEY'));
    });
  });

  await t.test('isAnyProviderConfigured mirrors getActiveProvider precedence', () => {
    withEnv({ ...NO_OLLAMA, ANTHROPIC_API_KEY: undefined, GEMINI_API_KEY: undefined }, () => {
      assert.equal(AIProviderSelector.isAnyProviderConfigured(), false);
    });
    withEnv({ OLLAMA_BASE_URL: undefined, OLLAMA_MODEL: 'qwen2.5-coder:7b', ANTHROPIC_API_KEY: undefined, GEMINI_API_KEY: undefined }, () => {
      assert.equal(AIProviderSelector.isAnyProviderConfigured(), true);
    });
    withEnv({ ...NO_OLLAMA, ANTHROPIC_API_KEY: 'sk-ant-test', GEMINI_API_KEY: undefined }, () => {
      assert.equal(AIProviderSelector.isAnyProviderConfigured(), true);
    });
    withEnv({ ...NO_OLLAMA, ANTHROPIC_API_KEY: undefined, GEMINI_API_KEY: 'gm_test' }, () => {
      assert.equal(AIProviderSelector.isAnyProviderConfigured(), true, 'GEMINI_API_KEY alone must also count as "some provider configured"');
    });
  });

  // ── Gemini as the last-resort default and as the Claude fallback ───────────────────────────
  const NO_AI_ENV = { ...NO_OLLAMA, ANTHROPIC_API_KEY: undefined, GEMINI_API_KEY: undefined, AI_PRIMARY_PROVIDER: undefined, AI_FALLBACK_PROVIDER: undefined };

  await t.test('getActiveProvider: Gemini is the last-resort default when only GEMINI_API_KEY is configured', () => {
    withEnv({ ...NO_AI_ENV, GEMINI_API_KEY: 'gm_test' }, () => {
      assert.equal(AIProviderSelector.getActiveProvider().providerName, 'GEMINI');
    });
  });

  await t.test('getActiveProvider: Gemini does NOT outrank Ollama/Claude in the default precedence', () => {
    withEnv({ ...NO_AI_ENV, ANTHROPIC_API_KEY: 'sk-ant-test', GEMINI_API_KEY: 'gm_test' }, () => {
      assert.equal(AIProviderSelector.getActiveProvider().providerName, 'CLAUDE', 'Claude must still win over Gemini when both are configured and no explicit override is set');
    });
  });

  await t.test('AI_PRIMARY_PROVIDER explicitly overrides the default precedence when it names an ACTUALLY configured provider', () => {
    withEnv({ ...NO_AI_ENV, ANTHROPIC_API_KEY: 'sk-ant-test', GEMINI_API_KEY: 'gm_test', AI_PRIMARY_PROVIDER: 'GEMINI' }, () => {
      assert.equal(AIProviderSelector.getActiveProvider().providerName, 'GEMINI', 'an explicit, actually-configured AI_PRIMARY_PROVIDER must win over the default (which would otherwise pick Claude)');
    });
  });

  await t.test('AI_PRIMARY_PROVIDER is ignored (falls through to default precedence) when it names a provider that is NOT actually configured', () => {
    withEnv({ ...NO_AI_ENV, ANTHROPIC_API_KEY: 'sk-ant-test', AI_PRIMARY_PROVIDER: 'GEMINI' }, () => {
      // AI_PRIMARY_PROVIDER names Gemini, but GEMINI_API_KEY is not set -- must never silently
      // disable a real deployment by pointing at an unconfigured provider.
      assert.equal(AIProviderSelector.getActiveProvider().providerName, 'CLAUDE');
    });
  });

  await t.test('getFallbackProvider: defaults to Gemini for a CLAUDE primary when GEMINI_API_KEY is configured and no explicit override is set', () => {
    withEnv({ ...NO_AI_ENV, ANTHROPIC_API_KEY: 'sk-ant-test', GEMINI_API_KEY: 'gm_test' }, () => {
      const fallback = AIProviderSelector.getFallbackProvider('CLAUDE');
      assert.equal(fallback?.providerName, 'GEMINI');
    });
  });

  await t.test('getFallbackProvider: returns undefined for a CLAUDE primary when GEMINI_API_KEY is not configured (nothing safe to fall back to)', () => {
    withEnv({ ...NO_AI_ENV, ANTHROPIC_API_KEY: 'sk-ant-test' }, () => {
      assert.equal(AIProviderSelector.getFallbackProvider('CLAUDE'), undefined);
    });
  });

  await t.test('getFallbackProvider: GEMINI primary falls back to CLAUDE by default when ANTHROPIC_API_KEY is configured', () => {
    withEnv({ ...NO_AI_ENV, ANTHROPIC_API_KEY: 'sk-ant-test', GEMINI_API_KEY: 'gm_test' }, () => {
      const fallback = AIProviderSelector.getFallbackProvider('GEMINI');
      assert.equal(fallback?.providerName, 'CLAUDE', 'a live deployment pinned to GEMINI primary must still have a real fallback when Claude is also configured');
    });
  });

  await t.test('getFallbackProvider: GEMINI primary returns undefined when CLAUDE is not configured (nothing safe to fall back to)', () => {
    withEnv({ ...NO_AI_ENV, GEMINI_API_KEY: 'gm_test' }, () => {
      assert.equal(AIProviderSelector.getFallbackProvider('GEMINI'), undefined);
    });
  });

  await t.test('getFallbackProvider: OLLAMA primary falls back to CLAUDE (then GEMINI) by default', () => {
    withEnv({ OLLAMA_BASE_URL: 'http://127.0.0.1:11434', OLLAMA_MODEL: undefined, ANTHROPIC_API_KEY: undefined, GEMINI_API_KEY: 'gm_test', AI_PRIMARY_PROVIDER: undefined, AI_FALLBACK_PROVIDER: undefined }, () => {
      const fallback = AIProviderSelector.getFallbackProvider('OLLAMA');
      assert.equal(fallback?.providerName, 'GEMINI', 'Claude is not configured in this scenario, so the next default-order provider (Gemini) is used');
    });
    withEnv({ OLLAMA_BASE_URL: 'http://127.0.0.1:11434', OLLAMA_MODEL: undefined, ANTHROPIC_API_KEY: 'sk-ant-test', GEMINI_API_KEY: 'gm_test', AI_PRIMARY_PROVIDER: undefined, AI_FALLBACK_PROVIDER: undefined }, () => {
      const fallback = AIProviderSelector.getFallbackProvider('OLLAMA');
      assert.equal(fallback?.providerName, 'CLAUDE', 'Claude outranks Gemini in the default fallback order when both are configured');
    });
  });

  await t.test('AI_FALLBACK_PROVIDER explicitly overrides the default Claude→Gemini pairing', () => {
    withEnv({ OLLAMA_BASE_URL: 'http://127.0.0.1:11434', OLLAMA_MODEL: undefined, ANTHROPIC_API_KEY: 'sk-ant-test', GEMINI_API_KEY: 'gm_test', AI_PRIMARY_PROVIDER: undefined, AI_FALLBACK_PROVIDER: 'OLLAMA' }, () => {
      const fallback = AIProviderSelector.getFallbackProvider('CLAUDE');
      assert.equal(fallback?.providerName, 'OLLAMA', 'an explicit AI_FALLBACK_PROVIDER must win over the default Gemini pairing');
    });
  });

  await t.test('getFallbackProvider never returns the SAME provider that just failed, even if misconfigured to do so', () => {
    withEnv({ ...NO_AI_ENV, ANTHROPIC_API_KEY: 'sk-ant-test', AI_FALLBACK_PROVIDER: 'CLAUDE' }, () => {
      assert.equal(AIProviderSelector.getFallbackProvider('CLAUDE'), undefined, 'falling back to yourself is not a fallback');
    });
  });
});
