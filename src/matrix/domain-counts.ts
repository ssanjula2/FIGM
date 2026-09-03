import { RULE_CATALOG } from './rule-registry';
import { primaryResearchDomain } from './four-layer-meta-model';

export interface DomainCounts {
  ARCHITECTURE: number;
  STATIC_PERFORMANCE: number;
  ACCESSIBILITY: number;
}

/** Real, registry-derived rule counts per research domain -- the same partition
 *  primaryResearchDomain() computes for the live scanner and admin dashboard. Shared here so
 *  landing/marketing surfaces can never hardcode a copy that silently drifts from the real rule
 *  set as it grows. */
export function getDomainCounts(): DomainCounts {
  const counts: DomainCounts = { ARCHITECTURE: 0, STATIC_PERFORMANCE: 0, ACCESSIBILITY: 0 };
  for (const rule of RULE_CATALOG) {
    counts[primaryResearchDomain(rule.domain, rule.concern)] += 1;
  }
  return counts;
}
