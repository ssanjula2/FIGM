import * as vscode from 'vscode';
import { FIGM_RULES } from './rules-data';
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

  public async analyzeDocument(document: vscode.TextDocument): Promise<{ totalIssues: number; qualityScore: number } | undefined> {
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

    const text = document.getText();
    const ignoreRules = config.get<string[]>('ignoreRules', []);
    const diagnostics: vscode.Diagnostic[] = [];

    // AST rule pattern detection heuristics
    const lines = text.split('\n');
    lines.forEach((lineText, index) => {
      // Check for inline map allocations
      if (lineText.includes('.map(') && (lineText.includes('{') || lineText.includes('=>'))) {
        if (lineText.includes('key={index}') || lineText.includes('key={idx}')) {
          this.addDiag(diagnostics, index, lineText, 'FIGM-REACT-02', ignoreRules);
        }
        if (!lineText.includes('useCallback') && lineText.includes('onClick=')) {
          this.addDiag(diagnostics, index, lineText, 'FIGM-PERF-05', ignoreRules);
        }
      }
      // Check for un-dimensioned img tags
      if ((lineText.includes('<img') || lineText.includes('<Image')) && !lineText.includes('width=') && !lineText.includes('aspectRatio')) {
        this.addDiag(diagnostics, index, lineText, 'FIGM-PERF-02', ignoreRules);
      }
      // Check for onClick without keyboard events
      if (lineText.includes('onClick=') && lineText.includes('<div') && !lineText.includes('onKeyDown')) {
        this.addDiag(diagnostics, index, lineText, 'FIGM-A11Y-01', ignoreRules);
      }
      // Check for static imports in deferred paths
      if (lineText.startsWith('import ') && lineText.includes('from ') && (text.includes('if (') || text.includes('switch'))) {
        this.addDiag(diagnostics, index, lineText, 'FIGM-PERF-04', ignoreRules);
      }
    });

    const qualityScore = Math.max(0, 100 - diagnostics.length * 5);
    this.diagnosticCollection.set(document.uri, diagnostics);
    this.statusBarManager.updateStatus(qualityScore, diagnostics.length);

    this.outputChannel.appendLine(
      `[${new Date().toLocaleTimeString()}] Completed ${relativeName}: Score ${qualityScore}%, ${diagnostics.length} issues found.`
    );

    return { totalIssues: diagnostics.length, qualityScore };
  }

  private addDiag(diagnostics: vscode.Diagnostic[], lineNum: number, lineText: string, ruleId: string, ignoreRules: string[]): void {
    if (ignoreRules.includes(ruleId)) return;
    const ruleDef = FIGM_RULES.find(r => r.ruleId === ruleId);
    if (!ruleDef) return;

    const range = new vscode.Range(lineNum, 0, lineNum, Math.max(1, lineText.length));
    const severity = ruleDef.severity === 'CRITICAL' || ruleDef.severity === 'HIGH'
      ? vscode.DiagnosticSeverity.Error
      : vscode.DiagnosticSeverity.Warning;

    const vsDiagnostic = new vscode.Diagnostic(
      range,
      `[${ruleDef.ruleId}] ${ruleDef.ruleName}: ${ruleDef.description}`,
      severity
    );
    vsDiagnostic.source = 'FIGM Code Inspector';
    vsDiagnostic.code = ruleDef.ruleId;

    diagnostics.push(vsDiagnostic);
  }

  public clear(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri);
  }
}
