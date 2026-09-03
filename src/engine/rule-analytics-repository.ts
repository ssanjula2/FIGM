import { DBScanRecord } from '../auth/user-db';
import { RepositoryFactory } from '../storage/repository-factory';
import { RULE_CATALOG } from '../matrix/rule-registry';

export interface RuleStatEntry {
  ruleId: string;
  ruleName: string | null;
  severity: string | null;
  totalOccurrences: number;
  scansTriggered: number;
}

export interface RuleAnalyticsSummary {
  totalScansAnalyzed: number;
  totalFindings: number;
  ruleStats: RuleStatEntry[];
  severityBreakdown: Record<string, number>;
}

const RULE_LOOKUP = new Map(RULE_CATALOG.map((r) => [r.id, r]));

/**
 * Aggregates real rule-trigger frequency across every persisted ScanReport's `diagnostics` --
 * this is genuine production usage data, distinct from (and never conflated with) the controlled
 * benchmark numbers in benchmarks/eval-summary.json. Never fabricates a count for a rule that has
 * zero real occurrences -- such rules simply don't appear in `ruleStats`.
 *
 * Stage 7D (Section 6): deliberately NOT filtered by engineering-test-account status. This is an
 * ADMIN-only operational tool (app/api/admin/rule-stats/route.ts, authorizeRole(['ADMIN'])), not a
 * public or research-facing metric -- an admin auditing which rules actually fire needs full
 * visibility, including an engineering-QA walkthrough's own scans, to do that job. Contrast with
 * the public app/api/dashboard/statistics/route.ts and DashboardRepository.getSummary()/
 * getActivityFeed, which DO exclude engineering-test data because they're shown to real visitors
 * or feed research-facing aggregates.
 */
export class RuleAnalyticsRepository {
  private static get provider() {
    return RepositoryFactory.getStorageProvider();
  }

  public static async getSummary(): Promise<RuleAnalyticsSummary> {
    const scans = ((await RuleAnalyticsRepository.provider.getScanRecords()) as DBScanRecord[]) || [];

    const occurrences = new Map<string, number>();
    const scansTriggeredSet = new Map<string, Set<string>>();
    const severityBreakdown: Record<string, number> = {};
    let totalFindings = 0;

    for (const scan of scans) {
      for (const d of scan.diagnostics || []) {
        const ruleId = (d as any)?.ruleId;
        if (!ruleId) continue;
        totalFindings += 1;

        occurrences.set(ruleId, (occurrences.get(ruleId) || 0) + 1);

        const set = scansTriggeredSet.get(ruleId) || new Set<string>();
        set.add(scan.id);
        scansTriggeredSet.set(ruleId, set);

        const severity = (d as any)?.severity || RULE_LOOKUP.get(ruleId)?.severity || 'UNKNOWN';
        severityBreakdown[severity] = (severityBreakdown[severity] || 0) + 1;
      }
    }

    const ruleStats: RuleStatEntry[] = [...occurrences.entries()]
      .map(([ruleId, totalOccurrences]) => ({
        ruleId,
        ruleName: RULE_LOOKUP.get(ruleId)?.name ?? null,
        severity: RULE_LOOKUP.get(ruleId)?.severity ?? null,
        totalOccurrences,
        scansTriggered: scansTriggeredSet.get(ruleId)?.size ?? 0,
      }))
      .sort((a, b) => b.totalOccurrences - a.totalOccurrences);

    return {
      totalScansAnalyzed: scans.length,
      totalFindings,
      ruleStats,
      severityBreakdown,
    };
  }
}
