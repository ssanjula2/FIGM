import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceParser } from '../src/parser/source-parser';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine';
import { AstDeterministicFixEngine } from '../src/engine/ast-fix-engine';

/**
 * Phase 2 (AST/Rule Coverage Gaps), item 4 — FIGM-A11Y-04's overlay-tag allow-list gap.
 *
 * FIGM-A11Y-04's own canonical spec has always documented its detection pattern as
 * `JSXElement[name="Modal|Dialog|Overlay|Drawer"]` (src/matrix/four-layer-meta-model.ts's
 * astNodeType, mirrored in figm-spec.json) — but the code (both the real-AST detector's
 * OVERLAY_TAG_PREFIXES and the legacy text-heuristic detector) only ever implemented two of the
 * four names (Modal, Dialog). This closes that spec-vs-code gap; it is not an independent
 * broadening decision (contrast with FIGM-A11Y-02's CUSTOM_CONTROL_TAG_PREFIXES, whose narrower
 * scope is instead explicitly disclosed as an accepted knownLimitation and is left unchanged).
 */

function scan(code: string, filePath: string) {
  const parsed = SourceParser.parseSource(code, filePath);
  return ASTDetectionEngine.evaluateNode(parsed.ast!, filePath, parsed.framework);
}

function fires(code: string, filePath = 'component.jsx'): boolean {
  return scan(code, filePath).some((d) => d.ruleId === 'FIGM-A11Y-04');
}

test('FIGM-A11Y-04 — Overlay/Drawer allow-list gap closed', async (t) => {
  await t.test('Overlay (newly allowed): missing focus restoration is now flagged', () => {
    const code = `function Page() {\n  return <Overlay isOpen={true}>Content</Overlay>;\n}`;
    assert.equal(fires(code), true, 'Overlay is in this rule\'s own canonical spec and must be detected');
  });

  await t.test('Drawer (newly allowed): missing focus restoration is now flagged', () => {
    const code = `function Page() {\n  return <Drawer isOpen={true}>Content</Drawer>;\n}`;
    assert.equal(fires(code), true, 'Drawer is in this rule\'s own canonical spec and must be detected');
  });

  await t.test('Overlay WITH onClose (the documented focus-restoration proxy signal) is NOT flagged', () => {
    const code = `function Page() {\n  return <Overlay isOpen={true} onClose={() => { triggerRef.current?.focus(); }}>Content</Overlay>;\n}`;
    assert.equal(fires(code), false);
  });

  await t.test('Modal and Dialog (pre-existing) still fire, unaffected by this change', () => {
    assert.equal(fires(`function Page() { return <Modal isOpen={true}>Content</Modal>; }`), true);
    assert.equal(fires(`function Page() { return <Dialog isOpen={true}>Content</Dialog>; }`), true);
  });

  await t.test('an unrelated custom component name is still NOT flagged (allow-list stays a fixed set, not any capitalized tag)', () => {
    const code = `function Page() {\n  return <Popover isOpen={true}>Content</Popover>;\n}`;
    assert.equal(fires(code), false, 'Popover is not in the canonical Modal/Dialog/Overlay/Drawer list');
  });

  await t.test('the legacy text-heuristic path (non-JSX-real-AST-eligible framework) also recognizes Overlay/Drawer', () => {
    // Vue/Angular templates stay on the legacy A11Y-04 path (useRealAstJsx is JSX-only) -- see
    // source-parser.ts's own "11. Modal Focus Containment" comment.
    const code = `<template>\n  <Drawer :isOpen="true">Content</Drawer>\n</template>`;
    const diags = scan(code, 'Panel.vue');
    const match = diags.find((d) => d.ruleId === 'FIGM-A11Y-04');
    assert.ok(match, 'the legacy Vue/Angular path must also recognize Drawer, not just the real-AST JSX path');
    assert.equal(match!.sourceKind, 'LEGACY_TEXT_HEURISTIC');
  });

  await t.test('[fix+verify] the existing tag-name-agnostic AST fixer resolves an Overlay violation on re-scan', () => {
    // Uses AstDeterministicFixEngine (src/engine/ast-fix-engine.ts) -- the real, tag-name-agnostic
    // fixer actually wired into the live AI remediation pipeline's deterministic-first routing.
    // NOTE: the separate legacy RemediationEngine.applyQuickFix's FIGM-A11Y-04 case is hardcoded
    // to a literal `<Modal\b` regex replace and does not handle Dialog either -- a pre-existing,
    // narrower gap in that non-primary fix path, unrelated to this allow-list fix and out of
    // scope here (flagged, not silently expanded into).
    const code = `function Page() {\n  return <Overlay isOpen={true}>Content</Overlay>;\n}`;
    const before = RuleExecutionEngine.analyzeFile('Page.tsx', code);
    const defect = before.diagnostics.find((d) => d.ruleId === 'FIGM-A11Y-04');
    assert.ok(defect, 'fixture assumption: FIGM-A11Y-04 must fire before attempting a fix');
    const outcome = AstDeterministicFixEngine.tryFix(code, defect!, 'Page.tsx');
    assert.equal(outcome.success, true, outcome.description);
    const after = RuleExecutionEngine.analyzeFile('Page.tsx', outcome.patchedCode);
    assert.ok(
      !after.diagnostics.some((d) => d.ruleId === 'FIGM-A11Y-04'),
      'the fixed code must no longer trigger FIGM-A11Y-04 on re-scan'
    );
  });
});
