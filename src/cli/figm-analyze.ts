#!/usr/bin/env node
/**
 * Framework-Independent Guideline Model (FIGM)
 * Production CLI Static Analyzer Entry Point
 * 
 * Supports:
 * - `--path <dir>`: Target directory to scan
 * - `--framework <react|vue|angular|auto>`: Framework override or auto-detection
 * - `--format <json|html|console|both>`: Report output format
 * - `--threshold <number>`: Minimum quality score required to pass CI
 * - `--ignore <pattern>`: Directory/file ignore list (comma separated)
 * - `--out <filename>`: Output report base filename
 */

import fs from 'node:fs';
import path from 'node:path';
import { RuleExecutionEngine, ScanResult } from '../engine/rule-execution-engine.js';
import { ReportGenerator, AggregateScanReport } from '../reporter/report-generator.js';
import { calculateQualityScoreFromCounts } from '../engine/quality-score.js';

export interface CLIOptions {
  targetDir: string;
  framework: string;
  format: 'json' | 'html' | 'console' | 'both';
  threshold: number | null;
  ignorePatterns: string[];
  out: string;
}

export function parseCLIArgs(args: string[]): CLIOptions {
  const pathVal = getArgValue(args, '--path');
  const positionalPath = args.find((a) => !a.startsWith('--') && a !== pathVal);
  const targetDir = pathVal || positionalPath || '.';

  const framework = (getArgValue(args, '--framework') || 'auto').toLowerCase();
  const format = (getArgValue(args, '--format') || 'both').toLowerCase() as CLIOptions['format'];
  
  const thresholdStr = getArgValue(args, '--threshold');
  const threshold = thresholdStr ? parseInt(thresholdStr, 10) : null;

  const ignoreStr = getArgValue(args, '--ignore');
  const ignorePatterns = ignoreStr
    ? ignoreStr.split(',').map((s) => s.trim())
    : ['node_modules', 'dist', '.git', 'build', '.next', 'coverage'];

  const out = getArgValue(args, '--out') || 'figm-scan-report';

  return {
    targetDir,
    framework,
    format,
    threshold,
    ignorePatterns,
    out,
  };
}

export function runCLI(args: string[]): number {
  const options = parseCLIArgs(args);
  const resolvedDir = path.resolve(process.cwd(), options.targetDir);

  if (!fs.existsSync(resolvedDir)) {
    console.error(`[FIGM CLI Error] Target directory does not exist: ${resolvedDir}`);
    return 1;
  }

  console.log(`=======================================================`);
  console.log(` FIGM Static Analysis Scanner v2.0`);
  console.log(` Target Path: ${resolvedDir}`);
  console.log(` Framework Target: ${options.framework.toUpperCase()}`);
  console.log(` Report Format: ${options.format.toUpperCase()}`);
  if (options.threshold !== null) {
    console.log(` Quality Threshold: ${options.threshold}/100`);
  }
  console.log(`=======================================================\n`);

  const filePaths: string[] = [];
  collectFiles(resolvedDir, filePaths, options.ignorePatterns);

  if (filePaths.length === 0) {
    console.log(`No supported source files (.js, .ts, .jsx, .tsx, .vue, .svelte) found.`);
    return 0;
  }

  const results: ScanResult[] = [];

  for (const file of filePaths) {
    const relativePath = path.relative(resolvedDir, file);
    try {
      const code = fs.readFileSync(file, 'utf-8');
      const scanRes = RuleExecutionEngine.analyzeFile(relativePath, code);
      
      // Override framework if explicitly set (unless set to auto)
      if (options.framework !== 'auto') {
        scanRes.framework = options.framework.toUpperCase();
      }

      results.push(scanRes);
      console.log(`  [SCAN] ${relativePath} (${scanRes.framework}) -> ${scanRes.diagnostics.length} defects, ${scanRes.extractedALPsCount} ALPs`);
    } catch (err) {
      console.warn(`  [WARN] Failed to read ${relativePath}:`, err);
    }
  }

  const aggregateReport: AggregateScanReport = ReportGenerator.createAggregateReport(results);
  const { summary } = aggregateReport;

  const qualityScore = calculateQualityScoreFromCounts(summary);

  console.log(`\n-------------------------------------------------------`);
  console.log(` SCAN SUMMARY`);
  console.log(` Scanned Files: ${summary.scannedFiles}`);
  console.log(` Quality Score: ${qualityScore}/100`);
  console.log(` Total Defects: ${summary.totalDiagnostics} (Critical: ${summary.criticalCount}, High: ${summary.highCount}, Medium: ${summary.mediumCount}, Low: ${summary.lowCount})`);
  console.log(` Total ALPs Extracted: ${summary.totalPrimitivesExtracted}`);
  console.log(`-------------------------------------------------------\n`);

  // Report Exporting
  if (options.format === 'json' || options.format === 'both') {
    const jsonPath = path.resolve(process.cwd(), `${options.out}.json`);
    fs.writeFileSync(jsonPath, ReportGenerator.generateJSON(aggregateReport), 'utf-8');
    console.log(`[FIGM CLI] Exported JSON report to: ${jsonPath}`);
  }

  if (options.format === 'html' || options.format === 'both') {
    const htmlPath = path.resolve(process.cwd(), `${options.out}.html`);
    fs.writeFileSync(htmlPath, ReportGenerator.generateHTML(aggregateReport), 'utf-8');
    console.log(`[FIGM CLI] Exported HTML report to: ${htmlPath}`);
  }

  // Threshold Enforcement for CI/CD
  if (options.threshold !== null) {
    if (qualityScore < options.threshold) {
      console.error(
        `\n❌ [CI FAILURE] Quality Score (${qualityScore}) is below threshold (${options.threshold}). Exiting with status 1.`
      );
      return 1;
    } else {
      console.log(`\n✅ [CI SUCCESS] Quality Score (${qualityScore}) satisfies threshold (${options.threshold}).`);
    }
  }

  console.log(`\nScan complete.`);
  return 0;
}

function collectFiles(targetPath: string, fileList: string[], ignorePatterns: string[]) {
  if (!fs.existsSync(targetPath)) return;
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    fileList.push(targetPath);
    return;
  }
  const items = fs.readdirSync(targetPath, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      if (!ignorePatterns.includes(item.name)) {
        collectFiles(path.join(targetPath, item.name), fileList, ignorePatterns);
      }
    } else if (item.isFile()) {
      const ext = path.extname(item.name).toLowerCase();
      if (['.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte'].includes(ext)) {
        fileList.push(path.join(targetPath, item.name));
      }
    }
  }
}

function getArgValue(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return null;
}

// Direct Execution Entry Point
if (process.argv[1] && (process.argv[1].includes('figm-analyze') || process.argv[1].includes('figm-model'))) {
  const exitCode = runCLI(process.argv.slice(2));
  if (exitCode !== 0 && process.env.NODE_ENV !== 'test') {
    process.exit(exitCode);
  }
}
