export interface FIGMRuleDefinition {
  ruleId: string;
  ruleName: string;
  domain: string;
  concern: string;
  severity: string;
  description: string;
  remediation: string;
}

export const FIGM_RULES: FIGMRuleDefinition[] = [
  {
    ruleId: 'FIGM-PERF-01',
    ruleName: 'Invariant Object Allocation in Iteration Scopes',
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    severity: 'HIGH',
    description: 'Objects, arrays, functions, or regex literals must not be instantiated inside loops or render iteration routines.',
    remediation: 'Hoist static object/array literals and helper callbacks outside the iteration scope or memoize invariant allocations.'
  },
  {
    ruleId: 'FIGM-PERF-02',
    ruleName: 'Un-dimensioned Dynamic Layout Elements',
    domain: 'PERFORMANCE',
    concern: 'LAYOUT_INSTABILITY',
    severity: 'HIGH',
    description: 'Dynamic media and layout container elements must include explicit dimensions or aspect-ratio attributes.',
    remediation: 'Add explicit width and height attributes or CSS aspect-ratio properties to all media elements.'
  },
  {
    ruleId: 'FIGM-PERF-03',
    ruleName: 'Unbounded Event Listener Disposal',
    domain: 'PERFORMANCE',
    concern: 'ASYNC_LEAKS',
    severity: 'CRITICAL',
    description: 'Target event listeners registered within component lifecycle scopes must have corresponding disposal handlers.',
    remediation: 'Return an explicit teardown function or invoke removeEventListener in the lifecycle unmount routine.'
  },
  {
    ruleId: 'FIGM-PERF-04',
    ruleName: 'Static Imports in Deferred Execution Paths',
    domain: 'PERFORMANCE',
    concern: 'BUNDLE_SIZE',
    severity: 'MEDIUM',
    description: 'Modules used only in conditional or deferred execution branches must be dynamically imported.',
    remediation: 'Use dynamic import() expressions inside conditional blocks instead of top-level static imports.'
  },
  {
    ruleId: 'FIGM-PERF-05',
    ruleName: 'Inline Anonymous Callbacks in Render Loops',
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    severity: 'MEDIUM',
    description: 'Inline arrow functions or closures passed to JSX props inside render loops re-instantiate callbacks every cycle.',
    remediation: 'Wrap event callbacks in React.useCallback or extract them outside the render loop.'
  },
  {
    ruleId: 'FIGM-A11Y-01',
    ruleName: 'Keyboard Event Parity on Pointer Handlers',
    domain: 'ACCESSIBILITY',
    concern: 'KEYBOARD_NAVIGATION',
    severity: 'HIGH',
    description: 'Non-interactive elements with pointer click handlers must have equivalent keyboard handlers (onKeyDown) and tabIndex.',
    remediation: 'Add onKeyDown/onKeyUp handlers and tabIndex={0} or replace element with a native <button>.'
  },
  {
    ruleId: 'FIGM-A11Y-02',
    ruleName: 'Accessible Name and Role for Custom UI Controls',
    domain: 'ACCESSIBILITY',
    concern: 'SCREEN_READER_TREE',
    severity: 'CRITICAL',
    description: 'Custom interactive UI elements missing explicit ARIA role and accessible name attributes.',
    remediation: 'Add explicit role="..." and aria-label="..." or aria-labelledby="..." attributes.'
  },
  {
    ruleId: 'FIGM-REACT-01',
    ruleName: 'Memoize Expensive Derived Computations',
    domain: 'PERFORMANCE',
    concern: 'INVARIANT_ALLOCATIONS',
    severity: 'HIGH',
    description: 'Expensive array sorting or filtering operations inside render routines should be wrapped in useMemo.',
    remediation: 'Wrap heavy derived data computations inside React.useMemo.'
  },
  {
    ruleId: 'FIGM-REACT-02',
    ruleName: 'Stable List Key Prop Assignment',
    domain: 'PERFORMANCE',
    concern: 'LAYOUT_INSTABILITY',
    severity: 'HIGH',
    description: 'Array indices assigned as list key props cause invalid component re-ordering and state bugs.',
    remediation: 'Assign a unique stable identifier (item.id) to list key props instead of array index.'
  }
];
