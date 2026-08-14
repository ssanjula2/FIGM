/**
 * Framework-Independent Guideline Model (FIGM)
 * Canonical Rule Catalog -- the single source of truth every UI/API/export surface should import
 * from instead of hand-maintaining its own rule list.
 *
 * This module does not invent any data: it reshapes `FOUR_LAYER_MAPPINGS` (the live engine
 * registry that `ASTDetectionEngine` and `generateMasterSpecification()` both already read) into
 * a flat, display-ready shape. Adding, removing, or changing a rule only ever requires editing
 * `four-layer-meta-model.ts` -- every consumer of `RULE_CATALOG` picks the change up automatically.
 */

import { FOUR_LAYER_MAPPINGS, CORE_ALPS } from './four-layer-meta-model.js';
import { deriveRuleCategory } from './rule-category.js';
import type { DomainType, ConcernType, RuleSeverity, RuleCategory, RemediationStatus } from '../types/taxonomy.js';
import type { FrameworkType } from '../types/ast-spec.js';

export interface RuleCatalogEntry {
  id: string;
  name: string;
  category: RuleCategory;
  domain: DomainType;
  concern: ConcernType;
  alpId: string;
  severity: RuleSeverity;
  description: string;
  frameworks: FrameworkType[];
  isFrameworkIndependent: boolean;
  example: {
    nonCompliant: string;
    compliant: string;
  };
  remediation: string;
  remediationStatus: RemediationStatus;
  knownLimitation: string;
}

export const RULE_CATALOG: RuleCatalogEntry[] = FOUR_LAYER_MAPPINGS.map((m) => ({
  id: m.rule.ruleId,
  name: m.rule.ruleName,
  category: deriveRuleCategory(m.rule.ruleId),
  domain: m.domain,
  concern: m.concern,
  alpId: m.abstractLanguagePrimitive.id,
  severity: m.rule.severity,
  description: m.rule.description,
  frameworks: m.rule.frameworks,
  isFrameworkIndependent: m.rule.isFrameworkIndependent,
  example: {
    nonCompliant: m.rule.nonCompliantExample,
    compliant: m.rule.compliantExample
  },
  remediation: m.rule.remediation,
  remediationStatus: m.rule.remediationStatus,
  knownLimitation: m.rule.knownLimitation
}));

export const TOTAL_RULE_COUNT = RULE_CATALOG.length;

/** Human-readable label for a FrameworkType, for UI badges/filters. */
export const FRAMEWORK_LABELS: Record<FrameworkType, string> = {
  REACT_JSX: 'React',
  NEXT_JS: 'Next.js',
  ANGULAR_TEMPLATE: 'Angular',
  VUE_SFC: 'Vue',
  GENERIC_ESTREE: 'JavaScript/TypeScript',
  SVELTE: 'Svelte'
};

/** The frameworks this product publicly supports and documents (excludes SVELTE, which is
 *  detected at the file-extension level but not marketed/documented as a supported target). */
export const SUPPORTED_FRAMEWORKS: FrameworkType[] = ['REACT_JSX', 'NEXT_JS', 'ANGULAR_TEMPLATE', 'VUE_SFC', 'GENERIC_ESTREE'];

export function getRulesForFramework(framework: FrameworkType): RuleCatalogEntry[] {
  return RULE_CATALOG.filter((r) => r.frameworks.includes(framework));
}

export function getRuleById(id: string): RuleCatalogEntry | undefined {
  return RULE_CATALOG.find((r) => r.id === id);
}

export { CORE_ALPS };
