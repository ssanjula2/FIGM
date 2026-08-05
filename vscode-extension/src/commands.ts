import * as vscode from 'vscode';
import { FIGMDiagnosticsManager } from './diagnostics-provider';

export function registerFIGMCommands(
  context: vscode.ExtensionContext,
  diagnosticsManager: FIGMDiagnosticsManager,
  outputChannel: vscode.OutputChannel
): void {
  // Command: Scan Current File
  const scanCurrentCmd = vscode.commands.registerCommand('figm.scanCurrentFile', async () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const res = await diagnosticsManager.analyzeDocument(editor.document);
      if (res) {
        vscode.window.showInformationMessage(
          `FIGM Inspection: Quality Score ${res.qualityScore}% (${res.scanResult.diagnostics.length} issues found).`
        );
      }
    } else {
      vscode.window.showWarningMessage('No active editor found to scan.');
    }
  });

  // Command: Scan Entire Workspace
  const scanWorkspaceCmd = vscode.commands.registerCommand('figm.scanWorkspace', async () => {
    outputChannel.appendLine('[WORKSPACE] Starting full workspace scan...');
    const files = await vscode.workspace.findFiles('**/*.{jsx,tsx,vue,ts}', '**/node_modules/**');

    let totalScanned = 0;
    let totalIssues = 0;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'FIGM: Scanning Workspace...',
        cancellable: true,
      },
      async (progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken) => {
        const increment = 100 / Math.max(1, files.length);
        for (const file of files) {
          if (token.isCancellationRequested) break;
          const doc = await vscode.workspace.openTextDocument(file);
          const res = await diagnosticsManager.analyzeDocument(doc);
          if (res) {
            totalScanned++;
            totalIssues += res.scanResult.diagnostics.length;
          }
          progress.report({ increment, message: vscode.workspace.asRelativePath(file) });
        }
      }
    );

    vscode.window.showInformationMessage(
      `FIGM Workspace Scan Complete: Scanned ${totalScanned} files, found ${totalIssues} total violations.`
    );
  });

  // Command: Apply Auto-Fixes to File
  const fixAllCmd = vscode.commands.registerCommand('figm.fixAll', async () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      vscode.commands.executeCommand('editor.action.quickFix');
      vscode.window.showInformationMessage('FIGM: Triggered quick-fix Code Actions menu.');
    }
  });

  // Command: Show Output Logs
  const showOutputCmd = vscode.commands.registerCommand('figm.openOutputChannel', () => {
    outputChannel.show();
  });

  context.subscriptions.push(scanCurrentCmd, scanWorkspaceCmd, fixAllCmd, showOutputCmd);
}
