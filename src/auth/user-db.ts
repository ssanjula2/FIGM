import fs from 'node:fs';
import path from 'node:path';

export type UserRole = 'ADMIN' | 'DEVELOPER' | 'AUDITOR';

export interface DBUser {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  resetToken?: string;
  resetTokenExpiry?: string;
  refreshToken?: string;
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
  aiFixCount: number;
  diagnostics: any[];
  isFavorite?: boolean;
  createdAt: string;
}

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

function getDefaultScanRecords(): DBScanRecord[] {
  return [
    {
      id: 'scn_default_01',
      userId: 'usr_developer_default',
      projectId: 'proj_1786005070498_vbbyi',
      fileName: 'DashboardPage.tsx',
      framework: 'Next.js',
      qualityScore: 88,
      scanTimeMs: 7.14,
      memoryUsageMb: 1.52,
      ruleCount: 3,
      aiFixCount: 1,
      isFavorite: true,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      diagnostics: [
        {
          ruleId: 'FIGM-PERF-01',
          ruleName: 'Invariant Object Allocation in Iteration Scopes',
          domain: 'PERFORMANCE',
          concern: 'INVARIANT_ALLOCATIONS',
          severity: 'HIGH',
          filePath: 'DashboardPage.tsx',
          location: { start: { line: 10, column: 24 } },
          offendingCodeSnippet: 'const defaultMeta = { status: "active", tier: "premium" };',
          remediation: 'Hoist invariant object out of iteration scope.',
          standardReference: 'FIGM-PERF-01',
        },
      ],
    },
    {
      id: 'scn_default_02',
      userId: 'usr_developer_default',
      projectId: 'proj_1786005070498_vbbyi',
      fileName: 'UserProfile.jsx',
      framework: 'React',
      qualityScore: 92,
      scanTimeMs: 5.82,
      memoryUsageMb: 1.28,
      ruleCount: 2,
      aiFixCount: 1,
      isFavorite: true,
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      diagnostics: [],
    },
    {
      id: 'scn_default_03',
      userId: 'usr_developer_default',
      projectId: 'proj_1786005070501_1u7hd',
      fileName: 'SearchPanel.component.ts',
      framework: 'Angular',
      qualityScore: 84,
      scanTimeMs: 9.45,
      memoryUsageMb: 2.15,
      ruleCount: 4,
      aiFixCount: 2,
      isFavorite: false,
      createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      diagnostics: [],
    },
    {
      id: 'scn_default_04',
      userId: 'usr_developer_default',
      projectId: 'proj_1786005070501_1u7hd',
      fileName: 'AnalyticsCard.vue',
      framework: 'Vue',
      qualityScore: 95,
      scanTimeMs: 4.12,
      memoryUsageMb: 0.98,
      ruleCount: 1,
      aiFixCount: 0,
      isFavorite: false,
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      diagnostics: [],
    },
    {
      id: 'scn_default_05',
      userId: 'usr_developer_default',
      projectId: 'proj_1786005070498_vbbyi',
      fileName: 'HeaderBar.tsx',
      framework: 'Next.js',
      qualityScore: 90,
      scanTimeMs: 6.30,
      memoryUsageMb: 1.40,
      ruleCount: 2,
      aiFixCount: 1,
      isFavorite: true,
      createdAt: new Date(Date.now() - 3600000 * 36).toISOString(),
      diagnostics: [],
    },
  ];
}

function getDefaultUsers(): DBUser[] {
  return [
    {
      id: 'usr_admin_default',
      email: 'sanjula@nsbm.ac.lk',
      fullName: 'A P H D S Sanjula',
      role: 'ADMIN',
      passwordHash: '$2b$10$w1qE6q6E3u9v4c3d2e1f0.3q5r7s9t1u3v5w7x9y1z3a5b7c9d1e3',
      apiKey: 'figm_key_admin_sanjula',
      createdAt: new Date().toISOString(),
    }
  ];
}

const TMP_DB_FILE = path.resolve('/tmp', 'figm-user-db.json');

function loadDB(): DBUserStore {
  const targetFile = fs.existsSync(TMP_DB_FILE) ? TMP_DB_FILE : DB_FILE;
  if (fs.existsSync(targetFile)) {
    try {
      const data = fs.readFileSync(targetFile, 'utf-8');
      const parsed = JSON.parse(data);
      const scanRecords = parsed.scanRecords || [];
      const existingUsers = (parsed.users || []).map((u: Partial<DBUser>) => ({
        ...u,
        role: u.role || 'DEVELOPER',
      }));

      return {
        users: existingUsers,
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
  return {
    users: getDefaultUsers(),
    submissions: [],
    projects: [],
    scanRecords: [],
    notifications: [],
    settings: [],
    auditLogs: [],
  };
}

function saveDB(store: DBUserStore): void {
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

  createUser(user: Omit<DBUser, 'id' | 'createdAt'>): DBUser {
    const db = loadDB();
    const newUser: DBUser = {
      ...user,
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: user.email.toLowerCase(),
      passwordHash: user.passwordHash,
      fullName: user.fullName,
      role: user.role || 'DEVELOPER',
      apiKey: `figm_key_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
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
  createScanRecord(scan: Omit<DBScanRecord, 'id' | 'createdAt'>): DBScanRecord {
    const db = loadDB();
    const newScan: DBScanRecord = {
      ...scan,
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
