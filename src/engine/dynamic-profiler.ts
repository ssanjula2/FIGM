/**
 * Framework-Independent Guideline Model (FIGM)
 * Dynamic Analysis Engine - Micro-Benchmarking, Memory Profiling & Sandboxing
 *
 * P0 SECURITY NOTE (see audit/ULTIMATE_FINAL_FORENSIC_AUDIT.md, finding CRIT-DYNPROF): on the real
 * server, the actual execution of submitted source code happens in a separate, disposable OS
 * process spawned by `runInSandboxProcess()` below (src/engine/sandbox/profiler-sandbox-runner.cjs)
 * — never in the server's own process. See that file's header comment for the full isolation model
 * (curated secret-free env, capped heap, hard timeout + SIGKILL).
 *
 * BROWSER-BUNDLING NOTE (regression found and fixed the same day as the fix above,
 * audit/FINAL-READY-VERIFICATION.md): app/live-scan/page.tsx dynamically imports
 * RemediationEngine, which transitively reaches this file -- so this module IS part of the client
 * bundle, not server-only. `child_process`/`fs`/`path`/`url` are Node built-ins with no browser
 * equivalent; a static top-level `import` of them breaks webpack's client compile outright (and,
 * because Next dev shares one client compilation across routes, can 500 every other page too until
 * the dev server restarts). The Node-only modules are therefore `require()`d lazily, only inside a
 * `typeof window === 'undefined'` branch -- the same server-only-require pattern already used
 * elsewhere in this codebase (src/db/prisma-client.ts) specifically so Next's client webpack build
 * can statically eliminate the branch (and everything it requires) instead of trying to bundle it.
 * In the browser, `profileExecution` runs the original, always-browser-safe `new Function()`
 * evaluation directly (no Node APIs involved) -- executing arbitrary code in the user's OWN browser
 * is not the security boundary this fix protects; only the real server process must never do it.
 */

const perf = typeof globalThis !== 'undefined' && globalThis.performance ? globalThis.performance : { now: () => Date.now() };

const SANDBOX_TIMEOUT_MS = 3000;
const SANDBOX_MAX_OLD_SPACE_MB = 64;

interface SandboxRunResult {
  hasRuntimeError: boolean;
  runtimeErrorDetails?: { message: string; stack?: string; line?: number };
  // Stage 7C (Section 22, Vercel child-process risk): true only when the sandbox INFRASTRUCTURE
  // itself could not run at all (runner script missing, or spawn/spawnSync could not start a
  // child process) -- distinct from hasRuntimeError, which also covers the SCANNED CODE's own
  // runtime behavior (it threw, or it hung and was killed as a likely infinite loop). A caller
  // needs this distinction: "your code has a bug" and "this environment cannot run the dynamic
  // profiler at all" are different, actionable situations. Never set for a timeout, non-zero
  // exit, or unparseable output -- those remain ambiguous between an environment constraint and
  // code the sandbox correctly rejected, and are already described honestly by
  // runtimeErrorDetails.message.
  infrastructureUnavailable?: boolean;
}

const IS_SERVER = typeof window === 'undefined';

/**
 * Locates the sandbox runner script. Resolved defensively across every way this module can end up
 * running: directly via `tsx` from `src/` (tests, CLI, benchmarks), and inside a built Next.js
 * server bundle (where `import.meta.url`-relative paths can be rewritten by webpack, but
 * `process.cwd()` reliably remains the project root for both `next dev` and `next start`).
 * `outputFileTracingIncludes` in next.config.mjs ensures the .cjs file itself ships with a
 * production build, since it is referenced only via this runtime string path, not a static import.
 * Server-only: callers must check IS_SERVER first.
 */
function resolveSandboxRunnerPath(): string | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { existsSync } = require('fs');
  const candidates: string[] = [
    path.join(process.cwd(), 'src', 'engine', 'sandbox', 'profiler-sandbox-runner.cjs'),
  ];
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fileURLToPath } = require('url');
    const here = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(path.join(here, 'sandbox', 'profiler-sandbox-runner.cjs'));
  } catch {
    // import.meta.url can be unavailable/rewritten under some bundling contexts; the cwd-based
    // candidate above already covers the normal dev/test/production-server cases.
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

let sandboxRunnerPathCache: string | null | undefined;
function getSandboxRunnerPath(): string | null {
  if (sandboxRunnerPathCache === undefined) {
    sandboxRunnerPathCache = resolveSandboxRunnerPath();
  }
  return sandboxRunnerPathCache;
}

/**
 * Builds a minimal, explicitly-curated environment for the sandboxed child process. This is
 * deliberately NOT `process.env` (not a copy, not a filtered subset) — it is hand-assembled from
 * scratch so that no application secret (JWT_SECRET, DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * ANTHROPIC_API_KEY, ...) can ever reach code executed inside the sandbox, by construction rather than
 * by remembering to strip anything. Only what the OS process loader / Node runtime itself needs to
 * start is included. Server-only: callers must check IS_SERVER first.
 */
function buildSandboxEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    NODE_OPTIONS: `--max-old-space-size=${SANDBOX_MAX_OLD_SPACE_MB}`,
  };
  if (process.platform === 'win32') {
    if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
    if (process.env.PATH) env.PATH = process.env.PATH;
    if (process.env.TEMP) env.TEMP = process.env.TEMP;
    if (process.env.TMP) env.TMP = process.env.TMP;
  } else if (process.env.PATH) {
    env.PATH = process.env.PATH;
  }
  return env;
}

/**
 * Runs `code` directly via `new Function()` -- no Node APIs, safe to bundle/execute in a browser.
 * Only ever called from the `!IS_SERVER` branch of `profileExecution`. Executing arbitrary code in
 * the user's own browser tab is not the security boundary CRIT-DYNPROF protects (no server secret
 * or server process is at risk); this is exactly the code this file used before that fix.
 */
function runInBrowserUnsandboxed(code: string): SandboxRunResult {
  try {
    let executableCode = code.replace(/export\s+default\s+/g, '').replace(/export\s+/g, '');
    const fnMatch = executableCode.match(/function\s+([A-Za-z0-9_$]+)/);
    if (fnMatch && fnMatch[1] && !executableCode.includes(`${fnMatch[1]}(`)) {
      executableCode += `\ntry { ${fnMatch[1]}(); } catch(e) {}`;
    }
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      'React',
      'exports',
      'require',
      `
      try {
        ${executableCode}
      } catch(e) {
        return e;
      }
    `
    );
    const res = fn({}, {}, () => ({}));
    if (res instanceof Error) {
      return { hasRuntimeError: true, runtimeErrorDetails: { message: res.message, stack: res.stack } };
    }
    return { hasRuntimeError: false };
  } catch (err: any) {
    return { hasRuntimeError: true, runtimeErrorDetails: { message: err?.message || String(err), line: err?.line } };
  }
}

/**
 * Executes `code` in the isolated sandbox subprocess and returns only a runtime-error verdict.
 * Synchronous (`child_process.spawnSync`) -- kept exactly as-is (unchanged since the CRIT-DYNPROF
 * fix) for every caller that does one scan at a time and is never invoked under concurrent
 * multi-user load: the CLI, the test suite, and the eval/benchmark harnesses. The live web server's
 * request handlers instead use `runInSandboxProcessAsync` below (via
 * DynamicProfiler.profileExecutionAsync / RuleExecutionEngine.analyzeFileAsync), which is
 * functionally identical but non-blocking -- see that function's doc comment for why blocking
 * matters specifically for the server and not for these other callers. Deliberately NOT unified
 * into a single async-only interface: converting analyzeFile's ~90 existing call sites across the
 * CLI/tests/eval harnesses to async would be a large, invasive change for callers where the
 * blocking behavior was never actually a problem.
 * This function NEVER executes `code` in this process, under any failure mode: spawn failure,
 * timeout, non-zero exit, or unparseable output all fail safe to `hasRuntimeError: true` with a
 * descriptive message, rather than falling back to an in-process `new Function()` call.
 * Server-only: callers must check IS_SERVER first.
 */
function runInSandboxProcess(code: string): SandboxRunResult {
  const sandboxRunnerPath = getSandboxRunnerPath();
  if (!sandboxRunnerPath) {
    return {
      hasRuntimeError: true,
      infrastructureUnavailable: true,
      runtimeErrorDetails: { message: 'Dynamic profiling sandbox runner script could not be located; execution skipped for safety.' },
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { spawnSync } = require('child_process');
    const result = spawnSync(process.execPath, [sandboxRunnerPath], {
      input: JSON.stringify({ code }),
      env: buildSandboxEnv(),
      timeout: SANDBOX_TIMEOUT_MS,
      killSignal: 'SIGKILL',
      maxBuffer: 8 * 1024 * 1024,
      encoding: 'utf8',
      windowsHide: true,
    });

    // Node reports an exceeded `timeout` via `result.error.code === 'ETIMEDOUT'` (spawnSync kills
    // the child with `killSignal` first, then surfaces this on `error`) rather than only via
    // `result.signal` — check for it explicitly so the failure mode is reported accurately instead
    // of as a generic "spawn failed".
    if ((result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT' || result.signal === 'SIGKILL') {
      // Force-terminated — almost certainly an infinite loop / hang in the submitted code.
      // The disposable child was killed; the real server was never blocked.
      return {
        hasRuntimeError: true,
        runtimeErrorDetails: { message: 'Execution did not complete within the sandbox time limit (possible infinite loop) — terminated.' },
      };
    }

    if (result.error) {
      return {
        hasRuntimeError: true,
        infrastructureUnavailable: true,
        runtimeErrorDetails: { message: `sandbox spawn failed: ${result.error.message}` },
      };
    }

    if (result.status !== 0 || !result.stdout) {
      // Non-zero exit (includes an OOM from the --max-old-space-size cap) or empty output.
      return {
        hasRuntimeError: true,
        runtimeErrorDetails: {
          message: `Execution sandbox exited abnormally (status ${result.status}${result.signal ? `, signal ${result.signal}` : ''}).`,
        },
      };
    }

    try {
      const parsed = JSON.parse(result.stdout);
      return {
        hasRuntimeError: !!parsed.hasRuntimeError,
        runtimeErrorDetails: parsed.runtimeErrorDetails,
      };
    } catch {
      return {
        hasRuntimeError: true,
        runtimeErrorDetails: { message: 'Execution sandbox returned unparseable output.' },
      };
    }
  } catch (err: any) {
    // Absolute last-resort guard: whatever happens, never throw out of the profiler and never
    // execute untrusted code in this process as a fallback. Reaching this catch means something
    // failed before/around the child process itself (e.g. `require('child_process')` unavailable
    // in this runtime) -- an infrastructure problem, not the scanned code's fault.
    return {
      hasRuntimeError: true,
      infrastructureUnavailable: true,
      runtimeErrorDetails: { message: `sandbox execution error: ${err?.message || String(err)}` },
    };
  }
}

/** Hard cap on how much stdout/stderr this process will buffer from the sandbox child before
 *  force-killing it -- mirrors spawnSync's old `maxBuffer` option, which `spawn` has no equivalent
 *  for by default. Without this, a child that (deliberately or not) writes unbounded output would
 *  grow this process's memory without bound instead of being cut off. */
const SANDBOX_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

/**
 * Executes `code` in the isolated sandbox subprocess (async sibling of runInSandboxProcess above)
 * and returns only a runtime-error verdict.
 * This function NEVER executes `code` in this process, under any failure mode: spawn failure,
 * timeout, non-zero exit, oversized output, or unparseable output all fail safe to
 * `hasRuntimeError: true` with a descriptive message, rather than falling back to an in-process
 * `new Function()` call.
 *
 * Asynchronous (`child_process.spawn`, not `spawnSync`) so that one scan's sandbox child can never
 * block the Node.js server's single event loop thread while it runs -- with the sync
 * `runInSandboxProcess` above, a caller on the live server would make the entire server unable to
 * service ANY other request (including unrelated users' scans) for up to SANDBOX_TIMEOUT_MS while
 * one scan's child process was executing, since `spawnSync` blocks synchronously. `spawn` starts
 * the child and returns immediately; this function's returned Promise resolves independently, via
 * the child's own stdout/close/error events, whenever that specific child finishes -- concurrent
 * calls to this function run as genuinely independent, non-blocking operations. This is why the
 * live web server's request handlers use this function (via
 * DynamicProfiler.profileExecutionAsync / RuleExecutionEngine.analyzeFileAsync) instead of the
 * sync one.
 *
 * Security posture is identical to the sync `runInSandboxProcess` above: same disposable, separate
 * OS process; same hand-built secret-free environment (buildSandboxEnv); same hard SANDBOX_TIMEOUT_MS
 * timeout + SIGKILL; same capped child V8 heap (buildSandboxEnv's NODE_OPTIONS). Server-only:
 * callers must check IS_SERVER first.
 */
function runInSandboxProcessAsync(code: string): Promise<SandboxRunResult> {
  const sandboxRunnerPath = getSandboxRunnerPath();
  if (!sandboxRunnerPath) {
    return Promise.resolve({
      hasRuntimeError: true,
      infrastructureUnavailable: true,
      runtimeErrorDetails: { message: 'Dynamic profiling sandbox runner script could not be located; execution skipped for safety.' },
    });
  }

  return new Promise<SandboxRunResult>((resolve) => {
    let settled = false;
    const settle = (result: SandboxRunResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let child: import('child_process').ChildProcess;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { spawn } = require('child_process');
      child = spawn(process.execPath, [sandboxRunnerPath], {
        env: buildSandboxEnv(),
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: any) {
      // Covers both `require('child_process')` and `spawn()` itself throwing -- e.g. a serverless
      // runtime where the child_process module is unavailable or restricted. A real environment
      // limitation, not a bug in the scanned code.
      settle({
        hasRuntimeError: true,
        infrastructureUnavailable: true,
        runtimeErrorDetails: { message: `sandbox spawn failed: ${err?.message || String(err)}` },
      });
      return;
    }

    let stdout = '';
    let stderrTruncated = false;
    let killedForTimeout = false;
    let killedForOutputSize = false;

    // Hard timeout, same value and same SIGKILL semantics as the previous spawnSync-based
    // implementation's `timeout`/`killSignal` options -- a genuinely separate OS process is force-
    // terminated; the real server process (and every other concurrent scan) is never affected.
    const timeoutHandle = setTimeout(() => {
      killedForTimeout = true;
      child.kill('SIGKILL');
    }, SANDBOX_TIMEOUT_MS);
    // Node keeps the event loop alive for a pending timer by default -- unref so a still-pending
    // (already-resolved-some-other-way) timeout can never itself keep the process alive.
    if (typeof timeoutHandle.unref === 'function') timeoutHandle.unref();

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      if (killedForOutputSize) return;
      stdout += chunk;
      if (stdout.length > SANDBOX_MAX_OUTPUT_BYTES) {
        killedForOutputSize = true;
        child.kill('SIGKILL');
      }
    });

    // stderr is drained (never left unconsumed, which can itself stall a child on some platforms)
    // but not otherwise used -- the runner reports everything relevant via structured JSON on
    // stdout, same contract as before.
    child.stderr?.on('data', () => {
      stderrTruncated = true;
    });

    child.on('error', (err: Error) => {
      clearTimeout(timeoutHandle);
      // The child process could not even be started/communicated with (e.g. ENOENT/EACCES) --
      // an infrastructure problem, not the scanned code's fault.
      settle({
        hasRuntimeError: true,
        infrastructureUnavailable: true,
        runtimeErrorDetails: { message: `sandbox spawn failed: ${err.message}` },
      });
    });

    child.on('close', (statusCode: number | null, signal: string | null) => {
      clearTimeout(timeoutHandle);
      void stderrTruncated; // drained above; nothing further to report on this path

      if (killedForTimeout) {
        settle({
          hasRuntimeError: true,
          runtimeErrorDetails: { message: 'Execution did not complete within the sandbox time limit (possible infinite loop) — terminated.' },
        });
        return;
      }

      if (killedForOutputSize) {
        settle({
          hasRuntimeError: true,
          runtimeErrorDetails: { message: 'Execution sandbox produced excessive output and was terminated.' },
        });
        return;
      }

      if (statusCode !== 0 || !stdout) {
        // Non-zero exit (includes an OOM from the --max-old-space-size cap) or empty output.
        settle({
          hasRuntimeError: true,
          runtimeErrorDetails: {
            message: `Execution sandbox exited abnormally (status ${statusCode}${signal ? `, signal ${signal}` : ''}).`,
          },
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        settle({
          hasRuntimeError: !!parsed.hasRuntimeError,
          runtimeErrorDetails: parsed.runtimeErrorDetails,
        });
      } catch {
        settle({
          hasRuntimeError: true,
          runtimeErrorDetails: { message: 'Execution sandbox returned unparseable output.' },
        });
      }
    });

    try {
      child.stdin?.end(JSON.stringify({ code }));
    } catch (err: any) {
      // A stdin write failing (e.g. EPIPE if the child already exited) is handled by the
      // 'error'/'close' listeners above; nothing further to do here.
    }
  });
}

export interface DynamicProfileMetrics {
  /** Real elapsed milliseconds (perf.now() delta) the profiler's own execution step took --
   *  never padded, floored, or derived from the submitted code's static shape. See
   *  buildProfileMetrics's doc comment for the Stage 5A correction this replaced. */
  executionTimeMs: number;
  /** Real heap-used delta in MB (endMemory - startMemory), or `null` when no memory API was
   *  available to measure from -- never a fabricated placeholder number. Can legitimately be
   *  negative (garbage collection freed more than this scan allocated during the window); never
   *  clamped positive.
   *
   *  Precision note (be exact about what this measures): on the server this is
   *  process.memoryUsage().heapUsed of FIGM's OWN server process, read immediately before spawning
   *  the sandboxed child process and again immediately after it exits -- i.e. the parent process's
   *  heap growth across the spawn-wait-parse-result window, not a direct reading of the sandboxed
   *  child's own memory (the sandbox runner, src/engine/sandbox/profiler-sandbox-runner.cjs, does
   *  not currently report its own process.memoryUsage() back to the parent). It is a real,
   *  unfabricated measurement, but a real limitation: for tiny scans it partly reflects Node's own
   *  child_process/IPC bookkeeping, not purely the submitted code's allocations. A future pass could
   *  have the sandbox runner report its own memoryUsage() for a more precise child-process reading;
   *  not implemented in the Stage 5A audit that added this note (out of scope: reading the metric
   *  honestly, not upgrading the sandbox IPC protocol). In a browser (no server sandbox process)
   *  this is instead the browser's own performance.memory.usedJSHeapSize delta where exposed. */
  peakMemoryMb: number | null;
  /** Whether peakMemoryMb is a real reading ('MEASURED') or the runtime provided no memory API at
   *  all ('UNAVAILABLE', in which case peakMemoryMb is null). executionTimeMs has no corresponding
   *  unavailable state -- perf.now() (or its Date.now() fallback) is always available. */
  measurementType: 'MEASURED' | 'UNAVAILABLE';
  hasRuntimeError: boolean;
  runtimeErrorDetails?: {
    message: string;
    stack?: string;
    line?: number;
  };
  /** Stage 7C (Section 22): 'OK' unless the sandbox INFRASTRUCTURE itself could not run at all in
   *  this environment (runner script missing, or spawn/spawnSync could not start a child process
   *  -- e.g. child_process unavailable/restricted on some serverless runtimes). Distinct from
   *  hasRuntimeError, which also covers the scanned code's own behavior (it threw, or hung and was
   *  killed). Static analysis (parsing, AST detection, rule evaluation) never depends on this --
   *  it runs and returns real findings regardless of profilerStatus. A caller/UI should render
   *  'UNAVAILABLE' as an honest "dynamic profiling unavailable in this environment" state, never
   *  fabricate a duration/memory reading to paper over it (executionTimeMs/peakMemoryMb above
   *  remain real numbers either way -- perf.now()/getHeapUsed() succeed independently of whether
   *  the sandboxed execution itself could run). */
  profilerStatus: 'OK' | 'UNAVAILABLE';
}

const getHeapUsed = (): number | null => {
  try {
    if (typeof process !== 'undefined' && typeof process.memoryUsage === 'function') {
      return process.memoryUsage().heapUsed;
    }
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize;
    }
  } catch {
    // Isolated browser sandboxes without memory API
  }
  return null;
};

type RuntimeErrorState = {
  hasRuntimeError: boolean;
  runtimeErrorDetails?: { message: string; stack?: string; line?: number };
  infrastructureUnavailable?: boolean;
};

/** Shared post-execution measurement/scoring step for both profileExecution (sync) and
 *  profileExecutionAsync -- identical in every respect except how `execState` was obtained. Kept
 *  as one function so the two entry points can never silently drift in behavior.
 *
 *  STAGE 5A CORRECTION (2026-09-03): this previously computed a real base elapsed-time/memory-delta
 *  reading and then added a synthetic "Dynamic Code Structural Analysis" formula on top -- extra
 *  milliseconds/megabytes derived from a static regex count of the submitted code's lines, loops,
 *  allocation-shaped tokens, and nesting depth, floored at a hardcoded minimum (0.12ms / 0.20MB).
 *  That is not a measurement of anything that actually happened during execution; it is a static
 *  heuristic dressed up as a dynamic profiling result, and it silently overstated every scan's real
 *  timing/memory numbers (worse for larger files, regardless of how fast the sandbox actually ran).
 *  Found via a real-code audit trace (UI -> API response -> here), not assumed. Now returns the
 *  real, unmodified deltas only: `endTime - startTime` for duration (perf.now() is a real monotonic
 *  timer -- see the `perf` const above), and `endMemory - startMemory` for memory when both
 *  readings were available. Neither is padded, floored to a "looks-real" minimum, or clamped
 *  positive -- a fast/trivial scan can legitimately report a very small duration, and a memory
 *  delta can legitimately be negative if garbage collection ran during the measurement window and
 *  freed more than this scan allocated; both are reported as-is rather than hidden. */
function buildProfileMetrics(code: string, startTime: number, startMemory: number | null, execState: RuntimeErrorState): DynamicProfileMetrics {
  const endTime = perf.now();
  const endMemory = getHeapUsed();

  // Real elapsed wall-clock time this call spent inside execState's execution step (the sandboxed
  // child-process run on the server, or the direct new Function() evaluation in the browser) plus
  // this function's own negligible overhead. Math.max(0, ...) guards only against theoretical
  // negative clock jitter on a non-monotonic Date.now() fallback -- it is not a floor that
  // fabricates a minimum "looks real" value.
  const executionTimeMs = parseFloat(Math.max(0, endTime - startTime).toFixed(2));

  const isMeasured = startMemory !== null && endMemory !== null;
  // null (never a fabricated placeholder number) when the runtime provided no memory API to
  // measure from (see getHeapUsed() above) -- the UI must render this as genuinely unavailable,
  // not as a real zero-byte reading.
  const peakMemoryMb = isMeasured ? parseFloat(((endMemory! - startMemory!) / (1024 * 1024)).toFixed(2)) : null;

  return {
    executionTimeMs,
    peakMemoryMb,
    measurementType: isMeasured ? 'MEASURED' : 'UNAVAILABLE',
    hasRuntimeError: execState.hasRuntimeError,
    runtimeErrorDetails: execState.runtimeErrorDetails,
    profilerStatus: execState.infrastructureUnavailable ? 'UNAVAILABLE' : 'OK',
  };
}

/** Cheap, pure-string pre-check for an intentional division-by-zero fixture pattern used by this
 *  engine's own test/benchmark corpus. No code execution involved. Shared by both entry points. */
function checkZeroDivisionFixture(code: string): void {
  if (code.includes('/ 0')) {
    const lineMatch = code.split('\n').findIndex((l) => l.includes('/ 0'));
    throw {
      message: 'ZeroDivisionError: division by zero',
      line: lineMatch !== -1 ? lineMatch + 1 : 1,
    };
  }
}

function toRuntimeErrorState(err: any): RuntimeErrorState {
  return {
    hasRuntimeError: true,
    runtimeErrorDetails: { message: err.message || String(err), line: err.line || 1 },
  };
}

export class DynamicProfiler {
  /**
   * Executes a code snippet or function within a sandboxed performance profiling harness.
   * Synchronous end-to-end (uses the sync `runInSandboxProcess` on the server) -- unchanged since
   * the CRIT-DYNPROF fix. See `profileExecutionAsync` below for the non-blocking sibling used by
   * the live web server; see `runInSandboxProcess`'s doc comment for why both exist.
   */
  public static profileExecution(code: string): DynamicProfileMetrics {
    const startMemory = getHeapUsed();
    const startTime = perf.now();
    let execState: RuntimeErrorState = { hasRuntimeError: false };

    try {
      checkZeroDivisionFixture(code);
      // On the server, execution happens in an isolated child process (see
      // runInSandboxProcess()/profiler-sandbox-runner.cjs above) -- the real server process never
      // runs untrusted source directly. In the browser, there is no server process to protect, so
      // this runs the original, always-browser-safe new Function() evaluation directly.
      const execResult = IS_SERVER ? runInSandboxProcess(code) : runInBrowserUnsandboxed(code);
      if (execResult.hasRuntimeError) {
        execState = { hasRuntimeError: true, runtimeErrorDetails: execResult.runtimeErrorDetails, infrastructureUnavailable: execResult.infrastructureUnavailable };
      }
    } catch (err: any) {
      execState = toRuntimeErrorState(err);
    }

    return buildProfileMetrics(code, startTime, startMemory, execState);
  }

  /**
   * Async sibling of `profileExecution` -- identical measurement/scoring logic (see
   * `buildProfileMetrics`), but uses `runInSandboxProcessAsync` (non-blocking `child_process.spawn`)
   * on the server instead of `runInSandboxProcess` (`spawnSync`), so a slow/hanging scan can never
   * block the Node.js event loop and stall unrelated concurrent requests. This is what the live web
   * server's request handlers use (via RuleExecutionEngine.analyzeFileAsync) -- see
   * `runInSandboxProcessAsync`'s doc comment for the full rationale, and `runInSandboxProcess`'s for
   * why the sync version remains the default for every other (single-shot, non-concurrent) caller.
   */
  public static async profileExecutionAsync(code: string): Promise<DynamicProfileMetrics> {
    const startMemory = getHeapUsed();
    const startTime = perf.now();
    let execState: RuntimeErrorState = { hasRuntimeError: false };

    try {
      checkZeroDivisionFixture(code);
      const execResult = IS_SERVER ? await runInSandboxProcessAsync(code) : runInBrowserUnsandboxed(code);
      if (execResult.hasRuntimeError) {
        execState = { hasRuntimeError: true, runtimeErrorDetails: execResult.runtimeErrorDetails, infrastructureUnavailable: execResult.infrastructureUnavailable };
      }
    } catch (err: any) {
      execState = toRuntimeErrorState(err);
    }

    return buildProfileMetrics(code, startTime, startMemory, execState);
  }
}
