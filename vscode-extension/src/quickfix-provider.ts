import * as vscode from 'vscode';
import { RemediationEngine } from '../../src/engine/remediation-engine';

export class FIGMQuickFixProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  public provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source === 'FIGM Code Inspector') {
        const action = this.createQuickFix(document, diagnostic);
        if (action) {
          actions.push(action);
        }
      }
    }

    return actions;
  }

  private createQuickFix(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction | undefined {
    const ruleIdMatch = diagnostic.message.match(/\[(FIGM-[A-Z0-9-]+)\]/);
    const ruleId = ruleIdMatch ? ruleIdMatch[1] : 'FIGM-PERF-01';

    const action = new vscode.CodeAction(
      `💡 FIGM: Apply Quick-Fix for ${ruleId}`,
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = [diagnostic];
    action.isPreferred = true;

    const lineText = document.lineAt(diagnostic.range.start.line).text;

    try {
      const remediation = RemediationEngine.applyQuickFix(lineText, {
        ruleId,
        offendingCodeSnippet: lineText,
      } as any);

      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, diagnostic.range, remediation.remediatedCode);
      action.edit = edit;

      return action;
    } catch {
      return undefined;
    }
  }
}
