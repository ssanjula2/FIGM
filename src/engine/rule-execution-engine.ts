/**
 * Framework-Independent Guideline Model (FIGM)
 * Static Analyzer Execution Engine & Dynamic Profiler Integration
 */

import { DiagnosticReport } from '../types/ast-spec.js';
import { SourceParser, ParseResult } from '../parser/source-parser.js';
import { ASTDetectionEngine } from '../ast/ast-detection-engine.js';
import { ALPExtractionEngine, ALPPrimitiveNode } from '../parser/alp-extractor.js';
import { ComplexityAnalyzer, ComplexityMetrics } from './complexity-analyzer.js';
import { DynamicProfiler, DynamicProfileMetrics } from './dynamic-profiler.js';
import { TypeCheckerService } from '../analysis/type-checker-service.js';
import { ComplexityEngine, DetailedComplexityMetrics } from '../analysis/complexity/complexity-engine.js';
import { calculateQualityScoreFromCounts } from './quality-score.js';

export interface ScanResult {
  filePath: string;
  framework: string;
  totalErrors: number;
  totalWarnings: number;
  extractedALPsCount: number;
  parseErrors: Array<{ line: number; column: number; message: string }>;
  diagnostics: DiagnosticReport[];
  primitives: ALPPrimitiveNode[];
  complexity: DetailedComplexityMetrics & ComplexityMetrics;
  profile: DynamicProfileMetrics;
  qualityScore?: number;
  typeCheckDisclaimer?: string;
}

export class RuleExecutionEngine {
  /**
   * Run full static analysis & dynamic profiling scan on a single file path with source content
   */
  public static analyzeFile(filePath: string, code: string): ScanResult {
    const parseRes: ParseResult = SourceParser.parseSource(code, filePath);
    const profile = DynamicProfiler.profileExecution(code);
    const detailedComplexity = ComplexityEngine.analyzeComplexity(parseRes.ast, code);
    const typeCheckRes = TypeCheckerService.checkCode(code, filePath);

    const diagnostics: DiagnosticReport[] = [];

    // 1. Inject Parse / Syntax Errors if present
    if (parseRes.parseErrors && parseRes.parseErrors.length > 0) {
      for (const err of parseRes.parseErrors) {
        diagnostics.push({
          ruleId: 'SYNTAX-PARSE-ERROR',
          ruleName: 'Syntax Parse Error',
          category: 'SYNTAX_ERROR',
          domain: 'PERFORMANCE',
          concern: 'RESOURCE_UTILIZATION',
          severity: 'CRITICAL',
          filePath,
          location: {
            start: { line: err.line, column: err.column },
            end: { line: err.line, column: err.column + 5 },
          },
          line: err.line,
          column: err.column,
          offendingCodeSnippet: code.split('\n')[err.line - 1] || code.substring(0, 50),
          sourceSnippet: code.split('\n')[err.line - 1] || code.substring(0, 50),
          message: `Syntax Error: ${err.message}`,
          remediation: `Fix syntax syntax near line ${err.line}, column ${err.column}.`,
          recommendation: `Check for unclosed braces, unexpected tokens, or syntax typos.`,
          standardReference: 'ECMAScript Language Specification / Parser Protocol',
          confidenceScore: 1.0,
          fixAvailable: false,
        });
      }
    }

    // 2. Inject Type Compiler Errors
    if (typeCheckRes.hasTypeErrors) {
      diagnostics.push(...typeCheckRes.diagnostics);
    }

    // 3. Evaluate FIGM Guidelines against AST if available
    if (parseRes.ast) {
      const figmDiags = ASTDetectionEngine.evaluateNode(parseRes.ast, filePath, parseRes.framework);
      diagnostics.push(...figmDiags);
    }

    const primitives = parseRes.ast ? ALPExtractionEngine.extractPrimitives(parseRes.ast, parseRes.framework) : [];

    const totalErrors = diagnostics.filter((d) => d.severity === 'CRITICAL' || d.severity === 'HIGH').length;
    const totalWarnings = diagnostics.filter((d) => d.severity === 'MEDIUM' || d.severity === 'LOW').length;

    const criticalCount = diagnostics.filter((d) => d.severity === 'CRITICAL').length;
    const highCount = diagnostics.filter((d) => d.severity === 'HIGH').length;
    const mediumCount = diagnostics.filter((d) => d.severity === 'MEDIUM').length;
    const lowCount = diagnostics.filter((d) => d.severity === 'LOW').length;
    const qualityScore = calculateQualityScoreFromCounts({ criticalCount, highCount, mediumCount, lowCount });

    const legacyComplexity: ComplexityMetrics = {
      cyclomaticComplexity: detailedComplexity.cyclomaticComplexity,
      cognitiveComplexity: detailedComplexity.cognitiveComplexity,
      decisionPointsCount: detailedComplexity.decisionPointsCount,
      maxNestingDepth: detailedComplexity.maxNestingDepth,
      complexityRating: detailedComplexity.complexityRating,
    };

    return {
      filePath,
      framework: parseRes.framework,
      totalErrors,
      totalWarnings,
      extractedALPsCount: primitives.length,
      parseErrors: parseRes.parseErrors,
      diagnostics,
      primitives,
      complexity: { ...detailedComplexity, ...legacyComplexity },
      profile,
      qualityScore,
      typeCheckDisclaimer: typeCheckRes.disclaimer,
    };
  }
}

