#!/usr/bin/env node
"use strict";
/**
 * Framework-Independent Guideline Model (FIGM)
 * CLI Entry Point (src/cli/index.ts)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCLIArgs = exports.runCLI = void 0;
var figm_analyze_js_1 = require("./figm-analyze.js");
Object.defineProperty(exports, "runCLI", { enumerable: true, get: function () { return figm_analyze_js_1.runCLI; } });
Object.defineProperty(exports, "parseCLIArgs", { enumerable: true, get: function () { return figm_analyze_js_1.parseCLIArgs; } });
const figm_analyze_js_2 = require("./figm-analyze.js");
// Auto-execute if invoked directly from terminal
if (process.argv[1] && (process.argv[1].includes('figm-analyze') || process.argv[1].includes('index'))) {
    const exitCode = (0, figm_analyze_js_2.runCLI)(process.argv.slice(2));
    if (exitCode !== 0 && process.env.NODE_ENV !== 'test') {
        process.exit(exitCode);
    }
}
//# sourceMappingURL=index.js.map