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
 *
 * Reproducibility: deterministic given the same inputs. Re-run any time via
 * `npm run research:generate-annotation-package`.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TESTBED_DIR = path.join(ROOT, 'benchmarks', 'testbed');
const GROUND_TRUTH_PATH = path.join(ROOT, 'benchmarks', 'ground-truth.json');
const PACKAGE_FIXTURES_DIR = path.join(ROOT, 'research', 'independent-annotation', 'package', 'fixtures');
const INTERNAL_DIR = path.join(ROOT, 'research', 'independent-annotation', 'internal');

interface GroundTruthItem {
  filePath: string;
  framework: string;
  ruleId: string;
  expectedLine: number;
  description: string;
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

  const fixtureFiles = fs.readdirSync(TESTBED_DIR).filter((f) => fs.statSync(path.join(TESTBED_DIR, f)).isFile());
  const lineMaps: Record<string, Map<number, number>> = {};

  for (const fileName of fixtureFiles) {
    const source = fs.readFileSync(path.join(TESTBED_DIR, fileName), 'utf-8');
    const { blinded, originalToBlindedLine } = stripDefectComments(source);
    fs.writeFileSync(path.join(PACKAGE_FIXTURES_DIR, fileName), blinded, 'utf-8');
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
}

main();
