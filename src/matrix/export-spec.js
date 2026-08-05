"use strict";
/**
 * Script to generate figm-spec.json from the Four-Layer Architecture Meta-Model
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_url_1 = require("node:url");
const four_layer_meta_model_js_1 = require("./four-layer-meta-model.js");
const __filename = (0, node_url_1.fileURLToPath)(import.meta.url);
const __dirname = node_path_1.default.dirname(__filename);
const spec = (0, four_layer_meta_model_js_1.generateMasterSpecification)();
const outputPath = node_path_1.default.resolve(__dirname, '../../figm-spec.json');
node_fs_1.default.writeFileSync(outputPath, JSON.stringify(spec, null, 2), 'utf-8');
console.log(`[FIGM] Master Specification exported successfully to: ${outputPath}`);
console.log(`[FIGM] Total Core Rules in Matrix: ${spec.rules.length}`);
//# sourceMappingURL=export-spec.js.map