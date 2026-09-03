import test from 'node:test';
import assert from 'node:assert/strict';
import { signJWT } from '../src/auth/auth-service';
import { UserDB } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { ScanRepository } from '../src/engine/scan-repository';
import { NotificationRepository } from '../src/engine/notification-repository';
import { POST as scansPOST } from '../app/api/scans/route';

/**
 * Regression coverage for Phase 16 closure: POST /api/scans persisted the scan record, then
 * awaited NotificationRepository.createNotification unguarded inside the same try block. A
 * notification-write failure (a separate, non-essential write) turned an already-successful scan
 * save into an HTTP 500 -- misleading the client into thinking nothing was saved, and inviting a
 * retry that would create a second, duplicate scan record for the same real scan. The fix treats
 * the notification write as best-effort: its failure is logged but never fails the request, and
 * the already-persisted scan record is still returned.
 */

function authedRequest(url: string, opts: RequestInit, jwt?: string): Request {
  const headers = new Headers(opts.headers);
  if (jwt) headers.set('Authorization', `Bearer ${jwt}`);
  return new Request(url, { ...opts, headers });
}

function tokenFor(userId: string): string {
  return signJWT({ userId, email: `${userId}@figm.io`, fullName: userId, role: 'DEVELOPER' }, 0);
}

function createTestUser(label: string) {
  return UserDB.createUser({
    email: `${label}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@figm.io`,
    passwordHash: 'unused-in-this-test',
    fullName: label,
    role: 'DEVELOPER',
  });
}

const SIMPLE_CODE = `export function Widget() { return <div onClick={() => {}}>hi</div>; }`;

test('POST /api/scans still returns 200 with the saved record when the notification write fails', async () => {
  RepositoryFactory.resetProvider();
  const user = createTestUser('scan_notif_fail');
  const jwt = tokenFor(user.id);

  const original = NotificationRepository.createNotification;
  (NotificationRepository as any).createNotification = async () => {
    throw new Error('simulated notification-write failure');
  };

  let res: Response;
  try {
    res = await scansPOST(
      authedRequest(
        'http://localhost:3000/api/scans',
        { method: 'POST', body: JSON.stringify({ code: SIMPLE_CODE, fileName: 'Widget.tsx' }) },
        jwt
      )
    );
  } finally {
    (NotificationRepository as any).createNotification = original;
  }

  assert.equal(res.status, 200, 'a notification-write failure must not turn an already-successful scan save into a 500');
  const body = await res.json();
  assert.ok(body.record?.id, 'the response must still include the persisted scan record');

  const { records } = await ScanRepository.getScanRecords({ userId: user.id });
  assert.equal(records.length, 1, 'the scan record must actually be persisted exactly once, not lost or duplicated');
});
