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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const diagnostics_provider_1 = require("./diagnostics-provider");
const hover_provider_1 = require("./hover-provider");
const quickfix_provider_1 = require("./quickfix-provider");
const status_bar_1 = require("./status-bar");
const commands_1 = require("./commands");
let debounceTimer;
function activate(context) {
    const outputChannel = vscode.window.createOutputChannel('FIGM Code Inspector');
    outputChannel.appendLine('====================================================');
    outputChannel.appendLine('FIGM Code Inspector VS Code Extension Activated');
    outputChannel.appendLine('====================================================');
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('figm');
    const statusBarManager = new status_bar_1.FIGMStatusBarManager();
    const diagnosticsManager = new diagnostics_provider_1.FIGMDiagnosticsManager(diagnosticCollection, outputChannel, statusBarManager);
    // Register Hover Provider for JS/TS/JSX/TSX/Vue
    const hoverProvider = vscode.languages.registerHoverProvider([
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'javascriptreact' },
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'typescriptreact' },
        { scheme: 'file', language: 'vue' },
    ], new hover_provider_1.FIGMHoverProvider());
    // Register Quick-Fix Code Actions Provider
    const quickFixProvider = vscode.languages.registerCodeActionsProvider([
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'javascriptreact' },
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'typescriptreact' },
        { scheme: 'file', language: 'vue' },
    ], new quickfix_provider_1.FIGMQuickFixProvider());
    // Register Extension Commands
    (0, commands_1.registerFIGMCommands)(context, diagnosticsManager, outputChannel);
    // Trigger analysis on active editor change
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            diagnosticsManager.analyzeDocument(editor.document);
        }
    }));
    // Trigger analysis on document save (if figm.scanOnSave enabled)
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
        const config = vscode.workspace.getConfiguration('figm');
        if (config.get('scanOnSave', true)) {
            diagnosticsManager.analyzeDocument(document);
        }
    }));
    // Trigger real-time analysis on document edit (300ms debounced)
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => {
        const config = vscode.workspace.getConfiguration('figm');
        if (config.get('scanOnType', true)) {
            if (debounceTimer)
                clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                diagnosticsManager.analyzeDocument(event.document);
            }, 300);
        }
    }));
    // Close diagnostics on document close
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((document) => {
        diagnosticsManager.clear(document.uri);
    }));
    // Initial scan if an active editor is present
    if (vscode.window.activeTextEditor) {
        diagnosticsManager.analyzeDocument(vscode.window.activeTextEditor.document);
    }
    context.subscriptions.push(outputChannel, diagnosticCollection, statusBarManager, hoverProvider, quickFixProvider);
}
function deactivate() {
    if (debounceTimer)
        clearTimeout(debounceTimer);
}
//# sourceMappingURL=extension.js.map