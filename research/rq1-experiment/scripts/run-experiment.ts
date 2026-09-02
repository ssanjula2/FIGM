/**
 * RQ1 FCP/TTI experiment runner (docs/research/RQ1_EXPERIMENT_PROTOCOL.md).
 *
 * Builds/starts the real Next.js production server, then for each condition in
 * schema.ts's CONDITIONS list, runs N repetitions of: spawn lighthouse-worker.mjs (a plain-JS
 * child process that launches a real headless Chrome and runs Lighthouse against the fixture
 * route, requesting only the first-contentful-paint and interactive (TTI) audits) -> parse its
 * JSON stdout -> write one raw JSON result file per run to raw-results/ (or
 * raw-results/smoke-test/ when --smoke is passed).
 *
 * Measurement runs through a separate plain-JS subprocess (lighthouse-worker.mjs), never called
 * in-process from this TypeScript file, because running Lighthouse directly under `node --import
 * tsx` on this file reliably threw `ReferenceError: __name is not defined` INSIDE THE BROWSER
 * PAGE CONTEXT -- tsx's process-wide CJS loader hook corrupts a literal function-source string
 * Lighthouse extracts via `.toString()` and injects into the page. See lighthouse-worker.mjs's
 * own header comment for the full root-cause explanation and how it was isolated.
 *
 * Never fabricates a value: a failed run is recorded with status:'FAILED', fcpMs:null,
 * ttiMs:null, and a real error message -- never 0 or an invented number. A recoverable
 * failure (worker/Chrome/Lighthouse error on one run) does not abort the remaining runs.
 *
 * Usage:
 *   node --import tsx research/rq1-experiment/scripts/run-experiment.ts --smoke --repetitions 2
 *   node --import tsx research/rq1-experiment/scripts/run-experiment.ts --repetitions 10
 *
 * For each condition, this runner executes exactly protocol.json's `warmupRuns` real warm-up
 * executions FIRST (recorded honestly, isWarmup:true, own runNumber sequence starting at 1),
 * THEN exactly `measuredRuns` real measured executions (isWarmup:false, own runNumber sequence
 * starting at 1) -- warmupRuns=1, measuredRuns=10 therefore produces exactly 11 real browser
 * executions per condition, not 10 and not 9. A warm-up failure is recorded the same honest way a
 * measured failure is; it never silently becomes -- or silently prevents -- a measured run.
 *
 * Flags:
 *   --smoke               Label every run isSmokeTest:true and write to raw-results/smoke-test/
 *                          instead of raw-results/. Use this for engineering validation only.
 *   --measured-runs <n>    Override protocol.json's measuredRuns (default: read from protocol.json).
 *   --warmup-runs <n>      Override protocol.json's warmupRuns (default: read from protocol.json).
 *   --conditions <ids>     Comma-separated subset of condition IDs (default: all).
 *   --port <n>             Port to run the production server on (default: 4173).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { CONDITIONS, EXPERIMENT_VERSION, type RawResultRow } from './schema.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const experimentDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(experimentDir, '../../');
const workerPath = path.join(__dirname, 'lighthouse-worker.mjs');

export function parseArgs(argv: string[]) {
  const smoke = argv.includes('--smoke');
  const measIdx = argv.indexOf('--measured-runs');
  const measuredRunsOverride = measIdx >= 0 ? parseInt(argv[measIdx + 1], 10) : undefined;
  const warmIdx = argv.indexOf('--warmup-runs');
  const warmupRunsOverride = warmIdx >= 0 ? parseInt(argv[warmIdx + 1], 10) : undefined;
  const condIdx = argv.indexOf('--conditions');
  const conditionsFilter = condIdx >= 0 ? argv[condIdx + 1].split(',') : undefined;
  const portIdx = argv.indexOf('--port');
  const port = portIdx >= 0 ? parseInt(argv[portIdx + 1], 10) : 4173;
  return { smoke, measuredRunsOverride, warmupRunsOverride, conditionsFilter, port };
}

export function readProtocol(protocolDir: string = experimentDir): { measuredRuns: number; warmupRuns: number } {
  const protocolPath = path.join(protocolDir, 'protocol.json');
  const protocol = JSON.parse(fs.readFileSync(protocolPath, 'utf-8'));
  return { measuredRuns: protocol.measuredRuns, warmupRuns: protocol.warmupRuns ?? 0 };
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`);
}

function startServer(port: number): ChildProcess {
  // Production build only -- next dev ships unminified bundles, HMR client, and a dev overlay
  // that would distort FCP/TTI relative to what real users experience. See
  // docs/research/RQ1_EXPERIMENT_PROTOCOL.md's control-variable table ("application build mode").
  const child = spawn('npx', ['next', 'start', '-p', String(port)], {
    cwd: rootDir,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  child.stdout?.on('data', () => {});
  child.stderr?.on('data', () => {});
  return child;
}

/**
 * child.kill() only signals the immediate shell process spawned by `{ shell: true }`, not the
 * actual `next start` node process underneath it -- on Windows this reliably leaks a listening
 * server that then blocks the next run with EADDRINUSE. taskkill /T kills the whole process tree.
 * Must be awaited: an earlier version fired taskkill without waiting for it, and main()'s
 * process.exit() call right after routinely won the race, leaving the server listening.
 */
async function killServer(child: ChildProcess): Promise<void> {
  if (process.platform === 'win32' && child.pid) {
    try {
      await execFileAsync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
    } catch {
      // best-effort -- the process may have already exited on its own
    }
  } else {
    child.kill();
  }
}

interface WorkerMeasurement {
  fcpMs: number;
  ttiMs: number;
  browserVersion: string;
  lighthouseVersion: string;
}

async function runOneLighthouseMeasurement(url: string): Promise<WorkerMeasurement> {
  const { stdout } = await execFileAsync('node', [workerPath, url], { timeout: 45_000 });
  const lastLine = stdout.trim().split('\n').pop() ?? '';
  const parsed = JSON.parse(lastLine);
  if (typeof parsed.fcpMs !== 'number' || typeof parsed.ttiMs !== 'number') {
    throw new Error(`lighthouse-worker.mjs did not return numeric fcpMs/ttiMs (got: ${lastLine})`);
  }
  return parsed;
}

interface ConditionMeta {
  conditionId: RawResultRow['conditionId'];
  framework: RawResultRow['framework'];
  renderingStrategy: RawResultRow['renderingStrategy'];
  stateManagementStrategy: RawResultRow['stateManagementStrategy'];
}

/**
 * Executes exactly one real browser measurement (never skipped, never simulated) and returns the
 * row to record -- OK with real numeric metrics, or FAILED with null metrics and a real error
 * message. isWarmup/isSmokeTest are recorded exactly as passed in; a warm-up failure is recorded
 * the same honest way a measured failure is (docs/research/RQ1_EXPERIMENT_PROTOCOL.md Section 4).
 */
async function executeOneRun(
  url: string,
  condition: ConditionMeta,
  runNumber: number,
  isWarmup: boolean,
  isSmokeTest: boolean
): Promise<RawResultRow> {
  const timestamp = new Date().toISOString();
  try {
    const measurement = await runOneLighthouseMeasurement(url);
    return {
      experimentVersion: EXPERIMENT_VERSION,
      conditionId: condition.conditionId,
      framework: condition.framework,
      renderingStrategy: condition.renderingStrategy,
      stateManagementStrategy: condition.stateManagementStrategy,
      runNumber,
      fcpMs: measurement.fcpMs,
      ttiMs: measurement.ttiMs,
      status: 'OK',
      error: null,
      browserVersion: measurement.browserVersion,
      nodeVersion: process.version,
      lighthouseVersion: measurement.lighthouseVersion,
      timestamp,
      isSmokeTest,
      isWarmup,
    };
  } catch (err) {
    // Recoverable: record the honest failure and continue with the next run, never insert a
    // placeholder metric. A warm-up failure does NOT silently become, or silently block, a
    // measured run -- see docs/research/RQ1_EXPERIMENT_PROTOCOL.md Section 4/8.
    const message = err && typeof err === 'object' && 'stderr' in err
      ? String((err as any).stderr || (err as any).message)
      : err instanceof Error
        ? err.message
        : String(err);
    return {
      experimentVersion: EXPERIMENT_VERSION,
      conditionId: condition.conditionId,
      framework: condition.framework,
      renderingStrategy: condition.renderingStrategy,
      stateManagementStrategy: condition.stateManagementStrategy,
      runNumber,
      fcpMs: null,
      ttiMs: null,
      status: 'FAILED',
      error: message,
      browserVersion: null,
      nodeVersion: process.version,
      lighthouseVersion: null,
      timestamp,
      isSmokeTest,
      isWarmup,
    };
  }
}

async function main() {
  const { smoke, measuredRunsOverride, warmupRunsOverride, conditionsFilter, port } = parseArgs(process.argv.slice(2));
  const { measuredRuns: protocolMeasuredRuns, warmupRuns: protocolWarmupRuns } = readProtocol();
  const measuredRuns = measuredRunsOverride ?? protocolMeasuredRuns;
  const warmupRuns = warmupRunsOverride ?? protocolWarmupRuns;

  const conditions = conditionsFilter
    ? CONDITIONS.filter((c) => conditionsFilter.includes(c.conditionId))
    : CONDITIONS;

  const outDir = smoke
    ? path.join(experimentDir, 'raw-results', 'smoke-test')
    : path.join(experimentDir, 'raw-results');
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`[RQ1-RUNNER] ${smoke ? 'SMOKE_TEST / ENGINEERING_VALIDATION run' : 'REAL measurement run'}`);
  console.log(`[RQ1-RUNNER] Conditions: ${conditions.map((c) => c.conditionId).join(', ')}`);
  console.log(`[RQ1-RUNNER] Warm-up runs per condition: ${warmupRuns}; measured runs per condition: ${measuredRuns}`);
  console.log(`[RQ1-RUNNER] Expected total executions: ${conditions.length * (warmupRuns + measuredRuns)}`);

  const server = startServer(port);
  const baseUrl = `http://localhost:${port}`;

  let exitCode = 0;
  try {
    await waitForServer(`${baseUrl}/rq1-experiment`, 60_000);
    console.log(`[RQ1-RUNNER] Server ready at ${baseUrl}`);

    for (const condition of conditions) {
      // Phase 1: warm-up runs, executed for real, recorded honestly, isWarmup:true. Their own
      // runNumber sequence (1..warmupRuns) is independent of the measured-run sequence below.
      for (let runNumber = 1; runNumber <= warmupRuns; runNumber++) {
        const url = `${baseUrl}${condition.route}`;
        const row = await executeOneRun(url, condition, runNumber, true, smoke);
        if (row.status === 'OK') {
          console.log(`[RQ1-RUNNER] OK   ${condition.conditionId} WARMUP ${runNumber}/${warmupRuns} -- FCP=${row.fcpMs!.toFixed(1)}ms TTI=${row.ttiMs!.toFixed(1)}ms`);
        } else {
          console.error(`[RQ1-RUNNER] FAIL ${condition.conditionId} WARMUP ${runNumber}/${warmupRuns} -- ${row.error}`);
        }
        const fileName = `${condition.conditionId}_warmup${String(runNumber).padStart(3, '0')}_${Date.now()}.json`;
        fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(row, null, 2), 'utf-8');
      }

      // Phase 2: measured runs, isWarmup:false. Always exactly `measuredRuns` of these per
      // condition, regardless of how the warm-up phase above went.
      for (let runNumber = 1; runNumber <= measuredRuns; runNumber++) {
        const url = `${baseUrl}${condition.route}`;
        const row = await executeOneRun(url, condition, runNumber, false, smoke);
        if (row.status === 'OK') {
          console.log(`[RQ1-RUNNER] OK   ${condition.conditionId} run ${runNumber}/${measuredRuns} -- FCP=${row.fcpMs!.toFixed(1)}ms TTI=${row.ttiMs!.toFixed(1)}ms`);
        } else {
          console.error(`[RQ1-RUNNER] FAIL ${condition.conditionId} run ${runNumber}/${measuredRuns} -- ${row.error}`);
        }
        const fileName = `${condition.conditionId}_run${String(runNumber).padStart(3, '0')}_${Date.now()}.json`;
        fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(row, null, 2), 'utf-8');
      }
    }
  } catch (err) {
    console.error('[RQ1-RUNNER] Fatal error:', err);
    exitCode = 1;
  } finally {
    await killServer(server);
  }

  console.log(`[RQ1-RUNNER] Done. Raw results written to ${outDir}`);
  process.exit(exitCode);
}

if (process.argv[1] === __filename) {
  main();
}
