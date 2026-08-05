/**
 * Framework-Independent Guideline Model (FIGM)
 * Scan Report Generator (JSON & Interactive HTML Dashboard)
 */

import { ScanResult } from '../engine/rule-execution-engine.js';
import { DiagnosticReport } from '../types/ast-spec.js';

export interface AggregateScanReport {
  summary: {
    scannedFiles: number;
    totalDiagnostics: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    totalPrimitivesExtracted: number;
    scanTimestamp: string;
  };
  fileResults: ScanResult[];
  allDiagnostics: DiagnosticReport[];
}

export class ReportGenerator {
  public static createAggregateReport(fileResults: ScanResult[]): AggregateScanReport {
    const allDiagnostics = fileResults.flatMap((f) => f.diagnostics);

    const criticalCount = allDiagnostics.filter((d) => d.severity === 'CRITICAL').length;
    const highCount = allDiagnostics.filter((d) => d.severity === 'HIGH').length;
    const mediumCount = allDiagnostics.filter((d) => d.severity === 'MEDIUM').length;
    const lowCount = allDiagnostics.filter((d) => d.severity === 'LOW').length;

    const totalPrimitivesExtracted = fileResults.reduce((acc, f) => acc + f.extractedALPsCount, 0);

    return {
      summary: {
        scannedFiles: fileResults.length,
        totalDiagnostics: allDiagnostics.length,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        totalPrimitivesExtracted,
        scanTimestamp: new Date().toISOString()
      },
      fileResults,
      allDiagnostics
    };
  }

  public static generateJSON(report: AggregateScanReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Generates the System Architecture & Technical Specification compliant JSON Report Schema (Section 4)
   */
  public static generateSpecReport(report: AggregateScanReport): any {
    const { summary, allDiagnostics, fileResults } = report;

    const totalIssues = summary.totalDiagnostics;
    const weightedPenalty =
      summary.criticalCount * 15 + summary.highCount * 8 + summary.mediumCount * 3 + summary.lowCount * 1;
    const qualityScore = Math.max(0, 100 - weightedPenalty);

    let performanceRating = 'A';
    if (qualityScore >= 90) performanceRating = 'A+';
    else if (qualityScore >= 80) performanceRating = 'A';
    else if (qualityScore >= 70) performanceRating = 'B+';
    else if (qualityScore >= 60) performanceRating = 'B';
    else if (qualityScore >= 50) performanceRating = 'C';
    else performanceRating = 'F';

    // Aggregate performance & complexity metrics
    const totalExecutionTimeMs = fileResults.reduce((sum, f) => sum + (f.profile?.executionTimeMs || 0.15), 0);
    const maxPeakMemoryMb = fileResults.reduce((max, f) => Math.max(max, f.profile?.peakMemoryMb || 0.5), 0);
    const maxCyclomaticComplexity = fileResults.reduce((max, f) => Math.max(max, f.complexity?.cyclomaticComplexity || 1), 0);

    const submissionId = `sub_${Math.random().toString(36).substring(2, 10)}`;

    const issuesDetected = allDiagnostics.map((d, idx) => {
      const line = d.location?.start?.line || 1;
      return {
        id: `ERR-${String(idx + 1).padStart(3, '0')}`,
        type: String(d.domain).includes('PERF') || d.ruleId.includes('PERF') ? 'Performance Bottleneck' : 'Accessibility Defect',
        severity: d.severity,
        location: `${d.filePath}: line ${line}`,
        message: `${d.ruleName}: ${d.concern}`,
        suggested_fix: {
          diff: `@@ -${line},2 +${line},3 @@\n- ${d.offendingCodeSnippet.split('\n')[0] || ''}\n+ // [FIGM Remediation]: ${d.remediation}\n+ ${d.offendingCodeSnippet.split('\n')[0] || ''}`,
          explanation: d.remediation,
        },
      };
    });

    return {
      submission_id: submissionId,
      timestamp: summary.scanTimestamp || new Date().toISOString(),
      summary: {
        quality_score: qualityScore,
        performance_rating: performanceRating,
        passed_checks: Math.max(0, summary.totalPrimitivesExtracted - totalIssues),
        total_issues: totalIssues,
      },
      performance_metrics: {
        execution_time_ms: parseFloat(totalExecutionTimeMs.toFixed(2)),
        peak_memory_mb: parseFloat(maxPeakMemoryMb.toFixed(2)),
        cyclomatic_complexity: maxCyclomaticComplexity,
      },
      issues_detected: issuesDetected,
    };
  }

  public static generateHTML(report: AggregateScanReport): string {
    const { summary, allDiagnostics } = report;

    const diagnosticRows = allDiagnostics
      .map(
        (d) => `
      <tr class="severity-${d.severity.toLowerCase()}">
        <td><span class="badge badge-${d.severity.toLowerCase()}">${d.severity}</span></td>
        <td><code>${d.ruleId}</code></td>
        <td><strong>${d.ruleName}</strong></td>
        <td><span class="domain-tag">${d.domain}</span> / <small>${d.concern}</small></td>
        <td><code>${d.filePath}:${d.location.start.line}</code></td>
        <td><pre><code>${this.escapeHTML(d.offendingCodeSnippet)}</code></pre></td>
        <td><em>${d.remediation}</em></td>
        <td><small>${d.standardReference}</small></td>
      </tr>`
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FIGM Static Analysis Report</title>
  <style>
    :root {
      --bg: #0f172a;
      --panel: #1e293b;
      --text: #f8fafc;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --critical: #ef4444;
      --high: #f97316;
      --medium: #eab308;
      --low: #22c55e;
      --border: #334155;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 30px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid var(--border);
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 {
      margin: 0;
      color: var(--accent);
      font-size: 28px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    .stat-value {
      font-size: 32px;
      font-weight: bold;
    }
    .stat-label {
      color: var(--muted);
      font-size: 13px;
      text-transform: uppercase;
      margin-top: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--panel);
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
    }
    th {
      background: #0f172a;
      color: var(--muted);
      text-transform: uppercase;
      font-size: 12px;
    }
    pre {
      margin: 0;
      background: #090d16;
      padding: 6px 10px;
      border-radius: 4px;
      max-width: 250px;
      overflow-x: auto;
    }
    .badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 11px;
    }
    .badge-critical { background: var(--critical); color: #fff; }
    .badge-high { background: var(--high); color: #fff; }
    .badge-medium { background: var(--medium); color: #000; }
    .badge-low { background: var(--low); color: #000; }
    .domain-tag { background: #334155; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>FIGM Static Analysis Diagnostic Report</h1>
      <small style="color: var(--muted)">Framework-Independent Guideline Model Analysis Engine v2.0</small>
    </div>
    <div style="color: var(--muted)">Scan Time: ${summary.scanTimestamp}</div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value" style="color: var(--accent)">${summary.scannedFiles}</div>
      <div class="stat-label">Files Scanned</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--critical)">${summary.criticalCount}</div>
      <div class="stat-label">Critical Defects</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--high)">${summary.highCount}</div>
      <div class="stat-label">High Defects</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--medium)">${summary.mediumCount}</div>
      <div class="stat-label">Medium Defects</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" style="color: var(--accent)">${summary.totalPrimitivesExtracted}</div>
      <div class="stat-label">ALPs Extracted</div>
    </div>
  </div>

  <h2>Diagnostic Issues (${summary.totalDiagnostics})</h2>
  <table>
    <thead>
      <tr>
        <th>Severity</th>
        <th>Rule ID</th>
        <th>Rule Name</th>
        <th>Domain / Concern</th>
        <th>Location</th>
        <th>Offending Snippet</th>
        <th>Remediation Advice</th>
        <th>Standard</th>
      </tr>
    </thead>
    <tbody>
      ${diagnosticRows.length > 0 ? diagnosticRows : '<tr><td colspan="8" style="text-align:center">No quality defects detected. Excellent!</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
  }

  private static escapeHTML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
