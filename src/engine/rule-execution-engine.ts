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

export interface ScanResult {
  filePath: string;
  framework: string;
  totalErrors: number;
  totalWarnings: number;
  extractedALPsCount: number;
  parseErrors: Array<{ line: number; column: number; message: string }>;
  diagnostics: DiagnosticReport[];
  primitives: ALPPrimitiveNode[];
  complexity: ComplexityMetrics;
  profile: DynamicProfileMetrics;
}

export class RuleExecutionEngine {
  /**
   * Run full static analysis & dynamic profiling scan on a single file path with source content
   */
  public static analyzeFile(filePath: string, code: string): ScanResult {
    const parseRes: ParseResult = SourceParser.parseSource(code, filePath);
    const profile = DynamicProfiler.profileExecution(code);

    if (!parseRes.ast) {
      return {
        filePath,
        framework: parseRes.framework,
        totalErrors: parseRes.parseErrors.length,
        totalWarnings: 0,
        extractedALPsCount: 0,
        parseErrors: parseRes.parseErrors,
        diagnostics: [],
        primitives: [],
        complexity: {
          cyclomaticComplexity: 1,
          cognitiveComplexity: 0,
          decisionPointsCount: 0,
          maxNestingDepth: 0,
          complexityRating: 'A',
        },
        profile,
      };
    }

    // 1. Calculate AST Cyclomatic & Cognitive Complexity
    const complexity = ComplexityAnalyzer.calculateComplexity(parseRes.ast);

    // 2. Extract Abstract Language Primitives (ALPs)
    const primitives = ALPExtractionEngine.extractPrimitives(parseRes.ast, parseRes.framework);

    // 3. Evaluate 8 FIGM Core Rules against AST
    const diagnostics = ASTDetectionEngine.evaluateNode(parseRes.ast, filePath, parseRes.framework);

    const totalErrors = diagnostics.filter((d) => d.severity === 'CRITICAL' || d.severity === 'HIGH').length;
    const totalWarnings = diagnostics.filter((d) => d.severity === 'MEDIUM' || d.severity === 'LOW').length;

    return {
      filePath,
      framework: parseRes.framework,
      totalErrors,
      totalWarnings,
      extractedALPsCount: primitives.length,
      parseErrors: parseRes.parseErrors,
      diagnostics,
      primitives,
      complexity,
      profile,
    };
  }
}
