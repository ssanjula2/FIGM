import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');
const pagePath = path.join(rootDir, 'app/performance/page.tsx');

describe('REGRESSION GUARD: app/performance/page.tsx must never present scan-duration as FCP/TTI (docs/research/RQ1_EXPERIMENT_PROTOCOL.md Section 12)', () => {
  const source = fs.readFileSync(pagePath, 'utf-8');

  test('does not contain the retired fabricated FCP formula (avgDurationMs / 50 relabelled as FCP)', () => {
    assert.doesNotMatch(source, /0\.5 \+ \(avgDurationMs \/ 50\)/);
  });

  test('does not contain the retired fabricated TTI formula (avgDurationMs / 40 relabelled as TTI)', () => {
    assert.doesNotMatch(source, /0\.9 \+ \(avgDurationMs \/ 40\)/);
  });

  test('does not contain the retired fabricated LCP formula', () => {
    assert.doesNotMatch(source, /0\.7 \+ \(avgDurationMs \/ 45\)/);
  });

  test('never binds a computed/dynamic value directly under an FCP or TTI title (the old {title, value} metrics-card pattern)', () => {
    // The old fabrication shape was: { title: 'First Contentful Paint (FCP)', value: fcpValue, ... }
    // i.e. a metrics array mapping a *Value variable straight into a card. That pattern, and the
    // variables that fed it, must be gone entirely -- mentioning "FCP"/"TTI" in explanatory prose
    // (to say they have NOT been collected) is fine and expected; binding them to a computed
    // number is not.
    assert.doesNotMatch(source, /fcpValue/);
    assert.doesNotMatch(source, /ttiValue/);
    assert.doesNotMatch(source, /lcpValue/);
    assert.doesNotMatch(source, /const metrics = \[/);
  });

  test('the FCP/TTI mentions that remain are inside the explicit "not yet collected" explanation, not a metrics card', () => {
    assert.match(source, /Runtime FCP\/TTI Experiment: Not Yet Collected[\s\S]*First Contentful Paint \(FCP\)/);
  });

  test('explicitly labels the scan-duration figure as "Static Analysis Timing", not a browser metric', () => {
    assert.match(source, /Static Analysis Timing/);
  });

  test('explicitly states the runtime FCP/TTI experiment has not yet collected data', () => {
    assert.match(source, /Runtime FCP\/TTI Experiment: Not Yet Collected/);
    assert.match(source, /No real data-collection run has been executed yet|0 real RQ1 runs collected/);
  });

  test('references the real protocol document rather than implying an ad-hoc measurement', () => {
    assert.match(source, /RQ1_EXPERIMENT_PROTOCOL\.md/);
  });
});
