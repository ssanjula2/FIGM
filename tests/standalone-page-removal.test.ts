import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

/**
 * Regression coverage for the Stage 7B UI-cleanup pass: the standalone /security ("Tenant
 * Security") and /ai-fix ("AI Fix Assistant") pages were removed as low-value demo-style pages
 * that either exposed internal security implementation detail to normal users (/security) or
 * duplicated remediation outside its real context, a scanned finding (/ai-fix -- it ran a fixed
 * hardcoded sample defect, not a real user's code). Only the presentation surface is gone: the
 * underlying tenant isolation, JWT guards, password hashing, deterministic/AI remediation engine,
 * and the fix -> validate -> re-scan flow inside Live Scan are all untouched and covered by their
 * own existing test suites (tests/auth-isolation.test.ts, tests/idor-closure-regressions.test.ts,
 * tests/security-remediation.test.ts, tests/ast-fix-engine.test.ts,
 * tests/remediation-engine-regressions.test.ts, tests/live-scan-e2e.test.ts,
 * tests/scan-fix-fingerprint-rate-limit.test.ts) -- this file only guards the removal itself.
 */

test('the standalone /security and /ai-fix page files no longer exist', () => {
  assert.equal(fs.existsSync(path.join(rootDir, 'app/security/page.tsx')), false, 'app/security/page.tsx must stay removed');
  assert.equal(fs.existsSync(path.join(rootDir, 'app/security')), false, 'the now-empty app/security directory must not be left behind');
  assert.equal(fs.existsSync(path.join(rootDir, 'app/ai-fix/page.tsx')), false, 'app/ai-fix/page.tsx must stay removed');
  assert.equal(fs.existsSync(path.join(rootDir, 'app/ai-fix')), false, 'the now-empty app/ai-fix directory must not be left behind');
});

test('the main Sidebar no longer links to or labels "AI Fix Assistant" or "Tenant Security"', () => {
  const src = fs.readFileSync(path.join(rootDir, 'app/Sidebar.tsx'), 'utf-8');
  assert.doesNotMatch(src, /href:\s*'\/ai-fix'/, 'Sidebar must not link to the removed /ai-fix page');
  assert.doesNotMatch(src, /href:\s*'\/security'/, 'Sidebar must not link to the removed /security page');
  assert.doesNotMatch(src, /AI Fix Assistant/);
  assert.doesNotMatch(src, /Tenant Security/);
});

test('the AdminSidebar does not link to the removed /ai-fix or /security pages either', () => {
  const src = fs.readFileSync(path.join(rootDir, 'app/AdminSidebar.tsx'), 'utf-8');
  assert.doesNotMatch(src, /href:?\s*['"]\/ai-fix['"]/);
  assert.doesNotMatch(src, /href:?\s*['"]\/security['"]/);
});

test('no remaining Link/href in app/ points at the removed /ai-fix or /security routes (no dead internal links)', () => {
  const appDir = path.join(rootDir, 'app');
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
        const content = fs.readFileSync(full, 'utf-8');
        // Matches both `href="/ai-fix"` (JSX) and `href: '/ai-fix'` (nav-item object literals),
        // single or double quoted, with an exact route boundary so `/ai-fix-history` or similar
        // would not false-positive.
        if (/href=["']\/ai-fix["']/.test(content) || /href:\s*['"]\/ai-fix['"]/.test(content)) offenders.push(`${path.relative(rootDir, full)} -> /ai-fix`);
        if (/href=["']\/security["']/.test(content) || /href:\s*['"]\/security['"]/.test(content)) offenders.push(`${path.relative(rootDir, full)} -> /security`);
      }
    }
  };
  walk(appDir);
  assert.deepEqual(offenders, [], `Found dead internal link(s) to a removed page: ${offenders.join(', ')}`);
});

test('the landing footer no longer dead-links to the removed /ai-fix demo page, and AI-assisted remediation stays reachable through the real Live Scan flow', () => {
  // Stage 7C Section 10 rewrote the footer's Product column down to Live Scan + Guidelines,
  // and Section 11 deliberately reduced standalone AI-provider-branded marketing callouts (the
  // old "Claude AI Remediation" link text was one of those). The capability itself is not gone --
  // AI-assisted remediation runs inside the real Live Scan flow -- so this test now asserts the
  // thing that actually matters: no dead link to the removed page, and a live entry point exists.
  const src = fs.readFileSync(path.join(rootDir, 'app/components/landing/LandingFooter.tsx'), 'utf-8');
  assert.doesNotMatch(src, /href="\/ai-fix"/, 'footer must not link to the removed /ai-fix demo page');
  assert.match(src, /href="\/live-scan"/, 'footer must still link to the real Live Scan flow, where AI-assisted remediation actually runs');
});
