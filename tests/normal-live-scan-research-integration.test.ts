import test from 'node:test';
import assert from 'node:assert/strict';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { UserDB, DBUser } from '../src/auth/user-db';
import { ParticipantRepository, TARGET_PARTICIPANT_COUNT } from '../src/engine/participant-repository';
import { ScanRepository } from '../src/engine/scan-repository';
import { signJWT } from '../src/auth/auth-service';
import { POST as scanPOST } from '../app/api/scan/route';
import { POST as enrollPOST, GET as enrollGET } from '../app/api/user-study/enroll/route';
import { GET as adminResearchDatasetGET } from '../app/api/admin/research-dataset/route';

/**
 * Regression coverage for the normal-login -> Live Scan research integration (see
 * docs/audit/NORMAL_LIVE_SCAN_RESEARCH_INTEGRATION.md). Proves: a real study participant is one
 * normal authenticated User row (never a second shadow account), explicit opt-in enrollment caps
 * at exactly P001-P020, admin verification remains the sole research-eligibility gate, the
 * ALREADY-EXISTING /api/scan + ParticipantRepository.getResearchDataset() pipeline needs no
 * duplication to pick up an enrolled+verified user's real scans, and fix/remediation telemetry is
 * now honestly persisted.
 */

// Clean slate for the real P001-P020 range: the local JSON test store is a real on-disk file
// (figm-user-db.json) that persists across separate `node --test` invocations AND across every
// test in this same file (RepositoryFactory.resetProvider() only clears the provider-selection
// cache, never the underlying store) -- so both residue from earlier test RUNS and consumption by
// EARLIER TESTS WITHIN THIS FILE (deliberately, by the "range is exactly full" test) can leave the
// range fully occupied. Every other test file that needs a specific code already does its own
// delete-then-create cleanup (see e.g. tests/study-live-scanner-integration.test.ts's
// createVerifiedParticipant) rather than relying on ambient availability; called at the start of
// every test below that needs guaranteed room, for the same reason.
function clearParticipantRange(): void {
  for (let n = 1; n <= TARGET_PARTICIPANT_COUNT; n++) {
    const code = `P${String(n).padStart(3, '0')}`;
    const stale = UserDB.findUserByParticipantCode(code);
    if (stale) UserDB.deleteUser(stale.id);
  }
}

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

function authHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

function scanRequest(token: string, body: Record<string, unknown>, ip = '203.0.113.50'): Request {
  return new Request('http://localhost:3000/api/scan', {
    method: 'POST',
    headers: { ...authHeaders(token), 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

function enrollPostRequest(token: string, consentConfirmed = true): Request {
  return new Request('http://localhost:3000/api/user-study/enroll', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ consentConfirmed }),
  });
}

function enrollGetRequest(token?: string): Request {
  return new Request('http://localhost:3000/api/user-study/enroll', { headers: authHeaders(token) });
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

async function enroll(userId: string) {
  return ParticipantRepository.enrollAuthenticatedUserAsParticipant(userId);
}

async function fillAllSlotsExcept(keepOpen: number): Promise<void> {
  const provider = RepositoryFactory.getStorageProvider();
  const allUsers = ((await provider.getAllUsers()) as DBUser[]) || [];
  const used = new Set(
    allUsers
      .map((u) => u.participantCode)
      .filter((c): c is string => !!c && /^P\d{3}$/.test(c))
      .map((c) => parseInt(c.slice(1), 10))
  );
  for (let n = 1; n <= TARGET_PARTICIPANT_COUNT; n++) {
    if (n === keepOpen || used.has(n)) continue;
    const code = `P${String(n).padStart(3, '0')}`;
    UserDB.createUser({
      email: `filler_${code.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}@user-study.figm.local`,
      passwordHash: 'unused-in-tests',
      fullName: `Filler ${code}`,
      role: 'DEVELOPER',
      participantCode: code,
      researchStatus: 'ASSIGNED',
      researchAssignedAt: new Date().toISOString(),
    });
  }
}

test('A. normal registration/login does not create a participant automatically', () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  const user = makeUser('ordinary_no_auto_enroll');
  assert.equal(user.participantCode, undefined);
});

test('B. explicit study enrollment assigns a code in P001..P020', async () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  const user = makeUser('enroll_basic');
  const result = await enroll(user.id);
  assert.equal(result.alreadyEnrolled, false);
  const n = parseInt(result.participantCode.slice(1), 10);
  assert.ok(n >= 1 && n <= TARGET_PARTICIPANT_COUNT, `expected P001-P0${TARGET_PARTICIPANT_COUNT}, got ${result.participantCode}`);

  const status = await ParticipantRepository.getOwnParticipantStatus(user.id);
  assert.equal(status.participantCode, result.participantCode);
  assert.equal(status.researchStatus, 'ASSIGNED');
});

test('C. same authenticated user cannot receive two participant codes (idempotent)', async () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  const user = makeUser('enroll_idempotent');
  const first = await enroll(user.id);
  const second = await enroll(user.id);
  assert.equal(second.participantCode, first.participantCode);
  assert.equal(second.alreadyEnrolled, true);
});

test('D. two different users never receive the same participant code', async () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  const userA = makeUser('enroll_distinct_a');
  const userB = makeUser('enroll_distinct_b');
  const a = await enroll(userA.id);
  const b = await enroll(userB.id);
  assert.notEqual(a.participantCode, b.participantCode);
});

test('E/F. P020 is the final allowed code; P021 cannot be assigned', async () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  await fillAllSlotsExcept(TARGET_PARTICIPANT_COUNT); // only the last slot stays open
  const lastUser = makeUser('enroll_last_slot');
  const result = await enroll(lastUser.id);
  assert.equal(result.participantCode, `P${String(TARGET_PARTICIPANT_COUNT).padStart(3, '0')}`);

  const overflowUser = makeUser('enroll_overflow');
  await assert.rejects(
    () => enroll(overflowUser.id),
    /reached its target/,
    'a 21st distinct user must be refused, never silently assigned an out-of-range code'
  );
  // The refused user must remain completely unenrolled -- not partially updated.
  const status = await ParticipantRepository.getOwnParticipantStatus(overflowUser.id);
  assert.equal(status.participantCode, null);
});

test('G. ordinary (never-enrolled) live scan user never appears in the research dataset', async () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  const user = makeUser('ordinary_live_scan');
  const token = jwtFor(user);
  const res = await scanPOST(scanRequest(token, { code: REACT_SCAN_CODE, fileName: 'OrdinaryLiveScan.jsx' }));
  assert.equal(res.status, 200);

  const dataset = await ParticipantRepository.getResearchDataset();
  assert.equal(dataset.filter((r) => r.userId === user.id).length, 0);
});

test('H. enrolled but still ASSIGNED (not verified) participant scan stays out of the research dataset', async () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  const user = makeUser('enrolled_unverified');
  const enrollment = await enroll(user.id);
  const token = jwtFor(user);
  const res = await scanPOST(scanRequest(token, { code: REACT_SCAN_CODE, fileName: 'UnverifiedFixture.jsx' }));
  assert.equal(res.status, 200);

  const dataset = await ParticipantRepository.getResearchDataset();
  assert.equal(dataset.filter((r) => r.userId === user.id).length, 0, 'ASSIGNED-only must never leak into the research dataset');
  void enrollment;
});

test('I. a pre-verification scan stays out even after the SAME participant is later verified', async () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  const user = makeUser('pre_consent_scan');
  const enrollment = await enroll(user.id);
  const token = jwtFor(user);

  const res = await scanPOST(scanRequest(token, { code: REACT_SCAN_CODE, fileName: 'PreConsentFixture.jsx' }));
  assert.equal(res.status, 200);

  await new Promise((r) => setTimeout(r, 15));
  const verified = await ParticipantRepository.setResearchStatus(enrollment.participantCode, 'CONSENT_VERIFIED');
  assert.ok(verified);

  const dataset = await ParticipantRepository.getResearchDataset();
  assert.equal(
    dataset.filter((r) => r.userId === user.id && r.fileName === 'PreConsentFixture.jsx').length,
    0,
    'a scan created before consent verification must never become research-eligible retroactively'
  );
});

test('J. a real Live Scan run AFTER verification appears naturally in getResearchDataset() -- no duplicate scanner, no extra plumbing', async () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  const user = makeUser('post_consent_scan');
  const enrollment = await enroll(user.id);
  await ParticipantRepository.setResearchStatus(enrollment.participantCode, 'CONSENT_VERIFIED');
  await new Promise((r) => setTimeout(r, 15));

  const token = jwtFor(user);
  const res = await scanPOST(scanRequest(token, { code: REACT_SCAN_CODE, fileName: 'PostConsentFixture.jsx' }));
  assert.equal(res.status, 200);

  const dataset = await ParticipantRepository.getResearchDataset();
  const row = dataset.find((r) => r.userId === user.id && r.fileName === 'PostConsentFixture.jsx');
  assert.ok(row, 'a real /api/scan run by a verified, enrolled user must appear in the research dataset with zero extra wiring');
  assert.equal(row!.attemptType, 'PRIMARY');
  assert.equal(row!.participantId, enrollment.participantCode);
});

test('K. a REVOKED participant is excluded even with real post-verification-era scans', async () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  const user = makeUser('revoked_participant');
  const enrollment = await enroll(user.id);
  await ParticipantRepository.setResearchStatus(enrollment.participantCode, 'CONSENT_VERIFIED');
  await new Promise((r) => setTimeout(r, 15));

  const token = jwtFor(user);
  const res = await scanPOST(scanRequest(token, { code: REACT_SCAN_CODE, fileName: 'RevokedFixture.jsx' }));
  assert.equal(res.status, 200);

  await ParticipantRepository.setResearchStatus(enrollment.participantCode, 'REVOKED');
  const dataset = await ParticipantRepository.getResearchDataset();
  assert.equal(dataset.filter((r) => r.userId === user.id).length, 0);
});

test('L/M. first eligible fixture scan is PRIMARY, a repeat eligible scan of the same fixture is SECONDARY', async () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  const user = makeUser('primary_secondary');
  const enrollment = await enroll(user.id);
  await ParticipantRepository.setResearchStatus(enrollment.participantCode, 'CONSENT_VERIFIED');
  await new Promise((r) => setTimeout(r, 15));

  const token = jwtFor(user);
  const first = await scanPOST(scanRequest(token, { code: REACT_SCAN_CODE, fileName: 'RepeatFixture.jsx' }));
  assert.equal(first.status, 200);
  await new Promise((r) => setTimeout(r, 15));
  const second = await scanPOST(scanRequest(token, { code: REACT_SCAN_CODE, fileName: 'RepeatFixture.jsx' }));
  assert.equal(second.status, 200);

  const dataset = await ParticipantRepository.getResearchDataset();
  const rows = dataset.filter((r) => r.userId === user.id && r.fileName === 'RepeatFixture.jsx');
  assert.equal(rows.length, 2);
  assert.equal(rows.filter((r) => r.attemptType === 'PRIMARY').length, 1);
  assert.equal(rows.filter((r) => r.attemptType === 'SECONDARY').length, 1);
});

test('N. fix generation telemetry persists honestly for an authenticated user (real verified fix)', async () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  const user = makeUser('fix_telemetry_verified');
  const token = jwtFor(user);

  // Known deterministic, verified=true fix (reuses the exact fixture tests/live-scan-e2e.test.ts
  // already proves works with zero AI/network dependency).
  const code = `function Widget({ items }) {
  return items.map(item => {
    const cfg = { theme: 'dark' };
    return <span key={item.id} style={cfg}>{item.name}</span>;
  });
}`;
  const scanRes = await scanPOST(scanRequest(token, { code, fileName: 'Widget.jsx' }, '203.0.113.51'));
  assert.equal(scanRes.status, 200);
  const scanData = await scanRes.json();
  const defect = scanData.diagnostics.find((d: any) => d.ruleId === 'FIGM-PERF-01');
  assert.ok(defect, 'expected FIGM-PERF-01 to be detected in the known fixture');

  const fixRes = await scanPOST(
    scanRequest(token, { code, fileName: 'Widget.jsx', action: 'fix-figm-rule', defect }, '203.0.113.51')
  );
  assert.equal(fixRes.status, 200);
  const fixData = await fixRes.json();
  assert.equal(fixData.verified, true, 'this fixture is known to produce a verified deterministic fix');

  const history = await ScanRepository.getAiHistoryByUserId(user.id);
  assert.equal(history.length, 1);
  assert.equal(history[0].ruleId, 'FIGM-PERF-01');
  assert.equal(history[0].applied, true, 'applied must reflect the real verified flag, not be assumed');
  assert.ok(history[0].patchContent.length > 0);
  assert.equal(history[0].scanReportId, null, 'honest limitation: this endpoint has no persisted ScanReport id to link at fix-time');
});

test('O. fix telemetry honestly records applied=false when no automated fix is actually available', async () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  const user = makeUser('fix_telemetry_unavailable');
  const token = jwtFor(user);

  const savedAnthropicKey = process.env.ANTHROPIC_API_KEY;
  const savedOllamaUrl = process.env.OLLAMA_BASE_URL;
  const savedOllamaModel = process.env.OLLAMA_MODEL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.OLLAMA_MODEL;
  try {
    // FIGM-REACT-01 has no deterministic fixer and, with no AI provider configured, no automated
    // path at all -- the pipeline must report verified:false (AI_UNAVAILABLE), never fabricate a
    // "fixed" result (see tests/ai-remediation.test.ts's identical fixture/assertion).
    const reactCode = `function List({ items }) {\n  const sorted = items.sort((a, b) => a - b);\n  return <ul>{sorted.map((n) => <li>{n}</li>)}</ul>;\n}`;
    const reactDefect = {
      ruleId: 'FIGM-REACT-01',
      ruleName: 'Missing key prop in dynamic list rendering',
      message: 'Missing key prop in dynamic list rendering',
      domain: 'PERFORMANCE',
      concern: 'INVARIANT_ALLOCATIONS',
      severity: 'HIGH',
      filePath: 'src/List.jsx',
      location: { start: { line: 3, column: 3 }, end: { line: 3, column: 60 } },
      offendingCodeSnippet: 'return <ul>{sorted.map((n) => <li>{n}</li>)}</ul>;',
      remediation: 'Add a stable, unique `key` prop to each list item.',
      standardReference: 'ISO 25010',
    };

    const fixRes = await scanPOST(
      scanRequest(token, { code: reactCode, fileName: 'src/List.jsx', action: 'fix-figm-rule', defect: reactDefect }, '203.0.113.52')
    );
    assert.equal(fixRes.status, 200);
    const fixData = await fixRes.json();
    assert.equal(fixData.verified, false);

    const history = await ScanRepository.getAiHistoryByUserId(user.id);
    assert.equal(history.length, 1);
    assert.equal(history[0].applied, false, 'must never claim a fix was applied when none was ever generated');
  } finally {
    if (savedAnthropicKey !== undefined) process.env.ANTHROPIC_API_KEY = savedAnthropicKey;
    if (savedOllamaUrl !== undefined) process.env.OLLAMA_BASE_URL = savedOllamaUrl;
    if (savedOllamaModel !== undefined) process.env.OLLAMA_MODEL = savedOllamaModel;
  }
});

test('P. a re-scan after remediation persists as a new, ordinary scan record (no fabricated parent/child link)', async () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  const user = makeUser('rescan_normal');
  const token = jwtFor(user);
  const first = await scanPOST(scanRequest(token, { code: REACT_SCAN_CODE, fileName: 'RescanFixture.jsx' }));
  assert.equal(first.status, 200);
  const second = await scanPOST(scanRequest(token, { code: REACT_SCAN_CODE, fileName: 'RescanFixture.jsx' }));
  assert.equal(second.status, 200);

  const provider = RepositoryFactory.getStorageProvider();
  const scans = ((await provider.getScanRecords(user.id)) as any[]) || [];
  assert.equal(scans.filter((s) => s.fileName === 'RescanFixture.jsx').length, 2, 're-scanning must create a second ordinary scan row, never overwrite or link the first');
});

test('Q. GET /api/user-study/enroll reports null for an ordinary authenticated user who never joined', async () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  const user = makeUser('ordinary_status_check');
  const token = jwtFor(user);
  const res = await enrollGET(enrollGetRequest(token));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.participantCode, null);
  assert.equal(data.researchStatus, null);
});

test('Enrollment requires real authentication and explicit consent confirmation', async () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  const anon = await enrollPOST(enrollPostRequest(''));
  assert.equal(anon.status, 401);

  const user = makeUser('consent_required');
  const token = jwtFor(user);
  const noConsent = await enrollPOST(enrollPostRequest(token, false));
  assert.equal(noConsent.status, 400);

  const status = await ParticipantRepository.getOwnParticipantStatus(user.id);
  assert.equal(status.participantCode, null, 'a rejected (no-consent) enrollment attempt must never partially assign a code');
});

test('R. admin research-dataset export remains role-gated (unaffected by this integration)', async () => {
  RepositoryFactory.resetProvider();
  clearParticipantRange();
  const anonRes = await adminResearchDatasetGET(new Request('http://localhost:3000/api/admin/research-dataset'));
  assert.equal(anonRes.status, 401);

  const ordinaryUser = makeUser('non_admin_export_attempt');
  const token = jwtFor(ordinaryUser);
  const forbiddenRes = await adminResearchDatasetGET(
    new Request('http://localhost:3000/api/admin/research-dataset', { headers: { authorization: `Bearer ${token}` } })
  );
  assert.equal(forbiddenRes.status, 403);
});
