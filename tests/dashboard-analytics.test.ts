import test from 'node:test';
import assert from 'node:assert/strict';
import { DashboardRepository } from '../src/engine/dashboard-repository';
import { UserDB } from '../src/auth/user-db';

test('Dashboard Analytics & Repository Suite', async (t) => {
  await t.test('DashboardRepository.getSummary aggregates metrics dynamically', async () => {
    const summary = await DashboardRepository.getSummary('usr_demo', 'ADMIN');

    assert.ok(summary.totalProjects >= 1);
    assert.ok(summary.totalScans >= 1);
    assert.ok(summary.totalReports >= 1);
    assert.ok(summary.totalRulesTriggered >= 1);
    assert.ok(summary.totalAiSuggestions >= 1);
    assert.ok(summary.avgQualityScore >= 0 && summary.avgQualityScore <= 100);
    assert.ok(summary.avgScanDurationMs > 0);
    assert.ok(summary.avgMemoryUsageMb > 0);
    assert.ok(summary.totalActiveUsers >= 1);
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
