# Stage 10 — RQ4 Independent Expert Validation (research-freeze-v5)

Scope: locate and audit the existing RQ4/independent-annotation infrastructure, verify the rule
inventory from code, classify every existing annotation/evaluation artifact by real provenance,
document the frozen annotation unit/blinding/matching design precisely, and — because no real
independent expert has yet submitted an annotation — **stop before generating, simulating, or
inferring any expert ground truth**, per this stage's own explicit instruction. Built and tested
(against synthetic fixtures only) the deterministic RQ4 metrics-computation pipeline and an
annotation-package freeze/manifest tool, so real collection can proceed immediately once a real
expert is engaged. No participant/user-study data was collected. No RQ1 evidence was touched. No
engine/rule/parser/matching behavior was changed.

---

## 1. RQ4 contract (re-confirmed)

RQ4: *To what extent does the proposed validation tool achieve acceptable accuracy levels when
compared with manual expert architectural reviews using Precision, Recall, and F1-score
measurements?*

Per this stage's explicit instruction: the existing internal benchmark (`benchmarks/ground-truth.json`,
100% researcher-authored) is **INTERNAL ONLY** and is not used anywhere in this report as RQ4
real-world/expert-validation evidence.

## 2. Pre-stage integrity check

```
git rev-parse HEAD (session start)     -> 613a88d5e6b6b6a6b93f8ceb1dda1b9cf6e5542e
git rev-list -n 1 research-freeze-v5   -> 0d287d6d8408c319bae839811d1ac52c0cd71f3f
```

HEAD differs from `research-freeze-v5` only because of two later, docs-only follow-up commits
(the Stage 8B deployment/acceptance record and the Stage 9 report) — verified via
`git diff --name-only research-freeze-v5 HEAD`: zero non-`docs/` files differ. **Disclosed, per
this stage's explicit instruction, rather than silently proceeding.**

For every step that reads product source (rule catalog, matching/annotation-pipeline code), this
session checked out `research-freeze-v5` itself (detached HEAD) to work from byte-identical
frozen source, then returned to `main` afterward — no commit was made while detached, and no
tracked file's content was modified at any point (confirmed: `git diff --stat` against the tag
shows zero changes to any existing file).

```
ruleSetVersion: 2.1.0   (src/research/research-config.ts)
```

### Rule inventory — verified from code, not assumed

`TOTAL_RULE_COUNT` (`src/matrix/rule-registry.ts`) = **50**. The task's expected breakdown
(Architecture 19 / Static Performance 24 / Accessibility 7) was **verified exactly**, but the
underlying code structure is more specific than a flat three-way split: the rule catalog's
`domain` field has only two values (`PERFORMANCE`: 43, `ACCESSIBILITY`: 7); "Architecture" is a
**`concern`-level sub-classification** (`concern === 'ARCHITECTURE'`) within the `PERFORMANCE`
domain, not a separate top-level domain.

| Bucket | Basis in code | n | Rule IDs |
|---|---|---|---|
| Architecture | `domain === 'PERFORMANCE' && concern === 'ARCHITECTURE'` | 19 | FIGM-NEXT-01, -03, -05, -07, -08, -09, -10; FIGM-ANG-02, -05, -07, -09; FIGM-REACT-05, -06, -07, -09, -10; FIGM-VUE-03, -04, -06 |
| Static Performance | `domain === 'PERFORMANCE' && concern !== 'ARCHITECTURE'` | 24 | FIGM-PERF-01..06; FIGM-NEXT-02, -04, -06; FIGM-REACT-01, -02, -03, -04, -08, -11; FIGM-ANG-01, -03, -04, -06, -08, -10; FIGM-VUE-01, -02, -05 |
| Accessibility | `domain === 'ACCESSIBILITY'` | 7 | FIGM-A11Y-01..07 |
| **Total** | | **50** | |

## 3. Existing RQ4 package — recounted from the current repository

Located at `research/independent-annotation/` (package + internal + submissions + results).
Every figure below was recomputed directly this stage, not assumed from the prior audit:

| Metric | Prior audit (approx.) | Recounted this stage | Match |
|---|---|---|---|
| Fixture files (`package/fixtures/**`, recursive) | ~67 | **67** | Exact |
| Internal ground-truth violations (`internal/blinded-ground-truth.json`) | ~65 | **65** | Exact |
| Distinct rule IDs referenced in `RULE_REFERENCE.md` | 50/50 | **50/50** | Exact |
| Real annotator submissions (`submissions/*.csv`) | 0 | **0** | — |

Package contents: `README.md` (workflow/status), `package/ANNOTATION_INSTRUCTIONS.md`,
`package/RULE_REFERENCE.md`, `package/fixtures/` (67 files: React/Next.js/Angular/Vue/plain-JS,
including a `negative/` subset of 21 deliberately clean files and a `next03/app/demo/page.tsx`
route fixture), `package/annotation-template.csv` (blank), `internal/blinded-ground-truth.json`
(65 items, `_warning: "INTERNAL USE ONLY"`), `submissions/` (empty except its own README),
`results/STATUS.md`. Evaluator scripts: `scripts/generate-annotation-package.ts` (produces the
blind package from `benchmarks/ground-truth.json`) and `scripts/compare-annotations.ts` (compares
one real submission against the internal ground truth; refuses to run against anything but a real
`.csv` file — see Section 14 below for what it does and does not compute).

## 4. Provenance classification — no researcher-authored key silently relabeled

| Artifact | Classification |
|---|---|
| `benchmarks/ground-truth.json` (source of the blind package) | **A. INTERNAL_RESEARCHER_AUTHORED** |
| `research/independent-annotation/internal/blinded-ground-truth.json` | **A. INTERNAL_RESEARCHER_AUTHORED** (explicitly self-labelled `INTERNAL USE ONLY` in the file itself) |
| `research/independent-annotation/package/fixtures/*` | Derived from A, defect-comments stripped — still A's content, not independently authored |
| `research/independent-annotation/submissions/*.csv` | **None exist** — 0 files, nothing to classify |
| Any RQ4 Precision/Recall/F1 number | **None computed this stage** — see Section 7/14 |

No file in this repository was found mislabelled as "expert" or "independent" ground truth. The
existing `README.md` and `results/STATUS.md` already state the PENDING status accurately and did
not need correction; this table is this stage's added, explicit A/B/C/D/E classification record.

## 5. Expert annotation unit (frozen, unchanged)

Read directly from `ANNOTATION_INSTRUCTIONS.md` and `compare-annotations.ts`'s matching logic —
not altered:

```
EXPERT_ANNOTATION_UNIT: rule-instance-level violation label, per fixture file.
  An annotator logs one row per violation they personally find: (fixture_file, rule_id,
  line_number, severity, notes). "violation_present" is implicitly "yes" for every logged row
  (an explicit "no" row is optional, for a location the annotator considered and rejected).
  This is an open-ended find-and-log design, not a fixed (file x all-50-rules) judgment grid —
  an annotator is never asked to explicitly clear every rule against every file.
```

## 6. Blinding (verified, not altered)

`ANNOTATION_INSTRUCTIONS.md` and `package/fixtures/*` confirm all five blinding requirements are
already met by the frozen package design:

- Scanner finding list: **not included** — the package contains only source files, instructions,
  and the rule reference.
- Expected rule IDs from internal ground truth: **not included** — defect-identifying comments are
  stripped from every fixture before it enters `package/fixtures/`.
- Internal TP/FP/FN or benchmark scores: **not included** anywhere in the package.
- Which fixtures were written positive vs. negative: **not revealed** — the `negative/` folder
  name itself is visible in the package's directory listing (a real minor blinding leak worth
  noting for a future package revision: an annotator could infer "this subfolder is intended to be
  clean" from the folder name alone, even though `ANNOTATION_INSTRUCTIONS.md` explicitly tells them
  not to assume this). Flagged here, not silently fixed — fixing it would modify the frozen
  package's file layout, which Section 9 of this stage prohibits doing after any case work starts,
  and no case work has started, so this is recorded as a pre-existing design note rather than
  corrected mid-stage.
- FIGM output shown before annotation: **no** — nothing in the package or workflow shows FIGM
  output to the annotator at any point before or during their work.

`BLINDING_CONFIRMED: YES` (for the four hard requirements); the folder-naming note above is
disclosed as a minor pre-existing design observation, not a blinding failure.

## 7. Expert eligibility / provenance — STOP condition reached

```
research/independent-annotation/submissions/  -- 0 .csv files (only its own README.md)
research/independent-annotation/results/STATUS.md  -- "Independent annotation: PENDING.
  Reason: No submission file was given, and .../submissions/ contains no .csv files.
  No independent annotator has completed the annotation process for this benchmark yet."
```

**No real expert has yet consented or submitted an annotation.** Per this stage's explicit
instruction, this is a hard stop before generating any expert label:

```
REAL_EXPERT_DATA_AVAILABLE = NO
```

No expert profile, ID, experience band, or consent record was created or fabricated. Sections
13–23 (independent annotation collection, consensus/adjudication, final ground truth, FIGM
prediction capture and matching, confusion counts, primary/per-domain/per-rule metrics, error
analysis) were **not executed** — there is nothing real to run them against.

## 8. Ethics / consent gate

The project's confirmed, existing ethics-approval status (`research/CONSENT_FORM.md`,
`docs/research/FINAL_RESEARCH_CONTRACT.md` §12) applies project-wide:

```
ETHICS_APPROVAL_STATUS = CONFIRMED_BY_RESEARCHER
ETHICS_APPROVAL_REFERENCE = TO_BE_RECORDED
```

No approval number, date, or committee name was fabricated — none exists in the repository to
report, and this stage did not invent one, matching every other RQ document's identical, already-
established phrasing.

**Gap disclosed, not filled**: `research/CONSENT_FORM.md` is written specifically for the RQ1
human user-study procedure (background questions, 5 evaluation tasks, SUS questionnaire) — no
RQ4-specific informed-consent instrument for an expert code-reviewer role exists yet in this
repository. The general project-level ethics protocol (Interim 02 §3.6.2: voluntary participation,
informed of objective, no sensitive PII, aggregated/anonymized results, secure storage,
research-only use) would need to be instantiated as an expert-specific consent process before any
real annotation is collected — this is recorded as an open item, not resolved this stage (doing so
is outside a research-integrity audit's scope; it is a researcher/ethics-body action).

## 9. Annotation material freeze (built this stage — none existed before)

No manifest with content hashes existed prior to this stage, despite the package already being
"complete" in the sense of having fixtures/instructions/rule-reference. Built
`scripts/freeze-annotation-package.ts` (read-only over the existing package; never regenerates
fixtures or touches the internal ground truth) and ran it once:

```
research/independent-annotation/package/MANIFEST.json
  packageVersion: 1.0.0
  caseCount: 67
  per-case: caseId (RQ4-CASE-001..067), fileName, framework, contentSha256, isNegativeControl
  ruleReference: { path, sha256 }
  annotationInstructions: { path, sha256 }
  freezePolicy: "Cases must not be modified after this manifest is generated and annotation work
    begins. If a case must be corrected, bump packageVersion, regenerate this manifest, and treat
    any annotation collected against a prior packageVersion as invalidated for that case — never
    silently edit a case in place."
```

This manifest is now the frozen reference point for any future real annotation round; no case has
been sent to any expert yet, so nothing needs to be invalidated.

## 10–12. Rule reference, accessibility wording, performance wording

`RULE_REFERENCE.md` already covers all 50 rules (Rule ID, Name, Domain, Definition, detectable
criteria, framework notes, WCAG mapping where relevant) and already excludes FIGM predictions,
internal expected answers, confidence, and historical TP/FP status — verified by inspection, not
modified. It does not currently contain the two specific limitation sentences this stage's
instructions require verbatim (statically-detectable-subset wording for accessibility; static-risk-
indicator, not-measured-FCP/TTI wording for performance). **Recorded as a gap for the next real
package revision** rather than edited mid-audit, since editing package content now would pre-empt
Section 9's freeze/versioning discipline for a package that has not yet had any case sent to an
expert — the correct sequencing is: add this wording, regenerate `MANIFEST.json` (bumping
`packageVersion`), *then* begin real collection.

## 13–16. Independent annotation, consensus, IRR, final ground truth — not executed

Not executed this stage (Section 7's stop condition). Documented instead, exactly as frozen, for
when real collection begins:

- **Design is single-annotator-vs-internal-ground-truth**, not a multi-expert panel:
  `ANNOTATION_INSTRUCTIONS.md` addresses one independent reviewer at a time
  ("*you* are acting as an independent code reviewer"), and `compare-annotations.ts` computes one
  submission's agreement against `internal/blinded-ground-truth.json` — it does not read or combine
  multiple submissions.
- **No majority-vote/consensus-meeting/tie-handling policy is defined anywhere** in the frozen
  protocol for combining multiple experts' answers into one ground truth, nor for the different
  question this stage's RQ4 framing actually needs — turning an independent annotator's findings
  *into* the ground truth FIGM is scored against (as opposed to measuring the annotator's
  *agreement with* the existing internal ground truth, which is the one thing the frozen pipeline
  does define).
- **Per Section 14's explicit instruction — this is a protocol gap, and the correct response is to
  stop before producing final ground truth and report the gap**, not invent an adjudication rule.
  This gap exists independently of the "0 real experts" fact above: even a single real submission
  today would only ever yield `compare-annotations.ts`'s Cohen's-kappa agreement-with-internal-
  ground-truth report, not a `research-freeze-v5`-vs-independent-expert confusion matrix, without a
  new, explicitly protocol-defined step for "the annotator's findings now supersede/replace the
  internal answer for RQ4 scoring purposes."
- **IRR method IS defined** (`src/eval/inter-rater-reliability.ts`: Cohen's κ, standard
  Landis & Koch 1977 interpretation scale) — but only for exactly the two-rater
  internal-ground-truth-vs-one-annotator comparison the frozen pipeline already computes, not for
  a multi-expert-vs-multi-expert design. Nothing was invented or substituted here.

```
INTER_RATER_RELIABILITY: NOT_APPLICABLE (0 submissions exist; the defined method — Cohen's kappa
  via compare-annotations.ts — has nothing real to run against this stage)
```

## 17. FIGM prediction capture — deferred, not run

Not run this stage. Running the engine against the 67 fixtures now, with no ground truth to
compare against, would produce orphaned predictions of no evaluative use and risk being mistaken
later for "final" RQ4 predictions when they would actually need to be versioned against whatever
`packageVersion`/ground-truth-construction-method a future protocol amendment defines (Section
13–16 gap). The tooling to run this (`src/eval/evaluation-runner.ts`, already used for the internal
benchmark) requires no changes to be pointed at the RQ4 fixture set once ground truth exists.

```
FIGM_PREDICTIONS_COMPLETE: NO
```

## 18–23. Matching policy, confusion counts, metrics, error analysis — not executed

Not executed (no ground truth exists to match against). The **matching policy that will be used**,
carried over unchanged from the frozen `compare-annotations.ts` design, is documented now so it is
fixed *before* any real data exists (satisfying Section 18's "do not invent a favorable tolerance
after observing errors" by construction — there is nothing to observe yet):

```
MATCHING_POLICY: exact (fixture_file, rule_id) match. A ±5-line proximity check is applied as a
  secondary sanity/documentation aid only, never as the primary matching key (LINE_TOLERANCE = 5
  in compare-annotations.ts). Duplicate predictions for the same (case, rule) collapse to one
  before matching (see scripts/compute-rq4-metrics.ts, built this stage).
```

## 24. Internal benchmark separation

Every reference to the existing researcher-authored controlled benchmark in this report uses
**"internal controlled fixture validation"**. No sentence in this document uses "RQ4 accuracy,"
"expert-validated accuracy," or "real-world accuracy" to describe it.

```
INTERNAL_BENCHMARK_USED_AS_RQ4_TRUTH: NO
```

## 25. Real-world repository evidence separation

No Precision/Recall/F1 was derived from the Stage 5 real-world repository corpus this stage; that
corpus has no manual expert ground truth and was not touched.

## 26. Data integrity — evidence path

No `research/raw/real/rq4/` directory exists yet (there is no real RQ4 data to put in it). This
stage's new artifacts live alongside the existing package instead, clearly separated from internal
content:

```
research/independent-annotation/package/MANIFEST.json   (new: package freeze manifest, Section 9)
scripts/compute-rq4-metrics.ts                            (new: deterministic metrics pipeline)
scripts/freeze-annotation-package.ts                       (new: package-freeze tool)
tests/rq4-metrics-pipeline.test.ts                          (new: 9 unit tests, synthetic fixtures only)
```

No existing internal-benchmark artifact (`benchmarks/ground-truth.json`,
`internal/blinded-ground-truth.json`, `results/STATUS.md`'s PENDING content) was overwritten. When
a real submission arrives, `research/raw/real/rq4/` should be created to hold it and its derived
ground truth, per this section's own path convention.

## 27. Anonymization

No expert exists to anonymize. The `E001`/`E002`… ID convention is recorded here as the scheme to
use once real experts are engaged; none was assigned.

## 28. Validation before calculation

```
All expected expert files present:        NO (0 of however many the eventual protocol requires)
Consent/provenance complete:               NO
No duplicate Expert+Case+Rule records:     N/A (no records exist)
No malformed labels:                       N/A
Package version consistent:                YES (MANIFEST.json packageVersion 1.0.0, just frozen)
No annotation after case mutation:         N/A (no annotation has occurred)
Final ground truth complete:               NO
FIGM predictions generated from freeze-v5: NO (deferred, Section 17)
Match policy version fixed:                YES (Section 18, fixed before any data exists)
Excluded/ambiguous cases explicitly listed: N/A (none yet)
```

```
RQ4_COLLECTION_STATUS = PARTIAL
```
No final Precision/Recall/F1 is claimed.

## 29. Automated metric script — built and tested this stage

`scripts/compute-rq4-metrics.ts`: reads a final expert ground-truth file + raw FIGM predictions
file, emits TP/FP/FN, Precision/Recall/F1 (each with an explicit `null`+reason when its
denominator is 0 — never silently coerced to 0), per-domain breakdown (via the real rule-registry
domain lookup), and per-rule diagnostics (expert-positive count, FIGM-prediction count, TP/FP/FN,
a `neverExercisedByExpertSet` flag, and a `sampleTooSmallForReliablePerRuleMetric` flag at n<5).
TN is only ever computed when the caller explicitly opts in with real negative-opportunity data
(`supportsExplicitNegatives: true`) — never manufactured from unspecified non-findings.

`tests/rq4-metrics-pipeline.test.ts` — **9/9 passing**, covering exactly Section 29's required
scenarios, all against synthetic example matrices built only to verify the code (never presented as
RQ4 findings):

| Scenario | Result |
|---|---|
| Perfect match | P=1.0, R=1.0, F1=1.0 |
| FP only | P=0, R=`null` (TP+FN=0), F1=`null` |
| FN only | P=`null` (TP+FP=0), R=0, F1=`null` |
| Mixed confusion matrix | TP=1, FP=2, FN=1 → P=1/3, R=1/2, F1=0.4 (exact) |
| Zero denominator (no predictions, no expert positives) | P=`null`, R=`null`, F1=`null` |
| Duplicate prediction handling | 2 identical predictions → 1 TP, not 2; `duplicatePredictionsCollapsed: 1` |
| Excluded/ambiguous case behavior | Excluded ground-truth entry contributes 0 to the confusion matrix; its matching prediction becomes an FP against no valid ground truth, not silently dropped |
| Domain/rule diagnostics wiring | Confirmed sourced from the real `RULE_CATALOG`, not a hand-maintained duplicate map |
| TN never manufactured | `tn: null` by default; only non-null when explicit negatives are supplied |

## 30. No engine changes

No rule logic, parser behavior, framework detection, scanner output logic, quality score,
remediation, or matching-after-results change was made. No severe engine defect was discovered
this stage (none was searched for, since no real predictions were run).

```
ENGINE_CHANGED_DURING_RQ4: NO
```

## 31. research-freeze-v5 integrity (re-verified after this stage's work)

```
git rev-list -n 1 research-freeze-v5 -> 0d287d6d8408c319bae839811d1ac52c0cd71f3f   (unchanged)
```

All new files this stage (`scripts/compute-rq4-metrics.ts`, `scripts/freeze-annotation-package.ts`,
`tests/rq4-metrics-pipeline.test.ts`, `research/independent-annotation/package/MANIFEST.json`, this
report, plus `package.json`'s three new script entries and one new test-list entry) are additive
research/analysis tooling on top of `main`, versioned separately from — and never moving —
the `research-freeze-v5` tag.

## 32–34. Results table, interpretation, limitations

No RQ4 results table, interpretation, or accuracy claim is produced this stage — there is no real
expert ground truth to compute one from. The primary limitation this stage surfaces is
methodological, not statistical: **the frozen protocol defines how to measure a single external
annotator's agreement with the existing internal ground truth (Cohen's κ), but does not yet define
how an external annotator's findings become the primary ground truth FIGM's own Precision/Recall/F1
would be computed against.** That protocol decision — and recruiting/consenting a real expert under
it — must happen before RQ4 can produce a real accuracy claim.

## 35. Test / build gate

Only research-analysis scripts, tests, and evidence/docs were added; no product `app/`/`src/`
file was modified. Per this stage's own conditional instruction, ran the relevant pipeline tests
rather than the full suite:

```
npx tsc --noEmit                                                          -> PASS (0 errors)
tests/rq4-metrics-pipeline.test.ts (new)                                  -> 9/9 PASS
tests/independent-annotation-pipeline.test.ts (existing, unmodified)      -> 2/2 PASS
```

## 36. Research integrity check

```
FAKE_EXPERTS_CREATED: 0
FABRICATED_ANNOTATIONS: 0
INTERNAL_LABELS_USED_AS_EXPERT_TRUTH: 0
FIGM_OUTPUT_SHOWN_TO_EXPERT_BEFORE_ANNOTATION: NO
ENGINE_CHANGED_AFTER_SEEING_RQ4_ERRORS: NO
RQ1_DATA_MODIFIED: NO
PARTICIPANT_USER_STUDY_DATA_COLLECTED: 0
```

## 37. Final report

```
BASELINE_TAG: research-freeze-v5
BASELINE_COMMIT: 0d287d6d8408c319bae839811d1ac52c0cd71f3f

RULE_SET_VERSION: 2.1.0
TOTAL_RULES: 50

ANNOTATION_PACKAGE_VERSION: 1.0.0 (research/independent-annotation/package/MANIFEST.json, frozen this stage)
ANNOTATION_UNIT: rule-instance-level violation label per fixture file (fixture_file, rule_id,
  line_number, severity, notes) -- open-ended find-and-log design, not a fixed judgment grid

REAL_EXPERT_COUNT: 0
EXPERT_CONSENT_COMPLETE: NO
ETHICS_APPROVAL_STATUS: CONFIRMED_BY_RESEARCHER
ETHICS_APPROVAL_REFERENCE: TO_BE_RECORDED

BLINDING_CONFIRMED: YES (package design verified; one minor pre-existing folder-naming note
  disclosed in Section 6, not a blinding failure)

EXPERT_ANNOTATIONS_COMPLETE: NO
GROUND_TRUTH_COMPLETE: NO
FIGM_PREDICTIONS_COMPLETE: NO

MATCHING_POLICY: exact (fixture_file, rule_id) match; ±5-line proximity is a secondary sanity
  check only; duplicate predictions for the same (case, rule) collapse to one

TP: N/A (not computed)
FP: N/A (not computed)
FN: N/A (not computed)

PRECISION: N/A (not computed)
RECALL: N/A (not computed)
F1: N/A (not computed)

ARCHITECTURE_METRICS: NOT_ENOUGH_DATA
STATIC_PERFORMANCE_METRICS: NOT_ENOUGH_DATA
ACCESSIBILITY_METRICS: NOT_ENOUGH_DATA

INTER_RATER_RELIABILITY: NOT_APPLICABLE (method defined -- Cohen's kappa -- but 0 real submissions to compute it from)

EXCLUDED_AMBIGUOUS_UNITS: 0

INTERNAL_BENCHMARK_USED_AS_RQ4_TRUTH: NO

FAKE_EXPERTS_CREATED: 0
FABRICATED_ANNOTATIONS: 0

ENGINE_CHANGED_DURING_RQ4: NO
RQ1_DATA_MODIFIED: NO

RQ4_COLLECTION_STATUS: PARTIAL

RQ4_ANSWER_READY: NO

READY_FOR_NEXT_RESEARCH_STAGE: NO (blocked on: (a) recruiting and consenting at least one real,
  independent expert annotator, and (b) a protocol amendment defining how an external annotator's
  findings become the ground truth FIGM's own Precision/Recall/F1 is computed against -- Section
  13-16's documented gap -- both of which require the researcher's decision, not further automated
  work)

NEXT_ACTION:
Do not simulate expert annotations. Do not invent a consensus/adjudication policy. When a real,
independent, consented expert is available: (1) resolve the Section 13-16 protocol gap explicitly
(a short written amendment to docs/research/ stating how expert findings become RQ4 ground truth),
(2) send research/independent-annotation/package/ (now frozen at packageVersion 1.0.0, manifest
hashes recorded) to that expert unmodified, (3) place their submission in
research/raw/real/rq4/ (not research/independent-annotation/submissions/, which is scoped to the
existing single-annotator-vs-internal-truth kappa design) or the amended protocol's specified
path, (4) run the freeze-v5 engine to capture predictions, (5) run
scripts/compute-rq4-metrics.ts (already built and tested) against the two. Preserve this stage's
evidence and research-freeze-v5 unchanged. Do not start participant/user-study data collection
automatically.
```

---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BTxjxSo2MumPZ9pw28vgEA
