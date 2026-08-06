import http from 'http';

const BASE_URL = 'http://localhost:3000';

const endpoints = [
  '/api/health',
  '/api/dashboard/summary',
  '/api/dashboard/statistics',
  '/api/dashboard/reports',
  '/api/dashboard/frameworks',
  '/api/dashboard/activity',
  '/api/scans',
  '/api/projects',
  '/api/notifications',
  '/api/settings',
  '/api/auth/me',
  '/api/admin/users',
  '/api/admin/system',
];

async function checkEndpoint(endpoint: string): Promise<{ endpoint: string; status: number; ok: boolean; timeMs: number }> {
  const start = Date.now();
  return new Promise((resolve) => {
    http.get(`${BASE_URL}${endpoint}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const timeMs = Date.now() - start;
        resolve({
          endpoint,
          status: res.statusCode || 500,
          ok: (res.statusCode || 500) < 400,
          timeMs,
        });
      });
    }).on('error', (err) => {
      resolve({
        endpoint,
        status: 500,
        ok: false,
        timeMs: Date.now() - start,
      });
    });
  });
}

async function runVerification() {
  console.log('====================================================');
  console.log('FIGM API Endpoints Comprehensive Verification');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  for (const ep of endpoints) {
    const result = await checkEndpoint(ep);
    const symbol = result.ok ? '✅ PASSED' : '❌ FAILED';
    console.log(`${symbol} | Status: ${result.status} | ${result.timeMs}ms | Endpoint: ${result.endpoint}`);
    if (result.ok) passed++;
    else failed++;
  }

  console.log('----------------------------------------------------');
  console.log(`Results: Total ${endpoints.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================');
}

runVerification();
