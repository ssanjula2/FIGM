import * as vscode from 'vscode';

export class FIGMStatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'figm.openOutputChannel';
    this.statusBarItem.text = '$(shield) FIGM: Ready';
    this.statusBarItem.tooltip = 'Click to open FIGM Inspection Output Logs';
    this.statusBarItem.show();
  }

  public updateStatus(score: number, violationCount: number): void {
    const icon = score >= 90 ? '$(shield-check)' : score >= 75 ? '$(warning)' : '$(error)';
    this.statusBarItem.text = `${icon} FIGM: ${score}% (${violationCount} issues)`;
    this.statusBarItem.tooltip = `FIGM Code Inspector — Quality Score: ${score}%, Issues: ${violationCount}`;
    this.statusBarItem.show();
  }

  public setScanning(fileName: string): void {
    this.statusBarItem.text = `$(sync~spin) FIGM: Scanning ${fileName}...`;
    this.statusBarItem.show();
  }

  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
