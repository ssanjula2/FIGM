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
}

