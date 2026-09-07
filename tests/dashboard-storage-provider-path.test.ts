import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DashboardRepository } from '../src/engine/dashboard-repository';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { ParticipantRepository } from '../src/engine/participant-repository';
import { UserDB } from '../src/auth/user-db';
import type { IStorageProvider } from '../src/storage/storage-provider';
import type { DBSubmission } from '../src/auth/user-db';

/**
 * Regression coverage for the production incident traced this session: GET /api/dashboard/summary
 * and GET /api/dashboard/reports threw "FATAL: ADMIN_BOOTSTRAP_PASSWORD ..." in production even
 * though Supabase/Postgres was healthy (storageProvider: 'supabase', database: CONNECTED_POSTGRES).
 * Root cause: DashboardRepository.getSummary()/getRecentReports() called the legacy
 * UserDB.getSubmissionsByUserId(userId) (src/auth/user-db.ts, the JSON-file backend) DIRECTLY,
 * bypassing DashboardRepository.provider (the RepositoryFactory-resolved abstraction every other
 * call in the same file already used). On Vercel's ephemeral filesystem this always hit
 * UserDB.loadDB()'s empty-store branch, which unconditionally seeds the default ADMIN accounts via
 * resolveBootstrapAdminPassword() -- a crash with nothing to do with the real user's (real, present,
 * Postgres-backed) data.
 *
 * Fix: both call sites now use `await DashboardRepository.provider.getSubmissionsByUserId(userId)`,
 * and the now-unused `UserDB` import was removed from dashboard-repository.ts.
 */

type SubmissionsCall = { userId: string };

/** Minimal fake IStorageProvider -- implements only what DashboardRepository actually calls.
 *  `name: 'supabase'` deliberately masquerades as the real Postgres-backed provider (matching what
 *  RepositoryFactory would actually resolve to in production) so these tests exercise exactly the
 *  "Supabase is healthy, would this dashboard path route through it" question the incident raised. */
class TrackingFakeProvider {
  public name: 'supabase' = 'supabase';
  public submissionsCalls: SubmissionsCall[] = [];
  private submissionsByUser: Map<string, DBSubmission[]>;

  constructor(submissionsByUser: Map<string, DBSubmission[]> = new Map()) {
    this.submissionsByUser = submissionsByUser;
  }

  isConnected(): boolean {
    return true;
  }

  async getScanRecords(): Promise<any[]> {
    return [];
  }

  async getProjects(): Promise<any[]> {
    return [];
  }

  async getAllUsers(): Promise<any[]> {
    return [];
  }

  async getSubmissionsByUserId(userId: string): Promise<DBSubmission[]> {
    this.submissionsCalls.push({ userId });
    return this.submissionsByUser.get(userId) || [];
  }
}

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) saved[key] = process.env[key];
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('Dashboard storage-provider path (submissions no longer bypass RepositoryFactory)', async (t) => {
  await t.test('1. getSummary() reads submissions through the CONFIGURED storage provider, not legacy UserDB', async () => {
    const userId = `usr_dashboard_provider_path_${Date.now()}`;
    const fake = new TrackingFakeProvider();
    RepositoryFactory.setStorageProvider(fake as unknown as IStorageProvider);
    try {
      await DashboardRepository.getSummary(userId, 'DEVELOPER');
      assert.ok(
        fake.submissionsCalls.some((c) => c.userId === userId),
        'getSummary must call the configured provider\'s getSubmissionsByUserId for this exact userId'
      );
    } finally {
      RepositoryFactory.resetProvider();
    }
  });

  await t.test('2. getRecentReports() reads submissions through the CONFIGURED storage provider, not legacy UserDB', async () => {
    const userId = `usr_dashboard_provider_path_${Date.now()}_2`;
    const fake = new TrackingFakeProvider();
    RepositoryFactory.setStorageProvider(fake as unknown as IStorageProvider);
    try {
      await DashboardRepository.getRecentReports(userId);
      assert.ok(
        fake.submissionsCalls.some((c) => c.userId === userId),
        'getRecentReports must call the configured provider\'s getSubmissionsByUserId for this exact userId'
      );
    } finally {
      RepositoryFactory.resetProvider();
    }
  });

  await t.test('3. a fresh Postgres-backed user with zero submissions returns valid empty dashboard data, never throws', async () => {
    const userId = `usr_dashboard_fresh_user_${Date.now()}`;
    const fake = new TrackingFakeProvider(); // no entry for userId -> getSubmissionsByUserId resolves []
    RepositoryFactory.setStorageProvider(fake as unknown as IStorageProvider);
    try {
      // ADMIN_BOOTSTRAP_PASSWORD deliberately unset: proves this path no longer depends on it at
      // all -- the exact env condition that produced the production 500 before this fix, now
      // irrelevant because UserDB (and its default-admin seeding) is never reached.
      await withEnv({ ADMIN_BOOTSTRAP_PASSWORD: undefined }, async () => {
        const summary = await DashboardRepository.getSummary(userId, 'DEVELOPER');
        assert.equal(summary.totalReports, 0);
        assert.equal(summary.totalScans, 0);
        assert.equal(summary.avgQualityScore, null, 'no fabricated score for a user with no real activity');

        const reports = await DashboardRepository.getRecentReports(userId);
        assert.deepEqual(reports, []);
      });
    } finally {
      RepositoryFactory.resetProvider();
    }
  });

  await t.test('4. no direct UserDB submission lookup remains in dashboard-repository.ts (static source guard)', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'src', 'engine', 'dashboard-repository.ts'),
      'utf-8'
    );
    assert.doesNotMatch(source, /UserDB\.getSubmissionsByUserId/, 'the legacy direct call must not be reintroduced');
    assert.doesNotMatch(
      source,
      /import\s*\{[^}]*\bUserDB\b[^}]*\}\s*from\s*['"]\.\.\/auth\/user-db['"]/,
      'UserDB must not be re-imported into dashboard-repository.ts -- every real read goes through DashboardRepository.provider'
    );
    // Sanity check the guard itself isn't vacuous (would pass on an empty/misread file).
    assert.match(source, /DashboardRepository\.provider\.getSubmissionsByUserId/);
  });

  await t.test('5. research participant paths are unaffected by the dashboard fix', async () => {
    RepositoryFactory.resetProvider(); // real (JSON-in-test) provider -- not the fake from tests 1-3
    // Out-of-range operational/QA-fixture code (P900000+, same convention already used by
    // tests/research-dataset-consent-gate.test.ts's uniqueParticipantCode()) -- never mistaken for
    // real P001-P020 study data, and avoids any dependency on assignNewParticipant()'s
    // smallest-unused-number allocation (irrelevant to what this test verifies).
    const code = `P9${String(Date.now()).slice(-5)}`;
    const stale = UserDB.findUserByParticipantCode(code);
    if (stale) UserDB.deleteUser(stale.id);
    let createdUserId: string | undefined;
    try {
      const user = UserDB.createUser({
        email: `${code.toLowerCase()}@user-study.figm.local`,
        passwordHash: 'unused-in-this-test',
        fullName: `Dashboard-Fix Regression Participant ${code}`,
        role: 'DEVELOPER',
        participantCode: code,
        researchStatus: 'CONSENT_VERIFIED',
        researchAssignedAt: new Date().toISOString(),
        researchConsentVerifiedAt: new Date().toISOString(),
      });
      createdUserId = user.id;

      // ParticipantRepository's own read paths (getDetail, getResearchDataset) are untouched by
      // this session's dashboard-repository.ts change -- both must still run cleanly end-to-end.
      const detail = await ParticipantRepository.getDetail(code);
      assert.ok(detail);
      assert.equal(detail!.profile.linkedUserId, user.id);

      const dataset = await ParticipantRepository.getResearchDataset();
      assert.ok(Array.isArray(dataset));
    } finally {
      if (createdUserId) UserDB.deleteUser(createdUserId);
      RepositoryFactory.resetProvider();
    }
  });
});
