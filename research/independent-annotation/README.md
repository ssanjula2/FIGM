# Independent Annotation Study — Overview

Strengthens `benchmarks/ground-truth.json` (currently 100% researcher-authored) with an
independent second rater, so inter-rater reliability (raw agreement, Cohen's κ) can be reported
alongside FIGM's Precision/Recall/F1 numbers.

**Status: `Independent annotation: PENDING`.** No independent annotator has completed this
process yet. See `docs/research/GROUND_TRUTH_DOCUMENTATION.md` and the Final Report in this
task's conversation record for full detail. Nothing in this directory should be read as a
completed study.

## Layout

```
research/independent-annotation/
  README.md                        <- this file
  package/                         <- SEND THIS to an independent annotator. Self-contained, blind.
    ANNOTATION_INSTRUCTIONS.md
    RULE_REFERENCE.md
    fixtures/                      <- benchmark fixtures with "Defect: FIGM-..." comments stripped
    annotation-template.csv        <- blank; annotator fills this in and returns it
  internal/
    blinded-ground-truth.json      <- DO NOT SHARE. Original labels + blinded-file line mapping.
  submissions/                     <- completed annotator CSVs go here (none present yet)
```

## Workflow

1. **(Done)** Generate the blind package: `npm run research:generate-annotation-package`. Reads
   `benchmarks/testbed/*` + `benchmarks/ground-truth.json`, writes `package/fixtures/*` (defect
   comments stripped) and `internal/blinded-ground-truth.json` (kept out of `package/`).
2. **(Pending)** Hand `package/` to a real, independent human annotator — someone who has not
   seen `benchmarks/ground-truth.json`, this repository's FIGM scan output for these files, or
   this task's conversation history. Not a role Claude can fill in this same session: an
   annotator who was shown this repository's context is not independent of it.
3. **(Pending)** Annotator returns a completed `annotation-template.csv`. Place it in
   `submissions/<annotator-id>.csv`.
4. Run `npm run research:compare-annotations -- submissions/<annotator-id>.csv` to compute raw
   agreement, Cohen's κ, and a confusion matrix against `internal/blinded-ground-truth.json`.
   The script refuses to run with fabricated/placeholder input and reports
   `Independent annotation: PENDING` if no submission file is given.

## Regeneration trigger

Per this task's own dependency rule: if `benchmarks/testbed/*` or `benchmarks/ground-truth.json`
change (e.g. a future AST migration stage changes what the tool detects), re-run step 1 before
any new annotation round, and any annotation collected against a prior fixture version should be
treated as stale.
