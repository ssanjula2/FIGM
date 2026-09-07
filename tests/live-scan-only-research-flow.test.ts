import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { UserDB, DBUser } from '../src/auth/user-db';
import { ParticipantRepository } from '../src/engine/participant-repository';
import { signJWT } from '../src/auth/auth-service';
import { POST as scanPOST } from '../app/api/scan/route';
import { GET as enrollGET, POST as enrollPOST } from '../app/api/user-study/enroll/route';

/**
 * Regression coverage specific to making /live-scan the single real participant-study surface
 * (see docs/audit/LIVE_SCAN_ONLY_RESEARCH_FLOW.md). The underlying enrollment/consent/research-
 * dataset/fix-telemetry logic was already fully covered by
 * tests/normal-live-scan-research-integration.test.ts (17 tests, still passing, not duplicated
 * here) -- this file adds only what's genuinely new: the exact GET/POST/GET sequence the
 * /live-scan enrollment panel itself performs, and proof that real end-to-end collection needs
 * none of the /user-study/* routes except the one now shared with /live-scan.
 */

let userCounter = 0;
function makeUser(labelPrefix: string): DBUser {
  userCounter += 1;
  return UserDB.createUser({
    email: `${labelPrefix}_${Date.now()}_${userCounter}_${Math.random().toString(36).slice(2, 6)}@figm.io`,
    passwordHash: 'unused-in-tests',
    fullName: `${labelPrefix} Test User`,
    role: 'DEVELOPER',
  });
}

function jwtFor(user: DBUser): string {
  return signJWT({ userId: user.id, email: user.email, fullName: user.fullName, role: 'DEVELOPER' }, 0);
}

function enrollGetRequest(token?: string): Request {
  return new Request('http://localhost:3000/api/user-study/enroll', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function enrollPostRequest(token: string, consentConfirmed = true): Request {
  return new Request('http://localhost:3000/api/user-study/enroll', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ consentConfirmed }),
  });
}

function scanRequest(token: string, body: Record<string, unknown>, ip: string): Request {
  return new Request('http://localhost:3000/api/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
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

test('/live-scan enrollment panel: the exact GET -> POST -> GET sequence the UI performs', async () => {
  RepositoryFactory.resetProvider();
  const user = makeUser('live_scan_panel_sequence');
  const token = jwtFor(user);

  // 1. On page load, the panel calls GET -- must report not-yet-enrolled, never an error, for an
  //    ordinary signed-in user who simply hasn't joined yet.
  const before = await enrollGET(enrollGetRequest(token));
  assert.equal(before.status, 200);
  const beforeData = await before.json();
  assert.equal(beforeData.participantCode, null);
  assert.equal(beforeData.researchStatus, null);

  // 2. Clicking "Confirm & Join" calls POST.
  const join = await enrollPOST(enrollPostRequest(token));
  assert.equal(join.status, 200);
  const joinData = await join.json();
  assert.match(joinData.participantCode, /^P0(0[1-9]|1[0-9]|20)$/);
  assert.equal(joinData.alreadyEnrolled, false);

  // 3. A subsequent GET (e.g. a page refresh) must now reflect the assigned code and ASSIGNED
  //    status -- exactly what the panel's "Consent verification: Pending" state reads.
  const after = await enrollGET(enrollGetRequest(token));
  assert.equal(after.status, 200);
  const afterData = await after.json();
  assert.equal(afterData.participantCode, joinData.participantCode);
  assert.equal(afterData.researchStatus, 'ASSIGNED');
});

test('real end-to-end collection needs no /user-study/* route except the one shared with /live-scan', async () => {
  RepositoryFactory.resetProvider();
  const user = makeUser('no_user_study_page_needed');
  const token = jwtFor(user);

  // Enroll (the only /user-study/* route touched anywhere in this test).
  const join = await enrollPOST(enrollPostRequest(token));
  assert.equal(join.status, 200);
  const { participantCode } = await join.json();

  // Admin verification -- the real, unchanged path (no /user-study/* route involved at all).
  const verified = await ParticipantRepository.setResearchStatus(participantCode, 'CONSENT_VERIFIED');
  assert.ok(verified);
  await new Promise((r) => setTimeout(r, 15));

  // The real, ordinary Live Scan endpoint -- never /api/user-study/log-scan.
  const scanRes = await scanPOST(scanRequest(token, { code: REACT_SCAN_CODE, fileName: 'LiveScanOnlyFixture.jsx' }, '203.0.113.90'));
  assert.equal(scanRes.status, 200);

  const dataset = await ParticipantRepository.getResearchDataset();
  const row = dataset.find((r) => r.userId === user.id && r.fileName === 'LiveScanOnlyFixture.jsx');
  assert.ok(row, 'a scan collected entirely through enroll -> admin-verify -> /api/scan (never touching /api/user-study/log-scan or /consent) must still appear in the research dataset');
  assert.equal(row!.attemptType, 'PRIMARY');
  assert.equal(row!.participantId, participantCode);
});

test('no duplicate scanner: /live-scan\'s new enrollment code never calls the analysis engine or a second scan endpoint', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '..', 'app', 'live-scan', 'page.tsx'), 'utf-8');
  const studySection = src.slice(src.indexOf('Research study enrollment'), src.indexOf('Main Studio Grid'));
  assert.doesNotMatch(studySection, /RuleExecutionEngine|analyzeFile|\/api\/user-study\/log-scan/, 'the enrollment panel must only ever call /api/user-study/enroll -- never a second scanning code path');
  assert.match(studySection, /\/api\/user-study\/enroll/);
});
