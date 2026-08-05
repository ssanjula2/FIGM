"use strict";
/**
 * Framework-Independent Guideline Model (FIGM)
 * ALP (Abstract Language Primitive) Extraction Engine
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALPExtractionEngine = void 0;
const four_layer_meta_model_js_1 = require("../matrix/four-layer-meta-model.js");
const universal_ast_mapper_js_1 = require("../ast/universal-ast-mapper.js");
class ALPExtractionEngine {
    /**
     * Scan an ASTNode tree and extract all generic FIGM ALP Primitive Nodes
     */
    static extractPrimitives(astRoot, framework) {
        const primitives = [];
        this.traverseAndExtract(astRoot, framework, primitives);
        return primitives;
    }
    static traverseAndExtract(node, framework, accumulator) {
        const normalized = universal_ast_mapper_js_1.UniversalASTMapper.normalizeNode(node, framework);
        // Match against each of the 8 Core ALPs
        for (const alp of four_layer_meta_model_js_1.CORE_ALPS) {
            if (this.matchesALP(normalized, alp.id)) {
                accumulator.push({
                    primitiveId: alp.id,
                    primitiveName: alp.name,
                    normalizedASTNode: normalized,
                    framework,
                    extractedAttributes: { ...(normalized.attributes || {}) }
                });
            }
        }
        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                this.traverseAndExtract(child, framework, accumulator);
            }
        }
    }
    static matchesALP(node, alpId) {
        const attrs = node.attributes || {};
        switch (alpId) {
            case 'ALP-LOOP-ALLOC':
                return node.type === 'ObjectExpression' && attrs.isInvariant === true;
            case 'ALP-LAYOUT-ELEMENT':
                return ['img', 'video', 'iframe', 'embed'].includes(node.name || '');
            case 'ALP-ASYNC-DISPOSAL':
                return node.type === 'CallExpression' && (node.name === 'addEventListener' || attrs.method === 'addEventListener');
            case 'ALP-STATIC-IMPORT':
                return node.type === 'ImportDeclaration';
            case 'ALP-EVENT-KEYBOARD':
                return ['div', 'span', 'section', 'article', 'p'].includes(node.name || '') && attrs.onClick !== undefined;
            case 'ALP-ARIA-NAMING':
                return attrs.isCustomControl === true || (node.name !== undefined && /^[A-Z]/.test(node.name));
            case 'ALP-LIVE-REGION':
                return attrs.isDynamicMutation === true;
            case 'ALP-FOCUS-TRAVERSAL':
                return attrs.isOverlay === true || ['Modal', 'Dialog', 'Overlay'].includes(node.name || '');
            default:
                return false;
        }
    }
}
exports.ALPExtractionEngine = ALPExtractionEngine;
//# sourceMappingURL=alp-extractor.js.map