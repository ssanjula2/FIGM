import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

/**
 * EXT-01 (research-collection-build hardening, docs/audit/RESEARCH_COLLECTION_BUILD_FINALIZATION.md):
 * the VS Code extension previously described itself ("AST Quality & Accessibility Engine",
 * "AI remediation", "Powered by FIGM Code Inspector AST Engine") as running FIGM's real canonical
 * engine, when its actual implementation (diagnostics-provider.ts's analyzeDocument) is plain
 * client-side line-text heuristic matching covering only 5 of the 50 canonical rules, with no AI
 * involvement anywhere in the extension. This file guards two things going forward: (1) the exact
 * set of rule IDs the implementation actually checks stays in sync with what README.md documents
 * as its supported scope, and (2) none of the specific overclaim phrases already found and removed
 * are silently reintroduced. Follows this repo's existing convention (see
 * tests/vscode-score-consistency.test.ts) of reading the extension's .ts/.json/.md source as text
 * rather than importing it -- the extension is a standalone package with its own tsconfig rootDir
 * and a `vscode` module dependency unavailable outside the extension host.
 */

function readExtensionFile(relativePath: string): string {
  return fs.readFileSync(path.join(rootDir, 'vscode-extension', relativePath), 'utf-8');
}

test('diagnostics-provider.ts checks exactly the 5 rule IDs it claims to, no more, no fewer', () => {
  const content = readExtensionFile('src/diagnostics-provider.ts');
  const ruleIdMatches = [...content.matchAll(/addDiag\(diagnostics, index, lineText, '(FIGM-[A-Z0-9-]+)'/g)];
  const actualRuleIds = new Set(ruleIdMatches.map((m) => m[1]));

  const documentedRuleIds = new Set(['FIGM-REACT-02', 'FIGM-PERF-05', 'FIGM-PERF-02', 'FIGM-A11Y-01', 'FIGM-PERF-04']);

  assert.deepEqual(
    actualRuleIds,
    documentedRuleIds,
    'the exact set of rule IDs checked by analyzeDocument must match this test\'s documented set -- ' +
      'update BOTH this test and README.md\'s scope table together if the implementation changes'
  );
});

test("README.md's documented rule scope table matches the same 5 rule IDs", () => {
  const readme = readExtensionFile('README.md');
  const documentedInReadme = new Set([...readme.matchAll(/`(FIGM-[A-Z0-9-]+)`/g)].map((m) => m[1]));
  const expected = new Set(['FIGM-REACT-02', 'FIGM-PERF-05', 'FIGM-PERF-02', 'FIGM-A11Y-01', 'FIGM-PERF-04']);

  for (const ruleId of expected) {
    assert.ok(documentedInReadme.has(ruleId), `README.md must document ${ruleId} as part of its supported scope`);
  }
});

test('the extension never claims to run AST analysis, the full FIGM engine, or AI remediation', () => {
  const filesToCheck = [
    'package.json',
    'README.md',
    'src/diagnostics-provider.ts',
    'src/hover-provider.ts',
    'src/quickfix-provider.ts',
    'src/extension.ts',
    'src/commands.ts',
  ];

  // Phrases that would misrepresent this extension as running FIGM's real, canonical AST engine
  // or performing AI-assisted remediation -- neither of which this extension does. Checked
  // case-insensitively as plain substrings, deliberately narrow (not "ast" alone, which appears
  // legitimately in unrelated words) to avoid false positives while still catching the exact
  // overclaim phrasing this audit found and removed.
  const forbiddenPhrases = [
    'ast quality & accessibility engine',
    'ast engine',
    'ai remediation',
    'ai-powered remediation',
    'full figm engine',
    'canonical engine', // the extension's OWN description of itself, not a reference to it existing elsewhere
    '50-rule engine',
    '50 rule engine',
  ];

  for (const relativePath of filesToCheck) {
    const content = readExtensionFile(relativePath).toLowerCase();
    for (const phrase of forbiddenPhrases) {
      assert.equal(
        content.includes(phrase),
        false,
        `${relativePath} must not contain the overclaim phrase "${phrase}" -- this extension is a ` +
          '5-rule lightweight preview, not FIGM\'s canonical AST engine, and performs no AI remediation'
      );
    }
  }
});

test('package.json displayName/description honestly frame this as a lightweight preview', () => {
  const pkg = JSON.parse(readExtensionFile('package.json'));
  const combined = `${pkg.displayName} ${pkg.description}`.toLowerCase();
  assert.ok(
    combined.includes('lightweight') || combined.includes('preview'),
    'package.json displayName/description must signal this is a lightweight preview, not the full engine'
  );
});
