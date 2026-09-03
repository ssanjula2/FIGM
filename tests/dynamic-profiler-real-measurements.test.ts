import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DynamicProfiler } from '../src/engine/dynamic-profiler';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine';
import { formatScanDuration, formatMemoryDelta, formatScanEngineStatus, scanEngineStatusBadge } from '../src/lib/engine-diagnostics-format';
import { TOTAL_RULE_COUNT } from '../src/matrix/rule-registry';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

/**
 * Stage 5A audit regression coverage: the Live Scanner's "Engine Diagnostics" panel
 * (Scan Duration / Engine Memory Delta) must be real, auditable measurements -- never fabricated.
 * `src/engine/dynamic-profiler.ts` previously took a real base perf.now()/heap-delta reading and
 * added a synthetic "Dynamic Code Structural Analysis" formula on top (extra ms/MB derived from a
 * static regex count of the submitted code's lines/loops/allocations/nesting depth), floored at a
 * hardcoded minimum. This file guards against that regressing.
 */

test('DynamicProfiler.profileExecutionAsync returns a finite, non-negative real duration for trivial code', async () => {
  const metrics = await DynamicProfiler.profileExecutionAsync('const x = 1;');
  assert.equal(typeof metrics.executionTimeMs, 'number');
  assert.ok(Number.isFinite(metrics.executionTimeMs), 'executionTimeMs must be a finite number');
  assert.ok(metrics.executionTimeMs >= 0, 'executionTimeMs must never be negative');
});

test('duration is NOT derived from a static line/loop/allocation-count formula (the removed "Dynamic Code Structural Analysis" fabrication)', async () => {
  // A large, heavily-looped, heavily-allocating source that the OLD formula
  // (lineCount*0.04 + loopCount*2.8 + allocCount*0.45 + nestingDepth*4.2) would have inflated by
  // tens of milliseconds regardless of how fast the sandbox actually ran it. The real elapsed-time
  // measurement for trivially fast code (a handful of simple loops) must stay in the same order of
  // magnitude as a genuinely trivial snippet -- not scale linearly with source size the way the
  // removed formula did.
  const trivial = 'const x = 1;';
  const manyLoopsAndAllocations = Array.from({ length: 40 }, (_, i) => `for (let i${i} = 0; i${i} < 1; i${i}++) { const o${i} = { a: 1, b: [1,2,3] }; }`).join('\n');

  const trivialMetrics = await DynamicProfiler.profileExecutionAsync(trivial);
  const largeMetrics = await DynamicProfiler.profileExecutionAsync(manyLoopsAndAllocations);

  // The removed formula alone would have added ~40 * 2.8 (loops) + 40 * 0.45 (allocations) +
  // 40 * 0.04 (lines) ≈ 133ms to the large snippet on top of its real base time, regardless of
  // actual sandbox execution speed. A real measurement of two genuinely-fast snippets (both
  // complete almost instantly in the sandbox) must not differ by anywhere close to that.
  const delta = largeMetrics.executionTimeMs - trivialMetrics.executionTimeMs;
  assert.ok(
    delta < 100,
    `executionTimeMs delta between trivial and large-but-still-fast code was ${delta}ms -- suspiciously large, consistent with the removed static-formula fabrication reappearing (real sandbox execution of both should complete in comparable time, dominated by process-spawn overhead, not source size)`
  );
});

test('DynamicProfiler.profileExecutionAsync returns a real (or honestly null) memory delta, never a suspicious fabricated placeholder', async () => {
  const metrics = await DynamicProfiler.profileExecutionAsync('const x = 1;');
  assert.ok(
    metrics.peakMemoryMb === null || typeof metrics.peakMemoryMb === 'number',
    'peakMemoryMb must be a real number or exactly null (unavailable), never any other type'
  );
  if (metrics.peakMemoryMb !== null) {
    assert.ok(Number.isFinite(metrics.peakMemoryMb), 'a non-null peakMemoryMb must be finite');
    // The removed fabrication had two hardcoded floors: 0.20 (unmeasured placeholder) and 0.15
    // (measured-but-clamped minimum). A real measurement of genuinely trivial code executed via a
    // fresh child process (which itself allocates far more than 0.20MB just to start up Node) will
    // essentially never land exactly on either literal -- this is a soft regression signal, not a
    // strict impossibility, so it only flags the exact old constants.
    assert.notEqual(metrics.peakMemoryMb, 0.2, 'peakMemoryMb must not be the old hardcoded "unmeasured" placeholder (0.20)');
  }
  assert.ok(['MEASURED', 'UNAVAILABLE'].includes(metrics.measurementType));
  // The old 'ESTIMATED' value implied a legitimate estimate was computed when none was -- it must
  // never reappear.
  assert.notEqual((metrics as any).measurementType, 'ESTIMATED');
});

test('the removed static-formula fabrication source code does not exist anywhere in dynamic-profiler.ts', () => {
  const src = fs.readFileSync(path.join(rootDir, 'src/engine/dynamic-profiler.ts'), 'utf-8');
  assert.doesNotMatch(src, /Dynamic Code Structural Analysis Engine/, 'the removed structural-analysis fabrication comment must not reappear');
  assert.doesNotMatch(src, /loopCount \* 2\.8/, 'the removed loop-count time-inflation formula must not reappear');
  assert.doesNotMatch(src, /allocCount \* 0\.45/, 'the removed allocation-count time-inflation formula must not reappear');
  assert.doesNotMatch(src, /nestingDepth \* 4\.2/, 'the removed nesting-depth time-inflation formula must not reappear');
  assert.doesNotMatch(src, /Math\.max\(\s*0\.12/, 'the removed hardcoded duration floor (0.12ms) must not reappear');
  assert.doesNotMatch(src, /Math\.max\(\s*0\.20/, 'the removed hardcoded memory floor (0.20MB) must not reappear');
});

test('the removed hardcoded fallback pattern (|| 0.12 / || 0.45 / || 0.15 / || 0.5) does not reappear at any known real consumer of profile.executionTimeMs / profile.peakMemoryMb', () => {
  const filesToCheck = ['app/api/scan/route.ts', 'src/reporter/report-generator.ts'];
  for (const rel of filesToCheck) {
    const src = fs.readFileSync(path.join(rootDir, rel), 'utf-8');
    assert.doesNotMatch(src, /executionTimeMs\s*\|\|\s*0\.\d+/, `${rel} must not silently substitute a hardcoded number when executionTimeMs is falsy`);
    assert.doesNotMatch(src, /peakMemoryMb\s*\|\|\s*0\.\d+/, `${rel} must not silently substitute a hardcoded number when peakMemoryMb is falsy`);
  }
});

test('formatMemoryDelta renders a genuinely unavailable memory reading honestly, never as a fabricated number', () => {
  assert.equal(formatMemoryDelta(null), 'Unavailable');
});

test('formatMemoryDelta shows a negative delta as-is with an explanation, never silently clamped positive', () => {
  const rendered = formatMemoryDelta(-0.37);
  assert.match(rendered, /^-0\.37 MB/);
  assert.match(rendered, /GC reclaimed/i);
});

test('formatMemoryDelta shows a real positive delta plainly', () => {
  assert.equal(formatMemoryDelta(1.9), '1.90 MB');
});

test('formatScanDuration uses milliseconds below 1s and seconds at/above 1s (formatting only, not a different measurement)', () => {
  assert.equal(formatScanDuration(66.31), '66.31 ms');
  assert.equal(formatScanDuration(999.99), '999.99 ms');
  assert.equal(formatScanDuration(1000), '1.00 s');
  assert.equal(formatScanDuration(1420), '1.42 s');
});

test('formatScanEngineStatus never invents a status the server did not return', () => {
  assert.equal(formatScanEngineStatus('COMPLETE'), 'Complete');
  assert.equal(formatScanEngineStatus('BLOCKED'), 'Blocked (parse failed)');
  assert.equal(formatScanEngineStatus('UNSUPPORTED_FRAMEWORK'), 'Unsupported framework');
});

test('the Live Scanner never labels Scan Duration / Engine Memory Delta as FCP/TTI/LCP/INP/CLS/Web Vitals', () => {
  // Scoped to the actual rendered field labels this file writes (not the surrounding JS code
  // comment, which legitimately explains -- as a disclaimer, the same pattern /performance already
  // uses -- that FCP/TTI are NOT what these fields measure; mentioning a term to explicitly negate
  // it is the correct, encouraged honesty pattern, not a labeling violation). The real prohibition
  // (Stage 5A, Section 5A.5) is that the metric's LABEL must never itself be FCP/TTI/etc.
  const src = fs.readFileSync(path.join(rootDir, 'app/live-scan/page.tsx'), 'utf-8');
  const forbiddenAsLabel = [/>\s*FCP:?\s*</, />\s*TTI:?\s*</, />\s*LCP:?\s*</, />\s*INP:?\s*</, />\s*CLS:?\s*</, />\s*Web Vitals:?\s*</i];
  for (const pattern of forbiddenAsLabel) {
    assert.doesNotMatch(src, pattern, `a rendered label must never itself be the runtime-performance term matching ${pattern}`);
  }
  assert.match(src, /Scan Duration/, 'the real duration field must be labelled "Scan Duration"');
  assert.match(src, /Engine Memory Delta/, 'the real memory field must be labelled "Engine Memory Delta", not a generic "Memory Usage"');
  assert.match(src, /not\s+runtime\s+performance\s+of\s+the\s+scanned\s+application/i, 'the panel must carry the explicit engine-vs-runtime distinction note');
});

test('DynamicProfileMetrics always carries a profilerStatus of exactly OK or UNAVAILABLE', async () => {
  const metrics = await DynamicProfiler.profileExecutionAsync('const x = 1;');
  assert.ok(['OK', 'UNAVAILABLE'].includes(metrics.profilerStatus), 'profilerStatus must be a real, closed-set value, never undefined or invented');
});

test('REGRESSION (Stage 7C, Section 22): static analysis (diagnostics/figmStatus) is fully independent of the dynamic profiler outcome -- RuleExecutionEngine.buildScanResult never gates static findings on profiling success', async () => {
  // A real scan of real code with a real, known static violation. This is the actual integration
  // point Section 22 cares about: even if profiling fails entirely in some environment, static
  // analysis must still return real findings, not an empty/blocked result.
  const code = `function Broken() {\n  user.active = true;\n  setUser(user);\n}`;
  const result = await RuleExecutionEngine.analyzeFileAsync('Broken.jsx', code);
  assert.ok(Array.isArray(result.diagnostics), 'diagnostics must be a real array regardless of profiler outcome');
  assert.notEqual(result.analysis.figmStatus, undefined, 'figmStatus must always be set, independent of profiling');
  // The profile object is attached, not gating -- proven by it existing as an independent field
  // alongside real diagnostics from the very same call.
  assert.ok(result.profile, 'profile must be attached even though it is architecturally independent of the static result above');
});

test('the sandbox-infrastructure-failure code paths set infrastructureUnavailable -> profilerStatus UNAVAILABLE, distinct from a scanned-code runtime error', () => {
  const src = fs.readFileSync(path.join(rootDir, 'src/engine/dynamic-profiler.ts'), 'utf-8');
  // Runner script not found (sync + async), spawn/spawnSync throwing, and the child 'error' event
  // (ENOENT/EACCES-class failures) must all be tagged as an infrastructure problem, not folded
  // silently into the generic hasRuntimeError used for the SCANNED CODE's own bad behavior.
  const infraSites = src.match(/infrastructureUnavailable:\s*true/g) || [];
  assert.ok(infraSites.length >= 4, `expected at least 4 real infrastructure-failure sites to set infrastructureUnavailable: true, found ${infraSites.length}`);
  assert.match(src, /profilerStatus:\s*execState\.infrastructureUnavailable \? 'UNAVAILABLE' : 'OK'/, 'buildProfileMetrics must derive profilerStatus from the real infrastructureUnavailable signal, not a hardcoded value');
  // Never fabricate a metric to paper over an infra failure -- executionTimeMs/peakMemoryMb must
  // stay computed from the real perf.now()/getHeapUsed() readings regardless of profilerStatus.
  assert.doesNotMatch(src, /profilerStatus === 'UNAVAILABLE'[\s\S]{0,80}executionTimeMs\s*=/, 'must never special-case a fabricated executionTimeMs when the profiler is unavailable');
});

test('Live Scan renders an honest "dynamic profiler unavailable" notice when profilerStatus is UNAVAILABLE, without hiding the static findings above it', () => {
  const src = fs.readFileSync(path.join(rootDir, 'app/live-scan/page.tsx'), 'utf-8');
  assert.match(src, /profilerStatus === 'UNAVAILABLE'/, 'the Live Scan UI must check the real profilerStatus signal');
  assert.match(src, /Dynamic profiler unavailable in this environment/, 'the UI must render an honest, specific notice, not a generic error or a silently blank panel');
});

test('Live Scan no longer hardcodes the "Rules Checked" / "Running all N FIGM rules" count -- it comes from the real rule registry', () => {
  const src = fs.readFileSync(path.join(rootDir, 'app/live-scan/page.tsx'), 'utf-8');
  assert.doesNotMatch(src, /label:\s*'Rules Checked',\s*value:\s*'50'/, 'Rules Checked must not be a hardcoded literal');
  assert.doesNotMatch(src, /Running all 50 FIGM guideline rules/, 'the scanning-state copy must not hardcode the rule count');
  assert.match(src, /TOTAL_RULE_COUNT/, 'Live Scan must source the rule count from the real registry constant');
});

test('REGRESSION (Stage 7C Section 19): "Rules Evaluated" is provably accurate -- every one of the 50 canonical rule-check functions is unconditionally invoked against every AST node, not merely a registry-size number displayed by lookup', () => {
  const src = fs.readFileSync(path.join(rootDir, 'src/ast/ast-detection-engine.ts'), 'utf-8');
  const evalFnDefs = [...src.matchAll(/private static (eval[A-Za-z0-9]+)\(/g)].map((m) => m[1]);
  const uniqueEvalFns = new Set(evalFnDefs);

  // The registry's total rule count and the number of distinct rule-check functions must be
  // exactly the same number -- if a future rule is added to one without the other, this fails
  // loudly instead of letting "Rules Evaluated: N" silently drift into a registry-size claim that
  // no longer matches what the engine actually executes.
  assert.equal(uniqueEvalFns.size, TOTAL_RULE_COUNT, `expected exactly ${TOTAL_RULE_COUNT} distinct eval* rule-check functions (one per canonical rule), found ${uniqueEvalFns.size}`);

  // Every one of those functions must be called from evaluateNode's own body -- and never wrapped
  // in a framework-conditional AT THE CALL SITE (e.g. `if (framework === 'VUE') { this.evalVue01(...) }`),
  // which would make the call itself conditional rather than the function's internal match logic.
  // The framework gate belongs inside each eval* function's own return expression, not around the
  // call -- that is what makes "all 50 evaluated" a real, verifiable execution fact rather than a
  // best-case claim that only holds for some frameworks.
  const evaluateNodeStart = src.indexOf('public static evaluateNode');
  const evaluateNodeBody = src.slice(evaluateNodeStart, src.indexOf('\n  private static evalNext01'));
  for (const fnName of uniqueEvalFns) {
    const callRegex = new RegExp(`if \\(this\\.${fnName}\\(node(?:, framework)?\\)\\)`);
    assert.match(evaluateNodeBody, callRegex, `${fnName} must be called unconditionally from evaluateNode's own body (found no unwrapped "if (this.${fnName}(...))" call)`);
  }
});

test('scanEngineStatusBadge never invents a status the server did not return, and every tone pairs with a real text label (status is never color-only)', () => {
  assert.deepEqual(scanEngineStatusBadge('COMPLETE'), { label: 'Complete', tone: 'success' });
  assert.deepEqual(scanEngineStatusBadge('PARTIAL'), { label: 'Partial', tone: 'warning' });
  assert.deepEqual(scanEngineStatusBadge('BLOCKED'), { label: 'Blocked', tone: 'danger' });
  assert.deepEqual(scanEngineStatusBadge('UNSUPPORTED_FRAMEWORK'), { label: 'Unsupported', tone: 'neutral' });
  for (const status of ['COMPLETE', 'PARTIAL', 'BLOCKED', 'UNSUPPORTED_FRAMEWORK'] as const) {
    const badge = scanEngineStatusBadge(status);
    assert.ok(badge.label.length > 0, 'badge must always carry a real text label, never rely on tone/color alone');
  }
});

test('REGRESSION (Stage 7C visual polish): the redesigned Engine Diagnostics card keeps the concise disclaimer and still never fabricates a metric to make the layout look more complete', () => {
  const src = fs.readFileSync(path.join(rootDir, 'app/live-scan/page.tsx'), 'utf-8');
  assert.match(src, /Measures FIGM&apos;s analysis execution only -- not runtime performance of the scanned application\./, 'the concise Stage 7C disclaimer wording must be present');
  assert.match(src, /scanEngineStatusBadge/, 'the status badge must be driven by the real figmStatus signal, not a hardcoded badge');
  // The old, long disclaimer paragraph must be gone (replaced, not left duplicated alongside the new one).
  assert.doesNotMatch(src, /Engine diagnostics describe FIGM&apos;s own analysis execution\. They are not runtime/, 'the old long-form disclaimer paragraph must have been replaced, not left duplicated');
});
