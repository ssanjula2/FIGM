import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateQualityScoreFromCounts, SeverityCounts } from '../src/engine/quality-score';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

/**
 * Regression coverage for Phase 9 closure: the VS Code extension's diagnostics-provider.ts used to
 * compute `100 - diagnostics.length * 5` (flat per-issue penalty), independent of the canonical
 * severity-weighted formula (src/engine/quality-score.ts). Given the same diagnostics, the two
 * would disagree on the quality score. The extension is a standalone-published package that
 * cannot import src/engine/quality-score.ts directly (its tsconfig rootDir is vscode-extension/src
 * only), so its copy of the SEVERITY_WEIGHT constant and formula must be kept byte-identical by
 * hand -- this test is the guard that catches drift instead of relying on a shared import.
 */

test('vscode-extension no longer uses the old flat count*5 score formula', () => {
  const content = fs.readFileSync(path.join(rootDir, 'vscode-extension/src/diagnostics-provider.ts'), 'utf-8');
  assert.equal(
    /100\s*-\s*diagnostics\.length\s*\*\s*5/.test(content),
    false,
    'the flat, severity-blind score formula must not be reintroduced'
  );
});

test("vscode-extension's SEVERITY_WEIGHT constant matches the canonical weights exactly", () => {
  const content = fs.readFileSync(path.join(rootDir, 'vscode-extension/src/diagnostics-provider.ts'), 'utf-8');
  const match = content.match(/SEVERITY_WEIGHT:\s*Record<string,\s*number>\s*=\s*(\{[^}]*\})/);
  assert.ok(match, 'expected a SEVERITY_WEIGHT constant declaration in diagnostics-provider.ts');

  // eslint-disable-next-line no-eval -- reading a literal object out of a trusted, checked-in source file
  const extensionWeights = eval(`(${match![1]})`);
  const canonical: SeverityCounts = { criticalCount: 1, highCount: 0, mediumCount: 0, lowCount: 0 };
  const canonicalWeights = {
    CRITICAL: 100 - calculateQualityScoreFromCounts({ ...canonical, criticalCount: 1, highCount: 0, mediumCount: 0, lowCount: 0 }),
    HIGH: 100 - calculateQualityScoreFromCounts({ criticalCount: 0, highCount: 1, mediumCount: 0, lowCount: 0 }),
    MEDIUM: 100 - calculateQualityScoreFromCounts({ criticalCount: 0, highCount: 0, mediumCount: 1, lowCount: 0 }),
    LOW: 100 - calculateQualityScoreFromCounts({ criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 1 }),
  };

  assert.deepEqual(extensionWeights, canonicalWeights, 'vscode-extension SEVERITY_WEIGHT must exactly match src/engine/quality-score.ts');
});

test('given the same diagnostics (by severity), the canonical formula and the extension formula compute the same score', () => {
  // Simulates the shape diagnostics-provider.ts reduces over: a mix of severities.
  const scenarios: Array<{ counts: SeverityCounts }> = [
    { counts: { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 } },
    { counts: { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 3 } },
    { counts: { criticalCount: 0, highCount: 2, mediumCount: 1, lowCount: 0 } },
    { counts: { criticalCount: 1, highCount: 1, mediumCount: 1, lowCount: 1 } },
    { counts: { criticalCount: 10, highCount: 10, mediumCount: 10, lowCount: 10 } }, // exercises the floor at 0
  ];

  const content = fs.readFileSync(path.join(rootDir, 'vscode-extension/src/diagnostics-provider.ts'), 'utf-8');
  const match = content.match(/SEVERITY_WEIGHT:\s*Record<string,\s*number>\s*=\s*(\{[^}]*\})/)!;
  // eslint-disable-next-line no-eval
  const extensionWeights: Record<string, number> = eval(`(${match[1]})`);

  const extensionFormula = (counts: SeverityCounts) => {
    const penalty =
      counts.criticalCount * extensionWeights.CRITICAL +
      counts.highCount * extensionWeights.HIGH +
      counts.mediumCount * extensionWeights.MEDIUM +
      counts.lowCount * extensionWeights.LOW;
    return Math.max(0, 100 - penalty);
  };

  for (const { counts } of scenarios) {
    assert.equal(
      extensionFormula(counts),
      calculateQualityScoreFromCounts(counts),
      `score for counts=${JSON.stringify(counts)} must match between the extension and the canonical engine`
    );
  }
});
