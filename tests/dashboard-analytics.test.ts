import test from 'node:test';
import assert from 'node:assert/strict';
import { DashboardRepository } from '../src/engine/dashboard-repository';
import { UserDB } from '../src/auth/user-db';
import { ScanRepository } from '../src/engine/scan-repository';
import { AuditLogger } from '../src/auth/audit-logger';
import { RepositoryFactory } from '../src/storage/repository-factory';

test('Dashboard Analytics & Repository Suite', async (t) => {
  await t.test('DashboardRepository.getSummary reports honest zeros for a user with no real activity (no fabricated floor)', async () => {
    // 'usr_demo' genuinely has zero real scan records in the store. Previously getSummary()
    // padded every aggregate field with a hardcoded minimum (totalScans/totalReports >= 30,
    // totalRulesTriggered >= 823, totalAiSuggestions >= 175, totalActiveUsers >= 85,
    // avgMemoryUsageMb hardcoded to 1.42 always) — this test used to assert `>= 1`/`> 0` on all
    // of them, which passed only because of that fabrication, not because it verified any real
    // aggregation logic. A dashboard showing a padded-up minimum for a user/deployment with no
    // real activity is exactly the kind of fabricated production statistic this codebase must
    // not present — so the correct, honest expectation for a genuinely-empty user is real zeros.
    const summary = await DashboardRepository.getSummary('usr_demo_no_real_activity', 'ADMIN');

    assert.equal(summary.totalScans, 0);
    assert.equal(summary.totalReports, 0);
    assert.equal(summary.totalRulesTriggered, 0);
    assert.equal(summary.totalAiSuggestions, 0);
    assert.equal(summary.avgQualityScore, 0);
    assert.equal(summary.avgScanDurationMs, 0);
    assert.equal(summary.avgMemoryUsageMb, 0);
    assert.equal(summary.totalActiveUsers, 0);
  });

  await t.test('DashboardRepository.getSummary aggregates REAL seeded scan data exactly (dynamic, not fabricated)', async () => {
    const testUserId = `usr_dashboard_seed_${Date.now()}`;
    await ScanRepository.createScanRecord({
      userId: testUserId,
      fileName: 'SeedComponent.tsx',
      framework: 'REACT_JSX',
      qualityScore: 82,
      scanTimeMs: 12.5,
      memoryUsageMb: 2.4,
      ruleCount: 3,
      aiFixCount: 1,
      diagnostics: [],
      isFavorite: false,
    } as any);

    const summary = await DashboardRepository.getSummary(testUserId, 'ADMIN');

    // Exact values, not just ">= 1" — proves the aggregation reflects the real seeded record,
    // not a coincidentally-satisfied floor.
    assert.equal(summary.totalScans, 1);
    assert.equal(summary.totalReports, 1);
    assert.equal(summary.totalRulesTriggered, 3);
    assert.equal(summary.totalAiSuggestions, 1);
    assert.equal(summary.avgQualityScore, 82);
    assert.equal(summary.avgScanDurationMs, 12.5);
    assert.equal(summary.avgMemoryUsageMb, 2.4);
    assert.equal(summary.totalActiveUsers, 1);
    assert.equal(summary.frameworkDistribution.react, 1);
  });

  await t.test('DashboardRepository.getActivityFeed returns real audit-log-derived items when they exist', async () => {
    // Previously this fell back to 3 hardcoded fake entries (fabricated users, fabricated
    // timestamps computed to look recent, and one description referencing the fabricated
    // "30-repository evaluation" claim) whenever no real audit logs existed yet -- presented to
    // real, unauthenticated visitors on the public dashboard as if it were real platform
    // activity. Removed for the same reason getSummary's fabricated floor was removed above: an
    // empty feed must show as empty, not padded with invented events.
    const activity = await DashboardRepository.getActivityFeed(5);
    assert.ok(Array.isArray(activity));
    // May be empty (honest) or non-empty (real audit log entries written by other tests sharing
    // this process's storage) -- either is valid; only shape is asserted when items exist.
    for (const item of activity) {
      assert.ok(item.id !== undefined);
      assert.ok(item.title !== undefined);
      assert.ok(item.badgeColor !== undefined);
    }
  });

  await t.test('DashboardRepository.getActivityFeed returns an honest empty array, never fabricated demo entries, when no real audit logs exist', async () => {
    const activity = await DashboardRepository.getActivityFeed(1000);
    for (const item of activity) {
      assert.notEqual(item.id, 'act_1', 'the retired hardcoded demo activity entries must never be reintroduced');
      assert.notEqual(item.id, 'act_2', 'the retired hardcoded demo activity entries must never be reintroduced');
      assert.notEqual(item.id, 'act_3', 'the retired hardcoded demo activity entries must never be reintroduced');
      assert.ok(!item.description?.includes('30-repository'), 'the fabricated 30-repository claim must never appear in the activity feed');
    }
  });

  await t.test('REGRESSION (Stage 7B): getActivityFeed never leaks research-participant activity to the public dashboard feed', async () => {
    // This feed is served publicly/unauthenticated (see the "platform pulse" comment on
    // getActivityFeed itself) -- found live via a real browser walkthrough of a fresh account's
    // dashboard to leak an actual research participant's consent-recording and scan events
    // (identifiable by participant code, e.g. "P007"), reachable with zero authentication via
    // `curl http://localhost:PORT/api/dashboard/activity`. Inconsistent with the human-study
    // consent protocol, which commits to presenting results only in aggregated/anonymized form
    // (docs/research/FINAL_RESEARCH_CONTRACT.md Section 12), not as an individually-attributable
    // live event stream. Fixed by filtering both RESEARCH_* audit-log actions and the synthetic
    // @user-study.figm.local email domain out of this specific feed.
    const participantEmail = `p${Date.now().toString().slice(-6)}@user-study.figm.local`;
    await AuditLogger.logEvent('RESEARCH_PARTICIPANT_ASSIGNED', {
      email: participantEmail,
      details: `Consent recorded for research participant session P${Date.now().toString().slice(-6)} (protocol version 1.0.0).`,
    });
    await AuditLogger.logEvent('RESEARCH_CONSENT_VERIFIED', { email: participantEmail, details: 'Consent verified.' });

    const activity = await DashboardRepository.getActivityFeed(1000);
    for (const item of activity) {
      assert.notEqual(item.type, 'RESEARCH_PARTICIPANT_ASSIGNED' as any, 'a RESEARCH_* action must never appear in the public activity feed');
      assert.ok(!item.user?.includes('user-study.figm.local'), 'a @user-study.figm.local participant identity must never appear in the public activity feed');
      assert.ok(!item.description?.includes('research participant session'), 'participant-consent detail text must never appear in the public activity feed');
    }
  });

  await t.test('REGRESSION (Stage 7C): getActivityFeed excludes engineering-QA accounts (ENGTEST*/curltest* emails) from the public feed', async () => {
    RepositoryFactory.resetProvider();
    const engEmail = `engtest.section20.${Date.now()}@figm.io`;
    await AuditLogger.logEvent('REGISTER', { email: engEmail, status: 'SUCCESS', details: `REGTEST-MARKER-${Date.now()}` });

    const activity = await DashboardRepository.getActivityFeed(1000);
    const feedText = JSON.stringify(activity);
    assert.ok(!feedText.includes(engEmail), 'an engtest*/curltest* account\'s raw email must never appear in the public activity feed');
  });

  await t.test('REGRESSION (Stage 7C): getSummary\'s admin-wide aggregate excludes an engineering-QA account\'s scans, but the account\'s own dashboard still sees them', async () => {
    RepositoryFactory.resetProvider();
    const engEmail = `engtest.section20b.${Date.now()}@figm.io`;
    const engUser = UserDB.createUser({
      email: engEmail,
      passwordHash: 'unused-in-this-test',
      fullName: 'ENGTEST Section 20 Regression',
      role: 'DEVELOPER',
    });
    UserDB.createScanRecord({
      userId: engUser.id,
      fileName: 'EngTestOnly.tsx',
      framework: 'React',
      scanTimeMs: 42,
      memoryUsageMb: 1,
      qualityScore: 100,
      ruleCount: 0,
      diagnostics: [],
    } as any);

    // The account's own per-user dashboard view is never filtered -- it must still see its own scan.
    const ownView = await DashboardRepository.getSummary(engUser.id, 'DEVELOPER');
    assert.equal(ownView.totalScans, 1, 'an engineering account must still see its own scan in its own dashboard');

    // The admin-wide aggregate (userId undefined) must not count it.
    const before = await DashboardRepository.getSummary(undefined, 'ADMIN');
    const otherEngUser = UserDB.createUser({
      email: `curltest.section20c.${Date.now()}@figm.io`,
      passwordHash: 'unused-in-this-test',
      fullName: 'curltest Section 20 Regression',
      role: 'DEVELOPER',
    });
    UserDB.createScanRecord({
      userId: otherEngUser.id,
      fileName: 'AnotherEngTestOnly.tsx',
      framework: 'React',
      scanTimeMs: 42,
      memoryUsageMb: 1,
      qualityScore: 100,
      ruleCount: 0,
      diagnostics: [],
    } as any);
    const after = await DashboardRepository.getSummary(undefined, 'ADMIN');
    assert.equal(after.totalScans, before.totalScans, 'adding another engineering-QA account\'s scan must not change the admin-wide aggregate total');
  });

  await t.test('REGRESSION (Stage 7C): getRecentReports returns an honest empty array, never fabricated placeholder reports (rep_1/rep_2/rep_3), for a user with no real scans', async () => {
    // 'usr_demo' genuinely has zero real scan records in the store, same as the getSummary test
    // above. getRecentReports previously fell back to three hardcoded fake reports (rep_1
    // "UserProfile.tsx" quality 82, rep_2 "SearchPanel.component.ts", rep_3 "AppRouter.page.tsx")
    // whenever a user had no real records -- presenting invented scan history as if real. This
    // test used to assert `reports.length > 0`, which passed only because of that fabrication.
    const reports = await DashboardRepository.getRecentReports('usr_demo', 5);
    assert.deepEqual(reports, []);
  });

  await t.test('DashboardRepository.getRecentReports returns REAL seeded report items, correctly mapped', async () => {
    const testUserId = `usr_reports_seed_${Date.now()}`;
    await ScanRepository.createScanRecord({
      userId: testUserId,
      fileName: 'SeedReport.tsx',
      framework: 'REACT_JSX',
      qualityScore: 91,
      scanTimeMs: 8.2,
      memoryUsageMb: 1.1,
      ruleCount: 2,
      aiFixCount: 0,
      diagnostics: [],
      isFavorite: false,
    } as any);

    const reports = await DashboardRepository.getRecentReports(testUserId, 5);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].fileName, 'SeedReport.tsx');
    assert.equal(reports[0].framework, 'REACT_JSX');
    assert.equal(reports[0].qualityScore, 91);
    assert.equal(reports[0].scanTimeMs, 8.2);
  });

  await t.test('Persisted submissions flow into DashboardRepository summary', async () => {
    const testUserId = `usr_test_${Date.now()}`;
    UserDB.createSubmission({
      userId: testUserId,
      fileName: 'DashboardTestComponent.tsx',
      framework: 'REACT_JSX',
      codeContent: 'const a = 1;',
      executionTimeMs: 0.45,
      qualityScore: 92,
      diagnosticsCount: 1,
    });

    const userSummary = await DashboardRepository.getSummary(testUserId, 'DEVELOPER');
    assert.ok(userSummary.totalScans >= 1);
    assert.strictEqual(userSummary.avgQualityScore, 92);
  });
});
