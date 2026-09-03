import crypto from 'node:crypto';
import { DBUser, DBScanRecord, DBSubmission } from '../auth/user-db';
import { RepositoryFactory } from '../storage/repository-factory';
import { hashPassword } from '../auth/auth-service';
import { HUMAN_STUDY_TARGET_PARTICIPANTS } from '../research/research-config';

/** Matches the synthetic participant-identity format app/api/user-study/log-scan/route.ts itself
 *  generates and enforces (PARTICIPANT_ID_PATTERN there) -- the single definition of what counts
 *  as a "participant id" versus a real developer/auditor/admin account id. */
export const PARTICIPANT_ID_PATTERN = /^P\d{3,6}$/;

/** The research cohort's planned sample size -- re-exports the single canonical value from
 *  src/research/research-config.ts (matches scripts/import-user-study.ts's use of the same
 *  constant and app/api/research-metrics/route.ts's fallback default) -- this is the
 *  set of identifiers the matrix always displays a row for, NOT a claim that all of them have
 *  real data. Every row's actual content is looked up from real database records; an id with no
 *  matching User row is rendered as NOT_REGISTERED, never fabricated.
 *
 *  IMPORTANT (forensic-audit P0-C, "two independent numbering systems"): the `P001`-style codes
 *  this repository assigns (assignNewParticipant, below) identify a live WEB-SESSION used to
 *  attribute real-time benchmark-scan telemetry (see app/api/user-study/log-scan/route.ts). Per
 *  the study's own protocol (research/DATA_COLLECTION_PROTOCOL.md §3.4), the FINAL, official
 *  anonymized research-participant id that appears in the dissertation is assigned SEPARATELY and
 *  independently by scripts/import-user-study.ts, purely from the order valid rows appear in the
 *  Google Form CSV export -- "never the original timestamp/free-text fields" (i.e. deliberately
 *  NOT cross-referenced against any live session). These are two intentionally-uncorrelated ID
 *  spaces that happen to share the same visual format. A live DB row with code "P002" and an
 *  entry in research/analysis/usability-results.json's `anonymizedParticipantIds` also called
 *  "P002" are NOT guaranteed (or even expected) to be the same person -- do not assume they
 *  correlate anywhere in this codebase, dashboard, or dissertation text. */
export const TARGET_PARTICIPANT_COUNT = HUMAN_STUDY_TARGET_PARTICIPANTS;

export type ParticipantStatus = 'NOT_REGISTERED' | 'REGISTERED' | 'SCANNED' | 'SUBMITTED';

/** Server-verifiable research-eligibility state -- mirrors prisma/schema.prisma's
 *  ResearchParticipantStatus. Null when no real User record exists for this code yet. */
export type ResearchStatus = 'ASSIGNED' | 'CONSENT_VERIFIED' | 'REVOKED' | null;

export interface ParticipantMatrixRow {
  participantId: string;
  status: ParticipantStatus;
  linkedUserId: string | null;
  registeredAt: string | null;
  lastActivity: string | null;
  totalScans: number;
  totalSubmissions: number;
  frameworksUsed: string[];
  latestQualityScore: number | null;
  totalFindings: number;
  researchStatus: ResearchStatus;
}

export interface RuleFindingCount {
  ruleId: string;
  count: number;
  severity: string | null;
}

/** One consent-gated, research-eligible scan row -- see getResearchDataset's doc comment. */
export interface ResearchDatasetScanRow {
  participantId: string;
  userId: string;
  scanId: string;
  fileName: string;
  framework: string;
  qualityScore: number;
  ruleCount: number;
  createdAt: string;
}

export interface ParticipantDetail {
  participantId: string;
  status: ParticipantStatus;
  profile: {
    linkedUserId: string | null;
    accountStatus: 'NOT_REGISTERED' | 'ACTIVE';
    createdAt: string | null;
    lastActivity: string | null;
    researchStatus: ResearchStatus;
    researchAssignedAt: string | null;
    researchConsentVerifiedAt: string | null;
  };
  scanSummary: {
    totalScans: number;
    successfulScans: number;
    failedScans: number;
    latestScan: string | null;
    averageScanTimeMs: number | null;
    averageQualityScore: number | null;
    totalFindings: number;
  };
  frameworkUsage: Array<{ framework: string; count: number }>;
  ruleFindings: RuleFindingCount[];
  scanHistory: Array<{
    id: string;
    fileName: string;
    framework: string;
    qualityScore: number;
    findingCount: number;
    scanTimeMs: number;
    createdAt: string;
  }>;
  submissions: Array<{
    id: string;
    fileName: string;
    framework: string;
    qualityScore: number;
    diagnosticsCount: number;
    createdAt: string;
  }>;
  /** Only populated when a real, independently-collected research record exists for this exact
   *  participant id (see research/independent-annotation, research/raw). This codebase has no
   *  per-participant-id-linked consent/questionnaire storage as of this session -- this stays
   *  null rather than fabricating a status, per the brief's explicit "do NOT invent missing study
   *  data" instruction. */
  researchStudy: null;
}

function normalizeFramework(framework: string | undefined): string {
  const fw = (framework || '').toUpperCase();
  if (fw.includes('NEXT')) return 'Next.js';
  if (fw.includes('REACT')) return 'React';
  if (fw.includes('ANGULAR')) return 'Angular';
  if (fw.includes('VUE')) return 'Vue';
  return 'Generic';
}

function countRuleFindings(scans: DBScanRecord[]): RuleFindingCount[] {
  const counts = new Map<string, { count: number; severity: string | null }>();
  for (const scan of scans) {
    for (const d of scan.diagnostics || []) {
      const ruleId = (d as any)?.ruleId;
      if (!ruleId) continue;
      const existing = counts.get(ruleId) || { count: 0, severity: (d as any)?.severity ?? null };
      existing.count += 1;
      counts.set(ruleId, existing);
    }
  }
  return [...counts.entries()]
    .map(([ruleId, v]) => ({ ruleId, count: v.count, severity: v.severity }))
    .sort((a, b) => b.count - a.count);
}

export class ParticipantRepository {
  private static get provider() {
    return RepositoryFactory.getStorageProvider();
  }

  private static isParticipantUser(u: DBUser): boolean {
    return PARTICIPANT_ID_PATTERN.test(u.id) || u.email.endsWith('@user-study.figm.local');
  }

  /**
   * Builds the P001..P0NN research matrix (NN = HUMAN_STUDY_TARGET_PARTICIPANTS). Every row for an id with no real User record is
   * NOT_REGISTERED with every other field null/zero/empty -- never a fabricated name, scan count,
   * or score. `search` (case-insensitive substring on participant id) is applied server-side.
   */
  public static async getMatrix(search?: string): Promise<ParticipantMatrixRow[]> {
    const allUsers = ((await ParticipantRepository.provider.getAllUsers()) as DBUser[]) || [];
    // Keyed by the authoritative participantCode (falling back to id for pre-migration rows whose
    // id itself is the code) -- NOT by id alone, since a row created via assignNewParticipant()
    // has a real random id distinct from its displayed "P001"-style code.
    const participantUsers = new Map(
      allUsers
        .filter((u) => ParticipantRepository.isParticipantUser(u))
        .map((u) => [u.participantCode || u.id, u])
    );

    const allScans = ((await ParticipantRepository.provider.getScanRecords()) as DBScanRecord[]) || [];
    const scansByUser = new Map<string, DBScanRecord[]>();
    for (const scan of allScans) {
      if (!scan.userId) continue;
      const list = scansByUser.get(scan.userId) || [];
      list.push(scan);
      scansByUser.set(scan.userId, list);
    }

    // Fetch every submission ONCE and group in memory, rather than one getSubmissionsByUserId
    // call per participant in the loop below (TARGET_PARTICIPANT_COUNT separate queries -> 1). Both storage backends
    // already support this via the 'all_users' sentinel (see supabase-storage-provider.ts /
    // UserDB.getSubmissionsByUserId).
    const allSubmissions = ((await ParticipantRepository.provider.getSubmissionsByUserId('all_users')) as DBSubmission[]) || [];
    const submissionsByUser = new Map<string, DBSubmission[]>();
    for (const submission of allSubmissions) {
      if (!submission.userId) continue;
      const list = submissionsByUser.get(submission.userId) || [];
      list.push(submission);
      submissionsByUser.set(submission.userId, list);
    }

    const rows: ParticipantMatrixRow[] = [];
    for (let i = 1; i <= TARGET_PARTICIPANT_COUNT; i++) {
      const participantId = `P${String(i).padStart(3, '0')}`;
      const user = participantUsers.get(participantId);

      if (!user) {
        rows.push({
          participantId,
          status: 'NOT_REGISTERED',
          linkedUserId: null,
          registeredAt: null,
          lastActivity: null,
          totalScans: 0,
          totalSubmissions: 0,
          frameworksUsed: [],
          latestQualityScore: null,
          totalFindings: 0,
          researchStatus: null,
        });
        continue;
      }

      // Scan/submission rows are foreign-keyed to the real User.id, not the participant code --
      // must look them up by user.id (scansByUser/submissionsByUser are keyed by that same id).
      const scans = (scansByUser.get(user.id) || []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const submissions = submissionsByUser.get(user.id) || [];

      const frameworksUsed = [...new Set(scans.map((s) => normalizeFramework(s.framework)))];
      const totalFindings = scans.reduce((acc, s) => acc + (s.ruleCount || 0), 0);

      let status: ParticipantStatus = 'REGISTERED';
      if (submissions.length > 0) status = 'SUBMITTED';
      else if (scans.length > 0) status = 'SCANNED';

      const lastActivity = [scans[0]?.createdAt, submissions[0]?.createdAt, user.lastLoginAt]
        .filter(Boolean)
        .sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0] || null;

      rows.push({
        participantId,
        status,
        linkedUserId: user.id,
        registeredAt: user.createdAt,
        lastActivity: lastActivity as string | null,
        totalScans: scans.length,
        totalSubmissions: submissions.length,
        frameworksUsed,
        latestQualityScore: scans[0]?.qualityScore ?? null,
        totalFindings,
        researchStatus: (user.researchStatus as ResearchStatus) ?? null,
      });
    }

    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      return rows.filter((r) => r.participantId.toLowerCase().includes(q));
    }
    return rows;
  }

  /** Returns null when the participant id doesn't match the expected format at all (never a
   *  fabricated detail object); returns a NOT_REGISTERED detail shape when the format is valid
   *  but no real User record exists for it. */
  public static async getDetail(participantId: string): Promise<ParticipantDetail | null> {
    if (!PARTICIPANT_ID_PATTERN.test(participantId)) return null;

    // Code-aware lookup: works for both pre-migration rows (id === code) and every row created via
    // assignNewParticipant() (id is a real random id, distinct from the displayed code).
    const user = (await ParticipantRepository.provider.findUserByParticipantCode(participantId)) as DBUser | undefined;
    if (!user) {
      return {
        participantId,
        status: 'NOT_REGISTERED',
        profile: {
          linkedUserId: null,
          accountStatus: 'NOT_REGISTERED',
          createdAt: null,
          lastActivity: null,
          researchStatus: null,
          researchAssignedAt: null,
          researchConsentVerifiedAt: null,
        },
        scanSummary: {
          totalScans: 0,
          successfulScans: 0,
          failedScans: 0,
          latestScan: null,
          averageScanTimeMs: null,
          averageQualityScore: null,
          totalFindings: 0,
        },
        frameworkUsage: [],
        ruleFindings: [],
        scanHistory: [],
        submissions: [],
        researchStudy: null,
      };
    }

    // Scan/submission rows are foreign-keyed to the real User.id, not the participant code.
    const allScans = ((await ParticipantRepository.provider.getScanRecords(user.id)) as DBScanRecord[]) || [];
    const scans = [...allScans].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const submissions = ((await ParticipantRepository.provider.getSubmissionsByUserId(user.id)) as DBSubmission[]) || [];

    // "Failed" here means the scan pipeline recorded a SYNTAX-PARSE-ERROR/TYPE_COMPILE_ERROR-only
    // result with zero real guideline findings alongside it -- there is no separate real
    // success/failure flag stored per scan, so this is the only honest signal available rather
    // than an invented boolean.
    const failedScans = scans.filter(
      (s) => s.ruleCount === 0 || (s.diagnostics || []).every((d: any) => d?.category === 'SYNTAX_ERROR')
    ).length;

    const totalScanTimeMs = scans.reduce((acc, s) => acc + (s.scanTimeMs || 0), 0);
    const totalQualityScore = scans.reduce((acc, s) => acc + (s.qualityScore ?? 0), 0);
    const totalFindings = scans.reduce((acc, s) => acc + (s.ruleCount || 0), 0);

    const frameworkCounts = new Map<string, number>();
    for (const s of scans) {
      const fw = normalizeFramework(s.framework);
      frameworkCounts.set(fw, (frameworkCounts.get(fw) || 0) + 1);
    }

    const lastActivity = [scans[0]?.createdAt, submissions[0]?.createdAt, user.lastLoginAt]
      .filter(Boolean)
      .sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0] || null;

    let status: ParticipantStatus = 'REGISTERED';
    if (submissions.length > 0) status = 'SUBMITTED';
    else if (scans.length > 0) status = 'SCANNED';

    return {
      participantId,
      status,
      profile: {
        linkedUserId: user.id,
        accountStatus: 'ACTIVE',
        createdAt: user.createdAt,
        lastActivity: lastActivity as string | null,
        researchStatus: (user.researchStatus as ResearchStatus) ?? null,
        researchAssignedAt: user.researchAssignedAt ?? null,
        researchConsentVerifiedAt: user.researchConsentVerifiedAt ?? null,
      },
      scanSummary: {
        totalScans: scans.length,
        successfulScans: scans.length - failedScans,
        failedScans,
        latestScan: scans[0]?.createdAt ?? null,
        averageScanTimeMs: scans.length > 0 ? parseFloat((totalScanTimeMs / scans.length).toFixed(2)) : null,
        averageQualityScore: scans.length > 0 ? Math.round(totalQualityScore / scans.length) : null,
        totalFindings,
      },
      frameworkUsage: [...frameworkCounts.entries()].map(([framework, count]) => ({ framework, count })),
      ruleFindings: countRuleFindings(scans),
      scanHistory: scans.map((s) => ({
        id: s.id,
        fileName: s.fileName,
        framework: s.framework,
        qualityScore: s.qualityScore,
        findingCount: s.ruleCount,
        scanTimeMs: s.scanTimeMs,
        createdAt: s.createdAt,
      })),
      submissions: submissions.map((s) => ({
        id: s.id,
        fileName: s.fileName,
        framework: s.framework,
        qualityScore: s.qualityScore,
        diagnosticsCount: s.diagnosticsCount,
        createdAt: s.createdAt,
      })),
      researchStudy: null,
    };
  }

  /** Count of real (registered) participant User rows, regardless of researchStatus. Used for the
   *  log-scan session endpoint's `totalParticipants` field -- never a fabricated/hardcoded value. */
  public static async countAssigned(): Promise<number> {
    const allUsers = ((await ParticipantRepository.provider.getAllUsers()) as DBUser[]) || [];
    return allUsers.filter((u) => ParticipantRepository.isParticipantUser(u)).length;
  }

  /**
   * The single authoritative way to mint a new participant identity, replacing the log-scan
   * route's previous client-supplied-participantId model (see the auth/authz forensic audit
   * finding on POST /api/user-study/log-scan). Creates a real User row with a normal random id
   * (never the code itself) plus a distinct, uniquely-constrained `participantCode`, and returns
   * both. Collision-safe under concurrency via create-then-retry-on-P2002 (the same pattern
   * already used by the prior ensureParticipantUser, and by UserDB.createUser's own doc comment)
   * rather than a check-then-act race.
   */
  public static async assignNewParticipant(): Promise<{ userId: string; participantCode: string }> {
    const provider = ParticipantRepository.provider;
    const maxAttempts = 8;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const allUsers = ((await provider.getAllUsers()) as DBUser[]) || [];
      const usedNumbers = new Set(
        allUsers
          .map((u) => u.participantCode || (ParticipantRepository.isParticipantUser(u) ? u.id : null))
          .filter((code): code is string => !!code && PARTICIPANT_ID_PATTERN.test(code))
          .map((code) => parseInt(code.slice(1), 10))
          .filter((n) => !Number.isNaN(n))
      );
      // Smallest unused number, not max+1: fills gaps (e.g. a revoked/never-real slot) instead of
      // growing unboundedly past any historical outlier (e.g. a very-high synthetic id left behind
      // by an unrelated concurrency test against a long-lived local test fixture).
      let nextNumber = 1;
      while (usedNumbers.has(nextNumber)) nextNumber++;
      const participantCode = `P${String(nextNumber).padStart(3, '0')}`;

      try {
        const user = await provider.createUser({
          email: `${participantCode.toLowerCase()}@user-study.figm.local`,
          passwordHash: hashPassword(`user-study-${participantCode}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`),
          fullName: `User Study Participant ${participantCode}`,
          role: 'DEVELOPER',
          participantCode,
          researchStatus: 'ASSIGNED',
          researchAssignedAt: new Date().toISOString(),
        });
        return { userId: user.id, participantCode };
      } catch (err: any) {
        // Another concurrent request took this exact number first -- re-scan and retry with a
        // fresh candidate rather than failing the whole request.
        if (err?.code === 'P2002') continue;
        throw err;
      }
    }
    throw new Error('Failed to assign a new participant code after multiple concurrent attempts.');
  }

  /**
   * ADMIN-operated only (see app/api/admin/participants/[participantId]/route.ts PATCH handler).
   * Never called automatically -- consent is verified by a human reconciling a real external Google
   * Form submission against this participant code, never fabricated in code. REVOKED marks a
   * participant assignment (e.g. confirmed QA/test contamination) as no longer able to accept
   * further research-scan writes, without touching its existing historical records.
   */
  public static async setResearchStatus(
    participantId: string,
    status: 'CONSENT_VERIFIED' | 'REVOKED'
  ): Promise<{ userId: string } | null> {
    if (!PARTICIPANT_ID_PATTERN.test(participantId)) return null;
    const provider = ParticipantRepository.provider;
    const user = (await provider.findUserByParticipantCode(participantId)) as DBUser | undefined;
    if (!user) return null;

    const updates: Partial<DBUser> = { researchStatus: status };
    if (status === 'CONSENT_VERIFIED') updates.researchConsentVerifiedAt = new Date().toISOString();
    await provider.updateUser(user.id, updates);
    return { userId: user.id };
  }

  /**
   * The ONLY safe source of scan-level data for real research analysis/exports (e.g. RQ1
   * quantitative benchmark-scan telemetry). Deliberately separate from getMatrix/getDetail, which
   * intentionally show an admin EVERY real scan for a participant slot -- including pre-consent
   * activity -- because that operational visibility is what lets a human decide whether to
   * CONSENT_VERIFIED or REVOKE a given code (see setResearchStatus's doc comment); gating that
   * view would blind admins to exactly the QA/test-contamination signal they need to act on.
   *
   * This method applies the study's actual eligibility rule instead: a scan counts as research
   * data only if its owning user is CONSENT_VERIFIED (a human researcher has reconciled a real,
   * external consent-form submission against this exact participant code) AND the scan itself was
   * created at/after that exact verification timestamp. ASSIGNED (not yet reconciled) and REVOKED
   * (confirmed contamination / no-longer-active, per setResearchStatus's doc comment) participants
   * contribute zero rows -- not a special-cased exclusion, it falls out of the single inclusion
   * rule below. A non-participant (ordinary product) user can never appear here either, since
   * isParticipantUser is checked first. Never source a real research export/analysis from
   * getMatrix/getDetail's raw totals; only from this method.
   */
  public static async getResearchDataset(): Promise<ResearchDatasetScanRow[]> {
    const provider = ParticipantRepository.provider;
    const allUsers = ((await provider.getAllUsers()) as DBUser[]) || [];
    const eligibleUsers = allUsers.filter(
      (u): u is DBUser & { researchConsentVerifiedAt: string } =>
        ParticipantRepository.isParticipantUser(u) &&
        u.researchStatus === 'CONSENT_VERIFIED' &&
        !!u.researchConsentVerifiedAt
    );
    if (eligibleUsers.length === 0) return [];

    const allScans = ((await provider.getScanRecords()) as DBScanRecord[]) || [];
    const scansByUser = new Map<string, DBScanRecord[]>();
    for (const scan of allScans) {
      if (!scan.userId) continue;
      const list = scansByUser.get(scan.userId) || [];
      list.push(scan);
      scansByUser.set(scan.userId, list);
    }

    const rows: ResearchDatasetScanRow[] = [];
    for (const user of eligibleUsers) {
      const consentAtMs = new Date(user.researchConsentVerifiedAt).getTime();
      const scans = scansByUser.get(user.id) || [];
      for (const scan of scans) {
        if (new Date(scan.createdAt).getTime() >= consentAtMs) {
          rows.push({
            participantId: user.participantCode || user.id,
            userId: user.id,
            scanId: scan.id,
            fileName: scan.fileName,
            framework: scan.framework,
            qualityScore: scan.qualityScore,
            ruleCount: scan.ruleCount,
            createdAt: scan.createdAt,
          });
        }
      }
    }

    return rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
}
