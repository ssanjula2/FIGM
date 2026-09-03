# Stage 7C — Live Scanner Engine Diagnostics Audit (Section 5A)

Scope: audit whether the Live Scanner's "Scan engine diagnostics" figures (previously shown as
`⏱️ 66.31 ms` / `💾 1.90 MB`) are real, auditable measurements, and fix them if not — tracing the
full path from UI → API response → scan engine/profiler → the actual measurement call, per the
task's explicit instruction not to assume they are real because they are numeric.

## What the trace found

The trace (`app/live-scan/page.tsx` → `app/api/scan/route.ts` → `RuleExecutionEngine` →
`DynamicProfiler` in `src/engine/dynamic-profiler.ts`) found the figures were **not** pure real
measurements. `DynamicProfiler`'s `buildProfileMetrics()` captured a real base reading —
`perf.now()` elapsed time and a `process.memoryUsage().heapUsed` delta around the sandboxed
execution step — but then added a synthetic formula on top of both, under a function literally
commented `// 100% Dynamic Code Structural Analysis Engine`:

```
executionTimeMs = max(0.12, baseTime + lineCount*0.04 + loopCount*2.8 + allocCount*0.45 + nestingDepth*4.2 - (isHoisted?2.5:0))
peakMemoryMb    = max(0.20, baseMemory + lineCount*0.008 + loopCount*0.35 + allocCount*0.12 - (isHoisted?0.25:0))
```

`lineCount`/`loopCount`/`allocCount`/`nestingDepth` were computed by regexing the *submitted source
text* — a static shape heuristic, not anything that happened during execution. This is exactly the
"estimated from issue count" / "derived from another unrelated metric" fabrication pattern the task
explicitly prohibits, dressed up as a dynamic profiling result. It silently overstated every real
scan's timing/memory (worse for larger files, independent of how fast the sandbox actually ran),
and both figures were floored at a hardcoded minimum (0.12ms / 0.20MB) that a real measurement could
never honestly report as a genuine reading.

Two further hardcoded-fallback sites were found downstream of the same fabrication, both using the
`|| <number>` pattern (silently substituting a fixed value whenever the real one was falsy, which
would include a legitimate near-zero real reading, not just "missing"):
`app/api/scan/route.ts` (`scanResult.profile?.executionTimeMs || 0.12`, `... || 0.45`, in the
scan-history persistence path) and `src/reporter/report-generator.ts` (`|| 0.15`, `|| 0.5`, in the
multi-file aggregate report). A third, related issue: `"Rules Checked"` and the scanning-state copy
("Running all 50 FIGM guideline rules...") hardcoded the literal `50` instead of reading the real
rule-registry count.

## Fix

- `src/engine/dynamic-profiler.ts`: `buildProfileMetrics` now returns the real, unmodified deltas
  only. `executionTimeMs = Math.max(0, endTime - startTime)` (the `Math.max(0, ...)` guards only
  against theoretical negative clock jitter, never a "looks real" floor). `peakMemoryMb` is the real
  `(endMemory - startMemory) / (1024*1024)` when both readings are available, or `null` (never a
  fabricated placeholder number) when the runtime exposed no memory API. Negative deltas (GC ran
  mid-scan and freed more than was allocated) are returned as-is, never clamped positive. The
  `DynamicProfileMetrics` interface, its `measurementType` field (renamed values:
  `'MEASURED' | 'UNAVAILABLE'`, replacing the misleading `'ESTIMATED'`), and every regex-based
  static-shape computation were removed. A precision doc comment now states exactly what the memory
  reading is: FIGM's own server process's heap delta around spawning/waiting for the sandboxed
  child, not a direct reading of the child's own memory (the sandbox runner does not currently
  report its own `memoryUsage()` back) — a real, disclosed limitation, not glossed over.
- `app/api/scan/route.ts` / `src/reporter/report-generator.ts`: removed the `|| 0.12`/`|| 0.45`/
  `|| 0.15`/`|| 0.5` hardcoded-fallback pattern; use the real value directly (`?? 0` only where a
  non-nullable DB column requires *some* numeric value and the field is null, documented as "not
  measured this run," never a plausible-looking invented reading).
- `app/live-scan/page.tsx`: replaced the small "Scan engine diagnostics" caption with a compact
  **Engine Diagnostics** panel: **Scan Duration** (tooltip: *"Elapsed time used by the FIGM analysis
  engine to parse and analyze this submitted source."*), **Engine Memory Delta** (never "Memory
  Usage" — this is a delta, not a total), **Source Units Analyzed** (`1` — this scanner analyzes one
  pasted/uploaded source at a time), **Rules Evaluated** (real `TOTAL_RULE_COUNT` from the rule
  registry, replacing the hardcoded `'50'`), and **Scan Status** (the real
  `analysis.figmStatus`). An explicit note is always shown: *"Engine diagnostics describe FIGM's own
  analysis execution. They are not runtime performance measurements of the scanned application"* —
  linking to `/performance` and naming Static Performance findings and the separate Runtime FCP/TTI
  Experiment as the places a real runtime-performance claim is ever made.
- New shared formatting module, `src/lib/engine-diagnostics-format.ts` (pure functions, unit-tested):
  `formatScanDuration` (ms below 1s, `X.XX s` at/above — formatting only, never a different
  measurement), `formatMemoryDelta` (renders `null` as `"Unavailable"`, a negative value as-is with
  a `"(GC reclaimed more than this scan allocated)"` explanation, never clamped positive), and
  `formatScanEngineStatus` (maps the real `figmStatus` enum to display text, never inventing a
  status). Also applied to `app/history/page.tsx` and `app/reports/[id]/page.tsx` (same underlying
  persisted metric, now formatted consistently everywhere it surfaces — the "Peak Memory" label on
  the report page was also corrected to "Engine Memory Delta").
- `app/live-scan/page.tsx`: `"Rules Checked"` and the scanning-state copy now read `TOTAL_RULE_COUNT`
  from `src/matrix/rule-registry.ts` instead of a hardcoded `'50'`.

## API / data model (5A.7) and persistence (5A.8/5A.9)

No new parallel schema was introduced — `ScanResult.profile` (`RuleExecutionEngine`'s existing,
already-canonical field) remains the single source of truth for engine diagnostics end-to-end;
Live Scan, History, and Report all read the same value, never a page-specific recomputation. The
persisted `scan_reports.scan_time_ms` / `memory_usage_mb` columns are unchanged (`Float`,
non-nullable) — no schema migration was introduced, since a genuinely-unmeasured memory reading is
only a theoretical possibility on the server-side persistence path (Node's `process.memoryUsage()`
is always available in this deployment's real runtime); raw numeric values are stored, formatting
happens only at the UI layer via the new `engine-diagnostics-format.ts` functions.

## Regression tests (5A.3)

`tests/dynamic-profiler-real-measurements.test.ts` (12 tests, registered in `package.json`'s `test`
script): a real call to `DynamicProfiler.profileExecutionAsync` returns a finite, non-negative
duration; a large/heavily-looped source's duration does not blow up relative to trivial code the way
the removed static formula would have (a direct regression guard against the fabrication
reappearing, not just a type check); `peakMemoryMb` is a real number or exactly `null`, never the
old hardcoded floors; the old fabrication's source patterns (`loopCount * 2.8`, the
`0.12`/`0.20` floors, the `"Dynamic Code Structural Analysis Engine"` comment) are asserted absent
from the file; the `|| 0.12`/`|| 0.45`-style hardcoded-fallback pattern is asserted absent from both
downstream consumers; `formatMemoryDelta`/`formatScanDuration`/`formatScanEngineStatus` are directly
unit-tested for the null/negative/formatting-boundary cases; the Engine Diagnostics panel's actual
rendered field labels are asserted to never themselves be FCP/TTI/LCP/INP/CLS/Web Vitals (scoped to
the labels, not the surrounding disclaimer prose, which correctly *names* those terms only to negate
them — the same honesty pattern `/performance` already uses); and `"Rules Checked"`/the scanning
copy are asserted to no longer hardcode `50`.

## Live browser verification (5A.10)

Performed against a real `next build` + `next start` production server, with a real engineering
test account (never a research participant). All three required scan types were run and produced
different, plausible, non-fabricated Engine Diagnostics values — never the old hardcoded floors
(0.12ms / 0.20MB / 0.45MB), never identical across runs:

| Scan | Result | Scan Duration | Engine Memory Delta | Scan Status |
|---|---|---|---|---|
| Clean (0 violations) | Quality 100, 0 issues | **75.55 ms** | **0.14 MB** | Complete |
| Violation (3 findings) | Quality 69, 3 issues | **79.97 ms** | **0.14 MB** | Complete |
| Malformed/partial (unclosed function, invalid expression) | Quality 70, 2 issues | **59.42 ms** | **0.11 MB** | Partial (best-effort parse recovery) |

These are engineering verification examples only, recorded to prove the metric is real and
functioning across all three scan states — **not RQ1 data**, not collected under RQ1's frozen
protocol/environment, and never to be cited as such. No console errors were observed in any of the
three runs.

## Report fields

```
SCAN_ENGINE_DIAGNOSTICS: PASS

SCAN_DURATION_SOURCE: src/engine/dynamic-profiler.ts, buildProfileMetrics() -- perf.now() delta
  (globalThis.performance.now(), Date.now() fallback only if performance is unavailable) around
  DynamicProfiler.profileExecution(Async)'s execution step (sandboxed child-process run on the
  server via runInSandboxProcess(Async), or direct new Function() evaluation in a browser with no
  server sandbox). No formula/derivation applied on top of the real delta.

SCAN_DURATION_REAL_MEASUREMENT: YES

MEMORY_METRIC_LABEL: Engine Memory Delta

MEMORY_METRIC_SOURCE: src/engine/dynamic-profiler.ts, buildProfileMetrics() -- endMemory - startMemory,
  where both come from getHeapUsed() (process.memoryUsage().heapUsed on the server; the browser's
  performance.memory.usedJSHeapSize where exposed). This is FIGM's own server process's heap delta
  measured immediately before spawning and immediately after the sandboxed child process exits --
  not a direct reading of the sandboxed child's own memory (the sandbox runner does not currently
  report its own memoryUsage() back to the parent; disclosed as a real, known precision limitation
  in the field's doc comment, not fixed this stage -- see "Known limitation" below).

MEMORY_METRIC_REAL_MEASUREMENT: YES

ENGINE_DIAGNOSTICS_PERSISTED: YES (scan_reports.scan_time_ms / memory_usage_mb, real values, no
  schema change -- see "API / data model and persistence" above)

ENGINE_DIAGNOSTICS_CONSISTENT_ACROSS_HISTORY_REPORT: YES (Live Scan, History, and Report all read
  the same ScanResult.profile-derived, single-source-of-truth persisted value; only the display
  formatting -- now via the shared engine-diagnostics-format.ts functions -- differs, never a
  separately recomputed number)

ENGINE_DIAGNOSTICS_CONFUSED_WITH_RUNTIME_WEB_VITALS: NO

BROWSER_VERIFICATION_EXAMPLE:
- clean scan: 75.55 ms / 0.14 MB
- violation scan: 79.97 ms / 0.14 MB
- partial scan: 59.42 ms / 0.11 MB

RQ1_DATA_USED: NO
```

## Known limitation (disclosed, not fixed this stage)

Engine Memory Delta measures FIGM's own server-process heap growth around the spawn-wait window for
the sandboxed child, not the sandboxed child's own memory directly (`profiler-sandbox-runner.cjs`
does not report its own `process.memoryUsage()` back). This is a real, unfabricated measurement, but
a real precision limitation, documented directly in `DynamicProfileMetrics.peakMemoryMb`'s doc
comment and in this report rather than glossed over. A future pass could have the sandbox runner
report its own memory reading for a more precise child-process figure; out of scope for this stage,
whose task was reading the existing metric honestly, not upgrading the sandbox IPC protocol.

## Verification

`npx tsc --noEmit`: clean. Full suite: **1412/1412 pass** (1400 + 12 new tests in
`tests/dynamic-profiler-real-measurements.test.ts`). Clean `rm -rf .next && npm run build`: **PASS**
(one real ESLint error was found and fixed mid-pass -- an unescaped apostrophe in the new Engine
Diagnostics panel's disclaimer text, `react/no-unescaped-entities` -- confirming the build gate is
live and was not bypassed).

---

# Stage 7C — Final Pre-Vercel Closure

Scope: the full 29-section pre-deployment closure pass building on top of Stage 7B (hardening)
and the Stage 5A Engine Diagnostics audit above, neither of which was redone or weakened. This
section documents what changed, what was verified live in a real browser against a real
`next build`/local production-style server, and what remains explicitly deferred.

## 1. Landing page redesign

`app/about/page.tsx` now composes: `LandingHeader` (new, sticky, real in-page anchors +
`/auth/login`/`/auth/register` CTAs, keyboard-accessible mobile toggle with `aria-expanded`) →
`HeroSection` (rewritten headline/subhead, real domain-count product preview, CTAs to
`/live-scan`/`/guidelines`) → `FeaturesGrid` ("Three Core Domains", real `getDomainCounts()`
counts, never hardcoded) → `FrameworkScope` (new -- React/Next.js/Angular as Primary, Vue as
Additional Support, explicit disclaimer) → `ArchitecturePipeline` (simplified to the real 7-stage
pipeline) → `ResearchOverview` (DSRM methodology, live research metrics) → `FIGMModelSection` →
`BenchmarkSection` (retitled to name the benchmark as controlled/self-authored, not real-world
accuracy) → `ReferencesSection` → `LandingFooter` (rewritten to the Product/Research/Account
structure, no public Admin Panel link).

## 2. Reducing AI-demo feel / provider-name marketing

The old footer's dedicated "Claude AI Remediation" branded link was removed as part of the
Section 10 footer rewrite. This created a real conflict with a Stage 7B regression test
(`tests/standalone-page-removal.test.ts`) that had asserted that exact link's presence. Rather
than silently letting the test fail or restoring branded copy that conflicts with this stage's
own de-branding goal, the test was updated to check the thing it actually cared about: no dead
link to the removed `/ai-fix` page, and a live, working entry point (`/live-scan`, where
AI-assisted remediation actually runs) still present in the footer. See the updated test and its
in-file comment explaining the change.

## 3. Live Scanner visual polish

Verified Engine Diagnostics panel (Stage 5A/Section 5A above) was preserved unmodified. Visual
pass confirmed via live browser walkthrough at 1536px: Source Code Editor, Inspection Results
panel, and Engine Diagnostics fields all render correctly; a real scan (auto-scan, 1.5s debounce)
against the built-in `UserProfile.jsx` sample produced real, non-fabricated Engine Diagnostics
(Scan Duration **101.81 ms**, Engine Memory Delta **0.16 MB**, Source Units Analyzed **1**, Rules
Evaluated **50**, Scan Status **Complete**) and 3 real FIGM Rule Violations with AST evidence
(e.g. `FIGM-PERF-01`, Real AST (TypeScript compiler) evidence quoted verbatim).

## 4. Admin UI — real browser walkthrough

Logged in live as the real admin account (`sanjula@nsbm.ac.lk`, `ADMIN_BOOTSTRAP_PASSWORD` from
`.env`) and walked all 9 admin tabs in a real browser session:

- **Overview**: 39 registered users, 6 projects, 912 scans, Postgres (Supabase) storage provider.
- **Users**: real user table, role management, Reset Pass/Delete actions present (not exercised).
- **Participants**: honestly shows "0 of 0 identifiers have a real record" -- no fabricated
  participant rows.
- **Scan History**: real per-scan Duration column sourced from the same Engine Diagnostics data
  verified in Stage 5A.
- **Research Metrics**: Human Study Status honestly reports `NOT_COLLECTED`, `0/20`.
- **Framework Analytics**: real per-framework scan counts (React 534, Next.js 227, Angular 90,
  Vue/Generic correctly shown as `—` for zero).
- **Rule Analytics**: real scans-analyzed/findings/distinct-rules-triggered totals and a real
  per-rule occurrence table.
- **Audit Logs**: real entries including the admin's own just-performed LOGIN event with a real
  IP address.
- **System Health**: real Node.js runtime status (v22.14.0, live uptime/heap figures), DB
  Connected: Yes.

Console messages and network requests were captured across a fresh page load: **zero console
errors**, and all 4 API calls observed (`/api/notifications`, `/api/scans`, `/api/admin/users`,
`/api/admin/system`) returned `200`.

## 5. AI-assisted fix engineering validation

Re-confirmed the pre-compaction validation artifact (`aifix_result.json` in this session's
scratchpad, produced by a real `curl` call against the running dev server, real Anthropic/Gemini
keys configured): rule `FIGM-PERF-05` was deliberately chosen because it is **not** in the
deterministic-fixer rule set (`fixable_rules.txt`, 30 rules, confirmed by direct grep of the
rule-registry's fixer map -- `FIGM-PERF-05` is absent), forcing the real `AI_ASSISTED_FIX` path
rather than the `AST_DETERMINISTIC_FIX` path. The real API response returned
`engineType: "AI_ASSISTED_FIX"`, `provider: "GEMINI"` (the configured fallback provider actually
served the request), `confidenceScore: 100`, `verified: true`, `verificationStatus: "FIXED"`, and
a real unified diff replacing the inline anonymous callback with a direct handler reference. This
is a genuine round-trip through a live third-party AI provider, not a mocked or hardcoded
response.

## 6. Responsive pass (1440/1280/768/390px)

**Disclosed limitation**: this browser-automation environment's `resize_window` tool does not
actually resize the Chrome viewport (confirmed via `window.innerWidth` remaining at the desktop
width regardless of the requested size). Narrow-viewport screenshots at 768px/390px were
therefore **not achieved live**. The substitute approach taken was a full code-level audit of
every `gridTemplateColumns` on every route under `app/` for a fixed-column count that would not
reflow at narrow widths. This found and fixed **5** such grids (not 4, as recorded pre-compaction
-- a further grep pass this session caught one more):
`FeaturesGrid.tsx`, `HeroSection.tsx`'s product-preview domain tiles, `ResearchOverview.tsx`'s
two grids (DSRM phases and research gaps), and `FIGMModelSection.tsx`'s rule cards grid -- all
converted from a fixed `repeat(N, 1fr)` to `repeat(auto-fit, minmax(Npx, 1fr))`, which CSS Grid
guarantees will drop to fewer columns (down to 1) as the container narrows, with no JavaScript or
media query required. `LandingHeader.tsx` already had an explicit `@media (max-width: 860px)`
mobile-nav breakpoint from its original implementation. Desktop (1440/1280px, both above every
component's stated max-width of 1100px) and the existing sticky-header behavior were visually
confirmed live.

## 7. Basic accessibility UX

`LandingHeader`'s mobile menu toggle has a real `aria-expanded`/`aria-controls`/`aria-label` triad
tied to actual open/closed state (not decorative). `ArchitecturePipeline`'s interactive stage tabs
retain keyboard navigation. `live-scan/page.tsx` carries 15 `aria-*` usages on its interactive
result/diagnostic controls. Static landing sections (feature cards, research-methodology copy) use
semantic heading levels rather than ARIA roles, which is correct for non-interactive content. This
was a code-level + live-browser pass, not a full automated axe-core/Lighthouse accessibility audit
-- disclosed as out of scope for "basic accessibility UX."

## 8. Environment variable documentation

`ENV_VARIABLES.md`'s "Categorized quick reference (Stage 7C)" section classifies every variable
into exactly one of `REQUIRED_PRODUCTION` / `OPTIONAL_PRODUCTION` / `DEVELOPMENT_ONLY` /
`RESEARCH_ONLY`. New regression coverage this session, `tests/env-variable-categorization.test.ts`
(4 tests, registered in `package.json`): all four categories exist; every categorized variable
also has a row in the detailed matrix (no orphaned category-only mentions); no variable is
double-categorized (this test caught and required fixing a false-positive in its own first draft
-- `NODE_ENV` is *mentioned* in `RESEARCH_ONLY`'s explanatory prose without being placed there;
the extraction logic was corrected to parse only each category's actual variable list, not its
surrounding prose); and the three security-critical secrets (`JWT_SECRET`, `REFRESH_SECRET`,
`DATABASE_URL`) are confirmed classified `REQUIRED_PRODUCTION`.

## 9. Engineering test-data separation

Smallest-robust-provenance model, per the task's explicit instruction not to blindly add a new
enum if an existing schema/convention already solves it more cheaply:

- **Immediately effective, zero-migration-risk mechanism** (actually wired into runtime queries):
  `src/lib/engineering-test-accounts.ts`'s `isEngineeringTestEmail()`, matching the
  `engtest[._-]*@`/`curltest*@` email conventions already in organic use across this session's own
  verification accounts. Wired into `src/engine/dashboard-repository.ts`'s `getSummary` (admin-wide
  aggregate only) and `getActivityFeed`, with regression tests in `tests/dashboard-analytics.test.ts`.
- **Prepared but deliberately NOT wired into runtime code**: `AccountType` enum
  (`NORMAL`/`ENGINEERING_TEST`) added to `prisma/schema.prisma`, with an extensive doc comment
  explaining why -- directly citing this session's own tokenVersion incident (a schema field added
  without immediately running `prisma generate`, which silently broke the field at runtime until
  caught). Migration `20260903072448_add_account_type` was generated via `--create-only` and
  confirmed via `npx prisma migrate status` as **NOT applied** to the live database this session
  (re-confirmed just now: "Following migration have not yet been applied:
  20260903072448_add_account_type"). `prisma generate` was deliberately not re-run either, so the
  Prisma Client has no drift risk from an unmigrated field.
- **Cleanup tooling**: `scripts/cleanup-engineering-test-accounts.ts`, dry-run by default, requires
  an explicit `--confirm` flag to delete. Re-run this session in dry-run mode only (found **9**
  real engineering-test accounts against the live Supabase database -- `engtest.stage7b.walkthrough`,
  6 `curltest*` accounts, `curltesta2`/`curltestb2`, and `engtest.section5a` -- listing exact
  cascade counts per account). **No accounts were deleted.**

## 10. Vercel child-process risk

`src/engine/dynamic-profiler.ts` sets `infrastructureUnavailable: true` at the real infra-failure
sites (sandbox runner script not found, sync and async; `spawnSync`/`spawn` throwing; the child
process's own `error` event) -- never for timeout, non-zero exit, or unparseable output, which are
ambiguous (could be the scanned code's own fault, not infrastructure). `buildProfileMetrics()`
surfaces this as `profilerStatus: 'UNAVAILABLE'`, and `app/live-scan/page.tsx` renders an explicit,
honest notice when it fires ("Dynamic profiler unavailable in this environment this run -- static
findings above are unaffected and complete..."), never a fabricated duration/memory reading in its
place. Regression coverage in `tests/dynamic-profiler-real-measurements.test.ts` proves static
findings are returned independent of profiler outcome, and that the UI notice text is actually
present and gated on the real `profilerStatus` signal (not a hardcoded always-on banner).
`docs/deployment/VERCEL_PREVIEW_CHECKLIST.md` Section 9 documents exactly this behavior as the
thing to verify on the first real Vercel preview deploy, since this session cannot itself
authoritatively prove Vercel's serverless sandboxing behaves identically to local Windows
child-process spawning (a real, disclosed limitation -- local verification is necessary but not
sufficient here).

## 11. Vercel Preview Checklist

`docs/deployment/VERCEL_PREVIEW_CHECKLIST.md`, 17 numbered sections: runtime/build config,
required/optional env vars (cross-referencing `ENV_VARIABLES.md`'s categorization), what must stay
unset, database migration status, `prisma generate` requirement, storage provider, `maxDuration`
assumptions, dynamic-profiler verification, and 8 concrete post-deploy smoke-test sections (scan
route, health endpoint, auth, DB read/write, logout regression, static scan, admin
authorization/cross-user isolation, rollback notes).

## 12. Route cleanup / dead links

Re-verified this session by direct grep across `app/`: zero remaining `href="/ai-fix"` or
`href="/security"` references (JSX or nav-object-literal form), confirming the earlier UI-cleanup
task's removal is still fully clean after all of this stage's landing-page rewrites.

## 13. Misleading-claim audit

Re-swept `app/` for the brief's banned-phrase list (`100% accurate`, `guaranteed`,
`industry-leading`, `revolutionary`, `state-of-the-art`, `cutting-edge`, `best-in-class`,
`fully WCAG`, `WCAG 2.2 AA compliant`, `zero false positives`, `production-ready AI`,
`enterprise-grade`). One match was found and inspected: a code comment in
`app/api/user-study/log-scan/route.ts` line 226 ("...no longer **guaranteed** to equal any row's
primary key") -- an internal engineering comment about ID semantics, not a product-facing claim.
No real offenders remain.

## 14. Full local production acceptance

Real `rm -rf .next && npm run build` (clean rebuild, not incremental) completed with **exit code
0**. Live browser walkthrough covered: public landing (`/about`, full scroll to footer), auth
(`/auth/login`, real admin login), user dashboard (`/`, real live-aggregated metrics), Live Scan
(`/live-scan`, real auto-scan + Engine Diagnostics), admin (`/admin`, all 9 tabs), and guidelines
(`/guidelines`, 50-rule catalog with filters). Zero console errors and zero non-2xx API responses
were observed across every page tracked with the console/network tools. Mobile/tablet viewport
rendering was not independently confirmed live (see Section 6's disclosed limitation).

## Report fields (Stage 7C)

```
LANDING_PAGE: PASS
LANDING_STYLE: PASS
LANDING_BROWSER_ACCEPTANCE: PASS (desktop 1536px verified live; see RESPONSIVE_MOBILE below for
  the narrow-viewport limitation)

USER_DASHBOARD: PASS (live-verified: real aggregate counts, real activity feed with masked
  emails, real framework-distribution breakdown)

LIVE_SCANNER_VISUAL_UX: PASS
LIVE_SCANNER_DOMAINS: PASS (Architecture 19 / Static Performance 24 / Accessibility 7 -- real
  registry-derived counts, consistent everywhere they appear: hero product preview, Features
  Grid, admin Rule Analytics)

SCAN_ENGINE_DIAGNOSTICS: PASS (unchanged from Stage 5A -- see that section above; re-verified
  live this session with a fresh scan: 101.81 ms / 0.16 MB)
SCAN_DURATION_REAL: YES
ENGINE_MEMORY_DELTA_REAL: YES
ENGINE_DIAGNOSTICS_WEB_VITALS_CONFUSION: NO

ADMIN_UI: PASS (real browser walkthrough, all 9 tabs, real admin credentials, zero console
  errors, zero non-2xx API responses)

AI_ASSISTED_FIX: PASS (real Gemini round-trip via a rule with no deterministic fixer,
  verificationStatus: FIXED, confidenceScore: 100)

RESPONSIVE_DESKTOP: PASS (live-verified, 1536px)
RESPONSIVE_TABLET: PARTIAL (code-review-verified only -- resize_window tool non-functional in
  this environment, disclosed above; all identified fixed-column grids converted to
  auto-fit/minmax so they mathematically must reflow, but not visually confirmed live at 768px)
RESPONSIVE_MOBILE: PARTIAL (same limitation as RESPONSIVE_TABLET; not visually confirmed live at
  390px)

ACCESSIBILITY_UX: PASS (basic pass only -- keyboard-navigable mobile nav toggle with real
  aria-expanded state, keyboard-navigable pipeline tabs, semantic heading structure; not a full
  automated accessibility audit)

ENVIRONMENT_DOCUMENTATION: PASS (4-category classification, cross-checked against the detailed
  matrix by new automated tests)

ENGINEERING_DATA_SEPARATION: PASS (email-convention filtering is live and enforced today;
  AccountType schema field prepared but deliberately not wired in, migration not applied -- see
  Section 9)

DATABASE_MIGRATION_REQUIRED: YES (20260903072448_add_account_type)
DATABASE_MIGRATION_APPLIED: NO (confirmed via `npx prisma migrate status` this session)

VERCEL_CHILD_PROCESS_RISK: MITIGATED (graceful profilerStatus: 'UNAVAILABLE' degradation path
  exists and is tested; cannot be fully proven without an actual Vercel deployment -- see
  Section 10)

VERCEL_PREVIEW_CHECKLIST: CREATED (docs/deployment/VERCEL_PREVIEW_CHECKLIST.md, 17 sections)

DEAD_LINKS: NONE
MISLEADING_PRODUCT_CLAIMS_REMAINING: NONE

LOCAL_PRODUCTION_BROWSER_ACCEPTANCE: PASS (see Section 14)

TESTS: 1433/1433 PASS (1429 prior + 4 new in tests/env-variable-categorization.test.ts)
BUILD: PASS (clean rm -rf .next && npm run build, exit 0; pre-existing benign
  @vue/compiler-sfc dynamic-require warnings only, unrelated to this stage's changes)

REAL_PARTICIPANTS_CREATED: 0
REAL_RQ1_RUNS_COLLECTED: 0
RQ4_EXPERT_SUBMISSIONS: 0
RESEARCH_FREEZE_V2_REQUIRED: YES (not created this stage, per instruction)

READY_FOR_VERCEL_PREVIEW: YES
READY_FOR_PRODUCTION_DATA_COLLECTION: NO

NEXT_ACTION: Get explicit user approval before (a) applying the 20260903072448_add_account_type
  migration, (b) running scripts/cleanup-engineering-test-accounts.ts --confirm against the 9
  identified accounts, (c) performing an actual Vercel preview deployment (this stage
  intentionally stops short of that), and (d) creating research-freeze-v2 to reflect this stage's
  changes.
```

---

# Stage 7C — Final Visual Product Polish

Scope: a UI/UX/product-presentation pass on top of everything above (landing page redesign, Live
Scanner Engine Diagnostics card redesign, UI chrome cleanup, Vue compiler warning investigation,
dashboard latency review). No detector semantics, RQ1/RQ4 methodology, or Engine Diagnostics
measurement source changed -- only presentation, plus two real bugs found and fixed along the way
(disclosed in full below, not folded quietly into "polish").

## 1. Landing page — product, not dissertation

Reduced the public `/about` page from 10 sections (several of them dissertation-length) down to
the brief's target 9: Header → Hero + product preview → Three Domains → How It Works → Framework
Support → Why FIGM → compact Research Credibility → Final CTA → Footer.

- **Removed from `/about`'s composition** (not deleted from the repo): the full DSRM methodology
  write-up (`ResearchOverview`), the full benchmark methodology write-up (`BenchmarkSection`), the
  academic References/bibliography section (`ReferencesSection`), and the interactive 50-rule
  browser (`FIGMModelSection`, now fully unused and deleted -- its functionality already exists at
  `/guidelines`).
- **New `/methodology` page** (`app/methodology/page.tsx`, public -- added to both
  `middleware.ts`'s `isPublicPath` and `app/AppShell.tsx`'s `isBareRoute`): renders the real,
  unmodified `ResearchOverview` + `BenchmarkSection` content, linked from the landing page's
  compact credibility section ("View methodology →") and the footer.
- **`/references`** (pre-existing, authenticated, unchanged): still renders the real, unmodified
  `ReferencesSection` -- the academic reference list was relocated, never deleted.
- **New compact `ResearchCredibility` section**: four real, verifiable facts (50 canonical rules;
  21 open-source repositories evaluated -- a corpus-size fact, re-verified this session directly
  against `benchmarks/real-world/README.md`'s current tl;dr result, not an accuracy claim, since
  that corpus has no exhaustive ground truth; reproducible experiment protocols; WCAG 2.2-aligned
  static accessibility checks) plus one link to `/methodology`. No P/R/F1, no bibliography.
- **New `WhyFigm` section** ("Why FIGM"): four short, verifiable capability statements (real AST
  analysis, deterministic-first remediation, one framework-independent model, CLI/CI-ready), each
  a fact about how the engine actually works, not a marketing adjective.
- **New `FinalCta` section**: a small closing CTA band before the footer.
- **`FrameworkScope`**: trimmed from a two-sentence paragraph to the brief's exact one-sentence
  note.
- **`HeroSection` product preview**: restyled with a restrained "Scan Complete" status pill (same
  tone system as the Engine Diagnostics badge below) and a mocked "Apply Fix" button-styled
  element (`aria-hidden`, a `<span>` not a `<button>` -- never a real, non-functional focus
  target) alongside the existing real domain-count tiles and one illustrative finding card. Still
  explicitly labelled "Product preview — not a live scan" and never shows a fabricated runtime
  measurement.
- **Footer**: removed the two certification-sounding badges ("ISO/IEC 25010-aligned",
  "WCAG 2.2-aligned static checks" as a badge -- the Accessibility domain card already states the
  same fact honestly without the badge-implies-certification framing); "Methodology" now links to
  the real `/methodology` page instead of an in-page anchor that no longer resolves; added
  "Scan History" under Product.

## 2. Engine Diagnostics — modern card redesign

`app/live-scan/page.tsx`'s Engine Diagnostics panel was rebuilt as a proper card: title + a
compact status badge (`scanEngineStatusBadge()`, new function in `engine-diagnostics-format.ts`,
tone never conveyed by color alone -- every badge pairs an icon and a real text label, full detail
in the badge's `title` tooltip), a real 2×2 metric grid (`.insp-diag-grid`, new CSS class in
`globals.css` -- deliberately a fixed `repeat(2, 1fr)` rather than `auto-fit`, so the layout stays
exactly 2×2 regardless of how wide this nested panel happens to render, collapsing to 1 column
only under 360px) with `lucide-react` icons (`Clock`, `MemoryStick`, `FileCode`, `ListChecks`,
`CheckCircle2`/`AlertTriangle`/`AlertCircle` for the status badge, `HelpCircle` for the expandable
help toggle -- no emoji in the final card), a concise one-line disclaimer (the brief's exact
wording) replacing the old multi-line paragraph, a "Runtime performance →" pointer row, and a
real `aria-expanded` help toggle that reveals the exact per-metric semantics on demand. Values are
the primary visual element (16px bold); labels are secondary (10px uppercase, muted). The
`profilerStatus: 'UNAVAILABLE'` honest-degradation notice from the Stage 5A audit is unchanged and
still renders inside the card.

**Verified live** (production build, `next start`, real admin login, real scan): Scan Duration
**57.44 ms**, Engine Memory Delta **0.35 MB**, Source Units **1**, Rules Evaluated **50**, status
badge "Complete" -- all real, distinct from the earlier Stage 5A live-verification values,
confirming the redesign did not touch the underlying measurement.

## 3. "Rules Evaluated" semantics — investigated, not assumed

Traced `ASTDetectionEngine.evaluateNode` (`src/ast/ast-detection-engine.ts`) directly: it defines
exactly 50 `eval*` rule-check functions (one per canonical rule -- confirmed equal to
`TOTAL_RULE_COUNT` by a new structural test, not assumed), and calls **every one of them
unconditionally** against every AST node in the submitted source, for every framework. A
framework-specific rule's check function internally gates its own match condition on `framework`
(e.g. `evalNext01` returns `false` immediately for a Vue file) -- but the function call itself is
never wrapped in a framework conditional at the call site. This means "Rules Evaluated: 50" is a
real, verifiable execution fact (every rule-check genuinely runs against this submission), not a
registry-size number displayed by lookup that happens to coincide with the real behavior. The
label was kept as **"Rules Evaluated"**; the previously-terse tooltip was replaced with the
brief's precise wording in the new expandable help panel: *"all 50 canonical FIGM rule-checks are
run against every parsed node of this source; framework-specific rules execute but can only match
when this file's framework and AST shape satisfy their condition."* New regression test in
`tests/dynamic-profiler-real-measurements.test.ts` asserts both the 50-function/50-count equality
and that every one of those functions is actually called, unconditionally, from
`evaluateNode`'s own body -- so this can never silently regress into an inaccurate label if a
future rule's call site is added conditionally.

## 4. Vue compiler warning — investigated and found already resolved

Traced the `@vue/compiler-sfc` "Critical dependency" webpack warnings to their real cause:
`@vue/compiler-sfc`'s own compiled `dist` file inlines `consolidate.js`'s entire optional
template-engine `require()` map (pug/twig/liquid/jade/... -- confirmed by grepping the actual
installed `node_modules/@vue/compiler-sfc/dist/compiler-sfc.cjs.js`), none of which FIGM installs
or ever triggers (it only ever parses plain Vue SFC markup, never sets a template `lang`).
`next.config.mjs` already carries a real fix from prior work on this codebase, predating this
session: a scoped `webpack.IgnorePlugin` (matched by both resource name and a `contextRegExp`
restricted to `@vue/compiler-sfc`'s own directory, so it can never shadow this project's real
imports) that stubs out every one of those optional template-engine requires, plus a detailed
in-file history comment documenting two earlier, worse fix attempts
(`serverComponentsExternalPackages`, which broke Vercel's file-tracer; a bare `consolidate: false`
alias, which didn't match compiler-sfc's inlined require pattern) that were tried and reverted.
**Classification: (A) benign warning** -- re-confirmed live this session via a fresh
`rm -rf .next && npm run build`: the exact same two warnings still appear (webpack's
"Critical dependency" diagnostic fires at parse-time on the mere presence of a dynamic
`require()`, independent of whether `IgnorePlugin` later resolves it to nothing -- it cannot be
silenced without patching the third-party dist file), and the build still completes cleanly
(exit 0, all 58 static pages generated). No code change was made here -- the existing fix was
correct and is documented in `next.config.mjs` itself; re-attempting either of the two previously-
reverted approaches would have been a regression. Vue scan functionality itself is covered by
pre-existing tests (`tests/framework-detection.test.ts`, `tests/qa-matrix-framework-variants.test.ts`,
and others) which continue to pass.

## 5. Dashboard latency — one real fix, one real bug found along the way

Investigated `/api/dashboard/summary` and `/api/dashboard/reports` for the dev-log latency the
brief flagged. Findings:

- **Real, safe fix applied**: `DashboardRepository.getSummary()` (`src/engine/dashboard-repository.ts`)
  awaited three independent Supabase/Postgres reads (`getScanRecords`, `getProjects`,
  `getAllUsers`) sequentially, serializing three real network round-trips that have no dependency
  on each other. Changed to `Promise.all`, same query count, same real data -- verified via
  `tests/dashboard-analytics.test.ts`'s existing exact-value aggregation tests, which still pass
  unchanged. `getRecentReports` was checked too: it has only one `await` (the second data source,
  `UserDB.getSubmissionsByUserId`, is synchronous), so there was nothing to parallelize there.
  `LiveDashboardContent.tsx`'s three dashboard fetches (`summary`/`activity`/`reports`) were
  already correctly parallelized with `Promise.all` on the frontend -- only the backend aggregate
  had the sequential-query issue. Also checked and ruled out: neither dashboard route file nor
  `DashboardRepository` itself imports `RuleExecutionEngine`/`SourceParser` or any other part of
  the heavy scan-engine/parser stack (confirmed by reading every import line in both API route
  files and the repository module directly) -- the observed dev-log latency is not explained by
  an accidental heavy-module import into the dashboard request path.
- **Real bug found and fixed, unrelated to latency**: while reading `getRecentReports` for the
  latency review, found it fell back to **three entirely fabricated placeholder reports**
  (`rep_1` "UserProfile.tsx" quality 82, `rep_2` "SearchPanel.component.ts", `rep_3`
  "AppRouter.page.tsx") whenever a user genuinely had zero real scans -- the exact fabrication
  pattern this codebase's own comment two functions above (`getSummary`) documents having already
  removed, missed in that earlier pass. This is a real violation of the no-fabrication standard:
  any user or admin with no real scan history saw three invented "recent reports" presented as
  real. Fixed to return an honest empty array (the dashboard UI already had the correct empty
  state, "No scan reports found. Run a new scan to populate reports.", which this fabrication was
  silently defeating). A pre-existing test (`getRecentReports returns report items`) had encoded
  the fabrication as expected behavior (`reports.length > 0` against a user with zero real scans)
  -- updated to assert the honest empty array instead, plus a new test proving the real-data path
  (a genuinely seeded scan) is still correctly mapped.
- **Not fully attributed**: the specific 8s/11s dev-log figures in the brief were not reproduced
  or precisely explained by this fix alone -- three serialized Supabase round-trips would more
  plausibly total low seconds, not 8-11s, unless the pooler connection was cold. Next.js dev
  mode's on-demand first-compile of a route is a separate, well-documented source of inflated
  first-request timing that this session cannot rule out as a contributing factor without
  production/Vercel measurement. The fix is real and verified regardless of exact attribution;
  full latency characterization is deferred to actual Vercel measurement, per the brief's own
  fallback instruction.

## 6. Standalone-app-shell sync bug (found via the real browser check itself)

Adding `/methodology` as a public route required updating **two** independent hand-maintained
route lists that must stay in sync: `middleware.ts`'s `isPublicPath` (server-side auth gate) and
`app/AppShell.tsx`'s `isBareRoute` (client-side chrome gate). Only the first was updated
initially -- caught live during the Section 7 browser walkthrough below: `/methodology` was
reachable unauthenticated (middleware correct) but rendered wrapped in the authenticated app's
Sidebar/HeaderBar (AppShell stale), an inconsistent, unpolished state for a page this very stage
exists to make more presentable. Fixed by adding the same entry to `AppShell.tsx`. New regression
test (`tests/accessibility-regression.test.ts`) generically asserts every literal single-page
public route in `middleware.ts` also has a matching `isBareRoute` entry in `AppShell.tsx`, so this
class of drift cannot reappear for any future route added to only one of the two lists.

## 7. Real browser check (production build, `next start`, real login)

Ran a genuine `rm -rf .next && npm run build` (exit 0) followed by `next start` on a separate port
(3002, to avoid disturbing the existing dev server), logged in live as the real admin account, and
walked: `/about` (full scroll, hero product preview, all new sections, footer, "Methodology" link
click-through), `/methodology` (standalone rendering confirmed after the AppShell fix above,
DSRM phases, benchmark comparative table with its honest "qualitative estimate, not an empirical
benchmark" disclaimer, human-study 0/20 honest state), `/live-scan` (redesigned Engine Diagnostics
card with real, distinct values, status badge, working help-toggle). Console messages and network
requests were captured fresh on each page: **zero console errors, zero non-2xx API responses**
across every page checked. Both the previously-flagged `/live-scan` (Stage 7C Section 4) and this
session's `/about`/`/methodology` walkthroughs are now covered.

## Report fields (Final Visual Product Polish)

```
LANDING_VISUAL_POLISH: PASS
LANDING_REFERENCES_SECTION: REMOVED_FROM_PUBLIC_LANDING (relocated to the pre-existing
  authenticated /references page, content unmodified)
LANDING_ACADEMIC_OVERLOAD: RESOLVED (DSRM methodology + benchmark write-up relocated to the new
  public /methodology page; landing page reduced to the brief's 9-section target structure)

ENGINE_DIAGNOSTICS_VISUAL_POLISH: PASS
ENGINE_DIAGNOSTICS_LAYOUT: MODERN_PRODUCT_CARD
ENGINE_DIAGNOSTICS_ICONS: PROFESSIONAL (lucide-react: Clock, MemoryStick, FileCode, ListChecks,
  CheckCircle2/AlertTriangle/AlertCircle, HelpCircle -- no emoji in the final card)

RULES_METRIC_LABEL: Rules Evaluated
RULES_METRIC_SEMANTICS: all 50 canonical rule-check functions are unconditionally invoked against
  every AST node of the submitted source, for every framework -- a real, code-verified execution
  fact (see Section 3 above and the new structural regression test), not a registry-size number
  coincidentally displayed

SCAN_DURATION_MEASUREMENT_CHANGED: NO
MEMORY_MEASUREMENT_CHANGED: NO

VUE_COMPILER_WARNING: BENIGN_DOCUMENTED (real fix already present in next.config.mjs from prior
  work on this codebase; re-confirmed via a fresh production build this session; re-attempting
  either of the two previously-reverted approaches would have been a regression -- none made)

DASHBOARD_LATENCY_REVIEW: PARTIAL (one real sequential-query fix applied and verified via
  Promise.all in getSummary; one real unrelated fabrication bug found and fixed in
  getRecentReports; the specific dev-log latency figures were not fully reproduced/attributed to
  either fix -- full characterization deferred to production/Vercel measurement)

MISLEADING_CLAIMS_REMAINING: 0

TESTS: 1443/1443 PASS, 0 fail (full suite re-run after every change in this section; net +10 over
  the prior 1433 -- 4 new env-categorization tests from the closure pass above, plus this
  section's edits to dashboard-analytics.test.ts, dynamic-profiler-real-measurements.test.ts,
  landing-page-claims.test.ts, and accessibility-regression.test.ts)
BUILD: PASS (clean rm -rf .next && npm run build, exit 0; same pre-existing benign
  @vue/compiler-sfc warnings only, confirmed unchanged from before this session)

READY_FOR_VERCEL_PREVIEW: YES
```

---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TknUUqzGqFni8F7U1qepq2
