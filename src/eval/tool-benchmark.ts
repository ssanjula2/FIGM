/**
 * Framework-Independent Guideline Model (FIGM)
 * Tool & Rule Coverage Description (structural/qualitative — NOT an empirical benchmark)
 *
 * Neither table below is measured. `TOOL_COMPARISON_MATRIX` is a hand-curated qualitative
 * capability comparison based on each tool's public documentation (does it do static analysis at
 * all? does it do AI remediation at all?) — genuinely reproducible ONLY in the "read the docs"
 * sense, never presented with a timing/percentage figure that would imply an actual benchmark run
 * was performed (a prior version included a per-tool execution-latency-in-milliseconds literal
 * for Lighthouse/ESLint/SonarQube/etc. with no benchmark harness anywhere in this repo that ever
 * ran those tools — removed rather than "corrected" to a different number). `RULE_COVERAGE_MATRIX` is derived from
 * `FOUR_LAYER_MAPPINGS` (`src/matrix/four-layer-meta-model.ts`, the single source of truth for the
 * rule set) rather than hand-duplicated, so it can never silently drift out of sync with the real
 * 25-rule set the way a previous hand-typed 23-entry version (missing FIGM-A11Y-05/06) did.
 */

import { FOUR_LAYER_MAPPINGS } from '../matrix/four-layer-meta-model.js';

export interface ToolFeatureComparison {
  tool: string;
  staticAnalysis: boolean;
  dynamicProfiling: boolean;
  aiRemediation: boolean;
  frameworkIndependent: boolean;
  accessibilitySupport: boolean;
  performanceSupport: boolean;
}

export interface RuleCoverageItem {
  ruleId: string;
  ruleName: string;
  reactSupport: boolean;
  nextSupport: boolean;
  angularSupport: boolean;
  detectionStrategy: 'AST_STRUCTURE' | 'CFG_REACHABILITY' | 'DYNAMIC_PROFILING';
}

/** Qualitative-only capability comparison — NOT an empirical benchmark. No tool listed here was
 *  actually executed against FIGM's codebase or rule set; every field is a documentation-derived
 *  yes/no capability judgment, never a measured percentage or timing. Callers (dissertation
 *  exporter, landing page) must render this as a capability table, never alongside a numeric
 *  "score"/"coverage %"/"latency" column that would misrepresent it as measured. */
export const TOOL_COMPARISON_MATRIX: ToolFeatureComparison[] = [
  { tool: 'Google Lighthouse', staticAnalysis: false, dynamicProfiling: true, aiRemediation: false, frameworkIndependent: false, accessibilitySupport: true, performanceSupport: true },
  { tool: 'ESLint (Standard)', staticAnalysis: true, dynamicProfiling: false, aiRemediation: false, frameworkIndependent: false, accessibilitySupport: false, performanceSupport: false },
  { tool: 'SonarQube', staticAnalysis: true, dynamicProfiling: false, aiRemediation: false, frameworkIndependent: false, accessibilitySupport: true, performanceSupport: false },
  { tool: 'eslint-plugin-react', staticAnalysis: true, dynamicProfiling: false, aiRemediation: false, frameworkIndependent: false, accessibilitySupport: true, performanceSupport: false },
  { tool: 'angular-eslint', staticAnalysis: true, dynamicProfiling: false, aiRemediation: false, frameworkIndependent: false, accessibilitySupport: true, performanceSupport: false },
  { tool: 'FIGM Code Inspector (Proposed)', staticAnalysis: true, dynamicProfiling: true, aiRemediation: true, frameworkIndependent: true, accessibilitySupport: true, performanceSupport: true },
];

const FRAMEWORK_APPLICABILITY: Record<string, { reactSupport: boolean; nextSupport: boolean; angularSupport: boolean; detectionStrategy: RuleCoverageItem['detectionStrategy'] }> = {
  'FIGM-PERF-03': { reactSupport: true, nextSupport: true, angularSupport: true, detectionStrategy: 'CFG_REACHABILITY' },
  'FIGM-A11Y-04': { reactSupport: true, nextSupport: true, angularSupport: true, detectionStrategy: 'CFG_REACHABILITY' },
  'FIGM-ANG-01': { reactSupport: false, nextSupport: false, angularSupport: true, detectionStrategy: 'CFG_REACHABILITY' },
};

/** Derived from `FOUR_LAYER_MAPPINGS` (50 rules) — never a hand-duplicated literal list. Universal
 *  PERF/A11Y rules apply to all three frameworks; NEXT-* is Next.js-only; REACT-* applies to
 *  React and Next.js; ANG-* is Angular-only. Three rules (FIGM-PERF-03, FIGM-A11Y-04, FIGM-ANG-01)
 *  use a control-flow-reachability strategy rather than pure AST structure matching (event-listener
 *  disposal pairing / focus-restoration reachability / subscription-teardown reachability); every
 *  other rule is a direct AST-structure match. */
export const RULE_COVERAGE_MATRIX: RuleCoverageItem[] = FOUR_LAYER_MAPPINGS.map((m) => {
  const ruleId = m.rule.ruleId;
  const override = FRAMEWORK_APPLICABILITY[ruleId];
  const isNext = ruleId.startsWith('FIGM-NEXT-');
  const isReact = ruleId.startsWith('FIGM-REACT-');
  const isAngular = ruleId.startsWith('FIGM-ANG-');
  const isUniversal = ruleId.startsWith('FIGM-PERF-') || ruleId.startsWith('FIGM-A11Y-');

  return {
    ruleId,
    ruleName: m.rule.ruleName,
    reactSupport: override?.reactSupport ?? (isUniversal || isReact),
    nextSupport: override?.nextSupport ?? (isUniversal || isReact || isNext),
    angularSupport: override?.angularSupport ?? (isUniversal || isAngular),
    detectionStrategy: override?.detectionStrategy ?? 'AST_STRUCTURE',
  };
});

export class CoverageBenchmarkEngine {
  /** Structural rule-set composition (how many of FIGM's 50 rules are universal vs. framework-
   *  specific) — NOT a detection-accuracy claim. There is no flat always-100 success-rate field here (a prior
   *  version hardcoded one at a flat 100.0 regardless of any input); actual detection accuracy is
   *  reported only by `EvaluationRunner`'s ground-truth benchmark (see
   *  docs/evidence/canonical-evaluation.json), which is the single source for that claim. */
  public static calculateCoverageSummary() {
    const totalRules = RULE_COVERAGE_MATRIX.length;
    const universalRules = RULE_COVERAGE_MATRIX.filter(r => r.reactSupport && r.nextSupport && r.angularSupport).length;
    const frameworkSpecificRules = totalRules - universalRules;

    return {
      totalRules,
      universalRules,
      frameworkSpecificRules,
      universalCoveragePercentage: parseFloat(((universalRules / totalRules) * 100).toFixed(1)),
      frameworkCoveragePercentage: parseFloat(((frameworkSpecificRules / totalRules) * 100).toFixed(1)),
    };
  }
}
