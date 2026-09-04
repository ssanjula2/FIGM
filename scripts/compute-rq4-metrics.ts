/**
 * Framework-Independent Guideline Model (FIGM)
 * RQ4 Metrics Computation Pipeline — Precision / Recall / F1 vs. Real Expert Ground Truth
 *
 * Stage 10 tooling. Deterministic: reads a final (adjudicated) expert ground-truth file and a
 * raw FIGM-predictions file, and emits TP/FP/FN, Precision/Recall/F1, a per-domain breakdown, and
 * per-rule diagnostics. Never invents, simulates, or infers ground truth of its own -- it is pure
 * computation over two already-collected inputs (see docs/audit/STAGE_10_RQ4_INDEPENDENT_EXPERT_
 * VALIDATION_REPORT.md for why no real ground-truth file exists yet: REAL_EXPERT_DATA_AVAILABLE
 * is NO as of this stage, so this script has nothing real to run against and was validated with
 * synthetic example matrices in tests/rq4-metrics-pipeline.test.ts instead -- those are code-
 * correctness fixtures, never RQ4 research data).
 *
 * Matching policy (fixed, not tuned after seeing results): exact (caseId, ruleId) match. A
 * duplicate FIGM prediction for the same (caseId, ruleId) counts once (a real-world FIGM run
 * should never emit two rows for the same rule at the same case, but this collapses defensively
 * rather than double-counting a TP/FP if it ever did). Excluded/ambiguous ground-truth entries
 * (excluded: true) are removed from the confusion matrix entirely and reported separately -- never
 * silently folded into TP/FP/FN.
 *
 * Usage:
 *   node --import tsx scripts/compute-rq4-metrics.ts --ground-truth <path> --predictions <path> --out <dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULE_CATALOG } from '../src/matrix/rule-registry.js';

const __filename = fileURLToPath(import.meta.url);

export type ExpertLabel = 'VIOLATION_PRESENT' | 'VIOLATION_ABSENT';

export interface ExpertGroundTruthEntry {
  caseId: string;
  ruleId: string;
  expertGroundTruth: ExpertLabel;
  provenance: string;
  annotationVersion: string;
  excluded?: boolean;
  exclusionReason?: string;
}

export interface FigmPrediction {
  caseId: string;
  ruleId: string;
  filePath?: string;
  domain?: string;
  severity?: string;
  engineVersion: string;
  ruleSetVersion: string;
  timestamp: string;
}

export interface MetricValue {
  value: number | null;
  note: string | null;
}

export interface ConfusionCounts {
  tp: number;
  fp: number;
  fn: number;
  tn: number | null;
}

export interface RQ4Metrics extends ConfusionCounts {
  precision: MetricValue;
  recall: MetricValue;
  f1: MetricValue;
}

export interface DomainBreakdown {
  domain: string;
  expertPositives: number;
  figmPredictions: number;
  metrics: RQ4Metrics;
}

export interface RuleDiagnostic {
  ruleId: string;
  expertPositiveCount: number;
  figmPredictionCount: number;
  tp: number;
  fp: number;
  fn: number;
  neverExercisedByExpertSet: boolean;
  sampleTooSmallForReliablePerRuleMetric: boolean;
}

export interface RQ4AnalysisOutput {
  generatedAt: string;
  matchingPolicy: string;
  excludedUnitCount: number;
  duplicatePredictionsCollapsed: number;
  overall: RQ4Metrics;
  domainBreakdown: DomainBreakdown[];
  ruleDiagnostics: RuleDiagnostic[];
}

const RULE_DOMAIN: Map<string, string> = new Map(
  (RULE_CATALOG as any[]).map((r) => [r.id as string, r.domain as string])
);

/** Minimum n below which a per-rule Precision/Recall/F1 is flagged as unreliable, not suppressed
 *  -- Section 22's "do not claim a per-rule value as robust when the denominator is too small." */
const MIN_RELIABLE_N = 5;

function safeDivide(numerator: number, denominator: number, undefinedNote: string): MetricValue {
  if (denominator === 0) return { value: null, note: undefinedNote };
  return { value: numerator / denominator, note: null };
}

function computeConfusion(tp: number, fp: number, fn: number, tn: number | null): RQ4Metrics {
  const precision = safeDivide(tp, tp + fp, 'undefined: TP + FP = 0 (no positive FIGM predictions in this scope)');
  const recall = safeDivide(tp, tp + fn, 'undefined: TP + FN = 0 (no expert-positive violations in this scope)');
  let f1: MetricValue;
  if (precision.value === null || recall.value === null) {
    f1 = { value: null, note: 'undefined: precision and/or recall undefined' };
  } else if (precision.value + recall.value === 0) {
    f1 = { value: 0, note: 'precision + recall = 0 (both zero, not undefined)' };
  } else {
    f1 = { value: (2 * precision.value * recall.value) / (precision.value + recall.value), note: null };
  }
  return { tp, fp, fn, tn, precision, recall, f1 };
}

/**
 * Pure computation, directly unit-testable without any file I/O.
 * TN is only computed when `supportsExplicitNegatives` is true (the ground-truth set contains
 * genuine, protocol-defined negative-opportunity judgments, not merely "nothing was reported
 * here") -- otherwise TN stays null, never manufactured (Section 19).
 */
export function analyzeRQ4(
  groundTruth: ExpertGroundTruthEntry[],
  predictions: FigmPrediction[],
  opts: { supportsExplicitNegatives?: boolean } = {}
): RQ4AnalysisOutput {
  const excluded = groundTruth.filter((g) => g.excluded);
  const included = groundTruth.filter((g) => !g.excluded);

  // Collapse duplicate predictions for the same (caseId, ruleId) -- see header doc comment.
  const predKey = (p: { caseId: string; ruleId: string }) => `${p.caseId}::${p.ruleId}`;
  const dedupedPredictions = new Map<string, FigmPrediction>();
  let duplicatesCollapsed = 0;
  for (const p of predictions) {
    const key = predKey(p);
    if (dedupedPredictions.has(key)) duplicatesCollapsed++;
    else dedupedPredictions.set(key, p);
  }

  const gtByKey = new Map<string, ExpertGroundTruthEntry>();
  for (const g of included) gtByKey.set(`${g.caseId}::${g.ruleId}`, g);
  // A FIGM prediction landing on an EXCLUDED (ambiguous) unit must contribute to neither TP nor
  // FP -- Section F of the RQ4 protocol amendment ("ambiguous units do not enter TP/FP/FN
  // denominators"). Tracked separately from gtByKey (which only holds non-excluded entries) so the
  // matching loop below can distinguish "no ground truth at all for this pair" (a real FP) from
  // "ground truth exists but was excluded" (neither TP nor FP).
  const excludedKeys = new Set(excluded.map((g) => `${g.caseId}::${g.ruleId}`));

  let tp = 0, fp = 0, fn = 0, tn = 0;
  const domainCounts = new Map<string, { tp: number; fp: number; fn: number; expertPositives: number; figmPredictions: number }>();
  const ruleCounts = new Map<string, { expertPositive: number; figmPrediction: number; tp: number; fp: number; fn: number }>();

  const ensureRule = (ruleId: string) => {
    if (!ruleCounts.has(ruleId)) ruleCounts.set(ruleId, { expertPositive: 0, figmPrediction: 0, tp: 0, fp: 0, fn: 0 });
    return ruleCounts.get(ruleId)!;
  };
  const ensureDomain = (domain: string) => {
    if (!domainCounts.has(domain)) domainCounts.set(domain, { tp: 0, fp: 0, fn: 0, expertPositives: 0, figmPredictions: 0 });
    return domainCounts.get(domain)!;
  };

  for (const g of included) {
    const domain = RULE_DOMAIN.get(g.ruleId) ?? 'UNKNOWN';
    if (g.expertGroundTruth === 'VIOLATION_PRESENT') {
      ensureRule(g.ruleId).expertPositive++;
      ensureDomain(domain).expertPositives++;
    }
  }
  for (const p of dedupedPredictions.values()) {
    const domain = p.domain ?? RULE_DOMAIN.get(p.ruleId) ?? 'UNKNOWN';
    ensureRule(p.ruleId).figmPrediction++;
    ensureDomain(domain).figmPredictions++;
  }

  const matchedGtKeys = new Set<string>();
  for (const p of dedupedPredictions.values()) {
    const key = predKey(p);
    const gt = gtByKey.get(key);
    const domain = p.domain ?? RULE_DOMAIN.get(p.ruleId) ?? 'UNKNOWN';
    if (gt && gt.expertGroundTruth === 'VIOLATION_PRESENT') {
      tp++;
      ensureRule(p.ruleId).tp++;
      ensureDomain(domain).tp++;
      matchedGtKeys.add(key);
    } else if (excludedKeys.has(key)) {
      // Ground truth exists for this pair but was explicitly excluded (AMBIGUOUS) -- neither TP
      // nor FP. Do not fall through to the FP branch below.
    } else {
      // No ground-truth entry at all, or an explicit VIOLATION_ABSENT judgment -- either way FIGM
      // predicted a violation the expert record does not confirm.
      fp++;
      ensureRule(p.ruleId).fp++;
      ensureDomain(domain).fp++;
      if (gt) matchedGtKeys.add(key);
    }
  }
  for (const g of included) {
    if (g.expertGroundTruth !== 'VIOLATION_PRESENT') continue;
    const key = `${g.caseId}::${g.ruleId}`;
    if (matchedGtKeys.has(key)) continue; // already counted as TP above
    fn++;
    const domain = RULE_DOMAIN.get(g.ruleId) ?? 'UNKNOWN';
    ensureRule(g.ruleId).fn++;
    ensureDomain(domain).fn++;
  }

  let tnValue: number | null = null;
  if (opts.supportsExplicitNegatives) {
    for (const g of included) {
      if (g.expertGroundTruth !== 'VIOLATION_ABSENT') continue;
      const key = `${g.caseId}::${g.ruleId}`;
      if (!dedupedPredictions.has(key)) tn++;
    }
    tnValue = tn;
  }

  const overall = computeConfusion(tp, fp, fn, tnValue);

  const domainBreakdown: DomainBreakdown[] = Array.from(domainCounts.entries()).map(([domain, c]) => ({
    domain,
    expertPositives: c.expertPositives,
    figmPredictions: c.figmPredictions,
    metrics: computeConfusion(c.tp, c.fp, c.fn, null),
  }));

  const ruleDiagnostics: RuleDiagnostic[] = Array.from(ruleCounts.entries()).map(([ruleId, c]) => ({
    ruleId,
    expertPositiveCount: c.expertPositive,
    figmPredictionCount: c.figmPrediction,
    tp: c.tp,
    fp: c.fp,
    fn: c.fn,
    neverExercisedByExpertSet: c.expertPositive === 0 && c.figmPrediction === 0,
    sampleTooSmallForReliablePerRuleMetric: c.tp + c.fp + c.fn < MIN_RELIABLE_N,
  }));

  return {
    generatedAt: new Date().toISOString(),
    matchingPolicy: 'exact (caseId, ruleId) match; duplicate FIGM predictions for the same (caseId, ruleId) collapsed to one before matching',
    excludedUnitCount: excluded.length,
    duplicatePredictionsCollapsed: duplicatesCollapsed,
    overall,
    domainBreakdown,
    ruleDiagnostics,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const idx = (flag: string) => argv.indexOf(flag);
  const gtIdx = idx('--ground-truth');
  const predIdx = idx('--predictions');
  const outIdx = idx('--out');

  if (gtIdx === -1 || predIdx === -1) {
    console.error('Usage: node --import tsx scripts/compute-rq4-metrics.ts --ground-truth <path> --predictions <path> [--out <dir>]');
    process.exit(2);
  }

  const gtPath = path.resolve(argv[gtIdx + 1]);
  const predPath = path.resolve(argv[predIdx + 1]);

  if (!fs.existsSync(gtPath)) {
    console.error(`Ground-truth file not found: ${gtPath}. No real RQ4 expert ground truth exists yet -- see docs/audit/STAGE_10_RQ4_INDEPENDENT_EXPERT_VALIDATION_REPORT.md.`);
    process.exit(1);
  }
  if (!fs.existsSync(predPath)) {
    console.error(`Predictions file not found: ${predPath}.`);
    process.exit(1);
  }

  const groundTruth: ExpertGroundTruthEntry[] = JSON.parse(fs.readFileSync(gtPath, 'utf-8'));
  const predictions: FigmPrediction[] = JSON.parse(fs.readFileSync(predPath, 'utf-8'));

  const result = analyzeRQ4(groundTruth, predictions);
  console.log(JSON.stringify(result, null, 2));

  if (outIdx !== -1) {
    const outDir = path.resolve(argv[outIdx + 1]);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'rq4-metrics.json'), JSON.stringify(result, null, 2), 'utf-8');
    console.error(`[compute-rq4-metrics] Wrote ${path.join(outDir, 'rq4-metrics.json')}`);
  }
}

if (process.argv[1] === __filename) {
  main();
}
