/**
 * Framework-Independent Guideline Model (FIGM)
 * Independent-Annotation Package Generator
 *
 * Regenerates the blind annotator package from the current benchmark fixtures + ground truth.
 * Run this whenever benchmarks/testbed/* or benchmarks/ground-truth.json change (per this
 * project's own rule: "if the detection behavior changes later, this analysis must be repeated").
 *
 * What it does:
 *  1. Reads each fixture in benchmarks/testbed/*.
 *  2. Strips every inline "Defect: FIGM-XXX-NN (...)" comment -- the original fixtures embed
 *     these directly in the source (e.g. `// Defect: FIGM-PERF-04 (...)`, `{/* Defect: ... *\/}`,
 *     `<!-- Defect: ... -->`) as authoring/documentation aids for whoever wrote the ground truth.
 *     Left in place, they would hand the answer directly to an independent annotator, defeating
 *     the entire point of blind annotation.
 *  3. Writes the stripped ("blinded") fixtures to research/independent-annotation/package/fixtures/
 *     -- this is the ONLY fixture content ever shown to an annotator.
 *  4. Writes research/independent-annotation/internal/blinded-ground-truth.json -- the original
 *     ground truth, unchanged, EXCEPT annotated with each violation's approximate line number in
 *     the blinded file (for human sanity-checking only; the real evaluation match key is
 *     (filePath, ruleId), not line number -- see src/eval/evaluation-runner.ts). This file lives
 *     outside package/ specifically so it is never bundled into what gets sent to an annotator.
 *  5. Regenerates research/independent-annotation/package/RULE_REFERENCE.md from RULE_CATALOG
 *     (src/matrix/rule-registry.ts) -- the same canonical rule registry every other UI/export
 *     surface reads. Added Stage 6 (2026-09-03) pre-freeze review: found stale at only 25/50 rules
 *     listed (hand-written at an earlier rule-count revision, never updated through two later
 *     expansion passes that grew the registry to 50) -- an annotator given that sheet would have no
 *     reference for half the rules they could plausibly encounter in the (also-stale, now
 *     regenerated) fixtures/ directory. Generating it here, from the same registry every other
 *     consumer reads, makes this the last time it can silently drift.
 *
 * Reproducibility: deterministic given the same inputs. Re-run any time via
 * `npm run research:generate-annotation-package`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { RULE_CATALOG } from '../src/matrix/rule-registry.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const TESTBED_DIR = path.join(ROOT, 'benchmarks', 'testbed');
const GROUND_TRUTH_PATH = path.join(ROOT, 'benchmarks', 'ground-truth.json');
const PACKAGE_FIXTURES_DIR = path.join(ROOT, 'research', 'independent-annotation', 'package', 'fixtures');
const INTERNAL_DIR = path.join(ROOT, 'research', 'independent-annotation', 'internal');
const RULE_REFERENCE_PATH = path.join(ROOT, 'research', 'independent-annotation', 'package', 'RULE_REFERENCE.md');

interface GroundTruthItem {
  filePath: string;
  framework: string;
  ruleId: string;
  expectedLine: number;
  description: string;
}

/** Recursively lists every file under `dir` as POSIX-style paths relative to `baseDir` -- mirrors
 *  src/eval/evaluation-runner.ts's identical helper (same reasoning: FIGM-NEXT-03's fixture lives
 *  in a nested app/<segment>/page.tsx path a flat readdirSync would silently skip). A file
 *  directly in `baseDir` yields just its bare filename, unchanged from the old flat behavior. */
function collectTestbedFiles(dir: string, baseDir: string = dir): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestbedFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      files.push(path.relative(baseDir, fullPath).split(path.sep).join('/'));
    }
  }
  return files.sort();
}

// Matches a whole line that is ONLY a "Defect: FIGM-..." comment, in any of the three comment
// styles used across the fixtures (JS/TS `//`, JSX `{/* */}`, HTML/Angular-template `<!-- -->`).
const STANDALONE_DEFECT_COMMENT = /^\s*(\/\/|\{\/\*|<!--)\s*Defect:.*$/;
// Matches a trailing inline "// Defect: ..." comment appended after real code on the same line.
const TRAILING_DEFECT_COMMENT = /\s*\/\/\s*Defect:.*$/;

function stripDefectComments(source: string): { blinded: string; originalToBlindedLine: Map<number, number> } {
  const originalLines = source.split(/\r?\n/);
  const blindedLines: string[] = [];
  const originalToBlindedLine = new Map<number, number>();

  for (let i = 0; i < originalLines.length; i++) {
    const originalLineNum = i + 1;
    const line = originalLines[i];

    if (STANDALONE_DEFECT_COMMENT.test(line)) {
      // Entire line is the defect-labeling comment -- drop it, don't emit anything.
      continue;
    }

    const cleaned = line.replace(TRAILING_DEFECT_COMMENT, '');
    blindedLines.push(cleaned);
    originalToBlindedLine.set(originalLineNum, blindedLines.length);
  }

  return { blinded: blindedLines.join('\n'), originalToBlindedLine };
}

function main() {
  fs.mkdirSync(PACKAGE_FIXTURES_DIR, { recursive: true });
  fs.mkdirSync(INTERNAL_DIR, { recursive: true });

  const groundTruth: { meta: unknown; groundTruthViolations: GroundTruthItem[] } = JSON.parse(
    fs.readFileSync(GROUND_TRUTH_PATH, 'utf-8')
  );

  const fixtureFiles = collectTestbedFiles(TESTBED_DIR);
  const lineMaps: Record<string, Map<number, number>> = {};

  for (const fileName of fixtureFiles) {
    const source = fs.readFileSync(path.join(TESTBED_DIR, fileName), 'utf-8');
    const { blinded, originalToBlindedLine } = stripDefectComments(source);
    const outputPath = path.join(PACKAGE_FIXTURES_DIR, fileName);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, blinded, 'utf-8');
    lineMaps[fileName] = originalToBlindedLine;

    // Fail loudly, don't silently ship a leaky package, if any "Defect:" text survived stripping
    // (e.g. a comment style this script doesn't yet recognize).
    if (/Defect:\s*FIGM-/.test(blinded)) {
      throw new Error(`Blinding failed for ${fileName}: a "Defect: FIGM-..." comment survived stripping. Fix stripDefectComments() before regenerating the package.`);
    }
  }

  const blindedGroundTruth = {
    _generatedBy: 'scripts/generate-annotation-package.ts',
    _generatedAt: new Date().toISOString(),
    _warning: 'INTERNAL USE ONLY -- never copy this file into research/independent-annotation/package/. It contains the real answers.',
    _matchingNote: 'The real evaluation pipeline (src/eval/evaluation-runner.ts) matches ground truth to detections by (filePath, ruleId) only, never by line number. blindedLine below is documentary/for human sanity-checking only, not a match key.',
    groundTruthViolations: groundTruth.groundTruthViolations.map((gt) => ({
      ...gt,
      blindedLine: lineMaps[gt.filePath]?.get(gt.expectedLine) ?? null,
    })),
  };

  fs.writeFileSync(
    path.join(INTERNAL_DIR, 'blinded-ground-truth.json'),
    JSON.stringify(blindedGroundTruth, null, 2),
    'utf-8'
  );

  console.log(`[generate-annotation-package] Blinded ${fixtureFiles.length} fixtures -> research/independent-annotation/package/fixtures/`);
  console.log(`[generate-annotation-package] Wrote internal cross-reference -> research/independent-annotation/internal/blinded-ground-truth.json`);
  console.log(`[generate-annotation-package] Verified: no "Defect: FIGM-*" text survived in any blinded fixture.`);

  writeRuleReference();
  console.log(`[generate-annotation-package] Wrote rule reference (${RULE_CATALOG.length} rules) -> research/independent-annotation/package/RULE_REFERENCE.md`);
}

/** Regenerates RULE_REFERENCE.md from RULE_CATALOG. Reveals only rule id/name/severity/description
 *  -- never which fixture file or line a rule applies to (that determination stays the annotator's
 *  own job, per this package's own blind-review design, ANNOTATION_INSTRUCTIONS.md). */
function writeRuleReference(): void {
  const sorted = [...RULE_CATALOG].sort((a, b) => a.id.localeCompare(b.id));
  const rows = sorted
    .map((r) => `| ${r.id} | ${r.name} | ${r.severity} | ${r.description.replace(/\|/g, '\\|')} |`)
    .join('\n');

  const content = `# FIGM Guideline Rule Reference

This is the complete list of all ${RULE_CATALOG.length} rules in the FIGM guideline taxonomy. Use this sheet to
classify any violation you find in the fixture files — pick the \`Rule ID\` that best matches what
you observed. **This list intentionally does not indicate which rules apply to which fixture
file** — that determination is entirely yours to make as part of the annotation task.

If something looks wrong in the code but doesn't clearly match any rule below, write
\`OTHER\` as the Rule ID and describe it in your own words in the notes column.

| Rule ID | Name | Severity | What it flags |
|---|---|---|---|
${rows}

## Severity scale

- **CRITICAL** — Functional/correctness breakage, or a hard accessibility barrier.
- **HIGH** — Meaningful quality or accessibility defect, not a hard blocker.
- **MEDIUM** — Optimization/best-practice gap with a smaller impact.

---
_Generated by \`scripts/generate-annotation-package.ts\` from \`RULE_CATALOG\`
(\`src/matrix/rule-registry.ts\`) -- do not hand-edit; re-run
\`npm run research:generate-annotation-package\` after any rule-set change._
`;

  fs.writeFileSync(RULE_REFERENCE_PATH, content, 'utf-8');
}

main();
