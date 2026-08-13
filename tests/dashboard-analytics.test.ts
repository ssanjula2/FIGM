import test from 'node:test';
import assert from 'node:assert/strict';
import { DashboardRepository } from '../src/engine/dashboard-repository';
import { UserDB } from '../src/auth/user-db';
import { ScanRepository } from '../src/engine/scan-repository';

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

  await t.test('DashboardRepository.getActivityFeed returns activity timeline items', async () => {
    const activity = await DashboardRepository.getActivityFeed(5);
    assert.ok(Array.isArray(activity));
    assert.ok(activity.length > 0);

    const first = activity[0];
    assert.ok(first.id !== undefined);
    assert.ok(first.title !== undefined);
    assert.ok(first.badgeColor !== undefined);
  });

  await t.test('DashboardRepository.getRecentReports returns report items', async () => {
    const reports = await DashboardRepository.getRecentReports('usr_demo', 5);
    assert.ok(Array.isArray(reports));
    assert.ok(reports.length > 0);

    const first = reports[0];
    assert.ok(first.fileName !== undefined);
    assert.ok(first.framework !== undefined);
    assert.ok(first.qualityScore >= 0);
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
