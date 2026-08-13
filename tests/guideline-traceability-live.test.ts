import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';

/**
 * Phase 9: the live scan path previously returned only a blanket domain-level standardReference
 * ('ISO 25010' or 'WCAG 2.2') for every diagnostic — confirmed by direct inspection of
 * ASTDetectionEngine.createReport() and by calling the live production API (see
 * docs/audit/GUIDELINE_FORENSIC_TRACEABILITY.md and the live E2E evidence in
 * docs/audit/FINAL_PRODUCTION_FORENSIC_AUDIT.md). A richer per-concern clause mapping existed
 * only in an unwired design artifact (four-layer-meta-model.ts / guideline-filtering.ts).
 *
 * Fixed via src/matrix/standard-clause-mapping.ts, which maps each diagnostic's `concern` to a
 * real, independently-verifiable clause: the 4 real WCAG 2.2 Success Criterion numbers already
 * documented (as comments) on AccessibilityConcernType, and the real ISO/IEC 25010 Performance
 * Efficiency sub-characteristics (Time Behaviour / Resource Utilization) for performance
 * concerns — not an invented or unverifiable crosswalk.
 */
describe('Phase 9: live diagnostics carry real clause-level guideline traceability', () => {
  it('FIGM-A11Y-01 (keyboard accessibility) cites the real WCAG 2.2 SC 2.1.1 clause, not just "WCAG 2.2"', () => {
    const res = RuleExecutionEngine.analyzeFile('component.jsx', `<div onClick={handleClick}>Click me</div>`);
    const diag = res.diagnostics.find((d) => d.ruleId === 'FIGM-A11Y-01');
    assert.ok(diag);
    assert.equal(diag!.standardReference, 'WCAG 2.2 SC 2.1.1 (Keyboard)');
  });

  it('FIGM-A11Y-02 (custom control name/role/value) cites the real WCAG 2.2 SC 4.1.2 clause', () => {
    const res = RuleExecutionEngine.analyzeFile('component.jsx', `<CustomDropdown option="1" />`);
    const diag = res.diagnostics.find((d) => d.ruleId === 'FIGM-A11Y-02');
    assert.ok(diag);
    assert.equal(diag!.standardReference, 'WCAG 2.2 SC 4.1.2 (Name, Role, Value)');
  });

  it('FIGM-PERF-01 (invariant allocation) cites a real ISO/IEC 25010 Performance Efficiency sub-characteristic, not just "ISO 25010"', () => {
    const code = `function loop(items) {\n  return items.map(item => {\n    const config = { theme: 'dark' };\n    return config;\n  });\n}`;
    const res = RuleExecutionEngine.analyzeFile('component.jsx', code);
    const diag = res.diagnostics.find((d) => d.ruleId === 'FIGM-PERF-01');
    assert.ok(diag);
    assert.equal(diag!.standardReference, 'ISO/IEC 25010 — Performance Efficiency: Resource Utilization');
  });

  it('every diagnostic across a mixed multi-violation scan carries a clause-level (not blanket) standardReference', () => {
    const code = `
@Component({ selector: 'app-test' })
export class TestComponent {
  ngOnInit() {
    this.service.getStream().subscribe();
  }
}`;
    const res = RuleExecutionEngine.analyzeFile('test.component.ts', code);
    assert.ok(res.diagnostics.length > 0);
    for (const d of res.diagnostics) {
      if (!d.ruleId.startsWith('FIGM-')) continue;
      assert.notEqual(d.standardReference, 'ISO 25010', `${d.ruleId} should not fall back to the blanket domain-level reference`);
      assert.notEqual(d.standardReference, 'WCAG 2.2', `${d.ruleId} should not fall back to the blanket domain-level reference`);
    }
  });
});
