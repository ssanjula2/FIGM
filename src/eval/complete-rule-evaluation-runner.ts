/**
 * Framework-Independent Guideline Model (FIGM)
 * Complete 50-Rule Structural Evaluation Runner
 *
 * DISTINCT from src/eval/evaluation-runner.ts (the existing empirical ground-truth benchmark,
 * left completely untouched by this file). As of this Scientific Hardening pass that benchmark
 * itself now also carries ground-truth coverage for all 50/50 rules (see its own
 * RuleCoverageProvenance output) and remains the project's canonical P/R/F1 research claim,
 * computed against realistic multi-defect testbed fixtures. This runner answers a different,
 * complementary question: does every one of the 50 canonical FIGM rules still classify its own documented positive and negative examples
 * correctly, right now, against the live (unmodified) detection engine? See
 * benchmarks/complete-rule-evaluation/cases.ts for the dataset and its own provenance notes.
 *
 * Every number below is computed live from actually running RuleExecutionEngine.analyzeFile
 * against every case in the dataset -- nothing here is a cached, hand-typed, or otherwise
 * hardcoded TP/FP/FN/TN/precision/recall/F1 value.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { RuleExecutionEngine } from '../engine/rule-execution-engine.js';
import { FOUR_LAYER_MAPPINGS } from '../matrix/four-layer-meta-model.js';
import { RULE_EVAL_CASES, RuleEvalCase } from '../../benchmarks/complete-rule-evaluation/cases.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ConfusionCounts {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  trueNegative: number;
}

interface RuleMetric extends ConfusionCounts {
  ruleId: string;
  ruleName: string;
  totalCases: number;
  precision: number;
  recall: number;
  f1: number;
}

interface FailedCase {
  id: string;
  ruleId: string;
  fileName: string;
  expectedLabel: RuleEvalCase['label'];
  actualFired: boolean;
  description: string;
}

export interface CompleteRuleEvaluationArtifact {
  timestamp: string;
  engineVersion: string;
  ruleRegistryHash: string;
  totalCanonicalRules: number;
  evaluatedRules: number;
  groundTruthCoverage: string;
  totalCases: number;
  perRuleMetrics: RuleMetric[];
  aggregate: ConfusionCounts & { precision: number; recall: number; f1: number };
  uncoveredRules: string[];
  failedCases: FailedCase[];
  executionDurationMs: number;
  reproducible: boolean;
  methodology: string;
  scopeDisclaimer: string;
}

/** Precision/recall/F1 from a confusion-matrix cell set. 0/0 divisions resolve to 0, not NaN or a
 *  silently omitted field -- a rule with zero positive cases and zero true positives has a real,
 *  reportable (if uninformative) precision/recall of 0, not a hidden gap in the output shape. */
function scoreOf(c: ConfusionCounts): { precision: number; recall: number; f1: number } {
  const precision = c.truePositive + c.falsePositive > 0 ? c.truePositive / (c.truePositive + c.falsePositive) : 0;
  const recall = c.truePositive + c.falseNegative > 0 ? c.truePositive / (c.truePositive + c.falseNegative) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}

export class CompleteRuleEvaluationRunner {
  public static run(): CompleteRuleEvaluationArtifact {
    const startTime = performance.now();

    const canonicalRuleIds = FOUR_LAYER_MAPPINGS.map((m) => m.rule.ruleId).sort();
    // A stable fingerprint of the rule registry's current shape -- changes if and only if a rule
    // is added, removed, or renamed, so a stale cached artifact can be told apart from a fresh one
    // even when the numeric metrics happen to coincide.
    const ruleRegistryHash = crypto.createHash('sha256').update(canonicalRuleIds.join('|')).digest('hex').slice(0, 16);

    const perRule = new Map<string, ConfusionCounts & { ruleName: string; totalCases: number }>();
    for (const m of FOUR_LAYER_MAPPINGS) {
      perRule.set(m.rule.ruleId, {
        ruleName: m.rule.ruleName,
        totalCases: 0,
        truePositive: 0,
        falsePositive: 0,
        falseNegative: 0,
        trueNegative: 0,
      });
    }

    const failedCases: FailedCase[] = [];

    for (const c of RULE_EVAL_CASES) {
      const bucket = perRule.get(c.ruleId);
      if (!bucket) {
        // A case referencing a ruleId that is no longer in the canonical registry (rule renamed
        // or removed) is a dataset/registry drift bug, not a silent no-op -- surface it as a
        // failed case rather than dropping it.
        failedCases.push({ id: c.id, ruleId: c.ruleId, fileName: c.fileName, expectedLabel: c.label, actualFired: false, description: `${c.description} -- ruleId not found in current FOUR_LAYER_MAPPINGS registry` });
        continue;
      }

      const result = RuleExecutionEngine.analyzeFile(c.fileName, c.code);
      const fired = result.diagnostics.some((d) => d.ruleId === c.ruleId);
      const expectedViolation = c.label === 'EXPECTED_VIOLATION';

      bucket.totalCases += 1;
      if (expectedViolation && fired) bucket.truePositive += 1;
      else if (!expectedViolation && fired) bucket.falsePositive += 1;
      else if (expectedViolation && !fired) bucket.falseNegative += 1;
      else bucket.trueNegative += 1;

      if (fired !== expectedViolation) {
        failedCases.push({ id: c.id, ruleId: c.ruleId, fileName: c.fileName, expectedLabel: c.label, actualFired: fired, description: c.description });
      }
    }

    const perRuleMetrics: RuleMetric[] = [...perRule.entries()].map(([ruleId, v]) => ({
      ruleId,
      ruleName: v.ruleName,
      totalCases: v.totalCases,
      truePositive: v.truePositive,
      falsePositive: v.falsePositive,
      falseNegative: v.falseNegative,
      trueNegative: v.trueNegative,
      ...scoreOf(v),
    }));

    const aggregateCounts: ConfusionCounts = perRuleMetrics.reduce(
      (acc, r) => ({
        truePositive: acc.truePositive + r.truePositive,
        falsePositive: acc.falsePositive + r.falsePositive,
        falseNegative: acc.falseNegative + r.falseNegative,
        trueNegative: acc.trueNegative + r.trueNegative,
      }),
      { truePositive: 0, falsePositive: 0, falseNegative: 0, trueNegative: 0 }
    );

    const evaluatedRuleIds = new Set(RULE_EVAL_CASES.map((c) => c.ruleId));
    const uncoveredRules = canonicalRuleIds.filter((r) => !evaluatedRuleIds.has(r));

    let engineVersion = 'unknown';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'));
      engineVersion = pkg.version || 'unknown';
    } catch {
      // package.json unreadable -- report 'unknown' rather than throwing away the whole run.
    }

    const executionDurationMs = performance.now() - startTime;

    return {
      timestamp: new Date().toISOString(),
      engineVersion,
      ruleRegistryHash,
      totalCanonicalRules: canonicalRuleIds.length,
      evaluatedRules: evaluatedRuleIds.size,
      groundTruthCoverage: `${evaluatedRuleIds.size}/${canonicalRuleIds.length}`,
      totalCases: RULE_EVAL_CASES.length,
      perRuleMetrics,
      aggregate: { ...aggregateCounts, ...scoreOf(aggregateCounts) },
      uncoveredRules,
      failedCases,
      executionDurationMs,
      reproducible: failedCases.length === 0,
      methodology:
        'Every case in benchmarks/complete-rule-evaluation/cases.ts is run through the live, unmodified RuleExecutionEngine.analyzeFile. TP = EXPECTED_VIOLATION case where the target ruleId fired; FP = EXPECTED_NO_VIOLATION case where it fired; FN = EXPECTED_VIOLATION case where it did not fire; TN = EXPECTED_NO_VIOLATION case where it did not fire. Precision/Recall/F1 are computed per rule and in aggregate directly from these counts -- no cached or hand-typed confusion matrix is used at any step. Coverage is honestly reported as evaluatedRules/totalCanonicalRules; a rule with zero cases appears in uncoveredRules and is excluded from groundTruthCoverage\'s numerator.',
      scopeDisclaimer:
        'This is a STRUCTURAL detector-correctness check, not a generalization/real-world-accuracy benchmark: each case is a minimal snippet built directly from that rule\'s own canonical nonCompliantExample/compliantExample (see cases.ts header). A 100% score here means "every rule still correctly classifies its own textbook example," analogous to a green unit-test suite -- it does NOT mean FIGM has 100% accuracy on arbitrary real-world code, and must never be quoted as such. The project\'s canonical synthetic-testbed accuracy claim (see benchmarks/eval-summary.json for the live figures, now scoped to 50/50 rules with ground-truth coverage) remains benchmarks/ground-truth.json + src/eval/evaluation-runner.ts, untouched by this file.',
    };
  }

  /** Runs the evaluation and writes the reproducible JSON artifact to
   *  benchmarks/complete-rule-evaluation/results.json (a location distinct from the existing
   *  empirical benchmark's public/eval-results + docs/evidence outputs, so the two are never
   *  confused for the same evaluation). */
  public static runAndWrite(): CompleteRuleEvaluationArtifact {
    const artifact = CompleteRuleEvaluationRunner.run();
    const outPath = path.resolve(__dirname, '../../benchmarks/complete-rule-evaluation/results.json');
    fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2) + '\n', 'utf-8');
    return artifact;
  }
}

// Allow direct execution: `node --import tsx src/eval/complete-rule-evaluation-runner.ts`
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) {
  const artifact = CompleteRuleEvaluationRunner.runAndWrite();
  console.log(`[FIGM COMPLETE-RULE-EVAL] ${artifact.groundTruthCoverage} canonical rules covered, ${artifact.totalCases} cases run.`);
  console.log(`[FIGM COMPLETE-RULE-EVAL] Aggregate: TP=${artifact.aggregate.truePositive} FP=${artifact.aggregate.falsePositive} FN=${artifact.aggregate.falseNegative} TN=${artifact.aggregate.trueNegative}`);
  console.log(`[FIGM COMPLETE-RULE-EVAL] Precision=${(artifact.aggregate.precision * 100).toFixed(1)}% Recall=${(artifact.aggregate.recall * 100).toFixed(1)}% F1=${(artifact.aggregate.f1 * 100).toFixed(1)}%`);
  if (artifact.failedCases.length > 0) {
    console.log(`[FIGM COMPLETE-RULE-EVAL] ${artifact.failedCases.length} case(s) did not classify as expected:`);
    for (const f of artifact.failedCases) {
      console.log(`  - ${f.id}: expected ${f.expectedLabel}, engine fired=${f.actualFired}`);
    }
    process.exitCode = 1;
  }
  if (artifact.uncoveredRules.length > 0) {
    console.log(`[FIGM COMPLETE-RULE-EVAL] Rules with NO case (coverage gap): ${artifact.uncoveredRules.join(', ')}`);
  }
}
