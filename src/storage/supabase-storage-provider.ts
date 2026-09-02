import crypto from 'node:crypto';
import { IStorageProvider, ScanListQuery, ScanListResult } from './storage-provider';
import { JsonStorageProvider } from './json-storage-provider';
import { getPrismaClient } from '../db/prisma-client';
import {
  DBUser,
  DBProject,
  DBScanRecord,
  DBScanRecordSummary,
  ScanRecordInput,
  DBNotification,
  DBSettings,
  DBAuditLog,
  DBSubmission,
} from '../auth/user-db';
import { severityCountsFromDiagnostics } from '../engine/quality-score';

function toIso(d: Date | null | undefined): string | undefined {
  return d ? d.toISOString() : undefined;
}

function mapUser(u: any): DBUser {
  return {
    id: u.id,
    email: u.email,
    passwordHash: u.passwordHash,
    fullName: u.fullName,
    role: u.role,
    resetToken: u.resetToken ?? undefined,
    resetTokenExpiry: toIso(u.resetTokenExpiry),
    refreshToken: u.refreshToken ?? undefined,
    apiKey: u.apiKey ?? undefined,
    avatarUrl: u.avatarUrl ?? undefined,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: toIso(u.lastLoginAt),
    participantCode: u.participantCode ?? undefined,
    researchStatus: u.researchStatus ?? undefined,
    researchAssignedAt: toIso(u.researchAssignedAt),
    researchConsentVerifiedAt: toIso(u.researchConsentVerifiedAt),
  };
}

function mapProject(p: any): DBProject {
  return {
    id: p.id,
    userId: p.userId,
    name: p.name,
    description: p.description,
    framework: p.framework,
    repoUrl: p.repoUrl,
    status: p.status,
    qualityScore: p.qualityScore,
    totalScans: p.totalScans,
    lastScanAt: toIso(p.lastScanAt),
    createdAt: p.createdAt.toISOString(),
  };
}

function mapScan(s: any): DBScanRecord {
  return {
    id: s.id,
    userId: s.userId,
    projectId: s.projectId ?? undefined,
    fileName: s.fileName,
    framework: s.framework,
    repositoryUrl: s.repositoryUrl,
    scanTimeMs: s.scanTimeMs,
    memoryUsageMb: s.memoryUsageMb,
    qualityScore: s.qualityScore,
    ruleCount: s.ruleCount,
    criticalCount: s.criticalCount ?? 0,
    highCount: s.highCount ?? 0,
    mediumCount: s.mediumCount ?? 0,
    lowCount: s.lowCount ?? 0,
    aiFixCount: s.aiFixCount,
    diagnostics: (s.diagnostics as any[]) || [],
    isFavorite: s.isFavorite,
    createdAt: s.createdAt.toISOString(),
  };
}

/** Same shape as mapScan but for rows fetched with `diagnostics` excluded from `select` -- kept
 *  as a separate function (rather than mapScan(s) then deleting the key) so a `select` that
 *  genuinely never asked Postgres for the diagnostics column can never accidentally reference it. */
function mapScanSummary(s: any): DBScanRecordSummary {
  return {
    id: s.id,
    userId: s.userId,
    projectId: s.projectId ?? undefined,
    fileName: s.fileName,
    framework: s.framework,
    repositoryUrl: s.repositoryUrl,
    scanTimeMs: s.scanTimeMs,
    memoryUsageMb: s.memoryUsageMb,
    qualityScore: s.qualityScore,
    ruleCount: s.ruleCount,
    criticalCount: s.criticalCount ?? 0,
    highCount: s.highCount ?? 0,
    mediumCount: s.mediumCount ?? 0,
    lowCount: s.lowCount ?? 0,
    aiFixCount: s.aiFixCount,
    isFavorite: s.isFavorite,
    createdAt: s.createdAt.toISOString(),
  };
}

/** Builds a real Prisma `where` clause for the scan-history list query -- the framework
 *  special-casing (react/next substring matches) mirrors the legacy in-memory filter's semantics
 *  exactly, so switching a deployment from the JSON fallback to Postgres never changes what a
 *  given filter returns. */
function buildScanWhere(query: ScanListQuery): Record<string, any> {
  const where: Record<string, any> = {};
  if (query.userId) where.userId = query.userId;
  if (query.projectId) where.projectId = query.projectId;
  if (query.onlyFavorites) where.isFavorite = true;

  if (query.framework && query.framework !== 'ALL') {
    const fw = query.framework.toLowerCase();
    if (fw.includes('react')) where.framework = { contains: 'react', mode: 'insensitive' };
    else if (fw.includes('next')) where.framework = { contains: 'next', mode: 'insensitive' };
    else where.framework = { equals: query.framework, mode: 'insensitive' };
  }

  if (query.minScore !== undefined || query.maxScore !== undefined) {
    where.qualityScore = {};
    if (query.minScore !== undefined) where.qualityScore.gte = query.minScore;
    if (query.maxScore !== undefined) where.qualityScore.lte = query.maxScore;
  }

  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = new Date(query.from);
    if (query.to) where.createdAt.lte = new Date(query.to);
  }

  if (query.search && query.search.trim() !== '') {
    const q = query.search.trim();
    where.OR = [
      { fileName: { contains: q, mode: 'insensitive' } },
      { framework: { contains: q, mode: 'insensitive' } },
      { repositoryUrl: { contains: q, mode: 'insensitive' } },
    ];
  }

  return where;
}

const SCAN_SUMMARY_SELECT = {
  id: true,
  userId: true,
  projectId: true,
  fileName: true,
  framework: true,
  repositoryUrl: true,
  scanTimeMs: true,
  memoryUsageMb: true,
  qualityScore: true,
  ruleCount: true,
  criticalCount: true,
  highCount: true,
  mediumCount: true,
  lowCount: true,
  aiFixCount: true,
  isFavorite: true,
  createdAt: true,
  // `diagnostics` deliberately omitted -- this is the list-view query, see ScanListQuery's doc
  // comment. Postgres never even reads/transfers that column for this query.
};

function mapNotification(n: any): DBNotification {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

function mapSettings(s: any): DBSettings {
  return {
    userId: s.userId,
    theme: s.theme,
    autoSave: s.autoSave,
    autoScan: s.autoScan,
    aiModel: s.aiModel,
    exportFormat: s.exportFormat,
  };
}

function mapSubmission(s: any): DBSubmission {
  return {
    id: s.id,
    userId: s.userId,
    fileName: s.fileName,
    framework: s.framework,
    codeContent: s.codeContent,
    executionTimeMs: s.executionTimeMs,
    qualityScore: s.qualityScore,
    diagnosticsCount: s.diagnosticsCount,
    createdAt: s.createdAt.toISOString(),
  };
}

function mapAuditLog(a: any): DBAuditLog {
  return {
    id: a.id,
    userId: a.userId ?? undefined,
    email: a.email ?? undefined,
    action: a.action,
    ipAddress: a.ipAddress,
    userAgent: a.userAgent,
    status: a.status,
    details: a.details ?? undefined,
    createdAt: a.createdAt.toISOString(),
  };
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/** Returns true (record not found) for Prisma's "no record" errors, rethrows anything else. */
function isNotFoundError(err: any): boolean {
  return err?.code === 'P2025';
}

/**
 * Real Postgres-backed storage provider (via Prisma, targeting the Supabase-hosted database
 * configured by DATABASE_URL/DIRECT_URL). Falls back to JsonStorageProvider ONLY when Prisma
 * cannot be initialized (e.g. DATABASE_URL missing/unreachable) -- and that fallback is logged
 * loudly exactly once per process so it can never silently masquerade as a live DB connection.
 */
export class SupabaseStorageProvider implements IStorageProvider {
  public name: 'supabase' = 'supabase';
  private prisma: any = null;
  private fallback: JsonStorageProvider | null = null;
  private fallbackWarned = false;

  constructor() {
    this.prisma = getPrismaClient();
    if (!this.prisma) {
      this.fallback = new JsonStorageProvider();
      this.warnFallback();
    }
  }

  private warnFallback(): void {
    if (!this.fallbackWarned) {
      this.fallbackWarned = true;
      // eslint-disable-next-line no-console
      console.error(
        '[SupabaseStorageProvider] Postgres/Prisma client unavailable (DATABASE_URL missing or unreachable). ' +
        'Falling back to local JSON file storage (figm-user-db.json). This is NOT the production database.'
      );
    }
  }

  public isConnected(): boolean {
    return this.prisma !== null;
  }

  private db(): any {
    if (!this.prisma) {
      this.warnFallback();
      throw new Error('SupabaseStorageProvider: no Prisma connection and no fallback path for this call');
    }
    return this.prisma;
  }

  // --- USERS ---
  async findUserByEmail(email: string): Promise<DBUser | undefined> {
    if (!this.prisma) return this.fallback!.findUserByEmail(email);
    const u = await this.db().user.findUnique({ where: { email: email.toLowerCase() } });
    return u ? mapUser(u) : undefined;
  }

  async findUserById(userId: string): Promise<DBUser | undefined> {
    if (!this.prisma) return this.fallback!.findUserById(userId);
    const u = await this.db().user.findUnique({ where: { id: userId } });
    return u ? mapUser(u) : undefined;
  }

  async findUserByResetToken(token: string): Promise<DBUser | undefined> {
    if (!this.prisma) return this.fallback!.findUserByResetToken(token);
    const u = await this.db().user.findFirst({
      where: { resetToken: token, OR: [{ resetTokenExpiry: null }, { resetTokenExpiry: { gt: new Date() } }] },
    });
    return u ? mapUser(u) : undefined;
  }

  async findUserByRefreshToken(token: string): Promise<DBUser | undefined> {
    if (!this.prisma) return this.fallback!.findUserByRefreshToken(token);
    const u = await this.db().user.findFirst({ where: { refreshToken: token } });
    return u ? mapUser(u) : undefined;
  }

  /** Checks `participantCode` first (authoritative for every row created after that field
   *  existed) and falls back to `id` (pre-migration rows whose id itself is the P-shaped code). */
  async findUserByParticipantCode(code: string): Promise<DBUser | undefined> {
    if (!this.prisma) return this.fallback!.findUserByParticipantCode(code);
    const u = await this.db().user.findFirst({ where: { OR: [{ participantCode: code }, { id: code }] } });
    return u ? mapUser(u) : undefined;
  }

  async getAllUsers(): Promise<DBUser[]> {
    if (!this.prisma) return this.fallback!.getAllUsers();
    const users = await this.db().user.findMany({ orderBy: { createdAt: 'asc' } });
    return users.map(mapUser);
  }

  async createUser(user: Omit<DBUser, 'id' | 'createdAt'> & { id?: string }): Promise<DBUser> {
    if (!this.prisma) return this.fallback!.createUser(user);
    const created = await this.db().user.create({
      data: {
        ...(user.id ? { id: user.id } : {}),
        email: user.email.toLowerCase(),
        passwordHash: user.passwordHash,
        fullName: user.fullName,
        role: (user.role || 'DEVELOPER') as any,
        apiKey: user.apiKey || genId('figm_key'),
        resetToken: user.resetToken,
        resetTokenExpiry: user.resetTokenExpiry ? new Date(user.resetTokenExpiry) : null,
        refreshToken: user.refreshToken,
        avatarUrl: user.avatarUrl,
        lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
        participantCode: user.participantCode,
        researchStatus: (user.researchStatus as any) ?? undefined,
        researchAssignedAt: user.researchAssignedAt ? new Date(user.researchAssignedAt) : undefined,
        researchConsentVerifiedAt: user.researchConsentVerifiedAt ? new Date(user.researchConsentVerifiedAt) : undefined,
      },
    });
    return mapUser(created);
  }

  async updateUser(userId: string, updates: Partial<Omit<DBUser, 'id' | 'createdAt'>>): Promise<DBUser | undefined> {
    if (!this.prisma) return this.fallback!.updateUser(userId, updates);
    try {
      const data: any = { ...updates };
      if ('resetTokenExpiry' in updates) data.resetTokenExpiry = updates.resetTokenExpiry ? new Date(updates.resetTokenExpiry) : null;
      if ('lastLoginAt' in updates) data.lastLoginAt = updates.lastLoginAt ? new Date(updates.lastLoginAt) : null;
      if ('researchAssignedAt' in updates) data.researchAssignedAt = updates.researchAssignedAt ? new Date(updates.researchAssignedAt) : null;
      if ('researchConsentVerifiedAt' in updates) data.researchConsentVerifiedAt = updates.researchConsentVerifiedAt ? new Date(updates.researchConsentVerifiedAt) : null;
      const updated = await this.db().user.update({ where: { id: userId }, data });
      return mapUser(updated);
    } catch (err: any) {
      if (isNotFoundError(err)) return undefined;
      throw err;
    }
  }

  async deleteUser(userId: string): Promise<boolean> {
    if (!this.prisma) return this.fallback!.deleteUser(userId);
    try {
      await this.db().user.delete({ where: { id: userId } });
      return true;
    } catch (err: any) {
      if (isNotFoundError(err)) return false;
      throw err;
    }
  }

  // --- PROJECTS ---
  async createProject(project: Omit<DBProject, 'id' | 'createdAt' | 'totalScans' | 'qualityScore'>): Promise<DBProject> {
    if (!this.prisma) return this.fallback!.createProject(project);
    const created = await this.db().project.create({
      data: {
        userId: project.userId,
        name: project.name,
        description: project.description,
        framework: project.framework,
        repoUrl: project.repoUrl,
        status: (project.status || 'ACTIVE') as any,
      },
    });
    return mapProject(created);
  }

  async getProjects(userId?: string): Promise<DBProject[]> {
    if (!this.prisma) return this.fallback!.getProjects(userId);
    const projects = await this.db().project.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return projects.map(mapProject);
  }

  async getProjectById(id: string): Promise<DBProject | undefined> {
    if (!this.prisma) return this.fallback!.getProjectById(id);
    const p = await this.db().project.findUnique({ where: { id } });
    return p ? mapProject(p) : undefined;
  }

  async updateProject(id: string, updates: Partial<Omit<DBProject, 'id' | 'createdAt'>>): Promise<DBProject | undefined> {
    if (!this.prisma) return this.fallback!.updateProject(id, updates);
    try {
      const data: any = { ...updates };
      if ('lastScanAt' in updates) data.lastScanAt = updates.lastScanAt ? new Date(updates.lastScanAt) : null;
      const updated = await this.db().project.update({ where: { id }, data });
      return mapProject(updated);
    } catch (err: any) {
      if (isNotFoundError(err)) return undefined;
      throw err;
    }
  }

  async duplicateProject(id: string, userId: string): Promise<DBProject | undefined> {
    if (!this.prisma) return this.fallback!.duplicateProject(id, userId);
    const original = await this.getProjectById(id);
    if (!original) return undefined;
    return this.createProject({
      userId: userId || original.userId,
      name: `${original.name} (Copy)`,
      description: original.description,
      framework: original.framework,
      repoUrl: original.repoUrl,
      status: original.status,
    });
  }

  async deleteProject(id: string): Promise<boolean> {
    if (!this.prisma) return this.fallback!.deleteProject(id);
    try {
      await this.db().project.delete({ where: { id } });
      return true;
    } catch (err: any) {
      if (isNotFoundError(err)) return false;
      throw err;
    }
  }

  // --- SCAN RECORDS ---
  async createScanRecord(scan: ScanRecordInput): Promise<DBScanRecord> {
    if (!this.prisma) return this.fallback!.createScanRecord(scan);
    const severity = severityCountsFromDiagnostics(scan.diagnostics || []);
    const created = await this.db().scanReport.create({
      data: {
        userId: scan.userId,
        projectId: scan.projectId || null,
        fileName: scan.fileName,
        framework: scan.framework,
        repositoryUrl: scan.repositoryUrl || 'Local Repository',
        scanTimeMs: scan.scanTimeMs,
        memoryUsageMb: scan.memoryUsageMb,
        qualityScore: scan.qualityScore,
        ruleCount: scan.ruleCount,
        criticalCount: severity.criticalCount,
        highCount: severity.highCount,
        mediumCount: severity.mediumCount,
        lowCount: severity.lowCount,
        aiFixCount: scan.aiFixCount,
        diagnostics: (scan.diagnostics || []) as any,
        isFavorite: scan.isFavorite || false,
      },
    });
    if (scan.projectId) {
      try {
        await this.db().project.update({
          where: { id: scan.projectId },
          data: { totalScans: { increment: 1 }, qualityScore: scan.qualityScore, lastScanAt: created.createdAt },
        });
      } catch (err: any) {
        if (!isNotFoundError(err)) throw err;
      }
    }
    return mapScan(created);
  }

  async getScanRecords(userId?: string): Promise<DBScanRecord[]> {
    if (!this.prisma) return this.fallback!.getScanRecords(userId);
    const scans = await this.db().scanReport.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return scans.map(mapScan);
  }

  async queryScanRecords(query: ScanListQuery): Promise<ScanListResult> {
    if (!this.prisma) return this.fallback!.queryScanRecords(query);
    const where = buildScanWhere(query);
    const [rows, total] = await Promise.all([
      this.db().scanReport.findMany({
        where,
        select: SCAN_SUMMARY_SELECT,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db().scanReport.count({ where }),
    ]);
    return { records: rows.map(mapScanSummary), total };
  }

  async getScanRecordById(id: string): Promise<DBScanRecord | undefined> {
    if (!this.prisma) return this.fallback!.getScanRecordById(id);
    const s = await this.db().scanReport.findUnique({ where: { id } });
    return s ? mapScan(s) : undefined;
  }

  async toggleFavoriteScan(id: string): Promise<DBScanRecord | undefined> {
    if (!this.prisma) return this.fallback!.toggleFavoriteScan(id);
    const existing = await this.db().scanReport.findUnique({ where: { id } });
    if (!existing) return undefined;
    const updated = await this.db().scanReport.update({ where: { id }, data: { isFavorite: !existing.isFavorite } });
    return mapScan(updated);
  }

  async deleteScanRecord(id: string): Promise<boolean> {
    if (!this.prisma) return this.fallback!.deleteScanRecord(id);
    try {
      await this.db().scanReport.delete({ where: { id } });
      return true;
    } catch (err: any) {
      if (isNotFoundError(err)) return false;
      throw err;
    }
  }

  // --- NOTIFICATIONS ---
  async createNotification(notif: Omit<DBNotification, 'id' | 'createdAt' | 'read'>): Promise<DBNotification> {
    if (!this.prisma) return this.fallback!.createNotification(notif);
    const created = await this.db().notification.create({
      data: {
        userId: notif.userId,
        type: notif.type as any,
        title: notif.title,
        message: notif.message,
      },
    });
    return mapNotification(created);
  }

  async getNotifications(userId: string): Promise<DBNotification[]> {
    if (!this.prisma) return this.fallback!.getNotifications(userId);
    const notifs = await this.db().notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    return notifs.map(mapNotification);
  }

  async markNotificationRead(id: string): Promise<void> {
    if (!this.prisma) return this.fallback!.markNotificationRead(id);
    try {
      await this.db().notification.update({ where: { id }, data: { read: true } });
    } catch (err: any) {
      if (!isNotFoundError(err)) throw err;
    }
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    if (!this.prisma) return this.fallback!.markAllNotificationsRead(userId);
    await this.db().notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  }

  async clearNotifications(userId: string): Promise<void> {
    if (!this.prisma) return this.fallback!.clearNotifications(userId);
    await this.db().notification.deleteMany({ where: { userId } });
  }

  // --- SETTINGS ---
  async getUserSettings(userId: string): Promise<DBSettings> {
    if (!this.prisma) return this.fallback!.getUserSettings(userId);
    const found = await this.db().settings.findUnique({ where: { userId } });
    if (found) return mapSettings(found);
    return {
      userId,
      theme: 'dark',
      autoSave: true,
      autoScan: true,
      aiModel: 'claude-opus-5',
      exportFormat: 'PDF',
    };
  }

  async updateUserSettings(userId: string, settings: Partial<Omit<DBSettings, 'userId'>>): Promise<DBSettings> {
    if (!this.prisma) return this.fallback!.updateUserSettings(userId, settings);
    const current = await this.getUserSettings(userId);
    const merged = { ...current, ...settings };
    const updated = await this.db().settings.upsert({
      where: { userId },
      create: {
        userId,
        theme: merged.theme,
        autoSave: merged.autoSave,
        autoScan: merged.autoScan,
        aiModel: merged.aiModel,
        exportFormat: merged.exportFormat as any,
      },
      update: {
        theme: settings.theme,
        autoSave: settings.autoSave,
        autoScan: settings.autoScan,
        aiModel: settings.aiModel,
        exportFormat: settings.exportFormat as any,
      },
    });
    return mapSettings(updated);
  }

  // --- AUDIT LOGS ---
  async addAuditLog(log: Omit<DBAuditLog, 'id' | 'createdAt'>): Promise<DBAuditLog> {
    if (!this.prisma) return this.fallback!.addAuditLog(log);
    const created = await this.db().auditLog.create({
      data: {
        userId: log.userId || null,
        email: log.email || null,
        action: log.action as any,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        status: log.status || 'SUCCESS',
        details: log.details,
      },
    });
    return mapAuditLog(created);
  }

  async getAuditLogs(limit = 100): Promise<DBAuditLog[]> {
    if (!this.prisma) return this.fallback!.getAuditLogs(limit);
    const logs = await this.db().auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
    return logs.map(mapAuditLog);
  }

  // --- SUBMISSIONS ---
  async createSubmission(submission: Omit<DBSubmission, 'id' | 'createdAt'>): Promise<DBSubmission> {
    if (!this.prisma) return this.fallback!.createSubmission(submission);
    const created = await this.db().submission.create({
      data: {
        userId: submission.userId,
        fileName: submission.fileName,
        framework: submission.framework,
        codeContent: submission.codeContent,
        executionTimeMs: submission.executionTimeMs,
        qualityScore: submission.qualityScore,
        diagnosticsCount: submission.diagnosticsCount,
      },
    });
    return mapSubmission(created);
  }

  async getSubmissionsByUserId(userId: string): Promise<DBSubmission[]> {
    if (!this.prisma) return this.fallback!.getSubmissionsByUserId(userId);
    const submissions = await this.db().submission.findMany({
      where: userId === 'all_users' ? undefined : { userId },
      orderBy: { createdAt: 'desc' },
    });
    return submissions.map(mapSubmission);
  }

  async deleteSubmission(submissionId: string, userId: string): Promise<boolean> {
    if (!this.prisma) return this.fallback!.deleteSubmission(submissionId, userId);
    // Ownership-checked delete, same pattern as deleteScanRecord's caller-side checks elsewhere --
    // deleteMany's count tells us whether a row matching BOTH id and owner actually existed,
    // without a separate read-then-delete round trip.
    const result = await this.db().submission.deleteMany({ where: { id: submissionId, userId } });
    return result.count > 0;
  }
}
