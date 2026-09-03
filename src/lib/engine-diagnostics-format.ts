/**
 * Presentation-layer formatting for the Live Scanner's "Engine Diagnostics" panel (Stage 5A
 * audit). Pure functions only, no fabrication: every function here formats a real value it was
 * given (or reports that value as genuinely unavailable) -- none of them invent, floor, clamp, or
 * derive a number from anything other than the input.
 *
 * See src/engine/dynamic-profiler.ts's buildProfileMetrics doc comment for where the real
 * durationMs/memoryDeltaMb values these functions format actually come from.
 */

/**
 * Formats a real elapsed-time measurement (milliseconds) for display. Switches to seconds above
 * 1000ms purely for readability -- this is formatting, not a different measurement.
 * `durationMs` must be a real, non-negative, finite number (see dynamic-profiler.ts); this
 * function does not validate that, only formats it.
 */
export function formatScanDuration(durationMs: number): string {
  if (durationMs >= 1000) {
    return `${(durationMs / 1000).toFixed(2)} s`;
  }
  return `${durationMs.toFixed(2)} ms`;
}

/**
 * Formats a real heap-used delta (megabytes, endMemory - startMemory) for display.
 * - `null` (no memory API was available to measure from) renders as an honest "Unavailable" --
 *   never a fabricated placeholder number.
 * - A negative delta (garbage collection freed more than this scan allocated during the
 *   measurement window) is shown as-is, with an explanatory suffix -- never silently clamped to a
 *   positive-looking value.
 */
export function formatMemoryDelta(memoryDeltaMb: number | null): string {
  if (memoryDeltaMb === null) {
    return 'Unavailable';
  }
  if (memoryDeltaMb < 0) {
    return `${memoryDeltaMb.toFixed(2)} MB (GC reclaimed more than this scan allocated)`;
  }
  return `${memoryDeltaMb.toFixed(2)} MB`;
}

/** Real human-readable label for RuleExecutionEngine's honest analysis-completeness status
 *  (`ScanResult.analysis.figmStatus`) -- never invents a status not returned by the server. */
export function formatScanEngineStatus(figmStatus: 'COMPLETE' | 'PARTIAL' | 'BLOCKED' | 'UNSUPPORTED_FRAMEWORK'): string {
  switch (figmStatus) {
    case 'COMPLETE':
      return 'Complete';
    case 'PARTIAL':
      return 'Partial (best-effort parse recovery)';
    case 'BLOCKED':
      return 'Blocked (parse failed)';
    case 'UNSUPPORTED_FRAMEWORK':
      return 'Unsupported framework';
    default:
      return figmStatus;
  }
}

/**
 * Compact single-word badge label + a restrained tone for the same real `figmStatus` signal
 * (never a different classification from formatScanEngineStatus above -- just shorter, for a
 * badge that has no room for the parenthetical detail). Status is never communicated by color
 * alone: every tone always pairs with this text label.
 */
export function scanEngineStatusBadge(
  figmStatus: 'COMPLETE' | 'PARTIAL' | 'BLOCKED' | 'UNSUPPORTED_FRAMEWORK'
): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
  switch (figmStatus) {
    case 'COMPLETE':
      return { label: 'Complete', tone: 'success' };
    case 'PARTIAL':
      return { label: 'Partial', tone: 'warning' };
    case 'BLOCKED':
      return { label: 'Blocked', tone: 'danger' };
    case 'UNSUPPORTED_FRAMEWORK':
      return { label: 'Unsupported', tone: 'neutral' };
    default:
      return { label: figmStatus, tone: 'neutral' };
  }
}
