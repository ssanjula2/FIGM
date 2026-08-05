import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseCLIArgs, runCLI } from '../src/cli/figm-analyze.js';

describe('FIGM CLI Static Analyzer Unit Tests', () => {
  test('parseCLIArgs correctly parses --path, --framework, --threshold, --format, and --ignore', () => {
    const args = [
      '--path', 'samples/sample-spa',
      '--framework', 'react',
      '--format', 'html',
      '--threshold', '85',
      '--ignore', 'node_modules,dist,build'
    ];

    const options = parseCLIArgs(args);

    assert.equal(options.targetDir, 'samples/sample-spa');
    assert.equal(options.framework, 'react');
    assert.equal(options.format, 'html');
    assert.equal(options.threshold, 85);
    assert.deepEqual(options.ignorePatterns, ['node_modules', 'dist', 'build']);
  });

  test('runCLI returns exit code 0 when quality score satisfies threshold', () => {
    const exitCode = runCLI([
      '--path', 'samples/sample-spa',
      '--threshold', '0', // low threshold guarantees pass
      '--out', 'test-report-pass'
    ]);

    assert.equal(exitCode, 0);
    assert.ok(fs.existsSync(path.resolve(process.cwd(), 'test-report-pass.json')));
    assert.ok(fs.existsSync(path.resolve(process.cwd(), 'test-report-pass.html')));

    // Clean up test reports
    fs.unlinkSync(path.resolve(process.cwd(), 'test-report-pass.json'));
    fs.unlinkSync(path.resolve(process.cwd(), 'test-report-pass.html'));
  });

  test('runCLI returns exit code 1 when quality score falls below threshold', () => {
    const exitCode = runCLI([
      '--path', 'samples/sample-spa',
      '--threshold', '99', // high threshold guarantees failure due to sample defects
      '--out', 'test-report-fail'
    ]);

    assert.equal(exitCode, 1);

    // Clean up test reports
    if (fs.existsSync(path.resolve(process.cwd(), 'test-report-fail.json'))) {
      fs.unlinkSync(path.resolve(process.cwd(), 'test-report-fail.json'));
    }
    if (fs.existsSync(path.resolve(process.cwd(), 'test-report-fail.html'))) {
      fs.unlinkSync(path.resolve(process.cwd(), 'test-report-fail.html'));
    }
  });
});
