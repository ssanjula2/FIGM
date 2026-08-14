import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SourceParser } from '../src/parser/source-parser.js';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine.js';
import { RemediationEngine } from '../src/engine/remediation-engine.js';

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

    const verification = RemediationEngine.validatePatch(code, fix.remediatedCode, defect!, fix.requiresManualReview);
    assert.equal(verification.status, 'FIXED');
  });
});
