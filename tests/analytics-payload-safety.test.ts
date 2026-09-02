import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

/**
 * Regression guard for the GA4 event-schema privacy requirement: analytics events must never be
 * able to carry source code, uploaded code, patch content, email, name, password, JWT, cookie, or
 * API key values -- see src/lib/analytics.ts's module doc comment and
 * research/audits/FIGM_PRE_DATA_COLLECTION_AUDIT.md Section 13/21.
 *
 * The design that makes this enforceable by static inspection: every exported tracking function
 * has an explicit, closed, named-fields parameter type (never `Record<string, any>` or a spread),
 * and the internal `send()` helper is the only thing that ever calls `window.gtag('event', ...)`.
 * So it is sufficient to verify (a) no forbidden field name appears anywhere in the file, and (b)
 * every exported tracking function's parameter object type is a closed literal, not an open/
 * indexed type that could accept arbitrary keys.
 */
describe('GA4 analytics payload safety', () => {
  const analyticsSrc = fs.readFileSync(path.join(rootDir, 'src/lib/analytics.ts'), 'utf-8');

  // Strips /* */ block comments and // line comments before the forbidden-field scan below --
  // the module's own doc comments legitimately NAME these forbidden fields in prose (explaining
  // what must never be sent), which would otherwise false-positive this exact guard. Code, not
  // documentation, is what could actually leak a field.
  function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  }
  const analyticsCodeOnly = stripComments(analyticsSrc);

  test('src/lib/analytics.ts never references a forbidden PII/code/secret field name in actual code', () => {
    const forbiddenFieldNames = [
      'sourceCode',
      'codeContent',
      'patchContent',
      'email',
      'fullName',
      'password',
      'jwt',
      'cookie',
      'apiKey',
      'accessToken',
      'refreshToken',
    ];
    // Deliberately excludes the bare word `code` -- too broad (matches `code_2026`/import
    // statements/etc.) -- the more specific `sourceCode`/`codeContent`/`patchContent` names above
    // are what the rest of this codebase actually calls those fields (see
    // app/api/user-study/log-scan/route.ts's `code` request-body field and
    // app/user-study/page.tsx's `benchmark.code`), so those are the strings a leak would contain.
    for (const field of forbiddenFieldNames) {
      const pattern = new RegExp(field, 'i');
      assert.equal(pattern.test(analyticsCodeOnly), false, `src/lib/analytics.ts must never reference a "${field}"-named field outside of documentation comments`);
    }
  });

  test('every exported track* function has a closed, explicit parameter type (no Record<string,*>/[key: string] escape hatch)', () => {
    const trackFnMatches = [...analyticsSrc.matchAll(/export function (track\w+)\(([^)]*)\)/g)];
    assert.ok(trackFnMatches.length >= 6, 'expected at least 6 exported track* functions');

    for (const match of trackFnMatches) {
      const [, fnName, paramsSignature] = match;
      assert.equal(
        /Record<string,/.test(paramsSignature),
        false,
        `${fnName}'s parameter type must not be an open Record<string, ...> type -- it must list explicit named fields`
      );
      assert.equal(
        /\[key:\s*string\]/.test(paramsSignature),
        false,
        `${fnName}'s parameter type must not have a [key: string] index signature -- it must list explicit named fields`
      );
    }
  });

  test('the internal send() helper is the only call site of window.gtag(\'event\', ...)', () => {
    const eventCallSites = [...analyticsSrc.matchAll(/gtag\(\s*['"]event['"]/g)];
    assert.equal(eventCallSites.length, 1, 'window.gtag(\'event\', ...) must be called from exactly one place (the internal send() helper) -- every track* function must route through it, never call gtag directly');
  });

  test('GA_ENABLED requires both a configured measurement ID and NODE_ENV=production (dev/test runs never send real events)', () => {
    assert.match(
      analyticsSrc,
      /GA_ENABLED\s*=\s*GA_MEASUREMENT_ID\.length > 0 && process\.env\.NODE_ENV === 'production'/,
      'GA_ENABLED must require both a non-empty measurement ID and NODE_ENV === "production"'
    );
  });

  test('app/components/GoogleAnalytics.tsx renders nothing when GA is not configured', () => {
    const componentSrc = fs.readFileSync(path.join(rootDir, 'app/components/GoogleAnalytics.tsx'), 'utf-8');
    assert.match(componentSrc, /if \(!GA_ENABLED\) return null;/, 'the component must render nothing (not throw, not error) when GA_ENABLED is false');
  });
});
