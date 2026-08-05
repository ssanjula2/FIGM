/**
 * Framework-Independent Guideline Model (FIGM)
 * Taxonomy and Schema Definitions for SPA Quality Domains
 */

export type DomainType = 'PERFORMANCE' | 'ACCESSIBILITY';

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
  }[];
}
