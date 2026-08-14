/**
 * Framework-Independent Guideline Model (FIGM)
 * Phase 2: AST Detection Specification & Diagnostic Data Models
 */

import { RuleSeverity, DomainType, ConcernType } from './taxonomy.js';

export interface SourceLocation {
  line: number;
  column: number;
}

export interface SourceRange {
  start: SourceLocation;
  end: SourceLocation;
}

/**
 * Detection provenance for a single ASTNode. Set by whichever builder produced the node --
 * `REAL_AST` for a node derived from genuine parser traversal (currently: the TypeScript
 * compiler API, for REACT_JSX/NEXT_JS/GENERIC_ESTREE/ANGULAR_TEMPLATE's class body), or
 * `LEGACY_TEXT_HEURISTIC` for a node derived from regex/substring matching over source lines
 * (currently: every VUE_SFC node, Angular template-markup rules FIGM-ANG-03/04, and every rule
 * not yet migrated -- see docs/architecture/AST_MIGRATION_MAP.md). Never label a
 * LEGACY_TEXT_HEURISTIC node's evidence as AST-derived, and never claim this field is present
 * on nodes produced before this field existed (treat `undefined` as unknown provenance, not as
 * an implicit REAL_AST).
 */
export type DetectionSourceKind = 'REAL_AST' | 'LEGACY_TEXT_HEURISTIC';

/**
 * Generic Abstract Syntax Tree Node representation
 */
export interface ASTNode {
  type: string;
  name?: string;
  value?: unknown;
  attributes?: Record<string, unknown>;
  loc?: SourceRange;
  parent?: ASTNode;
  children?: ASTNode[];
  scopeType?: 'GLOBAL' | 'MODULE' | 'FUNCTION' | 'LOOP' | 'RENDER' | 'BLOCK';
  sourceKind?: DetectionSourceKind;
  [key: string]: unknown;
}

export type FrameworkType = 'GENERIC_ESTREE' | 'REACT_JSX' | 'NEXT_JS' | 'VUE_SFC' | 'ANGULAR_TEMPLATE' | 'SVELTE';

/**
 * Universal Framework AST Translation Specification
 */
export interface FrameworkASTTranslation {
  framework: FrameworkType;
  nativeNodeType: string;
  targetALPId: string;
  attributeMapping: Record<string, string>;
  elementNameExtractor: string;
  listenerExtractor: string;
}

/**
 * AST Query Selector Template (Babel/ESTree/XPath compatible)
 */
export interface ASTQueryTemplate {
  alpId: string;
  selectorString: string;
  targetFrameworks: FrameworkType[];
  nodeTypes: string[];
  attributeRequirements: Record<string, unknown>;
}

/**
 * Formal Mathematical Predicate Specification
 */
export interface FormalPredicateSpec {
  ruleId: string;
  alpId: string;
  mathNotation: string;
  quantifiers: string;
  domainSet: string;
  conditionPredicate: string;
  plainTextLogic: string;
}

export type DiagnosticCategory =
  | 'SYNTAX_ERROR'
  | 'TYPE_COMPILE_ERROR'
  | 'FIGM_GUIDELINE_VIOLATION'
  | 'SECURITY_ISSUE'
  | 'COMPLEXITY_WARNING';

/**
 * Diagnostic Error Report Metadata Schema
 */
export interface DiagnosticReport {
  ruleId: string;
  ruleName: string;
  category?: DiagnosticCategory;
  domain: DomainType;
  concern: ConcernType;
  severity: RuleSeverity;
  filePath: string;
  location: SourceRange;
  line?: number;
  column?: number;
  offendingCodeSnippet: string;
  sourceSnippet?: string;
  message: string;
  remediation: string;
  recommendation?: string;
  standardReference: string;
  confidenceScore?: number;
  evidence?: string;
  fixAvailable?: boolean;
  /** See DetectionSourceKind. Absent on diagnostic categories this doesn't apply to
   *  (SYNTAX_ERROR, TYPE_COMPILE_ERROR) and on rules not yet touched by the AST migration. */
  sourceKind?: DetectionSourceKind;
}

