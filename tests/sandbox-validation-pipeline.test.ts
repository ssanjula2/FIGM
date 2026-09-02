import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { SourceParser } from '../src/parser/source-parser.js';
import { ASTDetectionEngine } from '../src/ast/ast-detection-engine.js';
import { SandboxValidationPipeline } from '../src/ai/sandbox-validation-pipeline.js';
import { DiagnosticReport } from '../src/types/ast-spec.js';

/**
 * Layer 2 end-to-end proof: AI suggestion -> Sandbox -> Validation -> Accept/Reject.
 *
 * Every case here hands SandboxValidationPipeline.validate a hand-written "AI-style" patch
 * directly — bypassing the deterministic Layer-1 engines entirely — to prove the sandbox gate
 * itself (not Layer 1's own verification) genuinely accepts good patches and genuinely rejects
 * bad ones, stage by stage.
 */

function detect(code: string, filePath: string): { defect: DiagnosticReport; framework: string } {
  const parsed = SourceParser.parseSource(code, filePath);
  const diags = ASTDetectionEngine.evaluateNode(parsed.ast!, filePath, parsed.framework);
  return { defect: diags[0], framework: parsed.framework };
}

function stageStatus(result: { stages: { stage: string; status: string }[] }, stage: string): string | undefined {
  return result.stages.find((s) => s.stage === stage)?.status;
}

test('Sandbox Validation Pipeline (Layer 2 AI patch gatekeeper)', async (t) => {
  await t.test('ACCEPT: a genuinely correct AI-style patch passes every stage', async () => {
    const before = `<input type="text" placeholder="Enter name" />`;
    const filePath = 'component.tsx';
    const { defect, framework } = detect(before, filePath);
    assert.equal(defect.ruleId, 'FIGM-A11Y-05');

    const aiPatch = `<input type="text" placeholder="Enter name" aria-label="Enter name" />`;
    const result = await SandboxValidationPipeline.validate(before, aiPatch, defect, framework);

    assert.equal(result.accepted, true, JSON.stringify(result.stages, null, 2));
    assert.equal(stageStatus(result, 'ISOLATION'), 'PASS');
    assert.equal(stageStatus(result, 'SYNTAX'), 'PASS');
    assert.equal(stageStatus(result, 'COMPILE_AND_RESCAN'), 'PASS');
    assert.equal(result.patchValidation?.status, 'FIXED');
  });

  await t.test('REJECT (SYNTAX): a patch with a real syntax error is rejected before compile/re-scan even runs', async () => {
    const before = `<input type="text" placeholder="Enter name" />`;
    const filePath = 'component.tsx';
    const { defect, framework } = detect(before, filePath);

    const brokenPatch = `<input type="text" placeholder="Enter name" aria-label="Enter name" />\nfunction broken( {`; // unterminated function signature
    const result = await SandboxValidationPipeline.validate(before, brokenPatch, defect, framework);

    assert.equal(result.accepted, false);
    assert.equal(stageStatus(result, 'SYNTAX'), 'FAIL');
    assert.equal(stageStatus(result, 'COMPILE_AND_RESCAN'), undefined, 'must reject at SYNTAX and never reach later stages');
  });

  await t.test('REJECT (COMPILE_AND_RESCAN — UNRESOLVED): a patch that changes the code but never actually fixes the violation is rejected', async () => {
    const before = `<input type="text" placeholder="Enter name" />`;
    const filePath = 'component.tsx';
    const { defect, framework } = detect(before, filePath);

    const noOpishPatch = `<input type="text" placeholder="Enter your full name" />`; // still no aria-label
    const result = await SandboxValidationPipeline.validate(before, noOpishPatch, defect, framework);

    assert.equal(result.accepted, false);
    assert.equal(stageStatus(result, 'SYNTAX'), 'PASS');
    assert.equal(stageStatus(result, 'COMPILE_AND_RESCAN'), 'FAIL');
    assert.equal(result.patchValidation?.status, 'UNRESOLVED');
  });

  await t.test('REJECT (FRAMEWORK_STRUCTURAL): a Vue patch that resolves the FIGM violation but breaks SFC template structure is rejected', async () => {
    const before = `<template><li v-for="item in items">{{ item.name }}</li></template>`;
    const filePath = 'List.vue';
    const { defect, framework } = detect(before, filePath);
    assert.equal(defect.ruleId, 'FIGM-VUE-01');
    assert.equal(framework, 'VUE_SFC');

    // Resolves the real v-for/:key violation, but the closing tag is typo'd ("</lii>") — a real
    // Vue template structural error @vue/compiler-sfc's own parser catches.
    const patchWithTypo = `<template><li v-for="item in items" :key="item.id">{{ item.name }}</lii></template>`;
    const result = await SandboxValidationPipeline.validate(before, patchWithTypo, defect, framework);

    assert.equal(result.accepted, false, JSON.stringify(result.stages, null, 2));
    assert.equal(stageStatus(result, 'FRAMEWORK_STRUCTURAL'), 'FAIL');
  });

  await t.test('REJECT (FRAMEWORK_STRUCTURAL): an Angular patch that resolves the FIGM violation but breaks inline template structure is rejected', async () => {
    const before = `@Component({\n  selector: 'app-list',\n  changeDetection: ChangeDetectionStrategy.OnPush,\n  template: \`<ul><li *ngFor="let item of items">{{ item.name }}</li></ul>\`\n})\nexport class ListComponent {\n  items: { id: string; name: string }[] = [];\n}`;
    const filePath = 'ListComponent.component.ts';
    const { defect, framework } = detect(before, filePath);
    assert.equal(defect.ruleId, 'FIGM-ANG-03');
    assert.equal(framework, 'ANGULAR_TEMPLATE');

    // Resolves the real *ngFor/trackBy violation, but the closing tag is typo'd ("</lii>") — a
    // real Angular template structural error angular-html-parser's own parser catches.
    const patchWithTypo = `@Component({\n  selector: 'app-list',\n  changeDetection: ChangeDetectionStrategy.OnPush,\n  template: \`<ul><li *ngFor="let item of items; trackBy: trackById">{{ item.name }}</lii></ul>\`\n})\nexport class ListComponent {\n  items: { id: string; name: string }[] = [];\n  trackById(i: number, item: { id: string }) { return item.id; }\n}`;
    const result = await SandboxValidationPipeline.validate(before, patchWithTypo, defect, framework);

    assert.equal(result.accepted, false, JSON.stringify(result.stages, null, 2));
    assert.equal(stageStatus(result, 'FRAMEWORK_STRUCTURAL'), 'FAIL');
  });

  await t.test('ACCEPT: a genuinely correct Angular AI-style patch (fixing FIGM-ANG-03) passes every stage and re-scan confirms the violation is gone', async () => {
    const before = `@Component({\n  selector: 'app-list',\n  changeDetection: ChangeDetectionStrategy.OnPush,\n  template: \`<ul><li *ngFor="let item of items">{{ item.name }}</li></ul>\`\n})\nexport class ListComponent {\n  items: { id: string; name: string }[] = [];\n}`;
    const filePath = 'ListComponent.component.ts';
    const { defect, framework } = detect(before, filePath);
    assert.equal(defect.ruleId, 'FIGM-ANG-03');

    const goodPatch = `@Component({\n  selector: 'app-list',\n  changeDetection: ChangeDetectionStrategy.OnPush,\n  template: \`<ul><li *ngFor="let item of items; trackBy: trackById">{{ item.name }}</li></ul>\`\n})\nexport class ListComponent {\n  items: { id: string; name: string }[] = [];\n  trackById(i: number, item: { id: string }) { return item.id; }\n}`;
    const result = await SandboxValidationPipeline.validate(before, goodPatch, defect, framework);

    assert.equal(result.accepted, true, JSON.stringify(result.stages, null, 2));
    assert.equal(stageStatus(result, 'FRAMEWORK_STRUCTURAL'), 'PASS');
    assert.equal(stageStatus(result, 'COMPILE_AND_RESCAN'), 'PASS');
    assert.equal(result.patchValidation?.status, 'FIXED');
  });

  await t.test('REJECT (COMPILE_AND_RESCAN — UNRESOLVED): an Angular patch that compiles and parses cleanly but does not remove the original violation is rejected', async () => {
    const before = `@Component({\n  selector: 'app-list',\n  changeDetection: ChangeDetectionStrategy.OnPush,\n  template: \`<ul><li *ngFor="let item of items">{{ item.name }}</li></ul>\`\n})\nexport class ListComponent {\n  items: { id: string; name: string }[] = [];\n}`;
    const filePath = 'ListComponent.component.ts';
    const { defect, framework } = detect(before, filePath);
    assert.equal(defect.ruleId, 'FIGM-ANG-03');

    // Structurally valid, compiles fine, touches only unrelated markup (an added class attribute)
    // — but still no trackBy, so the FIGM-ANG-03 violation remains and no new violation is introduced.
    const noOpishPatch = `@Component({\n  selector: 'app-list',\n  changeDetection: ChangeDetectionStrategy.OnPush,\n  template: \`<ul class="items-list"><li *ngFor="let item of items">{{ item.name }}</li></ul>\`\n})\nexport class ListComponent {\n  items: { id: string; name: string }[] = [];\n}`;
    const result = await SandboxValidationPipeline.validate(before, noOpishPatch, defect, framework);

    assert.equal(result.accepted, false);
    assert.equal(stageStatus(result, 'FRAMEWORK_STRUCTURAL'), 'PASS');
    assert.equal(stageStatus(result, 'COMPILE_AND_RESCAN'), 'FAIL');
    assert.equal(result.patchValidation?.status, 'UNRESOLVED');
  });

  await t.test('REJECT (PATCH_SCOPE): an Angular patch that fixes the violation but rewrites unrelated large portions of the file is rejected before structural/compile checks even run', async () => {
    const before = `@Component({\n  selector: 'app-list',\n  changeDetection: ChangeDetectionStrategy.OnPush,\n  template: \`<ul><li *ngFor="let item of items">{{ item.name }}</li></ul>\`\n})\nexport class ListComponent {\n  items: { id: string; name: string }[] = [];\n}`;
    const filePath = 'ListComponent.component.ts';
    const { defect, framework } = detect(before, filePath);
    assert.equal(defect.ruleId, 'FIGM-ANG-03');

    const oversizedPatch = `@Component({\n  selector: 'app-list-renamed',\n  changeDetection: ChangeDetectionStrategy.OnPush,\n  template: \`<ul><li *ngFor="let item of items; trackBy: trackById"><span class="wrapper"><strong>{{ item.name }}</strong></span></li></ul>\`\n})\nexport class ListComponent {\n  items: { id: string; name: string; extra: string; more: string }[] = [];\n  trackById(i: number, item: { id: string }) { return item.id; }\n  extraMethodOne() { return 1; }\n  extraMethodTwo() { return 2; }\n  extraMethodThree() { return 3; }\n}`;
    const result = await SandboxValidationPipeline.validate(before, oversizedPatch, defect, framework);

    assert.equal(result.accepted, false, JSON.stringify(result.stages, null, 2));
    assert.equal(stageStatus(result, 'PATCH_SCOPE'), 'FAIL');
    assert.equal(stageStatus(result, 'FRAMEWORK_STRUCTURAL'), undefined, 'must reject at PATCH_SCOPE and never reach later stages');
  });

  await t.test('TEST stage is NOT_APPLICABLE for a synthetic/live-scan file path (no real file on disk)', async () => {
    const before = `<input type="text" placeholder="Enter name" />`;
    const filePath = 'component.tsx'; // synthetic — never a real file in this repo
    const { defect, framework } = detect(before, filePath);
    const aiPatch = `<input type="text" placeholder="Enter name" aria-label="Enter name" />`;

    const result = await SandboxValidationPipeline.validate(before, aiPatch, defect, framework);
    assert.equal(stageStatus(result, 'TEST'), 'NOT_APPLICABLE');
  });

  await t.test('TEST stage is NOT_APPLICABLE for a real project file that has no co-located test', async () => {
    const realFileWithNoTest = 'src/matrix/rule-category.ts';
    assert.ok(fs.existsSync(path.resolve(process.cwd(), realFileWithNoTest)), 'fixture assumption: this real file exists');
    const baseName = path.basename(realFileWithNoTest, '.ts');
    assert.ok(!fs.existsSync(path.resolve(process.cwd(), 'tests', `${baseName}.test.ts`)), 'fixture assumption: no co-located test exists for it');

    const before = `<input type="text" placeholder="Enter name" />`;
    const { defect, framework } = detect(before, 'component.tsx');
    const withRealPath: DiagnosticReport = { ...defect, filePath: realFileWithNoTest };
    const aiPatch = `<input type="text" placeholder="Enter name" aria-label="Enter name" />`;

    const result = await SandboxValidationPipeline.validate(before, aiPatch, withRealPath, framework);
    assert.equal(stageStatus(result, 'TEST'), 'NOT_APPLICABLE');
  });

  await t.test('TEST stage PASS: a real, behavior-preserving patch to the fixture file passes its real co-located test, and the real file was never even opened for writing', async () => {
    const fixturePath = 'src/engine/sandbox-test-stage-fixture.ts';
    const absoluteFixturePath = path.resolve(process.cwd(), fixturePath);
    const originalContent = fs.readFileSync(absoluteFixturePath, 'utf8');
    const originalMtimeMs = fs.statSync(absoluteFixturePath).mtimeMs;
    const { defect } = detect(`<input type="text" placeholder="Enter name" />`, 'component.tsx');
    const withRealPath: DiagnosticReport = { ...defect, filePath: fixturePath };

    // A harmless "AI-style" patch: adds a comment, keeps doubleValue's real behavior (and
    // therefore its real test) unchanged.
    const harmlessPatch = originalContent.replace('export function doubleValue', '// AI patch: no behavior change\nexport function doubleValue');

    const result = await SandboxValidationPipeline.validate(originalContent, harmlessPatch, withRealPath, 'GENERIC_ESTREE');

    assert.equal(stageStatus(result, 'TEST'), 'PASS', JSON.stringify(result.stages, null, 2));
    assert.equal(fs.readFileSync(absoluteFixturePath, 'utf8'), originalContent, 'the real fixture file must be untouched after validation');
    // Content equality alone doesn't rule out a write-then-restore-identical-bytes round trip
    // (the exact class of prior bug this guards against — see runAssociatedTestIfPresent's own
    // doc comment). mtime is unaffected by content, so an unchanged mtime is direct evidence the
    // file was never opened for writing at all, not merely restored afterward.
    assert.equal(fs.statSync(absoluteFixturePath).mtimeMs, originalMtimeMs, 'the real fixture file must never be opened for writing at all, not just restored to the same bytes');
  });

  await t.test('TEST stage FAIL: a patch that breaks the fixture\'s real behavior fails its real co-located test, and the real file was never even opened for writing', async () => {
    const fixturePath = 'src/engine/sandbox-test-stage-fixture.ts';
    const absoluteFixturePath = path.resolve(process.cwd(), fixturePath);
    const originalContent = fs.readFileSync(absoluteFixturePath, 'utf8');
    const originalMtimeMs = fs.statSync(absoluteFixturePath).mtimeMs;
    const { defect } = detect(`<input type="text" placeholder="Enter name" />`, 'component.tsx');
    const withRealPath: DiagnosticReport = { ...defect, filePath: fixturePath };

    // Genuinely breaks doubleValue's behavior (n * 2 -> n * 3) -- its real test must actually fail.
    const breakingPatch = originalContent.replace('return n * 2;', 'return n * 3;');

    const result = await SandboxValidationPipeline.validate(originalContent, breakingPatch, withRealPath, 'GENERIC_ESTREE');

    assert.equal(result.accepted, false, JSON.stringify(result.stages, null, 2));
    assert.equal(stageStatus(result, 'TEST'), 'FAIL');
    assert.equal(fs.readFileSync(absoluteFixturePath, 'utf8'), originalContent, 'the real fixture file must be untouched even after a failed run');
    assert.equal(fs.statSync(absoluteFixturePath).mtimeMs, originalMtimeMs, 'the real fixture file must never be opened for writing at all, not just restored to the same bytes, even on a FAIL');
  });

  // A third "internal exception mid-overlay-build" scenario was deliberately NOT added as a live
  // test: forcing a genuine exception specifically inside runAssociatedTestIfPresent's overlay
  // setup (as opposed to an earlier stage in validate(), e.g. by breaking os.tmpdir() globally,
  // which fails Stage 1 first and never reaches this stage at all) would require monkeypatching
  // fs.cpSync/fs.symlinkSync -- verified NOT to work reliably in this build: this project's `.ts`
  // files are each transpiled with their own independent copy of `import * as fs from 'fs'`
  // (confirmed empirically -- reassigning fs.cpSync in this test file's copy has zero effect on
  // sandbox-validation-pipeline.ts's own separate copy), so no in-process mock can reach the real
  // call site without invasive dependency-injection surgery on the pipeline module, which is out
  // of scope for this fix. The crash-safety property is instead guaranteed STRUCTURALLY, verified
  // by direct source read rather than a forced-failure test: runAssociatedTestIfPresent's only
  // write of `patchedCode` targets `path.join(overlayDir, relativeToRoot)` -- `absoluteSourcePath`
  // (the real file) is only ever read (existsSync/the cpSync source side), never opened for
  // writing anywhere in the method, on any path, including its catch block. There is therefore no
  // "window" a crash could land in, unlike the prior write-then-restore-in-`finally` version this
  // replaced (audit finding HIGH-7 / P1-7).

  // ── Critical regression: trailing-newline asymmetry must never inflate PATCH_SCOPE ──────────
  // Reproduced live against the real Gemini API on FIGM-A11Y-01 (an 8-line Card.jsx fixture): a
  // genuinely minimal 2-line fix (<div onClick> -> <button onClick>, native keyboard accessibility)
  // measured as "5 of 8 lines (63%)" and was WRONGLY rejected at PATCH_SCOPE — not because the
  // patch was oversized, but because response-parser.ts's stripMarkdownFences() always .trim()s the
  // model's returned patch (so it never carries a trailing newline) while `originalCode` is the
  // caller's raw source, which (like almost every real file) DOES end with one. Splitting both
  // as-is compares an 8-element array (original, with a trailing "" from its newline) against a
  // 7-element array (patch, already trimmed) -- a difference in whether the file merely ends with a
  // newline, not in its actual content. This is a measurement bug in checkPatchScope, not the 60%
  // threshold, which stays completely unchanged (see the file's own fix comment).
  await t.test('PATCH_SCOPE regression: a trailing newline present in the original but absent from an already-trimmed patch must never by itself inflate the changed-line ratio', async () => {
    const original = `function Card({ onSelect }) {\n  return (\n    <div className="card" onClick={onSelect}>\n      <span>Select this card</span>\n    </div>\n  );\n}\n`;
    const { defect, framework } = detect(original, 'Card.jsx');
    assert.equal(defect.ruleId, 'FIGM-A11Y-01');

    // The exact patch reproduced live from Gemini -- genuinely minimal (div/button swap only), but
    // already trailing-newline-trimmed exactly as AIResponseParser.stripMarkdownFences leaves it.
    const minimalPatchNoTrailingNewline = `function Card({ onSelect }) {\n  return (\n    <button type="button" className="card" onClick={onSelect}>\n      <span>Select this card</span>\n    </button>\n  );\n}`;
    assert.equal(minimalPatchNoTrailingNewline.endsWith('\n'), false, 'fixture must genuinely lack a trailing newline, matching stripMarkdownFences output');
    assert.ok(original.endsWith('\n'), 'fixture must genuinely have a trailing newline, matching a normal source file');

    const result = await SandboxValidationPipeline.validate(original, minimalPatchNoTrailingNewline, defect, framework);
    const scopeStage = result.stages.find((s) => s.stage === 'PATCH_SCOPE');
    assert.equal(scopeStage?.status, 'PASS', `expected PATCH_SCOPE to PASS on this genuinely minimal 2-line fix, got: ${scopeStage?.detail}`);
    // The real, reproduced buggy detail text was "5 of 8 lines (63%)" -- assert the corrected
    // real numbers (4 of 7, 57%), not just that it passed, so a regression back to the bug (which
    // would still technically "PASS" on a larger fixture, just with an inflated number) is caught.
    assert.match(scopeStage!.detail, /4 of 7 lines \(57%\)/, `expected the corrected 4-of-7 (57%) measurement, got: ${scopeStage!.detail}`);

    assert.equal(result.accepted, true, JSON.stringify(result.stages, null, 2));
    assert.equal(result.patchValidation?.status, 'FIXED');
  });

  await t.test('PATCH_SCOPE regression: a trailing-newline difference alone (byte-identical file otherwise) must never register as a changed line', async () => {
    const originalLines = ['const a = 1;', 'const b = 2;', 'const c = 3;', 'const d = 4;', 'const e = 5;', 'const f = 6;'];
    const withTrailingNewline = originalLines.join('\n') + '\n';
    const withoutTrailingNewline = originalLines.join('\n');
    const { defect, framework } = detect(`<input type="text" placeholder="Enter name" />`, 'component.tsx');
    // Reuses SandboxValidationPipeline.validate purely to exercise checkPatchScope's normalization
    // via a byte-identical-except-trailing-newline pair (defect/framework here are unrelated to the
    // synthetic content -- this test only inspects the PATCH_SCOPE stage's own numbers).
    const result = await SandboxValidationPipeline.validate(withTrailingNewline, withoutTrailingNewline, defect, framework);
    const scopeStage = result.stages.find((s) => s.stage === 'PATCH_SCOPE');
    assert.equal(scopeStage?.status, 'PASS');
    assert.match(scopeStage!.detail, /0 of 6 lines \(0%\)/, `a trailing-newline-only difference must measure as ZERO changed lines, got: ${scopeStage!.detail}`);
  });
});
