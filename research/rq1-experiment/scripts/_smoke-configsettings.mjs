// SMOKE_TEST / ENGINEERING_VALIDATION ONLY -- dumps Lighthouse's actual resolved configSettings
// (throttling, screenEmulation, formFactor, emulatedUserAgent) using the real desktop-config.js
// preset, so the protocol's control-variable values (docs/research/RQ1_EXPERIMENT_PROTOCOL.md
// Section 3, research/rq1-experiment/protocol.json's `environment.throttling`) are read directly
// from a live run, not transcribed from documentation or guessed. Re-run this if the installed
// `lighthouse` version ever changes, to reconfirm these values still hold.
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';

const url = process.argv[2] || 'https://example.com';
const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
try {
  const result = await lighthouse(
    url,
    { port: chrome.port, onlyAudits: ['first-contentful-paint', 'interactive'], output: 'json' },
    desktopConfig
  );
  console.log(JSON.stringify(result.lhr.configSettings, null, 2));
} finally {
  await chrome.kill();
}
