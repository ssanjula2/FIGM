/**
 * Framework-Independent Guideline Model (FIGM)
 * RQ4 Annotation Package v1.1 Freeze — Stage 10A
 *
 * Read-only over research/independent-annotation/package-v1.1/ (built by
 * scripts/build-rq4-package-v1_1.ts). Writes MANIFEST.json recording packageVersion, per-case
 * content hashes, and hashes of every other file an expert receives (rule reference, instructions,
 * annotation template, candidate judgment matrix) -- so any later change to any of them is
 * detectable rather than silent, per this package's own freeze policy.
 *
 * Usage: node --import tsx scripts/freeze-annotation-package-v1_1.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const PKG_DIR = path.join(ROOT, 'research', 'independent-annotation', 'package-v1.1');
const FIXTURES_DIR = path.join(PKG_DIR, 'fixtures');

const PACKAGE_VERSION = '1.1.0';

function sha256File(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function main() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error(`${FIXTURES_DIR} not found. Run "node --import tsx scripts/build-rq4-package-v1_1.ts" first.`);
    process.exit(1);
  }

  const caseFiles = fs.readdirSync(FIXTURES_DIR).filter((f) => !f.startsWith('.')).sort();
  const cases = caseFiles.map((fileName) => ({
    caseId: fileName.split('.')[0],
    fileName,
    contentSha256: sha256File(path.join(FIXTURES_DIR, fileName)),
  }));

  const ruleReferencePath = path.join(PKG_DIR, 'RULE_REFERENCE.md');
  const instructionsPath = path.join(PKG_DIR, 'ANNOTATION_INSTRUCTIONS.md');
  const templatePath = path.join(PKG_DIR, 'annotation-template.csv');
  const matrixPath = path.join(PKG_DIR, 'candidate-judgment-matrix.json');

  const manifest = {
    packageVersion: PACKAGE_VERSION,
    createdAt: new Date().toISOString(),
    supersedes: 'research/independent-annotation/package/ (v1.0.0) -- preserved on disk, unused, never sent to any real expert',
    caseCount: cases.length,
    cases,
    ruleReference: { path: 'research/independent-annotation/package-v1.1/RULE_REFERENCE.md', sha256: sha256File(ruleReferencePath) },
    annotationInstructions: { path: 'research/independent-annotation/package-v1.1/ANNOTATION_INSTRUCTIONS.md', sha256: sha256File(instructionsPath) },
    annotationTemplate: { path: 'research/independent-annotation/package-v1.1/annotation-template.csv', sha256: sha256File(templatePath) },
    candidateJudgmentMatrix: { path: 'research/independent-annotation/package-v1.1/candidate-judgment-matrix.json', sha256: sha256File(matrixPath) },
    freezePolicy: 'Cases and the candidate judgment matrix must not be modified after this manifest is generated and annotation work begins. If a case must be corrected, bump packageVersion, rebuild via build-rq4-package-v1_1.ts, regenerate this manifest, and treat any annotation collected against a prior packageVersion as invalidated for that case -- never silently edit a case in place.',
  };

  const outPath = path.join(PKG_DIR, 'MANIFEST.json');
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`[freeze-annotation-package-v1_1] Wrote ${path.relative(ROOT, outPath)} -- ${cases.length} cases, packageVersion ${PACKAGE_VERSION}`);
}

main();
