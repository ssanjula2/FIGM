import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULE_CATALOG } from '../src/matrix/rule-registry.js';
import { WCAG_22_MAPPINGS } from '../src/matrix/four-layer-meta-model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');
const pagePath = path.join(rootDir, 'app/accessibility/page.tsx');

describe('REGRESSION GUARD: app/accessibility/page.tsx must never present fabricated WCAG metrics (docs/audit/STAGE_4_PRODUCTION_BROWSER_ACCEPTANCE_REPORT.md)', () => {
  const fullSource = fs.readFileSync(pagePath, 'utf-8');
  // Strip the leading file-header doc comment before checking for fabricated-content patterns --
  // that comment intentionally documents (in prose, quoted) exactly what was removed, so it
  // legitimately contains the retired strings ("96.4%", "NVDA", etc.) as historical explanation,
  // not as live UI content. Only the code after the comment is checked against these patterns.
  const headerCommentEnd = fullSource.indexOf('*/');
  const source = headerCommentEnd >= 0 ? fullSource.slice(headerCommentEnd + 2) : fullSource;

  test('does not claim real assistive-technology testing (NVDA/JAWS) -- this project performs no runtime AT testing', () => {
    // The page may legitimately mention NVDA/JAWS to DISCLOSE that no such testing is performed
    // (e.g. "no NVDA/JAWS testing is performed") -- that is the honest, required disclosure. What
    // must never appear is a claim that such testing WAS performed.
    assert.doesNotMatch(source, /NVDA\s*&\s*JAWS\s*Tested/i);
    assert.doesNotMatch(source, /Screen Reader Parity/);
    if (/NVDA/.test(source)) {
      assert.match(source, /no NVDA\/?JAWS testing is performed/i, 'any NVDA mention must be part of the "not performed" disclosure, not a testing claim');
    }
  });

  test('does not claim a specific hardcoded WCAG conformance percentage', () => {
    assert.doesNotMatch(source, /96\.4%/);
    assert.doesNotMatch(source, /98\.2%/);
    assert.doesNotMatch(source, /Level AA Compliant/);
    assert.doesNotMatch(source, /Zero Focus Traps/);
  });

  test('does not contain a hand-typed ACCESSIBILITY_RULES array with hardcoded complianceRate/testedElementsCount fields', () => {
    assert.doesNotMatch(source, /complianceRate/);
    assert.doesNotMatch(source, /testedElementsCount/);
    assert.doesNotMatch(source, /const ACCESSIBILITY_RULES: AccessibilityRuleItem\[\]/);
  });

  test('sources its rule list from RULE_CATALOG, the same registry the detection engine reads', () => {
    assert.match(source, /from '\.\.\/\.\.\/src\/matrix\/rule-registry'/);
    assert.match(source, /RULE_CATALOG\.filter/);
  });

  test('sources WCAG mapping from WCAG_22_MAPPINGS, not a hand-typed duplicate', () => {
    assert.match(source, /WCAG_22_MAPPINGS/);
  });

  test('explicitly disclaims full WCAG 2.2 conformance in its own header text', () => {
    assert.match(source, /[Nn]ot a [Cc]onformance [Aa]udit|statically detectable subset/);
  });

  test('the "1-Click Fix Sandbox" (or its replacement) is labelled as illustrative, not a live pipeline run', () => {
    assert.doesNotMatch(source, /1-Click WCAG Fix Studio/);
    assert.match(source, /not a live (pipeline run|fix run)/i);
  });
});

describe('REGRESSION GUARD: real rule-to-WCAG mapping is consistent between the registry and its exported lookup', () => {
  const accessibilityRules = RULE_CATALOG.filter((r) => r.domain === 'ACCESSIBILITY');

  test('every real accessibility rule in RULE_CATALOG has a WCAG_22_MAPPINGS entry', () => {
    for (const rule of accessibilityRules) {
      assert.ok(WCAG_22_MAPPINGS[rule.id], `${rule.id} is missing a WCAG_22_MAPPINGS entry`);
    }
  });

  test('there are at least 6 real accessibility rules (the fabricated page previously showed exactly 6, coincidentally close to the real count -- this guards that the real count is read live, not assumed)', () => {
    assert.ok(accessibilityRules.length >= 6);
  });

  test('FIGM-A11Y-03 (a rule the fabricated page previously mislabelled as image alt-text) is really about ARIA live announcements, per the single source of truth', () => {
    const rule = accessibilityRules.find((r) => r.id === 'FIGM-A11Y-03');
    assert.ok(rule);
    assert.match(rule!.name, /Live Announcer|Dynamic Mutations/);
    assert.equal(WCAG_22_MAPPINGS['FIGM-A11Y-03'].clause, 'SC 4.1.3');
  });
});
