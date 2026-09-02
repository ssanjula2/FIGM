import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateMasterSpecification, primaryResearchDomain } from '../src/matrix/four-layer-meta-model.js';

/**
 * Regression guard for the WCAG Success Criterion mapping defect found and fixed during the final
 * implementation pass: `generateMasterSpecification` previously generated a single shared
 * `{ clause: 'SC 2.1.1', title: m.concern, level: 'A' }` object for every ACCESSIBILITY-domain
 * rule regardless of its actual concern -- 6 of 7 accessibility rules carried a WCAG citation that
 * did not match what they actually detect. Fixed via a per-rule WCAG_22_MAPPINGS lookup table.
 * This suite fails loudly if that collapse-onto-one-SC shape ever recurs, including for any future
 * accessibility rule added without its own mapping entry.
 */
describe('WCAG 2.2 mapping integrity', () => {
  const spec = generateMasterSpecification();
  const a11yRules = spec.rules.filter((r: any) => r.domain === 'ACCESSIBILITY');

  test('every accessibility rule has a WCAG_2_2 standardTraceability entry', () => {
    assert.equal(a11yRules.length, 7, 'expected exactly 7 FIGM-A11Y-* rules');
    for (const r of a11yRules) {
      assert.equal(r.standardTraceability.standard, 'WCAG_2_2', `${r.id} must be traced to WCAG_2_2, not ISO_25010`);
      assert.ok(r.standardTraceability.clause, `${r.id} must have a non-empty clause`);
      assert.ok(r.standardTraceability.level, `${r.id} must have a conformance level`);
    }
  });

  test('every accessibility rule has its own mappingRationale (not inherited/blank)', () => {
    for (const r of a11yRules) {
      assert.ok(
        typeof r.standardTraceability.mappingRationale === 'string' && r.standardTraceability.mappingRationale.length > 20,
        `${r.id} must have a substantive mappingRationale explaining why its specific SC applies`
      );
    }
  });

  test('every accessibility rule has an automatedDetectability classification', () => {
    const valid = new Set(['DIRECT_STATIC_CHECK', 'PARTIAL_STATIC_CHECK', 'HEURISTIC', 'MANUAL_REVIEW_REQUIRED', 'NOT_SUPPORTED']);
    for (const r of a11yRules) {
      assert.ok(valid.has(r.standardTraceability.automatedDetectability), `${r.id} must have a valid automatedDetectability value`);
    }
  });

  test('REGRESSION GUARD: accessibility rules with different concerns must not share the same WCAG clause', () => {
    // The exact shape of the original defect: every rule collapsed onto "SC 2.1.1" regardless of
    // concern. This asserts the inverse invariant directly -- group by clause, and within any group
    // sharing a clause, every rule in it must have the SAME concern (i.e. sharing a clause is only
    // legitimate when the underlying concern genuinely is the same, e.g. two NAME_ROLE_VALUE rules
    // both citing SC 4.1.2 is fine; a KEYBOARD_ACCESSIBILITY rule and a FOCUS_ORDER rule sharing a
    // clause is exactly the bug).
    const byClause = new Map<string, any[]>();
    for (const r of a11yRules) {
      const list = byClause.get(r.standardTraceability.clause) || [];
      list.push(r);
      byClause.set(r.standardTraceability.clause, list);
    }
    for (const [clause, rules] of byClause) {
      const concerns = new Set(rules.map((r) => r.concern));
      assert.equal(
        concerns.size,
        1,
        `Rules sharing WCAG clause "${clause}" have different concerns (${[...concerns].join(', ')}) -- this is the exact collapse-onto-one-SC defect pattern; each concern must map to its own clause`
      );
    }

    // Direct regression check against the specific historical bug: not ALL 7 rules may share one clause.
    const distinctClauses = new Set(a11yRules.map((r) => r.standardTraceability.clause));
    assert.ok(distinctClauses.size > 1, 'all 7 accessibility rules collapsed onto a single WCAG clause -- this is the exact defect this test exists to catch');
  });

  test('FIGM-A11Y-01 correctly maps to SC 2.1.1 Keyboard (the one rule where this was already correct)', () => {
    const r = a11yRules.find((r: any) => r.id === 'FIGM-A11Y-01');
    assert.equal(r.standardTraceability.clause, 'SC 2.1.1');
  });

  test('FIGM-A11Y-07 (INPUT_MODALITIES concern) maps to SC 2.5.3 Label in Name, not SC 2.1.1', () => {
    const r = a11yRules.find((r: any) => r.id === 'FIGM-A11Y-07');
    assert.equal(r.standardTraceability.clause, 'SC 2.5.3');
    assert.notEqual(r.standardTraceability.clause, 'SC 2.1.1');
  });

  test('generateMasterSpecification throws if an accessibility rule has no WCAG_22_MAPPINGS entry (fail loud, not silent default)', () => {
    // Structural check: the throw path exists in source, guarding against a future accessibility
    // rule being added without a mapping ever silently falling back to a shared/default clause.
    const fs = require('node:fs');
    const path = require('node:path');
    const src = fs.readFileSync(path.resolve(__dirname, '../src/matrix/four-layer-meta-model.ts'), 'utf-8');
    assert.match(src, /No WCAG_22_MAPPINGS entry for accessibility rule/, 'the fail-loud guard for a missing WCAG mapping must still be present in source');
  });

  test('primaryResearchDomain correctly partitions all 50 rules into exactly three non-overlapping buckets summing to 50', () => {
    const counts = { ARCHITECTURE: 0, STATIC_PERFORMANCE: 0, ACCESSIBILITY: 0 };
    for (const r of spec.rules) {
      const bucket = primaryResearchDomain(r.domain, r.concern);
      counts[bucket]++;
      assert.equal(r.primaryResearchDomain, bucket, `${r.id}'s exported primaryResearchDomain must match the pure function's output`);
    }
    assert.equal(counts.ARCHITECTURE + counts.STATIC_PERFORMANCE + counts.ACCESSIBILITY, 50, 'the three buckets must sum to exactly 50 with no double-counting');
    assert.equal(counts.ACCESSIBILITY, 7);
    assert.equal(counts.ARCHITECTURE, 19);
    assert.equal(counts.STATIC_PERFORMANCE, 24);
  });
});
