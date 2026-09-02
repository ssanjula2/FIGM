import test from 'node:test';
import assert from 'node:assert/strict';
import { UserDB } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { GET as logScanGET, POST as logScanPOST } from '../app/api/user-study/log-scan/route';
import { POST as consentPOST } from '../app/api/user-study/consent/route';
import { ParticipantRepository } from '../src/engine/participant-repository';

/**
 * Regression coverage for:
 * 1) Phase 11 closure (pre-existing): UserDB.createUser check-then-act race on user creation.
 * 2) The auth/authz forensic-audit HIGH finding on POST /api/user-study/log-scan: the endpoint
 *    previously accepted ANY caller-chosen participantId with zero authentication or session
 *    binding at all -- live-reproduced by writing a fabricated scan onto an already-existing real
 *    participant id. The fix: GET issues a signed, httpOnly, single-participant-scoped session
 *    cookie server-side (ParticipantRepository.assignNewParticipant); POST trusts only that cookie,
 *    never a client-supplied participantId, and rejects anonymous/mismatched/revoked sessions.
 */

const SIMPLE_REACT_CODE = `
export function Widget() {
  return <div onClick={() => {}}>Click me</div>;
}
`;

test('UserDB.createUser throws a P2002-coded error on a duplicate id (mirrors Prisma unique-constraint behavior)', () => {
  const id = `race_id_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  UserDB.createUser({ id, email: `${id}@figm.io`, passwordHash: 'x', fullName: 'Race Test', role: 'DEVELOPER' });

  assert.throws(
    () => UserDB.createUser({ id, email: `different_${id}@figm.io`, passwordHash: 'x', fullName: 'Race Test 2', role: 'DEVELOPER' }),
    (err: any) => err?.code === 'P2002'
  );
});

test('UserDB.createUser throws a P2002-coded error on a duplicate email', () => {
  const email = `race_email_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@figm.io`;
  UserDB.createUser({ email, passwordHash: 'x', fullName: 'Race Test', role: 'DEVELOPER' });

  assert.throws(
    () => UserDB.createUser({ email, passwordHash: 'x', fullName: 'Race Test 2', role: 'DEVELOPER' }),
    (err: any) => err?.code === 'P2002'
  );
});

function studyRequest(url: string, cookie?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('x-forwarded-for', `10.60.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`);
  if (cookie) headers.set('cookie', `figm_study_token=${cookie}`);
  return new Request(url, { ...init, headers });
}

test('two concurrent GET session assignments (no existing cookie) each get a distinct, valid participant code', async () => {
  RepositoryFactory.resetProvider();

  const [resA, resB] = await Promise.all([
    logScanGET(studyRequest('http://localhost:3000/api/user-study/log-scan')),
    logScanGET(studyRequest('http://localhost:3000/api/user-study/log-scan')),
  ]);

  assert.equal(resA.status, 200);
  assert.equal(resB.status, 200);

  const bodyA = await resA.json();
  const bodyB = await resB.json();

  assert.ok(bodyA.participantId, 'response A must include a participantId');
  assert.ok(bodyB.participantId, 'response B must include a participantId');
  assert.notEqual(bodyA.participantId, bodyB.participantId, 'concurrent assignments must not collide on the same code');

  const cookieA = resA.cookies.get('figm_study_token')?.value;
  const cookieB = resB.cookies.get('figm_study_token')?.value;
  assert.ok(cookieA, 'response A must set a session cookie');
  assert.ok(cookieB, 'response B must set a session cookie');
});

test('POST with no session cookie (anonymous) is rejected with 401, never persists a scan', async () => {
  const res = await logScanPOST(
    studyRequest('http://localhost:3000/api/user-study/log-scan', undefined, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ participantId: 'P001', framework: 'React', fileName: 'Widget.tsx', code: SIMPLE_REACT_CODE }),
    })
  );
  assert.equal(res.status, 401);
});

test('POST whose session is bound to participant A but claims participant B is rejected with 403', async () => {
  const getRes = await logScanGET(studyRequest('http://localhost:3000/api/user-study/log-scan'));
  const { participantId: ownParticipantId } = await getRes.json();
  const cookie = getRes.cookies.get('figm_study_token')?.value;
  assert.ok(cookie);

  const res = await logScanPOST(
    studyRequest('http://localhost:3000/api/user-study/log-scan', cookie, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        participantId: ownParticipantId === 'P998' ? 'P997' : 'P998', // deliberately not this session's own id
        framework: 'React',
        fileName: 'Widget.tsx',
        code: SIMPLE_REACT_CODE,
      }),
    })
  );
  assert.equal(res.status, 403);
});

test('POST for a REVOKED participant assignment is rejected with 403', async () => {
  const getRes = await logScanGET(studyRequest('http://localhost:3000/api/user-study/log-scan'));
  const { participantId } = await getRes.json();
  const cookie = getRes.cookies.get('figm_study_token')?.value;
  assert.ok(cookie);

  const revoked = await ParticipantRepository.setResearchStatus(participantId, 'REVOKED');
  assert.ok(revoked, 'setResearchStatus must find the just-assigned participant');

  const res = await logScanPOST(
    studyRequest('http://localhost:3000/api/user-study/log-scan', cookie, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ participantId, framework: 'React', fileName: 'Widget.tsx', code: SIMPLE_REACT_CODE }),
    })
  );
  assert.equal(res.status, 403);
});

test('two concurrent POSTs under one valid session both succeed and persist as distinct scan records', async () => {
  const provider = RepositoryFactory.getStorageProvider();
  const getRes = await logScanGET(studyRequest('http://localhost:3000/api/user-study/log-scan'));
  const { participantId } = await getRes.json();
  let cookie = getRes.cookies.get('figm_study_token')?.value;
  assert.ok(cookie);

  // Consent is a separate, server-enforced prerequisite (see app/api/user-study/consent/route.ts) --
  // must be recorded before log-scan POSTs will succeed.
  const consentRes = await consentPOST(studyRequest('http://localhost:3000/api/user-study/consent', cookie, { method: 'POST' }));
  cookie = consentRes.cookies.get('figm_study_token')?.value;
  assert.ok(cookie, 'consent POST must re-issue a consent-bearing session cookie');

  const makeRequest = () =>
    studyRequest('http://localhost:3000/api/user-study/log-scan', cookie, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ participantId, framework: 'React', fileName: 'Widget.tsx', code: SIMPLE_REACT_CODE }),
    });

  const [resA, resB] = await Promise.all([logScanPOST(makeRequest()), logScanPOST(makeRequest())]);

  assert.equal(resA.status, 200, 'first concurrent scan must succeed, not 500');
  assert.equal(resB.status, 200, 'second concurrent scan must succeed, not 500');

  const bodyA = await resA.json();
  const bodyB = await resB.json();
  assert.equal(bodyA.success, true);
  assert.equal(bodyB.success, true);
  assert.equal(bodyA.participantId, participantId);
  assert.equal(bodyB.participantId, participantId);

  const detail = await ParticipantRepository.getDetail(participantId);
  assert.ok(detail);
  assert.equal(detail!.scanSummary.totalScans, 2, 'both concurrent scans must be persisted, not lost');

  void provider; // referenced for parity with the storage-backend context other assertions rely on
});

test('a resumed session (valid existing cookie, no ?fresh=1) returns the SAME participantId, no new row created', async () => {
  const first = await logScanGET(studyRequest('http://localhost:3000/api/user-study/log-scan'));
  const { participantId: firstId } = await first.json();
  const cookie = first.cookies.get('figm_study_token')?.value;
  assert.ok(cookie);

  const second = await logScanGET(studyRequest('http://localhost:3000/api/user-study/log-scan', cookie));
  const secondBody = await second.json();
  assert.equal(secondBody.participantId, firstId);
  assert.equal(secondBody.resumed, true);
});

test('?fresh=1 assigns a new participantId even with a valid existing cookie', async () => {
  const first = await logScanGET(studyRequest('http://localhost:3000/api/user-study/log-scan'));
  const { participantId: firstId } = await first.json();
  const cookie = first.cookies.get('figm_study_token')?.value;
  assert.ok(cookie);

  const second = await logScanGET(studyRequest('http://localhost:3000/api/user-study/log-scan?fresh=1', cookie));
  const secondBody = await second.json();
  assert.notEqual(secondBody.participantId, firstId);
  assert.equal(secondBody.resumed, false);
});
