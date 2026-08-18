# FIGM Final Audit — AST Engine, Benchmarks, DynamicProfiler, Dogfooding

**Auditor**: independent research agent, forensic final audit pass.
**HEAD at time of audit**: `02ed599d114847d86329605f6fae6d3b738e66ea` (2026-08-18 14:36:00 +0530), confirmed via `git log -1`.
**Prior audit referenced for context (2026-08-17, HEAD `c07e0f37`)**: treated as unverified hearsay throughout; every claim below was independently re-derived from current source and live command output, not copied from that document.

Verdict vocabulary used: **NOT VERIFIED**, **CONTRADICTED**, **DOCUMENTATION-IMPLEMENTATION MISMATCH**, **FIXED AND VERIFIED**, **UNSUPPORTED EMPIRICAL CLAIM**, **CONFIRMED**.

---

## Task 1 — Rule inventory (Phase 8)

**CLAIM**: Exactly 25 FIGM rules, single source of truth, no duplicates, no drift between `four-layer-meta-model.ts`, `ast-detection-engine.ts`, `figm-spec.json`, and the guidelines UI.

**IMPLEMENTATION**:
- `src/matrix/four-layer-meta-model.ts` — 25 `ruleId: 'FIGM-...'` entries (`FOUR_LAYER_MAPPINGS`).
- `src/ast/ast-detection-engine.ts` — 25 `private static eval*()` predicate functions, one per rule ID, called from `evaluateNode()`.
- `figm-spec.json` — `rules` array, `meta.totalCoreRules`.
- `app/guidelines/page.tsx:5` — `import { RULE_CATALOG, ... } from '../../src/matrix/rule-registry'`.
- `src/matrix/rule-registry.ts:12,37` — `RULE_CATALOG = FOUR_LAYER_MAPPINGS.map(...)`, its own header comment: *"the single source of truth every UI/API/export surface should import."*

**TEST/LIVE RESULT**:
```
grep -c "ruleId: 'FIGM-" four-layer-meta-model.ts   -> 25 (listed FIGM-PERF-01..06, A11Y-01..06, NEXT-01..04, REACT-01..04, ANG-01..05)
grep -c "private static eval" ast-detection-engine.ts -> 25 (same 25 rule suffixes)
node -e figm-spec.json: rules.length = 25, meta.totalCoreRules = 25
node -e figm-spec.json: duplicate ruleId check -> dups: []
grep -c "ruleId: 'FIGM-" (uniq -c) -> every ID appears exactly once
```
`app/guidelines/page.tsx` imports `RULE_CATALOG` from `rule-registry.ts`, which is built by mapping `FOUR_LAYER_MAPPINGS` — confirmed single derivation chain, not an independently hand-maintained list.

**VERDICT**: **CONFIRMED**. Exactly 25 rules, identical ID sets across all four sources, no duplicates, single-source-of-truth architecture verified by reading the actual import graph (not just trusting the comment).

---

## Task 2 — AST architecture forensics (Phase 7): full 25-rule table

**CLAIM (prior audit, unverified)**: 23/25 rules have at least one real-AST framework path; Vue SFC is never real-AST for any rule; FIGM-ANG-03/04 are pure regex for every framework; diagnostics carry `sourceKind`.

**METHOD**: Read `src/ast/real-syntax-node-builder.ts` in full (1150 lines) — every `build*()` function and its framework eligibility gate (`JSX_FRAMEWORKS`, `GENERAL_JS_FRAMEWORKS`, `ANGULAR_CLASS_FRAMEWORKS`, `canAttemptRealAstParse()`). Cross-checked against `src/parser/source-parser.ts`'s legacy regex blocks (which the `useRealAst*` booleans suppress per rule/framework) and `src/analysis/react-ast-rules.ts` (a *second*, independent real-AST module the prior audit's brief did not mention by name — it implements FIGM-REACT-02, not `real-syntax-node-builder.ts`).

**Eligibility gates (real-syntax-node-builder.ts:27-50)**:
```
JSX_FRAMEWORKS = [REACT_JSX, NEXT_JS]
GENERAL_JS_FRAMEWORKS = [REACT_JSX, NEXT_JS, GENERIC_ESTREE, ANGULAR_TEMPLATE]
ANGULAR_CLASS_FRAMEWORKS = [ANGULAR_TEMPLATE, GENERIC_ESTREE]
canAttemptRealAstParse(fw) = fw !== 'VUE_SFC' && fw !== 'SVELTE'
```

### Full 25-rule table

| Rule | Real-AST fn | Frameworks w/ real AST | Frameworks on regex fallback | Evidence (file:line) |
|---|---|---|---|---|
| FIGM-PERF-01 | `buildPerf01` | REACT_JSX, NEXT_JS, GENERIC_ESTREE, ANGULAR_TEMPLATE | VUE_SFC | real-syntax-node-builder.ts:204-224, gate :1116-1123 |
| FIGM-PERF-02 | `buildPerf02` | REACT_JSX, NEXT_JS | GENERIC_ESTREE, ANGULAR_TEMPLATE, VUE_SFC | :226-259, gate :1124-1134 |
| FIGM-PERF-03 | `buildPerf03` | REACT_JSX, NEXT_JS, GENERIC_ESTREE, ANGULAR_TEMPLATE | VUE_SFC | :709-720 |
| FIGM-PERF-04 | `buildPerf04` | REACT_JSX, NEXT_JS, GENERIC_ESTREE, ANGULAR_TEMPLATE | VUE_SFC | :329-345 |
| FIGM-PERF-05 | `buildPerf05` | REACT_JSX, NEXT_JS | GENERIC_ESTREE, ANGULAR_TEMPLATE, VUE_SFC | :732-746 |
| FIGM-PERF-06 | `buildPerf06` | REACT_JSX, NEXT_JS, GENERIC_ESTREE, ANGULAR_TEMPLATE | VUE_SFC | :750-763 |
| FIGM-A11Y-01 | `buildA11y01` | REACT_JSX, NEXT_JS | GENERIC_ESTREE, ANGULAR_TEMPLATE, VUE_SFC | :351-372 |
| FIGM-A11Y-02 | `buildA11y02` | REACT_JSX, NEXT_JS | same | :374-387 |
| FIGM-A11Y-03 | `buildA11y03` | REACT_JSX, NEXT_JS | same | :389-413 |
| FIGM-A11Y-04 | `buildA11y04` | REACT_JSX, NEXT_JS | same | :415-430 |
| FIGM-A11Y-05 | `buildA11y05` | REACT_JSX, NEXT_JS | same | :776-790 |
| FIGM-A11Y-06 | `buildA11y06` | REACT_JSX, NEXT_JS | same | :810-824 |
| FIGM-NEXT-01 | `buildNext01` | NEXT_JS only | REACT_JSX (predicate `evalNext01` allows it, but the real-AST builder deliberately restricts to NEXT_JS only — see :1101-1110 comment; would otherwise false-positive on every `useState`/`useEffect` React file) | :968-979, gate :1140 |
| FIGM-NEXT-02 | `buildNext02` | NEXT_JS only | n/a — `evalNext02` itself restricted to NEXT_JS | :981-994 |
| FIGM-NEXT-03 | `buildNext03Root` | NEXT_JS only (root-level, not per-node) | n/a — `evalNext03` restricted to NEXT_JS | :1017-1037 |
| FIGM-NEXT-04 | `buildNext04` | NEXT_JS, REACT_JSX | n/a — `evalNext04` restricted to those 2 | :1039-1057, gate :1111/1144 |
| FIGM-REACT-01 | `buildReact01` | REACT_JSX, NEXT_JS, GENERIC_ESTREE (ANGULAR_TEMPLATE nodes are built but `evalReact01`'s framework check excludes them, so moot) | VUE_SFC | :862-874 |
| FIGM-REACT-02 | `detectArrayIndexKey` — **separate module**, `src/analysis/react-ast-rules.ts`, wired in by `RuleExecutionEngine.analyzeFile` (not `real-syntax-node-builder.ts`) | REACT_JSX, NEXT_JS | GENERIC_ESTREE (legacy regex retained — `evalReact02` predicate permits GENERIC_ESTREE but `supportsRealAstAnalysis()` excludes it); ANGULAR_TEMPLATE/VUE_SFC moot (predicate excludes) | react-ast-rules.ts:46-50,133-173; rule-execution-engine.ts:82-93 |
| FIGM-REACT-03 | `buildReact03` | REACT_JSX, NEXT_JS, GENERIC_ESTREE, ANGULAR_TEMPLATE | VUE_SFC | :632-668 |
| FIGM-REACT-04 | `buildReact04` | REACT_JSX, NEXT_JS | GENERIC_ESTREE, ANGULAR_TEMPLATE, VUE_SFC | :882-897 |
| FIGM-ANG-01 | `buildAng01` | ANGULAR_TEMPLATE, GENERIC_ESTREE | VUE_SFC; REACT_JSX/NEXT_JS moot (predicate excludes) | :909-920 |
| FIGM-ANG-02 | `buildAng02` | ANGULAR_TEMPLATE, GENERIC_ESTREE | same | :922-936 |
| **FIGM-ANG-03** | **none** | **none** | **ALL frameworks — pure regex, unconditional, no `useRealAst*` gate exists for this rule at all** | source-parser.ts:1039-1051 |
| **FIGM-ANG-04** | **none** | **none** | **ALL frameworks — pure regex, unconditional** | source-parser.ts:1053-1065 |
| FIGM-ANG-05 | `buildAng05` | ANGULAR_TEMPLATE, GENERIC_ESTREE | VUE_SFC | :938-950 |

**Merge architecture** (source-parser.ts:497-550): `SourceParser.buildASTFromCode` calls `buildRealSyntaxNodes()` once up front, computes `useRealAst*` booleans per rule/framework from the same eligibility functions, and each of its ~25 legacy regex blocks is individually gated with `if (!useRealAstXxx && ...)` — real-AST nodes and legacy nodes are merged into one tree, never both firing for the same rule/framework pair. Confirmed by reading the actual gate conditions (e.g. line 1026 `if (!useRealAstAngular && cTrimmed.includes('@Component({')...)`, line 1069 for ANG-05) alongside the two ANG-03/ANG-04 blocks which have **no such gate** — direct proof they are unconditional regex regardless of framework or real-AST availability.

**`sourceKind` field**: confirmed present (`src/types/ast-spec.ts:43,117`) and populated: `real-syntax-node-builder.ts` sets `sourceKind: 'REAL_AST'` on every node it produces (`pushNode()`, line 181); legacy nodes have no `sourceKind`, and `ast-detection-engine.ts:293` defaults it to `'LEGACY_TEXT_HEURISTIC'` when absent. One gap found: `react-ast-rules.ts`'s `buildReport()` (its FIGM-REACT-02 real-AST path) does **not** set `sourceKind` on the `DiagnosticReport` it returns — a minor provenance-labeling omission on an otherwise-real-AST-backed rule, distinct from the Vue/ANG-03/04 architecture question.

**VERDICT on the prior claim**: **CONFIRMED**, independently re-derived. 23 of 25 rules have real-AST coverage for at least one framework (every rule except FIGM-ANG-03 and FIGM-ANG-04, which are unconditional regex for all frameworks including Angular itself — confirmed by absence of any `useRealAst` gate in their source-parser.ts blocks, cross-checked against `docs/architecture/RULE_ENGINEERING_AUDIT.md`'s own FIGM-ANG-03 knownLimitation text, which independently states the same thing: *"a dedicated Angular template parser (@angular/compiler) has not yet been integrated, so this rule is not yet real-AST for any framework"*). VUE_SFC gets zero real-AST coverage across all 25 rules, structurally guaranteed by `canAttemptRealAstParse()` excluding it at the entry point (real-syntax-node-builder.ts:48-50) before any rule-specific logic runs. One correction to the prior audit's framing: FIGM-REACT-02's real-AST path lives in a **separate, independently-parsed module** (`react-ast-rules.ts`), not in `real-syntax-node-builder.ts` — worth noting because a reader following only `real-syntax-node-builder.ts`'s own doc comment (which says it covers "every rule... migrated" and lists FIGM-REACT-02 nowhere) could wrongly conclude REACT-02 has no real-AST path at all.

---

## Task 3 — Malformed-input / crash resilience (Phase 7/17 supplement)

**CLAIM**: `TypeScriptFrameworkParser.parse()` never throws (error-tolerant `ts.createSourceFile` plus a belt-and-braces `try/catch`, `typescript-framework-parser.ts:28-61`).

**TEST**: `scratch/audit-malformed-input.ts`, invoking `RuleExecutionEngine.analyzeFile()` directly.

```
PASS  [945ms] empty string: diagnostics=0, parseErrors=0, framework=REACT_JSX
PASS  [30ms]  unclosed brace: diagnostics=1, parseErrors=1, framework=REACT_JSX
PASS  [14ms]  deeply nested unclosed braces (500 levels): diagnostics=1, parseErrors=1, framework=REACT_JSX
CRASH [84ms]  deeply nested unclosed braces (20000 levels): Maximum call stack size exceeded
PASS  [81ms]  unicode identifiers + emoji: diagnostics=1, parseErrors=0, framework=REACT_JSX
PASS  [2922ms] large synthetic file (407.3KB, 2000 functions w/ JSX): diagnostics=6001, parseErrors=0
PASS  [29ms]  null bytes / binary garbage: diagnostics=0, parseErrors=0
PASS  [22ms]  extremely long single line (200k chars): diagnostics=0, parseErrors=0
```

**Root-caused the one crash** (`scratch/audit-stackoverflow-trace.ts`) — the exception is a real, uncaught `RangeError` originating **inside the TypeScript compiler's own recursive-descent parser** (`node_modules/typescript/lib/typescript.js`, `parseBlock`→`parseStatement`→`parseList`→`parseBlock`... recursion), but **not** via `TypeScriptFrameworkParser.parse()` (which *is* correctly try/catch-guarded). The actual unguarded call site is `src/analysis/type-checker-service.ts:98` — `TypeCheckerService.checkCode()` calls `ts.createSourceFile()` directly with **no try/catch anywhere in the function**, and `RuleExecutionEngine.analyzeFile()` (`rule-execution-engine.ts:40`) calls it unconditionally, before the guarded real-AST path even runs.

**Blast radius check**: all 5 of FIGM's Next.js API routes calling `analyzeFile` (`app/api/scan/route.ts`, `app/api/scans/route.ts`, `app/api/submissions/route.ts`, `app/api/user-study/log-scan/route.ts`, `app/api/report/route.ts`) wrap their entire `POST`/handler body in `try { ... } catch (err) { return NextResponse.json({error...}, {status:500}) }` — confirmed by reading `app/api/scan/route.ts:11-82`. A crafted "20000 unclosed braces" payload therefore degrades to a caught 500 response for that one request, not a process-wide crash — a real but **moderate**-severity finding (single-request DoS via a very cheap payload — the crash fires in 84ms), sharply less severe than Task 4's findings below.

**VERDICT**: **CONTRADICTED** (partially) — `TypeScriptFrameworkParser` itself is indeed crash-safe as designed, but the claim that malformed input is fully absorbed by the pipeline is **not** true end-to-end: `TypeCheckerService.checkCode()` is a second, unguarded `ts.createSourceFile()`/`ts.createProgram()` call site that a sufficiently deep (but trivially cheap to construct — just repeat `{` 20,000 times) nesting payload can stack-overflow. Real, reproducible, uncaught at the engine layer; caught at the API-route layer.

---

## Task 4 — DynamicProfiler / untrusted code execution (Phase 17 — CRITICAL)

**CLAIM (prior audit)**: DynamicProfiler executes user-submitted source code in-process via `new Function()`.

**IMPLEMENTATION** (`src/engine/dynamic-profiler.ts:34-137`, `DynamicProfiler.profileExecution(code)`):
```js
const fn = new Function('React', 'exports', 'require', `
  try { ${executableCode} } catch(e) { return e; }
`);
const res = fn({}, {}, () => ({}));   // require is stubbed to a fn that always returns {}
```
Called **unconditionally**, on every single file, at `rule-execution-engine.ts:38` — `const profile = DynamicProfiler.profileExecution(code);` — before any rule evaluation, with zero opt-out. No `vm` module, no worker thread, no child process, no timeout, no memory cap. Comment above it literally says `// Sandboxed execution evaluation harness` — this is not true; it is direct, unsandboxed, in-process execution.

**LIVE TEST 1 — global access** (`scratch/audit-dynprofiler-safe.ts`, run against this repo's real dev shell, `node --import tsx`):

| Probe | Result |
|---|---|
| `typeof process` | `"PROCESS_IS_VISIBLE:object"` — fully visible, not shadowed |
| `process.env` | `"ENV_KEYS_COUNT:85:SAMPLE:AI_AGENT"` — **actually read 85 real environment variable names from the host process**, first being `AI_AGENT` |
| `process.exit` / `process.abort` | `"HAS_PROCESS_EXIT:function:HAS_ABORT:function"` — both callable |
| `require('fs')` | `"REQUIRE_FS_RESULT:{}:TYPE:object"` — the stub genuinely blocks direct `require()`-based module loading (real, working mitigation) |
| `globalThis`/`Buffer`/`setTimeout` | all fully present — `new Function` executes with full access to the real global scope, only `React`/`exports`/`require` are shadowed |

**LIVE TEST 2 — unhandled async rejection crashes the host process** (same script, probe 7): code containing `Promise.reject(new Error(...)); throw new Error('SYNC_PART_COMPLETED...')` was submitted. The synchronous `throw` was caught correctly by `profileExecution`'s own `try/catch` and returned as a normal (non-crashing) diagnostic result — **but** the `Promise.reject(...)` scheduled on the same tick fires *after* `profileExecution` has already returned, entirely outside any `try/catch` in the call chain. Actual terminal output from this run:
```
Node.js v22.14.0
Error: ASYNC_REJECTION_ESCAPES_TRY_CATCH
    at eval (eval at profileExecution (...dynamic-profiler.ts:3:48), <anonymous>:6:18)
    at Function.profileExecution (...dynamic-profiler.ts:73:19)
```
**The test harness process itself crashed** (bash exit code 1, process terminated) from a single line of submitted code containing an unguarded `Promise.reject`. This is not a caught exception — it is Node's default `unhandledRejection` behavior (process termination) firing on code this scanner ran on its own.

**LIVE TEST 3 — infinite loop hangs the process indefinitely, no timeout** (`scratch/audit-dynprofiler-infloop-parent.mjs`, a subprocess wrapper with a **hard 6-second SIGKILL deadline** used specifically so this probe could never hang the audit's own shell):
```
=== INFINITE LOOP PROBE RESULT ===
elapsedMs: 6022
killedForTimeout: true
exitCode: null signal: SIGKILL
stdout captured before kill: "CHILD_STARTED\n"
VERDICT: CONFIRMED HANG — child never returned from profileExecution within 6000ms; had to be force-killed.
```
Submitted code was exactly `while (true) { }`. The child process never returned control on its own; it had to be forcibly killed. Since `profileExecution` runs synchronously on Node's single event-loop thread with no `setTimeout`/`Worker`/`vm` timeout wrapper anywhere in the call chain, **this blocks the entire server**, not just the requesting connection — every concurrent request to the Next.js server would hang for as long as the malicious payload spins, i.e. forever.

**LIVE TEST 4 — this is not hypothetical: the project's own benchmark methodology already found the identical async-crash bug on real, unmodified third-party code.** While re-running `benchmarks/real-world/run-real-world-benchmark.ts` (Task 6, below) against `vercel/nextjs-portfolio-starter`'s real `scripts/gen-rss.js` file (`const RSS = require('rss'); async function generate() { const feed = new RSS({...}); ... } generate();`), the exact same class of crash fired naturally, unprompted, from ordinary open-source code, three separate times across three of this session's own benchmark reruns:
```
[WARN] Unhandled promise rejection while scanning (see METHODOLOGY.md): TypeError: RSS is not a constructor
    at generate (eval at profileExecution (...dynamic-profiler.ts:3:48), <anonymous>:11:16)
    at Function.profileExecution (...dynamic-profiler.ts:73:19)
    at Function.analyzeFile (...rule-execution-engine.ts:38:37)
```
`require('rss')` resolves to the stub `{}`, so `new RSS(...)` throws inside an `async function`, turning it into a rejected Promise that surfaces later, disconnected from the file that caused it. `benchmarks/real-world/run-real-world-benchmark.ts:257-266` registers its **own** `process.on('unhandledRejection', ...)`/`process.on('uncaughtException', ...)` handlers purely so this *benchmark script* survives to finish writing its results — confirmed by reading its own code and `benchmarks/real-world/METHODOLOGY.md` §6, which documents this exact bug in detail and states explicitly it was *not fixed*, only worked around for the benchmark's own purposes.

**Production blast-radius check**: `grep -rn "unhandledRejection\|uncaughtException" app/` → **no matches**. FIGM's actual Next.js API layer (`app/api/scan/route.ts` and siblings, which call `RuleExecutionEngine.analyzeFile` on arbitrary user-submitted code from the public `/live-scan` page) has **no equivalent process-level safety net**. The benchmark script's own author-added handler is a benchmark-only workaround, not a production mitigation.

**VERDICT**: **CONFIRMED — CRITICAL severity, this is the most serious finding in this section.**
- **Confidentiality**: any submitted code can read `process.env` in full (85 real variable names observed live, including at least one that looks credential/secret-adjacent by name pattern — `AI_AGENT`). On a real deployment this is direct exfiltration of server-side secrets (API keys, DB connection strings, session secrets) to anyone who can submit code to the public scan endpoint.
- **Availability — two independent, both-confirmed-live DoS vectors, neither mitigated in production**:
  1. Infinite/long-running loop → server hangs indefinitely (single-threaded event loop blocked; no timeout anywhere in the call chain). Empirically confirmed via a hard-killed subprocess probe.
  2. Any submitted code whose top-level function is `async` and throws (an extremely common, non-adversarial JS pattern — confirmed to occur by accident in a real, unmodified, popular open-source starter template) → unhandled Promise rejection → **default Node.js behavior terminates the entire process** for every concurrent user, not just the offending request. Empirically confirmed twice: once via a crafted probe (this audit) and independently, three times, via ordinary third-party code (this session's own benchmark reruns, corroborating the project's own prior `METHODOLOGY.md` finding).
- **Partial, real mitigation that does exist**: `require` is genuinely stubbed and blocks direct `require('fs')`/`require('child_process')`-style module loading — filesystem/process-spawn access via the *documented* channel is closed. This does not address `process.env` (a true global, unaffected by the `require` shadow), `process.exit`/`process.abort` (also true globals), or either DoS vector.
- If this scanner's public `/live-scan` page or `app/api/scan` endpoint is exposed to adversarial or even merely careless (real-world, non-malicious) input without additional sandboxing, it should be treated as **remote server-secret-disclosure and full remote denial-of-service**, not "scanner has a known limitation." This is a production-blocking defect, not a benchmark footnote.

---

## Task 5 — Rerun the controlled benchmark (Phase 9/22)

**BEFORE state** (`benchmarks/eval-summary.json`, `docs/evidence/canonical-evaluation.json`, read prior to running anything): `truePositives: 19, falsePositives: 2, falseNegatives: 0, precision: 0.9047619047619048, recall: 1, f1Score: 0.9500000000000001` (≈90.48% / 100.00% / 95.00%).

**COMMAND**: `npm run eval` → `node --import tsx src/eval/evaluation-runner.ts`.

**OUTPUT**:
```
[FIGM EVAL] Exported evaluation reports (JSON, CSV, MD, LaTeX, Canonical) to: benchmarks/, public/eval-results/, docs/reports/, docs/evidence/canonical-evaluation.json
[FIGM EVAL] Empirical Evaluation complete. F1-Score: 95.0%
```

**Byte-for-byte diff** (`git diff benchmarks/eval-summary.json docs/evidence/canonical-evaluation.json`, timestamps excluded): **TP/FP/FN/precision/recall/F1/ruleMetrics/frameworkMetrics are all identical**, zero diff. The only lines that changed were `performanceMetrics` (wall-clock timing/memory): `totalScanDurationMs` 218.25→1309.95ms, `peakMemoryMB` 18.11→146.13MB.

**VERDICT**: **FIXED AND VERIFIED** (matches the prior claim, independently re-derived this session). The detection engine is fully deterministic on the fixed 4-fixture/19-violation testbed — identical confusion matrix across reruns, as expected for a static rule engine with no randomness. The timing/memory drift is expected and benign (wall-clock measurement of the same code under different machine load — this session ran concurrently with another agent's build/dev-server activity per the task brief, which plausibly explains the ~6x timing/8x memory increase; it is not a correctness signal and the codebase's own `evidenceStatus: "CANONICAL_GROUND_TRUTH_VERIFIED"` label is not affected by it).

---

## Task 6 — Rerun the real-world benchmark (Phase 23)

**Runner**: `benchmarks/real-world/run-real-world-benchmark.ts`, clones 5 pinned-commit public repos and scans every file via the real `RuleExecutionEngine.analyzeFile` (same function the production CLI/API use).

**Network access**: confirmed available (`git ls-remote` succeeded repeatedly). However, the sandbox's outbound git connections were **flaky in a specific, reproducible way**: `git clone` invoked via Node's `execFileSync` from inside the benchmark script intermittently failed with `fatal: Could not read from remote repository` (each of 5 full-script attempts got through 1-2 repos before failing on the next clone), while the exact same URL cloned successfully via a plain shell `git clone` run immediately after, and one run even surfaced a Git-for-Windows-specific warning (`warning: failed to restrict file handles ... This is a bug; please report it at github.com/git-for-windows/git`) — pointing to a Windows/Git-for-Windows child-process handle-inheritance issue in this sandbox, not a FIGM defect or a dead repository.

**Resolution**: obtained fresh, current-HEAD (`02ed599d`) results for all 5 repos — 2 via the official script succeeding end-to-end on repeated attempts (`react-crash-2021`, `nextjs-portfolio-starter`, both overwriting `benchmarks/real-world/raw-results/*.json` with real fresh runs), and 3 via an equivalent standalone reproduction (`scratch/audit-scan-precloned.ts`, identical clone→checkout→collect→`RuleExecutionEngine.analyzeFile`-per-file logic, commit-hash-verified, **not** writing to the tracked `raw-results/` files to avoid schema drift — reported inline below instead) for `angular-tour-of-heroes`, `vue-hackernews-2.0`, `vanillawebprojects`, whose checked-in `raw-results/*.json` predate current HEAD by 3 commits (generated 2026-08-18 03:09 against commit `12e256ac`, notably **before** the `0a183838` FIGM-REACT-01 fix commit landed at 03:25 the same day).

**Fresh combined results, current HEAD, all 5 repos, commit-hash-verified**:

| Repo | Files | LOC | FIGM findings | Engine crashes (sync) | Parse errors |
|---|---|---|---|---|---|
| react-crash-2021 | 10 | 340 | 11 | 0 | 0 |
| nextjs-portfolio-starter | 5 | 128 | 2 | 0 | 0 |
| angular-tour-of-heroes | 21 | 609 | 12 | 0 | 0 |
| vue-hackernews-2.0 | 23 | 1396 | 8 | 0 | 0 |
| vanillawebprojects | 21 | 2259 | 81 | 0 | 0 |
| **Total** | **80** | **4732** | **114** | **0** | **0** |

**FIGM-REACT-01 and FIGM-REACT-03 specific counts** (the two previously-fixed false-positive classes, per prior audit claim):

| Repo | FIGM-REACT-01 | FIGM-REACT-03 |
|---|---|---|
| react-crash-2021 | 1 | 0 |
| nextjs-portfolio-starter | 1 | 0 |
| angular-tour-of-heroes | 0 | 0 |
| vue-hackernews-2.0 | 4 | 0 |
| vanillawebprojects | 11 | 0 |
| **Total** | **17** | **0** |

All 17 FIGM-REACT-01 findings were individually inspected (their `offendingCodeSnippet` field, printed by the scan script). Every one is a genuine `array.filter(...)`/`.sort(...)`/`.reduce(...)` call on a lowercase-initial identifier (`matched.filter`, `data.sort`, `amounts.reduce`, `ids.filter`, etc.) — **zero** instances of the originally-reported `Vue.filter(key, filters[key])`-style namespace false positive. This was specifically re-verified against `vue-hackernews-2.0`'s `src/entry-client.js` and `src/store/*.js` — the exact repo and file family the original bug report (`benchmarks/real-world/SPOT_CHECK.md` #14) came from — with the fresh scan showing exactly 8 total findings (was 9 pre-fix per the fix commit's own message; independently reproduced this session: 8).

**VERDICT**: **FIXED AND VERIFIED**. FIGM-REACT-01's `Vue.filter()` namespace-receiver fix (commit `0a183838`) holds at current HEAD, confirmed via a live rescan of the originating repo/file, not just re-reading the commit message. FIGM-REACT-03 shows 0 findings across all 5 repos in this small corpus — consistent with "no false positives observed" but this corpus does not contain a case that would meaningfully stress-test that rule either way (small sample size caveat applies, as `METHODOLOGY.md` itself already states). Zero synchronous engine crashes across 80 files, matching this benchmark's historical claim. The benchmark script's own network-clone step is flaky in this specific Windows sandbox (root-caused to a Node/git-for-windows child-process interaction, not a FIGM code defect) and does not fail gracefully/resiliently on a single bad clone (no per-repo retry, whole run aborts) — a minor robustness gap in the benchmark tooling itself, separate from FIGM's own detection engine.

---

## Task 7 — Self-dogfooding (Phase 25)

**METHOD**: `scratch/audit-dogfood.ts`, calling `RuleExecutionEngine.analyzeFile()` directly (no HTTP) against `app/live-scan/page.tsx`, `app/guidelines/page.tsx`, `src/ast/real-syntax-node-builder.ts`, `src/parser/source-parser.ts`, `app/api/scan/route.ts`.

### Notable finding, not in the prior audit: FIGM's own framework detector misclassifies FIGM's own source files

Two of the five scanned files were misdetected as `ANGULAR_TEMPLATE` despite being plain React/TypeScript:
- `app/guidelines/page.tsx` (a Next.js/React page) → detected `ANGULAR_TEMPLATE`
- `src/parser/source-parser.ts` (a plain `.ts` module, no JSX, no Angular code) → detected `ANGULAR_TEMPLATE`

**Root cause, isolated by binary-searching each file's own line-prefixes through the real, unmodified `SourceParser.parseSource()`** (`scratch/audit-bisect-framework.ts`, `scratch/audit-bisect-guidelines.ts` — bisection calls the actual production function, not a reimplementation):

- `source-parser.ts` self-triggers at line 1046: the object-literal property key `isNgForWithoutTrackBy` (part of this file's own FIGM-ANG-03 legacy-detection implementation) contains the substring `"trackby"` case-insensitively. `detectFramework()`'s Angular-hint check (`source-parser.ts:412-419`) is `lowerCode.includes('trackby')` run against comment/string-stripped code — but `stripCommentsAndStrings()` only blanks comments and string-literal *contents*, not ordinary code identifiers. A real TypeScript identifier merely containing "trackby" as a substring (not Angular's `trackBy` template syntax at all) is enough to flip the whole file's detected framework.
- `app/guidelines/page.tsx` self-triggers at line 701: plain JSX *text content* — `<p>...trackBy DOM reuse... RxJS subscriptions.</p>`, the human-readable documentation prose this page displays to users about the Angular rule category — contains "trackBy" and "RxJS". JSX children text is neither a comment nor a string literal, so `stripCommentsAndStrings()`'s state machine (which only tracks `CODE`/`LINE_COMMENT`/`BLOCK_COMMENT`/`STRING`/`HTML_COMMENT` states) has no state for it and passes it through verbatim into the Angular-hint check.

This is the same underlying defect class as the already-documented-and-fixed "`@Component` in a comment" false positive (`tests/framework-detection.test.ts:181-186`, `docs/audit/ADVERSARIAL_DETECTION_AUDIT.md` finding #1) — comments and string literals are correctly excluded now, but plain code identifiers and JSX text content are not, and this audit found FIGM's own two most Angular-rule-relevant source files (the file that *implements* the Angular rules, and the page that *documents* them to users) both trip it. A misdetected framework changes which `useRealAst*`/`evalXxx` framework gates apply, so this is not cosmetic — it changes which of the 25 rules can fire on the file at all.

**VERDICT on this sub-finding**: **CONFIRMED, novel** (not covered by the prior audit's brief or its referenced fix). A JS/TS/React codebase containing an identifier like `trackByEnabled`, `useRxJsHelper`, or documentation prose mentioning "RxJS"/"trackBy"/"@Component"/"ng-template" in rendered UI text can be misclassified as Angular, independent of any actual Angular code — and FIGM's own repository is a live instance of this.

### Other diagnostics — TP/FP/known-limitation judgment (source read directly, not just diagnostic text)

| File | Rule | Snippet | Judgment |
|---|---|---|---|
| live-scan/page.tsx:309 | FIGM-REACT-02 | `key={i}` inside `rows.map((row, i) => ...)` | **TP** — genuine array-index-as-key |
| live-scan/page.tsx:1277 | FIGM-REACT-02 | `key={idx}` inside a `.map((d, idx) => ...)` | **TP** — genuine array-index-as-key |
| live-scan/page.tsx | FIGM-REACT-01 ×2 | `rows.filter(r => r.type==='added').length` (inline render, no `useMemo`) | **TP by rule's own documented scope** (no cost/size threshold — a known, documented limitation of the rule itself, not an engine bug) |
| live-scan/page.tsx, guidelines/page.tsx | FIGM-PERF-05 ×~10 | inline `onClick={() => ...}` arrow functions in RENDER scope | **TP by rule's own documented scope**; same known-limitation caveat — this pattern is extremely common and usually harmless in practice, which the rule's own `knownLimitation` text already acknowledges |
| app/api/scan/route.ts:3-4 | FIGM-PERF-04 ×2 | `AIRemediationPipeline`/`ScanRepository` imported statically, each referenced only inside an `if`/`try` block | **TP, mechanically correct** — but **known-limitation-caliber overreach**: this is a Next.js **Route Handler** (server-only code, never shipped to a browser bundle). FIGM-PERF-04's entire rationale (`next/dynamic`/`React.lazy` to cut *client* bundle size) does not apply to server-only files, and the rule does not distinguish server-only route handlers from client-shipped pages/components before firing. |
| src/ast/real-syntax-node-builder.ts | FIGM-REACT-01 | `node.attributes.properties.filter(ts.isJsxAttribute)` | **FP** — this is the TypeScript compiler AST's `NodeArray.filter`, a `ts.JsxAttributes.properties` array method call, not a React state/render-loop computation; correctly excluded from `useMemo`-relevance in every real sense, but the rule has no way to know "this file is not a React component" — the same server-vs-client-code blind spot as the PERF-04 case above, one layer deeper (it also doesn't know it's analyzing infrastructure code, not a component) |

**VERDICT**: dogfooding surfaced one genuinely new, non-trivial defect (Angular framework self-misdetection via identifier/JSX-text substring matching) beyond what the prior audit's brief anticipated, plus a recurring "rule fires correctly per its own narrow predicate but the predicate doesn't know if this file is even relevant to the rule's rationale" pattern (server-only files getting client-bundle advice; a compiler-tooling file getting React-hooks advice) that is a known-limitations theme across the tool, not a bug in any single rule.

---

## Task 8 — Rule metadata consistency (Phase 8)

**METHOD**: compared `severity`, `frameworks`, and `knownLimitation` for 5 rules spanning categories (PERF, A11Y, NEXT, REACT, ANG) across `four-layer-meta-model.ts` (declared single source of truth), `rule-registry.ts`'s `RULE_CATALOG` (what `app/guidelines/page.tsx` actually imports and renders), and `figm-spec.json`.

| Rule | Severity match | Frameworks match | knownLimitation match |
|---|---|---|---|
| FIGM-PERF-01 | ✅ HIGH everywhere | ✅ identical | ✅ identical text |
| FIGM-A11Y-05 | ✅ CRITICAL everywhere | ✅ identical | ✅ identical text |
| FIGM-NEXT-03 | ✅ MEDIUM everywhere | ✅ identical | ✅ identical text |
| **FIGM-REACT-03** | ✅ CRITICAL everywhere | ✅ identical | ❌ **MISMATCH** |
| FIGM-ANG-03 | ✅ HIGH everywhere | ✅ identical | ✅ identical text |

**The FIGM-REACT-03 mismatch, verbatim**:
- `four-layer-meta-model.ts` (and therefore `RULE_CATALOG` → `app/guidelines/page.tsx`, the text an end user actually sees): *"No true React-state-binding analysis -- any local variable whose mutation shape matches is flagged, whether or not it is actually component state."*
- `figm-spec.json`: *"State-binding evidence is a file-wide identifier-name search (a useState-destructured binding, a matching setX(...) setter call, or a this.state chain), not full lexical-scope/type-checker binding resolution... Categorically excluded regardless of evidence: document/window/navigator/location/history/localStorage/sessionStorage/router root identifiers and any *.current ref-access chain."*

These describe **different implementations**. The `four-layer-meta-model.ts` text describes the *old*, pre-fix behavior ("any local variable... flagged whether or not it is actually component state" — no exclusions, no evidence requirement). The `figm-spec.json` text accurately describes the **current** `buildReact03`/`isProvableStateTarget`/`NON_STATE_ROOT_IDENTIFIERS` implementation independently confirmed by direct source reading in Task 2 above (real-syntax-node-builder.ts:444-447, 626-630). `figm-spec.json` was updated when the rule was improved; `four-layer-meta-model.ts`'s `knownLimitation` field was not.

**Note on `RULE_CATALOG`/guidelines UI**: `rule-registry.ts:34,54` does map `knownLimitation` through from `FOUR_LAYER_MAPPINGS`, and `app/guidelines/page.tsx:468` renders it (`<strong>Known limitation:</strong> {rule.knownLimitation}`) — so this is **user-facing**, not merely an internal inconsistency between two data files nobody reads. A user viewing FIGM-REACT-03 on the public guidelines page today sees a description of the rule's limitations that understates how much the detection logic has actually been narrowed/improved since that text was written, and omits the real (and more useful) documented exclusion list.

**VERDICT**: **DOCUMENTATION-IMPLEMENTATION MISMATCH**, confirmed, for FIGM-REACT-03 specifically. Severity and framework-support fields are consistent across all 5 sampled rules (no drift found there). The one drift found is narrow in scope (a single rule's `knownLimitation` prose) but user-visible and stale relative to the actual current, more sophisticated implementation — an easy, low-risk fix (copy `figm-spec.json`'s current text into `four-layer-meta-model.ts`'s `knownLimitation` field for FIGM-REACT-03) that this audit did not apply, per instructions not to modify application source.

---

## Summary of artifacts produced this session

All throwaway scripts kept under `scratch/` per instructions (not deleted): `audit-dynprofiler-safe.ts`, `audit-dynprofiler-infloop-child.ts`, `audit-dynprofiler-infloop-parent.mjs`, `audit-malformed-input.ts`, `audit-stackoverflow-trace.ts`, `audit-dogfood.ts`, `audit-framework-misdetect.ts`, `audit-bisect-framework.ts`, `audit-bisect-guidelines.ts`, `audit-strip-test.ts` (unused/superseded by the bisection scripts — kept for transparency), `audit-metadata-check.ts`, `audit-single-repo-scan.ts` (superseded by `audit-scan-precloned.ts`, kept for transparency), `audit-scan-precloned.ts`.

Modified-by-legitimate-rerun (not hand-edited): `benchmarks/eval-summary.json`, `docs/evidence/canonical-evaluation.json` and their downstream mirrors (Task 5, `npm run eval`), `benchmarks/real-world/raw-results/react-crash-2021.json`, `benchmarks/real-world/raw-results/nextjs-portfolio-starter.json` (Task 6, official benchmark script's own output). No application source code was modified.
