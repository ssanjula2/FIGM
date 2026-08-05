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
const rules_data_1 = require("./rules-data");
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
        const text = document.getText();
        const ignoreRules = config.get('ignoreRules', []);
        const diagnostics = [];
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
        this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Completed ${relativeName}: Score ${qualityScore}%, ${diagnostics.length} issues found.`);
        return { totalIssues: diagnostics.length, qualityScore };
    }
    addDiag(diagnostics, lineNum, lineText, ruleId, ignoreRules) {
        if (ignoreRules.includes(ruleId))
            return;
        const ruleDef = rules_data_1.FIGM_RULES.find(r => r.ruleId === ruleId);
        if (!ruleDef)
            return;
        const range = new vscode.Range(lineNum, 0, lineNum, Math.max(1, lineText.length));
        const severity = ruleDef.severity === 'CRITICAL' || ruleDef.severity === 'HIGH'
            ? vscode.DiagnosticSeverity.Error
            : vscode.DiagnosticSeverity.Warning;
        const vsDiagnostic = new vscode.Diagnostic(range, `[${ruleDef.ruleId}] ${ruleDef.ruleName}: ${ruleDef.description}`, severity);
        vsDiagnostic.source = 'FIGM Code Inspector';
        vsDiagnostic.code = ruleDef.ruleId;
        diagnostics.push(vsDiagnostic);
    }
    clear(uri) {
        this.diagnosticCollection.delete(uri);
    }
}
exports.FIGMDiagnosticsManager = FIGMDiagnosticsManager;
//# sourceMappingURL=diagnostics-provider.js.map