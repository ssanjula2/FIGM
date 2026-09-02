import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SourceParser } from '../src/parser/source-parser.js';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine.js';
import { RemediationEngine } from '../src/engine/remediation-engine.js';
import { RemediationValidator } from '../src/engine/remediation-validation.server.js';
import { RuleExecutionEngine } from '../src/engine/rule-execution-engine.js';

/**
 * Two real, live-reproduced remediation bugs found during a black-box end-to-end QA pass
 * (2026-08-14) that tests/remediation-coverage.test.ts's existing fixtures did not catch, because
 * those fixtures happened to use exactly the tag/import shape that worked. Both are fixed in
 * src/engine/remediation-engine.ts; these tests exist so neither can silently regress.
 */
describe('Remediation engine regressions (live-reproduced, not hypothetical)', () => {
  it('FIGM-ANG-02: the OnPush fix actually imports ChangeDetectionStrategy when no @angular/core import exists yet', () => {
    // Reproduces the exact live finding: the old check tested `remediatedCode` (already containing
    // the literal string "ChangeDetectionStrategy" from the decorator edit performed a few lines
    // earlier in the same function) instead of the ORIGINAL `code`, so the import-injection branch
    // could never execute -- the decorator referenced ChangeDetectionStrategy.OnPush but nothing
    // ever imported it, producing output that does not compile in a real Angular project.
    const code = `@Component({ selector: 'app-search', template: '<div>Search</div>' })\nexport class SearchComponent {}`;
    const filePath = 'search.component.ts';
    const res = SourceParser.parseSource(code, filePath);
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, filePath, res.framework);
    const defect = reports.find((d) => d.ruleId === 'FIGM-ANG-02');
    assert.ok(defect, 'FIGM-ANG-02 must be detected by this fixture');

    const fix = RemediationEngine.applyQuickFix(code, defect!);
    assert.match(fix.remediatedCode, /changeDetection:\s*ChangeDetectionStrategy\.OnPush/, 'the decorator property must be added');
    assert.match(
      fix.remediatedCode,
      /import\s*\{[^}]*ChangeDetectionStrategy[^}]*\}\s*from\s*['"]@angular\/core['"]/,
      'ChangeDetectionStrategy must actually be imported, not just referenced -- otherwise the "fixed" file does not compile'
    );
  });

  it('FIGM-ANG-02: merges into an EXISTING @angular/core import rather than duplicating it', () => {
    const code = `import { Component, OnInit } from '@angular/core';\n\n@Component({ selector: 'app-search', template: '<div>Search</div>' })\nexport class SearchComponent implements OnInit { ngOnInit() {} }`;
    const filePath = 'search.component.ts';
    const res = SourceParser.parseSource(code, filePath);
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, filePath, res.framework);
    const defect = reports.find((d) => d.ruleId === 'FIGM-ANG-02');
    assert.ok(defect);

    const fix = RemediationEngine.applyQuickFix(code, defect!);
    const importLines = fix.remediatedCode.split('\n').filter((l) => l.includes("from '@angular/core'"));
    assert.equal(importLines.length, 1, 'must merge into the single existing @angular/core import, not add a second one');
    assert.match(importLines[0], /ChangeDetectionStrategy/);
    assert.match(importLines[0], /OnInit/, 'the pre-existing named import (OnInit) must be preserved, not overwritten');
  });

  it('FIGM-A11Y-03: the aria-live fix actually patches non-<div> elements (e.g. a Vue <span>)', () => {
    // Reproduces the exact live finding: the old fix template only matched `/<div\b/`. A Vue SFC
    // dynamic status container using `<span class="status-banner">` (not <div>) silently produced
    // remediatedCode === originalCode -- a no-op -- while still returning a confident-sounding
    // appliedFixDescription as if the patch had been applied. FIGM's own re-scan verification
    // correctly caught this as `verified: false`, but the code itself was never fixed.
    const code = `<template>\n  <div>\n    <span class="status-banner">{{ statusText }}</span>\n  </div>\n</template>\n<script>\nexport default { data() { return { statusText: '' }; } };\n</script>\n`;
    const filePath = 'StatusCard.vue';
    const res = SourceParser.parseSource(code, filePath);
    const reports = ASTDetectionEngine.evaluateNode(res.ast!, filePath, res.framework);
    const defect = reports.find((d) => d.ruleId === 'FIGM-A11Y-03');
    assert.ok(defect, 'FIGM-A11Y-03 must be detected by this Vue fixture');

    const fix = RemediationEngine.applyQuickFix(code, defect!);
    assert.notEqual(fix.remediatedCode, code, 'the fix must actually change the code, not silently no-op on a non-<div> tag');
    assert.match(fix.remediatedCode, /<span[^>]*role="status"[^>]*aria-live="polite"/, 'the real <span> element must be annotated in place');

    const verification = RemediationValidator.validatePatch(code, fix.remediatedCode, defect!, fix.requiresManualReview);
    assert.equal(verification.status, 'FIXED');
  });

  // Four more real, live-reproduced remediation bugs, found via a fresh detect->apply->verify
  // measurement run across all 50 rules' own documented nonCompliantExample fixtures
  // (benchmarks/fix-success-rate.ts, Scientific Hardening Pass 2026-08-25) -- not hypothetical,
  // and not the same class of bug as the two ANG-02/A11Y-03 fixes above (those were "the fix
  // silently no-ops on an untested shape"; these are "the fix's own regex/framework assumption
  // doesn't even cover the rule's own textbook example").

  it('FIGM-ANG-09: the readonly fix matches a signal input with an explicit generic type argument (e.g. input<string>())', () => {
    // Reproduces the exact live finding: the fix regex required `input(`/`model(` immediately --
    // `input<string>(` (an explicit generic type argument, exactly what this rule's own
    // nonCompliantExample uses) silently no-op'd, producing remediatedCode === code while still
    // being labeled AUTOMATED_FIX_VERIFIED.
    const code = `@Component({ selector: 'app-user' })\nexport class UserCard {\n  userId = input<string>();\n}`;
    const filePath = 'user-card.component.ts';
    const scan = RuleExecutionEngine.analyzeFile(filePath, code);
    const defect = scan.diagnostics.find((d) => d.ruleId === 'FIGM-ANG-09');
    assert.ok(defect, 'FIGM-ANG-09 must be detected by this fixture');

    const fix = RemediationEngine.applyQuickFix(code, defect!);
    assert.notEqual(fix.remediatedCode, code, 'the fix must actually change the code, not silently no-op on a generic type argument');
    assert.match(fix.remediatedCode, /readonly\s+userId\s*=\s*input<string>\(\)/);

    const verification = RemediationValidator.validatePatch(code, fix.remediatedCode, defect!, fix.requiresManualReview);
    assert.equal(verification.status, 'FIXED');
  });

  it('FIGM-ANG-01: the subscription fix handles a chained method call ending in .subscribe(), not only a direct this.field$ access', () => {
    // Reproduces the exact live finding: the fix regex only matched `this.field$.subscribe(` (a
    // direct, $-suffixed field access) -- this rule's own nonCompliantExample,
    // `this.dataService.getStream().subscribe()`, is a chained call with no such field at all, and
    // silently no-op'd.
    const code = `@Component({ selector: 'app-test' })\nexport class TestComponent {\n  ngOnInit() {\n    this.dataService.getStream().subscribe();\n  }\n}`;
    const filePath = 'test.component.ts';
    const scan = RuleExecutionEngine.analyzeFile(filePath, code);
    const defect = scan.diagnostics.find((d) => d.ruleId === 'FIGM-ANG-01');
    assert.ok(defect, 'FIGM-ANG-01 must be detected by this fixture');

    const fix = RemediationEngine.applyQuickFix(code, defect!);
    assert.match(fix.remediatedCode, /this\.subscription\s*=\s*this\.dataService\.getStream\(\)\.subscribe\(/);
    assert.match(fix.remediatedCode, /implements OnDestroy/);
    assert.match(fix.remediatedCode, /ngOnDestroy/);

    const verification = RemediationValidator.validatePatch(code, fix.remediatedCode, defect!, fix.requiresManualReview);
    assert.equal(verification.status, 'FIXED');
  });

  it('FIGM-PERF-06: a Storage call whose result is not assigned to a variable is honestly flagged manual review, not silently left unchanged', () => {
    // Reproduces the exact live finding: this rule's own nonCompliantExample calls
    // localStorage.getItem() for its side effect inside a loop with no assignment at all -- the
    // fix's only safe transform (hoisting a `const x = storage.getX(...)` declaration) does not
    // apply to this shape, and the code previously fell through leaving remediatedCode === code
    // while NEVER setting requiresManualReview, so the outcome looked like a silently-failed
    // automated fix rather than an honest "this needs a human."
    const code = `for(let i=0; i<items.length; i++) { localStorage.getItem('token'); }`;
    const filePath = 'sample.tsx';
    const scan = RuleExecutionEngine.analyzeFile(filePath, code);
    const defect = scan.diagnostics.find((d) => d.ruleId === 'FIGM-PERF-06');
    assert.ok(defect, 'FIGM-PERF-06 must be detected by this fixture');

    const fix = RemediationEngine.applyQuickFix(code, defect!);
    assert.equal(fix.requiresManualReview, true, 'a Storage call with no assignment must be honestly flagged manual review');
  });

  it('FIGM-PERF-03: the teardown fix matches this rule\'s own documented compliantExample (a bare return closure) and never introduces a new Rules-of-Hooks violation', () => {
    // Reproduces the exact live finding: the fix always wrapped the call in React's
    // `useEffect(() => {...}, [])`, even though this rule is isFrameworkIndependent (applies to
    // every framework, not just React) and its own compliantExample uses a plain "return a
    // teardown closure" idiom. Wrapping a plain, non-component/non-hook function's body in
    // useEffect introduced a NEW, real FIGM-REACT-07 (Hook Used Inside Conditional, Loop, or
    // Nested Function) violation -- caught correctly by the verify-before-apply gate (which
    // refused to report the patch as fixed), but the patch itself was still wrong.
    const code = `function setupResize() {\n  window.addEventListener('resize', handleResize);\n}`;
    const filePath = 'sample.tsx';
    const scan = RuleExecutionEngine.analyzeFile(filePath, code);
    const defect = scan.diagnostics.find((d) => d.ruleId === 'FIGM-PERF-03');
    assert.ok(defect, 'FIGM-PERF-03 must be detected by this fixture');

    const fix = RemediationEngine.applyQuickFix(code, defect!);
    assert.doesNotMatch(fix.remediatedCode, /useEffect/, 'the fix must not introduce a React-specific useEffect wrapper for a framework-independent rule');
    assert.match(fix.remediatedCode, /return\s*\(\)\s*=>\s*window\.removeEventListener\('resize',\s*handleResize\)/);

    const verification = RemediationValidator.validatePatch(code, fix.remediatedCode, defect!, fix.requiresManualReview);
    assert.equal(verification.status, 'FIXED');

    const rescan = RuleExecutionEngine.analyzeFile(filePath, fix.remediatedCode);
    assert.ok(!rescan.diagnostics.some((d) => d.ruleId === 'FIGM-REACT-07'), 'the patch must never introduce a new Rules-of-Hooks violation');
  });
});
