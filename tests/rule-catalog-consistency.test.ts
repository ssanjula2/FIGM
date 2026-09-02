import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { RULE_CATALOG, TOTAL_RULE_COUNT, SUPPORTED_FRAMEWORKS } from '../src/matrix/rule-registry.js';
import { FOUR_LAYER_MAPPINGS } from '../src/matrix/four-layer-meta-model.js';

/**
 * Rule catalog cross-surface consistency guard.
 *
 * Forensic audit found: engine has 25 real rules, app/guidelines/page.tsx rendered only 23
 * (missing FIGM-A11Y-03/04 and any Vue framework representation), figm-spec.json had only 8, and
 * several landing pages stated a stale "23" count. Root cause was every surface hand-maintaining
 * its own copy of the rule list. The fix was a single canonical registry
 * (src/matrix/rule-registry.ts, itself derived from src/matrix/four-layer-meta-model.ts's
 * FOUR_LAYER_MAPPINGS -- the same data ASTDetectionEngine reads at scan time) that every consumer
 * now imports from. This test asserts the "===" chain the task required directly:
 * canonical registry === live engine dispatch === generated figm-spec.json === guidelines UI
 * source, so a future edit that reintroduces a hand-maintained duplicate fails loudly here instead
 * of silently drifting.
 *
 * The baseline was 25 rules; a research-backed expansion pass (FIGM-A11Y-07, FIGM-REACT-05/06,
 * FIGM-NEXT-05/06, FIGM-ANG-06, FIGM-VUE-01/02 -- see docs/research/EXPANSION_RESEARCH_TRACEABILITY.md)
 * deliberately grew the canonical count to 33, then a second pass to 50, through the exact same single-source-of-truth
 * pipeline this test enforces -- the hardcoded counts below were updated to match that new,
 * intentional baseline, not loosened to let something slip through undetected.
 */

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');
}

const CANONICAL_IDS = RULE_CATALOG.map((r) => r.id).sort();
const CANONICAL_RULE_COUNT = 50;

test('canonical registry has exactly 50 unique rules', () => {
  assert.equal(RULE_CATALOG.length, CANONICAL_RULE_COUNT);
  assert.equal(TOTAL_RULE_COUNT, CANONICAL_RULE_COUNT);
  assert.equal(new Set(CANONICAL_IDS).size, CANONICAL_RULE_COUNT, 'no duplicate rule IDs in RULE_CATALOG');
  assert.equal(FOUR_LAYER_MAPPINGS.length, CANONICAL_RULE_COUNT);
});

test('canonical registry === live engine dispatch (ast-detection-engine.ts)', () => {
  // Source-level guard: every rule ID the engine's evaluateNode() actually dispatches via
  // this.createReport('FIGM-...', ...) must exist in the canonical registry, and every canonical
  // rule ID must appear in the engine's dispatch list -- a rule the UI can display but the engine
  // never emits (or vice versa) is exactly the class of bug this test exists to catch.
  const engineSrc = read('src/ast/ast-detection-engine.ts');
  const dispatchedIds = new Set(
    [...engineSrc.matchAll(/this\.createReport\('(FIGM-[A-Z0-9-]+)'/g)].map((m) => m[1])
  );
  assert.equal(dispatchedIds.size, CANONICAL_RULE_COUNT, `engine must dispatch exactly ${CANONICAL_RULE_COUNT} distinct rule IDs`);
  for (const id of CANONICAL_IDS) {
    assert.ok(dispatchedIds.has(id), `canonical rule ${id} is never dispatched by ASTDetectionEngine.evaluateNode`);
  }
  for (const id of dispatchedIds) {
    assert.ok(CANONICAL_IDS.includes(id), `engine dispatches ${id}, which does not exist in RULE_CATALOG`);
  }
});

test('canonical registry === generated figm-spec.json', () => {
  const spec = JSON.parse(read('figm-spec.json'));
  assert.equal(spec.meta.totalCoreRules, CANONICAL_RULE_COUNT);
  assert.equal(spec.rules.length, CANONICAL_RULE_COUNT);
  const specIds = spec.rules.map((r: { id: string }) => r.id).sort();
  assert.deepEqual(specIds, CANONICAL_IDS, 'figm-spec.json rule IDs must exactly match RULE_CATALOG (run `npm run generate-spec` if this fails)');

  // Every field the guidelines UI and API rely on must actually be present in the generated spec,
  // not just the rule ID -- otherwise the generator itself has silently dropped metadata.
  for (const r of spec.rules) {
    assert.ok(Array.isArray(r.frameworks) && r.frameworks.length > 0, `${r.id} missing frameworks[] in figm-spec.json`);
    assert.ok(typeof r.isFrameworkIndependent === 'boolean', `${r.id} missing isFrameworkIndependent in figm-spec.json`);
    assert.ok(typeof r.remediationStatus === 'string' && r.remediationStatus.length > 0, `${r.id} missing remediationStatus in figm-spec.json`);
    assert.ok(typeof r.knownLimitation === 'string' && r.knownLimitation.length > 0, `${r.id} missing knownLimitation in figm-spec.json`);
    assert.ok(typeof r.category === 'string' && r.category.length > 0, `${r.id} missing category in figm-spec.json`);
  }
});

test('canonical registry === app/guidelines/page.tsx (source imports it, no hardcoded duplicate list)', () => {
  const pageSrc = read('app/guidelines/page.tsx');
  assert.ok(
    /from ['"]\.\.\/\.\.\/src\/matrix\/rule-registry['"]/.test(pageSrc),
    'guidelines page must import RULE_CATALOG from the canonical registry, not hand-maintain its own rule list'
  );
  assert.equal(
    (pageSrc.match(/^const CORE_GUIDELINES/m) || []).length,
    0,
    'the old hand-maintained CORE_GUIDELINES array must not be reintroduced'
  );

  // The page's supplementary teaching-content map (RULE_UI_CONTENT) is hand-authored (it has no
  // engine equivalent), but it must cover every canonical rule exactly once -- this is what
  // structurally prevents a repeat of the FIGM-A11Y-03/04 omission.
  const uiContentIds = [...pageSrc.matchAll(/'(FIGM-[A-Z0-9-]+)':\s*\{/g)].map((m) => m[1]).sort();
  assert.deepEqual(uiContentIds, CANONICAL_IDS, 'RULE_UI_CONTENT in app/guidelines/page.tsx must have exactly one entry per canonical rule');
});

test('canonical registry === app/api/search/route.ts rule metadata source', () => {
  const routeSrc = read('app/api/search/route.ts');
  assert.ok(
    /from ['"]\.\.\/\.\.\/\.\.\/src\/matrix\/rule-registry['"]/.test(routeSrc),
    'the search API must source rule metadata from the canonical registry, not a hand-maintained duplicate'
  );
});

test('every rule is applicable to at least one framework, and Vue is representable', () => {
  for (const r of RULE_CATALOG) {
    assert.ok(r.frameworks.length > 0, `${r.id} has an empty frameworks[] -- every rule must be applicable somewhere`);
  }
  // 12 universal PERF/A11Y rules (framework-independent) + FIGM-VUE-01/02 (LEGACY_TEXT_HEURISTIC,
  // first expansion pass) + FIGM-VUE-03/04/05/06 (REAL_AST via <script>-block extraction, second
  // expansion pass) -- all 6 are Vue-exclusive, so Vue is no longer covered ONLY by the
  // framework-independent set.
  const vueRules = RULE_CATALOG.filter((r) => r.frameworks.includes('VUE_SFC'));
  assert.equal(vueRules.length, 18, '12 universal PERF/A11Y rules + FIGM-VUE-01..06 should apply to Vue');
  const vueExclusiveIds = vueRules.filter((r) => !r.isFrameworkIndependent).map((r) => r.id).sort();
  assert.deepEqual(
    vueExclusiveIds,
    ['FIGM-VUE-01', 'FIGM-VUE-02', 'FIGM-VUE-03', 'FIGM-VUE-04', 'FIGM-VUE-05', 'FIGM-VUE-06'],
    'only FIGM-VUE-01..06 should be Vue-applicable-but-not-framework-independent'
  );
});

test('isFrameworkIndependent is never true for a framework-gated rule (requirement: do not mislabel framework-specific rules)', () => {
  for (const r of RULE_CATALOG) {
    if (r.isFrameworkIndependent) {
      // A genuinely framework-independent rule must apply to every supported framework --
      // otherwise it is, by definition, gated to a subset and mislabeled.
      for (const fw of SUPPORTED_FRAMEWORKS) {
        assert.ok(r.frameworks.includes(fw), `${r.id} is labeled framework-independent but does not apply to ${fw}`);
      }
    } else {
      // A rule NOT labeled framework-independent must actually be restricted to a proper subset.
      assert.ok(
        r.frameworks.length < SUPPORTED_FRAMEWORKS.length,
        `${r.id} applies to every supported framework but is not labeled framework-independent`
      );
    }
  }
  // Cross-check against the category derivation: NEXT/REACT/ANGULAR-categorized rules must never
  // be framework-independent; only COMMON-categorized rules may be.
  for (const r of RULE_CATALOG) {
    if (r.category !== 'COMMON') {
      assert.equal(r.isFrameworkIndependent, false, `${r.id} is categorized ${r.category} but marked framework-independent`);
    }
  }
});

test('every rule has a non-empty remediationStatus and knownLimitation (requirement: display remediation status + limitations)', () => {
  const validStatuses = new Set(['AUTOMATED_FIX_VERIFIED', 'AUTOMATED_FIX_WITH_CAVEAT', 'MANUAL_REVIEW_REQUIRED']);
  for (const r of RULE_CATALOG) {
    assert.ok(validStatuses.has(r.remediationStatus), `${r.id} has an invalid remediationStatus: ${r.remediationStatus}`);
    assert.ok(r.knownLimitation.length > 10, `${r.id} is missing a real knownLimitation description`);
    assert.ok(r.example.nonCompliant.length > 0 && r.example.compliant.length > 0, `${r.id} is missing a non-compliant/compliant example pair`);
  }
});

test('no surface claims a stale rule count (23 or 8) as the total', () => {
  const filesToCheck = [
    'app/guidelines/page.tsx',
    'app/components/landing/ResearchOverview.tsx',
    'app/components/landing/FeaturesGrid.tsx',
    'app/components/landing/HeroSection.tsx',
    'app/components/landing/BenchmarkSection.tsx',
    'app/components/landing/LandingFooter.tsx',
    'app/components/landing/ArchitecturePipeline.tsx',
    'app/components/dashboard/LiveDashboardContent.tsx',
    'src/docs/formal_predicates.md',
  ];
  for (const f of filesToCheck) {
    const src = read(f);
    assert.equal(/\b23\s+(rules|guidelines|Rules|Guidelines|Canonical Rules)\b/.test(src), false, `${f} still claims a stale "23 rules" count`);
    assert.equal(/\b8\s+core\s+FIGM\s+guidelines\b/i.test(src), false, `${f} still claims only "8 core FIGM guidelines" as the total`);
  }
});
