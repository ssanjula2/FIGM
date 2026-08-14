# Independent Annotator Submissions

**This directory is currently empty.** No independent annotator has submitted a completed
annotation yet. This file exists only so the directory itself is tracked in git (git does not
track empty directories) — it is not a placeholder for a result, and its presence should never be
read as evidence that annotation has occurred.

## What belongs here

Exactly one file per completed independent annotator submission: a filled-in copy of
`research/independent-annotation/package/annotation-template.csv`, named
`<annotator-id>.csv` (e.g. `annotator-01.csv`). Nothing else.

## What does NOT belong here

- Synthetic, self-generated, or test-fixture CSVs of any kind. Pipeline tests that exercise
  `scripts/compare-annotations.ts`'s matching/kappa logic (see
  `tests/independent-annotation-pipeline.test.ts`) build their test CSVs in a temporary OS
  directory and pass the path explicitly on the command line — they never write into this
  directory, specifically so nothing in `submissions/` can ever be mistaken for a real
  annotation.
- Anything produced by Claude or any other AI acting within this project's own context. An
  annotator who has seen this repository's ground truth, FIGM's own scan output, or this
  project's development history is not independent of it (see `../README.md`).

## Once a real submission is added

Run `npm run research:compare-annotations -- research/independent-annotation/submissions/<file>.csv`
(or simply `npm run research:compare-annotations` — it auto-discovers the first `.csv` file found
here) to compute raw agreement, Cohen's kappa, and a confusion matrix against
`../internal/blinded-ground-truth.json`, written to `../results/`.
