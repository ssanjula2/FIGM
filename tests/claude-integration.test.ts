import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceParser } from '../src/parser/source-parser.js';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine.js';
import { AIRemediationPipeline } from '../src/ai/ai-remediation-pipeline.js';
import { AIRemediationRouter } from '../src/ai/ai-remediation-router.js';

/**
 * REAL Claude end-to-end integration test — run via `npm run test:claude`, which loads
 * .env.local (so ANTHROPIC_API_KEY is actually available) before invoking this file, unlike the
 * main `npm test` run (which deliberately does not touch real secrets — see
 * tests/claude-client.test.ts for the mocked-boundary unit coverage that runs as part of the
 * normal suite).
 *
 * This makes a REAL network call to the REAL Claude API through the exact same
 * AIRemediationPipeline.remediateDefect() the live product calls — no test-only fix path. It does
 * NOT assert the AI's patch must be approved: real model output is inherently variable run to run,
 * and asserting "always approved" would either be flaky or, worse, tempt weakening validation to
 * make it pass. What it DOES assert is that a genuine attempt was made (never silently short-
 * circuited by a missing key or an accidental Layer-1 route) and that the pipeline returned one of
 * its real, defined outcomes.
 *
 * If ANTHROPIC_API_KEY is not configured when this runs, the test reports SKIPPED via node:test's
 * own skip mechanism — never a fabricated PASS.
 */

const hasRealKey = !!process.env.ANTHROPIC_API_KEY;

// src/ai/ai-provider-selector.ts prefers Ollama (OLLAMA_BASE_URL/OLLAMA_MODEL) over Claude
// (ANTHROPIC_API_KEY) whenever both are configured — which is exactly the case for the
// `.env.local` this test's own npm script (test:claude) loads (see ENV_VARIABLES.md). This test's
// entire purpose is to exercise the REAL Claude provider specifically, so Ollama is force-disabled
// for the duration of this file only — never touches the real environment `.env.local` sets for any
// other script/test.
delete process.env.OLLAMA_BASE_URL;
delete process.env.OLLAMA_MODEL;

test(
  'REAL Claude end-to-end AI remediation (FIGM-REACT-01, an AI_ASSISTED rule)',
  { skip: !hasRealKey ? 'ANTHROPIC_API_KEY not configured in this environment — real Claude integration not verified in this run.' : false, timeout: 120_000 },
  async () => {
    const code = `function List({ items }) {\n  const sorted = items.sort((a, b) => a - b);\n  return <ul>{sorted.map((n) => <li key={n}>{n}</li>)}</ul>;\n}`;
    const filePath = 'List.jsx';
    const parsed = SourceParser.parseSource(code, filePath);
    const diags = ASTDetectionEngine.evaluateNode(parsed.ast!, filePath, parsed.framework);
    const defect = diags.find((d) => d.ruleId === 'FIGM-REACT-01');
    assert.ok(defect, 'FIGM-REACT-01 must be detected on this fixture by the real detection pipeline');

    const routing = AIRemediationRouter.route(defect!.ruleId);
    assert.equal(routing.route, 'AI_ASSISTED', 'FIGM-REACT-01 must route to the AI-assisted layer — otherwise this test would not actually exercise Claude');

    const result = await AIRemediationPipeline.remediateDefect(code, defect!, parsed.framework);

    // Never assert the key/config path is what happened — this must be a REAL attempt.
    assert.notEqual(
      result.fallbackReason?.includes('ANTHROPIC_API_KEY environment variable is not configured'),
      true,
      'ANTHROPIC_API_KEY was reported as configured, so a real call must have been attempted, not short-circuited'
    );
    assert.ok(
      ['AST_DETERMINISTIC_FIX', 'AI_ASSISTED_FIX', 'MANUAL_REVIEW', 'UNAVAILABLE'].includes(result.engineType),
      `engineType must be one of the pipeline's real, defined outcomes, got: ${result.engineType}`
    );
    assert.ok(
      ['FIXED', 'PATCH_REJECTED', 'UNRESOLVED', 'MANUAL_REVIEW_REQUIRED', 'AI_UNAVAILABLE'].includes(result.verificationStatus),
      `verificationStatus must be one of the pipeline's real, defined outcomes, got: ${result.verificationStatus}`
    );
    if (result.engineType === 'AI_ASSISTED_FIX') {
      // OLLAMA_BASE_URL/OLLAMA_MODEL are deleted above specifically so this assertion proves Claude
      // was actually the provider that ran, in an environment (.env.local) that may also configure Ollama.
      assert.equal(result.provider, 'CLAUDE', 'Ollama was force-disabled above — the AI-assisted path must have been served by Claude');
    }

    // eslint-disable-next-line no-console
    console.log(
      '[REAL CLAUDE E2E RESULT]',
      JSON.stringify({ engineType: result.engineType, provider: result.provider, verified: result.verified, verificationStatus: result.verificationStatus, confidenceScore: result.confidenceScore }, null, 2)
    );
  }
);
