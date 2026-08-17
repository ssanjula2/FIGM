import {
  DBUser,
  DBProject,
  DBScanRecord,
  DBScanRecordSummary,
  ScanRecordInput,
  DBNotification,
  DBSettings,
  DBAuditLog,
} from '../auth/user-db';

/** Filter/sort/pagination options for the scan-history LIST view -- pushed all the way down to
 *  the storage layer so a Postgres-backed provider can do the filtering, sorting, and pagination
 *  as a real database query (WHERE/ORDER BY/LIMIT/OFFSET) instead of loading every one of a
 *  user's scan records into memory first. `page`/`pageSize` are required and must already be
 *  validated (positive integers, pageSize capped) by the caller -- this layer trusts them. */
export interface ScanListQuery {
  userId?: string;
  projectId?: string;
  search?: string;
  framework?: string;
  minScore?: number;
  maxScore?: number;
  onlyFavorites?: boolean;
  /** Inclusive lower bound on createdAt, as an ISO-8601 string. */
  from?: string;
  /** Inclusive upper bound on createdAt, as an ISO-8601 string. */
  to?: string;
  sortBy: 'createdAt' | 'qualityScore' | 'scanTimeMs' | 'memoryUsageMb' | 'ruleCount';
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface ScanListResult {
  records: DBScanRecordSummary[];
  total: number;
}

export interface IStorageProvider {
  name: 'json' | 'supabase';

  // Users
  findUserByEmail(email: string): Promise<DBUser | undefined> | DBUser | undefined;
  findUserById(userId: string): Promise<DBUser | undefined> | DBUser | undefined;
  findUserByResetToken(token: string): Promise<DBUser | undefined> | DBUser | undefined;
  findUserByRefreshToken(token: string): Promise<DBUser | undefined> | DBUser | undefined;
  getAllUsers(): Promise<DBUser[]> | DBUser[];
  createUser(user: Omit<DBUser, 'id' | 'createdAt'> & { id?: string }): Promise<DBUser> | DBUser;
  updateUser(userId: string, updates: Partial<Omit<DBUser, 'id' | 'createdAt'>>): Promise<DBUser | undefined> | DBUser | undefined;
  deleteUser(userId: string): Promise<boolean> | boolean;

  // Projects
  createProject(project: Omit<DBProject, 'id' | 'createdAt' | 'totalScans' | 'qualityScore'>): Promise<DBProject> | DBProject;
  getProjects(userId?: string): Promise<DBProject[]> | DBProject[];
  getProjectById(id: string): Promise<DBProject | undefined> | DBProject | undefined;
  updateProject(id: string, updates: Partial<Omit<DBProject, 'id' | 'createdAt'>>): Promise<DBProject | undefined> | DBProject | undefined;
  duplicateProject(id: string, userId: string): Promise<DBProject | undefined> | DBProject | undefined;
  deleteProject(id: string): Promise<boolean> | boolean;

  // Scan Records
  createScanRecord(scan: ScanRecordInput): Promise<DBScanRecord> | DBScanRecord;
  getScanRecords(userId?: string): Promise<DBScanRecord[]> | DBScanRecord[];
  getScanRecordById(id: string): Promise<DBScanRecord | undefined> | DBScanRecord | undefined;
  toggleFavoriteScan(id: string): Promise<DBScanRecord | undefined> | DBScanRecord | undefined;
  deleteScanRecord(id: string): Promise<boolean> | boolean;
  /** The scan-history LIST endpoint's real query path -- filtered, sorted, paginated, and
   *  lightweight (no `diagnostics`) at the storage layer itself. See ScanListQuery's doc comment. */
  queryScanRecords(query: ScanListQuery): Promise<ScanListResult> | ScanListResult;

  // Notifications
  createNotification(notif: Omit<DBNotification, 'id' | 'createdAt' | 'read'>): Promise<DBNotification> | DBNotification;
  getNotifications(userId: string): Promise<DBNotification[]> | DBNotification[];
  markNotificationRead(id: string): Promise<void> | void;
  markAllNotificationsRead(userId: string): Promise<void> | void;
  clearNotifications(userId: string): Promise<void> | void;

  // Settings
  getUserSettings(userId: string): Promise<DBSettings> | DBSettings;
  updateUserSettings(userId: string, settings: Partial<Omit<DBSettings, 'userId'>>): Promise<DBSettings> | DBSettings;

  // Audit Logs
  addAuditLog(log: Omit<DBAuditLog, 'id' | 'createdAt'>): Promise<DBAuditLog> | DBAuditLog;
  getAuditLogs(limit?: number): Promise<DBAuditLog[]> | DBAuditLog[];
}
