#!/usr/bin/env node
/**
 * Plain-JavaScript Lighthouse measurement worker -- deliberately NOT TypeScript and NEVER run
 * through the `tsx` loader (see docs/research/RQ1_EXPERIMENT_PROTOCOL.md Section 8 note on this).
 *
 * Reason this file exists as a separate plain-JS process rather than inline in run-experiment.ts:
 * `node --import tsx run-experiment.ts` calling `lighthouse()` directly reliably threw
 * `ReferenceError: __name is not defined` INSIDE THE BROWSER PAGE CONTEXT
 * (`__failedInBrowser: true`, from Lighthouse's own `computeBenchmarkIndex` page-eval snippet).
 * Root cause: tsx's process-wide CJS loader hook affects how Node compiles every required
 * module -- including Lighthouse's own plain-.js internals -- which corrupts the literal
 * function-source string Lighthouse extracts via `.toString()` and injects into the page for
 * in-browser evaluation (esbuild's `__name` helper-call gets baked into that string without the
 * helper definition traveling with it). Running Lighthouse in a clean, non-tsx Node process
 * (exactly matching the proven-working `_smoke-lighthouse.mjs` engineering-validation script)
 * avoids this entirely. Confirmed via isolation testing (research/rq1-experiment/scripts's
 * throwaway `_isolate2.ts` reproduction, not part of the delivered infrastructure).
 *
 * Usage: node research/rq1-experiment/scripts/lighthouse-worker.mjs <url>
 * Prints one line of JSON to stdout on success: {fcpMs, ttiMs, browserVersion, lighthouseVersion}
 * Exits non-zero with an error message on stderr on failure -- never prints a placeholder result.
 *
 * STAGE 3A CORRECTION: the original version of this file passed `formFactor: 'desktop'` and
 * `screenEmulation: { disabled: true }` as loose flags with no `config`. Lighthouse's
 * `formFactor` setting does NOT itself cascade to select desktop network/CPU throttling or a
 * desktop user-agent -- only the dedicated `lighthouse:desktop`/`desktop-config.js` preset does
 * that. Verified by dumping the real, resolved `lhr.configSettings` (not assumed): the original
 * flags-only setup silently ran with `throttling: mobileSlow4G` (rttMs 150, cpuSlowdownMultiplier
 * 4) and a mobile Android/Chrome user-agent, despite formFactor:'desktop' -- an internally
 * inconsistent, non-reproducible-as-intended configuration that affected every FCP/TTI number
 * collected during Stage 3, including its smoke-test runs. Fixed by using Lighthouse's own
 * `desktop-config.js` preset directly, which resolves to the real, coherent desktop profile
 * recorded in docs/research/RQ1_EXPERIMENT_PROTOCOL.md Section 3 and
 * research/rq1-experiment/environment/baseline.json (rttMs 40, throughputKbps 10240,
 * cpuSlowdownMultiplier 1, screenEmulation 1350x940 non-mobile, desktop Chrome/macOS UA).
 */
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';

const url = process.argv[2];
if (!url) {
  console.error('Usage: node lighthouse-worker.mjs <url>');
  process.exit(2);
}

let chrome;
try {
  chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
  const result = await lighthouse(
    url,
    { port: chrome.port, onlyAudits: ['first-contentful-paint', 'interactive'], output: 'json' },
    desktopConfig
  );

  if (!result) throw new Error('Lighthouse returned no result');
  const lhr = result.lhr;
  const fcp = lhr.audits['first-contentful-paint']?.numericValue;
  const tti = lhr.audits['interactive']?.numericValue;

  if (typeof fcp !== 'number' || !Number.isFinite(fcp)) {
    throw new Error(`Lighthouse did not return a numeric first-contentful-paint value (got ${JSON.stringify(fcp)})`);
  }
  if (typeof tti !== 'number' || !Number.isFinite(tti)) {
    throw new Error(`Lighthouse did not return a numeric interactive (TTI) value (got ${JSON.stringify(tti)})`);
  }

  process.stdout.write(
    JSON.stringify({
      fcpMs: fcp,
      ttiMs: tti,
      browserVersion: lhr.environment?.hostUserAgent ?? 'unknown',
      lighthouseVersion: lhr.lighthouseVersion ?? 'unknown',
    }) + '\n'
  );
  process.exit(0);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
} finally {
  if (chrome) {
    try {
      await chrome.kill();
    } catch {
      // best-effort cleanup only
    }
  }
}
