# FIGM Real-World Benchmark

A benchmark of FIGM's static analysis engine against 21 real, public, third-party GitHub
repositories (React, Next.js, Angular as primary frameworks per the researcher's authoritative
20-30 repository-sample requirement; Vue and generic JS/TS as additional-support entries, not
counted toward that target), as opposed to the hand-written synthetic fixtures in
`benchmarks/testbed/`. Start with `METHODOLOGY.md` section 1 for why that distinction matters
before reading any number in this directory. The corpus grew from an initial 5 repos (§3) to 15
(§8b, 2026-08-25) to the current 21 (§8c, Stage 5, 2026-09-03) — see `METHODOLOGY.md` for the full
history and `docs/audit/STAGE_5_REAL_REPOSITORY_EXPANSION_REPORT.md` for the latest expansion pass.

## Files

| File | What it is |
|---|---|
| `run-real-world-benchmark.ts` | The reproducibility script. Clones each pinned repo and scans it via the same `RuleExecutionEngine.analyzeFile` call the production CLI uses. |
| `generate-corpus-summary.ts` | Run after the above. Derives `repository-manifest.json`, `framework-distribution.json`, `domain-summary.json` (via `primaryResearchDomain()`), and `rule-frequency-summary.json` from `raw-results/*.json` — no re-scanning. |
| `raw-results/*.json` | Raw, per-repo scan output (one file per repo) + `_combined-summary.json` + the derived summary artifacts above. **Unverified tool output, not ground truth.** |
| `raw-results-archive/` | Preserved historical snapshots of `raw-results/` from before each corpus/engine change — never overwritten. |
| `SPOT_CHECK.md` | 18 findings manually verified against real source, with reasoning. The only independently-verified numbers in this benchmark. |
| `METHODOLOGY.md` | Full procedure, network-access verification, real engine/script bugs discovered across every pass, and stated limitations. |
| `SUMMARY.md` | The findings write-up: what this benchmark does and does not establish. |

## Reproduce it

```bash
node --import tsx benchmarks/real-world/run-real-world-benchmark.ts
```

Requires outbound network access to `github.com` (the script clones each repository fresh; it does
not fall back to cached/synthetic data if network access is unavailable — it will fail loudly on
the first `git clone` instead). Clones go to `benchmarks/real-world/.repo-clones/` (git-ignored,
never committed — third-party source code is not tracked in this repository, only FIGM's own scan
output of it). Override the location with `FIGM_BENCHMARK_CLONE_DIR=<path>`.

Each repository is checked out at the exact commit recorded in the `REPOS` array at the top of
`run-real-world-benchmark.ts`. The script verifies the checked-out `HEAD` matches that pinned
commit and refuses to scan otherwise, so a re-run years from now scans byte-identical source even
if the upstream repositories have since changed.

## tl;dr result (current corpus, 21 repos, Stage 5, 2026-09-03)

2,512 files, 320,367 LOC, 2,649 raw findings, 0 engine crashes, 117/2512 files (4.7%) with one or
more parse errors (see `raw-results/_combined-summary.json` and
`docs/audit/STAGE_5_REAL_REPOSITORY_EXPANSION_REPORT.md` for the full breakdown, including two
concrete anomalies investigated and documented — a parser limitation on a common Next.js App
Router syntax shape, and a `FIGM-ANG-01` false-positive class — in `METHODOLOGY.md` §8c). Domain
split via `primaryResearchDomain()`: ARCHITECTURE 393, STATIC_PERFORMANCE 1,578, ACCESSIBILITY 678.
Framework distribution: React 5, Next.js 5, Angular 5 (15 primary-framework repos, meeting the
20-repo corpus-size target), Vue 3, generic JS/TS 3.

**Earlier, smaller-corpus results, preserved for history**: the original 5-repo pass (§3) found 80
files, 4,732 LOC, 268 raw findings, 0 parser failures, 1 discovered async engine bug (see
`METHODOLOGY.md` §6). Manual verification of 18 findings from that pass: 7 clean true positives, 6
true-per-narrow-rule-definition, 5 confirmed false positives — including a reproducible
false-positive class in FIGM-REACT-03 (flags any property assignment as "React state mutation,"
4/4 sampled instances wrong). That 18-finding spot-check remains the only manually-verified sample
in this benchmark (SPOT_CHECK.md) — it has not been re-run against the expanded corpus. Full detail
in `SUMMARY.md`.
