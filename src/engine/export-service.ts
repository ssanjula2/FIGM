import { DBScanRecord } from '../auth/user-db';

/** Neutralizes CSV formula injection (SEC-07): a cell value opening with `=`, `+`, `-`, or `@` is
 *  interpreted as a formula by Excel/Sheets when the exported file is opened, not as literal text
 *  -- a real code-execution vector if a malicious `offendingCodeSnippet`/`ruleName`/`remediation`
 *  string (all ultimately derived from analyzed source code, which is attacker-influenceable) is
 *  exported and opened. Prefixing a `'` forces spreadsheet applications to render the cell as
 *  plain text instead of evaluating it. Applied to every interpolated CSV field below, not just
 *  the two that were already quote-escaped -- `ruleId`/`severity`/`domain` are normally
 *  engine-controlled enum values that could never start with these characters in practice, but
 *  sanitizing them too costs nothing and removes any dependency on that assumption holding. */
function sanitizeCsvCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class ExportService {
  public static exportJSON(record: DBScanRecord): string {
    const payload = {
      header: {
        title: 'FIGM Code Inspector Quality Report',
        standard: 'ISO/IEC 25010 & W3C WCAG 2.2 AA',
        timestamp: record.createdAt,
        exporter: 'FIGM Automated Quality Engine v3.0',
      },
      metadata: {
        id: record.id,
        fileName: record.fileName,
        framework: record.framework,
        repositoryUrl: record.repositoryUrl || 'Local Repository',
        qualityScore: record.qualityScore,
        scanTimeMs: record.scanTimeMs,
        memoryUsageMb: record.memoryUsageMb,
        ruleCount: record.ruleCount,
        aiFixCount: record.aiFixCount,
      },
      diagnostics: record.diagnostics || [],
      researchReferences: [
        'ISO/IEC 25010: Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE)',
        'W3C Web Content Accessibility Guidelines (WCAG) 2.2 Level AA',
        'Google Web Vitals Specification (LCP, FID/INP, CLS)',
        'Framework-Independent Guideline Model (FIGM) Specification v3.0',
      ],
    };

    return JSON.stringify(payload, null, 2);
  }

  public static exportCSV(record: DBScanRecord): string {
    const lines: string[] = [
      'Rule ID,Rule Name,Severity,Domain,Line,Column,Offending Snippet,Remediation',
    ];

    const diagnostics = record.diagnostics || [];
    diagnostics.forEach((d: any) => {
      const lineNum = d.location?.start?.line || 1;
      const colNum = d.location?.start?.column || 1;
      const ruleId = sanitizeCsvCell(d.ruleId || '');
      const ruleName = sanitizeCsvCell(d.ruleName || '');
      const severity = sanitizeCsvCell(d.severity || 'MEDIUM');
      const domain = sanitizeCsvCell(d.domain || 'PERFORMANCE');
      const cleanSnippet = `"${sanitizeCsvCell(d.offendingCodeSnippet || '').replace(/"/g, '""')}"`;
      const cleanRemediation = `"${sanitizeCsvCell(d.remediation || '').replace(/"/g, '""')}"`;
      lines.push(
        `${ruleId},"${ruleName}",${severity},${domain},${lineNum},${colNum},${cleanSnippet},${cleanRemediation}`
      );
    });

    return lines.join('\n');
  }

  public static exportMarkdown(record: DBScanRecord): string {
    return `# FIGM Code Inspector Report: ${record.fileName}

**Generated**: ${new Date(record.createdAt).toLocaleString()}  
**Target Framework**: \`${record.framework}\`  
**Quality Score**: **${record.qualityScore}%**  
**Execution Latency**: ${record.scanTimeMs} ms | **Peak Memory**: ${record.memoryUsageMb} MB  

---

## Scan Summary
- **Total Defects Identified**: ${record.ruleCount}
- **AI Remediation Patches Available**: ${record.aiFixCount}

---

## Detailed Diagnostics
${(record.diagnostics || [])
  .map(
    (d: any, idx: number) => `
### ${idx + 1}. [${d.ruleId}] ${d.ruleName}
- **Severity**: \`${d.severity}\` | **Domain**: \`${d.domain}\`
- **Location**: Line ${d.location?.start?.line || 1}, Column ${d.location?.start?.column || 1}
\`\`\`typescript
${d.offendingCodeSnippet || ''}
\`\`\`
**Remediation**: ${d.remediation}
`
  )
  .join('\n\n')}

---

## Standard Compliance & Citations
1. **ISO/IEC 25010**: Systems and software Quality Requirements and Evaluation (SQuaRE).
2. **W3C WCAG 2.2**: Web Content Accessibility Guidelines (Level AA).
3. **Core Web Vitals**: Google Web Performance Metrics.
4. **FIGM Protocol**: Framework-Independent Guideline Model 3-Stage AST Protocol.

---
*Verified against ISO/IEC 25010 Quality Standards & WCAG 2.2 Level AA Guidelines.*
`;
  }

  public static exportPDF(record: DBScanRecord): string {
    const safeFileName = escapeHtml(record.fileName);
    const safeFramework = escapeHtml(record.framework);

    const diagnosticsHtml = (record.diagnostics || [])
      .map(
        (d: any) => `
      <div class="diagnostic-card">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <strong>[${escapeHtml(d.ruleId)}] ${escapeHtml(d.ruleName)}</strong>
          <span class="badge badge-${(d.severity || 'medium').toLowerCase()}">${escapeHtml(d.severity)}</span>
        </div>
        <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
          Domain: ${escapeHtml(d.domain)} | Location: Line ${d.location?.start?.line || 1}
        </div>
        <pre><code>${escapeHtml(d.offendingCodeSnippet || '')}</code></pre>
        <div style="font-size: 12px; margin-top: 8px;"><strong>Fix:</strong> ${escapeHtml(d.remediation)}</div>
      </div>
    `
      )
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FIGM Report - ${safeFileName}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; color: #0f172a; background: #ffffff; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 16px; margin-bottom: 24px; }
    .logo { font-size: 24px; font-weight: 900; color: #0284c7; }
    .meta { font-size: 13px; color: #64748b; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
    .stat-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background: #f8fafc; text-align: center; }
    .stat-value { font-size: 24px; font-weight: 800; color: #0284c7; }
    .stat-label { font-size: 12px; color: #64748b; font-weight: 600; }
    .section-title { font-size: 18px; font-weight: 700; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    .diagnostic-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
    .badge-critical { background: #fee2e2; color: #991b1b; }
    .badge-high { background: #ffedd5; color: #9a3412; }
    .badge-medium { background: #fef9c3; color: #854d0e; }
    pre { background: #0f172a; color: #f8fafc; padding: 12px; border-radius: 6px; overflow-x: auto; font-family: monospace; font-size: 12px; }
    .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">FIGM Code Inspector</div>
      <div class="meta">Automated SaaS Quality Inspection Report</div>
    </div>
    <div style="text-align: right;" class="meta">
      <div><strong>File:</strong> ${safeFileName}</div>
      <div><strong>Framework:</strong> ${safeFramework}</div>
      <div><strong>Date:</strong> ${new Date(record.createdAt).toLocaleString()}</div>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${record.qualityScore}%</div>
      <div class="stat-label">Quality Score</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${record.ruleCount}</div>
      <div class="stat-label">Defects Identified</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${record.scanTimeMs} ms</div>
      <div class="stat-label">Scan Latency</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${record.memoryUsageMb} MB</div>
      <div class="stat-label">Memory Usage</div>
    </div>
  </div>

  <div class="section-title">Diagnostic Findings</div>
  ${diagnosticsHtml || '<p style="color: #64748b;">Zero defects identified. Code conforms fully to FIGM quality guidelines.</p>'}

  <div class="footer">
    Verified against ISO/IEC 25010 System and Software Quality Models & WCAG 2.2 Level AA Guidelines.
  </div>
</body>
</html>`;
  }
}
