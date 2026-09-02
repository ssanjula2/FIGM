/**
 * Canonical Human-Study Configuration
 *
 * Single source of truth for the target real-participant sample size. Every UI, API,
 * export, and script that displays, defaults, or computes against a participant target
 * MUST import this constant rather than hardcoding the number -- the exact "no shared
 * source of truth" pattern that previously produced a stale-vs-current contradiction
 * for the canonical rule count (25 vs 50) is what this module exists to prevent from
 * happening again for the participant target.
 *
 * Zero runtime dependencies (no DB/storage/auth imports) so it is safe to import from
 * both server-only code (API routes, scripts) and 'use client' React components alike.
 *
 * History: an early in-repo implementation choice used 85 (not traceable to any research
 * document). The actual Proposal (`Research Proposal new.docx` Sec 4.3/5.2) and Interim
 * Submission 02 (`28256_Interim 02.docx` Sec 1.9.2/3.4/3.6.1/3.6.2) -- both read in full on
 * 2026-09-03 -- independently and consistently state a target of 80-100 student developers.
 * That figure is the documented historical baseline and is preserved as such; it was never
 * itself hardcoded anywhere in this repository (85 was).
 *
 * RESOLVED 2026-09-03: the researcher has confirmed, as a later approved research-scope
 * decision (not a rejection or contradiction of the Proposal/Interim 02 baseline), a final
 * study target of 20 real participants. This is the value below. See
 * docs/research/PARTICIPANT_TARGET_DECISION.md for the full decision record and
 * docs/audit/STAGE_1_RESEARCH_CONTRACT_CLOSE_REPORT.md for the closure evidence. This value
 * supersedes every prior reference to 85 (an undocumented earlier implementation choice) as
 * the real-participant target anywhere in this repository's code, documentation, or
 * generated artifacts.
 *
 * Explicitly OUT OF SCOPE for this constant: src/eval/research-data-pipeline.ts's
 * separate "Synthetic Usability Model" (ResearchDataPipeline.getSyntheticModelProvenance,
 * N=85 simulated Likert scoring vectors, also referenced in research/README.md). That
 * figure is a pipeline-correctness test-fixture size used only to verify the SUS/
 * Cronbach's-alpha arithmetic is implemented correctly before any real data exists --
 * it is not a claim about the real participant target and must not be changed to match
 * this constant; the two values are intentionally independent.
 */
export const HUMAN_STUDY_TARGET_PARTICIPANTS = 20;

/**
 * Version of the consent protocol a participant agrees to (research/CONSENT_FORM.md). Recorded
 * inside the signed session token at the moment consent is given (see
 * app/api/user-study/consent/route.ts) so any future wording change is traceable to exactly which
 * participants consented under which version -- required before freezing the experiment (see
 * research/audits/FIGM_PRE_DATA_COLLECTION_AUDIT.md Section 21/32, "what must remain frozen during
 * real data collection"). Bump this whenever research/CONSENT_FORM.md's substantive content
 * changes; never silently reuse a version number for different wording.
 */
export const CONSENT_PROTOCOL_VERSION = '1.0.0';

/**
 * Research-artifact component versions, for experiment-freeze traceability (see
 * research/audits/FIGM_PRE_DATA_COLLECTION_AUDIT.md Section 21/32 -- "what must remain frozen
 * during real data collection"). Every future research result should be traceable to the exact
 * versions recorded here at the moment the experiment freeze commit/tag was made. Bump the
 * relevant field whenever that component's substantive content changes; never silently reuse a
 * version number for materially different content.
 */
export const RESEARCH_ARTIFACT_VERSIONS = {
  /** package.json's own version -- the FIGM tool/application as a whole. */
  toolVersion: '1.0.0',
  /** src/matrix/four-layer-meta-model.ts's rule set (50 canonical rules as of this revision) --
   *  kept in sync with generateMasterSpecification()'s own meta.version; see that field's doc
   *  comment for exactly why the Pre-Freeze Technical Completion Pass bumped this to 2.1.0. */
  ruleSetVersion: '2.1.0',
  /** The 10-item SUS + custom-item questionnaire (research/QUESTIONNAIRE.md). */
  surveyVersion: '1.0.0',
  /** benchmarks/ground-truth.json's "FIGM Empirical Evaluation Benchmark Testbed" version. */
  benchmarkVersion: '1.0.0',
  /** benchmarks/real-world/METHODOLOGY.md's repository inclusion protocol. */
  repositoryProtocolVersion: '1.0.0',
  /** Primary/fallback AI provider + model pairing -- see docs/research/AI_CONFIGURATION_FREEZE.md
   *  for the full frozen record (model identifiers, timeout/retry policy, verification chain). */
  aiConfigVersion: '1.0.0',
  /** src/lib/analytics.ts's GA4 event schema (event names + field shapes). */
  analyticsSchemaVersion: '1.0.0',
  /** research/CONSENT_FORM.md -- re-exported here under its own name too, since it is recorded
   *  per-participant inside the session token (see CONSENT_PROTOCOL_VERSION above). */
  consentVersion: CONSENT_PROTOCOL_VERSION,
} as const;
