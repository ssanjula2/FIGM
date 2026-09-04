import test from 'node:test';
import assert from 'node:assert/strict';
import { UserDB } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';
import {
  ParticipantRepository,
  isRealStudyParticipantCode,
  TARGET_PARTICIPANT_COUNT,
} from '../src/engine/participant-repository';

/**
 * Phase 2 regression coverage (docs/audit/PRE_STUDY_DATA_INTEGRITY_FINAL.md): getResearchDataset()
 * must only ever include participant codes in the exact declared real-study range
 * (P001..P0<TARGET_PARTICIPANT_COUNT>), never merely PARTICIPANT_ID_PATTERN-shaped. Every test
 * invokes the real repository directly against the real storage-provider stack, no mocking,
 * matching this repo's existing convention (see tests/research-dataset-consent-gate.test.ts and
 * tests/repeated-scan-attempt-policy.test.ts for the underlying consent-gate/PRIMARY-SECONDARY
 * coverage this file does not duplicate).
 */

function setStatusById(userId: string, status: 'CONSENT_VERIFIED' | 'REVOKED') {
  return UserDB.updateUser(userId, {
    researchStatus: status,
    ...(status === 'CONSENT_VERIFIED' ? { researchConsentVerifiedAt: new Date().toISOString() } : {}),
  });
}

/** Purges any pre-existing row for this exact code first (the local JSON test-storage backend,
 *  unlike real Postgres, does not enforce participantCode uniqueness and accumulates rows across
 *  every local test run) so the code unambiguously resolves to the fresh row this test creates. */
function createParticipant(code: string, researchStatus: 'ASSIGNED' | 'CONSENT_VERIFIED' | 'REVOKED' | null) {
  const stale = UserDB.findUserByParticipantCode(code);
  if (stale) UserDB.deleteUser(stale.id);
  return UserDB.createUser({
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: `${code.toLowerCase()}+${Date.now()}_${Math.random().toString(36).slice(2, 7)}@user-study.figm.local`,
    passwordHash: 'unused-in-this-test',
    fullName: `User Study Participant ${code}`,
    role: 'DEVELOPER',
    participantCode: code,
    researchStatus: researchStatus ?? undefined,
    researchAssignedAt: researchStatus ? new Date().toISOString() : undefined,
  });
}

function createScan(userId: string, fileName: string) {
  const provider = RepositoryFactory.getStorageProvider();
  return provider.createScanRecord({
    userId,
    fileName,
    framework: 'React',
    scanTimeMs: 1,
    memoryUsageMb: 1,
    qualityScore: 90,
    ruleCount: 1,
    aiFixCount: 0,
    diagnostics: [],
    isFavorite: false,
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('isRealStudyParticipantCode: P001 and P020 valid, P021/P900000/non-canonical padding invalid', () => {
  assert.equal(TARGET_PARTICIPANT_COUNT, 20, 'these fixed boundary assertions assume the real study target is 20');
  assert.equal(isRealStudyParticipantCode('P001'), true);
  assert.equal(isRealStudyParticipantCode('P020'), true);
  assert.equal(isRealStudyParticipantCode('P010'), true);
  assert.equal(isRealStudyParticipantCode('P021'), false);
  assert.equal(isRealStudyParticipantCode('P000'), false);
  assert.equal(isRealStudyParticipantCode('P900000'), false);
  assert.equal(isRealStudyParticipantCode('P0020'), false, 'non-canonical zero-padding must be rejected');
  assert.equal(isRealStudyParticipantCode('NOTACODE'), false);
  assert.equal(isRealStudyParticipantCode(''), false);
  assert.equal(isRealStudyParticipantCode(null), false);
  assert.equal(isRealStudyParticipantCode(undefined), false);
});

test('P001 CONSENT_VERIFIED with a real post-consent scan is included', async () => {
  RepositoryFactory.resetProvider();
  const user = createParticipant('P001', 'ASSIGNED');
  setStatusById(user.id, 'CONSENT_VERIFIED');
  await sleep(15);
  const scan = await createScan(user.id, 'UserProfile.jsx');

  const dataset = await ParticipantRepository.getResearchDataset();
  const rows = dataset.filter((r) => r.userId === user.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].participantId, 'P001');
  assert.equal(rows[0].scanId, (scan as any).id);
});

test('P020 CONSENT_VERIFIED with a real post-consent scan is included (upper bound of the real range)', async () => {
  RepositoryFactory.resetProvider();
  const user = createParticipant('P020', 'ASSIGNED');
  setStatusById(user.id, 'CONSENT_VERIFIED');
  await sleep(15);
  const scan = await createScan(user.id, 'UserProfile.jsx');

  const dataset = await ParticipantRepository.getResearchDataset();
  const rows = dataset.filter((r) => r.userId === user.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].participantId, 'P020');
  assert.equal(rows[0].scanId, (scan as any).id);
});

test('P021 CONSENT_VERIFIED is excluded -- one past the declared real-study range', async () => {
  RepositoryFactory.resetProvider();
  const user = createParticipant('P021', 'ASSIGNED');
  setStatusById(user.id, 'CONSENT_VERIFIED');
  await sleep(15);
  await createScan(user.id, 'UserProfile.jsx');

  const dataset = await ParticipantRepository.getResearchDataset();
  assert.equal(dataset.filter((r) => r.userId === user.id).length, 0);
});

test('P900000 CONSENT_VERIFIED is excluded -- an operational/QA-fixture-shaped code, never a real study slot', async () => {
  RepositoryFactory.resetProvider();
  const user = createParticipant('P900000', 'ASSIGNED');
  setStatusById(user.id, 'CONSENT_VERIFIED');
  await sleep(15);
  await createScan(user.id, 'UserProfile.jsx');

  const dataset = await ParticipantRepository.getResearchDataset();
  assert.equal(dataset.filter((r) => r.userId === user.id).length, 0);
});

test('an ordinary (non-participant) developer account is excluded even with real scans', async () => {
  RepositoryFactory.resetProvider();
  const user = UserDB.createUser({
    email: `ordinary_dev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@figm.io`,
    passwordHash: 'unused-in-this-test',
    fullName: 'Ordinary Developer',
    role: 'DEVELOPER',
  });
  await createScan(user.id, 'UserProfile.jsx');

  const dataset = await ParticipantRepository.getResearchDataset();
  assert.equal(dataset.filter((r) => r.userId === user.id).length, 0);
});

test('ASSIGNED (never consent-verified) P001 is excluded', async () => {
  RepositoryFactory.resetProvider();
  const user = createParticipant('P001', 'ASSIGNED');
  await createScan(user.id, 'UserProfile.jsx');

  const dataset = await ParticipantRepository.getResearchDataset();
  assert.equal(dataset.filter((r) => r.userId === user.id).length, 0);
});

test('a pre-consent P001 scan is excluded even after later consent verification', async () => {
  RepositoryFactory.resetProvider();
  const user = createParticipant('P001', 'ASSIGNED');
  await createScan(user.id, 'UserProfile.jsx');
  await sleep(15);
  setStatusById(user.id, 'CONSENT_VERIFIED');

  const dataset = await ParticipantRepository.getResearchDataset();
  assert.equal(dataset.filter((r) => r.userId === user.id).length, 0, 'the scan predates consent verification');
});

test('a post-consent P001 scan is included', async () => {
  RepositoryFactory.resetProvider();
  const user = createParticipant('P001', 'ASSIGNED');
  setStatusById(user.id, 'CONSENT_VERIFIED');
  await sleep(15);
  const postConsentScan = await createScan(user.id, 'UserProfile.jsx');

  const dataset = await ParticipantRepository.getResearchDataset();
  const rows = dataset.filter((r) => r.userId === user.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].scanId, (postConsentScan as any).id);
});

test('REVOKED P001 is excluded even with real post-consent-era scans', async () => {
  RepositoryFactory.resetProvider();
  const user = createParticipant('P001', 'ASSIGNED');
  setStatusById(user.id, 'CONSENT_VERIFIED');
  await sleep(15);
  await createScan(user.id, 'UserProfile.jsx');
  setStatusById(user.id, 'REVOKED');

  const dataset = await ParticipantRepository.getResearchDataset();
  assert.equal(dataset.filter((r) => r.userId === user.id).length, 0);
});

test('PRIMARY/SECONDARY classification is unchanged by the range guard for an in-range participant', async () => {
  RepositoryFactory.resetProvider();
  const user = createParticipant('P001', 'ASSIGNED');
  setStatusById(user.id, 'CONSENT_VERIFIED');
  await sleep(15);
  const first = await createScan(user.id, 'UserProfile.jsx');
  await sleep(15);
  const second = await createScan(user.id, 'UserProfile.jsx');

  const dataset = await ParticipantRepository.getResearchDataset();
  const rows = dataset.filter((r) => r.userId === user.id);
  const primary = ParticipantRepository.filterPrimaryResearchAttempts(rows);
  const secondary = ParticipantRepository.filterSecondaryResearchAttempts(rows);
  assert.equal(primary.length, 1, 'exactly one PRIMARY observation');
  assert.equal(primary[0].scanId, (first as any).id);
  assert.equal(secondary.length, 1, 'the repeat attempt is preserved as SECONDARY');
  assert.equal(secondary[0].scanId, (second as any).id);
});

test('the participant target denominator remains exactly 20', () => {
  assert.equal(TARGET_PARTICIPANT_COUNT, 20);
});
