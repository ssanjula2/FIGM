import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractFcpTti, type MinimalLhr } from '../research/rq1-experiment/scripts/extract-metrics.js';

// Fixture LHR shapes below are hand-authored to match the real shape observed from a live
// Lighthouse 12.8.2 run (see docs/research/RQ1_EXPERIMENT_PROTOCOL.md Section 5/6's smoke-test
// evidence) -- these are deterministic test fixtures, not live measurements.

describe('RQ1 experiment: FCP/TTI extraction from a Lighthouse Result (LHR)', () => {
  test('extracts real numeric FCP and TTI from a well-formed LHR', () => {
    const lhr: MinimalLhr = {
      lighthouseVersion: '12.8.2',
      environment: { hostUserAgent: 'HeadlessChrome/152.0.0.0' },
      audits: {
        'first-contentful-paint': { numericValue: 828 },
        interactive: { numericValue: 839 },
      },
    };
    const result = extractFcpTti(lhr);
    assert.equal(result.fcpMs, 828);
    assert.equal(result.ttiMs, 839);
    assert.equal(result.browserVersion, 'HeadlessChrome/152.0.0.0');
    assert.equal(result.lighthouseVersion, '12.8.2');
  });

  test('throws (does not fall back to a placeholder) when first-contentful-paint is missing entirely', () => {
    const lhr: MinimalLhr = {
      audits: { interactive: { numericValue: 900 } },
    };
    assert.throws(() => extractFcpTti(lhr), /first-contentful-paint/);
  });

  test('throws when interactive (TTI) is missing entirely', () => {
    const lhr: MinimalLhr = {
      audits: { 'first-contentful-paint': { numericValue: 800 } },
    };
    assert.throws(() => extractFcpTti(lhr), /interactive/);
  });

  test('throws when first-contentful-paint numericValue is a string, not a number', () => {
    const lhr: MinimalLhr = {
      audits: {
        'first-contentful-paint': { numericValue: '800ms' as any },
        interactive: { numericValue: 900 },
      },
    };
    assert.throws(() => extractFcpTti(lhr));
  });

  test('throws when interactive numericValue is NaN', () => {
    const lhr: MinimalLhr = {
      audits: {
        'first-contentful-paint': { numericValue: 800 },
        interactive: { numericValue: NaN },
      },
    };
    assert.throws(() => extractFcpTti(lhr));
  });

  test('REGRESSION GUARD: never silently substitutes a different audit (LCP/TBT/INP) when interactive is absent', () => {
    // A hostile/malformed LHR that has every OTHER timing metric except interactive -- this must
    // still throw, not quietly pick one of these and call it TTI.
    const lhr: MinimalLhr = {
      audits: {
        'first-contentful-paint': { numericValue: 800 },
        // interactive intentionally absent
      } as any,
    };
    (lhr.audits as any)['largest-contentful-paint'] = { numericValue: 1200 };
    (lhr.audits as any)['total-blocking-time'] = { numericValue: 50 };
    (lhr.audits as any)['interaction-to-next-paint'] = { numericValue: 30 };

    assert.throws(() => extractFcpTti(lhr), /interactive/);
  });

  test('defaults browserVersion/lighthouseVersion to "unknown" rather than throwing when environment metadata is absent, but still requires the metrics themselves', () => {
    const lhr: MinimalLhr = {
      audits: {
        'first-contentful-paint': { numericValue: 500 },
        interactive: { numericValue: 700 },
      },
    };
    const result = extractFcpTti(lhr);
    assert.equal(result.browserVersion, 'unknown');
    assert.equal(result.lighthouseVersion, 'unknown');
  });
});
