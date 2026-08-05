/**
 * Framework-Independent Guideline Model (FIGM)
 * 3-Stage Sequential Guideline Extraction Pipeline
 */

import {
  GuidelineMetadata,
  FilterStageResult,
  PipelineExecutionReport
} from '../types/taxonomy.js';

/**
 * Candidate Pool of N = 18 Initial Guidelines with complete metadata
 */
export const CANDIDATE_GUIDELINES: GuidelineMetadata[] = [
  // --- Core Performance Candidates ---
  {
    id: 'FIGM-PERF-01',
    name: 'Invariant Object Allocation in Iteration Scopes',
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    description: 'Avoid instantiating invariant object literals or closures within high-frequency loops or render iterations.',
    isFrameworkIndependent: true,
    isStaticallyDetectable: true,
    traceability: {
      standard: 'ISO_25010',
      clause: 'Performance Efficiency - Time Behaviour',
      title: 'Minimize unnecessary garbage collection pressure and main thread execution latency'
    },
    alpId: 'ALP-LOOP-ALLOC'
  },
  {
    id: 'FIGM-PERF-02',
    name: 'Un-dimensioned Dynamic Layout Elements',
    domain: 'PERFORMANCE',
    concern: 'LAYOUT_INSTABILITY',
    description: 'Ensure dynamic media or content containers specify explicit width, height, or aspect-ratio attributes.',
    isFrameworkIndependent: true,
    isStaticallyDetectable: true,
    traceability: {
      standard: 'ISO_25010',
      clause: 'Usability & Performance Efficiency',
      title: 'Prevent Cumulative Layout Shift (CLS) during async content load'
    },
    alpId: 'ALP-LAYOUT-ELEMENT'
  },
  {
    id: 'FIGM-PERF-03',
    name: 'Unbounded Event Listener Disposal',
    domain: 'PERFORMANCE',
    concern: 'ASYNC_LEAKS',
    description: 'Global target event listeners registered in lifecycle/scope blocks must have matching removal/tear-down logic.',
    isFrameworkIndependent: true,
    isStaticallyDetectable: true,
    traceability: {
      standard: 'ISO_25010',
      clause: 'Performance Efficiency - Resource Utilization',
      title: 'Prevent heap memory leaks across SPA navigation cycles'
    },
    alpId: 'ALP-ASYNC-DISPOSAL'
  },
  {
    id: 'FIGM-PERF-04',
    name: 'Static Imports in Deferred Execution Paths',
    domain: 'PERFORMANCE',
    concern: 'BUNDLE_SIZE',
    description: 'Conditional or deferred execution blocks should not use top-level synchronous module imports.',
    isFrameworkIndependent: true,
    isStaticallyDetectable: true,
    traceability: {
      standard: 'ISO_25010',
      clause: 'Performance Efficiency - Resource Utilization',
      title: 'Optimize initial bundle size and page compilation time'
    },
    alpId: 'ALP-STATIC-IMPORT'
  },

  // --- Core Accessibility Candidates ---
  {
    id: 'FIGM-A11Y-01',
    name: 'Keyboard Event Parity on Pointer Handlers',
    domain: 'ACCESSIBILITY',
    concern: 'KEYBOARD_ACCESSIBILITY',
    description: 'Non-interactive elements with pointer event listeners must include equivalent keyboard event listeners.',
    isFrameworkIndependent: true,
    isStaticallyDetectable: true,
    traceability: {
      standard: 'WCAG_2_2',
      clause: 'SC 2.1.1',
      title: 'Keyboard Accessibility',
      level: 'A'
    },
    alpId: 'ALP-EVENT-KEYBOARD'
  },
  {
    id: 'FIGM-A11Y-02',
    name: 'Accessible Name and Role for Custom UI Controls',
    domain: 'ACCESSIBILITY',
    concern: 'NAME_ROLE_VALUE',
    description: 'Custom interactive component declarations must define explicit ARIA role and accessible name attributes.',
    isFrameworkIndependent: true,
    isStaticallyDetectable: true,
    traceability: {
      standard: 'WCAG_2_2',
      clause: 'SC 4.1.2',
      title: 'Name, Role, Value',
      level: 'A'
    },
    alpId: 'ALP-ARIA-NAMING'
  },
  {
    id: 'FIGM-A11Y-03',
    name: 'ARIA Live Announcer for Dynamic Mutations',
    domain: 'ACCESSIBILITY',
    concern: 'STATUS_MESSAGES',
    description: 'Dynamic status or result container elements mutated asynchronously must possess ARIA live region attributes.',
    isFrameworkIndependent: true,
    isStaticallyDetectable: true,
    traceability: {
      standard: 'WCAG_2_2',
      clause: 'SC 4.1.3',
      title: 'Status Messages',
      level: 'AA'
    },
    alpId: 'ALP-LIVE-REGION'
  },
  {
    id: 'FIGM-A11Y-04',
    name: 'Dynamic Focus Containment and Traversal',
    domain: 'ACCESSIBILITY',
    concern: 'FOCUS_ORDER',
    description: 'Dynamic overlay or modal insertions must maintain logical keyboard focus traversal without resetting focus state.',
    isFrameworkIndependent: true,
    isStaticallyDetectable: true,
    traceability: {
      standard: 'WCAG_2_2',
      clause: 'SC 2.4.3',
      title: 'Focus Order',
      level: 'A'
    },
    alpId: 'ALP-FOCUS-TRAVERSAL'
  },

  // --- Framework-Specific Candidates (Eliminated by Filter 1) ---
  {
    id: 'FIGM-CAND-FW-01',
    name: 'React Hook Dependency Array Exhaustiveness',
    domain: 'PERFORMANCE',
    concern: 'ASYNC_LEAKS',
    description: 'Validate useEffect hook dependency arrays in React JSX AST.',
    isFrameworkIndependent: false,
    frameworkExclusionReason: 'Tightly coupled to React synthetic hook runtime semantics.',
    isStaticallyDetectable: true,
    alpId: 'ALP-SPEC-FW'
  },
  {
    id: 'FIGM-CAND-FW-02',
    name: 'Vue Options API Reactivity Property Declaration',
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    description: 'Check data object return properties in Vue 2 Options API.',
    isFrameworkIndependent: false,
    frameworkExclusionReason: 'Tightly coupled to Vue 2 component instance proxy target wrappers.',
    isStaticallyDetectable: true,
    alpId: 'ALP-SPEC-FW'
  },
  {
    id: 'FIGM-CAND-FW-03',
    name: 'Angular @Input Decorator Change Detection',
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    description: 'Enforce OnPush change detection strategy for Angular decorators.',
    isFrameworkIndependent: false,
    frameworkExclusionReason: 'Tightly coupled to Angular zone.js and decorator compiler metadata.',
    isStaticallyDetectable: true,
    alpId: 'ALP-SPEC-FW'
  },
  {
    id: 'FIGM-CAND-FW-04',
    name: 'Svelte Reactive $: Statement Assignment Scope',
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    description: 'Check Svelte reactive statement assignment bounds.',
    isFrameworkIndependent: false,
    frameworkExclusionReason: 'Tightly coupled to Svelte compiler syntax extensions.',
    isStaticallyDetectable: true,
    alpId: 'ALP-SPEC-FW'
  },
  {
    id: 'FIGM-CAND-FW-05',
    name: 'Next.js getServerSideProps Export Signature',
    domain: 'PERFORMANCE',
    concern: 'BUNDLE_SIZE',
    description: 'Verify server function export names in Next.js page files.',
    isFrameworkIndependent: false,
    frameworkExclusionReason: 'Tightly coupled to Next.js file-system router convention.',
    isStaticallyDetectable: true,
    alpId: 'ALP-SPEC-FW'
  },
  {
    id: 'FIGM-CAND-FW-06',
    name: 'React useCallback Memoization Wrapper',
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    description: 'Ensure handler functions passed to child components are wrapped in useCallback.',
    isFrameworkIndependent: false,
    frameworkExclusionReason: 'Tightly coupled to React Virtual DOM memoization primitives.',
    isStaticallyDetectable: true,
    alpId: 'ALP-SPEC-FW'
  },

  // --- Dynamic Runtime-Only Candidates (Eliminated by Filter 2) ---
  {
    id: 'FIGM-CAND-DYN-01',
    name: 'Dynamic Network Latency Degradation Check',
    domain: 'PERFORMANCE',
    concern: 'LAYOUT_INSTABILITY',
    description: 'Flag rendering bottlenecks caused by unpredictable backend API response latency.',
    isFrameworkIndependent: true,
    isStaticallyDetectable: false,
    staticDetectionExclusionReason: 'Requires live server execution and dynamic network profile monitoring.',
    alpId: 'ALP-SPEC-DYN'
  },
  {
    id: 'FIGM-CAND-DYN-02',
    name: 'User Mouse Movement Trajectory Prediction',
    domain: 'ACCESSIBILITY',
    concern: 'FOCUS_ORDER',
    description: 'Analyze real-time user mouse movement speed relative to focus targets.',
    isFrameworkIndependent: true,
    isStaticallyDetectable: false,
    staticDetectionExclusionReason: 'Requires interactive client telemetry and runtime event monitoring.',
    alpId: 'ALP-SPEC-DYN'
  },

  // --- Non-Standard / Stylistic Candidates (Eliminated by Filter 3) ---
  {
    id: 'FIGM-CAND-STYLE-01',
    name: 'Identifier Length Style Convention',
    domain: 'PERFORMANCE',
    concern: 'BUNDLE_SIZE',
    description: 'Enforce minimum variable identifier character length in source code.',
    isFrameworkIndependent: true,
    isStaticallyDetectable: true,
    traceability: undefined, // Missing formal ISO/WCAG standard traceability
    alpId: 'ALP-SPEC-STYLE'
  },
  {
    id: 'FIGM-CAND-STYLE-02',
    name: 'Directory Nesting Hierarchy Depth Limit',
    domain: 'PERFORMANCE',
    concern: 'BUNDLE_SIZE',
    description: 'Restrict source code directory folder hierarchy depth to 4 levels.',
    isFrameworkIndependent: true,
    isStaticallyDetectable: true,
    traceability: undefined, // Missing formal ISO/WCAG standard traceability
    alpId: 'ALP-SPEC-STYLE'
  }
];

/**
 * Sequential Guideline Filtering Engine Class
 */
export class GuidelineFilteringEngine {
  /**
   * Run Filter 1: Framework Independence Protocol
   * Candidate Pool: N = 18 -> N = 12
   */
  public static runFilter1(candidates: GuidelineMetadata[]): {
    retained: GuidelineMetadata[];
    stageResult: FilterStageResult;
  } {
    const retained: GuidelineMetadata[] = [];
    const eliminatedIds: string[] = [];
    const eliminationReasons: Record<string, string> = {};

    for (const item of candidates) {
      if (item.isFrameworkIndependent) {
        retained.push(item);
      } else {
        eliminatedIds.push(item.id);
        eliminationReasons[item.id] =
          item.frameworkExclusionReason || 'Framework-dependent API idiom.';
      }
    }

    return {
      retained,
      stageResult: {
        stageIndex: 1,
        stageName: 'Framework Independence Filter',
        inputCount: candidates.length,
        outputCount: retained.length,
        retainedIds: retained.map((r) => r.id),
        eliminatedIds,
        eliminationReasons
      }
    };
  }

  /**
   * Run Filter 2: Static Detectability Protocol
   * Candidate Pool: N = 12 -> N = 10
   */
  public static runFilter2(candidates: GuidelineMetadata[]): {
    retained: GuidelineMetadata[];
    stageResult: FilterStageResult;
  } {
    const retained: GuidelineMetadata[] = [];
    const eliminatedIds: string[] = [];
    const eliminationReasons: Record<string, string> = {};

    for (const item of candidates) {
      if (item.isStaticallyDetectable) {
        retained.push(item);
      } else {
        eliminatedIds.push(item.id);
        eliminationReasons[item.id] =
          item.staticDetectionExclusionReason ||
          'Requires dynamic runtime execution state.';
      }
    }

    return {
      retained,
      stageResult: {
        stageIndex: 2,
        stageName: 'Static Detectability Filter',
        inputCount: candidates.length,
        outputCount: retained.length,
        retainedIds: retained.map((r) => r.id),
        eliminatedIds,
        eliminationReasons
      }
    };
  }

  /**
   * Run Filter 3: ISO/WCAG Standard Traceability Protocol
   * Candidate Pool: N = 10 -> N = 8 Core Guidelines
   */
  public static runFilter3(candidates: GuidelineMetadata[]): {
    retained: GuidelineMetadata[];
    stageResult: FilterStageResult;
  } {
    const retained: GuidelineMetadata[] = [];
    const eliminatedIds: string[] = [];
    const eliminationReasons: Record<string, string> = {};

    for (const item of candidates) {
      if (item.traceability && (item.traceability.standard === 'ISO_25010' || item.traceability.standard === 'WCAG_2_2')) {
        retained.push(item);
      } else {
        eliminatedIds.push(item.id);
        eliminationReasons[item.id] =
          'Lacks direct grounding or formal mapping to ISO 25010 or WCAG 2.2 SC standards.';
      }
    }

    return {
      retained,
      stageResult: {
        stageIndex: 3,
        stageName: 'Standard Traceability Filter',
        inputCount: candidates.length,
        outputCount: retained.length,
        retainedIds: retained.map((r) => r.id),
        eliminatedIds,
        eliminationReasons
      }
    };
  }

  /**
   * Execute full 3-Stage Pipeline
   */
  public static executePipeline(
    initialPool: GuidelineMetadata[] = CANDIDATE_GUIDELINES
  ): PipelineExecutionReport {
    const stage1 = this.runFilter1(initialPool);
    const stage2 = this.runFilter2(stage1.retained);
    const stage3 = this.runFilter3(stage2.retained);

    return {
      timestamp: new Date().toISOString(),
      initialCount: initialPool.length,
      finalCount: stage3.retained.length,
      stages: [stage1.stageResult, stage2.stageResult, stage3.stageResult],
      coreGuidelines: stage3.retained
    };
  }
}
