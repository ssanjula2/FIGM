/**
 * Framework-Independent Guideline Model (FIGM)
 * Real-World Benchmark Runner (Reproducibility Script)
 *
 * Clones each repository in REPOS below at its pinned commit and scans every supported source
 * file through the SAME engine call the production CLI uses (RuleExecutionEngine.analyzeFile --
 * see src/cli/figm-analyze.ts), so this is not a re-implementation of the scanner, just a
 * batch/measurement harness around it.
 *
 * This is a REAL-WORLD benchmark, distinct from the CONTROLLED benchmark in benchmarks/testbed/
 * and benchmarks/ground-truth.json (hand-written synthetic fixture files with known, pre-registered
 * violations at known line numbers). Nothing here has independent ground truth by construction --
 * every finding below is raw, unverified tool output. Precision/recall are NOT computed from this
 * run. A separate, small, manually-verified sample is recorded in SPOT_CHECK.md; only that sample
 * has a human judgment attached to each finding, and only that sample is safe to use for any
 * accuracy claim. See METHODOLOGY.md for the full explanation.
 *
 * Usage:
 *   node --import tsx benchmarks/real-world/run-real-world-benchmark.ts
 *
 * Requires outbound network access to github.com (git clone). If network access is unavailable,
 * this script will fail loudly on the first clone -- it does not fall back to synthetic data.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { RuleExecutionEngine, ScanResult } from '../../src/engine/rule-execution-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RepoManifestEntry {
  name: string;
  url: string;
  /** Exact commit this benchmark run is pinned to. Recorded from the first real clone performed
   *  for this benchmark (2026-08-14) -- not a guessed/aspirational value. Re-running this script
   *  checks out this exact commit so results are reproducible even if the repo's default branch
   *  moves on. */
  pinnedCommit: string;
  /** Label only, for the report -- never used to override FIGM's own framework auto-detection. */
  primaryFrameworkLabel: string;
}

export const REPOS: RepoManifestEntry[] = [
  {
    name: 'react-crash-2021',
    url: 'https://github.com/bradtraversy/react-crash-2021.git',
    pinnedCommit: 'a644cdedd86d9a4bb939eca4881bf26a29340519',
    primaryFrameworkLabel: 'React',
  },
  {
    name: 'nextjs-portfolio-starter',
    url: 'https://github.com/vercel/nextjs-portfolio-starter.git',
    pinnedCommit: '90cfee0f74c25bb3688369a0587e435f8b8f114d',
    primaryFrameworkLabel: 'Next.js',
  },
  {
    name: 'angular-tour-of-heroes',
    url: 'https://github.com/johnpapa/angular-tour-of-heroes.git',
    pinnedCommit: 'c65967710e8b1b87c0e6a4f19eea2b5f54e7c50e',
    primaryFrameworkLabel: 'Angular',
  },
  {
    name: 'vue-hackernews-2.0',
    url: 'https://github.com/vuejs/vue-hackernews-2.0.git',
    pinnedCommit: '98399b55c6f1da4197840ba76189795b3e95be0f',
    primaryFrameworkLabel: 'Vue',
  },
  {
    name: 'vanillawebprojects',
    url: 'https://github.com/bradtraversy/vanillawebprojects.git',
    pinnedCommit: 'adc66a181a67049fb413c8862181ddc6c45ba22b',
    primaryFrameworkLabel: 'Generic JavaScript',
  },
];

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.vercel']);
const SUPPORTED_EXT = new Set(['.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte']);

interface FileScanRecord {
  relativePath: string;
  framework: string;
  loc: number;
  figmFindingCount: number;
  parseErrorCount: number;
  engineCrash: string | null;
}

interface RepoResult {
  name: string;
  url: string;
  commit: string;
  primaryFrameworkLabel: string;
  filesScanned: number;
  totalLOC: number;
  scanDurationMs: number;
  totalFigmFindings: number;
  findingsByRule: Record<string, number>;
  findingsBySeverity: Record<string, number>;
  frameworksDetected: Record<string, number>;
  parserFailures: {
    filesWithParseErrors: number;
    totalParseErrorCount: number;
  };
  engineCrashes: { relativePath: string; error: string }[];
  perFile: FileScanRecord[];
  /** Full, unfiltered diagnostic objects for every FIGM-rule finding, for spot-checking and
   *  reproducibility. NOT ground truth -- see METHODOLOGY.md. */
  rawDiagnostics: ScanResult['diagnostics'];
}

function collectFiles(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      if (!IGNORE_DIRS.has(item.name)) collectFiles(path.join(dir, item.name), out);
    } else if (item.isFile()) {
      if (SUPPORTED_EXT.has(path.extname(item.name).toLowerCase())) out.push(path.join(dir, item.name));
    }
  }
}

function cloneRepoAtCommit(repo: RepoManifestEntry, cloneRoot: string): string {
  const dest = path.join(cloneRoot, repo.name);
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(cloneRoot, { recursive: true });

  console.log(`[clone] ${repo.name} <- ${repo.url}`);
  execFileSync('git', ['clone', '--quiet', repo.url, dest], { stdio: 'inherit' });
  execFileSync('git', ['checkout', '--quiet', repo.pinnedCommit], { cwd: dest, stdio: 'inherit' });

  const actualHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dest }).toString().trim();
  if (actualHead !== repo.pinnedCommit) {
    throw new Error(
      `[FATAL] Checked-out HEAD (${actualHead}) does not match pinned commit (${repo.pinnedCommit}) for ${repo.name}. Refusing to scan an unverified checkout.`
    );
  }
  return dest;
}

function scanRepo(repo: RepoManifestEntry, repoDir: string): RepoResult {
  const files: string[] = [];
  collectFiles(repoDir, files);

  const perFile: FileScanRecord[] = [];
  const rawDiagnostics: ScanResult['diagnostics'] = [];
  const findingsByRule: Record<string, number> = {};
  const findingsBySeverity: Record<string, number> = {};
  const frameworksDetected: Record<string, number> = {};
  const engineCrashes: { relativePath: string; error: string }[] = [];
  let totalLOC = 0;
  let filesWithParseErrors = 0;
  let totalParseErrorCount = 0;

  const startTime = performance.now();

  for (const absPath of files) {
    const relativePath = path.relative(repoDir, absPath).split(path.sep).join('/');
    let code: string;
    try {
      code = fs.readFileSync(absPath, 'utf-8');
    } catch (err) {
      engineCrashes.push({ relativePath, error: `File read failed: ${(err as Error).message}` });
      continue;
    }

    const loc = code.split('\n').length;
    totalLOC += loc;

    try {
      const result: ScanResult = RuleExecutionEngine.analyzeFile(relativePath, code);

      frameworksDetected[result.framework] = (frameworksDetected[result.framework] || 0) + 1;

      if (result.parseErrors && result.parseErrors.length > 0) {
        filesWithParseErrors += 1;
        totalParseErrorCount += result.parseErrors.length;
      }

      // Only FIGM-* rule diagnostics count as "findings" -- SYNTAX-PARSE-ERROR and TYPE-TS-*
      // entries are parser/type-checker signals, tracked separately, not rule violations.
      const figmDiags = result.diagnostics.filter((d) => d.ruleId.startsWith('FIGM-'));
      for (const d of figmDiags) {
        findingsByRule[d.ruleId] = (findingsByRule[d.ruleId] || 0) + 1;
        findingsBySeverity[d.severity] = (findingsBySeverity[d.severity] || 0) + 1;
      }
      rawDiagnostics.push(...figmDiags);

      perFile.push({
        relativePath,
        framework: result.framework,
        loc,
        figmFindingCount: figmDiags.length,
        parseErrorCount: result.parseErrors?.length || 0,
        engineCrash: null,
      });
    } catch (err) {
      const message = (err as Error).stack || (err as Error).message || String(err);
      engineCrashes.push({ relativePath, error: message });
      perFile.push({
        relativePath,
        framework: 'UNKNOWN (engine crashed)',
        loc,
        figmFindingCount: 0,
        parseErrorCount: 0,
        engineCrash: message,
      });
    }
  }

  const scanDurationMs = performance.now() - startTime;

  const totalFigmFindings = Object.values(findingsByRule).reduce((a, b) => a + b, 0);

  return {
    name: repo.name,
    url: repo.url,
    commit: repo.pinnedCommit,
    primaryFrameworkLabel: repo.primaryFrameworkLabel,
    filesScanned: perFile.length,
    totalLOC,
    scanDurationMs,
    totalFigmFindings,
    findingsByRule,
    findingsBySeverity,
    frameworksDetected,
    parserFailures: { filesWithParseErrors, totalParseErrorCount },
    engineCrashes,
    perFile,
    rawDiagnostics,
  };
}

/**
 * DynamicProfiler.profileExecution (src/engine/dynamic-profiler.ts) actually EXECUTES scanned
 * source code in-process via `new Function(...)` with a stubbed `require()` that returns `{}` for
 * every module. This benchmark run discovered a real consequence: a scanned file whose top-level
 * code is `async function generate() { const x = new (require('pkg'))(...); ... } generate();`
 * (a genuine, common real-world pattern -- e.g. an RSS-feed build script) throws inside the async
 * function, which turns the throw into a REJECTED PROMISE rather than a synchronous exception.
 * Neither dynamic-profiler.ts's own try/catch nor this script's per-file try/catch can catch a
 * promise rejection (both only guard synchronous execution) -- it surfaces later as a process-level
 * `unhandledRejection`, disconnected in time from the file that caused it. This handler exists
 * ONLY to keep this benchmark run's process alive long enough to finish writing every result (the
 * crash was observed to fire only after the triggering file's own scan had already completed and
 * been recorded, so no result data is lost) and to record that it happened for the summary report.
 * It does not fix the underlying engine bug -- see benchmarks/real-world/METHODOLOGY.md for the
 * full writeup and a pointer to the exact offending file/line found in this run.
 */
const asyncEngineCrashes: { type: string; message: string; detectedAtRepo: string }[] = [];
let currentRepoBeingScanned = '(none yet)';

function main() {
  process.on('unhandledRejection', (reason) => {
    const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
    console.warn(`\n[WARN] Unhandled promise rejection while scanning (see METHODOLOGY.md): ${message}\n`);
    asyncEngineCrashes.push({ type: 'unhandledRejection', message, detectedAtRepo: currentRepoBeingScanned });
  });
  process.on('uncaughtException', (err) => {
    console.warn(`\n[WARN] Uncaught exception while scanning (see METHODOLOGY.md): ${err.stack || err.message}\n`);
    asyncEngineCrashes.push({ type: 'uncaughtException', message: err.stack || err.message, detectedAtRepo: currentRepoBeingScanned });
  });

  const cloneRoot = process.env.FIGM_BENCHMARK_CLONE_DIR || path.join(__dirname, '.repo-clones');
  const outDir = path.join(__dirname, 'raw-results');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('=======================================================');
  console.log(' FIGM Real-World Benchmark Runner');
  console.log(` Clone workspace: ${cloneRoot}`);
  console.log(` Repositories: ${REPOS.length}`);
  console.log('=======================================================\n');

  const results: RepoResult[] = [];

  for (const repo of REPOS) {
    currentRepoBeingScanned = repo.name;
    const repoDir = cloneRepoAtCommit(repo, cloneRoot);
    const result = scanRepo(repo, repoDir);
    results.push(result);

    const outPath = path.join(outDir, `${repo.name}.json`);
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');

    console.log(
      `[scan] ${repo.name}: ${result.filesScanned} files, ${result.totalLOC} LOC, ` +
        `${result.totalFigmFindings} FIGM findings, ${result.scanDurationMs.toFixed(1)}ms, ` +
        `${result.engineCrashes.length} engine crashes, ${result.parserFailures.filesWithParseErrors} files w/ parse errors`
    );
    console.log(`[scan] raw output written to: ${outPath}\n`);
  }

  const combinedSummary = {
    generatedAt: new Date().toISOString(),
    figmVersion: 'FIGM-Core-v2 (see figm-spec.json meta.version)',
    repoCount: results.length,
    totalFilesScanned: results.reduce((a, r) => a + r.filesScanned, 0),
    totalLOC: results.reduce((a, r) => a + r.totalLOC, 0),
    totalFigmFindings: results.reduce((a, r) => a + r.totalFigmFindings, 0),
    totalScanDurationMs: results.reduce((a, r) => a + r.scanDurationMs, 0),
    totalEngineCrashes: results.reduce((a, r) => a + r.engineCrashes.length, 0),
    totalFilesWithParseErrors: results.reduce((a, r) => a + r.parserFailures.filesWithParseErrors, 0),
    /** Async engine crashes (unhandledRejection/uncaughtException) detected DURING this run --
     *  see the comment above main() and METHODOLOGY.md. Attribution is best-effort (the repo being
     *  scanned when the process-level event fired), since these are inherently asynchronous and
     *  disconnected from the specific file/call that triggered them. */
    asyncEngineCrashesDuringRun: asyncEngineCrashes,
    repos: results.map((r) => ({
      name: r.name,
      url: r.url,
      commit: r.commit,
      primaryFrameworkLabel: r.primaryFrameworkLabel,
      filesScanned: r.filesScanned,
      totalLOC: r.totalLOC,
      scanDurationMs: r.scanDurationMs,
      totalFigmFindings: r.totalFigmFindings,
      findingsByRule: r.findingsByRule,
      findingsBySeverity: r.findingsBySeverity,
      frameworksDetected: r.frameworksDetected,
      parserFailures: r.parserFailures,
      engineCrashCount: r.engineCrashes.length,
    })),
  };

  const summaryPath = path.join(outDir, '_combined-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(combinedSummary, null, 2), 'utf-8');

  console.log('=======================================================');
  console.log(' DONE. Combined summary written to:');
  console.log(` ${summaryPath}`);
  console.log(' IMPORTANT: raw findings above are UNVERIFIED tool output, not ground truth.');
  console.log(' See benchmarks/real-world/SPOT_CHECK.md for the manually-verified sample.');
  if (asyncEngineCrashes.length > 0) {
    console.log(` NOTE: ${asyncEngineCrashes.length} async engine crash(es) were caught during this run -- see METHODOLOGY.md.`);
    // Re-write the summary now that a trailing async crash may have arrived after the first write.
    fs.writeFileSync(summaryPath, JSON.stringify({ ...combinedSummary, asyncEngineCrashesDuringRun: asyncEngineCrashes }, null, 2), 'utf-8');
  }
  console.log('=======================================================');
}

main();

// Give any pending microtask-queued promise rejections (see the comment above main()) a chance to
// surface and be captured by the handlers registered in main(), rather than firing after this
// process has already exited and appearing as an unexplained crash to whoever ran this script.
setTimeout(() => {
  if (asyncEngineCrashes.length > 0) {
    const summaryPath = path.join(__dirname, 'raw-results', '_combined-summary.json');
    if (fs.existsSync(summaryPath)) {
      const existing = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      existing.asyncEngineCrashesDuringRun = asyncEngineCrashes;
      fs.writeFileSync(summaryPath, JSON.stringify(existing, null, 2), 'utf-8');
    }
  }
  process.exit(0);
}, 1500);
