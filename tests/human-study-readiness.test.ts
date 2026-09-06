import test from 'node:test';
import assert from 'node:assert/strict';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { UserDB } from '../src/auth/user-db';
import { ParticipantRepository } from '../src/engine/participant-repository';
import { GET as logScanGET, POST as logScanPOST } from '../app/api/user-study/log-scan/route';
import { POST as consentPOST } from '../app/api/user-study/consent/route';
import { GET as participantDetailGET } from '../app/api/admin/participants/[participantId]/route';
import { PATCH as participantPatch } from '../app/api/admin/participants/[participantId]/route';
import { signJWT } from '../src/auth/auth-service';

/**
 * Stage 11A — human-study final readiness: focused coverage for the specific gaps this audit
 * found NOT already covered by tests/research-dataset-consent-gate.test.ts (ASSIGNED/pre-consent/
 * post-consent/REVOKED/normal-user exclusion), tests/anti-hardcoding-guard.test.ts (participant
 * target = 20; honest-N=0 reporting), or tests/user-study-canonical-path.test.ts (no fake
 * "collection complete" claim). Every test invokes the real route handlers/repository against the
 * real storage-provider stack -- no mocking, matching this repo's existing test convention.
 */

function cookieHeader(name: string, value: string): string {
  return `${name}=${value}`;
}

test('a session with no consent recorded cannot log a research scan, even with real code (server-enforced, not a frontend-only check)', async () => {
  RepositoryFactory.resetProvider();
  const sessionRes = await logScanGET(new Request('http://localhost:3000/api/user-study/log-scan'));
  const cookie = sessionRes.cookies.get('figm_study_token')?.value;
  assert.ok(cookie, 'GET must issue a session cookie');

  const res = await logScanPOST(new Request('http://localhost:3000/api/user-study/log-scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieHeader('figm_study_token', cookie!) },
    body: JSON.stringify({ framework: 'React', fileName: 'X.jsx', code: 'const x = 1;' }),
  }));
  assert.equal(res.status, 403, 'a scan must be refused for a session that never recorded consent');
});

test('an anonymous caller with no session cookie at all cannot log a research scan', async () => {
  const res = await logScanPOST(new Request('http://localhost:3000/api/user-study/log-scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ framework: 'React', fileName: 'X.jsx', code: 'const x = 1;' }),
  }));
  assert.equal(res.status, 401);
});

test('a tampered session cookie (bit-flipped signature) is rejected, not silently trusted as consented', async () => {
  const sessionRes = await logScanGET(new Request('http://localhost:3000/api/user-study/log-scan'));
  const cookie = sessionRes.cookies.get('figm_study_token')?.value!;
  const parts = cookie.split('.');
  assert.equal(parts.length, 3, 'expected a signed 3-part token');
  // Flip the last character of the signature -- an attacker who intercepted an unconsented token
  // and tried to forge consentGiven:true (or any claim) without the server's HMAC secret.
  const lastChar = parts[2].slice(-1);
  const flipped = lastChar === 'A' ? 'B' : 'A';
  const forged = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -1)}${flipped}`;

  const res = await logScanPOST(new Request('http://localhost:3000/api/user-study/log-scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: cookieHeader('figm_study_token', forged) },
    body: JSON.stringify({ framework: 'React', fileName: 'X.jsx', code: 'const x = 1;' }),
  }));
  assert.equal(res.status, 401, 'a signature-invalid token must be treated as no session at all');
});

test('a research-participant session token cannot be used to authenticate against admin routes (no cross-auth-system bypass)', async () => {
  const sessionRes = await logScanGET(new Request('http://localhost:3000/api/user-study/log-scan'));
  const studyCookie = sessionRes.cookies.get('figm_study_token')?.value!;

  // Try it both as the admin-route cookie name and as a raw Bearer token -- neither should ever
  // authenticate, since authenticateUser()/authorizeRole() never call
  // verifyResearchParticipantToken (separate, non-overlapping code paths).
  const asCookie = await participantDetailGET(
    new Request('http://localhost:3000/api/admin/participants/P001', { headers: { cookie: cookieHeader('figm_token', studyCookie) } }),
    { params: Promise.resolve({ participantId: 'P001' }) }
  );
  assert.equal(asCookie.status, 401);

  const asBearer = await participantDetailGET(
    new Request('http://localhost:3000/api/admin/participants/P001', { headers: { authorization: `Bearer ${studyCookie}` } }),
    { params: Promise.resolve({ participantId: 'P001' }) }
  );
  assert.equal(asBearer.status, 401, 'a research-participant token must be rejected outright by verifyJWT (kind claim guard), never decoded into a DEVELOPER-role UserPayload');
});

test('a research-participant token cannot authenticate as a real user on an ordinary (role-unrestricted) authenticated route -- the confused-deputy fix', async () => {
  // Before the Stage 11A fix, verifyJWT() had no check for claim.kind: a research-participant
  // token (kind: 'research_participant', no `role` claim) decoded to userId: <participant code>,
  // role: 'DEVELOPER' (validateRole's fallback for a missing role claim) -- a structurally "valid"
  // UserPayload accepted by any authenticateUser()-only route with no ADMIN restriction. Verified
  // directly against authenticateUser() itself, independent of any specific route's behavior.
  const { authenticateUser } = await import('../src/auth/auth-middleware.js');
  const sessionRes = await logScanGET(new Request('http://localhost:3000/api/user-study/log-scan'));
  const studyCookie = sessionRes.cookies.get('figm_study_token')?.value!;

  const result = await authenticateUser(new Request('http://localhost:3000/api/dashboard/summary', {
    headers: { authorization: `Bearer ${studyCookie}` },
  }));
  assert.equal(result.user, null, 'a research-participant token must never authenticate as a real user');
  assert.equal(result.errorResponse?.status, 401);
});

test('a non-admin real user cannot set researchStatus to CONSENT_VERIFIED (the consent gate cannot be bypassed by any participant-facing route)', async () => {
  RepositoryFactory.resetProvider();
  const developer = UserDB.createUser({
    email: `readiness_dev_${Date.now()}@figm.io`,
    passwordHash: 'unused',
    fullName: 'Readiness Test Developer',
    role: 'DEVELOPER',
  });
  const devToken = signJWT({ userId: developer.id, email: developer.email, fullName: developer.fullName, role: 'DEVELOPER' }, 0);

  const res = await participantPatch(
    new Request('http://localhost:3000/api/admin/participants/P001', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${devToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'CONSENT_VERIFIED' }),
    }),
    { params: Promise.resolve({ participantId: 'P001' }) }
  );
  assert.equal(res.status, 403, 'only an ADMIN may verify consent -- a DEVELOPER-role account must be refused');
});

test('two concurrent participant sessions never resolve to the same participantId or see each other\'s assignment', async () => {
  RepositoryFactory.resetProvider();
  const sessionA = await logScanGET(new Request('http://localhost:3000/api/user-study/log-scan?fresh=1'));
  const bodyA = await sessionA.json();
  const sessionB = await logScanGET(new Request('http://localhost:3000/api/user-study/log-scan?fresh=1'));
  const bodyB = await sessionB.json();
  assert.notEqual(bodyA.participantId, bodyB.participantId, 'two fresh sessions must never be assigned the same participant code');
});

test('getResearchDataset excludes a QA-signature scan on an ASSIGNED (never consent-verified) participant -- mirrors the real production finding (P001-style "test.tsx" scans)', async () => {
  RepositoryFactory.resetProvider();
  const provider = RepositoryFactory.getStorageProvider();
  const code = `P${900000 + Math.floor(Math.random() * 90000)}`;
  const user = UserDB.createUser({
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: `${code.toLowerCase()}@user-study.figm.local`,
    passwordHash: 'unused',
    fullName: `User Study Participant ${code}`,
    role: 'DEVELOPER',
    participantCode: code,
    researchStatus: 'ASSIGNED',
    researchAssignedAt: new Date().toISOString(),
  });
  // Mirrors the exact real pattern found in Stage 8A's provenance audit: a QA/smoke-test scan
  // literally named "test.tsx" logged against an ASSIGNED (not yet admin-verified) participant.
  await provider.createScanRecord({
    userId: user.id,
    fileName: 'test.tsx',
    framework: 'React',
    scanTimeMs: 1,
    memoryUsageMb: 1,
    qualityScore: 90,
    ruleCount: 0,
    aiFixCount: 0,
    diagnostics: [],
    isFavorite: false,
  });

  const dataset = await ParticipantRepository.getResearchDataset();
  const rowsForUser = dataset.filter((r) => r.userId === user.id);
  assert.equal(rowsForUser.length, 0, 'a QA-pattern scan on an ASSIGNED participant must never enter the research dataset');
});
