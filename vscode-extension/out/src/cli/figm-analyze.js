#!/usr/bin/env node
"use strict";
/**
 * Framework-Independent Guideline Model (FIGM)
 * Production CLI Static Analyzer Entry Point
 *
 * Supports:
 * - `--path <dir>`: Target directory to scan
 * - `--framework <react|vue|angular|auto>`: Framework override or auto-detection
 * - `--format <json|html|console|both>`: Report output format
 * - `--threshold <number>`: Minimum quality score required to pass CI
 * - `--ignore <pattern>`: Directory/file ignore list (comma separated)
 * - `--out <filename>`: Output report base filename
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCLIArgs = parseCLIArgs;
exports.runCLI = runCLI;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const rule_execution_engine_js_1 = require("../engine/rule-execution-engine.js");
const report_generator_js_1 = require("../reporter/report-generator.js");
function parseCLIArgs(args) {
    const pathVal = getArgValue(args, '--path');
    const positionalPath = args.find((a) => !a.startsWith('--') && a !== pathVal);
    const targetDir = pathVal || positionalPath || '.';
    const framework = (getArgValue(args, '--framework') || 'auto').toLowerCase();
    const format = (getArgValue(args, '--format') || 'both').toLowerCase();
    const thresholdStr = getArgValue(args, '--threshold');
    const threshold = thresholdStr ? parseInt(thresholdStr, 10) : null;
    const ignoreStr = getArgValue(args, '--ignore');
    const ignorePatterns = ignoreStr
        ? ignoreStr.split(',').map((s) => s.trim())
        : ['node_modules', 'dist', '.git', 'build', '.next', 'coverage'];
    const out = getArgValue(args, '--out') || 'figm-scan-report';
    return {
        targetDir,
        framework,
        format,
        threshold,
        ignorePatterns,
        out,
    };
}
function runCLI(args) {
    const options = parseCLIArgs(args);
    const resolvedDir = node_path_1.default.resolve(process.cwd(), options.targetDir);
    if (!node_fs_1.default.existsSync(resolvedDir)) {
        console.error(`[FIGM CLI Error] Target directory does not exist: ${resolvedDir}`);
        return 1;
    }
    console.log(`=======================================================`);
    console.log(` FIGM Static Analysis Scanner v2.0`);
    console.log(` Target Path: ${resolvedDir}`);
    console.log(` Framework Target: ${options.framework.toUpperCase()}`);
    console.log(` Report Format: ${options.format.toUpperCase()}`);
    if (options.threshold !== null) {
        console.log(` Quality Threshold: ${options.threshold}/100`);
    }
    console.log(`=======================================================\n`);
    const filePaths = [];
    collectFiles(resolvedDir, filePaths, options.ignorePatterns);
    if (filePaths.length === 0) {
        console.log(`No supported source files (.js, .ts, .jsx, .tsx, .vue, .svelte) found.`);
        return 0;
    }
    const results = [];
    for (const file of filePaths) {
        const relativePath = node_path_1.default.relative(resolvedDir, file);
        try {
            const code = node_fs_1.default.readFileSync(file, 'utf-8');
            const scanRes = rule_execution_engine_js_1.RuleExecutionEngine.analyzeFile(relativePath, code);
            // Override framework if explicitly set (unless set to auto)
            if (options.framework !== 'auto') {
                scanRes.framework = options.framework.toUpperCase();
            }
            results.push(scanRes);
            console.log(`  [SCAN] ${relativePath} (${scanRes.framework}) -> ${scanRes.diagnostics.length} defects, ${scanRes.extractedALPsCount} ALPs`);
        }
        catch (err) {
            console.warn(`  [WARN] Failed to read ${relativePath}:`, err);
        }
    }
    const aggregateReport = report_generator_js_1.ReportGenerator.createAggregateReport(results);
    const { summary } = aggregateReport;
    // Quality Score Formula
    const penalty = summary.criticalCount * 15 + summary.highCount * 8 + summary.mediumCount * 3 + summary.lowCount * 1;
    const qualityScore = Math.max(0, 100 - penalty);
    console.log(`\n-------------------------------------------------------`);
    console.log(` SCAN SUMMARY`);
    console.log(` Scanned Files: ${summary.scannedFiles}`);
    console.log(` Quality Score: ${qualityScore}/100`);
    console.log(` Total Defects: ${summary.totalDiagnostics} (Critical: ${summary.criticalCount}, High: ${summary.highCount}, Medium: ${summary.mediumCount}, Low: ${summary.lowCount})`);
    console.log(` Total ALPs Extracted: ${summary.totalPrimitivesExtracted}`);
    console.log(`-------------------------------------------------------\n`);
    // Report Exporting
    if (options.format === 'json' || options.format === 'both') {
        const jsonPath = node_path_1.default.resolve(process.cwd(), `${options.out}.json`);
        node_fs_1.default.writeFileSync(jsonPath, report_generator_js_1.ReportGenerator.generateJSON(aggregateReport), 'utf-8');
        console.log(`[FIGM CLI] Exported JSON report to: ${jsonPath}`);
    }
    if (options.format === 'html' || options.format === 'both') {
        const htmlPath = node_path_1.default.resolve(process.cwd(), `${options.out}.html`);
        node_fs_1.default.writeFileSync(htmlPath, report_generator_js_1.ReportGenerator.generateHTML(aggregateReport), 'utf-8');
        console.log(`[FIGM CLI] Exported HTML report to: ${htmlPath}`);
    }
    // Threshold Enforcement for CI/CD
    if (options.threshold !== null) {
        if (qualityScore < options.threshold) {
            console.error(`\n❌ [CI FAILURE] Quality Score (${qualityScore}) is below threshold (${options.threshold}). Exiting with status 1.`);
            return 1;
        }
        else {
            console.log(`\n✅ [CI SUCCESS] Quality Score (${qualityScore}) satisfies threshold (${options.threshold}).`);
        }
    }
    console.log(`\nScan complete.`);
    return 0;
}
function collectFiles(dir, fileList, ignorePatterns) {
    const items = node_fs_1.default.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        if (item.isDirectory()) {
            if (!ignorePatterns.includes(item.name)) {
                collectFiles(node_path_1.default.join(dir, item.name), fileList, ignorePatterns);
            }
        }
        else if (item.isFile()) {
            const ext = node_path_1.default.extname(item.name).toLowerCase();
            if (['.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte'].includes(ext)) {
                fileList.push(node_path_1.default.join(dir, item.name));
            }
        }
    }
}
function getArgValue(args, flag) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) {
        return args[idx + 1];
    }
    return null;
}
// Direct Execution Entry Point
if (process.argv[1] && (process.argv[1].includes('figm-analyze') || process.argv[1].includes('figm-model'))) {
    const exitCode = runCLI(process.argv.slice(2));
    if (exitCode !== 0 && process.env.NODE_ENV !== 'test') {
        process.exit(exitCode);
    }
}
//# sourceMappingURL=figm-analyze.js.map