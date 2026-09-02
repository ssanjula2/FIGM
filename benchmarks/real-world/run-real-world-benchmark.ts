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
  /** Reproducibility metadata (Stage 5, 2026-09-03) -- optional because the original 15 repos'
   *  license/rationale live in METHODOLOGY.md's tables rather than duplicated here; required for
   *  every repo added from Stage 5 onward. Never fabricated -- 'NOASSERTION' means GitHub's API
   *  itself reported no detected SPDX license, not a missing lookup. */
  license?: string;
  inclusionRationale?: string;
  datePinned?: string;
  /** 'entire repository' means no subdirectory restriction was applied -- the same
   *  IGNORE_DIRS/SUPPORTED_EXT filter as every other repo in this corpus (see collectFiles below). */
  sourceDirs?: string;
  exclusionPaths?: string;
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
  // -----------------------------------------------------------------------------------------
  // Corpus expansion (Scientific Hardening Pass, 2026-08-25) -- 10 additional repositories, two
  // per framework category above. Selection criteria fixed BEFORE cloning/scanning; see
  // METHODOLOGY.md §8b for the full rationale and the candidates that were tried and dropped
  // because they do not exist (never fabricated).
  // -----------------------------------------------------------------------------------------
  {
    name: 'react-redux-realworld-example-app',
    url: 'https://github.com/gothinkster/react-redux-realworld-example-app.git',
    pinnedCommit: 'ee72eba4056392c95a27bc48d385d3f54ba38a18',
    primaryFrameworkLabel: 'React',
  },
  {
    name: 'redux-essentials-example-app',
    url: 'https://github.com/reduxjs/redux-essentials-example-app.git',
    pinnedCommit: 'b4414e1504c914ece3253dd8a21adfb2278464d9',
    primaryFrameworkLabel: 'React',
  },
  {
    name: 'next-learn',
    url: 'https://github.com/vercel/next-learn.git',
    pinnedCommit: 'bb2558441a6673ab76c89914c25018bffa27a2ba',
    primaryFrameworkLabel: 'Next.js',
  },
  {
    name: 'commerce',
    url: 'https://github.com/vercel/commerce.git',
    pinnedCommit: '3761e52e60df9c6a316e067dbfd7032e494d3634',
    primaryFrameworkLabel: 'Next.js',
  },
  {
    name: 'angular-realworld-example-app',
    url: 'https://github.com/realworld-apps/angular-realworld-example-app.git',
    pinnedCommit: 'dd99ed2cf39c805d719f943c5d7061a5683d98a8',
    primaryFrameworkLabel: 'Angular',
  },
  {
    name: 'reactive-angular-course',
    url: 'https://github.com/angular-university/reactive-angular-course.git',
    pinnedCommit: 'ba2c2ee10d40f7ec78bc976efbee6110a31e2123',
    primaryFrameworkLabel: 'Angular',
  },
  {
    name: 'vue-realworld-example-app',
    url: 'https://github.com/realworld-apps/vue-realworld-example-app.git',
    pinnedCommit: 'f7e48c8178602ce25d43293bc6f8ca51d84ae222',
    primaryFrameworkLabel: 'Vue',
  },
  {
    name: 'vitesse',
    url: 'https://github.com/antfu-collective/vitesse.git',
    pinnedCommit: '8a01bc9283fedcd63e750af55a75496361789a81',
    primaryFrameworkLabel: 'Vue',
  },
  {
    name: 'JavaScript30',
    url: 'https://github.com/wesbos/JavaScript30.git',
    pinnedCommit: 'c36f2ed261eacb3e9ad83c05eb2fd3a4f72cc82f',
    primaryFrameworkLabel: 'Generic JavaScript',
  },
  {
    name: 'javascript-algorithms',
    url: 'https://github.com/trekhleb/javascript-algorithms.git',
    pinnedCommit: '85293e3e2b88f4d2ce330d956b139cf628aa1e82',
    primaryFrameworkLabel: 'Generic JavaScript/TypeScript',
  },
  // -----------------------------------------------------------------------------------------
  // Corpus expansion (Stage 5, 2026-09-03) -- 6 additional repositories, all primary-framework
  // (React/Next.js/Angular) per the researcher's authoritative repository-sample requirement
  // (Proposal SS4.3 / Interim02 SS3.4: 20-30 public open-source SPA repos using React, Next.js,
  // Angular; Vue is additional support only and is deliberately NOT padded here). Selection
  // criteria fixed before cloning/scanning -- see METHODOLOGY.md SS8c for full rationale,
  // existence/size/license/archived-status verification, and candidates checked and rejected
  // (e.g. angular/angular.io -- archived; vercel/ai-chatbot -- renamed to vercel/chatbot,
  // confirmed via redirect before use; cal-com/cal.com, several guessed Angular-app names --
  // do not exist, never fabricated). Brings the corpus to 21 repositories total (15 primary +
  // 3 Vue + 3 generic).
  // -----------------------------------------------------------------------------------------
  {
    name: 'excalidraw',
    url: 'https://github.com/excalidraw/excalidraw.git',
    pinnedCommit: 'e1bb9ff8f8931e783c11d104abb8967ac6605c9a',
    primaryFrameworkLabel: 'React',
    license: 'MIT',
    inclusionRationale:
      'Large (131k+ stars), real, actively-maintained production SPA (collaborative whiteboard/canvas tool), not a tutorial or starter -- addresses the corpus\'s existing tutorial/starter-heavy bias for React specifically. Existence, size (~103MB), license, and non-archived status verified via the GitHub API before selection, not assumed.',
    datePinned: '2026-09-03',
    sourceDirs: 'entire repository',
    exclusionPaths: 'node_modules, .git, dist, build, .next, coverage, .vercel (same IGNORE_DIRS as every other repo)',
  },
  {
    name: 'bulletproof-react',
    url: 'https://github.com/alan2207/bulletproof-react.git',
    pinnedCommit: '9506629ed003a561c6627735480cce4994244bb4',
    primaryFrameworkLabel: 'React',
    license: 'MIT',
    inclusionRationale:
      'Widely-referenced (35k+ stars) React architecture reference implementation -- real feature-folder structure, hooks, forms, API layer -- distinct in shape/purpose from the corpus\'s existing React entries (a CRUD tutorial, two Redux example apps). Small enough (~2.2MB) to clone/scan quickly, deliberately not selected for that reason (selected for architectural distinctiveness; small size is incidental).',
    datePinned: '2026-09-03',
    sourceDirs: 'entire repository',
    exclusionPaths: 'node_modules, .git, dist, build, .next, coverage, .vercel (same IGNORE_DIRS as every other repo)',
  },
  {
    name: 'vercel-chatbot',
    url: 'https://github.com/vercel/chatbot.git',
    pinnedCommit: 'c2f8235e1f3ea903ad8b7f61447c4f74164b5c58',
    primaryFrameworkLabel: 'Next.js',
    license: 'NOASSERTION',
    inclusionRationale:
      'Official Vercel-org Next.js App Router template (20k+ stars), real streaming-UI/AI-chat production patterns distinct from the corpus\'s existing Next.js entries (a portfolio starter, a course repo, a commerce template). Repository was found renamed mid-selection (vercel/ai-chatbot -> vercel/chatbot, confirmed via GitHub API redirect) -- the current canonical URL is used here, consistent with how the prior expansion pass handled the gothinkster->realworld-apps org transfer.',
    datePinned: '2026-09-03',
    sourceDirs: 'entire repository',
    exclusionPaths: 'node_modules, .git, dist, build, .next, coverage, .vercel (same IGNORE_DIRS as every other repo)',
  },
  {
    name: 'nextjs-saas-starter',
    url: 'https://github.com/nextjs/saas-starter.git',
    pinnedCommit: '6e33e58b1e553a41fe22e6b941a7229a002de361',
    primaryFrameworkLabel: 'Next.js',
    license: 'MIT',
    inclusionRationale:
      'Official nextjs-org SaaS starter template (16k+ stars), small (~400KB) but real, production-shaped App Router app (auth, billing, dashboard) -- a lightweight counterbalance to the corpus\'s larger Next.js entries (commerce, next-learn), and organization-maintained per the same selection bar used for the corpus\'s other official-org picks.',
    datePinned: '2026-09-03',
    sourceDirs: 'entire repository',
    exclusionPaths: 'node_modules, .git, dist, build, .next, coverage, .vercel (same IGNORE_DIRS as every other repo)',
  },
  {
    name: 'ngx-admin',
    url: 'https://github.com/akveo/ngx-admin.git',
    pinnedCommit: 'dc6a442704bfef34b776b5eb15faf852d9e2f75c',
    primaryFrameworkLabel: 'Angular',
    license: 'MIT',
    inclusionRationale:
      'Popular (25k+ stars) real production-shaped Angular admin dashboard (Nebular UI, NgRx-adjacent patterns) -- addresses the corpus\'s Angular representativeness gap (previously only a tutorial and two smaller course/RealWorld apps), the same rationale vercel/commerce addressed for Next.js in the prior expansion pass.',
    datePinned: '2026-09-03',
    sourceDirs: 'entire repository',
    exclusionPaths: 'node_modules, .git, dist, build, .next, coverage, .vercel (same IGNORE_DIRS as every other repo)',
  },
  {
    name: 'coreui-free-angular-admin-template',
    url: 'https://github.com/coreui/coreui-free-angular-admin-template.git',
    pinnedCommit: '5f66f95b19edf4092fd2f95f5c5b34e185bba033',
    primaryFrameworkLabel: 'Angular',
    license: 'MIT',
    inclusionRationale:
      'Organization-maintained (CoreUI) real Angular admin template distinct in UI-library choice (Bootstrap-based, not Nebular like ngx-admin above) -- a second, independently-authored Angular production-shaped app for balance, not a fork or variant of ngx-admin.',
    datePinned: '2026-09-03',
    sourceDirs: 'entire repository',
    exclusionPaths: 'node_modules, .git, dist, build, .next, coverage, .vercel (same IGNORE_DIRS as every other repo)',
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

// Direct Execution Entry Point.
//
// Bug found via this Stage 5 corpus-expansion pass (2026-09-03): this script used to call main()
// unconditionally at module scope, with no entry guard at all. That meant merely IMPORTING the
// REPOS manifest from another module (exactly what generate-corpus-summary.ts and
// tests/real-world-corpus-manifest.test.ts both legitimately need to do) silently re-triggered a
// full clone-and-scan of all 21 repositories as an import side effect -- discovered when running
// generate-corpus-summary.ts (which only reads already-written raw-results/*.json) produced a
// second full 21-repo clone/scan in its output log. The exact same bug class was already fixed
// once in src/cli/figm-analyze.ts (see METHODOLOGY.md section 6b) for the identical reason; this
// file simply never had a guard added when it was first written. Fixed the same way: only run
// main() when this file is the actual process entry point (checked by exact basename, not a path
// substring). Verified harmless in effect (not a data-integrity bug): the accidental second run
// produced byte-identical per-repo counts to the first run (same 21 repos, same commits, same
// engine), so no re-run of the corpus was required after this fix -- only the missing guard.
const entryScriptBasename = process.argv[1] ? path.basename(process.argv[1]) : '';
const isDirectExecution =
  entryScriptBasename === 'run-real-world-benchmark.ts' || entryScriptBasename === 'run-real-world-benchmark.js';

if (isDirectExecution) {
  main();
}

// Give any pending microtask-queued promise rejections (see the comment above main()) a chance to
// surface and be captured by the handlers registered in main(), rather than firing after this
// process has already exited and appearing as an unexplained crash to whoever ran this script.
// Only armed on direct execution -- see the entry-guard comment above.
if (isDirectExecution) {
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
}
