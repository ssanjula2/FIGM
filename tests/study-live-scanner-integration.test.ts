import test from 'node:test';
import assert from 'node:assert/strict';
import { signJWT, signResearchParticipantToken } from '../src/auth/auth-service';
import { UserDB } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { ParticipantRepository } from '../src/engine/participant-repository';
import { CONSENT_PROTOCOL_VERSION } from '../src/research/research-config';
import { STUDY_COOKIE } from '../src/auth/study-session';
import { POST as scanPOST } from '../app/api/scan/route';
import { POST as logScanPOST } from '../app/api/user-study/log-scan/route';

/**
 * Real-participant Live Scanner integration — verifies the ALREADY-EXISTING architecture rather
 * than adding a new one.
 *
 * The normal scanner surface (/live-scan -> POST /api/scan) authenticates only via figm_token
 * (authenticateUser, src/auth/auth-middleware.ts) and a real research participant's User row
 * (created only by ParticipantRepository.assignNewParticipant(), the sole caller of which is
 * GET /api/user-study/log-scan) is given an unguessable random password and is NEVER reachable via
 * that JWT system -- the two identity systems do not overlap by construction. POST
 * /api/user-study/log-scan is the dedicated, already-implemented research-aware scan endpoint:
 * STUDY_COOKIE-only auth, real RuleExecutionEngine re-run server-side, persisted under the
 * participant's real userId, exact fileName fixture identity preserved. This file proves that
 * pipeline end-to-end using the real, frozen study fixtures embedded in app/user-study/page.tsx,
 * rather than introducing a second, duplicate scan-persistence code path.
 *
 * Pre-consent exclusion, REVOKED exclusion, out-of-range-code exclusion, and admin RBAC are already
 * covered by tests/research-dataset-consent-gate.test.ts, tests/research-dataset-range-guard.test.ts,
 * and tests/admin-research-dashboard.test.ts respectively -- not duplicated here.
 */

// Exact copies of app/user-study/page.tsx's BENCHMARKS entries (kept in sync by inspection, not
// by import, since BENCHMARKS is an unexported module-local constant of a 'use client' component).
const STUDY_FIXTURES = {
  react: {
    file: 'UserProfile.jsx',
    framework: 'React JSX',
    code: `import React, { useState } from 'react';

export function UserProfile({ user, onUpdate }) {
  const [data, setData] = useState(user);

  const options = { theme: 'dark', lang: 'en' };

  return (
    <div className="user-profile">
      <h2>{data.name}</h2>
      <input type="text" onChange={(e) => setData({ ...data, name: e.target.value })} />
      <button onClick={() => onUpdate(data)}>Save Profile</button>
    </div>
  );
}`,
  },
  nextjs: {
    file: 'app/dashboard/page.tsx',
    framework: 'Next.js App Router',
    code: `import React, { useState } from 'react';

export default function DashboardPage() {
  const [data, setData] = useState({ title: 'Analytics Dashboard' });

  return (
    <div className="dashboard-page">
      <h2>{data.title}</h2>
      <button onClick={() => setData({ title: 'Updated Analytics' })}>Refresh Data</button>
    </div>
  );
}`,
  },
  angular: {
    file: 'SearchPanel.component.ts',
    framework: 'Angular TypeScript',
    code: `@Component({
  selector: 'app-search-panel',
  template: \`
    <div class="search-box">
      <input type="text" [(ngModel)]="query" placeholder="Search items..." />
      <div class="btn-search" (click)="onSearch()">Search</div>
    </div>
  \`
})
export class SearchPanelComponent {
  query = '';
  onSearch() { console.log('Searching:', this.query); }
}`,
  },
  vue: {
    file: 'DataGrid.vue',
    framework: 'Vue SFC',
    code: `<template>
  <div class="data-grid">
    <img src="/avatar.png" />
    <table class="grid-table">
      <tr v-for="item in items" :key="item.id">
        <td>{{ item.name }}</td>
      </tr>
    </table>
  </div>
</template>`,
  },
};

function studyRequest(cookieValue: string | undefined, body: Record<string, unknown>): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cookieValue) headers['cookie'] = `${STUDY_COOKIE}=${cookieValue}`;
  return new Request('http://localhost:3000/api/user-study/log-scan', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function findRawScan(userId: string, fileName: string): Promise<any | undefined> {
  const provider = RepositoryFactory.getStorageProvider();
  const scans = (await provider.getScanRecords()) as any[];
  return scans.find((s) => s.userId === userId && s.fileName === fileName);
}

async function createVerifiedParticipant(participantCode: string) {
  const stale = UserDB.findUserByParticipantCode(participantCode);
  if (stale) UserDB.deleteUser(stale.id);
  const user = UserDB.createUser({
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: `${participantCode.toLowerCase()}+${Date.now()}_${Math.random().toString(36).slice(2, 7)}@user-study.figm.local`,
    passwordHash: 'unused-in-these-tests',
    fullName: `User Study Participant ${participantCode}`,
    role: 'DEVELOPER',
    participantCode,
    researchStatus: 'CONSENT_VERIFIED',
    researchAssignedAt: new Date().toISOString(),
    researchConsentVerifiedAt: new Date().toISOString(),
  });
  const cookie = signResearchParticipantToken(participantCode, undefined, {
    given: true,
    version: CONSENT_PROTOCOL_VERSION,
    timestamp: new Date().toISOString(),
  });
  return { user, cookie };
}

test('Normal /api/scan is unaffected by the study integration', async (t) => {
  await t.test('a normal figm_token-authenticated scan persists under the normal user, never a P00N identity', async () => {
    RepositoryFactory.resetProvider();
    const provider = RepositoryFactory.getStorageProvider();
    const normalUser = UserDB.createUser({
      email: `normal_scan_user_${Date.now()}@figm.io`,
      passwordHash: 'unused-in-these-tests',
      fullName: 'Normal Product User',
      role: 'DEVELOPER',
    });
    const jwt = signJWT({ userId: normalUser.id, email: normalUser.email, fullName: normalUser.fullName, role: 'DEVELOPER' }, 0);

    const res = await scanPOST(
      new Request('http://localhost:3000/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}`, 'x-forwarded-for': '203.0.113.201' },
        body: JSON.stringify({ code: STUDY_FIXTURES.react.code, fileName: STUDY_FIXTURES.react.file }),
      })
    );
    assert.equal(res.status, 200);

    const scans = ((await provider.getScanRecords()) as any[]).filter((s) => s.userId === normalUser.id);
    assert.equal(scans.length, 1, 'the normal scan must be persisted exactly once, under the normal user id');

    const dataset = await ParticipantRepository.getResearchDataset();
    assert.equal(dataset.filter((r) => r.userId === normalUser.id).length, 0, 'a normal product account can never appear in the research dataset');
  });

  await t.test('an anonymous (unauthenticated) /api/scan call runs the scan but persists nothing, for anyone', async () => {
    RepositoryFactory.resetProvider();
    const provider = RepositoryFactory.getStorageProvider();
    const before = ((await provider.getScanRecords()) as any[]).length;

    const res = await scanPOST(
      new Request('http://localhost:3000/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.202' },
        body: JSON.stringify({ code: STUDY_FIXTURES.react.code, fileName: STUDY_FIXTURES.react.file }),
      })
    );
    assert.equal(res.status, 200, 'an anonymous caller still gets a live scan result');

    const after = ((await provider.getScanRecords()) as any[]).length;
    assert.equal(after, before, 'an anonymous /api/scan call must never write a scan record -- there is no way for it to become research data');
  });
});

test('Research Live Scanner (POST /api/user-study/log-scan): auth, consent, and identity gates', async (t) => {
  await t.test('no STUDY_COOKIE at all -> 401, nothing persisted', async () => {
    RepositoryFactory.resetProvider();
    const provider = RepositoryFactory.getStorageProvider();
    const before = ((await provider.getScanRecords()) as any[]).length;

    const res = await logScanPOST(studyRequest(undefined, { framework: 'React', fileName: STUDY_FIXTURES.react.file, code: STUDY_FIXTURES.react.code }));
    assert.equal(res.status, 401);

    const after = ((await provider.getScanRecords()) as any[]).length;
    assert.equal(after, before);
  });

  await t.test('a valid session with session-consent NOT given -> 403, nothing persisted', async () => {
    RepositoryFactory.resetProvider();
    const provider = RepositoryFactory.getStorageProvider();
    const code = 'P011';
    const stale = UserDB.findUserByParticipantCode(code);
    if (stale) UserDB.deleteUser(stale.id);
    UserDB.createUser({
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      email: `${code.toLowerCase()}+unconsented@user-study.figm.local`,
      passwordHash: 'unused-in-these-tests',
      fullName: `User Study Participant ${code}`,
      role: 'DEVELOPER',
      participantCode: code,
      researchStatus: 'ASSIGNED',
      researchAssignedAt: new Date().toISOString(),
    });
    const unconsentedCookie = signResearchParticipantToken(code); // defaults to { given: false }
    const before = ((await provider.getScanRecords()) as any[]).length;

    const res = await logScanPOST(studyRequest(unconsentedCookie, { framework: 'React', fileName: STUDY_FIXTURES.react.file, code: STUDY_FIXTURES.react.code }));
    assert.equal(res.status, 403);

    const after = ((await provider.getScanRecords()) as any[]).length;
    assert.equal(after, before, 'a session that never confirmed consent must never write a scan record');
  });

  await t.test('a REVOKED participant with a consented session token still cannot persist -> 403, nothing persisted', async () => {
    RepositoryFactory.resetProvider();
    const provider = RepositoryFactory.getStorageProvider();
    const code = 'P012';
    const { user } = await createVerifiedParticipant(code);
    const revoked = await ParticipantRepository.setResearchStatus(code, 'REVOKED');
    assert.ok(revoked);
    const cookie = signResearchParticipantToken(code, undefined, { given: true, version: CONSENT_PROTOCOL_VERSION, timestamp: new Date().toISOString() });
    const before = ((await provider.getScanRecords()) as any[]).filter((s) => s.userId === user.id).length;

    const res = await logScanPOST(studyRequest(cookie, { framework: 'React', fileName: STUDY_FIXTURES.react.file, code: STUDY_FIXTURES.react.code }));
    assert.equal(res.status, 403);

    const after = ((await provider.getScanRecords()) as any[]).filter((s) => s.userId === user.id).length;
    assert.equal(after, before, 'a revoked participant assignment must never accept a new research-scan write');
  });

  await t.test('a session cannot attribute its scan to a DIFFERENT participant id than its own -> 403', async () => {
    RepositoryFactory.resetProvider();
    const codeA = 'P013';
    const codeB = 'P014';
    const { cookie } = await createVerifiedParticipant(codeA);
    await createVerifiedParticipant(codeB);

    const res = await logScanPOST(
      studyRequest(cookie, { participantId: codeB, framework: 'React', fileName: STUDY_FIXTURES.react.file, code: STUDY_FIXTURES.react.code })
    );
    assert.equal(res.status, 403, 'a session bound to one participant must never be allowed to write under a different participant id');
  });
});

test('Research Live Scanner: all four frozen study fixtures persist correctly with preserved identity', async (t) => {
  await t.test('FIGM-STUDY-REACT-01 persists under UserProfile.jsx and appears as a real research row', async () => {
    RepositoryFactory.resetProvider();
    const code = 'P015';
    const { user, cookie } = await createVerifiedParticipant(code);

    const res = await logScanPOST(studyRequest(cookie, { framework: STUDY_FIXTURES.react.framework, fileName: STUDY_FIXTURES.react.file, code: STUDY_FIXTURES.react.code }));
    assert.equal(res.status, 200);

    const dataset = await ParticipantRepository.getResearchDataset();
    const row = dataset.find((r) => r.userId === user.id && r.fileName === STUDY_FIXTURES.react.file);
    assert.ok(row, 'the React fixture scan must appear in the research dataset under its exact fileName');
    assert.equal(row!.attemptType, 'PRIMARY');
  });

  await t.test('FIGM-STUDY-NEXT-01 persists under app/dashboard/page.tsx and is classified NEXT_JS with the expected rule IDs', async () => {
    RepositoryFactory.resetProvider();
    const code = 'P016';
    const { user, cookie } = await createVerifiedParticipant(code);

    const res = await logScanPOST(studyRequest(cookie, { framework: STUDY_FIXTURES.nextjs.framework, fileName: STUDY_FIXTURES.nextjs.file, code: STUDY_FIXTURES.nextjs.code }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.success);

    const dataset = await ParticipantRepository.getResearchDataset();
    const row = dataset.find((r) => r.userId === user.id && r.fileName === STUDY_FIXTURES.nextjs.file);
    assert.ok(row);
    assert.equal(row!.totalFindings, 3, 'expected exactly FIGM-NEXT-03, FIGM-NEXT-01, FIGM-PERF-05');

    // Authoritative proof of real engine classification: the persisted diagnostics' own ruleIds
    // (server-derived from RuleExecutionEngine, never client-supplied) can only contain FIGM-NEXT-*
    // rule ids if the engine internally classified this exact fileName as NEXT_JS. See the
    // dedicated finding below re: the scan record's own `framework` column being unreliable.
    const rawScan = await findRawScan(user.id, STUDY_FIXTURES.nextjs.file);
    const ruleIds = (rawScan?.diagnostics || []).map((d: any) => d.ruleId).sort();
    assert.deepEqual(ruleIds, ['FIGM-NEXT-01', 'FIGM-NEXT-03', 'FIGM-PERF-05'], 'FIGM-NEXT-* rule ids only ever fire for a real NEXT_JS classification -- this proves the engine saw it correctly even though the stored framework column does not (see finding below)');
  });

  await t.test('FIGM-STUDY-ANGULAR-01 persists under SearchPanel.component.ts', async () => {
    RepositoryFactory.resetProvider();
    const code = 'P017';
    const { user, cookie } = await createVerifiedParticipant(code);

    const res = await logScanPOST(studyRequest(cookie, { framework: STUDY_FIXTURES.angular.framework, fileName: STUDY_FIXTURES.angular.file, code: STUDY_FIXTURES.angular.code }));
    assert.equal(res.status, 200);

    const dataset = await ParticipantRepository.getResearchDataset();
    const row = dataset.find((r) => r.userId === user.id && r.fileName === STUDY_FIXTURES.angular.file);
    assert.ok(row);
    assert.ok(row!.totalFindings > 0);

    const rawScan = await findRawScan(user.id, STUDY_FIXTURES.angular.file);
    const ruleIds = (rawScan?.diagnostics || []).map((d: any) => d.ruleId);
    assert.ok(ruleIds.includes('FIGM-ANG-02'), 'an Angular-specific rule id proves the engine classified this fileName as ANGULAR_TEMPLATE');
  });

  await t.test('FIGM-STUDY-VUE-01 persists under DataGrid.vue', async () => {
    RepositoryFactory.resetProvider();
    const code = 'P018';
    const { user, cookie } = await createVerifiedParticipant(code);

    const res = await logScanPOST(studyRequest(cookie, { framework: STUDY_FIXTURES.vue.framework, fileName: STUDY_FIXTURES.vue.file, code: STUDY_FIXTURES.vue.code }));
    assert.equal(res.status, 200);

    const dataset = await ParticipantRepository.getResearchDataset();
    const row = dataset.find((r) => r.userId === user.id && r.fileName === STUDY_FIXTURES.vue.file);
    assert.ok(row);
    assert.ok(row!.totalFindings > 0);

    const rawScan = await findRawScan(user.id, STUDY_FIXTURES.vue.file);
    const ruleIds = (rawScan?.diagnostics || []).map((d: any) => d.ruleId);
    assert.ok(ruleIds.includes('FIGM-PERF-02'), 'this rule id is real evidence the Vue SFC template was actually parsed and scanned');
  });

  await t.test('FINDING (not fixed here): the persisted framework column echoes the caller-supplied label, not the real engine classification', async () => {
    // app/user-study/page.tsx sends framework: benchmark.framework (a display label like
    // "Next.js App Router", "Angular TypeScript", "Vue SFC") in the log-scan POST body.
    // app/api/user-study/log-scan/route.ts persists `framework || analysis.framework || 'React'`
    // -- the client-supplied label wins whenever it is present, even though every OTHER measured
    // field in this exact same object (qualityScore, scanTimeMs, memoryUsageMb, ruleCount,
    // diagnostics) deliberately uses the server-computed `analysis.*` value per this file's own
    // documented principle ("never trust a client-supplied score/count ... only thing worth
    // persisting is derived from re-running the real analysis engine"). This means the research
    // dataset's own `framework` column is not authoritative ground truth for any scan where the
    // caller supplied a framework label -- which is every real /user-study submission today. This
    // does not affect PRIMARY/SECONDARY (keyed by fileName, not framework), consent eligibility,
    // or the real diagnostics/rule-ids actually detected (proven by the three tests above) -- but it
    // does mean an exported research dataset's `framework` field should not be trusted as engine
    // ground truth without this fix. Reported, not silently patched: this route is part of the
    // already-tagged, deployed collection build.
    RepositoryFactory.resetProvider();
    const code = 'P020';
    const { user, cookie } = await createVerifiedParticipant(code);

    const res = await logScanPOST(studyRequest(cookie, { framework: STUDY_FIXTURES.nextjs.framework, fileName: STUDY_FIXTURES.nextjs.file, code: STUDY_FIXTURES.nextjs.code }));
    assert.equal(res.status, 200);

    const rawScan = await findRawScan(user.id, STUDY_FIXTURES.nextjs.file);
    assert.equal(rawScan?.framework, STUDY_FIXTURES.nextjs.framework, 'documents current behavior: the client label is what is actually stored');
    assert.notEqual(rawScan?.framework, 'NEXT_JS', 'documents the gap: the real engine classification (NEXT_JS) is NOT what is stored in the framework column');
  });

  await t.test('a repeat scan of the same fixture by the same participant is SECONDARY, not a second PRIMARY', async () => {
    RepositoryFactory.resetProvider();
    const code = 'P019';
    const { user, cookie } = await createVerifiedParticipant(code);

    const first = await logScanPOST(studyRequest(cookie, { framework: STUDY_FIXTURES.react.framework, fileName: STUDY_FIXTURES.react.file, code: STUDY_FIXTURES.react.code }));
    assert.equal(first.status, 200);
    await new Promise((r) => setTimeout(r, 15));
    const second = await logScanPOST(studyRequest(cookie, { framework: STUDY_FIXTURES.react.framework, fileName: STUDY_FIXTURES.react.file, code: STUDY_FIXTURES.react.code }));
    assert.equal(second.status, 200);

    const dataset = await ParticipantRepository.getResearchDataset();
    const rows = dataset.filter((r) => r.userId === user.id && r.fileName === STUDY_FIXTURES.react.file);
    assert.equal(rows.length, 2);
    const primaryCount = rows.filter((r) => r.attemptType === 'PRIMARY').length;
    const secondaryCount = rows.filter((r) => r.attemptType === 'SECONDARY').length;
    assert.equal(primaryCount, 1, 'exactly one PRIMARY attempt per participant x fixture, ever');
    assert.equal(secondaryCount, 1);
  });
});
