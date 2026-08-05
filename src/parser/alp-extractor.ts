/**
 * Framework-Independent Guideline Model (FIGM)
 * ALP (Abstract Language Primitive) Extraction Engine
 */

import { ASTNode, FrameworkType } from '../types/ast-spec.js';
import { CORE_ALPS } from '../matrix/four-layer-meta-model.js';
import { UniversalASTMapper } from '../ast/universal-ast-mapper.js';

export interface ALPPrimitiveNode {
  primitiveId: string;
  primitiveName: string;
  normalizedASTNode: ASTNode;
  framework: FrameworkType;
  extractedAttributes: Record<string, unknown>;
}

export class ALPExtractionEngine {
  /**
   * Scan an ASTNode tree and extract all generic FIGM ALP Primitive Nodes
   */
  public static extractPrimitives(
    astRoot: ASTNode,
    framework: FrameworkType
  ): ALPPrimitiveNode[] {
    const primitives: ALPPrimitiveNode[] = [];
    this.traverseAndExtract(astRoot, framework, primitives);
    return primitives;
  }

  private static traverseAndExtract(
    node: ASTNode,
    framework: FrameworkType,
    accumulator: ALPPrimitiveNode[]
  ) {
    const normalized = UniversalASTMapper.normalizeNode(node, framework);

    // Match against each of the 8 Core ALPs
    for (const alp of CORE_ALPS) {
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

  private static matchesALP(node: ASTNode, alpId: string): boolean {
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
