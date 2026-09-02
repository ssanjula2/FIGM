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
 * VUE exists (added alongside FIGM-VUE-01/02) because those two rules ARE Vue-*specific* --
 * unlike every rule below them, they are not part of the framework-independent COMMON set and are
 * never evaluated against any other FrameworkType. See FourLayerMapping.rule.frameworks for the
 * per-rule framework applicability that actually determines this.
 */
export type RuleCategory = 'COMMON' | 'NEXTJS' | 'REACT' | 'ANGULAR' | 'VUE';

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
  | 'FOCUS_ORDER'                // WCAG 2.2 SC 2.4.3
  | 'INPUT_MODALITIES';          // WCAG 2.2 SC 2.5.3 (added for FIGM-A11Y-07)

export type ConcernType = PerformanceConcernType | AccessibilityConcernType;

export type RuleSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface StandardTraceability {
  standard: 'ISO_25010' | 'WCAG_2_2';
  clause: string;
  title: string;
  level?: 'A' | 'AA' | 'AAA';
  /** Why this specific Success Criterion (not a different one) applies to this rule -- required
   *  for every WCAG_2_2 entry so a per-rule mapping can be reviewed/challenged on its own merits,
   *  rather than trusted because the field exists. See src/matrix/four-layer-meta-model.ts's
   *  WCAG_22_MAPPINGS for the canonical source (never a single shared default). */
  mappingRationale?: string;
  /** How reliably a static AST check can actually detect this WCAG concern -- distinct from
   *  whether a mapping to a Success Criterion exists at all. Never claim DIRECT_STATIC_CHECK for a
   *  concern static analysis can only approximate. */
  automatedDetectability?: 'DIRECT_STATIC_CHECK' | 'PARTIAL_STATIC_CHECK' | 'HEURISTIC' | 'MANUAL_REVIEW_REQUIRED' | 'NOT_SUPPORTED';
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
    /** Research-facing three-way split (ARCHITECTURE / STATIC_PERFORMANCE / ACCESSIBILITY) --
     *  see src/matrix/four-layer-meta-model.ts's primaryResearchDomain() for why this is additive
     *  to `domain` rather than a replacement of it. */
    primaryResearchDomain: 'ARCHITECTURE' | 'STATIC_PERFORMANCE' | 'ACCESSIBILITY';
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
