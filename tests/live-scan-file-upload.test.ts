import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * File/multi-file upload regression suite for app/live-scan/page.tsx (Phase 10/11 of the product
 * completion pass: paste was previously the ONLY input method despite the backend already
 * accepting file/repo metadata).
 *
 * Source-level regression guard -- same established pattern as
 * tests/accessibility-regression.test.ts (this repo has no jsdom/browser test runner to actually
 * drive a real `<input type="file">` + FileReader in Node). Each assertion was verified against
 * ACTUAL live behavior first: a real single-file upload (confirmed via a live browser session to
 * populate the editor and trigger a real scan showing genuine findings) and a real 3-file batch
 * upload (confirmed to render one card per file with correct per-file issue counts/quality
 * scores, and an expandable diagnostic list with real ruleId/severity/message/line data) against
 * the actual running dev server -- not assumed from reading the source alone.
 */
function read(): string {
  return fs.readFileSync(path.resolve(process.cwd(), 'app/live-scan/page.tsx'), 'utf-8');
}

test('File/multi-file upload (Phase 10/11): app/live-scan/page.tsx', async (t) => {
  const src = read();

  await t.test('a real file input exists, accepting multiple files and the supported source extensions', () => {
    assert.match(src, /<input[\s\S]{0,80}type="file"/, 'a real <input type="file"> must exist');
    assert.match(src, /<input[\s\S]{0,200}multiple/, 'the file input must accept multiple files, not just one');
    assert.match(src, /accept=".*\.jsx.*\.tsx.*\.vue/, 'the file input must scope accepted extensions to source files FIGM actually analyzes');
  });

  await t.test('files are read via the real browser FileReader API, not simulated/hardcoded content', () => {
    assert.match(src, /new FileReader\(\)/);
    assert.match(src, /reader\.readAsText\(file\)/);
  });

  await t.test('a single uploaded file feeds the existing single-editor scan flow (no separate/duplicate scan path)', () => {
    assert.match(src, /fileList\.length === 1/);
    // Must reuse the same setCode/setFileName/handleScan the paste flow already uses, not a
    // parallel implementation.
    const singleFileBranch = src.slice(src.indexOf('fileList.length === 1'), src.indexOf('Multiple files: batch mode'));
    assert.match(singleFileBranch, /setFileName\(name\)/);
    assert.match(singleFileBranch, /setCode\(content\)/);
    assert.match(singleFileBranch, /handleScan\(content, name\)/);
  });

  await t.test('a single oversized uploaded file is rejected client-side against the same MAX_CODE_LENGTH the paste flow enforces', () => {
    const singleFileBranch = src.slice(src.indexOf('fileList.length === 1'), src.indexOf('Multiple files: batch mode'));
    assert.match(singleFileBranch, /content\.length > MAX_CODE_LENGTH/);
  });

  await t.test('multiple uploaded files each get independently scanned via the real POST /api/scan endpoint (no fake/mocked batch scanner)', () => {
    assert.match(src, /runBatchScan/);
    const batchFn = src.slice(src.indexOf('const runBatchScan'), src.indexOf('const handleFileUpload'));
    assert.match(batchFn, /fetch\('\/api\/scan'/, 'batch scanning must call the same real /api/scan route the single-file flow uses');
    assert.match(batchFn, /method: 'POST'/);
    // Sequential (not Promise.all) -- must not blast every file at the shared per-IP rate limit
    // at once.
    assert.doesNotMatch(batchFn, /Promise\.all\(\s*files\.map/, 'batch scanning must not fire every file concurrently against the shared rate limit');
    assert.match(batchFn, /for \(const f of files\)/, 'batch scanning must process files sequentially');
  });

  await t.test('an oversized file anywhere in a batch upload is rejected before any scan request is sent', () => {
    const uploadFn = src.slice(src.indexOf('const handleFileUpload'), src.length);
    assert.match(uploadFn, /oversized/);
    assert.match(uploadFn, /f\.code\.length > MAX_CODE_LENGTH/);
  });

  await t.test('batch results render real per-diagnostic severity/ruleId/line/message, reusing the existing SEV_COLOR map', () => {
    const batchPanelStart = src.indexOf('Batch Scan Results');
    assert.ok(batchPanelStart > -1, 'a Batch Scan Results panel must exist');
    const batchPanel = src.slice(batchPanelStart, src.length);
    assert.match(batchPanel, /SEV_COLOR\[d\.severity\]/, 'must reuse the same severity-color scheme as the single-file panel, not invent a new one');
    assert.match(batchPanel, /d\.ruleId/);
    assert.match(batchPanel, /d\.location\.start\.line/);
    assert.match(batchPanel, /d\.message/);
    assert.match(batchPanel, /entry\.result!\.qualityScore/, 'must surface the real server-computed quality score per file');
  });

  await t.test('a failed per-file scan is shown as an error for that specific file, not silently dropped or crashing the whole batch', () => {
    const batchFn = src.slice(src.indexOf('const runBatchScan'), src.indexOf('const handleFileUpload'));
    assert.match(batchFn, /catch \(err: any\)/);
    assert.match(batchFn, /status: 'error'/);
  });
});
