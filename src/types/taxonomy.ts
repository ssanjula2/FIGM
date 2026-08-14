/**
 * Framework-Independent Guideline Model (FIGM)
 * Taxonomy and Schema Definitions for SPA Quality Domains
 */

// Type-only import: taxonomy.ts is imported BY ast-spec.ts for RuleSeverity/DomainType/ConcernType,
// so this must stay type-only (erased at compile time) to avoid a runtime circular import.
import type { FrameworkType } from './ast-spec.js';

export type DomainType = 'PERFORMANCE' | 'ACCESSIBILITY';

/**
 * How confidently an automated fix can be applied for a rule's violations, per
 * docs/architecture/RULE_ENGINEERING_AUDIT.md section 5 ("Final Rule Matrix" / remediation column),
 * itself tallied from every `requiresManualReview` assignment in the remediation engine.
 */
export type RemediationStatus = 'AUTOMATED_FIX_VERIFIED' | 'AUTOMATED_FIX_WITH_CAVEAT' | 'MANUAL_REVIEW_REQUIRED';

/**
 * UI-facing rule category bucket. Distinct from `DomainType` (PERFORMANCE/ACCESSIBILITY, the
 * formal taxonomy axis) -- this is "which framework must this code belong to" for display grouping.
 * There is no VUE bucket because no rule is Vue-*specific*: Vue files are only ever covered by the
 * COMMON (framework-independent) rules -- see FourLayerMapping.rule.frameworks for the per-rule
 * framework applicability that actually determines Vue coverage.
 */
export type RuleCategory = 'COMMON' | 'NEXTJS' | 'REACT' | 'ANGULAR';

export type PerformanceConcernType =
  | 'BUNDLE_SIZE'
  | 'ASYNC_LEAKS'
  | 'INVARIANT_ALLOCATIONS'
  | 'LAYOUT_INSTABILITY'
  | 'RESOURCE_UTILIZATION'
  | 'ARCHITECTURE';

export type AccessibilityConcernType =
  | 'KEYBOARD_ACCESSIBILITY'     // WCAG 2.2 SC 2.1.1
  | 'NAME_ROLE_VALUE'           // WCAG 2.2 SC 4.1.2
  | 'STATUS_MESSAGES'           // WCAG 2.2 SC 4.1.3
  | 'FOCUS_ORDER';               // WCAG 2.2 SC 2.4.3

export type ConcernType = PerformanceConcernType | AccessibilityConcernType;

export type RuleSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface StandardTraceability {
  standard: 'ISO_25010' | 'WCAG_2_2';
  clause: string;
  title: string;
  level?: 'A' | 'AA' | 'AAA';
}

/**
 * Abstract Language Primitive (ALP)
 * Generic Abstract Syntax Tree (AST) construct representation
 */
export interface AbstractLanguagePrimitive {
  id: string;
  name: string;
  description: string;
  astNodeType: string[];
  semanticConstraint: string;
}

/**
 * Guideline Definition Metadata
 */
export interface GuidelineMetadata {
  id: string;
  name: string;
  domain: DomainType;
  concern: ConcernType;
  description: string;
  isFrameworkIndependent: boolean;
  frameworkExclusionReason?: string;
  isStaticallyDetectable: boolean;
  staticDetectionExclusionReason?: string;
  traceability?: StandardTraceability;
  alpId: string;
}

/**
 * Stage Result for Guideline Filtering Engine
 */
export interface FilterStageResult {
  stageIndex: number;
  stageName: string;
  inputCount: number;
  outputCount: number;
  retainedIds: string[];
  eliminatedIds: string[];
  eliminationReasons: Record<string, string>;
}

export interface PipelineExecutionReport {
  timestamp: string;
  initialCount: number;
  finalCount: number;
  stages: FilterStageResult[];
  coreGuidelines: GuidelineMetadata[];
}

/**
 * Four-Layer Hierarchy Mapping Item
 */
export interface FourLayerMapping {
  domain: DomainType;
  concern: ConcernType;
  abstractLanguagePrimitive: AbstractLanguagePrimitive;
  rule: {
    ruleId: string;
    ruleName: string;
    severity: RuleSeverity;
    description: string;
    nonCompliantExample: string;
    compliantExample: string;
    remediation: string;
    /** Every FrameworkType this rule is actually evaluated against by ASTDetectionEngine.evaluateNode
     *  (verified against its dispatch conditions in src/ast/ast-detection-engine.ts), not an aspirational list. */
    frameworks: FrameworkType[];
    /** True only when the rule fires unconditionally regardless of FrameworkType (the 12 universal
     *  PERF/A11Y rules). Never true for a rule whose evaluator gates on a specific `framework` value --
     *  see task requirement "do not label a rule framework-independent if the implementation is
     *  framework-specific." */
    isFrameworkIndependent: boolean;
    remediationStatus: RemediationStatus;
    /** Known detection limitation/over-approximation, sourced from docs/architecture/RULE_ENGINEERING_AUDIT.md
     *  section 5 -- never left blank, since every rule in this engine has at least one documented edge case. */
    knownLimitation: string;
  };
}

/**
 * Complete FIGM Master Specification JSON Schema
 */
export interface FIGMMasterSpecification {
  meta: {
    title: string;
    version: string;
    description: string;
    framework: string;
    generatedAt: string;
    totalCoreRules: number;
  };
  taxonomies: {
    domains: {
      id: DomainType;
      name: string;
      description: string;
      concerns: {
        id: ConcernType;
        name: string;
        description: string;
        standardRef: string;
      }[];
    }[];
  };
  abstractLanguagePrimitives: AbstractLanguagePrimitive[];
  rules: {
    id: string;
    domain: DomainType;
    concern: ConcernType;
    category: RuleCategory;
    alpId: string;
    name: string;
    severity: RuleSeverity;
    description: string;
    standardTraceability: StandardTraceability;
    detectionStrategy: {
      astPatterns: string[];
      scopeRequirements: string;
      evaluatorType: 'AST_STRUCTURE' | 'CFG_REACHABILITY' | 'DATA_FLOW';
    };
    examples: {
      nonCompliant: string;
      compliant: string;
    };
    remediation: string;
    frameworks: FrameworkType[];
    isFrameworkIndependent: boolean;
    remediationStatus: RemediationStatus;
    knownLimitation: string;
  }[];
}
