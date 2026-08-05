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
exports.FIGMHoverProvider = void 0;
const vscode = __importStar(require("vscode"));
const four_layer_meta_model_1 = require("../../src/matrix/four-layer-meta-model");
class FIGMHoverProvider {
    provideHover(document, position, _token) {
        const range = document.getWordRangeAtPosition(position);
        const lineText = document.lineAt(position.line).text;
        // Match any FIGM diagnostic comments or AST nodes
        const allRules = four_layer_meta_model_1.FourLayerMetaModel.getAllGuidelines();
        for (const rule of allRules) {
            if (lineText.includes(rule.ruleId) || lineText.includes(rule.ruleName)) {
                const markdown = new vscode.MarkdownString();
                markdown.isTrusted = true;
                markdown.supportHtml = true;
                markdown.appendMarkdown(`### 🛡️ **[${rule.ruleId}] ${rule.ruleName}**\n\n`);
                markdown.appendMarkdown(`**Domain**: \`${rule.domain}\` | **Severity**: \`${rule.severity}\`\n\n`);
                markdown.appendMarkdown(`**ISO/IEC 25010 Standard**: \`${rule.isoStandard}\`\n\n`);
                markdown.appendMarkdown(`**WCAG 2.2 Standard**: \`${rule.wcagStandard}\`\n\n`);
                markdown.appendMarkdown(`---\n\n`);
                markdown.appendMarkdown(`**Remediation Guidance**:\n${rule.remediationTemplate}\n\n`);
                markdown.appendMarkdown(`---\n*Powered by FIGM Code Inspector AST Engine*`);
                return new vscode.Hover(markdown, range);
            }
        }
        return null;
    }
}
exports.FIGMHoverProvider = FIGMHoverProvider;
//# sourceMappingURL=hover-provider.js.map