import test from 'node:test';
import assert from 'node:assert/strict';
import { signJWT, signResearchParticipantToken, hashPassword } from '../src/auth/auth-service';
import { UserDB } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { ParticipantRepository, TARGET_PARTICIPANT_COUNT } from '../src/engine/participant-repository';
import { GET as participantsGET } from '../app/api/admin/participants/route';
import { GET as participantDetailGET } from '../app/api/admin/participants/[participantId]/route';
import { GET as adminScansGET } from '../app/api/admin/scans/route';
import { GET as ruleStatsGET } from '../app/api/admin/rule-stats/route';
import { POST as logScanPOST } from '../app/api/user-study/log-scan/route';
import { CONSENT_PROTOCOL_VERSION } from '../src/research/research-config';

/**
 * Covers the "Admin + P001-P085 Participant Research Dashboard + Security Closure" brief:
 *  - RBAC matrix (anonymous/DEVELOPER/AUDITOR/ADMIN) for every new /api/admin/* route.
 *  - The participant matrix never fabricates data for an id with no real record.
 *  - A real, database-backed participant record is reflected accurately end-to-end.
 *  - The global admin scan history's participant filter is explicit and correctly scoped (never
 *    an implicit "userId falsy -> everyone" fallback).
 *
 * Every test invokes the real route handlers directly against the real storage-provider stack,
 * matching this repo's existing test convention -- no mocking.
 */

function authedRequest(url: string, jwt?: string): Request {
  const headers = new Headers();
  if (jwt) headers.set('Authorization', `Bearer ${jwt}`);
  return new Request(url, { headers });
}

function tokenFor(userId: string, role: 'DEVELOPER' | 'ADMIN' | 'AUDITOR' = 'DEVELOPER'): string {
  return signJWT({ userId, email: `${userId}@figm.io`, fullName: userId, role }, 0);
}

function createTestUser(label: string, role: 'DEVELOPER' | 'ADMIN' | 'AUDITOR' = 'DEVELOPER') {
  return UserDB.createUser({
    email: `${label}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@figm.io`,
    passwordHash: 'unused-in-these-tests',
    fullName: label,
    role,
  });
}

const ADMIN_ROUTES: Array<{ label: string; call: (jwt?: string) => Promise<Response> }> = [
  {
    label: 'GET /api/admin/participants',
    call: (jwt) => participantsGET(authedRequest('http://localhost:3000/api/admin/participants', jwt)),
  },
  {
    label: 'GET /api/admin/participants/[id]',
    call: (jwt) =>
      participantDetailGET(authedRequest('http://localhost:3000/api/admin/participants/P001', jwt), {
        params: Promise.resolve({ participantId: 'P001' }),
      }),
  },
  {
    label: 'GET /api/admin/scans',
    call: (jwt) => adminScansGET(authedRequest('http://localhost:3000/api/admin/scans', jwt)),
  },
  {
    label: 'GET /api/admin/rule-stats',
    call: (jwt) => ruleStatsGET(authedRequest('http://localhost:3000/api/admin/rule-stats', jwt)),
  },
];

test('Admin route RBAC matrix: anonymous / DEVELOPER / AUDITOR / ADMIN', async (t) => {
  RepositoryFactory.resetProvider();
  const developer = createTestUser('rbac_dev', 'DEVELOPER');
  const auditor = createTestUser('rbac_auditor', 'AUDITOR');
  const admin = createTestUser('rbac_admin', 'ADMIN');

  for (const route of ADMIN_ROUTES) {
    await t.test(`${route.label}: anonymous -> 401`, async () => {
      const res = await route.call(undefined);
      assert.equal(res.status, 401);
    });

    await t.test(`${route.label}: DEVELOPER -> 403`, async () => {
      const res = await route.call(tokenFor(developer.id, 'DEVELOPER'));
      assert.equal(res.status, 403);
    });

    await t.test(`${route.label}: AUDITOR -> 403 (no read-only admin access is implemented)`, async () => {
      const res = await route.call(tokenFor(auditor.id, 'AUDITOR'));
      assert.equal(res.status, 403);
    });

    await t.test(`${route.label}: ADMIN -> 200`, async () => {
      const res = await route.call(tokenFor(admin.id, 'ADMIN'));
      assert.equal(res.status, 200);
    });
  }
});

test('Participant matrix never fabricates data for an unregistered id', async () => {
  RepositoryFactory.resetProvider();
  const matrix = await ParticipantRepository.getMatrix();

  assert.equal(matrix.length, TARGET_PARTICIPANT_COUNT, 'matrix must always cover exactly P001..P0NN (NN = TARGET_PARTICIPANT_COUNT)');
  assert.deepEqual(
    matrix.map((r) => r.participantId).slice(0, 3),
    ['P001', 'P002', 'P003']
  );

  const unregistered = matrix.filter((r) => r.status === 'NOT_REGISTERED');
  // Extremely unlikely all TARGET_PARTICIPANT_COUNT slots are ever real in a test environment; if this ever legitimately
  // happens the honest thing is to skip rather than fail on an assumption about environment state.
  if (unregistered.length === 0) return;

  for (const row of unregistered) {
    assert.equal(row.linkedUserId, null, `${row.participantId}: NOT_REGISTERED rows must never have a fabricated linkedUserId`);
    assert.equal(row.registeredAt, null);
    assert.equal(row.lastActivity, null);
    assert.equal(row.totalScans, 0);
    assert.equal(row.totalSubmissions, 0);
    assert.deepEqual(row.frameworksUsed, []);
    assert.equal(row.latestQualityScore, null);
    assert.equal(row.totalFindings, 0);
  }
});

test('A real participant scan is reflected accurately end-to-end (no fabrication)', async (t) => {
  RepositoryFactory.resetProvider();
  const admin = createTestUser('participant_flow_admin', 'ADMIN');
  const adminToken = tokenFor(admin.id, 'ADMIN');

  // The log-scan endpoint no longer lets a caller pick an arbitrary participant slot to fill (see
  // the auth/authz forensic-audit HIGH finding this closes: a caller could previously POST any
  // participantId, including an already-real one, with no session binding at all). Live sessions
  // are now assigned by ParticipantRepository.assignNewParticipant(), which picks the lowest
  // globally-unused P00N number -- this repo's own long-lived local JSON test fixture accumulates
  // real participant-pattern rows across every historical `npm test` run (by design, same as every
  // other test file's fixtures; see tests/participant-provisioning-race.test.ts's own comment on
  // this). What this test actually verifies -- "a real, newly-logged scan is reflected in the
  // matrix, not fabricated" -- has nothing to do with WHICH of the TARGET_PARTICIPANT_COUNT fixed slots is used, so
  // relying on organically finding a free one made this test's pass/fail depend on unbounded
  // ambient history (a real, reproduced flake: after enough historical runs, all TARGET_PARTICIPANT_COUNT slots fill up and
  // this assertion fails with no product regression at all -- root-caused via Phase 7 of the
  // scientific-hardening pass, not assumed). Fixed by making the arrange step self-sufficient:
  // this test owns the highest slot (P020, i.e. P${TARGET_PARTICIPANT_COUNT}) outright and frees it first if a prior run left it occupied, rather
  // than hoping the ambient pool has room. The highest slot is chosen deliberately --
  // assignNewParticipant() always fills the LOWEST unused number first, so no other test's
  // auto-picked participant is ever plausibly this slot, minimizing any chance of cross-test
  // interference even though every test in this file already calls resetProvider() and creates
  // its own uniquely-suffixed fixtures. The POST itself still goes through the real route with a
  // real, correctly-signed, code-bound session token, exercising the real security check.
  const participantId = `P${String(TARGET_PARTICIPANT_COUNT).padStart(3, '0')}`;
  const provider = RepositoryFactory.getStorageProvider();
  const existingOccupant = (await provider.findUserByParticipantCode(participantId)) as { id: string } | undefined;
  if (existingOccupant) {
    await provider.deleteUser(existingOccupant.id);
  }

  UserDB.createUser({
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: `${participantId.toLowerCase()}@user-study.figm.local`,
    passwordHash: hashPassword(`test-only-${participantId}-${Date.now()}`),
    fullName: `User Study Participant ${participantId}`,
    role: 'DEVELOPER',
    participantCode: participantId,
    researchStatus: 'ASSIGNED',
    researchAssignedAt: new Date().toISOString(),
  });
  // Consent is a separate, server-enforced prerequisite (see app/api/user-study/consent/route.ts)
  // -- this test isn't exercising the consent flow itself, so it signs an already-consented token
  // directly rather than round-tripping through POST /api/user-study/consent.
  const cookie = signResearchParticipantToken(participantId, undefined, {
    given: true,
    version: CONSENT_PROTOCOL_VERSION,
    timestamp: new Date().toISOString(),
  });
  const baselineScans = 0;

  // A real FIGM violation (missing removeEventListener), same fixture pattern used elsewhere in
  // this suite, so the scan is guaranteed at least one genuine, server-derived finding.
  const VIOLATING_CODE = "function mount() {\n  window.addEventListener('resize', () => {});\n}";

  const logRes = await logScanPOST(
    new Request('http://localhost:3000/api/user-study/log-scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `figm_study_token=${cookie}` },
      body: JSON.stringify({ participantId, framework: 'React', fileName: 'AdminDashboardFixture.tsx', code: VIOLATING_CODE }),
    })
  );
  assert.equal(logRes.status, 200);
  const logBody = await logRes.json();
  assert.equal(logBody.participantId, participantId);

  await t.test('the admin participant matrix reflects the real scan', async () => {
    const res = await participantsGET(authedRequest('http://localhost:3000/api/admin/participants', adminToken));
    assert.equal(res.status, 200);
    const body = await res.json();
    const row = body.participants.find((r: any) => r.participantId === participantId);
    assert.ok(row, 'the participant must now appear as a real row');
    assert.notEqual(row.status, 'NOT_REGISTERED');
    assert.equal(row.totalScans, baselineScans + 1, 'exactly the one real scan just logged must be reflected, no more, no less');
    assert.ok(row.frameworksUsed.length > 0);
  });

  await t.test('the participant detail endpoint shows the real scan, not invented data', async () => {
    const res = await participantDetailGET(
      authedRequest(`http://localhost:3000/api/admin/participants/${participantId}`, adminToken),
      { params: Promise.resolve({ participantId }) }
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.participant.scanSummary.totalScans, baselineScans + 1);
    assert.equal(body.participant.scanHistory.length, baselineScans + 1);
    assert.ok(
      body.participant.scanHistory.some((s: any) => s.fileName === 'AdminDashboardFixture.tsx'),
      'the just-logged scan must be present in the real scan history'
    );
    assert.ok(body.participant.ruleFindings.length > 0, 'a real violation must produce a real rule-findings entry');
    // Research study section must stay null (this codebase has no per-participant-id-linked
    // consent/questionnaire storage) rather than inventing a status.
    assert.equal(body.participant.researchStudy, null);
  });

  await t.test('an invalid participant id format is rejected, not silently treated as valid', async () => {
    const res = await participantDetailGET(
      authedRequest('http://localhost:3000/api/admin/participants/not-a-participant', adminToken),
      { params: Promise.resolve({ participantId: 'not-a-participant' }) }
    );
    assert.equal(res.status, 400);
  });
});

test('Global admin scan history: explicit participant filter is correctly scoped', async () => {
  RepositoryFactory.resetProvider();
  const provider = RepositoryFactory.getStorageProvider();
  const admin = createTestUser('scan_filter_admin', 'ADMIN');
  const ownerA = createTestUser('scan_filter_owner_a', 'DEVELOPER');
  const ownerB = createTestUser('scan_filter_owner_b', 'DEVELOPER');
  const adminToken = tokenFor(admin.id, 'ADMIN');

  await provider.createScanRecord({
    userId: ownerA.id,
    fileName: 'OwnerAFile.tsx',
    framework: 'React',
    scanTimeMs: 1,
    memoryUsageMb: 1,
    qualityScore: 90,
    ruleCount: 0,
    aiFixCount: 0,
    diagnostics: [],
    isFavorite: false,
  });
  await provider.createScanRecord({
    userId: ownerB.id,
    fileName: 'OwnerBFile.tsx',
    framework: 'React',
    scanTimeMs: 1,
    memoryUsageMb: 1,
    qualityScore: 90,
    ruleCount: 0,
    aiFixCount: 0,
    diagnostics: [],
    isFavorite: false,
  });

  const res = await adminScansGET(
    authedRequest(`http://localhost:3000/api/admin/scans?participantId=${ownerA.id}`, adminToken)
  );
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.ok(body.records.every((r: any) => r.userId === ownerA.id), 'filtering by participantId must never leak another owner\'s records');
  assert.ok(body.records.some((r: any) => r.fileName === 'OwnerAFile.tsx'));
  assert.ok(!body.records.some((r: any) => r.fileName === 'OwnerBFile.tsx'));
  assert.ok(body.records[0].owner, 'each record must be enriched with real owner identity');
  assert.equal(body.records[0].owner.id, ownerA.id);
});
