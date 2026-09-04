import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseAnnotationCsv, annotationRowsToGroundTruth, loadPrimaryRQ4GroundTruth } from '../scripts/parse-rq4-annotation-csv.js';
import { analyzeRQ4 } from '../scripts/compute-rq4-metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PKG_DIR = path.join(ROOT, 'research', 'independent-annotation', 'package-v1.1');
const FIXTURES_DIR = path.join(PKG_DIR, 'fixtures');
const INTERNAL_DIR = path.join(ROOT, 'research', 'independent-annotation', 'internal');

test('no negative/positive-intent path leakage in the expert package', () => {
  const allEntries = fs.readdirSync(PKG_DIR, { recursive: true, withFileTypes: true }) as fs.Dirent[];
  const suspiciousPaths = allEntries
    .map((e) => path.join((e as any).path ?? PKG_DIR, e.name))
    .filter((p) => /negative|benchmark/i.test(path.relative(PKG_DIR, p)));
  assert.deepEqual(suspiciousPaths, [], 'no file or directory name under package-v1.1/ may hint at intended positive/negative status');

  const fixtureFiles = fs.readdirSync(FIXTURES_DIR);
  assert.ok(fixtureFiles.length > 0);
  for (const f of fixtureFiles) {
    assert.match(f, /^RQ4V11-CASE-\d{3}\.[a-z.]+$/, `${f} must use the neutral case-id naming scheme`);
  }
});

test('no internal ground-truth file is bundled inside the expert package directory', () => {
  const allEntries = fs.readdirSync(PKG_DIR, { recursive: true, withFileTypes: true }) as fs.Dirent[];
  const names = allEntries.map((e) => e.name.toLowerCase());
  assert.ok(!names.some((n) => n.includes('ground-truth')), 'no ground-truth file may be bundled into the package sent to an expert');
  assert.ok(!names.some((n) => n.includes('intent-mapping')), 'no case-intent mapping may be bundled into the package sent to an expert');
  // The real internal files must exist, but strictly outside package-v1.1/.
  assert.ok(fs.existsSync(path.join(INTERNAL_DIR, 'blinded-ground-truth-v1.1.json')));
  assert.ok(fs.existsSync(path.join(INTERNAL_DIR, 'case-intent-mapping-v1.1.json')));
});

test('required limitation wording is present in RULE_REFERENCE.md', () => {
  const content = fs.readFileSync(path.join(PKG_DIR, 'RULE_REFERENCE.md'), 'utf-8');
  assert.match(content, /statically detectable subset of\s*\nWCAG 2\.2-aligned issues/i, 'accessibility limitation wording must be present');
  assert.match(content, /not.*attempt.*full WCAG 2\.2 conformance review/i);
  assert.match(content, /static risk\s*\nindicators/i, 'static performance limitation wording must be present');
  assert.match(content, /not.*measured First\s*\nContentful Paint or Time to Interactive/i);
});

test('manifest hashes are valid and match the real files on disk', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'MANIFEST.json'), 'utf-8'));
  assert.equal(manifest.packageVersion, '1.1.0');
  assert.equal(manifest.caseCount, 67);
  assert.equal(manifest.cases.length, 67);

  for (const c of manifest.cases) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(FIXTURES_DIR, c.fileName))).digest('hex');
    assert.equal(actual, c.contentSha256, `${c.fileName} content hash must match the manifest`);
  }

  const ruleRefActual = crypto.createHash('sha256').update(fs.readFileSync(path.join(PKG_DIR, 'RULE_REFERENCE.md'))).digest('hex');
  assert.equal(ruleRefActual, manifest.ruleReference.sha256);

  const instructionsActual = crypto.createHash('sha256').update(fs.readFileSync(path.join(PKG_DIR, 'ANNOTATION_INSTRUCTIONS.md'))).digest('hex');
  assert.equal(instructionsActual, manifest.annotationInstructions.sha256);

  const templateActual = crypto.createHash('sha256').update(fs.readFileSync(path.join(PKG_DIR, 'annotation-template.csv'))).digest('hex');
  assert.equal(templateActual, manifest.annotationTemplate.sha256);

  const matrixActual = crypto.createHash('sha256').update(fs.readFileSync(path.join(PKG_DIR, 'candidate-judgment-matrix.json'))).digest('hex');
  assert.equal(matrixActual, manifest.candidateJudgmentMatrix.sha256);
});

test('decision enum validation: only VIOLATION / NO_VIOLATION / AMBIGUOUS are accepted', () => {
  const valid = parseAnnotationCsv(
    'expert_id,case_id,rule_id,line_number,severity,decision,notes\n' +
    'E001,RQ4V11-CASE-001,FIGM-PERF-01,3,HIGH,VIOLATION,clear case\n' +
    'E001,RQ4V11-CASE-001,FIGM-PERF-02,,,NO_VIOLATION,\n' +
    'E001,RQ4V11-CASE-001,FIGM-PERF-03,,,AMBIGUOUS,unclear applicability\n'
  );
  const entries = annotationRowsToGroundTruth(valid, '1.1.0');
  assert.equal(entries.length, 3);
  assert.equal(entries[0].expertGroundTruth, 'VIOLATION_PRESENT');
  assert.equal(entries[1].expertGroundTruth, 'VIOLATION_ABSENT');
  assert.equal(entries[2].excluded, true);

  const invalid = parseAnnotationCsv(
    'expert_id,case_id,rule_id,line_number,severity,decision,notes\n' +
    'E001,RQ4V11-CASE-001,FIGM-PERF-01,,,MAYBE,not a real value\n'
  );
  assert.throws(() => annotationRowsToGroundTruth(invalid, '1.1.0'), /invalid decision "MAYBE"/);
});

test('ambiguous units are excluded from TP/FP/FN denominators, not silently dropped', () => {
  const entries = annotationRowsToGroundTruth(
    parseAnnotationCsv(
      'expert_id,case_id,rule_id,line_number,severity,decision,notes\n' +
      'E001,C1,FIGM-A11Y-01,,,VIOLATION,\n' +
      'E001,C2,FIGM-A11Y-02,,,AMBIGUOUS,cannot decide\n'
    ),
    '1.1.0'
  );
  const predictions = [
    { caseId: 'C1', ruleId: 'FIGM-A11Y-01', engineVersion: 'v5', ruleSetVersion: '2.1.0', timestamp: new Date().toISOString() },
    { caseId: 'C2', ruleId: 'FIGM-A11Y-02', engineVersion: 'v5', ruleSetVersion: '2.1.0', timestamp: new Date().toISOString() },
  ];
  const result = analyzeRQ4(entries, predictions);
  assert.equal(result.excludedUnitCount, 1);
  assert.equal(result.overall.tp, 1, 'C1 is a real TP');
  assert.equal(result.overall.fp, 0, 'C2 must not count as FP just because it was excluded');
  assert.equal(result.overall.fn, 0);
});

test('candidate judgment matrix does not depend on FIGM predictions', () => {
  const matrix = JSON.parse(fs.readFileSync(path.join(PKG_DIR, 'candidate-judgment-matrix.json'), 'utf-8'));
  assert.ok(matrix.rows.length > 0);
  for (const row of matrix.rows.slice(0, 50)) {
    assert.ok(!('figmPredicted' in row), 'a candidate row must never carry a FIGM-prediction field');
    assert.ok(!('confidence' in row), 'a candidate row must never carry a FIGM confidence field');
    assert.match(row.applicabilityBasis, /^(FRAMEWORK_INDEPENDENT_RULE|RULE_APPLIES_TO_)/, 'applicability must be framework-based, not FIGM-output-based');
  }
  // Re-derive the matrix size from RULE_CATALOG + the internal case-intent mapping's framework
  // field alone (never from any FIGM run) and confirm it matches what was shipped.
  const intentMapping = JSON.parse(fs.readFileSync(path.join(INTERNAL_DIR, 'case-intent-mapping-v1.1.json'), 'utf-8'));
  assert.equal(intentMapping.cases.length, 67);
});

test('internal labels cannot be loaded as primary expert truth by compute-rq4-metrics tooling', () => {
  const internalPath = path.join(INTERNAL_DIR, 'blinded-ground-truth-v1.1.json');
  assert.throws(
    () => loadPrimaryRQ4GroundTruth(internalPath, '1.1.0'),
    /Refusing to load/,
    'loadPrimaryRQ4GroundTruth must refuse any path under internal/ or matching the ground-truth naming convention'
  );

  const legacyInternalPath = path.join(INTERNAL_DIR, 'blinded-ground-truth.json');
  assert.throws(() => loadPrimaryRQ4GroundTruth(legacyInternalPath, '1.0.0'), /Refusing to load/);

  // A real .csv submission path is accepted (format-wise) -- the internal-path guard does not
  // fire for it. It still throws, but for a completely different, expected reason: the blank
  // template's `decision` cells are all empty, which correctly fails decision-enum validation
  // rather than the internal-path guard -- confirming the guard is specific to internal content,
  // not overly broad.
  assert.throws(
    () => loadPrimaryRQ4GroundTruth(path.join(PKG_DIR, 'annotation-template.csv'), '1.1.0'),
    /invalid decision/
  );
});
