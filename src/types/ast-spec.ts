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
  /** Authoritative separation of the two independent Live Scan diagnostic systems -- see
   *  src/engine/diagnostic-classifier.ts. Always set by RuleExecutionEngine.buildScanResult;
   *  optional here only because some callers construct a DiagnosticReport before classification. */
  kind?: 'FIGM_RULE' | 'GENERAL_CODE_ERROR';
  /** Pre-fix-attempt classification, computed for every diagnostic regardless of domain (see
   *  diagnostic-classifier.ts's getFixabilityStatus) -- ambiguity about the right fix is not
   *  unique to compiler errors, so this applies equally to FIGM_RULE and GENERAL_CODE_ERROR. */
  fixabilityStatus?: 'AUTO_FIX_AVAILABLE' | 'SUGGESTED_FIX_ONLY' | 'NO_SAFE_FIX';
  /** Human-facing compiler/parser diagnostic code for a GENERAL_CODE_ERROR (e.g. "TS2322"); absent
   *  for FIGM_RULE diagnostics, whose ruleId is already the right thing to display. */
  compilerCode?: string;
  /** Other diagnostics (never including this one) that a same-line grouping pass (see
   *  src/engine/general-error-grouping.ts) judged likely caused by the SAME underlying source
   *  defect as this one -- e.g. three separate TypeScript diagnostics all produced by one keyword
   *  typo. Populated only on the ONE "representative" DiagnosticReport built for such a group
   *  (never on a lone/ungrouped diagnostic, and never on a FIGM_RULE diagnostic, which is always
   *  its own singleton group). Used two ways: (1) src/ai/prompt-builder.ts surfaces these to the AI
   *  so it understands the full symptom picture instead of one isolated diagnostic; (2)
   *  src/engine/remediation-validation.server.ts's re-scan check requires every ruleId here to ALSO
   *  be absent post-fix, not just this defect's own ruleId -- so a "fix" that silences only the
   *  representative while a sibling symptom of the same defect lingers is correctly rejected, not
   *  reported FIXED. */
  relatedDiagnostics?: Array<{ ruleId: string; message: string; location?: SourceRange }>;
}

