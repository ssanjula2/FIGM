import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { hashPassword, isInsecureFallbackAllowed } from './auth-service';
import { severityCountsFromDiagnostics } from '../engine/quality-score';

export type UserRole = 'ADMIN' | 'DEVELOPER' | 'AUDITOR';

export interface DBUser {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  resetToken?: string;
  resetTokenExpiry?: string;
  // `| null` (not just optional/absent) is deliberate: an update payload of `{ refreshToken:
  // undefined }` is silently ignored by Prisma's update() (undefined-valued keys are treated as
  // "field not included," not "clear this field") -- only an explicit `null` actually clears the
  // column. See app/api/auth/logout/route.ts, the one real call site that needs to clear this.
  refreshToken?: string | null;
  apiKey?: string;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface DBSubmission {
  id: string;
  userId: string;
  fileName: string;
  framework: string;
  codeContent: string;
  executionTimeMs: number;
  qualityScore: number;
  diagnosticsCount: number;
  createdAt: string;
}

export interface DBProject {
  id: string;
  userId: string;
  name: string;
  description: string;
  framework: string;
  repoUrl: string;
  status: 'ACTIVE' | 'ARCHIVED';
  qualityScore: number;
  totalScans: number;
  lastScanAt?: string;
  createdAt: string;
}

export interface DBScanRecord {
  id: string;
  userId: string;
  projectId?: string;
  fileName: string;
  framework: string;
  repositoryUrl?: string;
  scanTimeMs: number;
  memoryUsageMb: number;
  qualityScore: number;
  ruleCount: number;
  // Server-computed at persistence time (see src/engine/quality-score.ts's
  // severityCountsFromDiagnostics) -- never client-supplied, never derived from anywhere but the
  // same diagnostics array `ruleCount`/`qualityScore` themselves come from.
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  aiFixCount: number;
  diagnostics: any[];
  isFavorite?: boolean;
  createdAt: string;
}

/** The history LIST view never needs the (potentially large) `diagnostics` JSON blob -- only the
 *  single-scan detail endpoint does. Every list-returning query path returns this shape instead. */
export type DBScanRecordSummary = Omit<DBScanRecord, 'diagnostics'>;

/** What a caller provides to persist a new scan. `criticalCount`/`highCount`/`mediumCount`/
 *  `lowCount` are deliberately excluded here (alongside `id`/`createdAt`) -- like those two, they
 *  are always server-derived, computed from the SAME `diagnostics` array the caller does supply
 *  (via src/engine/quality-score.ts's severityCountsFromDiagnostics, the single canonical
 *  formula), never accepted as caller input. This means every current and future caller of
 *  createScanRecord gets correct severity counts automatically -- there is no separate step to
 *  remember or get wrong. */
export type ScanRecordInput = Omit<DBScanRecord, 'id' | 'createdAt' | 'criticalCount' | 'highCount' | 'mediumCount' | 'lowCount'>;

export interface DBNotification {
  id: string;
  userId: string;
  type: 'SCAN_SUCCESS' | 'SCAN_FAILED' | 'AI_FINISHED' | 'EXPORT_FINISHED' | 'SECURITY_ALERT';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface DBSettings {
  userId: string;
  theme: 'dark' | 'light' | 'system';
  autoSave: boolean;
  autoScan: boolean;
  aiModel: string;
  exportFormat: string;
}

export interface DBAuditLog {
  id: string;
  userId?: string;
  email?: string;
  action: 'REGISTER' | 'LOGIN' | 'LOGOUT' | 'REFRESH_TOKEN' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD' | 'ACCESS_DENIED' | 'CREATE_PROJECT' | 'DELETE_PROJECT' | 'SCAN_RUN';
  ipAddress: string;
  userAgent: string;
  status: 'SUCCESS' | 'FAILURE';
  details?: string;
  createdAt: string;
}

export interface DBUserStore {
  users: DBUser[];
  submissions: DBSubmission[];
  projects: DBProject[];
  scanRecords: DBScanRecord[];
  notifications: DBNotification[];
  settings: DBSettings[];
  auditLogs: DBAuditLog[];
}

const DB_FILE = path.resolve(process.cwd(), 'figm-user-db.json');

export interface DefaultAdminAccount {
  id: string;
  email: string;
  fullName: string;
}

export const DEFAULT_ADMIN_ACCOUNTS: DefaultAdminAccount[] = [
  { id: 'usr_admin_sanjula', email: 'sanjula@nsbm.ac.lk', fullName: 'A P H D S Sanjula (Admin)' },
  { id: 'usr_admin_figm', email: 'admin@figm.io', fullName: 'FIGM Lead System Administrator' },
];

/**
 * Resolves the password used to bootstrap the default ADMIN accounts on first boot (empty/missing
 * DB file). Previously this was the literal string 'Admin123456!', hardcoded in source and also
 * displayed on the public /login page -- anyone who ever saw the source or the login page had
 * standing admin credentials for every deployment that hadn't been manually reset. Fails closed
 * outside development/test: a production-equivalent deployment must set ADMIN_BOOTSTRAP_PASSWORD
 * itself, or no default admin account is created at all.
 */
export function resolveBootstrapAdminPassword(): string {
  const configured = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (configured && configured.length >= 12) {
    return configured;
  }

  if (!isInsecureFallbackAllowed()) {
    throw new Error(
      'FATAL: ADMIN_BOOTSTRAP_PASSWORD environment variable is missing or shorter than 12 characters. ' +
      'Refusing to seed default ADMIN accounts with a predictable password outside development/test. ' +
      'Set ADMIN_BOOTSTRAP_PASSWORD to a strong random value before first boot, or provision admin ' +
      'accounts via a secure out-of-band process instead of relying on the seeded defaults.'
    );
  }

  // Local/dev/test convenience only: a fresh random password generated once per process, never
  // written to disk or git. Printed once so a developer can actually log in locally.
  const generated = crypto.randomBytes(18).toString('base64url');
  // eslint-disable-next-line no-console
  console.error(
    `[user-db] ADMIN_BOOTSTRAP_PASSWORD is not set -- generated a one-time local admin password: ${generated}\n` +
    '[user-db] This password is not persisted anywhere and will change on next restart. Set ' +
    'ADMIN_BOOTSTRAP_PASSWORD to pin it. INSECURE outside local development/test.'
  );
  return generated;
}

function getDefaultUsers(): DBUser[] {
  const adminPass = hashPassword(resolveBootstrapAdminPassword());
  const now = new Date().toISOString();
  return DEFAULT_ADMIN_ACCOUNTS.map((account) => ({
    id: account.id,
    email: account.email,
    fullName: account.fullName,
    role: 'ADMIN' as const,
    passwordHash: adminPass,
    // Random per boot, never a fixed source-committed literal (previously 'figm_key_admin_sanjula' /
    // 'figm_key_admin_figm' -- guessable, and visible to anyone with repo access).
    apiKey: `figm_key_${crypto.randomBytes(16).toString('hex')}`,
    createdAt: now,
  }));
}

declare global {
  var _figm_db_cache: DBUserStore | undefined;
}

const TMP_DB_FILE = path.resolve('/tmp', 'figm-user-db.json');

function loadDB(): DBUserStore {
  if (globalThis._figm_db_cache) {
    return globalThis._figm_db_cache;
  }

  const targetFile = fs.existsSync(TMP_DB_FILE) ? TMP_DB_FILE : DB_FILE;
  let loadedStore: DBUserStore | null = null;
  if (fs.existsSync(targetFile)) {
    try {
      const data = fs.readFileSync(targetFile, 'utf-8');
      const parsed = JSON.parse(data);
      const scanRecords = parsed.scanRecords || [];
      const existingUsers = (parsed.users || []).map((u: Partial<DBUser>) => ({
        ...u,
        role: u.role || 'DEVELOPER',
      }));

      loadedStore = {
        users: existingUsers.length > 0 ? existingUsers : getDefaultUsers(),
        submissions: parsed.submissions || [],
        projects: parsed.projects || [],
        scanRecords,
        notifications: parsed.notifications || [],
        settings: parsed.settings || [],
        auditLogs: parsed.auditLogs || [],
      };
    } catch {
      // Fallback
    }
  }

  if (!loadedStore) {
    loadedStore = {
      users: getDefaultUsers(),
      submissions: [],
      projects: [],
      scanRecords: [],
      notifications: [],
      settings: [],
      auditLogs: [],
    };
  }

  globalThis._figm_db_cache = loadedStore;
  return loadedStore;
}

function saveDB(store: DBUserStore): void {
  globalThis._figm_db_cache = store;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch {
    try {
      fs.writeFileSync(TMP_DB_FILE, JSON.stringify(store, null, 2), 'utf-8');
    } catch {
      // Memory fallback in read-only serverless environments
    }
  }
}

export const UserDB = {
  // --- USERS ---
  findUserByEmail(email: string): DBUser | undefined {
    const db = loadDB();
    return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },

  findUserById(userId: string): DBUser | undefined {
    const db = loadDB();
    return db.users.find((u) => u.id === userId);
  },

  findUserByResetToken(token: string): DBUser | undefined {
    const db = loadDB();
    const now = Date.now();
    return db.users.find(
      (u) => u.resetToken === token && (!u.resetTokenExpiry || new Date(u.resetTokenExpiry).getTime() > now)
    );
  },

  findUserByRefreshToken(token: string): DBUser | undefined {
    const db = loadDB();
    return db.users.find((u) => u.refreshToken === token);
  },

  getAllUsers(): DBUser[] {
    const db = loadDB();
    return db.users;
  },

  createUser(user: Omit<DBUser, 'id' | 'createdAt'> & { id?: string }): DBUser {
    const db = loadDB();
    const newUser: DBUser = {
      ...user,
      id: user.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: user.email.toLowerCase(),
      passwordHash: user.passwordHash,
      fullName: user.fullName,
      role: user.role || 'DEVELOPER',
      // NEW-01: was `Date.now()_${Math.random()...}` -- guessable, non-cryptographic randomness
      // for a live, usable API key. Matches the admin-bootstrap path's already-correct pattern
      // above (line 187).
      apiKey: `figm_key_${crypto.randomBytes(16).toString('hex')}`,
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    saveDB(db);

    // Sync new user to Supabase Cloud Database
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && key) {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(url, key, { auth: { persistSession: false } });
        supabase.from('users').upsert({
          id: newUser.id,
          email: newUser.email,
          password_hash: newUser.passwordHash,
          full_name: newUser.fullName,
          role: newUser.role,
          api_key: newUser.apiKey,
          created_at: newUser.createdAt,
          updated_at: newUser.createdAt,
        }).then();
      }
    } catch {}

    return newUser;
  },

  updateUser(userId: string, updates: Partial<Omit<DBUser, 'id' | 'createdAt'>>): DBUser | undefined {
    const db = loadDB();
    const index = db.users.findIndex((u) => u.id === userId);
    if (index === -1) return undefined;

    const updatedUser = {
      ...db.users[index],
      ...updates,
    };
    db.users[index] = updatedUser;
    saveDB(db);

    // Sync user updates to Supabase Cloud Database
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && key) {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(url, key, { auth: { persistSession: false } });
        supabase.from('users').update({
          full_name: updatedUser.fullName,
          role: updatedUser.role,
          refresh_token: updatedUser.refreshToken,
          last_login_at: updatedUser.lastLoginAt,
          updated_at: new Date().toISOString(),
        }).eq('id', userId).then();
      }
    } catch {}

    return updatedUser;
  },

  deleteUser(userId: string): boolean {
    const db = loadDB();
    const initialLength = db.users.length;
    db.users = db.users.filter((u) => u.id !== userId);
    db.projects = db.projects.filter((p) => p.userId !== userId);
    db.scanRecords = db.scanRecords.filter((s) => s.userId !== userId);
    db.notifications = db.notifications.filter((n) => n.userId !== userId);
    db.settings = db.settings.filter((s) => s.userId !== userId);
    db.submissions = db.submissions.filter((sub) => sub.userId !== userId);
    saveDB(db);
    return true;
  },

  // --- PROJECTS ---
  createProject(project: Omit<DBProject, 'id' | 'createdAt' | 'totalScans' | 'qualityScore'>): DBProject {
    const db = loadDB();
    const newProj: DBProject = {
      ...project,
      id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      qualityScore: 100,
      totalScans: 0,
      createdAt: new Date().toISOString(),
    };
    db.projects.push(newProj);
    saveDB(db);
    return newProj;
  },

  getProjects(userId?: string): DBProject[] {
    const db = loadDB();
    if (!userId) return db.projects;
    return db.projects.filter((p) => p.userId === userId);
  },

  getProjectById(id: string): DBProject | undefined {
    const db = loadDB();
    return db.projects.find((p) => p.id === id);
  },

  updateProject(id: string, updates: Partial<Omit<DBProject, 'id' | 'createdAt'>>): DBProject | undefined {
    const db = loadDB();
    const idx = db.projects.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    db.projects[idx] = { ...db.projects[idx], ...updates };
    saveDB(db);
    return db.projects[idx];
  },

  duplicateProject(id: string, userId?: string): DBProject | undefined {
    const original = UserDB.getProjectById(id);
    if (!original) return undefined;

    return UserDB.createProject({
      userId: userId || original.userId,
      name: `${original.name} (Copy)`,
      description: original.description,
      framework: original.framework,
      repoUrl: original.repoUrl,
      status: original.status,
    });
  },

  deleteProject(id: string): boolean {
    const db = loadDB();
    const initLen = db.projects.length;
    db.projects = db.projects.filter((p) => p.id !== id);
    saveDB(db);
    return db.projects.length !== initLen;
  },

  // --- SCAN RECORDS ---
  createScanRecord(scan: ScanRecordInput): DBScanRecord {
    const db = loadDB();
    const newScan: DBScanRecord = {
      ...scan,
      ...severityCountsFromDiagnostics(scan.diagnostics || []),
      id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    db.scanRecords.push(newScan);

    // Update project stats if associated
    if (scan.projectId) {
      const projIndex = db.projects.findIndex((p) => p.id === scan.projectId);
      if (projIndex !== -1) {
        db.projects[projIndex].totalScans += 1;
        db.projects[projIndex].qualityScore = scan.qualityScore;
        db.projects[projIndex].lastScanAt = newScan.createdAt;
      }
    }

    saveDB(db);

    // Asynchronously sync new scan report to Supabase Cloud Database
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && key) {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(url, key, { auth: { persistSession: false } });
        supabase.from('scan_reports').insert({
          id: newScan.id,
          user_id: newScan.userId,
          project_id: newScan.projectId,
          file_name: newScan.fileName,
          framework: newScan.framework,
          scan_time_ms: newScan.scanTimeMs,
          memory_usage_mb: newScan.memoryUsageMb,
          quality_score: newScan.qualityScore,
          rule_count: newScan.ruleCount,
          critical_count: newScan.criticalCount,
          high_count: newScan.highCount,
          medium_count: newScan.mediumCount,
          low_count: newScan.lowCount,
          ai_fix_count: newScan.aiFixCount,
          diagnostics: newScan.diagnostics,
          is_favorite: newScan.isFavorite,
          created_at: newScan.createdAt,
        }).then();
      }
    } catch {}

    return newScan;
  },

  getScanRecords(userId?: string): DBScanRecord[] {
    const db = loadDB();
    if (!userId) return db.scanRecords;
    return db.scanRecords.filter((s) => s.userId === userId);
  },

  getScanRecordById(id: string): DBScanRecord | undefined {
    const db = loadDB();
    return db.scanRecords.find((s) => s.id === id);
  },

  toggleFavoriteScan(id: string): DBScanRecord | undefined {
    const db = loadDB();
    const idx = db.scanRecords.findIndex((s) => s.id === id);
    if (idx !== -1) {
      db.scanRecords[idx].isFavorite = !db.scanRecords[idx].isFavorite;
      saveDB(db);
      return db.scanRecords[idx];
    }
    return undefined;
  },

  deleteScanRecord(id: string): boolean {
    const db = loadDB();
    const initLen = db.scanRecords.length;
    db.scanRecords = db.scanRecords.filter((s) => s.id !== id);
    if (db.scanRecords.length !== initLen) {
      saveDB(db);
      return true;
    }
    return false;
  },

  // --- NOTIFICATIONS ---
  createNotification(notif: Omit<DBNotification, 'id' | 'createdAt' | 'read'>): DBNotification {
    const db = loadDB();
    const newNotif: DBNotification = {
      ...notif,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    db.notifications.push(newNotif);
    saveDB(db);
    return newNotif;
  },

  getNotifications(userId: string): DBNotification[] {
    const db = loadDB();
    return db.notifications.filter((n) => n.userId === userId).reverse();
  },

  markNotificationRead(id: string): void {
    const db = loadDB();
    const idx = db.notifications.findIndex((n) => n.id === id);
    if (idx !== -1) {
      db.notifications[idx].read = true;
      saveDB(db);
    }
  },

  markAllNotificationsRead(userId: string): void {
    const db = loadDB();
    db.notifications.forEach((n) => {
      if (n.userId === userId) {
        n.read = true;
      }
    });
    saveDB(db);
  },

  clearNotifications(userId: string): void {
    const db = loadDB();
    db.notifications = db.notifications.filter((n) => n.userId !== userId);
    saveDB(db);
  },

  // --- SETTINGS ---
  getUserSettings(userId: string): DBSettings {
    const db = loadDB();
    const found = db.settings.find((s) => s.userId === userId);
    if (found) return found;
    return {
      userId,
      theme: 'dark',
      autoSave: true,
      autoScan: true,
      aiModel: 'gemini-2.5-flash',
      exportFormat: 'PDF',
    };
  },

  updateUserSettings(userId: string, settings: Partial<Omit<DBSettings, 'userId'>>): DBSettings {
    const db = loadDB();
    const idx = db.settings.findIndex((s) => s.userId === userId);
    const existing = this.getUserSettings(userId);
    const updated = { ...existing, ...settings };
    if (idx !== -1) {
      db.settings[idx] = updated;
    } else {
      db.settings.push(updated);
    }
    saveDB(db);
    return updated;
  },

  // --- SUBMISSIONS (Legacy compatibility) ---
  createSubmission(submission: Omit<DBSubmission, 'id' | 'createdAt'>): DBSubmission {
    const db = loadDB();
    const newSubmission: DBSubmission = {
      ...submission,
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    db.submissions.push(newSubmission);
    saveDB(db);
    return newSubmission;
  },

  getSubmissionsByUserId(userId: string): DBSubmission[] {
    const db = loadDB();
    if (userId === 'all_users') return db.submissions;
    return db.submissions.filter((s) => s.userId === userId);
  },

  getSubmissionById(submissionId: string, userId: string): DBSubmission | undefined {
    const db = loadDB();
    return db.submissions.find((s) => s.id === submissionId && s.userId === userId);
  },

  // --- AUDIT LOGS ---
  addAuditLog(log: Omit<DBAuditLog, 'id' | 'createdAt'>): DBAuditLog {
    const db = loadDB();
    const newLog: DBAuditLog = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    db.auditLogs.push(newLog);
    if (db.auditLogs.length > 1000) {
      db.auditLogs = db.auditLogs.slice(db.auditLogs.length - 1000);
    }
    saveDB(db);
    return newLog;
  },

  getAuditLogs(limit = 100): DBAuditLog[] {
    const db = loadDB();
    return db.auditLogs.slice(-limit).reverse();
  },
};
