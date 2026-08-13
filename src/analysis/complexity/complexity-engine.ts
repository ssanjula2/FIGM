/**
 * Framework-Independent Guideline Model (FIGM)
 * AST Control-Flow Complexity Analysis Engine
 */

export interface DetailedComplexityMetrics {
  linesOfCode: number;
  logicalLinesOfCode: number;
  functionCount: number;
  cyclomaticComplexity: number;
  averageFunctionComplexity: number;
  maximumFunctionComplexity: number;
  maxNestingDepth: number;
  cognitiveComplexity: number;
  complexityRating: 'A' | 'B+' | 'B' | 'C' | 'D' | 'F';
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  decisionPointsCount: number;
  constructBreakdown: Record<string, number>;
}

export class ComplexityEngine {
  private static estimateMaxNestingDepthFromCode(code: string): number {
    const lines = code.split(/\r?\n/);
    let braceDepth = 0;
    let maxDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const controlFlowOpening = (trimmed.match(/\b(?:if|for|while|switch|catch|else if)\b\s*\(/g) || []).length;
      const openBraces = (trimmed.match(/\{/g) || []).length;
      const closeBraces = (trimmed.match(/\}/g) || []).length;

      if (controlFlowOpening > 0 && openBraces > 0) {
        const computedDepth = braceDepth + controlFlowOpening;
        maxDepth = Math.max(maxDepth, computedDepth);
      } else if (controlFlowOpening > 0) {
        const computedDepth = braceDepth + controlFlowOpening;
        maxDepth = Math.max(maxDepth, computedDepth);
      }

      braceDepth += openBraces - closeBraces;
    }

    return maxDepth;
  }

  /**
   * Calculate dynamic code complexity metrics from AST and raw code
   */
  public static analyzeComplexity(ast: any, code: string): DetailedComplexityMetrics {
    const rawLines = code.split('\n');
    const linesOfCode = rawLines.length;
    const nonCommentNonEmptyLines = rawLines.filter((l) => {
      const trimmed = l.trim();
      return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && !trimmed.startsWith('*');
    });
    const logicalLinesOfCode = nonCommentNonEmptyLines.length;

    if (!ast) {
      return {
        linesOfCode,
        logicalLinesOfCode,
        functionCount: 0,
        cyclomaticComplexity: 1,
        averageFunctionComplexity: 1,
        maximumFunctionComplexity: 1,
        maxNestingDepth: 0,
        cognitiveComplexity: 0,
        complexityRating: 'A',
        riskRating: 'LOW',
        decisionPointsCount: 0,
        constructBreakdown: {},
      };
    }

    let decisionPointsCount = 0;
    let functionCount = 0;
    const functionComplexities: number[] = [];
    const constructBreakdown: Record<string, number> = {};

    let maxDepth = 0;

    const recordConstruct = (name: string) => {
      constructBreakdown[name] = (constructBreakdown[name] || 0) + 1;
      decisionPointsCount++;
    };

    const traverse = (node: any, currentDepth: number, currentFuncComplexity: { val: number } | null) => {
      if (!node || typeof node !== 'object') return;

      if (currentDepth > maxDepth) {
        maxDepth = currentDepth;
      }

      let nextDepth = currentDepth;
      const type = node.type || '';

      const isControlFlow =
        type === 'IfStatement' ||
        type === 'ForStatement' ||
        type === 'ForInStatement' ||
        type === 'ForOfStatement' ||
        type === 'WhileStatement' ||
        type === 'DoWhileStatement' ||
        type === 'SwitchStatement' ||
        type === 'CatchClause';

      if (isControlFlow) {
        nextDepth = currentDepth + 1;
      }

      if (type === 'IfStatement') {
        recordConstruct('if');
        if (currentFuncComplexity) currentFuncComplexity.val++;
      } else if (type === 'ForStatement' || type === 'ForInStatement' || type === 'ForOfStatement') {
        recordConstruct('for');
        if (currentFuncComplexity) currentFuncComplexity.val++;
      } else if (type === 'WhileStatement' || type === 'DoWhileStatement') {
        recordConstruct('while');
        if (currentFuncComplexity) currentFuncComplexity.val++;
      } else if (type === 'SwitchCase' && node.test) {
        recordConstruct('case');
        if (currentFuncComplexity) currentFuncComplexity.val++;
      } else if (type === 'CatchClause') {
        recordConstruct('catch');
        if (currentFuncComplexity) currentFuncComplexity.val++;
      } else if (type === 'ConditionalExpression') {
        recordConstruct('ternary');
        if (currentFuncComplexity) currentFuncComplexity.val++;
      } else if (type === 'LogicalExpression' && (node.operator === '&&' || node.operator === '||' || node.operator === '??')) {
        recordConstruct('logical');
        if (currentFuncComplexity) currentFuncComplexity.val++;
      }

      const isFunction =
        type === 'FunctionDeclaration' ||
        type === 'FunctionExpression' ||
        type === 'ArrowFunctionExpression' ||
        type === 'ClassMethod' ||
        type === 'ObjectMethod';

      if (isFunction) {
        functionCount++;
        const funcComp = { val: 1 };
        for (const key of Object.keys(node)) {
          if (key === 'parent') continue;
          const child = node[key];
          if (Array.isArray(child)) {
            child.forEach((c) => traverse(c, currentDepth + 1, funcComp));
          } else if (child && typeof child === 'object' && child.type) {
            traverse(child, currentDepth + 1, funcComp);
          }
        }
        functionComplexities.push(funcComp.val);
        return;
      }

      for (const key of Object.keys(node)) {
        if (key === 'parent') continue;
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach((c) => traverse(c, nextDepth, currentFuncComplexity));
        } else if (child && typeof child === 'object' && child.type) {
          traverse(child, nextDepth, currentFuncComplexity);
        }
      }
    };

    traverse(ast.program || ast, 0, null);

    const sourceDepth = this.estimateMaxNestingDepthFromCode(code);
    if (sourceDepth > maxDepth) {
      maxDepth = sourceDepth;
    }

    const cyclomaticComplexity = 1 + decisionPointsCount;
    const maxFunctionComplexity = functionComplexities.length > 0 ? Math.max(...functionComplexities) : cyclomaticComplexity;
    const sumFuncComp = functionComplexities.reduce((a, b) => a + b, 0);
    const avgFunctionComplexity = functionCount > 0 ? Number((sumFuncComp / functionCount).toFixed(1)) : cyclomaticComplexity;

    let complexityRating: 'A' | 'B+' | 'B' | 'C' | 'D' | 'F' = 'A';
    if (cyclomaticComplexity <= 5) complexityRating = 'A';
    else if (cyclomaticComplexity <= 10) complexityRating = 'B+';
    else if (cyclomaticComplexity <= 15) complexityRating = 'B';
    else if (cyclomaticComplexity <= 20) complexityRating = 'C';
    else if (cyclomaticComplexity <= 30) complexityRating = 'D';
    else complexityRating = 'F';

    let riskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (cyclomaticComplexity > 25 || maxFunctionComplexity > 15) {
      riskRating = 'CRITICAL';
    } else if (cyclomaticComplexity > 15 || maxFunctionComplexity > 10) {
      riskRating = 'HIGH';
    } else if (cyclomaticComplexity > 7 || maxFunctionComplexity > 5) {
      riskRating = 'MEDIUM';
    }

    return {
      linesOfCode,
      logicalLinesOfCode,
      functionCount,
      cyclomaticComplexity,
      averageFunctionComplexity: avgFunctionComplexity,
      maximumFunctionComplexity: maxFunctionComplexity,
      maxNestingDepth: maxDepth,
      cognitiveComplexity: decisionPointsCount + maxDepth,
      complexityRating,
      riskRating,
      decisionPointsCount,
      constructBreakdown,
    };
  }
}
