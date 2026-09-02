/**
 * Pure extraction of FCP/TTI numericValue from a Lighthouse Result (LHR) object -- kept here,
 * tested directly (tests/rq1-experiment-metrics-extraction.test.ts), as the documented,
 * type-checked specification of this extraction contract (which fields, which validation, which
 * errors). NOT imported by the actual runtime measurement path: lighthouse-worker.mjs (a
 * deliberately plain-JS, non-tsx-transformed subprocess -- see its own header comment for why)
 * re-implements the identical logic inline in plain JavaScript, since it cannot import a .ts file
 * without reintroducing the tsx/Lighthouse incompatibility this file's twin exists to avoid. If
 * this validation logic changes, update both files together.
 */

export interface MinimalLhr {
  lighthouseVersion?: string;
  environment?: { hostUserAgent?: string };
  audits: {
    'first-contentful-paint'?: { numericValue?: unknown };
    interactive?: { numericValue?: unknown };
  };
}

export interface ExtractedMetrics {
  fcpMs: number;
  ttiMs: number;
  browserVersion: string;
  lighthouseVersion: string;
}

/**
 * Throws rather than returning a fallback if either metric is missing or non-numeric -- this
 * function must never hand back a placeholder (e.g. 0) for a metric Lighthouse did not actually
 * report. Never reads any field other than first-contentful-paint / interactive (no silent
 * substitution of largest-contentful-paint, total-blocking-time, interaction-to-next-paint, etc.).
 */
export function extractFcpTti(lhr: MinimalLhr): ExtractedMetrics {
  const fcp = lhr.audits['first-contentful-paint']?.numericValue;
  const tti = lhr.audits['interactive']?.numericValue;

  if (typeof fcp !== 'number' || !Number.isFinite(fcp)) {
    throw new Error(
      `Lighthouse did not return a numeric first-contentful-paint value (got ${JSON.stringify(fcp)}). Refusing to substitute a placeholder.`
    );
  }
  if (typeof tti !== 'number' || !Number.isFinite(tti)) {
    throw new Error(
      `Lighthouse did not return a numeric interactive (TTI) value (got ${JSON.stringify(tti)}). Refusing to substitute a placeholder or another metric.`
    );
  }

  return {
    fcpMs: fcp,
    ttiMs: tti,
    browserVersion: lhr.environment?.hostUserAgent ?? 'unknown',
    lighthouseVersion: lhr.lighthouseVersion ?? 'unknown',
  };
}
