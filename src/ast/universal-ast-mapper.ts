/**
 * Framework-Independent Guideline Model (FIGM)
 * Universal AST Mapper & Query Selector Engine
 */

import {
  ASTNode,
  FrameworkType,
  FrameworkASTTranslation,
  ASTQueryTemplate
} from '../types/ast-spec.js';

/**
 * Universal AST Translation Mappings across Frameworks
 */
export const FRAMEWORK_TRANSLATIONS: FrameworkASTTranslation[] = [
  // --- React JSX Mappings ---
  {
    framework: 'REACT_JSX',
    nativeNodeType: 'JSXElement',
    targetALPId: 'ALP-EVENT-KEYBOARD',
    attributeMapping: {
      clickListener: 'onClick',
      keyboardListener: 'onKeyDown',
      tabIndex: 'tabIndex'
    },
    elementNameExtractor: 'node.openingElement.name.name',
    listenerExtractor: 'node.openingElement.attributes'
  },
  {
    framework: 'REACT_JSX',
    nativeNodeType: 'JSXElement',
    targetALPId: 'ALP-LAYOUT-ELEMENT',
    attributeMapping: {
      width: 'width',
      height: 'height',
      style: 'style'
    },
    elementNameExtractor: 'node.openingElement.name.name',
    listenerExtractor: 'node.openingElement.attributes'
  },

  // --- Vue SFC Template Mappings ---
  {
    framework: 'VUE_SFC',
    nativeNodeType: 'VElement',
    targetALPId: 'ALP-EVENT-KEYBOARD',
    attributeMapping: {
      clickListener: 'v-on:click',
      keyboardListener: 'v-on:keydown',
      tabIndex: 'tabindex'
    },
    elementNameExtractor: 'node.name',
    listenerExtractor: 'node.directives'
  },
  {
    framework: 'VUE_SFC',
    nativeNodeType: 'VElement',
    targetALPId: 'ALP-LAYOUT-ELEMENT',
    attributeMapping: {
      width: 'width',
      height: 'height',
      style: 'style'
    },
    elementNameExtractor: 'node.name',
    listenerExtractor: 'node.startTag.attributes'
  },

  // --- Angular Component Template Mappings ---
  {
    framework: 'ANGULAR_TEMPLATE',
    nativeNodeType: 'Element$1',
    targetALPId: 'ALP-EVENT-KEYBOARD',
    attributeMapping: {
      clickListener: '(click)',
      keyboardListener: '(keydown)',
      tabIndex: 'tabindex'
    },
    elementNameExtractor: 'node.name',
    listenerExtractor: 'node.outputs'
  },

  // --- Generic ESTree JavaScript Mappings ---
  {
    framework: 'GENERIC_ESTREE',
    nativeNodeType: 'CallExpression',
    targetALPId: 'ALP-ASYNC-DISPOSAL',
    attributeMapping: {
      method: 'callee.property.name'
    },
    elementNameExtractor: 'node.callee.name',
    listenerExtractor: 'node.arguments'
  }
];

/**
 * Universal AST Query Selectors for all 8 ALPs
 */
export const QUERY_TEMPLATES: ASTQueryTemplate[] = [
  {
    alpId: 'ALP-LOOP-ALLOC',
    selectorString: 'CallExpression[callee.property.name="map|forEach|reduce|filter"] > ArrowFunctionExpression ObjectExpression',
    targetFrameworks: ['GENERIC_ESTREE', 'REACT_JSX'],
    nodeTypes: ['ObjectExpression', 'ArrayExpression', 'ArrowFunctionExpression'],
    attributeRequirements: {
      scopeType: 'LOOP'
    }
  },
  {
    alpId: 'ALP-LAYOUT-ELEMENT',
    selectorString: 'JSXElement[openingElement.name.name="img|video|iframe"]:not([width]):not([height])',
    targetFrameworks: ['REACT_JSX', 'VUE_SFC', 'ANGULAR_TEMPLATE'],
    nodeTypes: ['JSXElement', 'VElement', 'Element$1'],
    attributeRequirements: {
      missingAttributes: ['width', 'height']
    }
  },
  {
    alpId: 'ALP-ASYNC-DISPOSAL',
    selectorString: 'CallExpression[callee.property.name="addEventListener"]',
    targetFrameworks: ['GENERIC_ESTREE', 'REACT_JSX', 'VUE_SFC'],
    nodeTypes: ['CallExpression'],
    attributeRequirements: {
      requiresDisposalPair: true
    }
  },
  {
    alpId: 'ALP-STATIC-IMPORT',
    selectorString: 'ImportDeclaration',
    targetFrameworks: ['GENERIC_ESTREE', 'REACT_JSX', 'VUE_SFC'],
    nodeTypes: ['ImportDeclaration'],
    attributeRequirements: {
      referencedInConditional: true
    }
  },
  {
    alpId: 'ALP-EVENT-KEYBOARD',
    selectorString: 'JSXElement[openingElement.name.name="div|span|section"][onClick]:not([onKeyDown])',
    targetFrameworks: ['REACT_JSX', 'VUE_SFC', 'ANGULAR_TEMPLATE'],
    nodeTypes: ['JSXElement', 'VElement', 'Element$1'],
    attributeRequirements: {
      hasPointerListener: true,
      missingKeyboardListener: true
    }
  },
  {
    alpId: 'ALP-ARIA-NAMING',
    selectorString: 'JSXElement[openingElement.name.name=/^[A-Z]/]:not([role]):not([aria-label]):not([aria-labelledby])',
    targetFrameworks: ['REACT_JSX', 'VUE_SFC', 'ANGULAR_TEMPLATE'],
    nodeTypes: ['JSXElement', 'VElement', 'Element$1'],
    attributeRequirements: {
      missingRole: true,
      missingAccessibleName: true
    }
  },
  {
    alpId: 'ALP-LIVE-REGION',
    selectorString: 'JSXElement[openingElement.name.name="div|span"][isDynamicMutation]:not([aria-live]):not([role="status|alert"])',
    targetFrameworks: ['REACT_JSX', 'VUE_SFC', 'ANGULAR_TEMPLATE'],
    nodeTypes: ['JSXElement', 'VElement', 'Element$1'],
    attributeRequirements: {
      isDynamicMutation: true,
      missingLiveRegion: true
    }
  },
  {
    alpId: 'ALP-FOCUS-TRAVERSAL',
    selectorString: 'JSXElement[openingElement.name.name="Modal|Dialog|Overlay"]:not([trapFocus])',
    targetFrameworks: ['REACT_JSX', 'VUE_SFC', 'ANGULAR_TEMPLATE'],
    nodeTypes: ['JSXElement', 'VElement', 'Element$1'],
    attributeRequirements: {
      isOverlay: true,
      missingFocusContainment: true
    }
  }
];

/**
 * Helper to normalize framework-specific AST elements to a standard FIGM ASTNode
 */
export class UniversalASTMapper {
  public static normalizeNode(rawNode: ASTNode, framework: FrameworkType): ASTNode {
    const normalized: ASTNode = {
      type: rawNode.type,
      name: rawNode.name || this.extractName(rawNode, framework),
      attributes: { ...(rawNode.attributes || {}) },
      loc: rawNode.loc || { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
      children: rawNode.children ? rawNode.children.map((c) => this.normalizeNode(c, framework)) : [],
      scopeType: rawNode.scopeType || 'GLOBAL',
      // AST Migration Phase 8: this field was added to ASTNode after normalizeNode was already
      // reconstructing a fresh object here (rather than spreading rawNode) -- without explicitly
      // carrying it forward, every node's real-AST-vs-legacy provenance was silently lost between
      // SourceParser/real-syntax-node-builder and ASTDetectionEngine.createReport, making every
      // diagnostic report LEGACY_TEXT_HEURISTIC regardless of actual origin (caught by
      // tests/ast-migration.test.ts's sourceKind provenance suite).
      sourceKind: rawNode.sourceKind
    };

    // Extract framework-specific attributes into unified attributes dictionary
    if (framework === 'REACT_JSX' && rawNode.type === 'JSXElement') {
      const attrs = rawNode.attributes || {};
      normalized.attributes = { ...attrs };
    } else if (framework === 'VUE_SFC' && rawNode.type === 'VElement') {
      const attrs = rawNode.attributes || {};
      normalized.attributes = { ...attrs };
    } else if (framework === 'ANGULAR_TEMPLATE' && rawNode.type === 'Element$1') {
      const attrs = rawNode.attributes || {};
      normalized.attributes = { ...attrs };
    }

    return normalized;
  }

  private static extractName(node: ASTNode, framework: FrameworkType): string {
    if (node.name) return node.name;
    if (framework === 'REACT_JSX' && node.openingElement) {
      return (node.openingElement as { name?: { name?: string } }).name?.name || 'unknown';
    }
    return 'unknown';
  }
}
