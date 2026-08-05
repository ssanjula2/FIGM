"use strict";
/**
 * Framework-Independent Guideline Model (FIGM)
 * Static Analyzer Execution Engine & Dynamic Profiler Integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleExecutionEngine = void 0;
const source_parser_js_1 = require("../parser/source-parser.js");
const ast_detection_engine_js_1 = require("../ast/ast-detection-engine.js");
const alp_extractor_js_1 = require("../parser/alp-extractor.js");
const complexity_analyzer_js_1 = require("./complexity-analyzer.js");
const dynamic_profiler_js_1 = require("./dynamic-profiler.js");
class RuleExecutionEngine {
    /**
     * Run full static analysis & dynamic profiling scan on a single file path with source content
     */
    static analyzeFile(filePath, code) {
        const parseRes = source_parser_js_1.SourceParser.parseSource(code, filePath);
        const profile = dynamic_profiler_js_1.DynamicProfiler.profileExecution(code);
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
        const complexity = complexity_analyzer_js_1.ComplexityAnalyzer.calculateComplexity(parseRes.ast);
        // 2. Extract Abstract Language Primitives (ALPs)
        const primitives = alp_extractor_js_1.ALPExtractionEngine.extractPrimitives(parseRes.ast, parseRes.framework);
        // 3. Evaluate 8 FIGM Core Rules against AST
        const diagnostics = ast_detection_engine_js_1.ASTDetectionEngine.evaluateNode(parseRes.ast, filePath, parseRes.framework);
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
exports.RuleExecutionEngine = RuleExecutionEngine;
//# sourceMappingURL=rule-execution-engine.js.map