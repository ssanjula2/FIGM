import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

/**
 * Regression coverage for Phase 7 closure: the saved-report "Apply Patch" button used to call
 * `alert(...)` and claim a patch was applied without taking any real action. A saved scan record
 * never persists the full original source file (only diagnostics + short snippets -- see
 * DBScanRecord in src/auth/user-db.ts), so there is no source here to genuinely patch and
 * re-verify. Per the closure brief's own fallback rule ("if the report detail page cannot safely
 * support patching, remove the fake button entirely"), the button was removed rather than faked
 * further. The real AI-fix-and-verify flow (AIRemediationPipeline) remains live-only, on the Live
 * Scan page where the full source is in memory -- see the `Apply fix` handler in
 * app/live-scan/page.tsx.
 */

test('reports/[id] page no longer contains a button that fakes applying a patch', () => {
  const filePath = path.join(rootDir, 'app/reports/[id]/page.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  assert.equal(
    /alert\(\s*`Applied patch/i.test(content),
    false,
    'the reports detail page must not claim a patch was applied via a bare alert()'
  );
  assert.equal(
    />\s*Apply Patch\s*</i.test(content),
    false,
    'the fake "Apply Patch" button must be removed, not merely relabeled'
  );
});

test('live-scan page still owns the real, verified apply-fix flow', () => {
  const filePath = path.join(rootDir, 'app/live-scan/page.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  assert.ok(content.includes('applyFix'), 'live-scan must retain its real applyFix handler');
  assert.ok(
    content.includes('AIRemediationPipeline'),
    'live-scan must document that fixes route through the real, server-verified remediation pipeline'
  );
});
