/**
 * Framework-Independent Guideline Model (FIGM)
 * RQ4 Annotation Package Freeze — Stage 10
 *
 * Section 9's explicit requirement ("before sending cases to experts, freeze the annotation
 * package") has no prior implementation in this repository -- `scripts/generate-annotation-
 * package.ts` writes `package/fixtures/*` and `internal/blinded-ground-truth.json`, but never a
 * manifest with per-case content hashes. This script closes that gap: it is read-only over the
 * existing package (never regenerates fixtures, never touches internal/blinded-ground-truth.json)
 * and writes a single manifest recording exactly what a real annotator would be sent, so that if a
 * case is ever corrected after annotation starts, the change is detectable (hash mismatch) rather
 * than silent.
 *
 * Run again (and bump PACKAGE_VERSION below) only if the fixtures, RULE_REFERENCE.md, or
 * ANNOTATION_INSTRUCTIONS.md genuinely change -- never to "refresh" a manifest whose underlying
 * files are unchanged; an unchanged input must always re-hash to an unchanged manifest.
 *
 * Usage: node --import tsx scripts/freeze-annotation-package.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const PACKAGE_DIR = path.join(ROOT, 'research', 'independent-annotation', 'package');
const FIXTURES_DIR = path.join(PACKAGE_DIR, 'fixtures');

/** Bump this (and record the reason in the manifest's own history, once one exists) any time the
 *  package's real content changes. First real freeze of this package under Stage 10. */
const PACKAGE_VERSION = '1.0.0';

function sha256File(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function walkFiles(dir: string, base: string = dir): Array<{ relPath: string; absPath: string }> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out: Array<{ relPath: string; absPath: string }> = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(abs, base));
    } else if (entry.isFile()) {
      out.push({ relPath: path.relative(base, abs).split(path.sep).join('/'), absPath: abs });
    }
  }
  return out;
}

function frameworkForFile(relPath: string): string {
  if (relPath.endsWith('.vue')) return 'VUE_SFC';
  if (relPath.includes('/next03/') || /^Next\d/.test(path.basename(relPath))) return 'NEXT_JS';
  if (/^Ang\d/.test(path.basename(relPath)) || relPath.endsWith('.component.ts') || relPath.endsWith('.pipe.ts')) return 'ANGULAR_TEMPLATE';
  if (relPath.endsWith('.jsx')) return 'REACT_JSX';
  if (relPath.endsWith('.tsx')) return 'NEXT_JS';
  if (relPath.endsWith('.js') || relPath.endsWith('.ts')) return 'GENERIC_ESTREE';
  return 'UNKNOWN';
}

function main() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error(`Fixtures directory not found: ${FIXTURES_DIR}. Run "npm run research:generate-annotation-package" first.`);
    process.exit(1);
  }

  const fixtureFiles = walkFiles(FIXTURES_DIR).sort((a, b) => a.relPath.localeCompare(b.relPath));
  const cases = fixtureFiles.map((f, idx) => ({
    caseId: `RQ4-CASE-${String(idx + 1).padStart(3, '0')}`,
    fileName: f.relPath,
    framework: frameworkForFile(f.relPath),
    contentSha256: sha256File(f.absPath),
    isNegativeControl: f.relPath.startsWith('negative/'),
  }));

  const ruleReferencePath = path.join(PACKAGE_DIR, 'RULE_REFERENCE.md');
  const instructionsPath = path.join(PACKAGE_DIR, 'ANNOTATION_INSTRUCTIONS.md');

  const manifest = {
    packageVersion: PACKAGE_VERSION,
    createdAt: new Date().toISOString(),
    caseCount: cases.length,
    cases,
    ruleReference: {
      path: 'research/independent-annotation/package/RULE_REFERENCE.md',
      sha256: sha256File(ruleReferencePath),
    },
    annotationInstructions: {
      path: 'research/independent-annotation/package/ANNOTATION_INSTRUCTIONS.md',
      sha256: sha256File(instructionsPath),
    },
    freezePolicy: 'Cases must not be modified after this manifest is generated and annotation work begins. If a case must be corrected, bump packageVersion, regenerate this manifest, and treat any annotation collected against a prior packageVersion as invalidated for that case -- never silently edit a case in place.',
  };

  const outPath = path.join(PACKAGE_DIR, 'MANIFEST.json');
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`[freeze-annotation-package] Wrote ${path.relative(ROOT, outPath)} -- ${cases.length} cases, packageVersion ${PACKAGE_VERSION}`);
}

main();
