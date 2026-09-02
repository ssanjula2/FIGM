import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

/**
 * Regression coverage for Phase 24 closure: README.md, VIVA_PREPARATION_GUIDE.md, and
 * DISSERTATION_DEMO_GUIDE.md claimed Supabase Realtime pushes live notification/scan-completion
 * events to the dashboard. RealtimeService (src/storage/realtime-service.ts) and useRealtime
 * (src/hooks/useRealtime.ts) are real, but grep confirms no page under app/ ever imports either --
 * the feature is implemented but never wired into any UI, so nothing live is actually shown to a
 * user. This guard fails if either the source stays unused while docs claim it's active, or a doc
 * regresses back to an unqualified "live/realtime" claim.
 */

test('no page under app/ actually uses RealtimeService or useRealtime yet', () => {
  // If this ever starts failing because a page DOES use it now, that's good news -- the fix is to
  // update this test (and the docs it's guarding) to reflect the real, newly-wired feature, not to
  // keep this assertion passing artificially.
  const appDir = path.join(rootDir, 'app');
  const files: string[] = [];
  (function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) files.push(full);
    }
  })(appDir);

  const usesRealtime = files.some((f) => /RealtimeService|useRealtime/.test(fs.readFileSync(f, 'utf-8')));
  assert.equal(usesRealtime, false, 'RealtimeService/useRealtime is now used somewhere under app/ -- update the docs this test guards to describe the real, wired-up feature instead of "not yet wired"');
});

test('README.md does not claim Realtime updates are live without the not-yet-wired disclaimer', () => {
  const content = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf-8');
  assert.doesNotMatch(content, /\*\*Real-Time WebSocket Updates\*\*: Supabase Realtime integration for live notifications/);
  assert.match(content, /not yet wired into the UI/i);
});

test('VIVA_PREPARATION_GUIDE.md and DISSERTATION_DEMO_GUIDE.md disclose that Realtime is unwired', () => {
  for (const doc of ['VIVA_PREPARATION_GUIDE.md', 'DISSERTATION_DEMO_GUIDE.md']) {
    const content = fs.readFileSync(path.join(rootDir, doc), 'utf-8');
    assert.match(content, /not (yet )?wired/i, `${doc} must disclose that Realtime is implemented but not wired into any page`);
  }
});
