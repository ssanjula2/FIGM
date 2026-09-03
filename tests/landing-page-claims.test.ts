import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDomainCounts } from '../src/matrix/domain-counts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');
const landingDir = path.join(rootDir, 'app/components/landing');

function read(rel: string): string {
  return fs.readFileSync(path.join(rootDir, rel), 'utf-8');
}

/** Regression coverage for the Stage 7C landing-page redesign (Sections 2-10, 25). */

test('HeroSection uses the specified defensible copy, not a marketing-slogan headline', () => {
  const src = read('app/components/landing/HeroSection.tsx');
  assert.match(src, /Framework-independent code quality analysis for modern SPAs/);
  assert.match(src, /architecture, static performance, and accessibility risks/);
  assert.doesNotMatch(src, /100% accurate/i);
  assert.doesNotMatch(src, /industry-leading/i);
  assert.doesNotMatch(src, /revolutionary/i);
  assert.doesNotMatch(src, /guaranteed/i);
});

test('Landing CTAs route to real, existing app pages -- never a placeholder href', () => {
  const src = read('app/components/landing/HeroSection.tsx');
  for (const href of ['/live-scan', '/guidelines']) {
    assert.match(src, new RegExp(`href="${href.replace('/', '\\/')}"`), `hero must link to the real route ${href}`);
  }
  assert.doesNotMatch(src, /href="#"/, 'no placeholder href="#" link');
});

test('LandingHeader only links to real anchors/routes, has Sign In and Get Started CTAs, and a working mobile nav toggle', () => {
  const src = read('app/components/landing/LandingHeader.tsx');
  assert.doesNotMatch(src, /href="#"[^a-zA-Z]/, 'no placeholder href="#" link');
  assert.match(src, /Sign In/);
  assert.match(src, /Get Started/);
  assert.match(src, /aria-expanded=\{mobileOpen\}/, 'mobile nav toggle must be a real, accessible expand/collapse control');
});

test('every LandingHeader anchor target actually exists in the composed /about page', () => {
  const headerSrc = read('app/components/landing/LandingHeader.tsx');
  const anchorHrefs = [...headerSrc.matchAll(/href:\s*'#([a-z0-9-]+)'/g)].map((m) => m[1]);
  assert.ok(anchorHrefs.length > 0, 'sanity: the header declares at least one anchor link');

  // Resolve the actual set of components /about composes FROM ITS OWN IMPORTS, rather than a
  // hand-maintained file list here that can silently go stale the moment /about's composition
  // changes (exactly what happened when ResearchOverview.tsx moved off /about to /methodology in
  // the Stage 7C visual-polish pass -- this test would have kept "passing" against a file that no
  // longer renders on the page at all).
  const aboutPageSrc = read('app/about/page.tsx');
  const importedComponentFiles = [...aboutPageSrc.matchAll(/from '\.\.\/components\/landing\/([A-Za-z0-9]+)'/g)]
    .map((m) => `app/components/landing/${m[1]}.tsx`);
  assert.ok(importedComponentFiles.length > 0, 'sanity: /about imports at least one landing component');

  const sectionFiles = importedComponentFiles.map((f) => read(f)).join('\n');

  for (const anchor of anchorHrefs) {
    assert.match(sectionFiles, new RegExp(`id="${anchor}"`), `header links to #${anchor} but no component actually composed into /about declares id="${anchor}"`);
  }
});

test('FeaturesGrid (Three Core Domains) derives rule counts from the real registry, never a hardcoded number', () => {
  const src = read('app/components/landing/FeaturesGrid.tsx');
  assert.match(src, /getDomainCounts/);
  assert.doesNotMatch(src, /count:\s*19/, 'must not hardcode the Architecture count');
  assert.doesNotMatch(src, /count:\s*24/, 'must not hardcode the Static Performance count');
  assert.doesNotMatch(src, /count:\s*7\b/, 'must not hardcode the Accessibility count');
});

test('the three core domains match primaryResearchDomain\'s real partition of all 50 rules', () => {
  const counts = getDomainCounts();
  assert.equal(counts.ARCHITECTURE + counts.STATIC_PERFORMANCE + counts.ACCESSIBILITY, 50);
  assert.ok(counts.ARCHITECTURE > 0 && counts.STATIC_PERFORMANCE > 0 && counts.ACCESSIBILITY > 0);
});

test('FrameworkScope presents React/Next.js/Angular as primary and Vue as additional support only -- never as an equal primary framework', () => {
  const src = read('app/components/landing/FrameworkScope.tsx');
  assert.match(src, /Primary Framework Scope/);
  assert.match(src, /React/);
  assert.match(src, /Next\.js/);
  assert.match(src, /Angular/);
  assert.match(src, /Additional Support/);
  assert.match(src, />\s*Vue\s*</, 'Vue must be labelled under Additional Support');
  // Vue must not appear inside the primary-scope array literal alongside the other three.
  const primaryArrayMatch = src.match(/\['React', 'Next\.js', 'Angular'\]/);
  assert.ok(primaryArrayMatch, 'the primary framework list must be exactly React/Next.js/Angular');
});

test('no landing component claims full WCAG conformance or an unearned WCAG AA compliance badge', () => {
  for (const file of fs.readdirSync(landingDir)) {
    const src = fs.readFileSync(path.join(landingDir, file), 'utf-8');
    assert.doesNotMatch(src, /WCAG\s*2\.2\s*AA\s*compliant/i, `${file} must not claim WCAG 2.2 AA compliance`);
    assert.doesNotMatch(src, /fully WCAG compliant/i, `${file} must not claim full WCAG compliance`);
  }
});

test('LandingFooter uses the exact Section 10 structure (Product / Research / Account) and the correct accessibility wording', () => {
  const src = read('app/components/landing/LandingFooter.tsx');
  assert.match(src, />Product</);
  assert.match(src, />Research</);
  assert.match(src, />Account</);
  assert.match(src, /Live Scan/);
  assert.match(src, /Guidelines/);
  assert.match(src, /Sign In/);
  assert.match(src, /Register/);
  assert.doesNotMatch(src, /WCAG 2\.2 AA accessibility principles/i, 'the old, less precise wording must be gone');
  assert.doesNotMatch(src, />Admin Panel</, 'the public footer must not advertise the admin panel to unauthenticated visitors');
});

test('REGRESSION (Stage 7C visual polish): the footer no longer carries certification-sounding badges (ISO/WCAG), which the accessibility domain card already states honestly without implying certification', () => {
  const src = read('app/components/landing/LandingFooter.tsx');
  assert.doesNotMatch(src, /ISO\/IEC 25010-aligned/, 'the certification-sounding ISO badge must be removed from the footer');
  assert.doesNotMatch(src, /WCAG 2\.2-aligned static checks/, 'the certification-sounding WCAG badge must be removed from the footer');
});

test('REGRESSION (Stage 7C visual polish): the footer\'s Methodology link routes to the real /methodology page, not a same-page anchor that no longer resolves once the full methodology content moved off /about', () => {
  const src = read('app/components/landing/LandingFooter.tsx');
  assert.match(src, /href="\/methodology"/, 'footer Methodology link must point to the real /methodology route');
  assert.doesNotMatch(src, /href="#methodology"/, 'footer must not link to an in-page anchor for content that no longer lives on the same page');
});

test('BenchmarkSection never presents the controlled/self-authored benchmark as "real-world" accuracy, and explicitly names it as controlled', () => {
  const src = read('app/components/landing/BenchmarkSection.tsx');
  assert.doesNotMatch(src, /Real-World Benchmark Performance/, 'the old misleading title must be gone');
  assert.match(src, /controlled benchmark/i);
  assert.match(src, /not an independent real-world accuracy measurement/i);
  assert.doesNotMatch(src, />Empirical F1-Score</, 'the F1 stat must not be labelled as generically "empirical" without the controlled-benchmark qualifier');
});

test('the guidelines page no longer labels a static font-loading rule with a real Web Vital name (CLS)', () => {
  const src = read('app/guidelines/page.tsx');
  assert.doesNotMatch(src, /Zero-CLS/i, 'a static rule must never be labelled with a real Web Vital acronym (CLS) as if it measures/guarantees it');
});

test('REGRESSION (Stage 7C visual polish, Section 2/10): the public landing page (/about) no longer imports the full academic References section, DSRM methodology write-up, or benchmark methodology block -- product, not dissertation', () => {
  const aboutSrc = read('app/about/page.tsx');
  assert.doesNotMatch(aboutSrc, /ReferencesSection/, '/about must not import the References/bibliography section directly');
  assert.doesNotMatch(aboutSrc, /ResearchOverview/, '/about must not import the full DSRM methodology write-up directly');
  assert.doesNotMatch(aboutSrc, /BenchmarkSection/, '/about must not import the full benchmark methodology write-up directly');
});

test('REGRESSION (Stage 7C visual polish): the academic reference list is preserved, not deleted -- it moved to the authenticated /references page and the full methodology moved to the public /methodology page, both still real routes', () => {
  const referencesPageSrc = read('app/references/page.tsx');
  assert.match(referencesPageSrc, /ReferencesSection/, '/references must still render the real, unmodified References component');

  const methodologyPageSrc = read('app/methodology/page.tsx');
  assert.match(methodologyPageSrc, /ResearchOverview/, '/methodology must render the real DSRM methodology content');
  assert.match(methodologyPageSrc, /BenchmarkSection/, '/methodology must render the real benchmark methodology content');
});

test('the public landing page\'s compact research-credibility section names a real, verifiable corpus size (21 open-source repositories), not an accuracy claim derived from that corpus', () => {
  const src = read('app/components/landing/ResearchCredibility.tsx');
  assert.match(src, /21 open-source repositories evaluated/);
  // The real-world corpus has no exhaustive ground truth (benchmarks/real-world/SUMMARY.md) -- this
  // section must state corpus size only, never a precision/recall/F1 percentage for it.
  assert.doesNotMatch(src, /precision|recall|f1|accuracy/i, 'the compact credibility section must not claim an accuracy figure for the real-world corpus');
  assert.match(src, /href="\/methodology"/, 'must link to the real methodology page');
});
