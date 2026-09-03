import test from 'node:test';
import assert from 'node:assert/strict';
import { UserDB } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { ParticipantRepository } from '../src/engine/participant-repository';

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

function uniqueParticipantCode(prefix: string): string {
  // A real P-pattern code (matches PARTICIPANT_ID_PATTERN = /^P\d{3,6}$/) but far outside
  // TARGET_PARTICIPANT_COUNT's normal range, so it never collides with a slot any other test or
  // assignNewParticipant() call could organically pick.
  const n = 900000 + Math.floor(Math.random() * 90000);
  return `P${n}`;
}

async function createParticipantUser(
  participantCode: string,
  researchStatus: 'ASSIGNED' | 'CONSENT_VERIFIED' | 'REVOKED' | null
) {
  return UserDB.createUser({
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: `${participantCode.toLowerCase()}@user-study.figm.local`,
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
