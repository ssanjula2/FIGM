import { describe, it } from 'node:test';
import assert from 'node:assert';
import { runJsonToSupabaseMigration } from '../scripts/migrate-json-to-supabase';
import { UserDB } from '../src/auth/user-db';

describe('Phase 4: Data Migration Utility Suite', () => {
  it('runJsonToSupabaseMigration parses JSON store, validates records, and generates report', async () => {
    // The local JSON store is the migration's own source of truth for what "complete" means --
    // read it independently here (the same UserDB the migration script itself reads from) so the
    // assertions below are a real invariant check, not a value the migration script could satisfy
    // by doing nothing. This closes QA-02: the previous assertion
    // (`typeof summary.usersSkipped === 'number' || summary.usersImported >= 0`) was tautological
    // -- true for any `usersSkipped` value at all, so a no-op migration that silently dropped every
    // record would still pass it.
    const sourceUserCount = UserDB.getAllUsers().length;
    const sourceProjectCount = UserDB.getProjects().length;
    const sourceScanCount = UserDB.getScanRecords().length;

    const summary = await runJsonToSupabaseMigration();
    assert.ok(summary);
    assert.ok(summary.timestamp);
    assert.ok(['SUCCESS', 'DRY_RUN', 'FAILED'].includes(summary.status));

    // A real behavioral invariant: every record read from the source JSON store must be accounted
    // for as either imported or skipped -- none silently dropped by an early-exit, an uncaught
    // exception outside the per-record try/catch, or an off-by-one loop bug.
    assert.equal(summary.usersImported + summary.usersSkipped, sourceUserCount, 'every user in the JSON store must be imported or skipped, none dropped');
    assert.equal(summary.projectsImported + summary.projectsSkipped, sourceProjectCount, 'every project in the JSON store must be imported or skipped, none dropped');
    assert.equal(summary.scansImported + summary.scansSkipped, sourceScanCount, 'every scan record in the JSON store must be imported or skipped, none dropped');

    // A genuinely non-tautological status check: SUCCESS/DRY_RUN both require zero errors by the
    // script's own status formula (`errors.length > 0 ? 'FAILED' : ...`) -- assert that directly
    // rather than just checking status is one of the three known strings.
    if (summary.status !== 'FAILED') {
      assert.deepEqual(summary.errors, [], `${summary.status} status must mean zero migration errors`);
    }
  });
});
