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
exports.FIGMQuickFixProvider = void 0;
const vscode = __importStar(require("vscode"));
const rules_data_1 = require("./rules-data");
class FIGMQuickFixProvider {
    static providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
    ];
    provideCodeActions(document, _range, context, _token) {
        const actions = [];
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
    createQuickFix(document, diagnostic) {
        const ruleIdMatch = diagnostic.message.match(/\[(FIGM-[A-Z0-9-]+)\]/);
        const ruleId = ruleIdMatch ? ruleIdMatch[1] : 'FIGM-PERF-01';
        const ruleDef = rules_data_1.FIGM_RULES.find(r => r.ruleId === ruleId);
        const label = ruleDef ? `💡 FIGM Quick-Fix: ${ruleDef.remediation}` : `💡 FIGM Quick-Fix for ${ruleId}`;
        const action = new vscode.CodeAction(label, vscode.CodeActionKind.QuickFix);
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
exports.FIGMQuickFixProvider = FIGMQuickFixProvider;
//# sourceMappingURL=quickfix-provider.js.map