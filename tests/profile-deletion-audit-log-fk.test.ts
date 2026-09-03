import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signJWT } from '../src/auth/auth-service';
import { UserDB } from '../src/auth/user-db';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { DELETE as profileDELETE } from '../app/api/profile/route';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../');

/**
 * Regression coverage for a bug found via live browser QA against the real Supabase/Postgres
 * backend (not caught by the existing test suite, which runs against the JSON fallback provider
 * that doesn't enforce foreign keys): DELETE /api/profile called UserRepository.deleteAccount(userId)
 * FIRST, then AuditLogger.logEvent('LOGOUT', { userId, ... }) SECOND. AuditLog.userId is a real
 * foreign key to User (nullable, ON DELETE SET NULL for rows that already existed at delete time --
 * see prisma/schema.prisma) -- inserting a NEW audit log row that references the just-deleted
 * userId has no matching User to satisfy that constraint, so on Postgres this INSERT always failed
 * with a foreign-key violation, turning a successful account deletion into a reported 500. Live
 * server log excerpt that caught it: `code: 'P2003' ... ForeignKeyConstraintViolation ...
 * DELETE /api/profile 500 in 511ms`.
 */

function authedRequest(url: string, opts: RequestInit, jwt?: string): Request {
  const headers = new Headers(opts.headers);
  if (jwt) headers.set('Authorization', `Bearer ${jwt}`);
  return new Request(url, { ...opts, headers });
}

test('app/api/profile/route.ts deletes the account BEFORE logging the audit event, and never references the deleted userId in that log call', () => {
  const content = fs.readFileSync(path.join(rootDir, 'app/api/profile/route.ts'), 'utf-8');
  const deleteHandlerMatch = content.match(/export async function DELETE\([\s\S]*?\n}/);
  assert.ok(deleteHandlerMatch, 'expected to find the DELETE handler');
  const handlerSrc = deleteHandlerMatch![0];

  const deleteCallIndex = handlerSrc.indexOf('UserRepository.deleteAccount(');
  const auditCallIndex = handlerSrc.indexOf("AuditLogger.logEvent('LOGOUT'");
  assert.ok(deleteCallIndex >= 0 && auditCallIndex >= 0, 'expected both calls to be present');
  assert.ok(deleteCallIndex < auditCallIndex, 'deleteAccount must run BEFORE the audit log call, not after');

  // Extract just the AuditLogger.logEvent(...) call arguments and confirm userId isn't threaded
  // through -- the account (and therefore any FK target for it) no longer exists at this point.
  const auditCallSrc = handlerSrc.slice(auditCallIndex, handlerSrc.indexOf(');', auditCallIndex));
  assert.doesNotMatch(auditCallSrc, /\buserId\b/, 'the post-deletion audit log must not reference the now-deleted userId (real FK violation on Postgres)');
});

test('DELETE /api/profile actually succeeds end-to-end and the account is gone afterward', async () => {
  RepositoryFactory.resetProvider();
  const provider = RepositoryFactory.getStorageProvider();
  const user = UserDB.createUser({
    email: `delete_fk_regression_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@figm.io`,
    passwordHash: 'unused-in-this-test',
    fullName: 'Delete FK Regression User',
    role: 'DEVELOPER',
  });
  const jwt = signJWT({ userId: user.id, email: user.email, fullName: user.fullName, role: 'DEVELOPER' }, user.tokenVersion ?? 0);

  const res = await profileDELETE(authedRequest('http://localhost:3000/api/profile', { method: 'DELETE' }, jwt));
  assert.equal(res.status, 200, 'account deletion must succeed, not 500 on the audit-log FK violation');

  const after = await provider.findUserById(user.id);
  assert.equal(after, undefined, 'the account must actually be gone after a successful delete');
});
