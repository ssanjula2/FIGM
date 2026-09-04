import test from 'node:test';
import assert from 'node:assert/strict';
import { UserDB } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { ParticipantRepository } from '../src/engine/participant-repository';
import { HUMAN_STUDY_TARGET_PARTICIPANTS } from '../src/research/research-config';

/**
 * Stage 11B — Repeated-Scan Policy.
 *
 * Policy: a real participant may scan the same study fixture multiple times (never blocked in the
 * UI). For PRIMARY human-study analysis, only the FIRST valid post-consent attempt per
 * (participant, fixture) counts. Later valid post-consent attempts are preserved as SECONDARY
 * interaction data -- never dropped, never overwritten, never counted as an additional primary
 * observation. Pre-consent, QA/protocol (ASSIGNED-only), and REVOKED activity remain fully
 * excluded, unchanged from Stage 8A/11A.
 *
 * Every test invokes the real repository directly against the real storage-provider stack, no
 * mocking, matching this repo's existing test convention (see
 * tests/research-dataset-consent-gate.test.ts for the underlying consent-gate coverage this file
 * does not duplicate).
 */

function uniqueParticipantCode(): string {
  // Must fall inside the real study range (P001..P0<HUMAN_STUDY_TARGET_PARTICIPANTS>) so these
  // scenarios actually exercise getResearchDataset()'s inclusion path now that it enforces
  // isRealStudyParticipantCode() (Phase 2 range guard, src/engine/participant-repository.ts) --
  // this file tests consent-timing/PRIMARY-SECONDARY behavior, not the range guard itself (see
  // tests/research-dataset-range-guard.test.ts for that). The user/email/id are still randomized
  // per call so repeated local runs never collide on email uniqueness, even though the code
  // itself may repeat across runs (the JSON test-storage backend does not enforce participantCode
  // uniqueness, matching this file's existing convention of filtering results by the freshly
  // created user's own id, never by code).
  const n = 1 + Math.floor(Math.random() * HUMAN_STUDY_TARGET_PARTICIPANTS);
  return `P${String(n).padStart(3, '0')}`;
}

async function createParticipantUser(participantCode: string, researchStatus: 'ASSIGNED' | 'CONSENT_VERIFIED' | 'REVOKED' | null) {
  // The local JSON test-storage backend, unlike real Postgres, does not enforce participantCode
  // uniqueness, and accumulates rows across every local test run with no cleanup (by design --
  // this file's own tests never delete their fixtures). uniqueParticipantCode() now draws from
  // only HUMAN_STUDY_TARGET_PARTICIPANTS (20) real slots, so a stale same-coded row from an
  // earlier run is likely already present. findUserByParticipantCode() (used by
  // ParticipantRepository.setResearchStatus() below) resolves to the FIRST matching row -- if a
  // stale duplicate exists, setResearchStatus would silently update THAT row instead of the one
  // this test just created, and this test's own assertions (which filter by this fresh user's own
  // id) would then see it as still ASSIGNED. Purge any pre-existing row for this exact code first
  // so the code unambiguously resolves to the fresh row this test creates.
  const stale = UserDB.findUserByParticipantCode(participantCode);
  if (stale) UserDB.deleteUser(stale.id);
  // Email is decoupled from the participant code with a random suffix (still recognized by
  // isParticipantUser()'s endsWith('@user-study.figm.local') check): once uniqueParticipantCode()
  // was changed to pick from only HUMAN_STUDY_TARGET_PARTICIPANTS (20) real slots instead of a
  // 90,000-wide synthetic range, an email built purely from the code (the prior pattern) collided
  // across tests/runs almost immediately (~20-slot birthday paradox), since email is UserDB's real
  // uniqueness key -- see src/auth/user-db.ts:333's P2002 check.
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

/**
 * Sets research status by the exact user id rather than through
 * ParticipantRepository.setResearchStatus(code, status) (which resolves by participant CODE).
 * Real Postgres enforces participantCode uniqueness, so that ambiguity cannot occur there --
 * setResearchStatus's own code-resolution behavior has dedicated coverage in
 * tests/qa-baseline-cleanup-regression.test.ts and tests/participant-provisioning-race.test.ts.
 * This file is about getResearchDataset()'s consent-timing/PRIMARY-SECONDARY logic given a known
 * DB state, which addressing by id gives deterministically regardless of what the local JSON
 * test-storage backend's non-unique-code accumulation looks like on any given run.
 */
function setStatusById(userId: string, status: 'CONSENT_VERIFIED' | 'REVOKED') {
  return UserDB.updateUser(userId, {
    researchStatus: status,
    ...(status === 'CONSENT_VERIFIED' ? { researchConsentVerifiedAt: new Date().toISOString() } : {}),
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

test('first eligible post-consent scan of a fixture is chosen as PRIMARY', async () => {
  RepositoryFactory.resetProvider();
  const code = uniqueParticipantCode();
  const user = await createParticipantUser(code, 'ASSIGNED');
  setStatusById(user.id, 'CONSENT_VERIFIED');
  await sleep(15);

  const firstScan = await createScan(user.id, 'UserProfile.jsx');

  const dataset = await ParticipantRepository.getResearchDataset();
  const rows = dataset.filter((r) => r.userId === user.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].scanId, firstScan.id);
  assert.equal(rows[0].attemptType, 'PRIMARY');
});

test('later valid post-consent scans of the same fixture are retained as SECONDARY, never counted as additional primary observations', async () => {
  RepositoryFactory.resetProvider();
  const code = uniqueParticipantCode();
  const user = await createParticipantUser(code, 'ASSIGNED');
  setStatusById(user.id, 'CONSENT_VERIFIED');
  await sleep(15);

  const firstScan = await createScan(user.id, 'UserProfile.jsx');
  await sleep(15);
  const secondScan = await createScan(user.id, 'UserProfile.jsx');
  await sleep(15);
  const thirdScan = await createScan(user.id, 'UserProfile.jsx');

  const dataset = await ParticipantRepository.getResearchDataset();
  const rows = dataset.filter((r) => r.userId === user.id);
  assert.equal(rows.length, 3, 'all three real attempts must be preserved, none dropped');

  const primary = ParticipantRepository.filterPrimaryResearchAttempts(rows);
  const secondary = ParticipantRepository.filterSecondaryResearchAttempts(rows);
  assert.equal(primary.length, 1, 'exactly one PRIMARY observation per (participant, fixture)');
  assert.equal(primary[0].scanId, firstScan.id);
  assert.equal(secondary.length, 2, 'both later attempts must be preserved as SECONDARY');
  assert.deepEqual(secondary.map((r) => r.scanId).sort(), [secondScan.id, thirdScan.id].sort());
});

test('a different fixture gets its own independent PRIMARY attempt, even for the same participant', async () => {
  RepositoryFactory.resetProvider();
  const code = uniqueParticipantCode();
  const user = await createParticipantUser(code, 'ASSIGNED');
  setStatusById(user.id, 'CONSENT_VERIFIED');
  await sleep(15);

  const reactPrimary = await createScan(user.id, 'UserProfile.jsx');
  await sleep(15);
  await createScan(user.id, 'UserProfile.jsx'); // React secondary
  await sleep(15);
  const nextPrimary = await createScan(user.id, 'DashboardPage.tsx');

  const dataset = await ParticipantRepository.getResearchDataset();
  const rows = dataset.filter((r) => r.userId === user.id);
  const primary = ParticipantRepository.filterPrimaryResearchAttempts(rows);
  assert.equal(primary.length, 2, 'one PRIMARY per distinct fixture, not one per participant overall');
  assert.deepEqual(primary.map((r) => r.scanId).sort(), [reactPrimary.id, nextPrimary.id].sort());
});

test('pre-consent scans remain excluded entirely -- never appear as PRIMARY or SECONDARY', async () => {
  RepositoryFactory.resetProvider();
  const code = uniqueParticipantCode();
  const user = await createParticipantUser(code, 'ASSIGNED');

  // Two pre-consent attempts (e.g. before an admin ever reconciled real consent).
  await createScan(user.id, 'UserProfile.jsx');
  await sleep(15);
  await createScan(user.id, 'UserProfile.jsx');
  await sleep(15);

  setStatusById(user.id, 'CONSENT_VERIFIED');
  await sleep(15);
  const postConsentScan = await createScan(user.id, 'UserProfile.jsx');

  const dataset = await ParticipantRepository.getResearchDataset();
  const rows = dataset.filter((r) => r.userId === user.id);
  assert.equal(rows.length, 1, 'only the single post-consent attempt is eligible at all');
  assert.equal(rows[0].scanId, postConsentScan.id);
  assert.equal(rows[0].attemptType, 'PRIMARY');
});

test('repeat scans never overwrite or delete the first attempt (raw scan history is append-only)', async () => {
  RepositoryFactory.resetProvider();
  const code = uniqueParticipantCode();
  const user = await createParticipantUser(code, 'ASSIGNED');
  setStatusById(user.id, 'CONSENT_VERIFIED');
  await sleep(15);

  const firstScan = await createScan(user.id, 'UserProfile.jsx');
  await sleep(15);
  await createScan(user.id, 'UserProfile.jsx');

  const provider = RepositoryFactory.getStorageProvider();
  const rawScans = (await provider.getScanRecords(user.id)) as any[];
  const stillPresent = rawScans.find((s) => s.id === firstScan.id);
  assert.ok(stillPresent, 'the first attempt\'s raw scan_reports row must still exist, untouched');
  assert.equal(stillPresent.fileName, firstScan.fileName);
  assert.equal(rawScans.length, 2, 'both raw rows must exist -- nothing was deleted');
});

test('REVOKED participant contributes zero PRIMARY or SECONDARY rows, even with repeated post-consent-era scans', async () => {
  RepositoryFactory.resetProvider();
  const code = uniqueParticipantCode();
  const user = await createParticipantUser(code, 'ASSIGNED');
  setStatusById(user.id, 'CONSENT_VERIFIED');
  await sleep(15);
  await createScan(user.id, 'UserProfile.jsx');
  await sleep(15);
  await createScan(user.id, 'UserProfile.jsx');
  setStatusById(user.id, 'REVOKED');

  const dataset = await ParticipantRepository.getResearchDataset();
  const rows = dataset.filter((r) => r.userId === user.id);
  assert.equal(rows.length, 0, 'a REVOKED participant must contribute zero rows of any attemptType');
});

test('an ASSIGNED-only (QA/protocol) participant contributes zero PRIMARY or SECONDARY rows, even with repeated scans', async () => {
  RepositoryFactory.resetProvider();
  const code = uniqueParticipantCode();
  const user = await createParticipantUser(code, 'ASSIGNED');
  await createScan(user.id, 'test.tsx');
  await sleep(15);
  await createScan(user.id, 'test.tsx');

  const dataset = await ParticipantRepository.getResearchDataset();
  const rows = dataset.filter((r) => r.userId === user.id);
  assert.equal(rows.length, 0, 'an ASSIGNED (never consent-verified) participant must contribute zero rows regardless of repeat-scan count');
});
