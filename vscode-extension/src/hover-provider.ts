import * as vscode from 'vscode';
import { FIGM_RULES } from './rules-data';

export class FIGMHoverProvider implements vscode.HoverProvider {
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const range = document.getWordRangeAtPosition(position);
    const lineText = document.lineAt(position.line).text;

    for (const rule of FIGM_RULES) {
      if (lineText.includes(rule.ruleId) || lineText.includes(rule.ruleName)) {
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;

        markdown.appendMarkdown(`### 🛡️ **[${rule.ruleId}] ${rule.ruleName}**\n\n`);
        markdown.appendMarkdown(`**Domain**: \`${rule.domain}\` | **Severity**: \`${rule.severity}\`\n\n`);
        markdown.appendMarkdown(`**Concern**: \`${rule.concern}\`\n\n`);
        markdown.appendMarkdown(`**Description**: ${rule.description}\n\n`);
        markdown.appendMarkdown(`---\n\n`);
        markdown.appendMarkdown(`**Remediation Guidance**:\n${rule.remediation}\n\n`);
        // Honest scope label (research-collection-build hardening, EXT-01): this extension is a
        // lightweight, client-side line-heuristic preview covering 5 of FIGM's 50 canonical
        // rules -- it does not run the real AST-based RuleExecutionEngine. Never claim otherwise
        // in user-facing text; see README.md's "Scope" section for the exact supported rule IDs.
        markdown.appendMarkdown(`---\n*FIGM Code Inspector — Lightweight Preview (see README for supported scope)*`);

        return new vscode.Hover(markdown, range);
      }
    }

    return null;
  }
}
