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
exports.FIGMDiagnosticsManager = void 0;
const vscode = __importStar(require("vscode"));
const rule_execution_engine_1 = require("../../src/engine/rule-execution-engine");
class FIGMDiagnosticsManager {
    diagnosticCollection;
    outputChannel;
    statusBarManager;
    constructor(diagnosticCollection, outputChannel, statusBarManager) {
        this.diagnosticCollection = diagnosticCollection;
        this.outputChannel = outputChannel;
        this.statusBarManager = statusBarManager;
    }
    async analyzeDocument(document) {
        const config = vscode.workspace.getConfiguration('figm');
        if (!config.get('enable', true)) {
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
        const ignoreRules = config.get('ignoreRules', []);
        try {
            const scanResult = rule_execution_engine_1.RuleExecutionEngine.analyzeFile(relativeName, code);
            const diagnostics = [];
            for (const diag of scanResult.diagnostics) {
                if (ignoreRules.includes(diag.ruleId)) {
                    continue;
                }
                const lineNum = Math.max(0, (diag.line || 1) - 1);
                const lineText = document.lineAt(Math.min(lineNum, document.lineCount - 1)).text;
                const range = new vscode.Range(lineNum, 0, lineNum, Math.max(1, lineText.length));
                const severity = diag.severity === 'HIGH'
                    ? vscode.DiagnosticSeverity.Error
                    : diag.severity === 'MEDIUM'
                        ? vscode.DiagnosticSeverity.Warning
                        : vscode.DiagnosticSeverity.Information;
                const vsDiagnostic = new vscode.Diagnostic(range, `[${diag.ruleId}] ${diag.ruleName}: ${diag.message}`, severity);
                vsDiagnostic.source = 'FIGM Code Inspector';
                vsDiagnostic.code = diag.ruleId;
                diagnostics.push(vsDiagnostic);
            }
            this.diagnosticCollection.set(document.uri, diagnostics);
            this.statusBarManager.updateStatus(scanResult.qualityScore, diagnostics.length);
            this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Completed ${relativeName}: Score ${scanResult.qualityScore}%, ${diagnostics.length} issues found.`);
            return scanResult;
        }
        catch (err) {
            this.outputChannel.appendLine(`[ERROR] Static inspection failed on ${relativeName}: ${err.message}`);
            return undefined;
        }
    }
    clear(uri) {
        this.diagnosticCollection.delete(uri);
    }
}
exports.FIGMDiagnosticsManager = FIGMDiagnosticsManager;
//# sourceMappingURL=diagnostics-provider.js.map