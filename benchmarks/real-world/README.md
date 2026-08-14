# FIGM Real-World Benchmark

A benchmark of FIGM's static analysis engine against 5 real, public, third-party GitHub
repositories (React, Next.js, Angular, Vue, generic JS), as opposed to the hand-written synthetic
fixtures in `benchmarks/testbed/`. Start with `METHODOLOGY.md` section 1 for why that distinction
matters before reading any number in this directory.

## Files

| File | What it is |
|---|---|
| `run-real-world-benchmark.ts` | The reproducibility script. Clones each pinned repo and scans it via the same `RuleExecutionEngine.analyzeFile` call the production CLI uses. |
| `raw-results/*.json` | Raw, per-repo scan output (one file per repo) + `_combined-summary.json`. **Unverified tool output, not ground truth.** |
| `SPOT_CHECK.md` | 18 findings manually verified against real source, with reasoning. The only independently-verified numbers in this benchmark. |
| `METHODOLOGY.md` | Full procedure, network-access verification, a real engine bug discovered during this run, and stated limitations. |
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

## tl;dr result

80 files, 4,732 LOC, 268 raw findings, 0 parser failures, 1 discovered async engine bug (see
`METHODOLOGY.md` §6). Manual verification of 18 findings: 7 clean true positives, 6 true-per-narrow-
rule-definition, 5 confirmed false positives — including a reproducible false-positive class in
FIGM-REACT-03 (flags any property assignment as "React state mutation," 4/4 sampled instances
wrong) worth fixing. Full detail in `SUMMARY.md`.
