import { IStorageProvider, ScanListQuery, ScanListResult } from './storage-provider';
import {
  UserDB,
  DBUser,
  DBProject,
  DBScanRecord,
  DBScanRecordSummary,
  ScanRecordInput,
  DBNotification,
  DBSettings,
  DBAuditLog,
  DBSubmission,
  DBAiHistory,
} from '../auth/user-db';

export class JsonStorageProvider implements IStorageProvider {
  public name: 'json' = 'json';

  // Users
  findUserByEmail(email: string): DBUser | undefined {
    return UserDB.findUserByEmail(email);
  }

  findUserById(userId: string): DBUser | undefined {
    return UserDB.findUserById(userId);
  }

  findUserByResetToken(token: string): DBUser | undefined {
    return UserDB.findUserByResetToken(token);
  }

  findUserByRefreshToken(token: string): DBUser | undefined {
    return UserDB.findUserByRefreshToken(token);
  }

  findUserByParticipantCode(code: string): DBUser | undefined {
    return UserDB.findUserByParticipantCode(code);
  }

  getAllUsers(): DBUser[] {
    return UserDB.getAllUsers();
  }

  createUser(user: Omit<DBUser, 'id' | 'createdAt'>): DBUser {
    return UserDB.createUser(user);
  }

  updateUser(userId: string, updates: Partial<Omit<DBUser, 'id' | 'createdAt'>>): DBUser | undefined {
    return UserDB.updateUser(userId, updates);
  }

  deleteUser(userId: string): boolean {
    return UserDB.deleteUser(userId);
  }

  // Projects
  createProject(project: Omit<DBProject, 'id' | 'createdAt' | 'totalScans' | 'qualityScore'>): DBProject {
    return UserDB.createProject(project);
  }

  getProjects(userId?: string): DBProject[] {
    return UserDB.getProjects(userId);
  }

  getProjectById(id: string): DBProject | undefined {
    return UserDB.getProjectById(id);
  }

  updateProject(id: string, updates: Partial<Omit<DBProject, 'id' | 'createdAt'>>): DBProject | undefined {
    return UserDB.updateProject(id, updates);
  }

  duplicateProject(id: string, userId: string): DBProject | undefined {
    return UserDB.duplicateProject(id, userId);
  }

  deleteProject(id: string): boolean {
    return UserDB.deleteProject(id);
  }

  // Scan Records
  createScanRecord(scan: ScanRecordInput): DBScanRecord {
    return UserDB.createScanRecord(scan);
  }

  getScanRecords(userId?: string): DBScanRecord[] {
    return UserDB.getScanRecords(userId);
  }

  getScanRecordById(id: string): DBScanRecord | undefined {
    return UserDB.getScanRecordById(id);
  }

  toggleFavoriteScan(id: string): DBScanRecord | undefined {
    return UserDB.toggleFavoriteScan(id);
  }

  deleteScanRecord(id: string): boolean {
    return UserDB.deleteScanRecord(id);
  }

  // The JSON fallback has no real query engine, so this still filters/sorts/paginates in memory
  // (fine at the small scale this fallback is ever used at -- local dev/test only) -- but it
  // returns the SAME lightweight, diagnostics-stripped shape the Postgres-backed provider does,
  // so callers never see a different response contract depending on which provider is active.
  queryScanRecords(query: ScanListQuery): ScanListResult {
    let records = UserDB.getScanRecords(query.userId);

    if (query.projectId) {
      records = records.filter((r) => r.projectId === query.projectId);
    }

    if (query.framework && query.framework !== 'ALL') {
      const fw = query.framework.toLowerCase();
      records = records.filter((r) => {
        const itemFw = r.framework.toLowerCase();
        if (fw.includes('react') && itemFw.includes('react')) return true;
        if (fw.includes('next') && itemFw.includes('next')) return true;
        return itemFw === fw;
      });
    }

    if (query.onlyFavorites) {
      records = records.filter((r) => r.isFavorite === true);
    }

    if (query.minScore !== undefined) {
      records = records.filter((r) => r.qualityScore >= query.minScore!);
    }

    if (query.maxScore !== undefined) {
      records = records.filter((r) => r.qualityScore <= query.maxScore!);
    }

    if (query.from) {
      const fromMs = new Date(query.from).getTime();
      records = records.filter((r) => new Date(r.createdAt).getTime() >= fromMs);
    }

    if (query.to) {
      const toMs = new Date(query.to).getTime();
      records = records.filter((r) => new Date(r.createdAt).getTime() <= toMs);
    }

    if (query.search && query.search.trim() !== '') {
      const q = query.search.toLowerCase().trim();
      // Defensive against a malformed/legacy record missing one of these fields -- same class of
      // guard as ProjectRepository.getProjects's own search filter, for the same reason: one bad
      // record must never be fatal to an ADMIN's search across every user's scans.
      records = records.filter(
        (r) =>
          (r.fileName || '').toLowerCase().includes(q) ||
          (r.framework || '').toLowerCase().includes(q) ||
          (r.repositoryUrl && r.repositoryUrl.toLowerCase().includes(q))
      );
    }

    records = [...records].sort((a, b) => {
      let valA: any = (a as any)[query.sortBy];
      let valB: any = (b as any)[query.sortBy];
      valA = valA ? new Date(valA).getTime() || valA : 0;
      valB = valB ? new Date(valB).getTime() || valB : 0;
      return query.sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    const total = records.length;
    const startIndex = (query.page - 1) * query.pageSize;
    const page = records.slice(startIndex, startIndex + query.pageSize);
    const summaries: DBScanRecordSummary[] = page.map(({ diagnostics, ...rest }) => rest);

    return { records: summaries, total };
  }

  // Notifications
  createNotification(notif: Omit<DBNotification, 'id' | 'createdAt' | 'read'>): DBNotification {
    return UserDB.createNotification(notif);
  }

  getNotifications(userId: string): DBNotification[] {
    return UserDB.getNotifications(userId);
  }

  markNotificationRead(id: string): void {
    UserDB.markNotificationRead(id);
  }

  markAllNotificationsRead(userId: string): void {
    UserDB.markAllNotificationsRead(userId);
  }

  clearNotifications(userId: string): void {
    UserDB.clearNotifications(userId);
  }

  // Settings
  getUserSettings(userId: string): DBSettings {
    return UserDB.getUserSettings(userId);
  }

  updateUserSettings(userId: string, settings: Partial<Omit<DBSettings, 'userId'>>): DBSettings {
    return UserDB.updateUserSettings(userId, settings);
  }

  // Audit Logs
  addAuditLog(log: Omit<DBAuditLog, 'id' | 'createdAt'>): DBAuditLog {
    return UserDB.addAuditLog(log);
  }

  getAuditLogs(limit?: number, userId?: string): DBAuditLog[] {
    return UserDB.getAuditLogs(limit, userId);
  }

  // Submissions
  createSubmission(submission: Omit<DBSubmission, 'id' | 'createdAt'>): DBSubmission {
    return UserDB.createSubmission(submission);
  }

  getSubmissionsByUserId(userId: string): DBSubmission[] {
    return UserDB.getSubmissionsByUserId(userId);
  }

  deleteSubmission(submissionId: string, userId: string): boolean {
    return UserDB.deleteSubmission(submissionId, userId);
  }

  createAiHistoryRecord(record: Omit<DBAiHistory, 'id' | 'createdAt'>): DBAiHistory {
    return UserDB.createAiHistoryRecord(record);
  }

  getAiHistoryByUserId(userId: string): DBAiHistory[] {
    return UserDB.getAiHistoryByUserId(userId);
  }
}
