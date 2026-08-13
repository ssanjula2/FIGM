import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SourceParser } from '../src/parser/source-parser.js';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine.js';
import { RemediationEngine } from '../src/engine/remediation-engine.js';

/**
 * Phase 10 coverage: for every one of the real 25 rule IDs, run a real positive fixture through
 * detect -> remediate -> re-scan and assert an HONEST outcome — never a false "FIXED" claim.
 *
 * Before this suite, an actual audit of RemediationEngine.applyQuickFix's switch statement found:
 *   - FIGM-REACT-02, FIGM-PERF-05/06, FIGM-A11Y-05/06, FIGM-NEXT-03, FIGM-REACT-04, and all five
 *     FIGM-ANG-01..05 had NO dedicated case at all, silently falling through to a generic
 *     "universal pattern" fallback that pattern-matches the code's superficial shape rather than
 *     the rule being fixed (live-reproduced misfiring the A11Y template on a FIGM-REACT-02 key
 *     violation).
 *   - Three cases existed under rule IDs that do not exist in the live 25-rule engine
 *     (FIGM-REACT-05, FIGM-ANGULAR-01, FIGM-ANGULAR-02 — real IDs are FIGM-ANG-01..05) — dead,
 *     unreachable code.
 *   - FIGM-REACT-01, FIGM-NEXT-02, and FIGM-NEXT-04's cases fixed a DIFFERENT violation than what
 *     the live rule of that ID actually detects (old-taxonomy remnants) — e.g. FIGM-REACT-01's
 *     case fixed `key={Math.random()}` while the live rule flags a missing useMemo.
 * All of the above are now fixed: every real rule ID has a dedicated case that either performs a
 * safe, verifiable automatic fix, or honestly reports MANUAL_REVIEW_REQUIRED / PATCH_REJECTED
 * rather than silently doing nothing or fixing the wrong thing.
 */

interface Case { ruleId: string; code: string; filePath: string }

const CASES: Case[] = [
  { ruleId: 'FIGM-PERF-01', code: `function loop(items) {\n  return items.map(item => {\n    const config = { theme: 'dark' };\n    return config;\n  });\n}`, filePath: 'component.jsx' },
  { ruleId: 'FIGM-PERF-02', code: `<img src="/logo.png" alt="Logo" />`, filePath: 'component.jsx' },
  { ruleId: 'FIGM-PERF-03', code: `window.addEventListener('resize', handleResize);`, filePath: 'component.js' },
  { ruleId: 'FIGM-PERF-04', code: `import HeavyChart from 'heavy-chart';\nif(condition) {\n  console.log(HeavyChart);\n}`, filePath: 'component.js' },
  { ruleId: 'FIGM-PERF-05', code: `items.map(item => <Card onClick={() => handleClick(item.id)} />)`, filePath: 'component.jsx' },
  { ruleId: 'FIGM-PERF-06', code: `items.map(item => {\n  const token = localStorage.getItem('token');\n  return token;\n})`, filePath: 'component.js' },
  { ruleId: 'FIGM-A11Y-01', code: `<div onClick={handleClick}>Click me</div>`, filePath: 'component.jsx' },
  { ruleId: 'FIGM-A11Y-02', code: `<CustomDropdown option="1" />`, filePath: 'component.jsx' },
  { ruleId: 'FIGM-A11Y-03', code: `<div className="status-container">{status}</div>`, filePath: 'component.jsx' },
  { ruleId: 'FIGM-A11Y-04', code: `<Modal isOpen={true} />`, filePath: 'component.jsx' },
  { ruleId: 'FIGM-A11Y-05', code: `<input type="text" placeholder="Enter name" />`, filePath: 'component.jsx' },
  { ruleId: 'FIGM-A11Y-06', code: `<button tabIndex="5">Submit</button>`, filePath: 'component.jsx' },
  { ruleId: 'FIGM-NEXT-01', code: `import { useState } from 'react';\nexport default function Page() {\n  const [s] = useState(0);\n}`, filePath: 'app/dashboard/page.tsx' },
  { ruleId: 'FIGM-NEXT-02', code: `import MonacoEditor from 'monaco-editor';`, filePath: 'app/editor/page.tsx' },
  { ruleId: 'FIGM-NEXT-03', code: `export default async function Page() { return <div>Data</div>; }`, filePath: 'app/feed/page.tsx' },
  { ruleId: 'FIGM-NEXT-04', code: `<link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet" />`, filePath: 'app/layout.tsx' },
  { ruleId: 'FIGM-REACT-01', code: `function Component({ items }) {\n  const sorted = items.sort((a,b) => a - b);\n  return <div>{sorted}</div>;\n}`, filePath: 'Component.jsx' },
  { ruleId: 'FIGM-REACT-02', code: `items.map((item, index) => <li key={index}>{item}</li>)`, filePath: 'List.jsx' },
  { ruleId: 'FIGM-REACT-03', code: `function update() {\n  user.name = 'John';\n  setUser(user);\n}`, filePath: 'UserProfile.jsx' },
  { ruleId: 'FIGM-REACT-04', code: `<CustomCard onClick={() => handleClick()} />`, filePath: 'Dashboard.jsx' },
  { ruleId: 'FIGM-ANG-01', code: `@Component({ selector: 'app-test' })\nexport class TestComponent {\n  ngOnInit() {\n    this.service.getStream().subscribe();\n  }\n}`, filePath: 'test.component.ts' },
  { ruleId: 'FIGM-ANG-02', code: `@Component({ selector: 'app-card', template: '<div>Card</div>' })\nexport class CardComponent {}`, filePath: 'card.component.ts' },
  { ruleId: 'FIGM-ANG-03', code: `<div *ngFor="let item of items">{{ item.name }}</div>`, filePath: 'search.component.ts' },
  { ruleId: 'FIGM-ANG-04', code: `<span>{{ computeTotal() }}</span>`, filePath: 'total.component.ts' },
  { ruleId: 'FIGM-ANG-05', code: `this.el.nativeElement.style.color = 'red';`, filePath: 'color.directive.ts' },
];

// Rules where a safe, fully-automatic fix is genuinely impossible (the dependency array / method
// semantics cannot be reliably inferred from the snippet alone) — these must honestly report
// MANUAL_REVIEW_REQUIRED, never a false FIXED claim.
const EXPECTED_MANUAL_REVIEW = new Set(['FIGM-PERF-05', 'FIGM-NEXT-02', 'FIGM-NEXT-04', 'FIGM-REACT-01', 'FIGM-REACT-04', 'FIGM-ANG-04']);

describe('Phase 10: remediation coverage and honesty for all 25 real rules', () => {
  it('covers exactly the 25 real rule IDs, no duplicates, no invented rules', () => {
    assert.equal(CASES.length, 25);
    assert.equal(new Set(CASES.map((c) => c.ruleId)).size, 25);
  });

  for (const c of CASES) {
    it(`${c.ruleId}: detect -> remediate -> re-scan is honest (never a false FIXED)`, () => {
      const res = SourceParser.parseSource(c.code, c.filePath);
      const reports = ASTDetectionEngine.evaluateNode(res.ast!, c.filePath, res.framework);
      const defect = reports.find((d) => d.ruleId === c.ruleId);
      assert.ok(defect, `${c.ruleId} must be detected by its own positive fixture`);

      const fix = RemediationEngine.applyQuickFix(c.code, defect!);
      const verification = RemediationEngine.validatePatch(c.code, fix.remediatedCode, defect!, fix.requiresManualReview);

      if (EXPECTED_MANUAL_REVIEW.has(c.ruleId)) {
        assert.equal(verification.status, 'MANUAL_REVIEW_REQUIRED', `${c.ruleId} must honestly flag manual review, not fake a complete fix`);
        assert.equal(fix.requiresManualReview, true);
      } else {
        assert.equal(verification.status, 'FIXED', `${c.ruleId} should be a safely automatable fix that is genuinely verified fixed on re-scan`);
        assert.notEqual(fix.remediatedCode, c.code, `${c.ruleId}'s fix must actually change the code`);
      }
    });
  }
});
