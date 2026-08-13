import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine.js';
import { SourceParser } from '../src/parser/source-parser.js';
import { ASTNode } from '../src/types/ast-spec.js';

describe('FIGM Phase 2 AST Detection Engine & Predicates', () => {
  test('does not misclassify a React JSX component nested in any app-like path as Next.js', () => {
    const code = `
      export default function UserCard() {
        return <div className="card">Hello</div>;
      }
    `;

    const parseRes = SourceParser.parseSource(code, 'src/app/components/UserCard.tsx');
    assert.equal(parseRes.framework, 'REACT_JSX');
    assert.notEqual(parseRes.framework, 'NEXT_JS');
  });

  test('Detects FIGM-PERF-01: Invariant Object Allocation in Loop Scope', () => {
    const nonCompliantAST: ASTNode = {
      type: 'ObjectExpression',
      scopeType: 'LOOP',
      attributes: { isInvariant: true, codeSnippet: 'const config = { theme: "dark" };' },
      loc: { start: { line: 5, column: 4 }, end: { line: 5, column: 35 } }
    };

    const reports = ASTDetectionEngine.evaluateNode(nonCompliantAST, 'src/components/List.js', 'GENERIC_ESTREE');
    assert.equal(reports.length, 1);
    assert.equal(reports[0].ruleId, 'FIGM-PERF-01');
    assert.equal(reports[0].severity, 'HIGH');
    assert.equal(reports[0].location.start.line, 5);
  });

  test('Detects FIGM-PERF-02: Un-dimensioned Layout Image Element in React JSX', () => {
    const nonCompliantJSX: ASTNode = {
      type: 'JSXElement',
      name: 'img',
      attributes: { src: '/avatar.png', codeSnippet: '<img src="/avatar.png" />' },
      loc: { start: { line: 12, column: 2 }, end: { line: 12, column: 25 } }
    };

    const reports = ASTDetectionEngine.evaluateNode(nonCompliantJSX, 'src/Avatar.jsx', 'REACT_JSX');
    assert.equal(reports.length, 1);
    assert.equal(reports[0].ruleId, 'FIGM-PERF-02');
    assert.equal(reports[0].severity, 'HIGH');
  });

  test('Does not flag compliant FIGM-PERF-02 Image with width and height', () => {
    const compliantJSX: ASTNode = {
      type: 'JSXElement',
      name: 'img',
      attributes: { src: '/avatar.png', width: 48, height: 48, codeSnippet: '<img src="/avatar.png" width={48} height={48} />' }
    };

    const reports = ASTDetectionEngine.evaluateNode(compliantJSX, 'src/Avatar.jsx', 'REACT_JSX');
    assert.equal(reports.length, 0);
  });

  test('Detects FIGM-PERF-03: Unbounded Event Listener Disposal', () => {
    const nonCompliantCall: ASTNode = {
      type: 'CallExpression',
      name: 'addEventListener',
      attributes: { hasPairedRemoval: false, codeSnippet: 'window.addEventListener("resize", fn)' },
      loc: { start: { line: 8, column: 4 }, end: { line: 8, column: 40 } }
    };

    const reports = ASTDetectionEngine.evaluateNode(nonCompliantCall, 'src/useWindow.js', 'GENERIC_ESTREE');
    assert.equal(reports.length, 1);
    assert.equal(reports[0].ruleId, 'FIGM-PERF-03');
    assert.equal(reports[0].severity, 'CRITICAL');
  });

  test('Detects FIGM-PERF-04: Static Import in Deferred Execution Path', () => {
    const nonCompliantImport: ASTNode = {
      type: 'ImportDeclaration',
      attributes: { referencedInConditional: true, codeSnippet: 'import HeavyChart from "heavy-chart"' },
      loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 40 } }
    };

    const reports = ASTDetectionEngine.evaluateNode(nonCompliantImport, 'src/Chart.js', 'GENERIC_ESTREE');
    assert.equal(reports.length, 1);
    assert.equal(reports[0].ruleId, 'FIGM-PERF-04');
    assert.equal(reports[0].severity, 'MEDIUM');
  });

  test('Detects FIGM-A11Y-01: Non-interactive div with onClick lacking keyboard listener', () => {
    const nonCompliantDiv: ASTNode = {
      type: 'JSXElement',
      name: 'div',
      attributes: { onClick: 'handleClick', codeSnippet: '<div onClick={handleClick}>Click Me</div>' },
      loc: { start: { line: 20, column: 4 }, end: { line: 20, column: 42 } }
    };

    const reports = ASTDetectionEngine.evaluateNode(nonCompliantDiv, 'src/Button.jsx', 'REACT_JSX');
    assert.equal(reports.length, 1);
    assert.equal(reports[0].ruleId, 'FIGM-A11Y-01');
    assert.equal(reports[0].severity, 'CRITICAL');
  });

  test('Detects FIGM-A11Y-02: Custom interactive control missing ARIA role and label', () => {
    const nonCompliantCustom: ASTNode = {
      type: 'JSXElement',
      name: 'CustomSelect',
      attributes: { isCustomControl: true, codeSnippet: '<CustomSelect />' },
      loc: { start: { line: 30, column: 2 }, end: { line: 30, column: 18 } }
    };

    const reports = ASTDetectionEngine.evaluateNode(nonCompliantCustom, 'src/Select.jsx', 'REACT_JSX');
    assert.equal(reports.length, 1);
    assert.equal(reports[0].ruleId, 'FIGM-A11Y-02');
    assert.equal(reports[0].severity, 'HIGH');
  });

  test('Detects FIGM-A11Y-03: Dynamic status mutation missing aria-live', () => {
    const nonCompliantStatus: ASTNode = {
      type: 'JSXElement',
      name: 'div',
      attributes: { isDynamicMutation: true, codeSnippet: '<div>{statusMessage}</div>' },
      loc: { start: { line: 15, column: 4 }, end: { line: 15, column: 30 } }
    };

    const reports = ASTDetectionEngine.evaluateNode(nonCompliantStatus, 'src/Status.jsx', 'REACT_JSX');
    assert.equal(reports.length, 1);
    assert.equal(reports[0].ruleId, 'FIGM-A11Y-03');
    assert.equal(reports[0].severity, 'HIGH');
  });

  test('Detects FIGM-A11Y-04: Modal unmount without restoring focus', () => {
    const nonCompliantModal: ASTNode = {
      type: 'JSXElement',
      name: 'Modal',
      attributes: {
        isOverlay: true,
        restoresFocusOnUnmount: false,
        role: 'dialog',
        'aria-label': 'Confirmation Dialog',
        codeSnippet: '<Modal isOpen={isOpen} />'
      },
      loc: { start: { line: 40, column: 2 }, end: { line: 40, column: 28 } }
    };

    const reports = ASTDetectionEngine.evaluateNode(nonCompliantModal, 'src/Modal.jsx', 'REACT_JSX');
    assert.equal(reports.length, 1);
    assert.equal(reports[0].ruleId, 'FIGM-A11Y-04');
    assert.equal(reports[0].severity, 'CRITICAL');
  });
});
