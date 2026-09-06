import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { RuleExecutionEngine, ScanResult } from '../../../src/engine/rule-execution-engine';
import { ReportGenerator, AggregateScanReport } from '../../../src/reporter/report-generator';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { checkRateLimit, getClientIp } from '../../../src/auth/rate-limiter';

// D-01 (research-collection-build hardening): the fallback scan below always analyzes the same
// fixed, non-user-specific samples/sample-spa directory -- there is no per-user dimension to this
// data at all, so a single process-lifetime memoized result is safe to share across every caller
// (never a cross-user data leak, since no user-specific data ever enters it). Previously this
// re-ran the full recursive scan on every single request when figm-scan-report.json was absent,
// which the rate limit below only throttled rather than eliminated. Reset to null if
// figm-scan-report.json ever exists at request time (that branch is preferred and never touches
// this cache).
let cachedFallbackReport: AggregateScanReport | null = null;

export async function GET(request: Request) {
  const auth = await authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Retained even though the fallback path is now memoized -- the cached-report branch below is
  // still cheap, but a cache-cold first request (or a future cache-invalidation path) should never
  // be hammerable without limit.
  const rateLimitError = await checkRateLimit(getClientIp(request), 10, 60000);
  if (rateLimitError) return rateLimitError;

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    const reportPath = path.resolve(process.cwd(), 'figm-scan-report.json');

    if (fs.existsSync(reportPath)) {
      const rawData = fs.readFileSync(reportPath, 'utf-8');
      const parsed = JSON.parse(rawData);
      if (format === 'spec') {
        return NextResponse.json(ReportGenerator.generateSpecReport(parsed));
      }
      return NextResponse.json(parsed);
    }

    if (!cachedFallbackReport) {
      // Run fallback scan on samples/sample-spa (once per process lifetime -- see
      // cachedFallbackReport's own doc comment).
      const sampleDir = path.resolve(process.cwd(), 'samples/sample-spa');
      const results: ScanResult[] = [];

      if (fs.existsSync(sampleDir)) {
        const files = collectFiles(sampleDir);
        for (const file of files) {
          const relativePath = path.relative(sampleDir, file);
          const code = fs.readFileSync(file, 'utf-8');
          // Async variant: this route runs on the live web server -- see
          // RuleExecutionEngine.analyzeFileAsync's doc comment.
          results.push(await RuleExecutionEngine.analyzeFileAsync(relativePath, code));
        }
      }

      cachedFallbackReport = ReportGenerator.createAggregateReport(results);
    }

    if (format === 'spec') {
      return NextResponse.json(ReportGenerator.generateSpecReport(cachedFallbackReport));
    }
    return NextResponse.json(cachedFallbackReport);
  } catch (err: any) {
    // SEC-02 (research-collection-build hardening): never return a raw exception message to the
    // client -- it can contain internal file paths or other server-internal detail. Full detail
    // stays server-side only.
    console.error('[api/report] failed:', err instanceof Error ? err.stack || err.message : err);
    return NextResponse.json({ error: 'Report generation failed. Please try again.' }, { status: 500 });
  }
}

function collectFiles(dir: string): string[] {
  const fileList: string[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && item.name !== 'dist') {
        fileList.push(...collectFiles(path.join(dir, item.name)));
      }
    } else if (item.isFile()) {
      const ext = path.extname(item.name).toLowerCase();
      if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
        fileList.push(path.join(dir, item.name));
      }
    }
  }
  return fileList;
}
