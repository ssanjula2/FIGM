# RQ4 Ground-Truth Protocol Amendment (Stage 10A)

Status: **Amendment adopted, effective for annotation package v1.1.0 onward.** Written before any
real expert data exists (`REAL_EXPERT_COUNT = 0` at the time of writing), resolving the gap
identified in `docs/audit/STAGE_10_RQ4_INDEPENDENT_EXPERT_VALIDATION_REPORT.md` Sections 13–16: the
pre-existing `scripts/compare-annotations.ts` design only ever computed one external annotator's
*agreement with* the internal researcher-authored ground truth (Cohen's κ) — it never defined how
an external annotator's findings *become* the ground truth FIGM's own Precision/Recall/F1 is scored
against. This document is that missing definition.

This amendment does not touch `research-freeze-v5` (the product/engine baseline) or Stage 9's RQ1
evidence, and does not itself constitute expert data collection.

---

## A. Annotation unit

**Exact (case/file, rule_id) violation-instance judgment.** One row = one specific rule's
applicability to one specific case, judged `VIOLATION` / `NO_VIOLATION` / `AMBIGUOUS` (Section F).
Unchanged in kind from v1.0's per-(file, ruleId) matching key; what changes is that every candidate
pair now requires an explicit judgment (Section H/annotation-design decision below), not only
pairs the annotator happened to flag unprompted.

## B. Primary ground-truth rule

**For the approved RQ4 case set (`research/independent-annotation/package-v1.1/`), the independent
expert's blinded annotation is the external reference ground truth FIGM is evaluated against.**
`TP`/`FP`/`FN` (Section H) are computed by comparing `research-freeze-v5`'s own predictions against
the expert's `decision` values — never against `benchmarks/ground-truth.json` or
`internal/blinded-ground-truth-v1.1.json`.

The existing internal, researcher-authored ground truth is explicitly **not** used as the primary
RQ4 truth, per this amendment and per Stage 10's own instruction.

## C. Internal ground-truth role

Internal, researcher-authored labels (`benchmarks/ground-truth.json`,
`internal/blinded-ground-truth-v1.1.json`) remain **engineering/reference material only**. Once a
real expert submission exists, they may be used for a **secondary** agreement/diagnostic comparison
(e.g. "where did the expert and the original fixture author disagree, and why") — reported
separately from, and clearly labeled apart from, the primary RQ4 Precision/Recall/F1 result. They
must never silently overwrite, adjudicate, or take precedence over the expert's judgment (Section
E).

## D. Expert design: SINGLE

This project's frozen dissertation methodology (`docs/research/RQ1_EXPERIMENT_PROTOCOL.md`'s
sibling RQ4 references, `research/independent-annotation/README.md`'s original design intent, and
`ANNOTATION_INSTRUCTIONS.md`'s "*you* are acting as an independent code reviewer" framing) was
built around **one independent expert annotator**, not a multi-rater panel — `compare-annotations.ts`
itself only ever reads a single submission file. No document anywhere in this repository specifies
a required expert count greater than one, a majority-vote procedure, or a consensus-meeting process.

```
EXPERT_DESIGN: SINGLE
```

This is stated, not invented: the methodology never required multiple experts, so no multi-expert
panel is introduced here. If a future stage adds a second independent expert (e.g. to also report
inter-rater κ per the existing, already-defined `computeAgreement`/Cohen's-κ machinery), this
amendment's Section E disagreement rule would need a follow-up amendment defining adjudication
between two *experts* — that is a different, not-yet-needed question from Section E below, which
governs expert-vs-internal-researcher disagreement only.

## E. Disagreement handling (expert vs. internal researcher label)

**If the expert's judgment and the internal researcher-authored label disagree, the expert's label
remains the external RQ4 reference.** The internal label is never used to override, correct, or
adjudicate the expert's judgment — including when the internal label happens to agree with what
FIGM predicted. Disagreements are recorded (Section C's secondary comparison) as a diagnostic
signal about the internal fixtures' own construction, not resolved in FIGM's favor.

## F. Ambiguity

Three-value decision enum, required on every candidate-matrix row (Section H's annotation design):
`VIOLATION`, `NO_VIOLATION`, `AMBIGUOUS`.

- `AMBIGUOUS` rows are **excluded from the TP/FP/FN denominators entirely** — they contribute to
  neither a positive nor a negative judgment.
- Every excluded unit must be listed with its `case_id`, `rule_id`, and the expert's own reason
  (the `notes` column), never dropped silently. `scripts/compute-rq4-metrics.ts` (built Stage 10)
  already implements exactly this: an `excluded: true` ground-truth entry contributes zero to the
  confusion matrix and is counted separately (`excludedUnitCount`).

## G. Matching policy (frozen, unchanged from Stage 10)

```
Exact (fixture_file/case_id, rule_id) match.
±5-line proximity = secondary diagnostic aid only, never the primary match key.
Duplicate FIGM predictions for the same (case, rule) collapse to one before matching.
```

## H. Metrics

```
TP = FIGM predicts (case, rule) AND expert decision = VIOLATION for that (case, rule)
FP = FIGM predicts (case, rule) AND expert decision = NO_VIOLATION for that (case, rule)
     (or no expert judgment exists for that pair at all -- see the FP-defensibility finding below)
FN = expert decision = VIOLATION for (case, rule) AND FIGM does not predict it
Precision = TP / (TP + FP)
Recall = TP / (TP + FN)
F1 = 2 * Precision * Recall / (Precision + Recall)
```

Zero-denominator cases return an explicit `null` with a stated reason (`scripts/compute-rq4-metrics.ts`),
never a silently-substituted 0. **No TN is manufactured** — a true-negative count is only ever
computed when the ground-truth set contains genuine, explicit `NO_VIOLATION` judgments for that
exact (case, rule) pair (which the fixed judgment matrix, Section below, is specifically designed
to guarantee — see the FP-defensibility finding).

### FP-defensibility finding (the reason Section H requires a fixed judgment matrix, not v1.0's open-ended design)

v1.0's "log whatever violations you personally notice" design cannot distinguish two different
real situations behind a missing row: (a) the expert actively considered rule R for case C and
judged it not violated, versus (b) the expert never considered rule R for case C at all. Only (a)
is a real judgment; treating (b) as if it were `NO_VIOLATION` — i.e. treating "FIGM predicted
something the expert didn't happen to also log" as an automatic FP — would fabricate a negative
judgment the expert never made. This is exactly the failure mode Stage 10A's brief warned against
("do not pretend absence of an annotation means NO_VIOLATION").

**Resolution: package v1.1.0 replaces the open-ended design with a fixed candidate judgment
matrix** — every (case, rule) pair the expert is asked about is enumerated in advance
(`candidate-judgment-matrix.json`), and `annotation-template.csv` requires an explicit decision on
every single row. A FIGM prediction is only scored as TP or FP when the corresponding (case, rule)
pair is in the candidate matrix and carries a real expert decision; a FIGM prediction for a
(case, rule) pair outside the candidate matrix is out of the evaluated scope for this round and
reported separately, never silently counted as FP.

```
FP_METHODOLOGY_DEFENSIBLE: YES (only after this amendment's fixed-matrix design; NO under v1.0's
  open-ended design, which is why v1.0 is superseded rather than reused for collection)
```

### Candidate judgment matrix construction (independent of FIGM predictions)

For each case, the candidate rule set = every rule in the frozen `RULE_CATALOG`
(`src/matrix/rule-registry.ts`) whose `frameworks` list includes that case's framework, plus every
`isFrameworkIndependent` rule. A case's framework is read from `benchmarks/ground-truth.json`'s
authored `framework` field where available (46 of 67 cases — ground truth only lists files that
have at least one violation), and from a validated, purely content/extension-based heuristic for
the remaining 21 (deliberately violation-free negative-control fixtures, which never appear in
ground-truth.json at all). **Neither source is a FIGM prediction**: both are authored/objective file
metadata, fixed before this package was assembled and never derived from running the FIGM engine
or reading its output. Framework identity (what kind of file this is) is explicitly permitted
context per Section I below — distinct from violation-truth, which is never touched by this
construction.

Result: **1,717 candidate (case, rule) rows across 67 cases** (`candidate-judgment-matrix.json`) —
large, but a documented, principled subset of the theoretical 67 × 50 = 3,350 maximum, not an
arbitrary or FIGM-tuned selection. The scale (~25.6 judgments/case) is a real workload
consideration for a real expert and is disclosed as a limitation, not minimized.

```
ANNOTATION_DESIGN: FIXED_JUDGMENT_MATRIX
```

## I. Blinding

Unchanged from Stage 10's verified design, reconfirmed for v1.1.0: the expert receives source code,
`ANNOTATION_INSTRUCTIONS.md`, `RULE_REFERENCE.md`, and `candidate-judgment-matrix.json` (which
reveals only which rules apply to which case by framework — not violation truth). They never
receive FIGM predictions, internal expected answers, internal benchmark/TP-FP-FN scores, or any
signal of a case's originally-intended positive/negative status (fixed this stage — see the
Stage 10A report's blinding-leak section).

---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BTxjxSo2MumPZ9pw28vgEA
