import * as vscode from 'vscode';
import { RuleExecutionEngine, ScanResult } from '../../src/engine/rule-execution-engine';
import { FIGMStatusBarManager } from './status-bar';

export class FIGMDiagnosticsManager {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private outputChannel: vscode.OutputChannel;
  private statusBarManager: FIGMStatusBarManager;

  constructor(
    diagnosticCollection: vscode.DiagnosticCollection,
    outputChannel: vscode.OutputChannel,
    statusBarManager: FIGMStatusBarManager
  ) {
    this.diagnosticCollection = diagnosticCollection;
    this.outputChannel = outputChannel;
    this.statusBarManager = statusBarManager;
  }

  public async analyzeDocument(document: vscode.TextDocument): Promise<{ scanResult: ScanResult; qualityScore: number } | undefined> {
    const config = vscode.workspace.getConfiguration('figm');
    if (!config.get<boolean>('enable', true)) {
      return undefined;
    }

    const fileName = document.fileName;
    const isSupportedLanguage = /\.(jsx?|tsx?|vue|ts|html)$/.test(fileName);
    if (!isSupportedLanguage || fileName.includes('node_modules')) {
      return undefined;
    }

    const relativeName = vscode.workspace.asRelativePath(document.uri);
    this.statusBarManager.setScanning(relativeName);
    this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Analyzing file: ${relativeName}`);

    const code = document.getText();
    const ignoreRules = config.get<string[]>('ignoreRules', []);

    try {
      const scanResult = RuleExecutionEngine.analyzeFile(relativeName, code);
      const diagnostics: vscode.Diagnostic[] = [];

      for (const diag of scanResult.diagnostics) {
        if (ignoreRules.includes(diag.ruleId)) {
          continue;
        }

        const lineNum = Math.max(0, (diag.location?.start?.line || 1) - 1);
        const lineText = document.lineAt(Math.min(lineNum, document.lineCount - 1)).text;
        const range = new vscode.Range(
          lineNum,
          0,
          lineNum,
          Math.max(1, lineText.length)
        );

        const severity = diag.severity === 'HIGH'
          ? vscode.DiagnosticSeverity.Error
          : diag.severity === 'MEDIUM'
          ? vscode.DiagnosticSeverity.Warning
          : vscode.DiagnosticSeverity.Information;

        const vsDiagnostic = new vscode.Diagnostic(
          range,
          `[${diag.ruleId}] ${diag.ruleName}: ${diag.message}`,
          severity
        );
        vsDiagnostic.source = 'FIGM Code Inspector';
        vsDiagnostic.code = diag.ruleId;

        diagnostics.push(vsDiagnostic);
      }

      const qualityScore = Math.max(0, 100 - diagnostics.reduce((acc, d) => acc + (d.severity === vscode.DiagnosticSeverity.Error ? 10 : 5), 0));

      this.diagnosticCollection.set(document.uri, diagnostics);
      this.statusBarManager.updateStatus(qualityScore, diagnostics.length);
      this.outputChannel.appendLine(
        `[${new Date().toLocaleTimeString()}] Completed ${relativeName}: Score ${qualityScore}%, ${diagnostics.length} issues found.`
      );

      return { scanResult, qualityScore };
    } catch (err: any) {
      this.outputChannel.appendLine(`[ERROR] Static inspection failed on ${relativeName}: ${err.message}`);
      return undefined;
    }
  }

  public clear(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri);
  }
}
