/**
 * FIGM Code Inspector — Code Complexity Unit Test Suite
 * Phase 6 Control-Flow & Cyclomatic Complexity Formula Verification
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ComplexityEngine } from '../src/analysis/complexity/complexity-engine.js';
import { SourceParser } from '../src/parser/source-parser.js';

describe('Code Complexity Engine Specification', () => {
  const getAST = (code: string) => SourceParser.parseSource(code, 'test.ts').ast;

  test('Fixture 1: Empty function should have cyclomatic complexity of 1', () => {
    const code = `function empty() {}`;
    const metrics = ComplexityEngine.analyzeComplexity(getAST(code), code);
    assert.equal(metrics.cyclomaticComplexity, 1);
    assert.equal(metrics.decisionPointsCount, 0);
    assert.equal(metrics.linesOfCode, 1);
  });

  test('Fixture 2: Simple linear function should have cyclomatic complexity of 1', () => {
    const code = `
      function add(a, b) {
        const sum = a + b;
        return sum;
      }
    `;
    const metrics = ComplexityEngine.analyzeComplexity(getAST(code), code);
    assert.equal(metrics.cyclomaticComplexity, 1);
  });

  test('Fixture 3: One if statement should increase cyclomatic complexity to 2', () => {
    const code = `
      function check(x) {
        if (x > 10) {
          return true;
        }
        return false;
      }
    `;
    const metrics = ComplexityEngine.analyzeComplexity(getAST(code), code);
    assert.equal(metrics.cyclomaticComplexity, 2);
    assert.equal(metrics.decisionPointsCount, 1);
  });

  test('Fixture 4: Multiple independent if statements', () => {
    const code = `
      function multi(a, b, c) {
        if (a) console.log(a);
        if (b) console.log(b);
        if (c) console.log(c);
      }
    `;
    const metrics = ComplexityEngine.analyzeComplexity(getAST(code), code);
    assert.equal(metrics.cyclomaticComplexity, 4);
    assert.equal(metrics.decisionPointsCount, 3);
  });

  test('Fixture 5: Nested if statements increase max nesting depth', () => {
    const code = `
      function nested(a, b) {
        if (a) {
          if (b) {
            console.log('nested');
          }
        }
      }
    `;
    const metrics = ComplexityEngine.analyzeComplexity(getAST(code), code);
    assert.equal(metrics.cyclomaticComplexity, 3);
    assert.ok(metrics.maxNestingDepth >= 2);
  });

  test('Fixture 6: for loop increases cyclomatic complexity', () => {
    const code = `
      function loop(arr) {
        for (let i = 0; i < arr.length; i++) {
          console.log(arr[i]);
        }
      }
    `;
    const metrics = ComplexityEngine.analyzeComplexity(getAST(code), code);
    assert.equal(metrics.cyclomaticComplexity, 2);
    assert.equal(metrics.constructBreakdown['for'], 1);
  });

  test('Fixture 7: while loop increases cyclomatic complexity', () => {
    const code = `
      function loop(x) {
        while (x > 0) {
          x--;
        }
      }
    `;
    const metrics = ComplexityEngine.analyzeComplexity(getAST(code), code);
    assert.equal(metrics.cyclomaticComplexity, 2);
    assert.equal(metrics.constructBreakdown['while'], 1);
  });

  test('Fixture 8: switch statement with cases', () => {
    const code = `
      function handle(val) {
        switch(val) {
          case 'A': return 1;
          case 'B': return 2;
          default: return 0;
        }
      }
    `;
    const metrics = ComplexityEngine.analyzeComplexity(getAST(code), code);
    assert.equal(metrics.cyclomaticComplexity, 3);
    assert.equal(metrics.constructBreakdown['case'], 2);
  });

  test('Fixture 9: try / catch block', () => {
    const code = `
      function safe() {
        try {
          doSomething();
        } catch(err) {
          console.error(err);
        }
      }
    `;
    const metrics = ComplexityEngine.analyzeComplexity(getAST(code), code);
    assert.equal(metrics.cyclomaticComplexity, 2);
    assert.equal(metrics.constructBreakdown['catch'], 1);
  });

  test('Fixture 10: Complex real-world function rating', () => {
    const code = `
      function processOrder(order) {
        if (!order || !order.items) return false;
        let total = 0;
        for (let i = 0; i < order.items.length; i++) {
          const item = order.items[i];
          if (item.active && item.price > 0) {
            if (item.discount) {
              total += item.price * 0.9;
            } else {
              total += item.price;
            }
          }
        }
        return total > 100 ? total * 0.95 : total;
      }
    `;
    const metrics = ComplexityEngine.analyzeComplexity(getAST(code), code);
    assert.ok(metrics.cyclomaticComplexity > 3);
  });
});
