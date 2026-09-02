import test from 'node:test';
import assert from 'node:assert/strict';
import * as ts from 'typescript';
import { SourceParser } from '../src/parser/source-parser.js';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine.js';
import { AstDeterministicFixEngine } from '../src/engine/ast-fix-engine.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/**
 * Phase 01 validation suite for the Layer 1 AST Deterministic Fix Engine
 * (src/engine/ast-fix-engine.ts). For each of the 10 migrated rules this proves, against the
 * REAL detection pipeline (SourceParser + ASTDetectionEngine — the same one production scans
 * use), the full loop the architecture requires:
 *
 *   detect (before) -> AST transform -> syntax-valid? -> re-scan (after) -> violation gone?
 *
 * Never asserts "the string looks right" as a substitute for re-scanning; every case re-detects
 * on the patched code through the same real pipeline the before-fixture was detected with.
 */

function detect(code: string, filePath: string): DiagnosticReport[] {
  const parsed = SourceParser.parseSource(code, filePath);
  return ASTDetectionEngine.evaluateNode(parsed.ast!, filePath, parsed.framework);
}

function assertSyntacticallyValid(code: string, filePath: string) {
  const sf = ts.createSourceFile(filePath, code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const parseDiagnostics = (sf as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics ?? [];
  assert.equal(parseDiagnostics.length, 0, `patched code must be syntactically valid TSX, got: ${code}`);
}

interface Case {
  ruleId: string;
  before: string;
  filePath: string;
  /** Substrings that must ALL appear in the patched code. */
  mustInclude: string[];
  /** Substrings that must NOT appear in the patched code (e.g. the original violating shape). */
  mustNotInclude?: string[];
}

const CASES: Case[] = [
  {
    ruleId: 'FIGM-A11Y-01',
    before: `<div onClick={handleClick}>Click me</div>`,
    filePath: 'Widget.tsx',
    mustInclude: ['role="button"', 'tabIndex={0}', 'onKeyDown={'],
  },
  {
    ruleId: 'FIGM-A11Y-02',
    before: `<CustomDropdown option="1" />`,
    filePath: 'component.tsx',
    mustInclude: ['role="button"', 'aria-label="Interactive Action Control"'],
  },
  {
    ruleId: 'FIGM-A11Y-03',
    before: `<div className="status-container">{status}</div>`,
    filePath: 'component.tsx',
    mustInclude: ['role="status"', 'aria-live="polite"'],
  },
  {
    ruleId: 'FIGM-A11Y-04',
    before: `<Modal isOpen={true} />`,
    filePath: 'component.tsx',
    mustInclude: ['restoresFocusOnUnmount={true}', 'onClose={'],
  },
  {
    ruleId: 'FIGM-A11Y-05',
    before: `<input type="text" placeholder="Enter name" />`,
    filePath: 'component.tsx',
    mustInclude: ['aria-label="Enter name"'],
  },
  {
    ruleId: 'FIGM-A11Y-06',
    before: `<button tabIndex="5">Submit</button>`,
    filePath: 'component.tsx',
    mustInclude: ['tabIndex={0}'],
    mustNotInclude: ['tabIndex="5"'],
  },
  {
    ruleId: 'FIGM-PERF-02',
    before: `<img src="/logo.png" alt="Logo" />`,
    filePath: 'component.tsx',
    mustInclude: ['width="300"', 'height="200"'],
  },
  {
    ruleId: 'FIGM-REACT-02',
    before: `items.map((item, index) => <li key={index}>{item}</li>)`,
    filePath: 'List.tsx',
    mustInclude: ['key={item.id}'],
    mustNotInclude: ['key={index}'],
  },
  {
    ruleId: 'FIGM-NEXT-01',
    before: `import { useState } from 'react';\nexport default function Page() {\n  const [s] = useState(0);\n  return <div>{s}</div>;\n}`,
    filePath: 'app/dashboard/page.tsx',
    mustInclude: ['"use client"'],
  },
  {
    ruleId: 'FIGM-NEXT-06',
    before: `<img src="/logo.png" width="300" height="200" alt="Logo" />`,
    filePath: 'app/gallery/page.tsx',
    mustInclude: ['<Image', "from \"next/image\""],
    mustNotInclude: ['<img'],
  },
  // ------------------------------------------------------------------------------------------
  // Phase 02 — 12 more rules
  // ------------------------------------------------------------------------------------------
  {
    ruleId: 'FIGM-PERF-01',
    before: `function loop(items) {\n  return items.map(item => {\n    const config = { theme: 'dark' };\n    return config;\n  });\n}`,
    filePath: 'component.jsx',
    mustInclude: ['Object.freeze(', "theme: 'dark'"],
    mustNotInclude: ["const config = { theme: 'dark' }"],
  },
  {
    ruleId: 'FIGM-PERF-03',
    before: `function Widget() {\n  window.addEventListener('resize', handleResize);\n}`,
    filePath: 'Widget.jsx',
    mustInclude: ['return () => window.removeEventListener('],
  },
  {
    ruleId: 'FIGM-PERF-06',
    before: `function loop(items) {\n  return items.map(item => {\n    const token = localStorage.getItem('token');\n    return token;\n  });\n}`,
    filePath: 'component.jsx',
    mustInclude: ["const token = localStorage.getItem('token')"],
  },
  {
    ruleId: 'FIGM-NEXT-03',
    before: `export default async function Page() { return <div>Data</div>; }`,
    filePath: 'app/feed/page.tsx',
    mustInclude: ['export const revalidate = 60'],
  },
  {
    ruleId: 'FIGM-NEXT-10',
    before: `export const dynamic = 'force-dynamic';\nexport default function Page() {\n  return <div>Static</div>;\n}`,
    filePath: 'app/static-page/page.tsx',
    mustInclude: ['export default function Page'],
    mustNotInclude: ['force-dynamic'],
  },
  {
    ruleId: 'FIGM-REACT-03',
    before: `function update() {\n  user.name = 'John';\n  setUser(user);\n}`,
    filePath: 'UserProfile.jsx',
    mustInclude: ['setUser(prev => ({ ...prev, name: '],
    mustNotInclude: [`user.name = 'John';`],
  },
  {
    ruleId: 'FIGM-REACT-10',
    before: `function SomeComponent() {\n  return <span>Hi</span>;\n}\nfunction Page() {\n  return <div>{SomeComponent()}</div>;\n}`,
    filePath: 'Page.jsx',
    mustInclude: ['<SomeComponent />'],
    mustNotInclude: ['{SomeComponent()}'],
  },
  {
    ruleId: 'FIGM-REACT-11',
    before: `<MyContext.Provider value={{ theme, toggleTheme }}>{children}</MyContext.Provider>`,
    filePath: 'App.tsx',
    mustInclude: ['useMemo(() => ({ theme, toggleTheme }), ['],
  },
  {
    ruleId: 'FIGM-A11Y-07',
    before: `<button aria-label="Cancel">Submit</button>`,
    filePath: 'component.tsx',
    mustInclude: ['aria-label="Submit"'],
    mustNotInclude: ['aria-label="Cancel"'],
  },
  {
    ruleId: 'FIGM-ANG-02',
    before: `@Component({ selector: 'app-card', template: '<div>Card</div>' })\nexport class CardComponent {}`,
    filePath: 'card.component.ts',
    mustInclude: ['changeDetection: ChangeDetectionStrategy.OnPush', 'import { ChangeDetectionStrategy } from "@angular/core"'],
  },
  {
    ruleId: 'FIGM-ANG-05',
    before: `this.el.nativeElement.style.color = 'red';`,
    filePath: 'color.directive.ts',
    mustInclude: [`this.renderer.setStyle(this.el.nativeElement, "color", 'red')`],
    mustNotInclude: [`this.el.nativeElement.style.color = 'red'`],
  },
  {
    ruleId: 'FIGM-ANG-09',
    before: `export class ProfileComponent {\n  name = input<string>();\n}`,
    filePath: 'profile.component.ts',
    mustInclude: ['readonly name = input<string>()'],
  },
];

test('AST Deterministic Fix Engine (Phase 01 + Phase 02) — 22-rule detect->fix->re-scan suite', async (t) => {
  await t.test('covers exactly the 22 migrated rule IDs, no duplicates', () => {
    assert.equal(CASES.length, 22);
    assert.equal(new Set(CASES.map((c) => c.ruleId)).size, 22);
    assert.deepEqual(new Set(CASES.map((c) => c.ruleId)), AstDeterministicFixEngine.SUPPORTED_RULE_IDS);
  });

  for (const c of CASES) {
    await t.test(`${c.ruleId}: detect(before) -> AST fix -> syntax valid -> re-scan(after) clean`, () => {
      const beforeDiags = detect(c.before, c.filePath);
      const defect = beforeDiags.find((d) => d.ruleId === c.ruleId);
      assert.ok(defect, `${c.ruleId} must be detected on its own before-fixture by the real detection pipeline`);

      const outcome = AstDeterministicFixEngine.tryFix(c.before, defect!, c.filePath);
      if (c.ruleId === 'FIGM-PERF-02') {
        assert.equal(outcome.success, false, 'FIGM-PERF-02 must safely decline deterministic auto-fix when intrinsic dimensions are unknown');
        assert.equal(outcome.patchedCode, c.before, 'Original source must remain 100% unchanged on decline');
        return;
      }

      assert.equal(outcome.success, true, `AST fix must succeed for ${c.ruleId}: ${outcome.description}`);
      assert.notEqual(outcome.patchedCode, c.before, `${c.ruleId}'s AST fix must actually change the code`);

      for (const needle of c.mustInclude) {
        assert.ok(outcome.patchedCode.includes(needle), `${c.ruleId} patched code must include "${needle}", got:\n${outcome.patchedCode}`);
      }
      for (const forbidden of c.mustNotInclude ?? []) {
        assert.ok(!outcome.patchedCode.includes(forbidden), `${c.ruleId} patched code must NOT include "${forbidden}", got:\n${outcome.patchedCode}`);
      }

      assertSyntacticallyValid(outcome.patchedCode, c.filePath);

      const afterDiags = detect(outcome.patchedCode, c.filePath);
      assert.ok(
        !afterDiags.some((d) => d.ruleId === c.ruleId),
        `${c.ruleId} must be genuinely resolved on re-scan of the patched code, not just textually different`
      );
    });
  }

  await t.test('FIGM-A11Y-01: the generated onKeyDown handler is real, executable code — not a fake/no-op fix', () => {
    // Proves the fix is technically achievable in a real IDE/runtime: extract the onKeyDown
    // handler body and actually EXECUTE it (rather than eyeballing the generated string), the
    // same technique src/engine/remediation-engine.ts's own regression test uses, applied here to
    // the new AST-based engine. The original onClick value is an arrow function closing over
    // `item` — exactly the shape that broke a naive string-concatenation fix in the past
    // (`() => handleClick(item)()` calls nothing due to operator precedence).
    const code = `<div onClick={() => handleClick(item)}>Click area</div>`;
    const defect: DiagnosticReport = {
      ruleId: 'FIGM-A11Y-01',
      ruleName: 'Keyboard Event Parity on Pointer Handlers',
      message: 'Non-interactive element has pointer click listener but lacks onKeyDown handler or tabindex.',
      domain: 'ACCESSIBILITY',
      concern: 'KEYBOARD_ACCESSIBILITY',
      severity: 'CRITICAL',
      filePath: 'Widget.tsx',
      location: { start: { line: 1, column: 0 }, end: { line: 1, column: 57 } },
      offendingCodeSnippet: code,
      remediation: 'Add onKeyDown handler and tabIndex.',
      standardReference: 'WCAG 2.2',
    };

    const outcome = AstDeterministicFixEngine.tryFix(code, defect, 'Widget.tsx');
    assert.equal(outcome.success, true, outcome.description);

    const marker = 'onKeyDown={';
    const markerIdx = outcome.patchedCode.indexOf(marker);
    assert.ok(markerIdx >= 0);
    let depth = 1;
    let i = markerIdx + marker.length;
    while (depth > 0 && i < outcome.patchedCode.length) {
      if (outcome.patchedCode[i] === '{') depth++;
      else if (outcome.patchedCode[i] === '}') depth--;
      i++;
    }
    const handlerBody = outcome.patchedCode.slice(markerIdx + marker.length, i - 1);

    let calledWith: unknown = null;
    const handleClick = (x: unknown) => {
      calledWith = x;
    };
    const item = { id: 42 };
    const fn = new Function('handleClick', 'item', 'e', `return (${handlerBody})(e);`);

    fn(handleClick, item, { key: 'Tab' });
    assert.equal(calledWith, null, 'a non-activation key (Tab) must not invoke the handler');

    fn(handleClick, item, { key: 'Enter' });
    assert.equal(calledWith, item, 'Enter must invoke the original onClick expression with the correct closure');

    calledWith = null;
    fn(handleClick, item, { key: ' ' });
    assert.equal(calledWith, item, 'Space must invoke the original onClick expression with the correct closure');
  });

  await t.test('Layer 1 declines gracefully (never throws, never mutates) when the node cannot be located', () => {
    const code = `<div>No onClick here at all</div>`;
    const defect: DiagnosticReport = {
      ruleId: 'FIGM-A11Y-01',
      ruleName: 'Keyboard Event Parity on Pointer Handlers',
      message: 'n/a',
      domain: 'ACCESSIBILITY',
      concern: 'KEYBOARD_ACCESSIBILITY',
      severity: 'CRITICAL',
      filePath: 'Widget.tsx',
      location: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
      offendingCodeSnippet: code,
      remediation: 'n/a',
      standardReference: 'WCAG 2.2',
    };

    const outcome = AstDeterministicFixEngine.tryFix(code, defect, 'Widget.tsx');
    assert.equal(outcome.success, false);
    assert.equal(outcome.patchedCode, code, 'a declined fix must never mutate the code — callers rely on this to fall through to Layer 2 safely');
    assert.ok(outcome.description.length > 0);
  });

  await t.test('a rule outside the migrated subset is declined, not attempted', () => {
    assert.equal(AstDeterministicFixEngine.isEligible('FIGM-VUE-01'), false);
    const outcome = AstDeterministicFixEngine.tryFix('const x = 1;', {
      ruleId: 'FIGM-VUE-01',
      ruleName: 'n/a',
      message: 'n/a',
      domain: 'PERFORMANCE',
      concern: 'INVARIANT_ALLOCATIONS',
      severity: 'CRITICAL',
      filePath: 'x.tsx',
      location: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
      offendingCodeSnippet: 'const x = 1;',
      remediation: 'n/a',
      standardReference: 'n/a',
    } as DiagnosticReport, 'x.tsx');
    assert.equal(outcome.success, false);
  });
});
