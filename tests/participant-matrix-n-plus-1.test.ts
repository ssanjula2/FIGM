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
  let existing = await provider.findUserByEmail(email);
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
