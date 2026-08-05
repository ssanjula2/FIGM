/**
 * Framework-Independent Guideline Model (FIGM)
 * Standalone HTML & JSON Report Generator Module (reports/generator.ts)
 */

import { ReportGenerator, AggregateScanReport } from '../src/reporter/report-generator.js';
import { ScanResult } from '../src/engine/rule-execution-engine.js';

export { ReportGenerator, AggregateScanReport };

export function generateHTMLReport(scanResults: ScanResult[]): string {
  const aggregateReport = ReportGenerator.createAggregateReport(scanResults);
  return ReportGenerator.generateHTML(aggregateReport);
}

export function generateJSONReport(scanResults: ScanResult[]): string {
  const aggregateReport = ReportGenerator.createAggregateReport(scanResults);
  return ReportGenerator.generateJSON(aggregateReport);
}
