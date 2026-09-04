import test from 'node:test';
import assert from 'node:assert/strict';
import { UserDB } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { ParticipantRepository, TARGET_PARTICIPANT_COUNT } from '../src/engine/participant-repository';

/**
 * Regression coverage for Phase 14 closure: ParticipantRepository.getMatrix used to call
 * provider.getSubmissionsByUserId once PER participant row inside its P001..P0NN loop
 * (TARGET_PARTICIPANT_COUNT separate queries), instead of fetching every submission once and
 * grouping in memory. Both
 * storage backends already support a batch fetch via the 'all_users' sentinel (see
 * UserDB.getSubmissionsByUserId / SupabaseStorageProvider.getSubmissionsByUserId), which the fix
 * now uses instead.
 */

test('getMatrix calls getSubmissionsByUserId exactly once (batched), not once per participant', async () => {
  RepositoryFactory.resetProvider();
  const provider = RepositoryFactory.getStorageProvider();

  const original = provider.getSubmissionsByUserId.bind(provider);
  let callCount = 0;
  const calledWith: string[] = [];
  (provider as any).getSubmissionsByUserId = (userId: string) => {
    callCount += 1;
    calledWith.push(userId);
    return original(userId);
  };

  try {
    await ParticipantRepository.getMatrix();
  } finally {
    (provider as any).getSubmissionsByUserId = original;
  }

  assert.equal(callCount, 1, `getMatrix must call getSubmissionsByUserId exactly once, not once per participant (got ${callCount} calls)`);
  assert.deepEqual(calledWith, ['all_users'], 'the single call must fetch everything via the all_users batch sentinel');
});

test('the batched matrix still reports the correct submission count for a participant with real submissions', async () => {
  RepositoryFactory.resetProvider();
  const provider = RepositoryFactory.getStorageProvider();

  // P901/P902 are outside the real participant target range used elsewhere in the suite, but
  // getMatrix only iterates P001..P0NN (NN = TARGET_PARTICIPANT_COUNT) -- use a real id inside
  // that range so it actually shows up.
  const participantId = `P${String(1 + Math.floor(Math.random() * TARGET_PARTICIPANT_COUNT)).padStart(3, '0')}`;
  const email = `${participantId.toLowerCase()}@user-study.figm.local`;
  // Check by EMAIL, not by id: the real participant-provisioning path
  // (ParticipantRepository.assignNewParticipant) creates users with a `usr_<timestamp>_<random>`
  // id (and sets `participantCode` to the P-code separately) -- so a slot already registered via
  // that real path has no row with `id === participantId`, findUserById here would wrongly report
  // "not registered," and the createUser below would then collide on the already-taken email
  // (P2002) rather than being skipped. Checking the actual uniqueness key (email) matches both id
  // schemes and correctly no-ops when the slot is already registered by either one.
  // Other files in this suite (tests/research-dataset-range-guard.test.ts and friends) also draw
  // random in-range P001..P0NN codes but decouple their email from the code with a random suffix
  // -- which can leave a SEPARATE stale row sharing this exact participantCode/id from an earlier
  // test/run, with a different email. getMatrix (builds a Map keyed by code -- last-registered row
  // wins) and getDetail (Array.find -- first-registered row wins) would then resolve the same code
  // to two DIFFERENT physical rows and disagree on submission counts, exactly the flakiness this
  // guards against.
  //
  // Ensure at most one row exists for this exact code before proceeding -- and, critically, remove
  // EVERY stale row matching it, not just the first. `findUserByParticipantCode` is `Array.find`
  // under both storage backends, so it only ever surfaces the first match; on the local JSON
  // test-storage backend (never reset between test runs, unlike a real Postgres test database, and
  // whose `createUser` does not enforce `participantCode` uniqueness the way Postgres's `@unique`
  // constraint does), more than one stale row can accumulate for the same code across repeated
  // runs of this suite. A single-row cleanup based only on `findUserByParticipantCode`'s first
  // match left a second, un-deleted duplicate behind that could still collide with this test's own
  // `createUser({ id: participantId, ... })` call below (`P2002` on `id`) -- confirmed by a real,
  // reproduced failure, not a hypothetical.
  let existing = await provider.findUserByEmail(email);
  const allUsersBeforeCleanup = await provider.getAllUsers();
  const staleRows = allUsersBeforeCleanup.filter(
    (u: { id: string; participantCode?: string | null }) =>
      (u.participantCode === participantId || u.id === participantId) && u.id !== existing?.id
  );
  for (const stale of staleRows) {
    await provider.deleteUser(stale.id);
  }
  if (!existing) {
    existing = UserDB.createUser({
      id: participantId,
      email,
      passwordHash: 'unused-in-this-test',
      fullName: `User Study Participant ${participantId}`,
      role: 'DEVELOPER',
    });
  }
  // getMatrix/getDetail resolve a participant CODE to its user row via `participantCode || id`
  // (see ParticipantRepository.getMatrix), but submissions are grouped by the row's REAL `id`
  // (submission.userId), which for a row created via the real provisioning path is the random
  // `usr_...` id, not the P-code. Filing the submission under `participantId` directly would
  // silently orphan it for any slot already registered that way -- use the resolved row's actual
  // id, which is `participantId` itself only when this test just created the row above.
  const realUserId = existing.id;

  UserDB.createSubmission({
    userId: realUserId,
    fileName: 'NPlus1RegressionFixture.tsx',
    framework: 'REACT',
    codeContent: 'export function Widget() { return null; }',
    executionTimeMs: 5,
    qualityScore: 100,
    diagnosticsCount: 0,
  });

  const matrix = await ParticipantRepository.getMatrix();
  const row = matrix.find((r) => r.participantId === participantId);
  assert.ok(row, `matrix must contain a row for ${participantId}`);
  assert.equal(row!.status, 'SUBMITTED');
  assert.ok(row!.totalSubmissions >= 1, 'the batched grouping must still attribute the submission to the right participant');

  const detail = await ParticipantRepository.getDetail(participantId);
  assert.equal(detail?.submissions.length, row!.totalSubmissions, 'matrix and detail view must agree on submission count for the same participant');
});
