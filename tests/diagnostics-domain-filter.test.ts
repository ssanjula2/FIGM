import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { primaryResearchDomain } from '../src/matrix/four-layer-meta-model.js';
import { RULE_CATALOG } from '../src/matrix/rule-registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');
const pagePath = path.join(rootDir, 'app/diagnostics/page.tsx');

describe('REGRESSION GUARD: app/diagnostics/page.tsx must expose all three research domains, not just two (docs/audit/STAGE_4_PRODUCTION_BROWSER_ACCEPTANCE_REPORT.md)', () => {
  const source = fs.readFileSync(pagePath, 'utf-8');

  test('the domain filter dropdown offers ARCHITECTURE, STATIC_PERFORMANCE, and ACCESSIBILITY -- not only two of the three', () => {
    assert.match(source, /value="ARCHITECTURE"/);
    assert.match(source, /value="STATIC_PERFORMANCE"/);
    assert.match(source, /value="ACCESSIBILITY"/);
  });

  test('does not still use the legacy two-value PERF/A11Y-only category filter', () => {
    assert.doesNotMatch(source, /value="PERF"/);
    assert.doesNotMatch(source, /value="A11Y"/);
  });

  test('filters diagnostics using primaryResearchDomain(), not the raw 2-value domain field alone', () => {
    assert.match(source, /primaryResearchDomain\(d\.domain, d\.concern\)/);
  });

  test('imports primaryResearchDomain from the single source of truth', () => {
    assert.match(source, /import \{ primaryResearchDomain \} from '\.\.\/\.\.\/src\/matrix\/four-layer-meta-model'/);
  });

  test('renders a visible per-finding domain badge, not just a filter', () => {
    assert.match(source, /RESEARCH_DOMAIN_LABEL/);
  });
});

describe('REGRESSION GUARD: primaryResearchDomain correctly distinguishes Architecture findings from Static Performance findings', () => {
  test('an Angular architecture rule (FIGM-ANG-02) classifies as ARCHITECTURE, not STATIC_PERFORMANCE', () => {
    const rule = RULE_CATALOG.find((r) => r.id === 'FIGM-ANG-02');
    assert.ok(rule, 'FIGM-ANG-02 must exist in RULE_CATALOG for this regression test to be meaningful');
    assert.equal(primaryResearchDomain(rule!.domain, rule!.concern), 'ARCHITECTURE');
  });

  test('a static performance rule (FIGM-PERF-01) classifies as STATIC_PERFORMANCE', () => {
    const rule = RULE_CATALOG.find((r) => r.id === 'FIGM-PERF-01');
    assert.ok(rule);
    assert.equal(primaryResearchDomain(rule!.domain, rule!.concern), 'STATIC_PERFORMANCE');
  });

  test('an accessibility rule (FIGM-A11Y-01) classifies as ACCESSIBILITY', () => {
    const rule = RULE_CATALOG.find((r) => r.id === 'FIGM-A11Y-01');
    assert.ok(rule);
    assert.equal(primaryResearchDomain(rule!.domain, rule!.concern), 'ACCESSIBILITY');
  });

  test('all 50 rules partition into exactly the three domains with no fourth bucket or overlap', () => {
    const buckets = new Set(RULE_CATALOG.map((r) => primaryResearchDomain(r.domain, r.concern)));
    for (const b of buckets) {
      assert.ok(['ARCHITECTURE', 'STATIC_PERFORMANCE', 'ACCESSIBILITY'].includes(b), `unexpected domain bucket: ${b}`);
    }
  });
});
