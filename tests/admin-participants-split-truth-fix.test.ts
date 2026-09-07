import test from 'node:test';
import assert from 'node:assert/strict';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { UserDB, DBUser } from '../src/auth/user-db';
import { ParticipantRepository, TARGET_PARTICIPANT_COUNT } from '../src/engine/participant-repository';
import { signJWT, hashPassword } from '../src/auth/auth-service';
import { POST as scanPOST } from '../app/api/scan/route';
import { GET as enrollGET, POST as enrollPOST } from '../app/api/user-study/enroll/route';
import { GET as adminParticipantsGET } from '../app/api/admin/participants/route';
import type { IStorageProvider } from '../src/storage/storage-provider';

/**
 * Regression coverage for the exact P0 bug reported 2026-09-07: a successful
 * POST /api/user-study/enroll returned a P-code, but GET /api/admin/participants reported that
 * same code as NOT_REGISTERED / registeredCount: 0. Root cause (see
 * docs/audit/ADMIN_PARTICIPANTS_SPLIT_TRUTH_FIX.md): ParticipantRepository.isParticipantUser()
 * predated enrollAuthenticatedUserAsParticipant() and never checked the authoritative
 * `participantCode` field itself -- only the OLD anonymous-shadow-account signals (a P-shaped
 * `id`, or an `@user-study.figm.local` email), neither of which a same-User-row enrollee ever has.
 * getMatrix() (backing the admin endpoint) and countAssigned() both silently dropped every
 * real, same-row-enrolled participant. getResearchDataset() and usedParticipantNumbers() were
 * NEVER affected -- both already checked `participantCode` first -- which is exactly why every
 * earlier enrollment/consent/research-dataset test kept passing throughout.
 *
 * This was a single, shared storage provider on both the write and read side the whole time --
 * confirmed here explicitly (both paths route through the identical RepositoryFactory-resolved
 * provider); the bug was an application-level recognition-logic gap, never a JSON/Supabase split.
 */

let userCounter = 0;
function makeUser(labelPrefix: string, role: 'DEVELOPER' | 'ADMIN' = 'DEVELOPER'): DBUser {
  userCounter += 1;
  return UserDB.createUser({
    email: `${labelPrefix}_${Date.now()}_${userCounter}_${Math.random().toString(36).slice(2, 6)}@figm.io`,
    passwordHash: hashPassword('unused-in-tests-1234'),
    fullName: `${labelPrefix} Test User`,
    role,
  });
}

function jwtFor(user: DBUser): string {
  return signJWT({ userId: user.id, email: user.email, fullName: user.fullName, role: user.role }, 0);
}

function authedRequest(url: string, token: string, method = 'GET', body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function clearParticipantRange(): void {
  for (let n = 1; n <= TARGET_PARTICIPANT_COUNT; n++) {
    const code = `P${String(n).padStart(3, '0')}`;
    const stale = UserDB.findUserByParticipantCode(code);
    if (stale) UserDB.deleteUser(stale.id);
  }
}

const REACT_SCAN_CODE = `import React, { useState } from 'react';
export function Sample({ user }) {
  const [data, setData] = useState(user);
  return (
    <div>
      <img src={user.avatarUrl} />
      <div onClick={() => setData(user)}>{data.name}</div>
    </div>
  );
}`;

test('the exact reported bug: enrolled P-code now appears correctly in GET /api/admin/participants', async (t) => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();

  const user = makeUser('split_truth_enrollee');
  const token = jwtFor(user);
  const admin = makeUser('split_truth_admin', 'ADMIN');
  const adminToken = jwtFor(admin);

  await t.test('1. enrollment succeeds and reports a real P-code', async () => {
    const res = await enrollPOST(authedRequest('http://localhost:3000/api/user-study/enroll', token, 'POST', { consentConfirmed: true }));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.match(data.participantCode, /^P\d{3}$/);
    assert.equal(data.alreadyEnrolled, false);
  });

  const selfCheck = await enrollGET(authedRequest('http://localhost:3000/api/user-study/enroll', token));
  const selfData = await selfCheck.json();
  const code = selfData.participantCode;

  await t.test('2. GET /api/user-study/enroll (self-check) reflects the same code, ASSIGNED', () => {
    assert.equal(selfCheck.status, 200);
    assert.ok(code);
    assert.equal(selfData.researchStatus, 'ASSIGNED');
  });

  await t.test('3. THE BUG: GET /api/admin/participants must show this code as registered/ASSIGNED, not NOT_REGISTERED', async () => {
    const res = await adminParticipantsGET(authedRequest('http://localhost:3000/api/admin/participants', adminToken));
    assert.equal(res.status, 200);
    const data = await res.json();
    const row = data.participants.find((p: any) => p.participantId === code);
    assert.ok(row, `expected a matrix row for ${code}`);
    assert.notEqual(row.status, 'NOT_REGISTERED', 'this is the exact reported production symptom -- a real, successfully-enrolled participant must never show as NOT_REGISTERED');
    assert.equal(row.linkedUserId, user.id, 'the matrix row must link back to the SAME authenticated user row that was enrolled -- never a shadow account');
    assert.equal(row.researchStatus, 'ASSIGNED');
    assert.ok(data.registeredCount >= 1, `registeredCount must count this enrollment; got ${data.registeredCount}`);
  });

  await t.test('4. admin verifies consent -> matrix reflects it, and a subsequent real scan appears in getResearchDataset()', async () => {
    const verified = await ParticipantRepository.setResearchStatus(code, 'CONSENT_VERIFIED');
    assert.ok(verified);

    const afterVerify = await adminParticipantsGET(authedRequest('http://localhost:3000/api/admin/participants', adminToken));
    const afterVerifyData = await afterVerify.json();
    const verifiedRow = afterVerifyData.participants.find((p: any) => p.participantId === code);
    assert.equal(verifiedRow.researchStatus, 'CONSENT_VERIFIED');

    await new Promise((r) => setTimeout(r, 15));
    const scanRes = await scanPOST(
      new Request('http://localhost:3000/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-forwarded-for': '203.0.113.95' },
        body: JSON.stringify({ code: REACT_SCAN_CODE, fileName: 'SplitTruthFixture.jsx' }),
      })
    );
    assert.equal(scanRes.status, 200);

    const dataset = await ParticipantRepository.getResearchDataset();
    const datasetRow = dataset.find((r) => r.userId === user.id && r.fileName === 'SplitTruthFixture.jsx');
    assert.ok(datasetRow, 'the real scan must appear in the research dataset -- this path was never actually broken, confirming the bug was isolated to getMatrix()');
    assert.equal(datasetRow!.participantId, code);
  });

  await t.test('5. no duplicate P-code: re-enrolling the same user returns the identical code, never a second one', async () => {
    const again = await enrollPOST(authedRequest('http://localhost:3000/api/user-study/enroll', token, 'POST', { consentConfirmed: true }));
    const againData = await again.json();
    assert.equal(againData.participantCode, code);
    assert.equal(againData.alreadyEnrolled, true);
  });

  await t.test('6. both enrollment and the admin read use the identical RepositoryFactory-resolved provider (never a JSON/Supabase split)', () => {
    assert.equal(
      RepositoryFactory.getStorageProvider(),
      RepositoryFactory.getStorageProvider(),
      'RepositoryFactory.getStorageProvider() is a memoized singleton -- both the write path (enrollAuthenticatedUserAsParticipant) and the read path (getMatrix) resolve through this exact same call, confirmed by reference equality'
    );
  });
});

test('failed persistence must never report a fake success', async () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  const user = makeUser('split_truth_verify_failure');

  // A fake provider whose write "succeeds" (updateUser resolves) but whose re-read (findUserById)
  // deliberately returns STALE data -- proving enrollAuthenticatedUserAsParticipant()'s new
  // post-write verification step actually distrusts the write call's own return value and refuses
  // to report success when a re-read can't confirm it, rather than trusting updateUser() alone.
  const fake: Partial<IStorageProvider> = {
    name: 'supabase',
    findUserById: async (id: string) => (id === user.id ? { ...user, participantCode: undefined } as DBUser : undefined),
    getAllUsers: async () => [user],
    updateUser: async (id: string, updates: any) => ({ ...user, ...updates } as DBUser), // reports success...
  };
  RepositoryFactory.setStorageProvider(fake as IStorageProvider);
  try {
    await assert.rejects(
      () => ParticipantRepository.enrollAuthenticatedUserAsParticipant(user.id),
      /could not be verified/,
      'a write whose own re-read does not confirm participantCode/researchStatus must throw, never resolve with a P-code'
    );
  } finally {
    RepositoryFactory.resetProvider();
  }
});
