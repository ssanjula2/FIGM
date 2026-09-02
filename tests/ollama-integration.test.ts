import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceParser } from '../src/parser/source-parser.js';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine.js';
import { AIRemediationPipeline } from '../src/ai/ai-remediation-pipeline.js';
import { AIRemediationRouter } from '../src/ai/ai-remediation-router.js';

/**
 * REAL local Ollama end-to-end integration test — run via `npm run test:ollama`, which loads
 * .env.local (so OLLAMA_BASE_URL/OLLAMA_MODEL are actually available) before invoking this file,
 * unlike the main `npm test` run (which deliberately does not touch a real local server — see
 * tests/ollama-provider.test.ts for the mocked-boundary unit coverage that runs as part of the
 * normal suite). Mirrors tests/claude-integration.test.ts / tests/gemini-integration.test.ts.
 *
 * This makes a REAL HTTP call to the REAL local Ollama server through the exact same
 * AIRemediationPipeline.remediateDefect() the live product calls — no test-only fix path. It does
 * NOT assert the AI's patch must be approved, or even that Ollama must respond successfully: real
 * local model output is inherently variable, and this deployment has a REPRODUCED local hardware
 * limitation (insufficient GPU/CPU memory to load qwen2.5-coder:7b on this machine) that can make
 * every real attempt legitimately resolve to AI_UNAVAILABLE. Asserting "always approved" would
 * either be flaky or, worse, tempt weakening validation to make it pass. What this DOES assert is
 * that a genuine attempt was made (never silently short-circuited by missing config or an
 * accidental Layer-1/other-provider route) and that the pipeline returned one of its real, defined
 * outcomes — never a fabricated PASS.
 *
 * If neither OLLAMA_BASE_URL nor OLLAMA_MODEL is configured when this runs, the test reports
 * SKIPPED via node:test's own skip mechanism.
 */

const hasOllamaConfig = !!process.env.OLLAMA_BASE_URL || !!process.env.OLLAMA_MODEL;

// src/ai/ai-provider-selector.ts prefers Ollama over Claude/Gemini whenever OLLAMA_BASE_URL or
// OLLAMA_MODEL is set, so this delete is only defense-in-depth (Ollama already wins precedence) --
// kept for symmetry with claude-integration.test.ts's own force-disable of the higher-precedence
// provider, and so this test still exercises Ollama specifically even if selector precedence ever
// changes.
delete process.env.ANTHROPIC_API_KEY;

test(
  'REAL local Ollama end-to-end AI remediation (FIGM-REACT-01, an AI_ASSISTED rule)',
  {
    skip: !hasOllamaConfig ? 'OLLAMA_BASE_URL/OLLAMA_MODEL not configured in this environment — real Ollama integration not verified in this run.' : false,
    timeout: 150_000,
  },
  async () => {
    const code = `function List({ items }) {\n  const sorted = items.sort((a, b) => a - b);\n  return <ul>{sorted.map((n) => <li key={n}>{n}</li>)}</ul>;\n}`;
    const filePath = 'List.jsx';
    const parsed = SourceParser.parseSource(code, filePath);
    const diags = ASTDetectionEngine.evaluateNode(parsed.ast!, filePath, parsed.framework);
    const defect = diags.find((d) => d.ruleId === 'FIGM-REACT-01');
    assert.ok(defect, 'FIGM-REACT-01 must be detected on this fixture by the real detection pipeline');

    const routing = AIRemediationRouter.route(defect!.ruleId);
    assert.equal(routing.route, 'AI_ASSISTED', 'FIGM-REACT-01 must route to the AI-assisted layer — otherwise this test would not actually exercise Ollama');

    const result = await AIRemediationPipeline.remediateDefect(code, defect!, parsed.framework);

    // Never assert the config path is what happened — this must be a REAL attempt.
    assert.notEqual(
      result.fallbackReason?.includes('OLLAMA_BASE_URL / OLLAMA_MODEL environment variable is not configured'),
      true,
      'Ollama was reported as configured, so a real call must have been attempted, not short-circuited'
    );
    assert.ok(
      ['AST_DETERMINISTIC_FIX', 'AI_ASSISTED_FIX', 'MANUAL_REVIEW', 'UNAVAILABLE'].includes(result.engineType),
      `engineType must be one of the pipeline's real, defined outcomes, got: ${result.engineType}`
    );
    assert.ok(
      ['FIXED', 'PATCH_REJECTED', 'UNRESOLVED', 'MANUAL_REVIEW_REQUIRED', 'AI_UNAVAILABLE'].includes(result.verificationStatus),
      `verificationStatus must be one of the pipeline's real, defined outcomes, got: ${result.verificationStatus}`
    );
    if (result.engineType === 'AI_ASSISTED_FIX' || result.provider) {
      assert.equal(result.provider, 'OLLAMA', 'Ollama was the configured provider — the AI-assisted path must have been served by Ollama, not Claude');
    }

    // eslint-disable-next-line no-console
    console.log(
      '[REAL OLLAMA E2E RESULT]',
      JSON.stringify(
        { engineType: result.engineType, provider: result.provider, verified: result.verified, verificationStatus: result.verificationStatus, confidenceScore: result.confidenceScore, fallbackReason: result.fallbackReason },
        null,
        2
      )
    );
  }
);
