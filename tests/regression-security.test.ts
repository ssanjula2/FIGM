import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as scanPOST } from '../app/api/scan/route';
import { GET as projectGET, PATCH as projectPATCH, DELETE as projectDELETE } from '../app/api/projects/[id]/route';

test('Security & Vulnerability Regression Test Suite', async (t) => {
  await t.test('POST /api/scan rejects payloads exceeding 500KB with 413 Payload Too Large', async () => {
    const hugeCode = 'x'.repeat(500001);
    const req = new Request('http://localhost:3000/api/scan', {
      method: 'POST',
      body: JSON.stringify({ code: hugeCode, fileName: 'HugeFile.tsx' }),
    });

    const res = await scanPOST(req);
    assert.equal(res.status, 413);
  });

  await t.test('POST /api/scan handles unauthenticated guest scans without crashing', async () => {
    const req = new Request('http://localhost:3000/api/scan', {
      method: 'POST',
      body: JSON.stringify({ code: 'const x = 1;', fileName: 'Test.tsx' }),
    });

    const res = await scanPOST(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.diagnostics);
  });

  await t.test('GET /api/projects/[id] blocks unauthenticated cross-user IDOR access', async () => {
    const req = new Request('http://localhost:3000/api/projects/prj_demo_react');
    const res = await projectGET(req, { params: { id: 'prj_demo_react' } });
    
    // Unauthenticated request should be forbidden or return 401/403/404 if project is missing/unauthorized
    assert.ok(res.status === 403 || res.status === 401 || res.status === 404);
  });
});
