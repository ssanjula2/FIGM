import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const reportPath = path.resolve(process.cwd(), 'figm-scan-report.html');

// Run scan first if report does not exist yet
if (!fs.existsSync(reportPath)) {
  console.log('[FIGM UI] No report found. Running initial scan on samples/sample-spa...');
  try {
    execSync('npx tsx src/cli/figm-analyze.ts samples/sample-spa', { stdio: 'inherit' });
  } catch (err) {
    console.error('[FIGM UI] Failed to run initial scan:', err);
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/json') {
    const jsonPath = path.resolve(process.cwd(), 'figm-scan-report.json');
    if (fs.existsSync(jsonPath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(fs.readFileSync(jsonPath, 'utf-8'));
      return;
    }
  }

  if (fs.existsSync(reportPath)) {
    const html = fs.readFileSync(reportPath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('FIGM Report not found. Run "npm run analyze" first.');
  }
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` FIGM UI Dashboard Server active at: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
