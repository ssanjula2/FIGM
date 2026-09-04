/**
 * Framework-Independent Guideline Model (FIGM)
 * RQ4 Annotation Package v1.1 Builder — Stage 10A
 *
 * Supersedes package/ (v1.0.0, never sent to any real expert — see
 * docs/audit/STAGE_10A_RQ4_PROTOCOL_AMENDMENT_AND_PACKAGE_V1_1_REPORT.md). v1.0.0 is left on disk,
 * untouched, as a historical record; it is not the package to actually use.
 *
 * Fixes v1.0's disclosed blinding leak (a `negative/` subfolder + `*Negative.*`/`*Benchmark.*`
 * filenames revealed intended positive/negative status, and loosely rule-number-hinting names like
 * `A11y05Benchmark.jsx` suggested which specific rule a file was built to test) by producing fully
 * neutral case filenames (`case-XXX.<ext>`) in a deterministic, non-alphabetic (hash-seeded) order
 * so file position itself carries no signal either.
 *
 * Implements the RQ4 protocol amendment's FIXED_JUDGMENT_MATRIX design (see
 * docs/research/RQ4_GROUND_TRUTH_PROTOCOL_AMENDMENT.md Section H / this stage's report Section 8):
 * a candidate (case, rule) judgment matrix is generated from objective file metadata alone —
 * framework applicability against the frozen RULE_CATALOG — never from FIGM's own predictions.
 * Framework is read from benchmarks/ground-truth.json's authored `framework` field where that file
 * is covered there (46 of 67 — ground truth only lists files with >=1 violation), and from a
 * validated, purely content/extension-based heuristic for the remaining 21 (uncovered because
 * they are deliberately violation-free `negative/` fixtures). Neither source is a FIGM prediction:
 * both are authored/objective file metadata that predates and does not depend on running the
 * engine.
 *
 * Usage: node --import tsx scripts/build-rq4-package-v1_1.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { RULE_CATALOG } from '../src/matrix/rule-registry.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const TESTBED_DIR = path.join(ROOT, 'benchmarks', 'testbed');
const GROUND_TRUTH_PATH = path.join(ROOT, 'benchmarks', 'ground-truth.json');
const PKG_DIR = path.join(ROOT, 'research', 'independent-annotation', 'package-v1.1');
const FIXTURES_DIR = path.join(PKG_DIR, 'fixtures');
const INTERNAL_DIR = path.join(ROOT, 'research', 'independent-annotation', 'internal');

const PACKAGE_VERSION = '1.1.0';

interface GroundTruthItem {
  filePath: string;
  framework: string;
  ruleId: string;
  expectedLine: number;
  description: string;
}

function collectFiles(dir: string, base: string = dir): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full, base));
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

// Same stripping logic as scripts/generate-annotation-package.ts (not imported from it, to keep
// this v1.1 builder fully self-contained and independently auditable).
const STANDALONE_DEFECT_COMMENT = /^\s*(\/\/|\{\/\*|<!--)\s*Defect:.*$/;
const TRAILING_DEFECT_COMMENT = /\s*\/\/\s*Defect:.*$/;
function stripDefectComments(source: string): string {
  return source
    .split(/\r?\n/)
    .filter((line) => !STANDALONE_DEFECT_COMMENT.test(line))
    .map((line) => line.replace(TRAILING_DEFECT_COMMENT, ''))
    .join('\n');
}

const NEXT_MARKERS = ['next/link', 'next/navigation', 'next/router', 'next/image', "'use client'", "'use server'", '"use client"', '"use server"'];
function detectFrameworkHeuristic(relPath: string, content: string): string {
  if (relPath.endsWith('.vue')) return 'VUE_SFC';
  if (relPath.endsWith('.component.ts') || relPath.endsWith('.pipe.ts')) return 'ANGULAR_TEMPLATE';
  if (relPath.endsWith('.jsx')) return 'REACT_JSX';
  if (relPath.endsWith('.tsx')) {
    const hasMarker = NEXT_MARKERS.some((m) => content.includes(m));
    return hasMarker || relPath.includes('/app/') ? 'NEXT_JS' : 'REACT_JSX';
  }
  return 'GENERIC_ESTREE';
}

/** Extension to use for the neutral case filename -- preserves genuinely necessary framework
 *  context (e.g. .vue, .component.ts) while dropping the intent-revealing basename. */
function neutralExtension(relPath: string): string {
  if (relPath.endsWith('.component.ts')) return '.component.ts';
  if (relPath.endsWith('.pipe.ts')) return '.pipe.ts';
  const ext = path.extname(relPath);
  return ext || '.txt';
}

function main() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  fs.mkdirSync(INTERNAL_DIR, { recursive: true });

  const groundTruth: { groundTruthViolations: GroundTruthItem[] } = JSON.parse(fs.readFileSync(GROUND_TRUTH_PATH, 'utf-8'));
  const gtFrameworkByFile = new Map<string, string>();
  const gtRuleIdsByFile = new Map<string, string[]>();
  for (const v of groundTruth.groundTruthViolations) {
    gtFrameworkByFile.set(v.filePath, v.framework);
    const list = gtRuleIdsByFile.get(v.filePath) ?? [];
    list.push(v.ruleId);
    gtRuleIdsByFile.set(v.filePath, list);
  }

  const originalFiles = collectFiles(TESTBED_DIR);
  if (originalFiles.length !== 67) {
    throw new Error(`Expected 67 testbed files, found ${originalFiles.length}. Recount before proceeding -- do not assume the count.`);
  }

  // Deterministic, non-alphabetic (hence non-intent-correlated) ordering: sort by SHA-256 of the
  // ORIGINAL relative path. Reproducible given the same file set, but does not preserve the
  // alphabetical grouping that previously put all 21 `negative/*` files contiguously last.
  const ordered = originalFiles
    .map((relPath) => ({ relPath, sortKey: crypto.createHash('sha256').update(relPath).digest('hex') }))
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));

  const caseIntentMapping: Array<{
    caseId: string;
    originalRelPath: string;
    wasNegativeControl: boolean;
    framework: string;
    frameworkSource: 'GROUND_TRUTH_AUTHORED' | 'CONTENT_HEURISTIC';
    groundTruthRuleIds: string[];
  }> = [];

  const caseFramework = new Map<string, string>();
  const caseFileName = new Map<string, string>();

  ordered.forEach(({ relPath }, idx) => {
    const caseId = `RQ4V11-CASE-${String(idx + 1).padStart(3, '0')}`;
    const source = fs.readFileSync(path.join(TESTBED_DIR, relPath), 'utf-8');
    const blinded = stripDefectComments(source);
    if (/Defect:\s*FIGM-/.test(blinded)) {
      throw new Error(`Blinding failed for ${relPath}: a "Defect: FIGM-..." comment survived stripping.`);
    }

    const ext = neutralExtension(relPath);
    const fileName = `${caseId}${ext}`;
    fs.writeFileSync(path.join(FIXTURES_DIR, fileName), blinded, 'utf-8');

    let framework: string;
    let frameworkSource: 'GROUND_TRUTH_AUTHORED' | 'CONTENT_HEURISTIC';
    if (gtFrameworkByFile.has(relPath)) {
      framework = gtFrameworkByFile.get(relPath)!;
      frameworkSource = 'GROUND_TRUTH_AUTHORED';
    } else {
      framework = detectFrameworkHeuristic(relPath, source);
      frameworkSource = 'CONTENT_HEURISTIC';
    }

    caseFramework.set(caseId, framework);
    caseFileName.set(caseId, fileName);
    caseIntentMapping.push({
      caseId,
      originalRelPath: relPath,
      wasNegativeControl: relPath.startsWith('negative/'),
      framework,
      frameworkSource,
      groundTruthRuleIds: gtRuleIdsByFile.get(relPath) ?? [],
    });
  });

  // --- Candidate judgment matrix: framework-applicability only, independent of FIGM predictions ---
  const candidateMatrix: Array<{ caseId: string; ruleId: string; applicabilityBasis: string }> = [];
  for (const { caseId, framework } of Array.from(caseFramework.entries()).map(([caseId, framework]) => ({ caseId, framework }))) {
    for (const rule of RULE_CATALOG as any[]) {
      if (rule.isFrameworkIndependent || rule.frameworks.includes(framework)) {
        candidateMatrix.push({
          caseId,
          ruleId: rule.id,
          applicabilityBasis: rule.isFrameworkIndependent ? 'FRAMEWORK_INDEPENDENT_RULE' : `RULE_APPLIES_TO_${framework}`,
        });
      }
    }
  }

  fs.writeFileSync(path.join(PKG_DIR, 'candidate-judgment-matrix.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    packageVersion: PACKAGE_VERSION,
    matrixSizeNote: `${candidateMatrix.length} (case, rule) candidate judgment rows across ${caseFramework.size} cases -- generated solely from each case's framework (see internal case-intent-mapping for provenance) against RULE_CATALOG's own frameworks/isFrameworkIndependent fields. No FIGM engine run, and no violation-truth data, was consulted to build this matrix.`,
    rows: candidateMatrix,
  }, null, 2), 'utf-8');

  // --- Annotation template, pre-populated with every candidate row ---
  const csvHeader = 'expert_id,case_id,rule_id,line_number,severity,decision,notes';
  const csvRows = candidateMatrix.map((r) => `,${r.caseId},${r.ruleId},,,,`);
  fs.writeFileSync(path.join(PKG_DIR, 'annotation-template.csv'), [csvHeader, ...csvRows].join('\n') + '\n', 'utf-8');

  // --- Rule reference, regenerated with the two required limitation sentences ---
  writeRuleReference();

  // --- Instructions ---
  writeInstructions(caseFramework.size, candidateMatrix.length);

  // --- Internal-only artifacts (never copied into package-v1.1/) ---
  fs.writeFileSync(
    path.join(INTERNAL_DIR, 'case-intent-mapping-v1.1.json'),
    JSON.stringify({
      _warning: 'INTERNAL USE ONLY -- never copy into research/independent-annotation/package-v1.1/. Maps neutral case IDs back to original filenames and reveals intended positive/negative status and the internal (researcher-authored) ground-truth rule IDs.',
      generatedAt: new Date().toISOString(),
      packageVersion: PACKAGE_VERSION,
      cases: caseIntentMapping,
    }, null, 2),
    'utf-8'
  );

  const blindedGroundTruthV11 = caseIntentMapping
    .filter((c) => c.groundTruthRuleIds.length > 0)
    .flatMap((c) => c.groundTruthRuleIds.map((ruleId) => ({ caseId: c.caseId, ruleId, provenance: 'INTERNAL_RESEARCHER_AUTHORED' })));
  fs.writeFileSync(
    path.join(INTERNAL_DIR, 'blinded-ground-truth-v1.1.json'),
    JSON.stringify({
      _warning: 'INTERNAL USE ONLY -- never copy into research/independent-annotation/package-v1.1/. Secondary/diagnostic reference only, per the RQ4 protocol amendment Section C -- never the primary RQ4 ground truth once a real expert submission exists.',
      generatedAt: new Date().toISOString(),
      packageVersion: PACKAGE_VERSION,
      groundTruthViolations: blindedGroundTruthV11,
    }, null, 2),
    'utf-8'
  );

  console.log(`[build-rq4-package-v1_1] Wrote ${caseFramework.size} neutral cases -> ${path.relative(ROOT, FIXTURES_DIR)}`);
  console.log(`[build-rq4-package-v1_1] Candidate judgment matrix: ${candidateMatrix.length} rows -> ${path.relative(ROOT, path.join(PKG_DIR, 'candidate-judgment-matrix.json'))}`);
  console.log(`[build-rq4-package-v1_1] Wrote internal case-intent mapping and blinded-ground-truth-v1.1.json`);
}

function writeRuleReference(): void {
  const sorted = [...(RULE_CATALOG as any[])].sort((a, b) => a.id.localeCompare(b.id));
  const rows = sorted.map((r) => `| ${r.id} | ${r.name} | ${r.domain} | ${r.severity} | ${r.description.replace(/\|/g, '\\|')} |`).join('\n');

  const content = `# FIGM Guideline Rule Reference (Package v${PACKAGE_VERSION})

This is the complete list of all ${RULE_CATALOG.length} rules in the FIGM guideline taxonomy. For every
(case, rule) row in \`annotation-template.csv\`, use this sheet to judge whether that specific rule's
criteria are violated in that specific case.

| Rule ID | Name | Domain | Severity | What it flags |
|---|---|---|---|---|
${rows}

## Severity scale

- **CRITICAL** — Functional/correctness breakage, or a hard accessibility barrier.
- **HIGH** — Meaningful quality or accessibility defect, not a hard blocker.
- **MEDIUM** — Optimization/best-practice gap with a smaller impact.

## Required limitation statements (read before judging ACCESSIBILITY or PERFORMANCE rows)

**Accessibility**: FIGM's Accessibility rules represent only the statically detectable subset of
WCAG 2.2-aligned issues. When judging an \`FIGM-A11Y-*\` row, judge **only that specific rule's
detectable-violation criteria** as defined above — you are not being asked to perform, and should
not attempt, a full WCAG 2.2 conformance review of the case.

**Static Performance**: FIGM's Static Performance (and Architecture) rules are static risk
indicators derived from source-code patterns, not measured runtime metrics. When judging an
\`FIGM-PERF-*\`/\`FIGM-NEXT-*\`/\`FIGM-REACT-*\`/\`FIGM-ANG-*\`/\`FIGM-VUE-*\` row, judge only whether the
described static pattern is present — do not treat it as, or attempt to estimate, a measured First
Contentful Paint or Time to Interactive value. (Real runtime FCP/TTI evidence for this project was
collected separately — see the RQ1 experiment — and is unrelated to this rule-instance judgment.)

---
_Generated by \`scripts/build-rq4-package-v1_1.ts\` from \`RULE_CATALOG\`
(\`src/matrix/rule-registry.ts\`) -- do not hand-edit; re-run the builder after any rule-set change
and bump packageVersion._
`;
  fs.writeFileSync(path.join(PKG_DIR, 'RULE_REFERENCE.md'), content, 'utf-8');
}

function writeInstructions(caseCount: number, matrixRowCount: number): void {
  const content = `# Independent Expert Annotation — Instructions (Package v${PACKAGE_VERSION})

Thank you for reviewing this material. You are acting as an **independent code reviewer**,
judging specific front-end code files against a fixed list of rule criteria, without knowledge of
what a separate, automated tool (FIGM) concluded about them.

## What you're doing

This package asks you to make **${matrixRowCount} explicit judgments** across **${caseCount} source
files** (in \`fixtures/\`, neutrally named \`RQ4V11-CASE-001\` .. \`RQ4V11-CASE-${String(caseCount).padStart(3, '0')}\`
— the naming carries no meaning about a file's content). \`annotation-template.csv\` is
**pre-populated with one row per (case, rule) pair we are asking you to judge** — every row already
has \`case_id\` and \`rule_id\` filled in. Your job is to fill in \`decision\` (and \`line_number\`/
\`severity\`/\`notes\` where applicable) for **every single row**.

This is a closed, fixed-matrix design, not an open "find whatever you notice" exercise — see
\`candidate-judgment-matrix.json\` for the same (case, rule) list in machine-readable form. The set
of which rules apply to which case was generated solely from each file's framework, before this
package was assembled — it is not a hint about what you will or won't find.

## The \`decision\` column — required for every row

| Value | Meaning |
|---|---|
| \`VIOLATION\` | This case's code violates this rule's criteria (as defined in \`RULE_REFERENCE.md\`). Fill in \`line_number\` and your own \`severity\` judgment (\`CRITICAL\`/\`HIGH\`/\`MEDIUM\`). |
| \`NO_VIOLATION\` | You examined this case against this specific rule and concluded it does **not** violate it. **This is a required, meaningful answer, not a default** — leave \`line_number\`/\`severity\` blank. |
| \`AMBIGUOUS\` | You cannot confidently decide either way (e.g. the rule's criteria don't clearly apply, or the code is genuinely borderline). Explain briefly in \`notes\`. Ambiguous rows are excluded from accuracy scoring, but the reason is preserved. |

**\`NO_VIOLATION\` rows are REQUIRED, not optional.** Every row must receive one of the three
decisions above — an unanswered row cannot be distinguished from "you didn't get to it yet" and
will be treated as incomplete, not as a negative judgment.

## What you do NOT have access to, and should not seek out

- Any FIGM scan output, report, or prior analysis of these specific files.
- Any FIGM documentation beyond \`RULE_REFERENCE.md\` in this package.
- The original, unmodified copies of these files (defect-labeling comments have been removed).
- Which cases (if any) were originally written as deliberately clean/negative examples — this
  package's file naming and layout do not indicate this, and you should not try to infer it.

If you have separately used the FIGM tool or seen its output on these exact files before, please
say so when you return your results.

## Two limitations to keep in mind (see RULE_REFERENCE.md for the full statements)

- **Accessibility** rows: judge only the specific rule's statically detectable criteria — not a
  full WCAG 2.2 conformance review.
- **Static Performance / Architecture** rows: judge only whether the static pattern described is
  present — not a measured runtime performance claim.

## When you're done

Fill in your own \`expert_id\` (an ID you choose, or one provided to you separately — not your name)
on every row, save \`annotation-template.csv\`, and return it. It will be placed under
\`research/raw/real/rq4/\` and scored against your judgments directly — per this project's RQ4
protocol amendment, **your independent judgment is the reference FIGM is measured against**, not
the other way around.
`;
  fs.writeFileSync(path.join(PKG_DIR, 'ANNOTATION_INSTRUCTIONS.md'), content, 'utf-8');
}

main();
