import test from 'node:test';
import assert from 'node:assert/strict';
import { UserDB } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { ParticipantRepository } from '../src/engine/participant-repository';
import { HUMAN_STUDY_TARGET_PARTICIPANTS } from '../src/research/research-config';

/**
 * ParticipantRepository.getHistoricalRealParticipantScans() -- the complement of
 * getEligibleParticipants(): real, already-persisted scans belonging to real study-participant
 * codes (P001-P020) who are NOT currently consent-gate-eligible. Exists so a real participant's
 * genuine pre-consent/not-yet-verified activity is surfaced in the SAME downloadable CSV
 * (GET /api/admin/research-dataset) the consent-gated dataset uses, without ever claiming it is
 * PRIMARY/SECONDARY research data. See that method's own doc comment for the exact rule.
 *
 * Every test invokes the real repository directly against the real storage-provider stack
 * (this repo's existing convention -- see tests/research-dataset-consent-gate.test.ts) -- no
 * mocking, no synthetic/fabricated data.
 */

function uniqueParticipantCode(): string {
  const n = 1 + Math.floor(Math.random() * HUMAN_STUDY_TARGET_PARTICIPANTS);
  return `P${String(n).padStart(3, '0')}`;
}

async function createParticipantUser(participantCode: string, researchStatus: 'ASSIGNED' | 'CONSENT_VERIFIED' | 'REVOKED' | null) {
  const stale = UserDB.findUserByParticipantCode(participantCode);
  if (stale) UserDB.deleteUser(stale.id);
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

function setStatusById(userId: string, status: 'CONSENT_VERIFIED' | 'REVOKED') {
  return UserDB.updateUser(userId, {
    researchStatus: status,
    ...(status === 'CONSENT_VERIFIED' ? { researchConsentVerifiedAt: new Date().toISOString() } : {}),
  });
}

async function createScan(
  userId: string,
  fileName: string,
  overrides: Partial<{ framework: string; qualityScore: number; ruleCount: number; scanTimeMs: number; diagnostics: any[] }> = {}
) {
  const provider = RepositoryFactory.getStorageProvider();
  return provider.createScanRecord({
    userId,
    fileName,
    framework: overrides.framework ?? 'React',
    scanTimeMs: overrides.scanTimeMs ?? 42,
    memoryUsageMb: 1,
    qualityScore: overrides.qualityScore ?? 77,
    ruleCount: overrides.ruleCount ?? (overrides.diagnostics?.length ?? 1),
    aiFixCount: 0,
    diagnostics: overrides.diagnostics ?? [],
    isFavorite: false,
  });
}

test('getHistoricalRealParticipantScans: an ASSIGNED (not yet consent-verified) participant\'s real scans appear, labeled HISTORICAL_REAL, never fabricated', async () => {
  RepositoryFactory.resetProvider();
  const code = uniqueParticipantCode();
  const user = await createParticipantUser(code, 'ASSIGNED');
  const scan = await createScan(user.id, 'RealHistoricalFile.tsx', {
    framework: 'Vue',
    qualityScore: 88,
    scanTimeMs: 123.45,
    diagnostics: [
      { ruleId: 'FIGM-ANG-01', domain: 'PERFORMANCE', concern: 'ARCHITECTURE' },
      { ruleId: 'FIGM-PERF-02', domain: 'PERFORMANCE', concern: 'LAYOUT_INSTABILITY' },
      { ruleId: 'FIGM-A11Y-01', domain: 'ACCESSIBILITY', concern: 'KEYBOARD_ACCESSIBILITY' },
    ],
  });

  const historical = await ParticipantRepository.getHistoricalRealParticipantScans();
  const row = historical.find((r) => r.userId === user.id);

  assert.ok(row, 'a real ASSIGNED participant\'s real scan must appear in the historical lane');
  assert.equal(row!.participantId, code);
  assert.equal(row!.scanId, scan.id);
  assert.equal(row!.fileName, 'RealHistoricalFile.tsx');
  assert.equal(row!.framework, 'Vue');
  assert.equal(row!.attemptType, 'HISTORICAL_REAL', 'must never claim PRIMARY/SECONDARY -- no consent timestamp exists to earn that classification');
  assert.equal(row!.dataSource, 'PRODUCTION_REAL_HISTORICAL_PARTICIPANT');
  assert.equal(row!.qualityScore, 88, 'must be the real persisted value, never recomputed or fabricated');
  assert.equal(row!.scanTimeMs, 123.45);
  assert.equal(row!.totalFindings, 3);
  assert.equal(row!.architectureFindings, 1);
  assert.equal(row!.performanceFindings, 2, 'performanceFindings includes architecture as a sub-count, matching getResearchDataset\'s own convention');
  assert.equal(row!.accessibilityFindings, 1);

  // This lane must never itself be consent-gated: getEligibleParticipants() must independently
  // agree this participant contributes zero rows to the real research dataset.
  const consentGated = await ParticipantRepository.getResearchDataset();
  assert.equal(consentGated.filter((r) => r.userId === user.id).length, 0, 'the same scan must never ALSO appear as a consent-gated PRIMARY/SECONDARY row');
});

test('getHistoricalRealParticipantScans: a CONSENT_VERIFIED participant\'s scans are NOT duplicated into the historical lane', async () => {
  RepositoryFactory.resetProvider();
  const code = uniqueParticipantCode();
  const user = await createParticipantUser(code, 'ASSIGNED');
  setStatusById(user.id, 'CONSENT_VERIFIED');
  await createScan(user.id, 'PostConsentFile.tsx');

  const historical = await ParticipantRepository.getHistoricalRealParticipantScans();
  assert.equal(
    historical.filter((r) => r.userId === user.id).length,
    0,
    'a CONSENT_VERIFIED participant is already covered by the consent-gated lane -- must never be duplicated here'
  );
});

test('getHistoricalRealParticipantScans: a REVOKED participant\'s real scans are excluded entirely, even historically', async () => {
  RepositoryFactory.resetProvider();
  const code = uniqueParticipantCode();
  const user = await createParticipantUser(code, 'ASSIGNED');
  await createScan(user.id, 'ScanBeforeRevocation.tsx');
  setStatusById(user.id, 'REVOKED');

  const historical = await ParticipantRepository.getHistoricalRealParticipantScans();
  assert.equal(
    historical.filter((r) => r.userId === user.id).length,
    0,
    'a revocation means the data is not used -- not by the consent-gated lane, and not by the historical lane either'
  );
});

test('getHistoricalRealParticipantScans: a NOT_REGISTERED / non-study user contributes zero rows', async () => {
  RepositoryFactory.resetProvider();
  const user = await UserDB.createUser({
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: `plain-user+${Date.now()}@example.com`,
    passwordHash: 'unused-in-these-tests',
    fullName: 'Not A Participant',
    role: 'DEVELOPER',
  });
  await createScan(user.id, 'RegularUserScan.tsx');

  const historical = await ParticipantRepository.getHistoricalRealParticipantScans();
  assert.equal(historical.filter((r) => r.userId === user.id).length, 0, 'a non-participant account must never appear in the historical research lane');
});
