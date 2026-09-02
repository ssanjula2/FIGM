import test from 'node:test';
import assert from 'node:assert/strict';
import { signJWT } from '../src/auth/auth-service';
import { RepositoryFactory } from '../src/storage/repository-factory';
import { GET as exportDissertationGET } from '../app/api/export-dissertation/route';

/**
 * Regression coverage for Phase 15 closure: GET /api/export-dissertation required authentication
 * but had no rate limiting, even though every request triggers real server-side disk writes
 * (DissertationExporter.exportAllArtifacts). A single authenticated account could hammer it to
 * force unlimited disk writes. The fix adds the same checkRateLimit/getClientIp pattern used by
 * every other write-triggering auth route in this codebase (limit: 5/min).
 */

function tokenFor(userId: string): string {
  return signJWT({ userId, email: `${userId}@figm.io`, fullName: userId, role: 'DEVELOPER' });
}

test('GET /api/export-dissertation is rate-limited (was previously unthrottled)', async () => {
  RepositoryFactory.resetProvider();
  const userId = `usr_dissertation_ratelimit_${Date.now()}`;
  const testIp = `10.60.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
  const jwt = tokenFor(userId);

  let sawRateLimit = false;
  let sawSuccess = false;
  for (let i = 0; i < 10; i++) {
    const req = new Request('http://localhost:3000/api/export-dissertation', {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'x-forwarded-for': testIp,
      },
    });
    const res = await exportDissertationGET(req);
    if (res.status === 200) sawSuccess = true;
    if (res.status === 429) {
      sawRateLimit = true;
      assert.ok(res.headers.get('Retry-After'), '429 response must include a Retry-After header');
      break;
    }
  }

  assert.ok(sawSuccess, 'at least the first few requests under the limit must succeed');
  assert.ok(sawRateLimit, 'export-dissertation must be rate-limited within 10 rapid requests from the same IP (limit is 5/min)');
});

test('an unauthenticated caller is still rejected before rate-limit state is even relevant', async () => {
  RepositoryFactory.resetProvider();
  const testIp = `10.61.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
  const req = new Request('http://localhost:3000/api/export-dissertation', {
    headers: { 'x-forwarded-for': testIp },
  });
  const res = await exportDissertationGET(req);
  assert.equal(res.status, 401);
});
