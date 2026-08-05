import * as vscode from 'vscode';
import { FIGMDiagnosticsManager } from './diagnostics-provider';
import { FIGMHoverProvider } from './hover-provider';
import { FIGMQuickFixProvider } from './quickfix-provider';
import { FIGMStatusBarManager } from './status-bar';
import { registerFIGMCommands } from './commands';

let debounceTimer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('FIGM Code Inspector');
  outputChannel.appendLine('====================================================');
  outputChannel.appendLine('FIGM Code Inspector VS Code Extension Activated');
  outputChannel.appendLine('====================================================');

  const diagnosticCollection = vscode.languages.createDiagnosticCollection('figm');
  const statusBarManager = new FIGMStatusBarManager();
  const diagnosticsManager = new FIGMDiagnosticsManager(
    diagnosticCollection,
    outputChannel,
    statusBarManager
  );

  // Register Hover Provider for JS/TS/JSX/TSX/Vue
  const hoverProvider = vscode.languages.registerHoverProvider(
    [
      { scheme: 'file', language: 'javascript' },
      { scheme: 'file', language: 'javascriptreact' },
      { scheme: 'file', language: 'typescript' },
      { scheme: 'file', language: 'typescriptreact' },
      { scheme: 'file', language: 'vue' },
    ],
    new FIGMHoverProvider()
  );

  // Register Quick-Fix Code Actions Provider
  const quickFixProvider = vscode.languages.registerCodeActionsProvider(
    [
      { scheme: 'file', language: 'javascript' },
      { scheme: 'file', language: 'javascriptreact' },
      { scheme: 'file', language: 'typescript' },
      { scheme: 'file', language: 'typescriptreact' },
      { scheme: 'file', language: 'vue' },
    ],
    new FIGMQuickFixProvider() as any
  );

  // Register Extension Commands
  registerFIGMCommands(context, diagnosticsManager, outputChannel);

  // Trigger analysis on active editor change
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor | undefined) => {
      if (editor) {
        diagnosticsManager.analyzeDocument(editor.document);
      }
    })
  );

  // Trigger analysis on document save (if figm.scanOnSave enabled)
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
      const config = vscode.workspace.getConfiguration('figm');
      if (config.get<boolean>('scanOnSave', true)) {
        diagnosticsManager.analyzeDocument(document);
      }
    })
  );

  // Trigger real-time analysis on document edit (300ms debounced)
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
      const config = vscode.workspace.getConfiguration('figm');
      if (config.get<boolean>('scanOnType', true)) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          diagnosticsManager.analyzeDocument(event.document);
        }, 300);
      }
    })
  );

  // Close diagnostics on document close
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document: vscode.TextDocument) => {
      diagnosticsManager.clear(document.uri);
    })
  );

  // Initial scan if an active editor is present
  if (vscode.window.activeTextEditor) {
    diagnosticsManager.analyzeDocument(vscode.window.activeTextEditor.document);
  }

  context.subscriptions.push(
    outputChannel,
    diagnosticCollection,
    statusBarManager,
    hoverProvider,
    quickFixProvider
  );
}

export function deactivate() {
  if (debounceTimer) clearTimeout(debounceTimer);
}
