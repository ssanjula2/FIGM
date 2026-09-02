/**
 * Framework-Independent Guideline Model (FIGM)
 * Rule ID -> UI display category derivation
 *
 * Category is 100% derivable from the rule ID prefix -- kept as a single pure function rather than
 * a hand-entered field on each of the 50 rules in four-layer-meta-model.ts so the two can never
 * drift out of sync.
 */

import type { RuleCategory } from '../types/taxonomy.js';

export function deriveRuleCategory(ruleId: string): RuleCategory {
  if (ruleId.startsWith('FIGM-NEXT-')) return 'NEXTJS';
  if (ruleId.startsWith('FIGM-REACT-')) return 'REACT';
  if (ruleId.startsWith('FIGM-ANG-')) return 'ANGULAR';
  if (ruleId.startsWith('FIGM-VUE-')) return 'VUE';
  return 'COMMON';
}
