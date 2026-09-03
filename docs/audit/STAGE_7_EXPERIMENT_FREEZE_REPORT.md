# FIGM Stage 7 — Actual Experiment Freeze Commit and Tag

**Date:** 2026-09-03

## Purpose

Create the real experiment-freeze commit and tag from the working tree already reviewed in Stage 6
(`docs/audit/STAGE_6_PRE_FREEZE_REVIEW_REPORT.md`: `TECHNICAL_FREEZE_READY = YES`,
`EXPERIMENT_FREEZE_READY = YES`). This was not a development pass: no detector logic, research
methodology, or feature content was changed. No real RQ1, expert, or participant data was
collected.

## 1. Re-verification before commit

`git status --short` / `git diff --stat` / `git diff --name-status` against the Stage 6 reviewed
snapshot: **exactly one new path** — `docs/audit/STAGE_6_PRE_FREEZE_REVIEW_REPORT.md` itself,
written at the end of Stage 6 after that stage's own snapshot was captured. No unexplained files.
Nothing stopped or needed reporting beyond this expected, already-accounted-for addition.

Secret-risk recheck: `.env`/`.env.local` absent from `git status` (only the placeholder
`.env.example` present, re-inspected and confirmed template-only); a pattern scan of the full
tracked diff for API-key-shaped, JWT-shaped, and real-Postgres-connection-string content returned
zero matches. **SECRET_RISK: NONE.**

## 2. Final test gate

```
npm test  -> tests 1393, pass 1393, fail 0, cancelled 0, skipped 0, todo 0
npm run build -> exit code 0
```

Both gates passed; proceeded to commit. No test was weakened.

## 3. EXPERIMENT_FREEZE.md updated for the real freeze

Rewrote the document's status line from "NOT YET FROZEN" to "FROZEN," added a "Frozen baseline
summary" block and a "Freeze history" section (Stages 1-7), and recorded every field this task
named: freeze date 2026-09-03, rule-set version 2.1.0, participant target 20, repository corpus 21,
primary framework distribution React 5/Next.js 5/Angular 5, RQ1 conditions (CSR_LOCAL, CSR_GLOBAL,
SSR_LOCAL, SSR_GLOBAL), RQ1 warm-up 1/measured 10 per condition (44 total), consent version 1.0.0,
survey version 1.0.0, ethics CONFIRMED_BY_RESEARCHER, RQ4 expert protocol READY, human-study
protocol READY. Commit SHA field temporarily set to `PENDING_FREEZE_COMMIT_SHA` (not invented).

## 4. Staging

Did **not** run `git add -A`. Staged deliberately by the exact top-level path set present in
`git status --short` (23 entries: `.env.example`, `app`, `audit`, `benchmarks`, `docs`,
`research`, `scripts`, `src`, `tests`, `vscode-extension`, `public`, and 12 individual root files
including `package.json`/`package-lock.json`/`tsconfig.json`/`middleware.ts`/`next.config.mjs`),
matching Stage 6's classification exactly. Post-stage verification: `git diff --cached --name-status`
(423 files, all `A`/`M`, 0 untracked/unstaged remaining) scanned for any `.env`/secret/credential-
shaped filename — none found beyond the already-verified `.env.example`.

## 5. Freeze commit

```
git commit -m "research: freeze FIGM experiment baseline v1" (full message includes baseline
  summary -- see the commit itself)
423 files changed, 203438 insertions(+), 7707 deletions(-)
```

**FREEZE_BASELINE_COMMIT: `61686e7aabad6f8c2c71b09ca0a5b52c36d08946`**

## 6. Recording the real commit SHA

Replaced `PENDING_FREEZE_COMMIT_SHA` in `docs/research/EXPERIMENT_FREEZE.md` with the real SHA
above. Created a second, documentation-only commit touching exactly that one file (1 insertion, 1
deletion — verified via `git show --stat` before and after):

```
git commit -m "research: record experiment freeze commit sha"
1 file changed, 1 insertion(+), 1 deletion(-)
```

**FREEZE_DOCUMENTATION_COMMIT: `c70d87056dfda8b06bc79612caf0a84ffa5afe77`**

## 7. Tag

Created an annotated tag on the **first** (baseline) commit, not the documentation-only one:

```
git tag -a research-freeze-v1 61686e7aabad6f8c2c71b09ca0a5b52c36d08946 -m "FIGM research
  experiment freeze v1 — rule set 2.1.0, corpus 21, RQ1 protocol frozen, RQ4 expert protocol
  ready, human-study protocol ready."
```

Verified:

```
git show research-freeze-v1 --no-patch  -> tag object -> commit 61686e7aabad6f8c2c71b09ca0a5b52c36d08946
git rev-list -n 1 research-freeze-v1    -> 61686e7aabad6f8c2c71b09ca0a5b52c36d08946
```

The tag resolves to the baseline commit, confirmed both ways.

## 8. Post-freeze state verification

```
git status --short        -> (empty -- clean working tree)
git log -2 --oneline      -> c70d8705 research: record experiment freeze commit sha
                              61686e7a research: freeze FIGM experiment baseline v1
git tag --list "research-freeze-v1" -> research-freeze-v1
```

`docs/research/EXPERIMENT_FREEZE.md` line 13 contains the baseline SHA
(`61686e7aabad6f8c2c71b09ca0a5b52c36d08946`). The second commit (`git show --stat c70d8705`) touched
only `docs/research/EXPERIMENT_FREEZE.md` (1 insertion, 1 deletion) — confirmed documentation-only.
No real RQ1, expert, or participant data collection was started or performed in this stage.

## Final status block

```
FREEZE_STATUS:
FROZEN

FREEZE_BASELINE_COMMIT:
61686e7aabad6f8c2c71b09ca0a5b52c36d08946

FREEZE_DOCUMENTATION_COMMIT:
c70d87056dfda8b06bc79612caf0a84ffa5afe77

FREEZE_TAG:
research-freeze-v1

TAG_POINTS_TO:
61686e7aabad6f8c2c71b09ca0a5b52c36d08946

RULE_SET_VERSION:
2.1.0

PARTICIPANT_TARGET:
20

CORPUS:
21

RQ1_PROTOCOL:
FROZEN

RQ4_EXPERT_PROTOCOL:
READY

HUMAN_STUDY_PROTOCOL:
READY

TESTS:
1393/1393 pass, 0 fail, 0 cancelled, 0 skipped (run immediately before staging/commit)

BUILD:
PASS

SECRET_RISK:
NONE

WORKING_TREE_AFTER_FREEZE:
Clean (git status --short returns empty)

REAL_RQ1_RUNS_COLLECTED:
0

RQ4_EXPERT_SUBMISSIONS:
0

REAL_PARTICIPANTS:
0

NEXT_ACTION:
Execute the real frozen RQ1 44-execution experiment
(node --import tsx research/rq1-experiment/scripts/run-experiment.ts --measured-runs 10
--warmup-runs 1), recruit real independent expert annotator(s) for RQ4
(research/independent-annotation/package/), and begin real human-participant recruitment against
the N=20 target -- all under this now-frozen baseline. Any mid-collection change to a frozen field
requires the documented stop/disclose/version-bump procedure in
docs/research/EXPERIMENT_FREEZE.md ("What must remain frozen"), never a silent edit.
```
