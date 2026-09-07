import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ThesisGapExporter } from '../src/eval/thesis-gap-exporter.js';

// Stage T6A (Dissertation Integrity): ThesisGapExporter.exportAllChapters() used to hardcode its
// output directory to docs/dissertation -- the canonical, hand-reviewed dissertation location.
// tests/research-gap-eval.test.ts called it with no argument as part of the normal `npm test` run,
// which meant a routine test run silently overwrote hand-authored chapter files (Chapter 5 was
// promoted to a hand-authored document at Stage T5; Chapter 6's user-study/validity file was, at
// that time, still exporter-generated content sitting in the canonical location). The exporter now
// accepts an explicit output directory, defaulting to docs/dissertation only for the one legitimate,
// human-invoked export path (`npm run eval` / `npm run research:evaluate`). This test is the
// regression guard: it proves that running the exporter against an explicit generated-artifacts
// directory never touches the canonical files, regardless of what future changes are made to them.
//
// Stage T6-final: Chapter 6 was rewritten and promoted as a single consolidated file,
// docs/dissertation/chapter6_results_and_conclusion.md (both prior fragments -- chapter6_conclusion.md
// and chapter6_user_study_and_validity.md -- were archived under docs/dissertation/archive/ and
// removed from the active canonical directory). The exporter itself was not changed: it still writes
// a file literally named chapter6_user_study_and_validity.md when run with its default argument, but
// that filename is no longer canonical Chapter 6 content, so it is intentionally no longer in
// CANONICAL_PATHS below -- guarding it here would protect a name, not the actual promoted chapter.
// Residual, disclosed risk (tracked in CHAPTER_06_RESULTS_CONCLUSION_AUDIT.md and
// FINAL_THESIS_CONSISTENCY_AUDIT.md): a manual `npm run eval` run will still recreate a stray,
// non-canonical docs/dissertation/chapter6_user_study_and_validity.md file; it will not overwrite the
// real, promoted chapter6_results_and_conclusion.md, since the exporter never writes that filename.

const CANONICAL_PATHS = [
  path.resolve(process.cwd(), 'docs/dissertation/chapter5_empirical_validation_and_benchmarks.md'),
];

test('Stage T6A: ThesisGapExporter must never mutate canonical dissertation files when run as part of the test suite', async (t) => {
  await t.test('canonical Chapter 5 file exists before this test runs', () => {
    for (const p of CANONICAL_PATHS) {
      assert.ok(fs.existsSync(p), `expected canonical file to exist: ${p}`);
    }
  });

  await t.test('exporting to docs/generated leaves the canonical Chapter 5 file byte-identical', () => {
    const before = CANONICAL_PATHS.map((p) => fs.readFileSync(p, 'utf-8'));

    const generatedDir = path.resolve(process.cwd(), 'docs/generated');
    ThesisGapExporter.exportAllChapters(generatedDir);

    const after = CANONICAL_PATHS.map((p) => fs.readFileSync(p, 'utf-8'));
    for (let i = 0; i < CANONICAL_PATHS.length; i++) {
      assert.equal(
        after[i],
        before[i],
        `${CANONICAL_PATHS[i]} must be byte-identical before and after ThesisGapExporter runs -- ` +
          'the exporter must only write to an explicit non-canonical output directory'
      );
    }
  });

  await t.test('exporter still produces real output at the explicit generated directory (capability preserved)', () => {
    const generatedDir = path.resolve(process.cwd(), 'docs/generated');
    const ch5 = path.join(generatedDir, 'chapter5_empirical_validation_and_benchmarks.md');
    const ch6 = path.join(generatedDir, 'chapter6_user_study_and_validity.md');

    assert.ok(fs.existsSync(ch5), 'exporter must still produce a chapter 5 artifact at the explicit output directory');
    assert.ok(fs.existsSync(ch6), 'exporter must still produce a chapter 6 artifact at the explicit output directory');
    assert.ok(fs.readFileSync(ch5, 'utf-8').includes('True Positives (TP)'));
    assert.ok(fs.readFileSync(ch6, 'utf-8').includes('Threats to Validity'));
  });

  await t.test('exporter default argument (no explicit directory) still targets docs/dissertation -- the one legitimate, human-invoked export path is unchanged', () => {
    // This does not call exportAllChapters() with no argument (that would defeat the point of this
    // guard file by writing into the canonical location) -- it asserts the source contract instead,
    // so a future refactor that quietly drops the default-argument protection is caught here too.
    const src = fs.readFileSync(path.resolve(process.cwd(), 'src/eval/thesis-gap-exporter.ts'), 'utf-8');
    assert.match(
      src,
      /exportAllChapters\(outputDir: string = path\.resolve\(process\.cwd\(\), 'docs\/dissertation'\)\)/,
      'exportAllChapters must keep an explicit, inspectable default of docs/dissertation -- ' +
        'if this default is ever removed, every caller (including tests) must pass a directory explicitly'
    );
  });
});
