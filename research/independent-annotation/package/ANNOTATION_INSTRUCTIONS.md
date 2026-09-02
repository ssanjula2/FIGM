# Independent Annotation — Instructions

Thank you for reviewing this material. You are acting as an **independent code reviewer**,
checking whether specific front-end code files contain quality/accessibility defects, without
knowledge of what a separate, automated tool already concluded about them.

## What you're doing

You will review the source files in `fixtures/` — a set of short, isolated files spanning React,
Next.js, Angular, Vue, and plain JavaScript/TypeScript (see the file extensions/names for which is
which; a `negative/` subset is deliberately clean code with no intended violation at all — treat it
the same as any other file, just read the code, don't assume anything about which folder a file is
in). For each file, read the code carefully and identify every violation you personally find
against the rule list in `RULE_REFERENCE.md`.

**You do not need to find anything in every file.** Some files may have more issues than others,
and you may disagree with what you'd expect an automated tool to find — that disagreement is the
entire point of this exercise; do not try to guess "the right answer."

## What you do NOT have access to, and should not seek out

- The original, unmodified copies of these files (which contain comments naming the intended
  defect) — you have been given comment-stripped copies specifically so you can't see those.
- Any FIGM scan output, report, or prior analysis of these specific files.
- Any FIGM documentation beyond `RULE_REFERENCE.md` in this package.

If you have separately used the FIGM tool or seen its output on these exact files before, please
say so when you return your results — that would compromise the independence of this annotation.

## How to record what you find

Open `annotation-template.csv` and add **one row per violation you identify**. Columns:

| Column | What to put in it |
|---|---|
| `fixture_file` | The exact filename, e.g. `ReactBenchmark.jsx` |
| `line_number` | The line number (in the file as given to you) where the violation occurs, or the line where the relevant element/statement starts if it spans multiple lines |
| `violation_present` | Always `yes` for a row you're adding (you only add rows for violations you found — see note below) |
| `rule_id` | The closest matching `Rule ID` from `RULE_REFERENCE.md` (e.g. `FIGM-A11Y-01`), or `OTHER` if nothing fits |
| `severity` | Your own severity judgment: `CRITICAL`, `HIGH`, or `MEDIUM` (see the severity scale at the bottom of `RULE_REFERENCE.md`) — this does not need to match the rule's "typical" severity if you think this specific instance is worse or milder |
| `notes` | Optional free text — anything you want to explain about your reasoning, especially for `OTHER` rows |

**Note on "violation_present"**: since you're only logging things you actually found, every row
you add is implicitly "present." The column exists so the comparison step (which also checks
locations you *didn't* flag) has an explicit value to compare against, and so you have a place to
mark a row `no` if you want to explicitly note "I considered this but decided it's NOT a
violation" for something you expect might otherwise look suspicious (this is optional but
welcome — it helps distinguish "didn't notice" from "noticed and rejected").

## What "violation" means here

Judge each file as if you were doing a real code review for a production front-end codebase.
A violation is something that would plausibly cause a real user-facing problem — a broken
accessibility experience, a real performance issue, or a correctness bug — not just a stylistic
preference. Use your own professional judgment for borderline cases; there's no need to
second-guess what "the tool" might say.

## When you're done

Save your completed `annotation-template.csv` and return it. It will be placed in
`research/independent-annotation/submissions/` and compared against the original ground truth
using `npm run research:compare-annotations` (a reproducible script — see the project's
`docs/research/` for the comparison methodology). You will not see the comparison results before
submitting, and the original labels will not be revealed to you as part of this process unless
you request the full study write-up afterward.
