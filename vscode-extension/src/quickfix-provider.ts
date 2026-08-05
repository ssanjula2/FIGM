import * as vscode from 'vscode';
import { FIGM_RULES } from './rules-data';

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

    const ruleDef = FIGM_RULES.find(r => r.ruleId === ruleId);
    const label = ruleDef ? `💡 FIGM Quick-Fix: ${ruleDef.remediation}` : `💡 FIGM Quick-Fix for ${ruleId}`;

    const action = new vscode.CodeAction(
      label,
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = [diagnostic];
    action.isPreferred = true;

    const lineText = document.lineAt(diagnostic.range.start.line).text;
    const commentFix = `// FIGM Remediation: ${ruleDef?.remediation || 'Optimized'}\n` + lineText;

    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, diagnostic.range, commentFix);
    action.edit = edit;

    return action;
  }
}
