// SMOKE_TEST / ENGINEERING_VALIDATION ONLY -- not part of the RQ1 measurement pipeline.
// Verifies Lighthouse can run against a URL in this environment and that the
// first-contentful-paint and interactive (TTI) audits are actually present in the LHR output,
// before the automated runner is trusted to rely on them for real measurement runs.
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const url = process.argv[2] || 'https://example.com';

const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
try {
  const result = await lighthouse(url, {
    port: chrome.port,
    onlyAudits: ['first-contentful-paint', 'interactive'],
    output: 'json',
  });
  const lhr = result.lhr;
  console.log('SMOKE_TEST: Lighthouse version:', lhr.lighthouseVersion);
  console.log('SMOKE_TEST: fetchTime:', lhr.fetchTime);
  console.log('SMOKE_TEST: first-contentful-paint audit:', JSON.stringify(lhr.audits['first-contentful-paint'], null, 2));
  console.log('SMOKE_TEST: interactive audit:', JSON.stringify(lhr.audits['interactive'], null, 2));
} finally {
  await chrome.kill();
}
