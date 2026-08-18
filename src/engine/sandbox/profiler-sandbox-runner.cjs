'use strict';

/*
 * FIGM Dynamic Profiler — isolated execution child process.
 *
 * P0 security remediation (see audit/ULTIMATE_FINAL_FORENSIC_AUDIT.md, CRIT-DYNPROF).
 *
 * This script is spawned as a SEPARATE OS PROCESS by src/engine/dynamic-profiler.ts. It must never
 * be `require()`d/imported into the main Next.js/Node server process, and must never be invoked
 * outside that spawn path. Its entire purpose is to be the disposable, sacrificial process that
 * actually executes untrusted, user-submitted source code, so that the real server process never
 * does.
 *
 * Isolation properties enforced by the PARENT (dynamic-profiler.ts), not by this file:
 *   - spawned with a minimal, explicitly-curated `env` (no JWT_SECRET / DATABASE_URL /
 *     SUPABASE_SERVICE_ROLE_KEY / GEMINI_API_KEY / any other application secret is ever visible
 *     to `process.env` inside this process, by construction — the parent never copies or filters
 *     its own process.env into this child's env, it builds a fresh allow-list from scratch)
 *   - spawned with NODE_OPTIONS=--max-old-space-size=<small> (bounds this process's own V8 heap;
 *     an OOM here only kills this disposable child, never the parent)
 *   - spawned with a hard wall-clock `timeout` + `killSignal: 'SIGKILL'` (an infinite loop in the
 *     submitted code is force-terminated from the parent's side; it can never hang the real server)
 *
 * This file additionally defends against the specific bug class it replaces (Node's default
 * unhandled-rejection/uncaught-exception behavior terminating the process the code runs in):
 * if that happens here, it happens to this disposable child, not the server — and we still try to
 * report a structured JSON result on stdout before exiting, rather than just dying silently.
 *
 * Residual, disclosed limitation: this is process-level isolation (separate OS process, empty
 * secret surface, capped heap, hard timeout), not a full OS-level sandbox (no seccomp/container/
 * chroot). The submitted code still runs as the same OS user and could, in principle, reach real
 * filesystem paths if it worked around the `require` stub below by some other means. `require` is
 * stubbed as defense-in-depth, not as the primary control — the primary control is that this
 * process carries no secrets and can be killed without consequence.
 */

let settled = false;

function reportAndExit(result) {
  if (settled) return;
  settled = true;
  try {
    process.stdout.write(JSON.stringify(result));
  } catch {
    // stdout itself is broken; nothing more this sandboxed process can do.
  }
  process.exit(0);
}

process.on('unhandledRejection', (err) => {
  reportAndExit({
    hasRuntimeError: true,
    runtimeErrorDetails: {
      message: (err && err.message) || String(err),
      stack: err && err.stack,
    },
  });
});

process.on('uncaughtException', (err) => {
  reportAndExit({
    hasRuntimeError: true,
    runtimeErrorDetails: {
      message: (err && err.message) || String(err),
      stack: err && err.stack,
    },
  });
});

function main() {
  let raw;
  try {
    raw = require('fs').readFileSync(0, 'utf8');
  } catch (e) {
    reportAndExit({
      hasRuntimeError: true,
      runtimeErrorDetails: { message: 'sandbox: failed to read input: ' + (e && e.message) },
    });
    return;
  }

  let code;
  try {
    const parsed = JSON.parse(raw);
    code = typeof parsed.code === 'string' ? parsed.code : '';
  } catch {
    reportAndExit({
      hasRuntimeError: true,
      runtimeErrorDetails: { message: 'sandbox: invalid input JSON' },
    });
    return;
  }

  let hasRuntimeError = false;
  let runtimeErrorDetails;

  try {
    let executableCode = code.replace(/export\s+default\s+/g, '').replace(/export\s+/g, '');
    const fnMatch = executableCode.match(/function\s+([A-Za-z0-9_$]+)/);
    if (fnMatch && fnMatch[1] && !executableCode.includes(`${fnMatch[1]}(`)) {
      executableCode += `\ntry { ${fnMatch[1]}(); } catch(e) {}`;
    }

    // `require` is stubbed to a no-op, object-returning function: this blocks direct
    // require('fs')/require('child_process')-style module loading from inside the executed
    // snippet, on top of the process-level isolation described above (defense in depth, not the
    // primary control).
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
      hasRuntimeError = true;
      runtimeErrorDetails = { message: res.message, stack: res.stack };
    }
  } catch (err) {
    hasRuntimeError = true;
    runtimeErrorDetails = { message: (err && err.message) || String(err), line: err && err.line };
  }

  reportAndExit({ hasRuntimeError, runtimeErrorDetails });
}

main();
