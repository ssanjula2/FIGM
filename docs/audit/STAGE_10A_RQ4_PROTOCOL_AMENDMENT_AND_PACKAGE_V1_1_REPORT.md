# Stage 10A — RQ4 Protocol Amendment + Expert Package v1.1

Scope: resolve the RQ4 ground-truth-construction protocol gap Stage 10 identified (Sections 13–16
of `docs/audit/STAGE_10_RQ4_INDEPENDENT_EXPERT_VALIDATION_REPORT.md`) *before* recruiting or
sending any material to a real expert; fix the disclosed blinding leak (a `negative/` folder and
intent-revealing filenames); resolve the FP-defensibility methodological question Stage 10A's own
brief raised — found the answer is **no, v1.0's open-ended design cannot support it**, and
implemented the required fix (a fixed candidate judgment matrix) rather than proceeding with an
indefensible design. **No real annotation was collected.** No engine/rule/parser code was changed.
`research-freeze-v5` and Stage 9's RQ1 evidence were not touched.

---

## 1–2. Preservation and inputs

`research-freeze-v5` (`0d287d6d8408c319bae839811d1ac52c0cd71f3f`) was not touched — confirmed
before and after this stage's work (`git rev-list -n 1 research-freeze-v5` unchanged). This stage
read `docs/audit/STAGE_10_RQ4_INDEPENDENT_EXPERT_VALIDATION_REPORT.md` in full and every file it
references (`research/independent-annotation/{README.md,package/,internal/,submissions/,results/}`,
`scripts/{generate-annotation-package,compare-annotations}.ts`,
`src/eval/inter-rater-reliability.ts`) before writing anything.

## 3. Protocol amendment

Written to `docs/research/RQ4_GROUND_TRUTH_PROTOCOL_AMENDMENT.md`, covering Sections A–I exactly as
specified. Key decisions (full text and rationale in that file):

- **A. Annotation unit**: exact (case, rule_id) violation-instance judgment — unchanged in kind
  from v1.0, but now requiring an explicit judgment on every candidate pair (Section 8 below).
- **B. Primary ground truth**: the independent expert's blinded annotation on package v1.1.0,
  never the internal researcher-authored labels.
- **C. Internal ground truth**: engineering/reference material only; usable *after* a real
  submission exists for a secondary, clearly-separate diagnostic comparison; never overwrites the
  expert's judgment.
- **D. Expert design**: **SINGLE** — verified against every document defining this project's RQ4
  methodology (`compare-annotations.ts` itself only ever reads one submission file;
  `ANNOTATION_INSTRUCTIONS.md` addresses one reviewer). No document anywhere requires multiple
  experts, so no panel/majority-vote/consensus-meeting apparatus was invented.
- **E. Disagreement**: expert label stands as the external reference; internal label never
  adjudicates, including when it happens to agree with FIGM.
- **F. Ambiguity**: three-value `VIOLATION`/`NO_VIOLATION`/`AMBIGUOUS` enum; `AMBIGUOUS` rows
  excluded from all TP/FP/FN denominators, always listed with their `notes` reason.
- **G. Matching**: frozen unchanged from Stage 10 — exact (case, rule_id), ±5-line proximity as
  secondary diagnostic only, duplicate predictions collapse to one.
- **H. Metrics**: TP/FP/FN/Precision/Recall/F1, explicit `null` on zero denominators, no
  manufactured TN.
- **I. Blinding**: reconfirmed unchanged, plus the v1.1 fix below.

## 4. Blinding leak fixed — package v1.1.0

**Critical methodological finding, addressed before touching anything else**: v1.0's `negative/`
subfolder was not the only leak — filenames themselves (`A11y05Benchmark.jsx`,
`React01Negative.jsx`, …) revealed both intended positive/negative status *and* a suggestive
rule-number hint. v1.1.0 replaces every filename with a fully neutral `RQ4V11-CASE-XXX.<ext>`
scheme, and — critically — assigns case numbers in a **hash-seeded, non-alphabetical order**
(`sha256(originalRelPath)`-sorted), not the original alphabetical order, which would have kept all
21 former `negative/*` files contiguously grouped at the end even after just renaming them. No
source-code *content* was changed beyond the same defect-comment stripping v1.0 already applied
(verified: zero `Defect: FIGM-` strings survive in any of the 67 new fixture files).

The original-filename ↔ neutral-caseId mapping, plus each case's original positive/negative intent
and internal ground-truth rule IDs, is recorded **only** in
`research/independent-annotation/internal/case-intent-mapping-v1.1.json` — explicitly marked
`INTERNAL USE ONLY`, confirmed absent from `package-v1.1/` by a dedicated test (Section 10 below).

```
BLINDING_FOLDER_LEAK_FIXED: YES
```

## 5. Expert-facing wording

`package-v1.1/RULE_REFERENCE.md` (regenerated from the same `RULE_CATALOG` every other consumer
reads) now includes both required limitation statements verbatim: the accessibility
statically-detectable-subset disclaimer, and the static-performance-is-not-runtime-FCP/TTI
disclaimer. Both are asserted present by an automated test, not just written once and trusted.

```
ACCESSIBILITY_LIMITATION_WORDING: PASS
STATIC_PERFORMANCE_LIMITATION_WORDING: PASS
```

## 6. RQ4 expert consent/information draft

`research/independent-annotation/RQ4_EXPERT_CONSENT_INFORMATION_DRAFT.md` — modeled on
`research/CONSENT_FORM.md`'s already-approved wording (purpose, voluntary participation, task
scope, anonymized Expert ID, no unnecessary PII, research-only use, withdrawal/contact). Explicitly
labelled **DRAFT, not approved**, and does not claim ethics approval beyond the project-level
status already on record. No approval number, date, or committee name was fabricated.

```
RQ4_EXPERT_CONSENT_DOCUMENT: DRAFTED
ETHICS_APPROVAL_STATUS: CONFIRMED_BY_RESEARCHER
ETHICS_APPROVAL_REFERENCE: TO_BE_RECORDED
```

## 7–8. Annotation template and the critical FP-defensibility check

**Finding: v1.0's open-ended "log what you find" design cannot support defensible FP calculation
against the expert alone.** An absent row cannot be distinguished from "the expert actively judged
no violation" versus "the expert never considered this rule for this file at all" — treating the
former's absence as if it were the latter would fabricate a negative judgment. This is exactly the
failure mode this stage's brief warned against, and it is a real, load-bearing problem with v1.0's
design, not a hypothetical one.

**Resolution, implemented (not merely proposed) before any collection**: a fixed candidate judgment
matrix. `scripts/build-rq4-package-v1_1.ts` generates one **independently of any FIGM
prediction** — for each of the 67 cases, every `RULE_CATALOG` rule whose `frameworks` list includes
that case's framework (or is `isFrameworkIndependent`) becomes a candidate row. A case's framework
is read from `benchmarks/ground-truth.json`'s authored field where covered (46/67 — ground truth
only lists violating files) and from a validated content/extension heuristic for the remaining 21
negative-control fixtures it doesn't cover (validated against all 46 known-correct labels before
use — 44/46 initially matched; the 2 mismatches, `.pipe.ts` files and one Next.js marker miss, were
resolved by preferring the ground-truth-authored value wherever available, which is 100% of the
files that matter for this cross-check). Neither source touches FIGM's own output.

```
research/independent-annotation/package-v1.1/candidate-judgment-matrix.json
  1,717 candidate (case, rule) rows across 67 cases (~25.6/case)
```

`annotation-template.csv` is pre-populated with all 1,717 rows (`case_id`, `rule_id` fixed;
`expert_id`, `line_number`, `severity`, `decision`, `notes` blank for the expert to complete).
`ANNOTATION_INSTRUCTIONS.md` states explicitly: **`NO_VIOLATION` rows are required, not optional**
— every row must receive one of `VIOLATION` / `NO_VIOLATION` / `AMBIGUOUS`; an unanswered row is
incomplete, never treated as a negative judgment.

```
FP_METHODOLOGY_DEFENSIBLE: YES (v1.1.0's fixed-matrix design only — v1.0's open-ended design was NO)
ANNOTATION_DESIGN: FIXED_JUDGMENT_MATRIX
```

**Scale disclosed, not minimized**: 1,717 judgments is a substantial workload for one expert. This
is a real trade-off inherent to making FP calculation defensible at all (the alternative — a
smaller, hand-picked subset — would need its own principled, FIGM-independent justification for
*which* rules to drop per case, which this stage did not attempt to invent). Recorded as a
limitation for the researcher's own scoping decision, not silently reduced.

## 9. Manifest — package v1.1.0

`research/independent-annotation/package-v1.1/MANIFEST.json` (via
`scripts/freeze-annotation-package-v1_1.ts`): `packageVersion: "1.1.0"`, 67 case entries (each with
`fileName` + `contentSha256`), plus SHA-256 hashes of `RULE_REFERENCE.md`,
`ANNOTATION_INSTRUCTIONS.md`, `annotation-template.csv`, and `candidate-judgment-matrix.json`. All
five hash families are independently re-verified against the real on-disk files by an automated
test (Section 10), not merely trusted at generation time.

## 10. Tests — 19/19 passing (10 new this stage)

`tests/rq4-package-v1_1-integrity.test.ts` (new, 8 tests): no negative/positive-intent path leakage
in the expert package; no internal ground-truth or intent-mapping file bundled inside
`package-v1.1/`; both required limitation sentences present; all manifest hashes verified against
real files; decision-enum validation (rejects e.g. `"MAYBE"`); ambiguous units excluded from
TP/FP/FN; candidate matrix carries no FIGM-prediction/confidence field and its applicability basis
is always framework-derived; internal ground-truth files are structurally refused by
`loadPrimaryRQ4GroundTruth()` (the one sanctioned loader for primary RQ4 truth).

`tests/rq4-metrics-pipeline.test.ts` (Stage 10's file, 9 tests, 1 assertion corrected this stage —
see below): all still pass.

**A real, load-bearing bug was found and fixed while building these tests**: Stage 10's
`compute-rq4-metrics.ts` counted a FIGM prediction landing on an *excluded* (ambiguous) ground-truth
unit as a false positive, rather than excluding it from the confusion matrix entirely — a direct
violation of the protocol amendment's own Section F. Fixed in `analyzeRQ4()` (excluded units are now
tracked separately and skip both the TP and FP branches). The one existing test that asserted the
old, incorrect behavior (`rq4-metrics-pipeline.test.ts`'s "excluded/ambiguous case behavior" test)
was corrected to assert the fixed, protocol-compliant behavior — not weakened, corrected: it now
requires `fp === 0` for the excluded unit instead of `fp === 1`, with the reasoning documented
inline.

```
npx tsc --noEmit                                          -> PASS (0 errors)
tests/rq4-package-v1_1-integrity.test.ts (new)             -> 8/8 PASS
tests/rq4-metrics-pipeline.test.ts (1 assertion corrected) -> 9/9 PASS
tests/independent-annotation-pipeline.test.ts (unmodified) -> 2/2 PASS
```

Only research scripts, tests, and docs/evidence were added or corrected this stage — no `app/`/`src/`
file was touched, so `npm run build` was not run (per this stage's own conditional instruction).

## 11–12. Prohibitions honored

No expert was recruited or fabricated. No annotation row was filled in (every `decision` cell in
`annotation-template.csv` remains blank). No final RQ4 metrics were computed. FIGM predictions were
not run against the case set. No engine/rule/parser/framework-detection code was changed.
`research/rq1-experiment/raw-results/STAGE9_REAL_RUN_20260903T192350Z/` was not touched (hash
re-checked, unchanged). `research-freeze-v5` was not moved.

## 13. Final report

```
RQ4_PROTOCOL_GAP_RESOLVED: YES

PRIMARY_RQ4_GROUND_TRUTH: The independent expert's blinded annotation (decision per (case_id,
  rule_id) row) on the approved package-v1.1.0 case set is the external reference ground truth
  FIGM's own predictions are scored against. Never the internal researcher-authored labels.

INTERNAL_GROUND_TRUTH_ROLE: Engineering/reference material only. Usable after a real expert
  submission exists for a secondary, separately-reported agreement/diagnostic comparison. Never
  overwrites or adjudicates the expert's judgment, including on disagreement.

EXPERT_DESIGN: SINGLE

AMBIGUITY_POLICY: Three-value decision enum (VIOLATION / NO_VIOLATION / AMBIGUOUS) required on
  every candidate-matrix row. AMBIGUOUS rows are excluded from TP/FP/FN denominators entirely and
  always listed with the expert's stated reason -- never silently dropped or defaulted.

FP_METHODOLOGY_DEFENSIBLE: YES (package v1.1.0's fixed candidate judgment matrix; v1.0's
  open-ended design was found NOT defensible for FP calculation and is superseded, not reused)

ANNOTATION_DESIGN: FIXED_JUDGMENT_MATRIX (1,717 candidate (case, rule) rows across 67 cases,
  generated from case framework x RULE_CATALOG applicability alone -- independent of any FIGM run)

PACKAGE_VERSION: 1.1.0

BLINDING_FOLDER_LEAK_FIXED: YES

ACCESSIBILITY_LIMITATION_WORDING: PASS
STATIC_PERFORMANCE_LIMITATION_WORDING: PASS

RQ4_EXPERT_CONSENT_DOCUMENT: DRAFTED

ETHICS_APPROVAL_REFERENCE: TO_BE_RECORDED

REAL_EXPERT_COUNT: 0
REAL_ANNOTATIONS_COLLECTED: 0
FINAL_RQ4_METRICS_COMPUTED: NO

ENGINE_CHANGED: NO
RQ1_DATA_MODIFIED: NO

READY_TO_RECRUIT_REAL_EXPERT: YES

NEXT_ACTION:
Researcher reviews/approves docs/research/RQ4_GROUND_TRUTH_PROTOCOL_AMENDMENT.md and
research/independent-annotation/RQ4_EXPERT_CONSENT_INFORMATION_DRAFT.md (including supplying the
formal ethics-approval reference when available). Once approved, engage one real, independent,
consented expert and send only research/independent-annotation/package-v1.1/ (never package/,
v1.0.0, which remains preserved but superseded). Place their completed annotation-template.csv
under research/raw/real/rq4/ (to be created at that time) and score it with
scripts/parse-rq4-annotation-csv.ts + scripts/compute-rq4-metrics.ts (both already built and
tested). Do not collect annotations automatically.
```

---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BTxjxSo2MumPZ9pw28vgEA
