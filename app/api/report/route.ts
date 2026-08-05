import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { RuleExecutionEngine, ScanResult } from '../../../src/engine/rule-execution-engine';
import { ReportGenerator } from '../../../src/reporter/report-generator';

export async function GET(request: Request) {
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

    // Run fallback scan on samples/sample-spa
    const sampleDir = path.resolve(process.cwd(), 'samples/sample-spa');
    const results: ScanResult[] = [];

    if (fs.existsSync(sampleDir)) {
      const files = collectFiles(sampleDir);
      for (const file of files) {
        const relativePath = path.relative(sampleDir, file);
        const code = fs.readFileSync(file, 'utf-8');
        results.push(RuleExecutionEngine.analyzeFile(relativePath, code));
      }
    }

    const report = ReportGenerator.createAggregateReport(results);
    if (format === 'spec') {
      return NextResponse.json(ReportGenerator.generateSpecReport(report));
    }
    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
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
