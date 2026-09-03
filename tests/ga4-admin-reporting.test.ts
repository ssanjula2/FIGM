import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Stage 7G Section 13/14/22-F: the Admin "Website Analytics (GA4)" panel must never fabricate
 * GA4 charts/metrics when the server-side GA4 Data API integration (a GA4 Property ID + an
 * authorized Google service-account credential) is not configured -- the public client-side
 * Measurement ID alone is not sufficient to query historical GA4 data. See
 * src/lib/ga4-admin-reporting.ts.
 */
test('GA4 admin reporting configuration check is honest, never fabricated', async (t) => {
  const originalPropertyId = process.env.GA4_PROPERTY_ID;
  const originalServiceAccount = process.env.GA4_SERVICE_ACCOUNT_KEY;
  const originalMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  t.after(() => {
    if (originalPropertyId === undefined) delete process.env.GA4_PROPERTY_ID;
    else process.env.GA4_PROPERTY_ID = originalPropertyId;
    if (originalServiceAccount === undefined) delete process.env.GA4_SERVICE_ACCOUNT_KEY;
    else process.env.GA4_SERVICE_ACCOUNT_KEY = originalServiceAccount;
    if (originalMeasurementId === undefined) delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    else process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = originalMeasurementId;
  });

  await t.test('missing GA4_PROPERTY_ID/GA4_SERVICE_ACCOUNT_KEY -> reported as not configured, with a real reason', async () => {
    delete process.env.GA4_PROPERTY_ID;
    delete process.env.GA4_SERVICE_ACCOUNT_KEY;
    const { getGA4AdminReportingStatus } = await import(`../src/lib/ga4-admin-reporting.ts?t=${Date.now()}`);
    const status = getGA4AdminReportingStatus();
    assert.equal(status.configured, false);
    assert.ok(status.reason && status.reason.length > 20, 'must explain why, not just return a bare false');
  });

  await t.test('client tracking status is independent of admin-reporting status', async () => {
    delete process.env.GA4_PROPERTY_ID;
    delete process.env.GA4_SERVICE_ACCOUNT_KEY;
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TESTID123';
    const { getGA4AdminReportingStatus } = await import(`../src/lib/ga4-admin-reporting.ts?t=${Date.now()}`);
    const status = getGA4AdminReportingStatus();
    assert.equal(status.clientTrackingConfigured, true, 'client tracking can be configured even while admin reporting is not');
    assert.equal(status.configured, false, 'a client Measurement ID alone must never be treated as sufficient for admin reporting');
  });

  await t.test('both GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_KEY present -> reported as configured', async () => {
    process.env.GA4_PROPERTY_ID = 'properties/123456789';
    process.env.GA4_SERVICE_ACCOUNT_KEY = '{"type":"service_account"}';
    const { getGA4AdminReportingStatus } = await import(`../src/lib/ga4-admin-reporting.ts?t=${Date.now()}`);
    const status = getGA4AdminReportingStatus();
    assert.equal(status.configured, true);
  });
});

test('app/admin/page.tsx renders the GA4 admin panel as a source-honest "not configured" state, never a fake chart', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const src = fs.readFileSync(path.resolve(process.cwd(), 'app/admin/page.tsx'), 'utf-8');

  assert.match(src, /Website Analytics \(GA4\)/, 'the admin panel must be labeled as GA4 website analytics, distinct from Product Analytics');
  assert.match(src, /Not configured for admin reporting/, 'must render the honest not-configured state, not a fabricated chart, when the GA4 Data API is not set up');
  assert.doesNotMatch(src, /Math\.random\(\).*(sessions|pageviews|activeUsers)/i, 'must never fabricate GA4-shaped numbers with Math.random()');
});
