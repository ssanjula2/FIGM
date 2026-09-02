import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AstDeterministicFixEngine } from '../src/engine/ast-fix-engine.js';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';
import { SandboxValidationPipeline } from '../src/ai/sandbox-validation-pipeline.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';
import * as ts from 'typescript';

describe('FIGM Final Closure Mandatory Regression Suite', () => {
  it('Section 7 / Section 13: A11Y-01 generates clean handleAction() without (handleAction)()', () => {
    const inputCode = `<div className="action-card" onClick={handleAction}>Open Dashboard</div>`;
    const scanResult = RuleExecutionEngine.analyzeFile('dashboard.tsx', inputCode);
    
    const a11y01Report = scanResult.diagnostics.find(r => r.ruleId === 'FIGM-A11Y-01');
    assert.ok(a11y01Report, 'FIGM-A11Y-01 must be detected on div with onClick');

    const outcome = AstDeterministicFixEngine.tryFix(inputCode, a11y01Report, 'dashboard.tsx');
    assert.equal(outcome.success, true, 'AST fixer must succeed for FIGM-A11Y-01');

    assert.ok(outcome.patchedCode.includes('handleAction()'), 'Patched code must invoke handleAction() cleanly');
    assert.equal(outcome.patchedCode.includes('(handleAction)()'), false, 'Patched code must NOT contain awkward (handleAction)() wrapper');
    assert.ok(outcome.patchedCode.includes('role="button"'), 'Patched code must contain role="button"');
    assert.ok(outcome.patchedCode.includes('tabIndex={0}'), 'Patched code must contain tabIndex={0}');

    // Compile validation
    const sf = ts.createSourceFile('patched.tsx', outcome.patchedCode, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
    const parseDiagnostics = (sf as unknown as { parseDiagnostics?: ts.DiagnosticWithLocation[] }).parseDiagnostics ?? [];
    assert.equal(parseDiagnostics.length, 0, 'Patched TSX must have 0 syntax errors');

    // Re-scan validation
    const rescanResult = RuleExecutionEngine.analyzeFile('dashboard.tsx', outcome.patchedCode);
    const remainingA11y01 = rescanResult.diagnostics.find(r => r.ruleId === 'FIGM-A11Y-01');
    assert.equal(remainingA11y01, undefined, 'FIGM-A11Y-01 must be completely resolved after re-scan');
  });

  it('Section 8 / Section 14: PERF-05 re-scan rejection when patch leaves inline callback', async () => {
    const originalCode = `
      function ItemList({ items }: { items: any[] }) {
        return (
          <ul>
            {items.map(item => (
              <button key={item.id} onClick={() => console.log(item)}>View</button>
            ))}
          </ul>
        );
      }
    `;

    const scanResult = RuleExecutionEngine.analyzeFile('list.tsx', originalCode);
    const perf05Report = scanResult.diagnostics.find(r => r.ruleId === 'FIGM-PERF-05');
    assert.ok(perf05Report, 'FIGM-PERF-05 must be detected');

    // Candidate patch that still contains an inline callback
    const badPatchCode = `
      function ItemList({ items }: { items: any[] }) {
        return (
          <ul>
            {items.map(item => (
              <button key={item.id} onClick={(e) => console.log('Clicked', item)}>View</button>
            ))}
          </ul>
        );
      }
    `;

    const validationResult = await SandboxValidationPipeline.validate(
      originalCode,
      badPatchCode,
      perf05Report,
      'REACT_JSX'
    );

    assert.equal(validationResult.accepted, false, 'Patch leaving PERF-05 violation must be REJECTED');
    assert.ok(validationResult.rejectionReason?.includes('FIGM re-scan') || validationResult.rejectionReason?.includes('Compile/type-check'), 'Rejection reason must reference re-scan failure');
  });

  it('Section 9 / Section 15: PERF-02 declines safe auto-fix when dimensions are unknown', () => {
    const inputCode = `<img src="/dashboard-banner.png" alt="Dashboard banner" />`;
    const scanResult = RuleExecutionEngine.analyzeFile('banner.tsx', inputCode);
    const perf02Report = scanResult.diagnostics.find(r => r.ruleId === 'FIGM-PERF-02');
    assert.ok(perf02Report, 'FIGM-PERF-02 must be detected');

    const outcome = AstDeterministicFixEngine.tryFix(inputCode, perf02Report, 'banner.tsx');
    assert.equal(outcome.success, false, 'Deterministic engine must decline when intrinsic dimensions cannot be safely established');
    assert.equal(outcome.patchedCode, inputCode, 'Source must remain 100% unchanged on decline');
  });

  it('Section 16 / Section 20: Full Sample Dashboard Component Fixture', () => {
    const sampleDashboardCode = `
      "use client";
      import { useEffect, useState } from "react";

      export default function Dashboard() {
        const [items, setItems] = useState([
          { id: 1, name: "Product A" },
          { id: 2, name: "Product B" },
        ]);
        const [count, setCount] = useState(0);

        useEffect(() => {
          console.log("Current count:", count);
        }, [count]);

        const addItem = () => {
          setItems(prev => [
            ...prev,
            { id: Date.now(), name: "New Product" },
          ]);
        };

        return (
          <main>
            <h1>Next.js Dashboard</h1>
            <button onClick={() => setCount(count + 1)}>
              Count: {count}
            </button>
            <div
              className="action-card"
              onClick={() => console.log("Action clicked")}
            >
              Open Dashboard
            </div>
            <img src="/dashboard-banner.png" alt="Dashboard banner" />
            <ul>
              {items.map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          </main>
        );
      }
    `;

    const scanResult = RuleExecutionEngine.analyzeFile('Dashboard.tsx', sampleDashboardCode);
    assert.ok(scanResult.diagnostics.length > 0, 'Must detect valid defects in sample Dashboard component');

    // Compliant list items with key={item.id} must NOT trigger FIGM-REACT-01 key errors
    const listKeyReports = scanResult.diagnostics.filter(r => r.ruleId === 'FIGM-REACT-01' && r.location.start.line > 35);
    assert.equal(listKeyReports.length, 0, 'Compliant key={item.id} must NOT trigger false positive FIGM-REACT-01');

    // Div onClick without keyboard listener MUST be detected
    const a11y01Reports = scanResult.diagnostics.filter(r => r.ruleId === 'FIGM-A11Y-01');
    assert.ok(a11y01Reports.length >= 1, 'div onClick missing keyboard parity MUST trigger FIGM-A11Y-01');
  });

  it('Section 19: Negative path preservation of original source code', async () => {
    const originalCode = `const x = 42;`;
    const dummyDefect: DiagnosticReport = {
      ruleId: 'FIGM-PERF-01',
      ruleName: 'Dummy',
      severity: 'HIGH',
      message: 'Dummy',
      remediation: 'Dummy',
      standardReference: 'Dummy',
      domain: 'PERFORMANCE',
      concern: 'INVARIANT_ALLOCATIONS',
      category: 'FIGM_GUIDELINE_VIOLATION',
      filePath: 'dummy.tsx',
      location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
      offendingCodeSnippet: 'const x = 42;'
    };

    const badSyntaxPatch = `const x = ;`; // Syntax error
    const result = await SandboxValidationPipeline.validate(originalCode, badSyntaxPatch, dummyDefect, 'REACT_JSX');
    assert.equal(result.accepted, false, 'Invalid syntax patch must be rejected');
  });
});
