/**
 * Framework-Independent Guideline Model (FIGM)
 * Concern-to-Standard-Clause Mapping (Phase 9: live guideline traceability)
 *
 * Before this module existed, every live diagnostic's `standardReference` was a blanket two-way
 * ternary (`domain === 'PERFORMANCE' ? 'ISO 25010' : 'WCAG 2.2'`) — a real user or examiner
 * inspecting actual scan output could not get more granular traceability than "this is a
 * performance rule" or "this is an accessibility rule." A richer, clause-level
 * `standardTraceability` structure existed in `four-layer-meta-model.ts` / `guideline-filtering.ts`
 * but was never imported by the live scan path (confirmed by grep — see
 * docs/audit/GUIDELINE_FORENSIC_TRACEABILITY.md).
 *
 * That richer structure was explicitly documented as "this auditor's interpretive mapping, not
 * sourced from an authoritative FIGM-to-standard crosswalk," so it is NOT wired in here as-is —
 * doing so would risk presenting speculative clause numbers as verified fact. Instead, this module
 * uses only clause references that are independently verifiable against the real published
 * standards:
 *   - The 4 WCAG 2.2 Success Criterion numbers below (`src/types/taxonomy.ts`'s
 *     AccessibilityConcernType already carried these as comments) are real, checkable citations —
 *     WCAG 2.2 SC 2.1.1 "Keyboard", SC 4.1.2 "Name, Role, Value", SC 4.1.3 "Status Messages", and
 *     SC 2.4.3 "Focus Order" are genuine clauses of the published W3C WCAG 2.2 recommendation.
 *   - The ISO/IEC 25010 Performance Efficiency sub-characteristics used below (Time Behaviour,
 *     Resource Utilization) are the real, published structure of that standard's Performance
 *     Efficiency characteristic — not invented.
 * This is presented as "aligned with" / "mapped to" a real clause, never as certification —
 * FIGM is not an ISO/W3C-accredited conformance testing tool.
 */

import { ConcernType, DomainType } from '../types/taxonomy.js';

const WCAG_CLAUSE: Partial<Record<ConcernType, string>> = {
  KEYBOARD_ACCESSIBILITY: 'WCAG 2.2 SC 2.1.1 (Keyboard)',
  NAME_ROLE_VALUE: 'WCAG 2.2 SC 4.1.2 (Name, Role, Value)',
  STATUS_MESSAGES: 'WCAG 2.2 SC 4.1.3 (Status Messages)',
  FOCUS_ORDER: 'WCAG 2.2 SC 2.4.3 (Focus Order)',
};

// ISO/IEC 25010 Performance Efficiency has three real sub-characteristics: Time Behaviour,
// Resource Utilization, and Capacity. Every FIGM performance concern is mapped to whichever of
// the two most applicable to FIGM's static-analysis rules genuinely fits — resource-consumption
// concerns (unnecessary allocation, unbounded imports/listeners) to Resource Utilization;
// rendering/responsiveness concerns to Time Behaviour. No FIGM rule currently maps to Capacity.
const ISO_25010_SUBCHARACTERISTIC: Partial<Record<ConcernType, string>> = {
  RESOURCE_UTILIZATION: 'ISO/IEC 25010 — Performance Efficiency: Resource Utilization',
  BUNDLE_SIZE: 'ISO/IEC 25010 — Performance Efficiency: Resource Utilization',
  ASYNC_LEAKS: 'ISO/IEC 25010 — Performance Efficiency: Resource Utilization',
  INVARIANT_ALLOCATIONS: 'ISO/IEC 25010 — Performance Efficiency: Resource Utilization',
  LAYOUT_INSTABILITY: 'ISO/IEC 25010 — Performance Efficiency: Time Behaviour',
  ARCHITECTURE: 'ISO/IEC 25010 — Performance Efficiency: Time Behaviour',
};

/**
 * Returns the most specific defensible standard reference for a diagnostic's domain + concern.
 * Falls back to the original blanket domain-level reference for any concern not in the maps
 * above (there should be none, given the enums are closed, but this keeps the function total).
 */
export function getStandardReference(domain: DomainType, concern: ConcernType): string {
  if (domain === 'ACCESSIBILITY') {
    return WCAG_CLAUSE[concern] ?? 'WCAG 2.2';
  }
  return ISO_25010_SUBCHARACTERISTIC[concern] ?? 'ISO 25010';
}
