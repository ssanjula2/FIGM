"use strict";
/**
 * Framework-Independent Guideline Model (FIGM)
 * Static Analysis Engine - AST Cyclomatic & Cognitive Complexity Analyzer
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplexityAnalyzer = void 0;
class ComplexityAnalyzer {
    /**
     * Calculates AST Cyclomatic & Cognitive Complexity metrics from ESTree AST
     */
    static calculateComplexity(ast) {
        if (!ast) {
            return {
                cyclomaticComplexity: 1,
                cognitiveComplexity: 0,
                decisionPointsCount: 0,
                maxNestingDepth: 0,
                complexityRating: 'A',
            };
        }
        let decisionPoints = 0;
        let cognitiveScore = 0;
        let maxDepth = 0;
        const traverse = (node, depth) => {
            if (!node || typeof node !== 'object')
                return;
            if (depth > maxDepth)
                maxDepth = depth;
            // Decision point nodes for Cyclomatic Complexity
            const type = node.type;
            if (type === 'IfStatement' ||
                type === 'ConditionalExpression' || // ternary
                type === 'ForStatement' ||
                type === 'ForInStatement' ||
                type === 'ForOfStatement' ||
                type === 'WhileStatement' ||
                type === 'DoWhileStatement' ||
                type === 'CatchClause' ||
                type === 'SwitchCase') {
                decisionPoints++;
                cognitiveScore += 1 + Math.max(0, depth - 1);
            }
            if (type === 'LogicalExpression' && (node.operator === '&&' || node.operator === '||' || node.operator === '??')) {
                decisionPoints++;
                cognitiveScore++;
            }
            // Recurse children
            const nextDepth = (type === 'IfStatement' || type === 'ForStatement' || type === 'WhileStatement' || type === 'FunctionDeclaration' || type === 'ArrowFunctionExpression')
                ? depth + 1
                : depth;
            for (const key of Object.keys(node)) {
                if (key === 'parent')
                    continue;
                const child = node[key];
                if (Array.isArray(child)) {
                    child.forEach((c) => traverse(c, nextDepth));
                }
                else if (child && typeof child === 'object' && child.type) {
                    traverse(child, nextDepth);
                }
            }
        };
        traverse(ast, 0);
        const cyclomaticComplexity = decisionPoints + 1;
        // Determine Complexity Rating
        let complexityRating = 'A';
        if (cyclomaticComplexity <= 5)
            complexityRating = 'A';
        else if (cyclomaticComplexity <= 10)
            complexityRating = 'B+';
        else if (cyclomaticComplexity <= 15)
            complexityRating = 'B';
        else if (cyclomaticComplexity <= 20)
            complexityRating = 'C';
        else if (cyclomaticComplexity <= 30)
            complexityRating = 'D';
        else
            complexityRating = 'F';
        return {
            cyclomaticComplexity,
            cognitiveComplexity: cognitiveScore,
            decisionPointsCount: decisionPoints,
            maxNestingDepth: maxDepth,
            complexityRating,
        };
    }
}
exports.ComplexityAnalyzer = ComplexityAnalyzer;
//# sourceMappingURL=complexity-analyzer.js.map