# Independent Expert Annotation — Instructions (Package v1.1.0)

Thank you for reviewing this material. You are acting as an **independent code reviewer**,
judging specific front-end code files against a fixed list of rule criteria, without knowledge of
what a separate, automated tool (FIGM) concluded about them.

## What you're doing

This package asks you to make **1717 explicit judgments** across **67 source
files** (in `fixtures/`, neutrally named `RQ4V11-CASE-001` .. `RQ4V11-CASE-067`
— the naming carries no meaning about a file's content). `annotation-template.csv` is
**pre-populated with one row per (case, rule) pair we are asking you to judge** — every row already
has `case_id` and `rule_id` filled in. Your job is to fill in `decision` (and `line_number`/
`severity`/`notes` where applicable) for **every single row**.

This is a closed, fixed-matrix design, not an open "find whatever you notice" exercise — see
`candidate-judgment-matrix.json` for the same (case, rule) list in machine-readable form. The set
of which rules apply to which case was generated solely from each file's framework, before this
package was assembled — it is not a hint about what you will or won't find.

## The `decision` column — required for every row

| Value | Meaning |
|---|---|
| `VIOLATION` | This case's code violates this rule's criteria (as defined in `RULE_REFERENCE.md`). Fill in `line_number` and your own `severity` judgment (`CRITICAL`/`HIGH`/`MEDIUM`). |
| `NO_VIOLATION` | You examined this case against this specific rule and concluded it does **not** violate it. **This is a required, meaningful answer, not a default** — leave `line_number`/`severity` blank. |
| `AMBIGUOUS` | You cannot confidently decide either way (e.g. the rule's criteria don't clearly apply, or the code is genuinely borderline). Explain briefly in `notes`. Ambiguous rows are excluded from accuracy scoring, but the reason is preserved. |

**`NO_VIOLATION` rows are REQUIRED, not optional.** Every row must receive one of the three
decisions above — an unanswered row cannot be distinguished from "you didn't get to it yet" and
will be treated as incomplete, not as a negative judgment.

## What you do NOT have access to, and should not seek out

- Any FIGM scan output, report, or prior analysis of these specific files.
- Any FIGM documentation beyond `RULE_REFERENCE.md` in this package.
- The original, unmodified copies of these files (defect-labeling comments have been removed).
- Which cases (if any) were originally written as deliberately clean/negative examples — this
  package's file naming and layout do not indicate this, and you should not try to infer it.

If you have separately used the FIGM tool or seen its output on these exact files before, please
say so when you return your results.

## Two limitations to keep in mind (see RULE_REFERENCE.md for the full statements)

- **Accessibility** rows: judge only the specific rule's statically detectable criteria — not a
  full WCAG 2.2 conformance review.
- **Static Performance / Architecture** rows: judge only whether the static pattern described is
  present — not a measured runtime performance claim.

## When you're done

Fill in your own `expert_id` (an ID you choose, or one provided to you separately — not your name)
on every row, save `annotation-template.csv`, and return it. It will be placed under
`research/raw/real/rq4/` and scored against your judgments directly — per this project's RQ4
protocol amendment, **your independent judgment is the reference FIGM is measured against**, not
the other way around.
