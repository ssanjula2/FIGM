/**
 * Framework-Independent Guideline Model (FIGM)
 * Reproducible Independent-Annotation Comparison Script
 *
 * Compares a completed independent-annotator submission against the internal blinded ground
 * truth and computes raw agreement, Cohen's kappa, and confusion matrices.
 *
 * ABSOLUTE RULE (per the research-methodology brief this script was built under): this script
 * must never fabricate annotators, annotations, agreement, or kappa. If no real submission file
 * is supplied/found, it reports `Independent annotation: PENDING` and computes nothing -- it does
 * not run against placeholder, synthetic, or self-generated data and present the result as if it
 * were a research finding.
 *
 * Usage:
 *   npm run research:compare-annotations -- <path-to-annotator-csv>
 *   npm run research:compare-annotations                                (no arg -> reports PENDING)
 *
 * Reproducibility: deterministic given the same ground truth + submission file. The matching
 * tolerance (LINE_TOLERANCE below) is the one methodological parameter this script fixes; it is
 * declared as a named constant specifically so it's visible and citable, not buried in logic.
 */

import fs from 'node:fs';
import path from 'node:path';
import { computeAgreement, interpretKappa, RatingPair } from '../src/eval/inter-rater-reliability.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const INTERNAL_DIR = path.join(ROOT, 'research', 'independent-annotation', 'internal');
const SUBMISSIONS_DIR = path.join(ROOT, 'research', 'independent-annotation', 'submissions');
const RESULTS_DIR = path.join(ROOT, 'research', 'independent-annotation', 'results');

/** How many lines apart a ground-truth item and an annotator-reported line may be and still be
 * considered "the same location," given both are matched on the same (fixture_file, ruleId)
 * already. Generous on purpose: annotators may reasonably record the line of an enclosing
 * element rather than its exact opening tag, and the real FIGM evaluation pipeline itself
 * (src/eval/evaluation-runner.ts) does not require line-level matching at all -- only
 * (filePath, ruleId). This tolerance exists purely as a sanity/documentation aid, not as the
 * primary matching key. */
const LINE_TOLERANCE = 5;

interface BlindedGroundTruthItem {
  filePath: string;
  framework: string;
  ruleId: string;
  expectedLine: number;
  description: string;
  blindedLine: number | null;
}

interface AnnotatorRow {
  fixture_file: string;
  line_number: string;
  violation_present: string;
  rule_id: string;
  severity: string;
  notes: string;
}

function parseCsv(text: string): AnnotatorRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]);
  const rows: AnnotatorRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => { row[h.trim()] = (cells[idx] ?? '').trim(); });
    rows.push(row as unknown as AnnotatorRow);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function reportPending(reason: string) {
  const message = [
    'Independent annotation: PENDING',
    '',
    `Reason: ${reason}`,
    '',
    'No independent annotator has completed the annotation process for this benchmark yet.',
    'No raw agreement, Cohen\'s kappa, or confusion matrix is reported, because none has been',
    'computed from real annotation data. See research/independent-annotation/README.md for the',
    'workflow to collect one.',
  ].join('\n');
  console.log(message);

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RESULTS_DIR, 'STATUS.md'), `# Independent Annotation Comparison — Status\n\n${message}\n\n_Last checked: ${new Date().toISOString()}_\n`, 'utf-8');
}

function main() {
  const submissionArg = process.argv[2];

  let submissionPath: string | null = null;
  if (submissionArg) {
    submissionPath = path.isAbsolute(submissionArg) ? submissionArg : path.join(ROOT, submissionArg);
    if (!fs.existsSync(submissionPath)) {
      reportPending(`Supplied submission path does not exist: ${submissionArg}`);
      process.exitCode = 0;
      return;
    }
  } else {
    const existing = fs.existsSync(SUBMISSIONS_DIR)
      ? fs.readdirSync(SUBMISSIONS_DIR).filter((f) => f.endsWith('.csv'))
      : [];
    if (existing.length === 0) {
      reportPending('No submission file was given, and research/independent-annotation/submissions/ contains no .csv files.');
      process.exitCode = 0;
      return;
    }
    submissionPath = path.join(SUBMISSIONS_DIR, existing[0]);
  }

  const groundTruthPath = path.join(INTERNAL_DIR, 'blinded-ground-truth.json');
  if (!fs.existsSync(groundTruthPath)) {
    reportPending(`Internal ground truth not found at ${groundTruthPath}. Run "npm run research:generate-annotation-package" first.`);
    process.exitCode = 0;
    return;
  }

  const groundTruth: { groundTruthViolations: BlindedGroundTruthItem[] } = JSON.parse(fs.readFileSync(groundTruthPath, 'utf-8'));
  const annotatorRows = parseCsv(fs.readFileSync(submissionPath, 'utf-8'));

  const realAnnotatorRows = annotatorRows.filter((r) => r.fixture_file && r.fixture_file.trim() !== '');
  if (realAnnotatorRows.length === 0) {
    reportPending(`Submission file "${path.basename(submissionPath)}" was found but contains zero completed rows. An empty template is not a completed annotation.`);
    process.exitCode = 0;
    return;
  }

  // --- Presence/Absence agreement (item universe = union of ground truth ∪ annotator rows) ---
  const presencePairs: RatingPair[] = [];
  const matchedAnnotatorIndices = new Set<number>();
  const itemLog: string[] = [];

  groundTruth.groundTruthViolations.forEach((gt, gtIdx) => {
    const matchIdx = realAnnotatorRows.findIndex((row, idx) => {
      if (matchedAnnotatorIndices.has(idx)) return false;
      if (row.fixture_file !== gt.filePath) return false;
      if (row.rule_id !== gt.ruleId) return false;
      if (gt.blindedLine != null && row.line_number) {
        const annotatorLine = Number(row.line_number);
        if (!Number.isNaN(annotatorLine) && Math.abs(annotatorLine - gt.blindedLine) > LINE_TOLERANCE) return false;
      }
      return (row.violation_present || 'yes').toLowerCase() !== 'no';
    });

    const found = matchIdx !== -1;
    if (found) matchedAnnotatorIndices.add(matchIdx);

    presencePairs.push({
      itemId: `gt-${gtIdx}-${gt.filePath}-${gt.ruleId}`,
      rater1: 'PRESENT',
      rater2: found ? 'PRESENT' : 'ABSENT',
    });
    const lineDisplay = gt.blindedLine != null ? `line ~${gt.blindedLine}` : 'line unavailable (original ground-truth expectedLine pointed at the now-removed defect comment, not the code itself -- matched by rule ID only, see docs/research/GROUND_TRUTH_DOCUMENTATION.md)';
    itemLog.push(`[ground-truth] ${gt.filePath} ${gt.ruleId} (${lineDisplay}) -> annotator: ${found ? 'CONFIRMED' : 'MISSED'}`);
  });

  realAnnotatorRows.forEach((row, idx) => {
    if (matchedAnnotatorIndices.has(idx)) return;
    if ((row.violation_present || 'yes').toLowerCase() === 'no') return; // explicit "considered and rejected" row, not a finding
    presencePairs.push({
      itemId: `annotator-only-${idx}-${row.fixture_file}-${row.rule_id}`,
      rater1: 'ABSENT',
      rater2: 'PRESENT',
    });
    itemLog.push(`[annotator-only] ${row.fixture_file} ${row.rule_id} (line ${row.line_number}) -> not in ground truth (extra finding, not necessarily wrong)`);
  });

  const presenceResult = computeAgreement(presencePairs);

  // --- Rule-classification agreement, restricted to items both raters agree are present ---
  const ruleClassificationPairs: RatingPair[] = [];
  groundTruth.groundTruthViolations.forEach((gt, gtIdx) => {
    const matchIdx = realAnnotatorRows.findIndex((row) => row.fixture_file === gt.filePath && row.rule_id && (row.violation_present || 'yes').toLowerCase() !== 'no' && Math.abs((Number(row.line_number) || 0) - (gt.blindedLine ?? 0)) <= LINE_TOLERANCE);
    if (matchIdx !== -1) {
      ruleClassificationPairs.push({ itemId: `rule-${gtIdx}`, rater1: gt.ruleId, rater2: realAnnotatorRows[matchIdx].rule_id });
    }
  });
  const ruleClassificationResult = ruleClassificationPairs.length > 0 ? computeAgreement(ruleClassificationPairs) : null;

  // --- Report ---
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const reportLines: string[] = [];
  reportLines.push(`# Independent Annotation Comparison — ${path.basename(submissionPath)}`);
  reportLines.push('');
  reportLines.push(`Generated: ${new Date().toISOString()}`);
  reportLines.push(`Ground truth: ${groundTruth.groundTruthViolations.length} items. Annotator rows: ${realAnnotatorRows.length}. Line tolerance: ±${LINE_TOLERANCE} lines.`);
  reportLines.push('');
  reportLines.push('## Presence/Absence Agreement');
  reportLines.push(`- n = ${presenceResult.n}`);
  reportLines.push(`- Raw (observed) agreement: ${(presenceResult.observedAgreement * 100).toFixed(1)}%`);
  reportLines.push(`- Expected (chance) agreement: ${(presenceResult.expectedAgreement * 100).toFixed(1)}%`);
  reportLines.push(`- Cohen's kappa: ${presenceResult.cohensKappa.toFixed(3)} (${interpretKappa(presenceResult.cohensKappa)})`);
  reportLines.push('');
  reportLines.push('### Confusion Matrix (ground truth rater vs. annotator)');
  reportLines.push('| Ground Truth \\ Annotator | PRESENT | ABSENT |');
  reportLines.push('|---|---|---|');
  for (const r1 of ['PRESENT', 'ABSENT']) {
    const row = ['PRESENT', 'ABSENT'].map((r2) => presenceResult.confusionMatrix.find((c) => c.rater1Category === r1 && c.rater2Category === r2)?.count ?? 0);
    reportLines.push(`| ${r1} | ${row[0]} | ${row[1]} |`);
  }
  reportLines.push('');
  if (ruleClassificationResult) {
    reportLines.push('## Rule Classification Agreement (on items both raters agree are present)');
    reportLines.push(`- n = ${ruleClassificationResult.n}`);
    reportLines.push(`- Raw agreement: ${(ruleClassificationResult.observedAgreement * 100).toFixed(1)}%`);
    reportLines.push(`- Cohen's kappa: ${ruleClassificationResult.cohensKappa.toFixed(3)} (${interpretKappa(ruleClassificationResult.cohensKappa)})`);
    reportLines.push('');
  }
  reportLines.push('## Item-Level Detail');
  reportLines.push(...itemLog.map((l) => `- ${l}`));

  const outPath = path.join(RESULTS_DIR, `${path.basename(submissionPath, '.csv')}-comparison.md`);
  fs.writeFileSync(outPath, reportLines.join('\n'), 'utf-8');
  console.log(reportLines.join('\n'));
  console.log(`\n[compare-annotations] Full report written to ${path.relative(ROOT, outPath)}`);
}

main();
