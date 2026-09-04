import test from 'node:test';
import assert from 'node:assert/strict';
import { UserDB } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { ParticipantRepository, TARGET_PARTICIPANT_COUNT, PARTICIPANT_ID_PATTERN } from '../src/engine/participant-repository';

/**
 * Stage 11B (QA baseline cleanup / REAL-P namespace reversion).
 *
 * The researcher's final decision: a clean real-study baseline using P001..P020 (target 20), not
 * the REAL-P001..REAL-P020 namespace attempted earlier this session. That attempt was fully
 * reverted (src/engine/participant-repository.ts, app/api/admin/participants/route.ts,
 * app/admin/page.tsx, app/user-study/page.tsx, and every test fixture that had been updated to the
 * REAL-P format). The 10 pre-existing P001-P010 QA/protocol records (re-verified read-only,
 * zero ambiguous signal, exactly matching every prior audit this session) were deleted in
 * FK-safe order via the real storage provider's cascade-delete, after which the real production
 * database shows 0 remaining P001-P010 rows -- see
 * docs/audit/STAGE_11B_QA_BASELINE_CLEANUP_REPORT.md for the full real-database verification
 * (PRE/POST counts), which is not repeated here as an automated test since there is no ongoing
 * application logic to regression-test against already-deleted historical rows -- it is a one-time
 * database-state fact, verified directly and recorded in that report.
 *
 * This file focuses on what IS real, ongoing application logic: the P001..P020 namespace itself
 * (unchanged from Stage 8A), against the real repository/storage-provider stack, no mocking.
 */

test('a fresh session is assigned P001 when that exact slot is free', async () => {
  // The local JSON test fixture this suite runs against accumulates real participant-pattern rows
  // across every historical `npm test` run in this environment (by design -- see
  // tests/admin-research-dashboard.test.ts's own comment on this exact issue). Relying on P001
  // being organically free would make this test's pass/fail depend on unbounded ambient history,
  // not the actual "smallest unused number" logic under test -- so this test owns the slot
  // outright, freeing it first if a prior run left it occupied, exactly like that established
  // pattern.
  RepositoryFactory.resetProvider();
  const provider = RepositoryFactory.getStorageProvider();
  const existing = (await provider.findUserByParticipantCode('P001')) as { id: string } | undefined;
  if (existing) await provider.deleteUser(existing.id);

  const { participantCode } = await ParticipantRepository.assignNewParticipant();
  assert.equal(participantCode, 'P001');
  assert.equal(PARTICIPANT_ID_PATTERN.test(participantCode), true);
});

test('P020 is a valid target slot within the participant matrix', async () => {
  // Same ambient-history consideration as the P001 test above -- own the slot outright.
  RepositoryFactory.resetProvider();
  const provider = RepositoryFactory.getStorageProvider();
  const existing = (await provider.findUserByParticipantCode('P020')) as { id: string } | undefined;
  if (existing) await provider.deleteUser(existing.id);

  const matrix = await ParticipantRepository.getMatrix();
  const p020 = matrix.find((r) => r.participantId === 'P020');
  assert.ok(p020, 'P020 must be a row in the matrix');
  assert.equal(p020!.status, 'NOT_REGISTERED', 'the freed slot has no real record');
});

test('the participant progress denominator remains exactly 20', async () => {
  RepositoryFactory.resetProvider();
  assert.equal(TARGET_PARTICIPANT_COUNT, 20);
  const matrix = await ParticipantRepository.getMatrix();
  assert.equal(matrix.length, 20);
  assert.deepEqual(
    matrix.map((r) => r.participantId),
    Array.from({ length: 20 }, (_, i) => `P${String(i + 1).padStart(3, '0')}`)
  );
});

/** In-range (P001..P0<TARGET_PARTICIPANT_COUNT>) synthetic code for the consent-timing tests
 *  below -- required after Phase 2's range guard (ParticipantRepository.isRealStudyParticipantCode)
 *  restricted getResearchDataset() to exactly that range; a P900000+-style code (this file's prior
 *  convention, kept for the two exclusion-only tests where it makes no difference) is now
 *  unconditionally excluded regardless of consent status. Purges any pre-existing same-coded row
 *  first and sets research status by exact user id afterward -- the local JSON test-storage
 *  backend does not enforce participantCode uniqueness (real Postgres does), so a stale row from
 *  an earlier run sharing this code would otherwise make ParticipantRepository.setResearchStatus's
 *  code-based lookup ambiguous. */
function inRangeSyntheticCode(): string {
  const n = 1 + Math.floor(Math.random() * TARGET_PARTICIPANT_COUNT);
  return `P${String(n).padStart(3, '0')}`;
}

function setStatusById(userId: string, status: 'CONSENT_VERIFIED' | 'REVOKED') {
  return UserDB.updateUser(userId, {
    researchStatus: status,
    ...(status === 'CONSENT_VERIFIED' ? { researchConsentVerifiedAt: new Date().toISOString() } : {}),
  });
}

test('pre-consent scans remain excluded from the research dataset', async () => {
  RepositoryFactory.resetProvider();
  const code = `P${900000 + Math.floor(Math.random() * 90000)}`;
  const user = UserDB.createUser({
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: `${code.toLowerCase()}@user-study.figm.local`,
    passwordHash: 'unused-in-this-test',
    fullName: `User Study Participant ${code}`,
    role: 'DEVELOPER',
    participantCode: code,
    researchStatus: 'ASSIGNED',
    researchAssignedAt: new Date().toISOString(),
  });
  const provider = RepositoryFactory.getStorageProvider();
  await provider.createScanRecord({
    userId: user.id,
    fileName: 'UserProfile.jsx',
    framework: 'React',
    scanTimeMs: 1,
    memoryUsageMb: 1,
    qualityScore: 90,
    ruleCount: 1,
    aiFixCount: 0,
    diagnostics: [],
    isFavorite: false,
  });

  const dataset = await ParticipantRepository.getResearchDataset();
  assert.equal(dataset.filter((r) => r.userId === user.id).length, 0);
});

test('a consent-verified participant with a real post-consent scan is included', async () => {
  RepositoryFactory.resetProvider();
  const code = inRangeSyntheticCode();
  const stale = UserDB.findUserByParticipantCode(code);
  if (stale) UserDB.deleteUser(stale.id);
  const user = UserDB.createUser({
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: `${code.toLowerCase()}+${Date.now()}_${Math.random().toString(36).slice(2, 7)}@user-study.figm.local`,
    passwordHash: 'unused-in-this-test',
    fullName: `User Study Participant ${code}`,
    role: 'DEVELOPER',
    participantCode: code,
    researchStatus: 'ASSIGNED',
    researchAssignedAt: new Date().toISOString(),
  });
  setStatusById(user.id, 'CONSENT_VERIFIED');
  await new Promise((r) => setTimeout(r, 15));

  const provider = RepositoryFactory.getStorageProvider();
  const scan = await provider.createScanRecord({
    userId: user.id,
    fileName: 'UserProfile.jsx',
    framework: 'React',
    scanTimeMs: 1,
    memoryUsageMb: 1,
    qualityScore: 90,
    ruleCount: 1,
    aiFixCount: 0,
    diagnostics: [],
    isFavorite: false,
  });

  const dataset = await ParticipantRepository.getResearchDataset();
  const rows = dataset.filter((r) => r.userId === user.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].scanId, (scan as any).id);
});

test('PRIMARY/SECONDARY repeat-scan policy is intact after the reversion', async () => {
  RepositoryFactory.resetProvider();
  const code = inRangeSyntheticCode();
  const stale = UserDB.findUserByParticipantCode(code);
  if (stale) UserDB.deleteUser(stale.id);
  const user = UserDB.createUser({
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: `${code.toLowerCase()}+${Date.now()}_${Math.random().toString(36).slice(2, 7)}@user-study.figm.local`,
    passwordHash: 'unused-in-this-test',
    fullName: `User Study Participant ${code}`,
    role: 'DEVELOPER',
    participantCode: code,
    researchStatus: 'ASSIGNED',
    researchAssignedAt: new Date().toISOString(),
  });
  setStatusById(user.id, 'CONSENT_VERIFIED');
  await new Promise((r) => setTimeout(r, 15));

  const provider = RepositoryFactory.getStorageProvider();
  const makeScan = () => provider.createScanRecord({
    userId: user.id,
    fileName: 'UserProfile.jsx',
    framework: 'React',
    scanTimeMs: 1,
    memoryUsageMb: 1,
    qualityScore: 90,
    ruleCount: 1,
    aiFixCount: 0,
    diagnostics: [],
    isFavorite: false,
  });

  const first = await makeScan();
  await new Promise((r) => setTimeout(r, 15));
  const second = await makeScan();

  const dataset = await ParticipantRepository.getResearchDataset();
  const rows = dataset.filter((r) => r.userId === user.id);
  assert.equal(rows.length, 2, 'repeat scans allowed -- both preserved');
  const primary = ParticipantRepository.filterPrimaryResearchAttempts(rows);
  const secondary = ParticipantRepository.filterSecondaryResearchAttempts(rows);
  assert.equal(primary.length, 1);
  assert.equal(primary[0].scanId, (first as any).id);
  assert.equal(secondary.length, 1);
  assert.equal(secondary[0].scanId, (second as any).id);
});

test('a REVOKED participant is excluded, even with real post-consent-era scans', async () => {
  RepositoryFactory.resetProvider();
  const code = `P${900000 + Math.floor(Math.random() * 90000)}`;
  const user = UserDB.createUser({
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: `${code.toLowerCase()}@user-study.figm.local`,
    passwordHash: 'unused-in-this-test',
    fullName: `User Study Participant ${code}`,
    role: 'DEVELOPER',
    participantCode: code,
    researchStatus: 'ASSIGNED',
    researchAssignedAt: new Date().toISOString(),
  });
  await ParticipantRepository.setResearchStatus(code, 'CONSENT_VERIFIED');
  await new Promise((r) => setTimeout(r, 15));
  const provider = RepositoryFactory.getStorageProvider();
  await provider.createScanRecord({
    userId: user.id,
    fileName: 'UserProfile.jsx',
    framework: 'React',
    scanTimeMs: 1,
    memoryUsageMb: 1,
    qualityScore: 90,
    ruleCount: 1,
    aiFixCount: 0,
    diagnostics: [],
    isFavorite: false,
  });
  await ParticipantRepository.setResearchStatus(code, 'REVOKED');

  const dataset = await ParticipantRepository.getResearchDataset();
  assert.equal(dataset.filter((r) => r.userId === user.id).length, 0);
});
