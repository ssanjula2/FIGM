/**
 * Framework-Independent Guideline Model (FIGM)
 * RQ4 Expert Annotation CSV Parser — Stage 10A
 *
 * Bridges a completed annotation-template.csv (expert_id, case_id, rule_id, line_number, severity,
 * decision, notes) to the ExpertGroundTruthEntry[] shape scripts/compute-rq4-metrics.ts consumes.
 *
 * Per the RQ4 protocol amendment (docs/research/RQ4_GROUND_TRUTH_PROTOCOL_AMENDMENT.md):
 *   VIOLATION    -> expertGroundTruth: 'VIOLATION_PRESENT'
 *   NO_VIOLATION -> expertGroundTruth: 'VIOLATION_ABSENT'
 *   AMBIGUOUS    -> excluded: true (never enters the confusion matrix)
 * Any other decision value is a malformed row and throws -- never silently coerced or skipped.
 *
 * Safety guard: loadPrimaryRQ4GroundTruth() refuses a path under an `internal/` directory or a
 * filename matching this project's known internal-ground-truth naming convention
 * (`*ground-truth*.json`, `internal/**`) -- internal, researcher-authored labels may never be
 * loaded through this function as if they were the primary expert truth (protocol amendment
 * Section C). This is a positive, structural guard, not merely a consequence of the CSV parser
 * rejecting JSON input.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { ExpertGroundTruthEntry } from './compute-rq4-metrics.js';

export type Decision = 'VIOLATION' | 'NO_VIOLATION' | 'AMBIGUOUS';
const VALID_DECISIONS: readonly Decision[] = ['VIOLATION', 'NO_VIOLATION', 'AMBIGUOUS'];

export interface AnnotationCsvRow {
  expert_id: string;
  case_id: string;
  rule_id: string;
  line_number: string;
  severity: string;
  decision: string;
  notes: string;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { cells.push(current); current = ''; }
    else current += ch;
  }
  cells.push(current);
  return cells;
}

export function parseAnnotationCsv(text: string): AnnotationCsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => { row[h] = (cells[idx] ?? '').trim(); });
    return row as unknown as AnnotationCsvRow;
  });
}

/**
 * Converts completed annotation rows to ExpertGroundTruthEntry[]. Throws on any row whose
 * `decision` is not exactly one of VALID_DECISIONS -- a malformed/unexpected value must never be
 * silently treated as any particular judgment.
 */
export function annotationRowsToGroundTruth(rows: AnnotationCsvRow[], annotationVersion: string): ExpertGroundTruthEntry[] {
  return rows.map((row, idx) => {
    const decision = row.decision as Decision;
    if (!VALID_DECISIONS.includes(decision)) {
      throw new Error(`Row ${idx + 2}: invalid decision "${row.decision}" for case ${row.case_id} / rule ${row.rule_id}. Must be one of ${VALID_DECISIONS.join(', ')}.`);
    }
    if (!row.case_id || !row.rule_id) {
      throw new Error(`Row ${idx + 2}: missing case_id or rule_id.`);
    }
    const base = {
      caseId: row.case_id,
      ruleId: row.rule_id,
      provenance: 'REAL_EXPERT_SUBMISSION',
      annotationVersion,
    };
    if (decision === 'AMBIGUOUS') {
      return { ...base, expertGroundTruth: 'VIOLATION_ABSENT', excluded: true, exclusionReason: row.notes || 'Marked AMBIGUOUS by expert' } as ExpertGroundTruthEntry;
    }
    return {
      ...base,
      expertGroundTruth: decision === 'VIOLATION' ? 'VIOLATION_PRESENT' : 'VIOLATION_ABSENT',
    } as ExpertGroundTruthEntry;
  });
}

/**
 * The one sanctioned entry point for loading PRIMARY RQ4 ground truth from a real submission file.
 * Refuses any path that looks like this project's internal/researcher-authored ground truth --
 * see this file's header doc comment.
 */
export function loadPrimaryRQ4GroundTruth(csvPath: string, annotationVersion: string): ExpertGroundTruthEntry[] {
  const normalized = csvPath.split(path.sep).join('/');
  if (/(^|\/)internal\//.test(normalized) || /ground-truth/i.test(path.basename(normalized))) {
    throw new Error(
      `Refusing to load "${csvPath}" as primary RQ4 ground truth: this path matches this project's ` +
      `internal/researcher-authored ground-truth convention. Per the RQ4 protocol amendment Section ` +
      `B/C, only a real expert submission may serve as primary RQ4 ground truth.`
    );
  }
  if (!csvPath.endsWith('.csv')) {
    throw new Error(`Refusing to load "${csvPath}" as an expert submission: expected a .csv file (this project's real internal ground-truth files are .json, never .csv).`);
  }
  const rows = parseAnnotationCsv(fs.readFileSync(csvPath, 'utf-8'));
  return annotationRowsToGroundTruth(rows, annotationVersion);
}
