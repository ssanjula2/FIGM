import { DBSubmission, DBScanRecord, DBAuditLog } from '../auth/user-db';
import { RepositoryFactory } from '../storage/repository-factory';
import { isEngineeringTestEmail, isEngineeringTestAccount } from '../lib/engineering-test-accounts';

export interface DashboardSummary {
  totalProjects: number;
  totalScans: number;
  totalReports: number;
  totalRulesTriggered: number;
  totalAiSuggestions: number;
  // null (not 0) when the scope (this user, or the whole platform) has zero real scans -- a real
  // 0% average is a legitimate, distinct value from "no data exists yet to average," and the UI
  // must render an honest no-data state rather than a fabricated-looking "0% (FAILED)" score.
  avgQualityScore: number | null;
  avgScanDurationMs: number;
  avgMemoryUsageMb: number;
  totalActiveUsers: number;
  frameworkDistribution: {
    react: number;
    nextjs: number;
    angular: number;
    vue: number;
    generic: number;
  };
}

export interface ActivityItem {
  id: string;
  type: 'SCAN' | 'AI_FIX' | 'REGISTER' | 'LOGIN' | 'REPORT';
  title: string;
  description: string;
  timestamp: string;
  user?: string;
  badgeColor: string;
}

export interface ReportSummaryItem {
  id: string;
  fileName: string;
  framework: string;
  qualityScore: number;
  defectsCount: number;
  criticalCount: number;
  highCount: number;
  scanTimeMs: number;
  createdAt: string;
}

function maskEmail(email?: string): string {
  if (!email || !email.includes('@')) return 'developer';
  const [local, domain] = email.split('@');
  const maskedLocal = local.length <= 1 ? '*' : `${local[0]}${'*'.repeat(Math.min(local.length - 1, 3))}`;
  return `${maskedLocal}@${domain}`;
}

export class DashboardRepository {
  private static get provider() {
    return RepositoryFactory.getStorageProvider();
  }

  public static async getSummary(userId?: string, role = 'DEVELOPER'): Promise<DashboardSummary> {
    // Stage 7C latency pass (Section 23): these two/three provider calls are independent DB reads
    // (no query depends on another's result) -- previously awaited sequentially, which serializes
    // their real network round-trips to Supabase. Same real data, same query count, just no longer
    // paying for N round-trips back-to-back when they can overlap.
    const [scanRecordsRaw, projectsRaw, allUsersRaw] = await Promise.all([
      DashboardRepository.provider.getScanRecords(userId),
      DashboardRepository.provider.getProjects(userId),
      userId ? Promise.resolve(undefined) : DashboardRepository.provider.getAllUsers(),
    ]);
    let scanRecords = (scanRecordsRaw as DBScanRecord[]) || [];
    const submissions = userId
      ? await DashboardRepository.provider.getSubmissionsByUserId(userId)
      : [];
    let projects = (projectsRaw as any[]) || [];

    // Stage 7C/7D engineering-test-data separation (Section 20/6): only the admin-wide aggregate
    // (userId undefined -- a single user's own dashboard never needs this) can be polluted by
    // engineering-QA accounts' scan/project records. Excluded via the real, persisted
    // `accountType` column (falling back to the email convention for pre-migration rows) -- see
    // src/lib/engineering-test-accounts.ts's isEngineeringTestAccount doc comment.
    if (!userId) {
      const allUsers = (allUsersRaw as Array<{ id: string; email: string; accountType?: string | null }>) || [];
      const engineeringTestUserIds = new Set(allUsers.filter((u) => isEngineeringTestAccount(u)).map((u) => u.id));
      if (engineeringTestUserIds.size > 0) {
        scanRecords = scanRecords.filter((s) => !engineeringTestUserIds.has(s.userId));
        projects = projects.filter((p) => !engineeringTestUserIds.has(p.userId));
      }
    }

    // Real counts only — no artificial minimum floors. A brand-new/low-traffic deployment must
    // show its real (possibly small or zero) numbers, not a padded-up minimum designed to make
    // the dashboard look more active than it actually is. Previously this function padded every
    // one of these fields with a hardcoded floor (totalScans/totalReports >= 30,
    // totalRulesTriggered >= 823, totalAiSuggestions >= 175, totalActiveUsers >= 85) and, when
    // there were literally zero real scans, fabricated an entire fake framework distribution
    // (react:10, nextjs:10, angular:10, vue:2, generic:2) and fake average quality/duration
    // numbers — production statistics presented to real users that were not derived from the
    // real database at all.
    const totalScans = scanRecords.length + submissions.length;
    const totalProjects = projects.length;
    const totalReports = totalScans;

    let totalQualityScore = 0;
    let totalScanDurationMs = 0;
    let totalMemoryUsageMb = 0;
    let totalRulesTriggered = 0;
    let totalAiSuggestions = 0;

    const fwDist = {
      react: 0,
      nextjs: 0,
      angular: 0,
      vue: 0,
      generic: 0,
    };

    const activeUserSet = new Set<string>();

    scanRecords.forEach((s) => {
      if (s.userId) activeUserSet.add(s.userId);
      totalQualityScore += s.qualityScore ?? 0;
      totalScanDurationMs += s.scanTimeMs ?? 0;
      totalMemoryUsageMb += (s as any).memoryUsageMb ?? 0;
      totalRulesTriggered += s.ruleCount ?? 0;
      totalAiSuggestions += s.aiFixCount ?? 0;

      const fw = (s.framework || '').toLowerCase();
      if (fw.includes('react')) fwDist.react++;
      else if (fw.includes('next')) fwDist.nextjs++;
      else if (fw.includes('angular')) fwDist.angular++;
      else if (fw.includes('vue')) fwDist.vue++;
      else fwDist.generic++;
    });

    submissions.forEach((s) => {
      if (s.userId) activeUserSet.add(s.userId);
      totalQualityScore += s.qualityScore ?? 0;
      totalScanDurationMs += s.executionTimeMs ?? 0;
      totalRulesTriggered += s.diagnosticsCount ?? 0;
      totalAiSuggestions += 0;

      const fw = (s.framework || '').toLowerCase();
      if (fw.includes('react')) fwDist.react++;
      else if (fw.includes('next')) fwDist.nextjs++;
      else if (fw.includes('angular')) fwDist.angular++;
      else if (fw.includes('vue')) fwDist.vue++;
      else fwDist.generic++;
    });

    const avgQualityScore = totalScans > 0 ? Math.round(totalQualityScore / totalScans) : null;
    const avgScanDurationMs = totalScans > 0 ? parseFloat((totalScanDurationMs / totalScans).toFixed(2)) : 0;
    const avgMemoryUsageMb = totalScans > 0 ? parseFloat((totalMemoryUsageMb / totalScans).toFixed(2)) : 0;

    return {
      totalProjects,
      totalScans,
      totalReports,
      totalRulesTriggered,
      totalAiSuggestions,
      avgQualityScore,
      avgScanDurationMs,
      avgMemoryUsageMb,
      totalActiveUsers: activeUserSet.size,
      frameworkDistribution: fwDist,
    };
  }

  /**
   * `userId` scopes the feed to one account's own activity (the authenticated developer
   * dashboard) -- when omitted, this is the admin-wide/platform feed (see the "platform pulse"
   * comment below), never something a non-admin caller should receive. Callers must derive
   * `userId` server-side from the authenticated session, never trust one supplied by the client.
   */
  public static async getActivityFeed(limit = 10, userId?: string): Promise<ActivityItem[]> {
    // Fetch extra headroom above `limit` -- the research-participant filter below can drop rows,
    // and without this the feed would silently return fewer than `limit` items whenever a
    // participant event happened to be among the most recent ones.
    const rawLogs = ((await DashboardRepository.provider.getAuditLogs(limit * 3, userId)) as DBAuditLog[]) || [];
    // Stage 7B fix: this feed is served publicly/unauthenticated (see the comment below) as a
    // "platform pulse" showcase -- it must never include human-study participant activity.
    // RESEARCH_* actions and the synthetic @user-study.figm.local email domain
    // (src/engine/participant-repository.ts, app/api/user-study/*) are the two ways a participant
    // event is tagged; excluding both is belt-and-suspenders. Previously a participant's real
    // consent/scan events (identifiable by participant code, e.g. "P007") were visible to any
    // unauthenticated visitor -- inconsistent with the study's own consent protocol, which commits
    // to presenting results only in aggregated/anonymized form (docs/research/FINAL_RESEARCH_CONTRACT.md
    // Section 12), not as an individually-attributable live event stream.
    const logs = rawLogs
      .filter((log) => !log.action.startsWith('RESEARCH_') && !(log.email || '').endsWith('@user-study.figm.local') && !isEngineeringTestEmail(log.email))
      .slice(0, limit);
    if (logs.length > 0) {
      return logs.map((log) => {
        // This feed is served publicly (unauthenticated) as a live "platform pulse" showcase on
        // the main dashboard -- real user email addresses must never appear in it. Mask to
        // first-char + domain (e.g. "j***@example.com") so the feed still reads as real activity
        // without disclosing who specifically performed the action.
        const maskedUser = maskEmail(log.email);
        return {
          id: log.id,
          type: log.action === 'REGISTER' ? 'REGISTER' : log.action === 'LOGIN' ? 'LOGIN' : 'SCAN',
          title: `${log.action} Event`,
          description: log.details || `User ${maskedUser} performed ${log.action}`,
          timestamp: log.createdAt,
          user: maskedUser,
          badgeColor: log.status === 'SUCCESS' ? '#10b981' : '#f43f5e',
        };
      });
    }

    // No real audit log entries exist yet. This feed is served publicly (see the comment above),
    // so returning fabricated "recent activity" here would present invented events -- including,
    // in a prior version, a reference to the fabricated "30-repository evaluation" claim -- to a
    // real visitor as if they were real platform activity. An honest empty list lets the UI show
    // a genuine "no activity yet" state instead (see LiveDashboardContent.tsx).
    return [];
  }

  public static async getRecentReports(userId?: string, limit = 10): Promise<ReportSummaryItem[]> {
    const records = ((await DashboardRepository.provider.getScanRecords(userId)) as DBScanRecord[]) || [];
    const submissions = userId
      ? await DashboardRepository.provider.getSubmissionsByUserId(userId)
      : [];

    if (records.length > 0 || submissions.length > 0) {
      const combined = [
        ...records.map((s) => ({
          id: s.id,
          fileName: s.fileName,
          framework: s.framework,
          qualityScore: s.qualityScore,
          defectsCount: s.ruleCount,
          criticalCount: s.ruleCount > 3 ? 2 : 1,
          highCount: s.ruleCount > 1 ? 1 : 0,
          scanTimeMs: s.scanTimeMs,
          createdAt: s.createdAt,
        })),
        ...submissions.map((s) => ({
          id: s.id,
          fileName: s.fileName,
          framework: s.framework,
          qualityScore: s.qualityScore,
          defectsCount: s.diagnosticsCount,
          criticalCount: s.diagnosticsCount > 3 ? 2 : 1,
          highCount: s.diagnosticsCount > 1 ? 1 : 0,
          scanTimeMs: s.executionTimeMs,
          createdAt: s.createdAt,
        })),
      ];

      return combined.slice(-limit);
    }

    // Real, empty result only -- no fabricated placeholder reports. This mirrors the same
    // fabrication-removal already applied to getSummary() above; this fallback was missed in that
    // pass. The dashboard UI (LiveDashboardContent.tsx) already renders an honest empty state
    // ("No scan reports found. Run a new scan to populate reports.") for exactly this case.
    return [];
  }
}
