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
import { detectArrayIndexKey, supportsRealAstAnalysis } from '../analysis/react-ast-rules.js';
import { classifyDiagnosticKind, compilerDiagnosticCode, getFixabilityStatus } from './diagnostic-classifier.js';

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
  /** Server-authoritative counts backing the Live Scan's two-system summary -- see
   *  diagnostic-classifier.ts. figmRuleCount + generalCodeErrorCount === diagnostics.length always. */
  figmRuleCount: number;
  generalCodeErrorCount: number;
  /** Honest status of the analysis itself, distinct from what it found. `figmStatus` must never
   *  read COMPLETE when parsing prevented full traversal -- BLOCKED (no AST at all -- FIGM rules
   *  could not run) and PARTIAL (an AST exists via best-effort recovery, but the source also had
   *  real parse errors) are both real, reportable states, never silently collapsed into COMPLETE
   *  just because zero FIGM diagnostics happened to come back. UNSUPPORTED_FRAMEWORK is the same
   *  honesty principle applied to a framework FIGM detects but has no rule coverage for at all
   *  (currently: SVELTE) -- distinct from BLOCKED (a parse failure on a framework FIGM DOES
   *  support), since here parsing may well succeed but no FIGM rule understands the framework's
   *  own syntax, so a clean diagnostics list must never be read as "genuinely clean." This is the
   *  server-authoritative signal app/live-scan/page.tsx's UI reads, replacing what used to be a
   *  client-only hardcoded framework set that had to be manually kept in sync with this file. */
  analysis: {
    parserStatus: 'VALID' | 'INVALID';
    figmStatus: 'COMPLETE' | 'PARTIAL' | 'BLOCKED' | 'UNSUPPORTED_FRAMEWORK';
  };
}

export class RuleExecutionEngine {
  /**
   * Run full static analysis & dynamic profiling scan on a single file path with source content.
   * Uses the synchronous DynamicProfiler.profileExecution -- this is the version used by the CLI,
   * the test suite, and the eval/benchmark harnesses (every single-shot, non-concurrent caller).
   * See `analyzeFileAsync` below for the sibling used by the live web server.
   */
  public static analyzeFile(filePath: string, code: string): ScanResult {
    const profile = DynamicProfiler.profileExecution(code);
    return RuleExecutionEngine.buildScanResult(filePath, code, profile);
  }

  /**
   * Async sibling of `analyzeFile`, using DynamicProfiler.profileExecutionAsync (a non-blocking
   * `child_process.spawn` instead of `spawnSync` for the dynamic-profiling sandbox child) so a
   * slow/hanging scan can never block the Node.js event loop and stall unrelated concurrent
   * requests. Used by the live web server's request handlers (app/api/scan, /api/scans,
   * /api/submissions, /api/user-study/log-scan, /api/report), which face genuine concurrent
   * multi-user load -- and by RemediationEngine's re-scan verification step, since that also runs
   * inside those same request handlers. `analyzeFile` (sync) is deliberately left unchanged and
   * still used everywhere else, to avoid an invasive interface change across its ~90 existing call
   * sites (CLI, tests, eval/benchmark harnesses) where the blocking behavior was never a problem.
   */
  public static async analyzeFileAsync(filePath: string, code: string): Promise<ScanResult> {
    const profile = await DynamicProfiler.profileExecutionAsync(code);
    return RuleExecutionEngine.buildScanResult(filePath, code, profile);
  }

  private static buildScanResult(filePath: string, code: string, profile: DynamicProfileMetrics): ScanResult {
    const parseRes: ParseResult = SourceParser.parseSource(code, filePath);
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

      // Stage A real-AST migration (see src/analysis/react-ast-rules.ts): for React/Next.js
      // files, FIGM-REACT-02 is detected via genuine TypeScript-compiler AST traversal instead
      // of the regex/substring heuristic every other rule still uses. Swap in place -- same rule
      // ID, same report shape, same position in the pipeline -- rather than appending a second,
      // duplicate diagnostic for the same violation.
      if (supportsRealAstAnalysis(parseRes.framework)) {
        const withoutRegexReact02 = figmDiags.filter((d) => d.ruleId !== 'FIGM-REACT-02');
        const realAstReact02 = detectArrayIndexKey(code, filePath);
        diagnostics.push(...withoutRegexReact02, ...realAstReact02);
      } else {
        diagnostics.push(...figmDiags);
      }
    }

    const primitives = parseRes.ast ? ALPExtractionEngine.extractPrimitives(parseRes.ast, parseRes.framework) : [];

    // Decorate every diagnostic with its authoritative FIGM_RULE / GENERAL_CODE_ERROR
    // classification (see diagnostic-classifier.ts) -- this is the server-side source of truth
    // the Live Scan UI's two-system separation is built on, computed once here rather than
    // re-derived (and potentially drifting) client-side from ruleId string-matching.
    // fixabilityStatus (AUTO_FIX_AVAILABLE / SUGGESTED_FIX_ONLY / NO_SAFE_FIX) applies uniformly
    // to both domains -- ambiguity about the right fix is not unique to compiler errors (e.g.
    // FIGM-PERF-05's per-item closure fix is exactly as ambiguous as an arbitrary TS2345 mismatch).
    // compilerCode is GENERAL_CODE_ERROR-only: a FIGM ruleId is already the right thing to display.
    for (const d of diagnostics) {
      d.kind = classifyDiagnosticKind(d.ruleId);
      if (d.kind === 'GENERAL_CODE_ERROR') {
        d.compilerCode = compilerDiagnosticCode(d.ruleId);
      }
      d.fixabilityStatus = getFixabilityStatus(code, d);
    }

    const totalErrors = diagnostics.filter((d) => d.severity === 'CRITICAL' || d.severity === 'HIGH').length;
    const totalWarnings = diagnostics.filter((d) => d.severity === 'MEDIUM' || d.severity === 'LOW').length;

    const criticalCount = diagnostics.filter((d) => d.severity === 'CRITICAL').length;
    const highCount = diagnostics.filter((d) => d.severity === 'HIGH').length;
    const mediumCount = diagnostics.filter((d) => d.severity === 'MEDIUM').length;
    const lowCount = diagnostics.filter((d) => d.severity === 'LOW').length;
    const qualityScore = calculateQualityScoreFromCounts({ criticalCount, highCount, mediumCount, lowCount });

    const figmRuleCount = diagnostics.filter((d) => d.kind === 'FIGM_RULE').length;
    const generalCodeErrorCount = diagnostics.length - figmRuleCount;

    const hasParseErrors = parseRes.parseErrors.length > 0;
    const analysis = {
      parserStatus: (hasParseErrors ? 'INVALID' : 'VALID') as 'VALID' | 'INVALID',
      // SVELTE checked first and independently of parse success: FIGM has no detector written for
      // Svelte's own template/event syntax (`on:click`, `{#each}`, ...) at all, so even a
      // successful parse with zero diagnostics must never be reported as COMPLETE -- that would
      // claim a guideline sweep happened when none of FIGM's rules understand this framework's
      // syntax. See ScanResult.analysis's own doc comment.
      figmStatus: (
        parseRes.framework === 'SVELTE' ? 'UNSUPPORTED_FRAMEWORK' : !parseRes.ast ? 'BLOCKED' : hasParseErrors ? 'PARTIAL' : 'COMPLETE'
      ) as 'COMPLETE' | 'PARTIAL' | 'BLOCKED' | 'UNSUPPORTED_FRAMEWORK',
    };

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
      figmRuleCount,
      generalCodeErrorCount,
      analysis,
    };
  }
}

