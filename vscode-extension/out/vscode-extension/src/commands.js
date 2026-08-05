"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFIGMCommands = registerFIGMCommands;
const vscode = __importStar(require("vscode"));
function registerFIGMCommands(context, diagnosticsManager, outputChannel) {
    // Command: Scan Current File
    const scanCurrentCmd = vscode.commands.registerCommand('figm.scanCurrentFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const res = await diagnosticsManager.analyzeDocument(editor.document);
            if (res) {
                vscode.window.showInformationMessage(`FIGM Inspection: Quality Score ${res.qualityScore}% (${res.scanResult.diagnostics.length} issues found).`);
            }
        }
        else {
            vscode.window.showWarningMessage('No active editor found to scan.');
        }
    });
    // Command: Scan Entire Workspace
    const scanWorkspaceCmd = vscode.commands.registerCommand('figm.scanWorkspace', async () => {
        outputChannel.appendLine('[WORKSPACE] Starting full workspace scan...');
        const files = await vscode.workspace.findFiles('**/*.{jsx,tsx,vue,ts}', '**/node_modules/**');
        let totalScanned = 0;
        let totalIssues = 0;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'FIGM: Scanning Workspace...',
            cancellable: true,
        }, async (progress, token) => {
            const increment = 100 / Math.max(1, files.length);
            for (const file of files) {
                if (token.isCancellationRequested)
                    break;
                const doc = await vscode.workspace.openTextDocument(file);
                const res = await diagnosticsManager.analyzeDocument(doc);
                if (res) {
                    totalScanned++;
                    totalIssues += res.scanResult.diagnostics.length;
                }
                progress.report({ increment, message: vscode.workspace.asRelativePath(file) });
            }
        });
        vscode.window.showInformationMessage(`FIGM Workspace Scan Complete: Scanned ${totalScanned} files, found ${totalIssues} total violations.`);
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
//# sourceMappingURL=commands.js.map