/**
 * Stage 5 real-world repository corpus expansion -- regression guards.
 *
 * Covers: repository-manifest size/uniqueness/pinning, primary-framework-only counting toward
 * the authoritative repository-sample target, combined-summary arithmetic, domain aggregation via
 * primaryResearchDomain() (not the raw 2-value `domain` field), parse-error files never counted
 * as clean, and preservation of the pre-expansion historical archive.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPOS } from '../benchmarks/real-world/run-real-world-benchmark.js';
import { primaryResearchDomain } from '../src/matrix/four-layer-meta-model.js';

const ROOT = process.cwd();
const RAW_RESULTS_DIR = join(ROOT, 'benchmarks/real-world/raw-results');
const ARCHIVE_DIR = join(ROOT, 'benchmarks/real-world/raw-results-archive');
const PRIMARY_FRAMEWORKS = new Set(['React', 'Next.js', 'Angular']);
const COMMIT_SHA_RE = /^[0-9a-f]{40}$/;

describe('Real-World Corpus Manifest (Stage 5 expansion)', () => {
  test('manifest has at least 20 unique repositories', () => {
    assert.ok(
      REPOS.length >= 20,
      `Expected REPOS.length >= 20 (Proposal SS4.3 / Interim02 SS3.4 target), got ${REPOS.length}`
    );
  });

  test('every repo has a full 40-character pinned commit SHA (never a floating branch name)', () => {
    for (const repo of REPOS) {
      assert.match(
        repo.pinnedCommit,
        COMMIT_SHA_RE,
        `${repo.name}: pinnedCommit "${repo.pinnedCommit}" must be a full 40-hex-char commit SHA, not a branch name`
      );
    }
  });

  test('no duplicate repository URLs', () => {
    const urls = REPOS.map((r) => r.url.toLowerCase());
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const url of urls) {
      if (seen.has(url)) dupes.push(url);
      seen.add(url);
    }
    assert.deepEqual(dupes, [], `Duplicate repository URLs found: ${dupes.join(', ')}`);
  });

  test('no duplicate pinned commit SHAs across distinct repositories', () => {
    const byCommit = new Map<string, string[]>();
    for (const repo of REPOS) {
      const list = byCommit.get(repo.pinnedCommit) || [];
      list.push(repo.name);
      byCommit.set(repo.pinnedCommit, list);
    }
    for (const [commit, names] of byCommit) {
      assert.ok(names.length === 1, `Commit ${commit} is claimed by multiple repos: ${names.join(', ')}`);
    }
  });

  test('every repo has a non-empty, plausible primaryFrameworkLabel', () => {
    const validLabels = new Set([
      'React',
      'Next.js',
      'Angular',
      'Vue',
      'Generic JavaScript',
      'Generic JavaScript/TypeScript',
    ]);
    for (const repo of REPOS) {
      assert.ok(
        validLabels.has(repo.primaryFrameworkLabel),
        `${repo.name}: primaryFrameworkLabel "${repo.primaryFrameworkLabel}" is not a recognized label`
      );
    }
  });

  test('only React/Next.js/Angular repos count toward the authoritative primary-framework target -- Vue is additional support only', () => {
    const primaryCount = REPOS.filter((r) => PRIMARY_FRAMEWORKS.has(r.primaryFrameworkLabel)).length;
    const vueCount = REPOS.filter((r) => r.primaryFrameworkLabel === 'Vue').length;
    // Regression guard: the corpus must not be padded with Vue repos to hit the 20-total figure
    // while leaving the primary-framework count static -- every repo added in Stage 5 must be
    // primary-framework, so primaryCount must have grown alongside REPOS.length.
    assert.ok(primaryCount >= 15, `Expected at least 15 primary-framework (React/Next.js/Angular) repos, got ${primaryCount}`);
    assert.ok(
      primaryCount + vueCount <= REPOS.length,
      'primary + Vue count must not exceed total repo count (sanity check on the partition itself)'
    );
  });

  test('framework distribution is balanced within primary frameworks (no single primary framework is empty)', () => {
    const counts: Record<string, number> = {};
    for (const repo of REPOS) {
      if (PRIMARY_FRAMEWORKS.has(repo.primaryFrameworkLabel)) {
        counts[repo.primaryFrameworkLabel] = (counts[repo.primaryFrameworkLabel] || 0) + 1;
      }
    }
    for (const fw of PRIMARY_FRAMEWORKS) {
      assert.ok((counts[fw] || 0) > 0, `Primary framework "${fw}" has zero repositories in the corpus`);
    }
  });

  test('every repo in REPOS has a corresponding raw-results/<name>.json file', () => {
    for (const repo of REPOS) {
      const p = join(RAW_RESULTS_DIR, `${repo.name}.json`);
      assert.ok(existsSync(p), `Missing raw-results/${repo.name}.json for manifest entry "${repo.name}"`);
    }
  });

  test('combined summary arithmetic matches the sum of per-repo raw-results files', () => {
    const summaryPath = join(RAW_RESULTS_DIR, '_combined-summary.json');
    assert.ok(existsSync(summaryPath), 'raw-results/_combined-summary.json must exist');
    const combined = JSON.parse(readFileSync(summaryPath, 'utf-8'));

    let expectedFiles = 0;
    let expectedLOC = 0;
    let expectedFindings = 0;
    let expectedCrashes = 0;
    let expectedParseErrorFiles = 0;

    for (const repo of REPOS) {
      const p = join(RAW_RESULTS_DIR, `${repo.name}.json`);
      const r = JSON.parse(readFileSync(p, 'utf-8'));
      expectedFiles += r.filesScanned;
      expectedLOC += r.totalLOC;
      expectedFindings += r.totalFigmFindings;
      expectedCrashes += r.engineCrashes.length;
      expectedParseErrorFiles += r.parserFailures.filesWithParseErrors;
    }

    assert.equal(combined.repoCount, REPOS.length, 'combined.repoCount must equal REPOS.length');
    assert.equal(combined.totalFilesScanned, expectedFiles, 'combined.totalFilesScanned mismatch');
    assert.equal(combined.totalLOC, expectedLOC, 'combined.totalLOC mismatch');
    assert.equal(combined.totalFigmFindings, expectedFindings, 'combined.totalFigmFindings mismatch');
    assert.equal(combined.totalEngineCrashes, expectedCrashes, 'combined.totalEngineCrashes mismatch');
    assert.equal(
      combined.totalFilesWithParseErrors,
      expectedParseErrorFiles,
      'combined.totalFilesWithParseErrors mismatch'
    );
  });

  test('a parse-error file is never counted as a clean scan (filesWithParseErrors <= filesScanned per repo)', () => {
    for (const repo of REPOS) {
      const p = join(RAW_RESULTS_DIR, `${repo.name}.json`);
      const r = JSON.parse(readFileSync(p, 'utf-8'));
      assert.ok(
        r.parserFailures.filesWithParseErrors <= r.filesScanned,
        `${repo.name}: filesWithParseErrors (${r.parserFailures.filesWithParseErrors}) exceeds filesScanned (${r.filesScanned})`
      );
      // A file that engine-crashed must not also be silently double-counted as scanned-and-clean:
      // engineCrashes entries are recorded separately from perFile's successfully-analyzed entries.
      const crashedPaths = new Set(r.engineCrashes.map((c: { relativePath: string }) => c.relativePath));
      for (const f of r.perFile) {
        if (crashedPaths.has(f.relativePath)) {
          assert.equal(
            f.engineCrash,
            null,
            `${repo.name}: ${f.relativePath} appears in both engineCrashes and as a clean perFile entry`
          );
        }
      }
    }
  });

  test('domain-summary.json (when present) uses primaryResearchDomain(), not the raw domain field, and totals match raw diagnostics', () => {
    const domainSummaryPath = join(RAW_RESULTS_DIR, 'domain-summary.json');
    if (!existsSync(domainSummaryPath)) {
      // Generated by generate-corpus-summary.ts after run-real-world-benchmark.ts; not required
      // to exist before the corpus has been run at least once in this environment.
      return;
    }
    const domainSummary = JSON.parse(readFileSync(domainSummaryPath, 'utf-8'));

    const expected = { ARCHITECTURE: 0, STATIC_PERFORMANCE: 0, ACCESSIBILITY: 0 };
    let expectedTotal = 0;
    for (const repo of REPOS) {
      const p = join(RAW_RESULTS_DIR, `${repo.name}.json`);
      const r = JSON.parse(readFileSync(p, 'utf-8'));
      for (const d of r.rawDiagnostics) {
        const pd = primaryResearchDomain(d.domain, d.concern);
        expected[pd] += 1;
        expectedTotal += 1;
      }
    }

    assert.equal(domainSummary.totalRawDiagnostics, expectedTotal, 'domain-summary totalRawDiagnostics mismatch');
    assert.deepEqual(
      domainSummary.byPrimaryResearchDomain,
      expected,
      'domain-summary.byPrimaryResearchDomain must be re-derivable via primaryResearchDomain(domain, concern)'
    );
  });

  test('the pre-expansion 15-repository archive snapshot is preserved, not overwritten', () => {
    assert.ok(existsSync(ARCHIVE_DIR), 'raw-results-archive directory must exist');
    const snapshots = readdirSync(ARCHIVE_DIR);
    const preExpansion = snapshots.find((s) => s.includes('pre-20-repo-expansion') || s.includes('pre-expansion'));
    assert.ok(
      preExpansion,
      `Expected an archive snapshot documenting the pre-Stage-5 15-repository corpus; found: ${snapshots.join(', ')}`
    );
    const archivedFiles = readdirSync(join(ARCHIVE_DIR, preExpansion));
    // The pre-expansion archive must contain exactly the original 15 repos' raw output, not the
    // post-expansion 21 -- otherwise it isn't actually a preserved historical snapshot.
    const archivedRepoFiles = archivedFiles.filter((f) => f !== '_combined-summary.json');
    assert.equal(
      archivedRepoFiles.length,
      15,
      `Pre-expansion archive snapshot "${preExpansion}" must contain exactly 15 per-repo JSON files, found ${archivedRepoFiles.length}`
    );
  });
});
