"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = __importDefault(require("node:http"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const reportPath = node_path_1.default.resolve(process.cwd(), 'figm-scan-report.html');
// Run scan first if report does not exist yet
if (!node_fs_1.default.existsSync(reportPath)) {
    console.log('[FIGM UI] No report found. Running initial scan on samples/sample-spa...');
    try {
        (0, node_child_process_1.execSync)('npx tsx src/cli/figm-analyze.ts samples/sample-spa', { stdio: 'inherit' });
    }
    catch (err) {
        console.error('[FIGM UI] Failed to run initial scan:', err);
    }
}
const server = node_http_1.default.createServer((req, res) => {
    if (req.url === '/json') {
        const jsonPath = node_path_1.default.resolve(process.cwd(), 'figm-scan-report.json');
        if (node_fs_1.default.existsSync(jsonPath)) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(node_fs_1.default.readFileSync(jsonPath, 'utf-8'));
            return;
        }
    }
    if (node_fs_1.default.existsSync(reportPath)) {
        const html = node_fs_1.default.readFileSync(reportPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
    }
    else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('FIGM Report not found. Run "npm run analyze" first.');
    }
});
server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` FIGM UI Dashboard Server active at: http://localhost:${PORT}`);
    console.log(`=======================================================`);
});
//# sourceMappingURL=serve.js.map