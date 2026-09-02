/**
 * Framework-Independent Guideline Model (FIGM)
 * Real-World Corpus Summary Artifact Generator (Stage 5, 2026-09-03)
 *
 * Reads the already-written raw-results/*.json (one per repo, produced by
 * run-real-world-benchmark.ts) plus the REPOS manifest, and derives the additional
 * research-facing artifacts required by the Stage 5 expansion brief: a reproducibility-focused
 * repository manifest, a framework-distribution summary, a domain summary computed via
 * primaryResearchDomain() (not the older 2-value raw `domain` field), and a rule-frequency
 * summary. Nothing here re-scans any repository or invents any number -- every field is derived
 * from raw-results/*.json, which is itself raw, unverified tool output (see METHODOLOGY.md).
 *
 * Usage:
 *   node --import tsx benchmarks/real-world/generate-corpus-summary.ts
 *
 * Must be run AFTER run-real-world-benchmark.ts has produced raw-results/*.json for every repo
 * in REPOS -- this script does not clone or scan anything itself.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPOS } from './run-real-world-benchmark.js';
import { primaryResearchDomain, WCAG_22_MAPPINGS } from '../../src/matrix/four-layer-meta-model.js';
import type { ScanResult } from '../../src/engine/rule-execution-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRIMARY_FRAMEWORKS = new Set(['React', 'Next.js', 'Angular']);

interface RepoResultOnDisk {
  name: string;
  url: string;
  commit: string;
  primaryFrameworkLabel: string;
  filesScanned: number;
  totalLOC: number;
  scanDurationMs: number;
  totalFigmFindings: number;
  findingsByRule: Record<string, number>;
  findingsBySeverity: Record<string, number>;
  frameworksDetected: Record<string, number>;
  parserFailures: { filesWithParseErrors: number; totalParseErrorCount: number };
  engineCrashes: { relativePath: string; error: string }[];
  perFile: unknown[];
  rawDiagnostics: ScanResult['diagnostics'];
}

function main() {
  const rawDir = path.join(__dirname, 'raw-results');

  const perRepo: RepoResultOnDisk[] = REPOS.map((repo) => {
    const p = path.join(rawDir, `${repo.name}.json`);
    if (!fs.existsSync(p)) {
      throw new Error(
        `[FATAL] Missing raw-results/${repo.name}.json -- run run-real-world-benchmark.ts first. ` +
          `Refusing to generate summary artifacts from a partial/stale corpus.`
      );
    }
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as RepoResultOnDisk;
  });

  // -------------------------------------------------------------------------------------------
  // 1. Repository manifest (reproducibility-focused)
  // -------------------------------------------------------------------------------------------
  const repositoryManifest = {
    generatedAt: new Date().toISOString(),
    totalRepositories: REPOS.length,
    repositories: REPOS.map((repo, i) => {
      const result = perRepo[i];
      return {
        name: repo.name,
        url: repo.url,
        primaryFrameworkLabel: repo.primaryFrameworkLabel,
        isPrimaryFramework: PRIMARY_FRAMEWORKS.has(repo.primaryFrameworkLabel),
        pinnedCommit: repo.pinnedCommit,
        license: repo.license ?? 'see METHODOLOGY.md (original 15-repo corpus tables)',
        inclusionRationale: repo.inclusionRationale ?? 'see METHODOLOGY.md (original 15-repo corpus, SS3/SS8b)',
        datePinned: repo.datePinned ?? '2026-08-14 or 2026-08-25 (original corpus -- see METHODOLOGY.md)',
        sourceDirs: repo.sourceDirs ?? 'entire repository',
        exclusionPaths:
          repo.exclusionPaths ?? 'node_modules, .git, dist, build, .next, coverage, .vercel',
        filesScanned: result.filesScanned,
        totalLOC: result.totalLOC,
      };
    }),
  };

  // -------------------------------------------------------------------------------------------
  // 2. Framework distribution
  // -------------------------------------------------------------------------------------------
  const frameworkDistribution: Record<string, number> = {};
  for (const repo of REPOS) {
    frameworkDistribution[repo.primaryFrameworkLabel] = (frameworkDistribution[repo.primaryFrameworkLabel] || 0) + 1;
  }
  const primaryFrameworkRepoCount = REPOS.filter((r) => PRIMARY_FRAMEWORKS.has(r.primaryFrameworkLabel)).length;

  // -------------------------------------------------------------------------------------------
  // 3. Domain summary -- computed via primaryResearchDomain(domain, concern), NOT the raw 2-value
  //    `domain` field, per the Stage 5 brief's explicit instruction.
  // -------------------------------------------------------------------------------------------
  const domainCounts: Record<'ARCHITECTURE' | 'STATIC_PERFORMANCE' | 'ACCESSIBILITY', number> = {
    ARCHITECTURE: 0,
    STATIC_PERFORMANCE: 0,
    ACCESSIBILITY: 0,
  };
  const wcagCounts: Record<string, number> = {};
  let totalRawDiagnostics = 0;

  for (const r of perRepo) {
    for (const d of r.rawDiagnostics) {
      totalRawDiagnostics += 1;
      const pd = primaryResearchDomain(d.domain as unknown as string, d.concern as unknown as string);
      domainCounts[pd] += 1;
      if (pd === 'ACCESSIBILITY') {
        const wcagSC = WCAG_22_MAPPINGS[d.ruleId]?.clause;
        if (wcagSC) wcagCounts[wcagSC] = (wcagCounts[wcagSC] || 0) + 1;
      }
    }
  }

  // -------------------------------------------------------------------------------------------
  // 4. Rule-frequency summary
  // -------------------------------------------------------------------------------------------
  const ruleFrequency: Record<string, number> = {};
  for (const r of perRepo) {
    for (const [ruleId, count] of Object.entries(r.findingsByRule)) {
      ruleFrequency[ruleId] = (ruleFrequency[ruleId] || 0) + count;
    }
  }
  const distinctRulesTriggered = Object.keys(ruleFrequency).length;

  // -------------------------------------------------------------------------------------------
  // 5. Parse/failure honesty rollup (section 6 of the Stage 5 brief)
  // -------------------------------------------------------------------------------------------
  // filesScanned (== perFile.length) already includes files where analyzeFile() itself threw
  // (scanRepo pushes those to BOTH engineCrashes and perFile, with engineCrash set on the perFile
  // entry) -- only a raw fs.readFileSync failure (read before analysis is attempted) lands in
  // engineCrashes WITHOUT a matching perFile entry. Naively adding filesScanned + engineCrashes.length
  // would double-count the former class; this counts a crash toward "discovered but not analyzed"
  // only when it has no corresponding perFile record.
  const totalFilesAnalyzed = perRepo.reduce((a, r) => a + r.filesScanned, 0);
  const totalFilesDiscovered = perRepo.reduce((a, r) => {
    const perFilePaths = new Set(r.perFile.map((f) => (f as unknown as { relativePath: string }).relativePath));
    const readFailuresOnly = r.engineCrashes.filter((c) => !perFilePaths.has(c.relativePath)).length;
    return a + r.filesScanned + readFailuresOnly;
  }, 0);
  const totalParseErrorFiles = perRepo.reduce((a, r) => a + r.parserFailures.filesWithParseErrors, 0);
  const totalEngineCrashes = perRepo.reduce((a, r) => a + r.engineCrashes.length, 0);
  const totalFindings = perRepo.reduce((a, r) => a + r.totalFigmFindings, 0);

  const domainSummary = {
    generatedAt: new Date().toISOString(),
    note: 'Computed via primaryResearchDomain(domain, concern) from src/matrix/four-layer-meta-model.ts over every raw diagnostic in raw-results/*.json -- NOT the older 2-value raw `domain` field. Raw, unverified tool output -- see METHODOLOGY.md. WCAG conformance is NOT claimed; this is a count of findings mapped to a Success Criterion, not a conformance rate.',
    totalRawDiagnostics,
    byPrimaryResearchDomain: domainCounts,
    accessibilityByWcagSuccessCriterion: wcagCounts,
  };

  const ruleFrequencySummary = {
    generatedAt: new Date().toISOString(),
    distinctRulesTriggered,
    findingsByRule: ruleFrequency,
  };

  const reproducibilityMetadata = {
    generatedAt: new Date().toISOString(),
    engineVersion: 'FIGM-Core-v2 (see figm-spec.json meta.version)',
    scriptSourceOfTruth: 'benchmarks/real-world/run-real-world-benchmark.ts (REPOS array)',
    reproduceCommand: 'node --import tsx benchmarks/real-world/run-real-world-benchmark.ts',
    summaryArtifactCommand: 'node --import tsx benchmarks/real-world/generate-corpus-summary.ts',
    totalRepositories: REPOS.length,
    primaryFrameworkRepoCount,
    totalFilesDiscovered,
    totalFilesAnalyzed,
    totalParseErrorFiles,
    totalEngineCrashes,
    totalFindings,
  };

  fs.writeFileSync(path.join(rawDir, 'repository-manifest.json'), JSON.stringify(repositoryManifest, null, 2), 'utf-8');
  fs.writeFileSync(path.join(rawDir, 'framework-distribution.json'), JSON.stringify({ generatedAt: new Date().toISOString(), byPrimaryFrameworkLabel: frameworkDistribution, primaryFrameworkRepoCount, totalRepositories: REPOS.length }, null, 2), 'utf-8');
  fs.writeFileSync(path.join(rawDir, 'domain-summary.json'), JSON.stringify(domainSummary, null, 2), 'utf-8');
  fs.writeFileSync(path.join(rawDir, 'rule-frequency-summary.json'), JSON.stringify(ruleFrequencySummary, null, 2), 'utf-8');
  fs.writeFileSync(path.join(rawDir, 'reproducibility-metadata.json'), JSON.stringify(reproducibilityMetadata, null, 2), 'utf-8');

  console.log('=======================================================');
  console.log(' Corpus summary artifacts written to benchmarks/real-world/raw-results/:');
  console.log('   repository-manifest.json');
  console.log('   framework-distribution.json');
  console.log('   domain-summary.json');
  console.log('   rule-frequency-summary.json');
  console.log('   reproducibility-metadata.json');
  console.log('=======================================================');
  console.log(`Total repositories: ${REPOS.length} (primary-framework: ${primaryFrameworkRepoCount})`);
  console.log(`Framework distribution: ${JSON.stringify(frameworkDistribution)}`);
  console.log(`Files discovered: ${totalFilesDiscovered}, analyzed: ${totalFilesAnalyzed}, parse-error files: ${totalParseErrorFiles}, engine crashes: ${totalEngineCrashes}`);
  console.log(`Total findings: ${totalFindings}, distinct rules triggered: ${distinctRulesTriggered}`);
  console.log(`Domain split: ${JSON.stringify(domainCounts)}`);
}

main();
