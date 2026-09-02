// SMOKE_TEST / ENGINEERING_VALIDATION ONLY -- not part of the RQ1 measurement pipeline.
// Verifies chrome-launcher can spawn a real local Chrome in this environment before the
// automated runner (run-experiment.ts) is trusted to do so for real measurement runs.
import * as chromeLauncher from 'chrome-launcher';

const chrome = await chromeLauncher.launch({
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
});
console.log('SMOKE_TEST: Chrome launched OK, port:', chrome.port, 'pid:', chrome.pid);
await chrome.kill();
console.log('SMOKE_TEST: Chrome killed OK');
