import test from 'node:test';
import assert from 'node:assert/strict';
import { UserDB } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { ParticipantRepository } from '../src/engine/participant-repository';
import { HUMAN_STUDY_TARGET_PARTICIPANTS } from '../src/research/research-config';

/**
 * Stage 8A — Research Dataset Baseline Safety.
 *
 * ParticipantRepository.getResearchDataset() is the ONLY safe source of scan-level data for real
 * research analysis/exports. It must apply the study's actual eligibility rule server-side:
 *   researchStatus === 'CONSENT_VERIFIED' AND scan.createdAt >= researchConsentVerifiedAt
 * This is deliberately separate from getMatrix/getDetail (the admin operational dashboard), which
 * intentionally keeps showing an admin every real scan for a slot -- including pre-consent
 * activity -- so a human can decide whether to CONSENT_VERIFIED or REVOKE it. These tests only
 * cover getResearchDataset's gate, not that operational dashboard (see
 * tests/admin-research-dashboard.test.ts for that).
 *
 * Every test invokes the real repository directly against the real storage-provider stack,
 * matching this repo's existing test convention -- no mocking.
 */

function uniqueParticipantCode(_prefix: string): string {
  // Must fall inside the real study range (P001..P0<HUMAN_STUDY_TARGET_PARTICIPANTS>) so tests
  // that expect real inclusion actually exercise getResearchDataset()'s isRealStudyParticipantCode()
  // gate (Phase 2 range guard, src/engine/participant-repository.ts) rather than being trivially
  // excluded by range regardless of consent status. Out-of-range exclusion itself is covered by
  // tests/research-dataset-range-guard.test.ts. The user/email/id are still randomized per call so
  // repeated local runs never collide on email uniqueness (the JSON test-storage backend does not
  // enforce participantCode uniqueness; every assertion below filters by the freshly created
  // user's own id, never by code, so a repeated code across runs/tests is harmless).
  const n = 1 + Math.floor(Math.random() * HUMAN_STUDY_TARGET_PARTICIPANTS);
  return `P${String(n).padStart(3, '0')}`;
}

async function createParticipantUser(
  participantCode: string,
  researchStatus: 'ASSIGNED' | 'CONSENT_VERIFIED' | 'REVOKED' | null
) {
  // The local JSON test-storage backend, unlike real Postgres, does not enforce participantCode
  // uniqueness, and accumulates rows across every local test run with no cleanup. Since
  // uniqueParticipantCode() now draws from only HUMAN_STUDY_TARGET_PARTICIPANTS (20) real slots, a
  // stale same-coded row from an earlier run is likely already present. findUserByParticipantCode()
  // (used by ParticipantRepository.setResearchStatus() in these tests) resolves to the FIRST
  // matching row -- if a stale duplicate exists, setResearchStatus would silently update THAT row
  // instead of the one this test just created. Purge any pre-existing row for this exact code
  // first so it unambiguously resolves to the fresh row this test creates.
  const stale = UserDB.findUserByParticipantCode(participantCode);
  if (stale) UserDB.deleteUser(stale.id);
  // Email is decoupled from the participant code with a random suffix (still recognized by
  // isParticipantUser()'s endsWith('@user-study.figm.local') check) purely to avoid confusion when
  // reading the JSON file by hand -- uniqueness itself is guaranteed by the timestamp+random suffix,
  // not by which code it's derived from.
  return UserDB.createUser({
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: `${participantCode.toLowerCase()}+${Date.now()}_${Math.random().toString(36).slice(2, 7)}@user-study.figm.local`,
    passwordHash: 'unused-in-these-tests',
    fullName: `User Study Participant ${participantCode}`,
    role: 'DEVELOPER',
    participantCode,
    researchStatus: researchStatus ?? undefined,
    researchAssignedAt: researchStatus ? new Date().toISOString() : undefined,
  });
}

async function createScan(userId: string, fileName: string) {
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

/**
 * Sets research status directly on the exact user id, guaranteeing which row is affected
 * regardless of whether the local JSON test-storage backend (which does not enforce
 * participantCode uniqueness, unlike real Postgres) currently holds another row sharing this
 * test's randomly-drawn code. Used alongside (never instead of) an actual
 * ParticipantRepository.setResearchStatus(code, ...) call where a test also wants to assert on
 * that function's own return value.
 */
function setStatusById(userId: string, status: 'CONSENT_VERIFIED' | 'REVOKED') {
  return UserDB.updateUser(userId, {
    researchStatus: status,
    ...(status === 'CONSENT_VERIFIED' ? { researchConsentVerifiedAt: new Date().toISOString() } : {}),
  });
}

test('getResearchDataset: ASSIGNED-only participant contributes zero rows', async () => {
  RepositoryFactory.resetProvider();
  const code = uniqueParticipantCode('assigned');
  const user = await createParticipantUser(code, 'ASSIGNED');
  await createScan(user.id, 'PreConsentScan.tsx');
  await createScan(user.id, 'AnotherPreConsentScan.tsx');

  const dataset = await ParticipantRepository.getResearchDataset();
  const rowsForUser = dataset.filter((r) => r.userId === user.id);

  assert.equal(rowsForUser.length, 0, 'an ASSIGNED-only participant (never consent-verified) must contribute zero research rows');
});

test('getResearchDataset: CONSENT_VERIFIED participant contributes only post-consent scans', async () => {
  RepositoryFactory.resetProvider();
  const code = uniqueParticipantCode('consented');
  const user = await createParticipantUser(code, 'ASSIGNED');

  // Pre-consent scan (e.g. a QA/smoke-test run before the researcher reconciled real consent).
  await createScan(user.id, 'PreConsentScan.tsx');
  await sleep(15);

  const verified = await ParticipantRepository.setResearchStatus(code, 'CONSENT_VERIFIED');
  assert.ok(verified, 'setResearchStatus must succeed for a real registered participant');
  // Guarantees THIS test's own user is the one actually left CONSENT_VERIFIED for the assertions
  // below, independent of which row setResearchStatus's code-based lookup happened to affect (see
  // setStatusById's doc comment).
  setStatusById(user.id, 'CONSENT_VERIFIED');
  await sleep(15);

  // Post-consent scan (the real study interaction).
  const postConsentScan = await createScan(user.id, 'PostConsentScan.tsx');

  const dataset = await ParticipantRepository.getResearchDataset();
  const rowsForUser = dataset.filter((r) => r.userId === user.id);

  assert.equal(rowsForUser.length, 1, 'only the scan created at/after researchConsentVerifiedAt must be included');
  assert.equal(rowsForUser[0].scanId, postConsentScan.id);
  assert.equal(rowsForUser[0].fileName, 'PostConsentScan.tsx');
  assert.ok(!rowsForUser.some((r) => r.fileName === 'PreConsentScan.tsx'), 'the pre-consent scan must never leak into the research dataset');
});

test('getResearchDataset: REVOKED participant contributes zero rows even with real scans', async () => {
  RepositoryFactory.resetProvider();
  const code = uniqueParticipantCode('revoked');
  const user = await createParticipantUser(code, 'ASSIGNED');
  await createScan(user.id, 'ContaminatedScan.tsx');

  const revoked = await ParticipantRepository.setResearchStatus(code, 'REVOKED');
  assert.ok(revoked);

  const dataset = await ParticipantRepository.getResearchDataset();
  const rowsForUser = dataset.filter((r) => r.userId === user.id);

  assert.equal(rowsForUser.length, 0, 'a REVOKED participant assignment must never contribute rows to the research dataset');
});

test('getResearchDataset: an unrelated normal product user is excluded entirely', async () => {
  RepositoryFactory.resetProvider();
  const normalUser = UserDB.createUser({
    email: `normal_product_user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@figm.io`,
    passwordHash: 'unused-in-these-tests',
    fullName: 'Normal Product User',
    role: 'DEVELOPER',
  });
  await createScan(normalUser.id, 'OrdinaryProductScan.tsx');

  const dataset = await ParticipantRepository.getResearchDataset();
  const rowsForUser = dataset.filter((r) => r.userId === normalUser.id);

  assert.equal(rowsForUser.length, 0, 'an ordinary (non-study) product account must never appear in the research dataset, regardless of researchStatus');
});
