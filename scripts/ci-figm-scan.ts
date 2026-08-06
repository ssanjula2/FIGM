import fs from 'node:fs';
import path from 'node:path';
import { RuleExecutionEngine, ScanResult } from '../src/engine/rule-execution-engine';
import { RemediationEngine } from '../src/engine/remediation-engine';

export interface CIReport {
  timestamp: string;
  overallScore: number;
  totalFilesScanned: number;
  totalViolations: number;
  severityCounts: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  domainCounts: {
    PERFORMANCE: number;
    ACCESSIBILITY: number;
    SECURITY: number;
  };
  scannedFiles: string[];
  fileResults: ScanResult[];
  aiSuggestions: {
    fileName: string;
    ruleId: string;
    patch: string;
  }[];
  passed: boolean;
  failReason?: string;
}

function findSourceFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!['node_modules', '.next', '.git', 'dist', 'build', 'coverage', '.system_generated', 'vscode-extension'].includes(file)) {
        findSourceFiles(filePath, fileList);
      }
    } else {
      const isLegacyCompiledJs = (filePath.includes('src/pipeline') || filePath.includes('src\\pipeline') || filePath.includes('src/reporter') || filePath.includes('src\\reporter')) && file.endsWith('.js');
      if (/\.(jsx?|tsx?|vue|ts)$/.test(file) && !file.endsWith('.d.ts') && !file.endsWith('.test.ts') && !isLegacyCompiledJs) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

export async function runCIBenchmarkScan(): Promise<CIReport> {
  console.log('====================================================');
  console.log('FIGM DevSecOps Enterprise Static Analysis Engine');
  console.log('====================================================');

  const rootDir = process.cwd();
  const searchDirs = [
    path.join(rootDir, 'app'),
    path.join(rootDir, 'src'),
  ];

  let sourceFiles: string[] = [];
  for (const dir of searchDirs) {
    sourceFiles = sourceFiles.concat(findSourceFiles(dir));
  }

  // Deduplicate files
  sourceFiles = Array.from(new Set(sourceFiles));

  console.log(`Found ${sourceFiles.length} application source files for DevSecOps inspection.`);

  const fileResults: ScanResult[] = [];
  let totalViolations = 0;
  const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const domainCounts = { PERFORMANCE: 0, ACCESSIBILITY: 0, SECURITY: 0 };
  const aiSuggestions: { fileName: string; ruleId: string; patch: string }[] = [];

  for (const fullPath of sourceFiles) {
    const relativePath = path.relative(rootDir, fullPath);
    const code = fs.readFileSync(fullPath, 'utf-8');

    const result = RuleExecutionEngine.analyzeFile(relativePath, code);
    fileResults.push(result);

    // Annotations for GitHub Actions Workflow Output
    for (const diag of result.diagnostics) {
      totalViolations++;
      const sev = (diag.severity || 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW';
      if (sev === 'HIGH') severityCounts.HIGH++;
      else if (sev === 'MEDIUM') severityCounts.MEDIUM++;
      else severityCounts.LOW++;

      const dom = (diag.domain || 'PERFORMANCE') as 'PERFORMANCE' | 'ACCESSIBILITY' | 'SECURITY';
      if (dom === 'ACCESSIBILITY') domainCounts.ACCESSIBILITY++;
      else if (dom === 'SECURITY') domainCounts.SECURITY++;
      else domainCounts.PERFORMANCE++;

      // Print GitHub Actions Annotation commands
      const annotationType = sev === 'HIGH' ? 'error' : 'warning';
      const lineNum = diag.location?.start?.line || 1;
      console.log(`::${annotationType} file=${relativePath},line=${lineNum}::[${diag.ruleId}] ${diag.ruleName}: ${diag.message}`);

      // Generate AI Patch for HIGH severity issues
      if (sev === 'HIGH' && aiSuggestions.length < 5) {
        try {
          const remediation = RemediationEngine.applyQuickFix(diag.offendingCodeSnippet || code.substring(0, 100), {
            ruleId: diag.ruleId,
            offendingCodeSnippet: diag.offendingCodeSnippet || code.substring(0, 100),
          } as any);
          aiSuggestions.push({
            fileName: relativePath,
            ruleId: diag.ruleId,
            patch: remediation.remediatedCode,
          });
        } catch {
          // Fallback if snippet fails
        }
      }
    }
  }

  const scores = fileResults
    .map((f) => (typeof f.qualityScore === 'number' && !isNaN(f.qualityScore) ? f.qualityScore : 90))
    .filter((s) => s >= 0 && s <= 100);
  const overallScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;

  const CRITICAL_THRESHOLD = 50;
  const HIGH_THRESHOLD = 500;
  const SCORE_THRESHOLD = 70;

  let passed = true;
  let failReason: string | undefined;

  if (severityCounts.CRITICAL > CRITICAL_THRESHOLD) {
    passed = false;
    failReason = `Failed due to ${severityCounts.CRITICAL} CRITICAL security/architectural defects.`;
  } else if (severityCounts.HIGH > HIGH_THRESHOLD) {
    passed = false;
    failReason = `Failed: High severity violations (${severityCounts.HIGH}) exceeded maximum threshold (${HIGH_THRESHOLD}).`;
  } else if (overallScore < SCORE_THRESHOLD) {
    passed = false;
    failReason = `Failed: Overall Quality Score (${overallScore}%) fell below minimum threshold (${SCORE_THRESHOLD}%).`;
  }

  const report: CIReport = {
    timestamp: new Date().toISOString(),
    overallScore,
    totalFilesScanned: fileResults.length,
    totalViolations,
    severityCounts,
    domainCounts,
    scannedFiles: sourceFiles.map((f) => path.relative(rootDir, f)),
    fileResults,
    aiSuggestions,
    passed,
    failReason,
  };

  // Generate JSON Report Artifact
  const jsonReportPath = path.join(rootDir, 'figm-ci-report.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`Saved JSON CI Report artifact to: ${jsonReportPath}`);

  // Generate Markdown Summary Report
  const mdReportPath = path.join(rootDir, 'figm-ci-report.md');
  const markdownContent = buildMarkdownReport(report);
  fs.writeFileSync(mdReportPath, markdownContent, 'utf-8');
  console.log(`Saved Markdown CI Report artifact to: ${mdReportPath}`);

  console.log('\n----------------------------------------------------');
  console.log(`FIGM CI Inspection Status: ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Overall Quality Score: ${overallScore}%`);
  console.log(`Total Violations: ${totalViolations} (High: ${severityCounts.HIGH}, Med: ${severityCounts.MEDIUM}, Low: ${severityCounts.LOW})`);
  console.log('----------------------------------------------------\n');

  if (!passed) {
    console.error(`❌ CI Pipeline Failure Reason: ${failReason}`);
    process.exit(1);
  }

  return report;
}

function buildMarkdownReport(report: CIReport): string {
  const statusEmoji = report.passed ? '✅ PASSED' : '❌ FAILED';
  const scoreColor = report.overallScore >= 90 ? '🟢' : report.overallScore >= 75 ? '🟡' : '🔴';

  let md = `## 🛡️ FIGM DevSecOps Inspection Report — ${statusEmoji}\n\n`;
  md += `### 📊 Summary Dashboard\n\n`;
  md += `| Metric | Value |\n`;
  md += `| :--- | :--- |\n`;
  md += `| **Overall Quality Score** | ${scoreColor} **${report.overallScore}%** |\n`;
  md += `| **Status** | **${statusEmoji}** |\n`;
  md += `| **Total Files Scanned** | \`${report.totalFilesScanned}\` |\n`;
  md += `| **Total Violations Detected** | \`${report.totalViolations}\` |\n`;
  md += `| **Performance Defects** | \`${report.domainCounts.PERFORMANCE}\` |\n`;
  md += `| **Accessibility Defects** | \`${report.domainCounts.ACCESSIBILITY}\` |\n`;
  md += `| **Security & Guideline Defects** | \`${report.domainCounts.SECURITY}\` |\n\n`;

  md += `### ⚠️ Severity Distribution\n\n`;
  md += `- 🔴 **Critical**: \`${report.severityCounts.CRITICAL}\`\n`;
  md += `- 🟧 **High**: \`${report.severityCounts.HIGH}\`\n`;
  md += `- 🟨 **Medium**: \`${report.severityCounts.MEDIUM}\`\n`;
  md += `- 🟦 **Low**: \`${report.severityCounts.LOW}\`\n\n`;

  if (report.failReason) {
    md += `> [!CAUTION]\n`;
    md += `> **Pipeline Failure Reason**: ${report.failReason}\n\n`;
  }

  if (report.aiSuggestions.length > 0) {
    md += `### 🤖 AI Remediation Suggestions\n\n`;
    for (const ai of report.aiSuggestions) {
      md += `<details><summary><b>[${ai.ruleId}] ${ai.fileName}</b></summary>\n\n`;
      md += `\`\`\`typescript\n${ai.patch}\n\`\`\`\n\n`;
      md += `</details>\n\n`;
    }
  }

  md += `### 📁 Scanned Target Files\n\n`;
  for (const f of report.scannedFiles.slice(0, 15)) {
    md += `- \`${f}\`\n`;
  }
  if (report.scannedFiles.length > 15) {
    md += `- *...and ${report.scannedFiles.length - 15} more files.*\n`;
  }

  md += `\n---\n*Report generated by FIGM Code Inspector DevSecOps CI/CD Automation Engine v3.0*\n`;
  return md;
}

if (require.main === module) {
  runCIBenchmarkScan().catch((err) => {
    console.error('Fatal CI Execution Error:', err);
    process.exit(1);
  });
}
