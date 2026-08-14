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
 */

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');
}

const CANONICAL_IDS = RULE_CATALOG.map((r) => r.id).sort();

test('canonical registry has exactly 25 unique rules', () => {
  assert.equal(RULE_CATALOG.length, 25);
  assert.equal(TOTAL_RULE_COUNT, 25);
  assert.equal(new Set(CANONICAL_IDS).size, 25, 'no duplicate rule IDs in RULE_CATALOG');
  assert.equal(FOUR_LAYER_MAPPINGS.length, 25);
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
  assert.equal(dispatchedIds.size, 25, 'engine must dispatch exactly 25 distinct rule IDs');
  for (const id of CANONICAL_IDS) {
    assert.ok(dispatchedIds.has(id), `canonical rule ${id} is never dispatched by ASTDetectionEngine.evaluateNode`);
  }
  for (const id of dispatchedIds) {
    assert.ok(CANONICAL_IDS.includes(id), `engine dispatches ${id}, which does not exist in RULE_CATALOG`);
  }
});

test('canonical registry === generated figm-spec.json', () => {
  const spec = JSON.parse(read('figm-spec.json'));
  assert.equal(spec.meta.totalCoreRules, 25);
  assert.equal(spec.rules.length, 25);
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
  const vueRules = RULE_CATALOG.filter((r) => r.frameworks.includes('VUE_SFC'));
  assert.equal(vueRules.length, 12, 'exactly the 12 universal PERF/A11Y rules should apply to Vue (no Vue-exclusive rules exist)');
  assert.ok(vueRules.every((r) => r.isFrameworkIndependent), 'every Vue-applicable rule must be framework-independent, since no rule targets Vue specifically');
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
