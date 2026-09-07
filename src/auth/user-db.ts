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
  // `| null` (not just optional/absent) for the same reason as `refreshToken` below: an explicit
  // `null` is required to actually clear these columns on the Postgres backend (see
  // app/api/auth/reset-password/route.ts).
  resetToken?: string | null;
  resetTokenExpiry?: string | null;
  // `| null` (not just optional/absent) is deliberate: an update payload of `{ refreshToken:
  // undefined }` is silently ignored by Prisma's update() (undefined-valued keys are treated as
  // "field not included," not "clear this field") -- only an explicit `null` actually clears the
  // column. See app/api/auth/logout/route.ts, the one real call site that needs to clear this.
  refreshToken?: string | null;
  // See prisma/schema.prisma's tokenVersion doc comment. Absent/undefined is treated as 0
  // everywhere it's read (a pre-migration user row with no column value is not yet revoked).
  tokenVersion?: number;
  apiKey?: string;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
  // Research-participant fields -- see prisma/schema.prisma's ResearchParticipantStatus doc
  // comment for the full rationale. Undefined/absent for every ordinary (non-study) user.
  participantCode?: string | null;
  researchStatus?: 'ASSIGNED' | 'CONSENT_VERIFIED' | 'REVOKED' | null;
  researchAssignedAt?: string | null;
  researchConsentVerifiedAt?: string | null;
  // Stage 7D: real, persisted account provenance (prisma/schema.prisma's AccountType enum).
  // Server-controlled only -- see app/api/admin/users/route.ts's PATCH handler, the sole trusted
  // write path. Absent/undefined is treated as 'NORMAL' everywhere it's read (matches the DB
  // column's own default and every pre-migration row).
  accountType?: 'NORMAL' | 'ENGINEERING_TEST';
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

/** Backs prisma/schema.prisma's `AiHistory` model (`ai_history` table -- already live in
 *  production since the initial baseline migration, prisma/migrations/20260818075914_init_baseline).
 *  Real fix/remediation interaction telemetry -- one row per fix ATTEMPT (never per scan), written
 *  only for an authenticated caller (see app/api/scan/route.ts's fix-action branch). `applied` is
 *  the pipeline's own `verified` flag -- true only when the patched code was actually re-scanned
 *  and the original violation confirmed gone, matching the real "apply" semantics the Live Scan UI
 *  itself uses (see live-scan/page.tsx's applyFix: the editor's code is only ever mutated when
 *  `verified === true`). Never set true merely because a candidate patch was generated.
 *  `scanReportId` is null whenever the fix action isn't tied to a specific persisted scan record
 *  (the current fix endpoint operates on ad-hoc submitted code, not a saved ScanReport id) -- an
 *  honest limitation, not a bug; see docs/audit/NORMAL_LIVE_SCAN_RESEARCH_INTEGRATION.md. */
export interface DBAiHistory {
  id: string;
  userId: string;
  scanReportId?: string | null;
  ruleId: string;
  applied: boolean;
  patchContent: string;
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
  action: 'REGISTER' | 'LOGIN' | 'LOGOUT' | 'REFRESH_TOKEN' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD' | 'ACCESS_DENIED' | 'CREATE_PROJECT' | 'DELETE_PROJECT' | 'SCAN_RUN' | 'RESEARCH_PARTICIPANT_ASSIGNED' | 'RESEARCH_CONSENT_VERIFIED' | 'RESEARCH_CONSENT_REVOKED';
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
  aiHistories: DBAiHistory[];
}

const DB_FILE = path.resolve(process.cwd(), 'figm-user-db.json');

/**
 * REMOVED (research-collection-build hardening pass, see
 * docs/audit/RESEARCH_COLLECTION_BUILD_FINALIZATION.md, SEC-03/D-03): `createUser`, `updateUser`,
 * and `createScanRecord` below used to ALSO opportunistically dual-write to a real Supabase
 * project via a direct `@supabase/supabase-js` client, entirely independent of
 * `RepositoryFactory`'s provider selection, whenever `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL` + a
 * key happened to be present in the process environment -- guarded (not removed) in the prior P0
 * data-integrity pass via `isSupabaseSyncAllowed()`/`NODE_ENV==='test'`
 * (docs/audit/PRE_STUDY_DATA_INTEGRITY_FINAL.md). Removed entirely now: the hand-mapped
 * column payloads were already missing several real schema fields
 * (`participant_code`/`research_status`/`token_version`/`account_type`, ...) that
 * `SupabaseStorageProvider`'s Prisma-based writes always include, so this side channel was not
 * merely redundant in the correctly-configured case -- it would have silently written an
 * incomplete row had it ever actually fired via `SupabaseStorageProvider`'s internal
 * Prisma-unavailable fallback path. `RepositoryFactory -> SupabaseStorageProvider -> Prisma ->
 * Supabase Postgres` is now the sole production write path for every field this store persists;
 * this JSON-file store's own writes (`saveDB` below) are unaffected and remain the correct
 * behavior for local dev without Supabase configured, and for automated tests.
 */

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
        aiHistories: parsed.aiHistories || [],
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
      aiHistories: [],
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
    // .trim() the incoming lookup value -- same rationale as SupabaseStorageProvider's own
    // findUserByEmail (kept consistent across both backends). See that method's comment.
    return db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
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

  /** Resolves a "P001"-style research-participant code to its backing User row. Checks
   *  `participantCode` first (the authoritative field for every row created after the field was
   *  introduced) and falls back to `id` (pre-migration rows whose id itself is the code, and any
   *  edge case where a row was created without the field set). See findUserByParticipantCode's
   *  Supabase-provider sibling for the identical dual-lookup rationale. */
  findUserByParticipantCode(code: string): DBUser | undefined {
    const db = loadDB();
    return db.users.find((u) => u.participantCode === code || u.id === code);
  },

  getAllUsers(): DBUser[] {
    const db = loadDB();
    return db.users;
  },

  createUser(user: Omit<DBUser, 'id' | 'createdAt'> & { id?: string }): DBUser {
    const db = loadDB();
    const normalizedEmail = user.email.toLowerCase();
    // Mirrors Postgres/Prisma's real unique-constraint behavior on `id` and `email` (see
    // prisma/schema.prisma's User model) with the same `P2002` error code, so callers that need to
    // safely handle a duplicate (e.g. two concurrent requests racing to provision the same
    // participant -- see ensureParticipantUser in app/api/user-study/log-scan/route.ts) can use one
    // identical create-then-catch-P2002 pattern regardless of which storage backend is active. Load
    // + check + push all happen synchronously here with no `await` in between, so this whole
    // operation is atomic within a single Node.js event-loop turn -- no other request's handler can
    // interleave and observe a half-written state.
    if (user.id && db.users.some((u) => u.id === user.id)) {
      throw Object.assign(new Error(`Unique constraint failed on the fields: (\`id\`)`), { code: 'P2002' });
    }
    if (db.users.some((u) => u.email === normalizedEmail)) {
      throw Object.assign(new Error(`Unique constraint failed on the fields: (\`email\`)`), { code: 'P2002' });
    }
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
      aiModel: 'claude-opus-5',
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

  /** Ownership-checked delete -- only removes the submission if it belongs to `userId`, mirroring
   *  every other delete path in this module (deleteProject, deleteScanRecord). Returns false (not
   *  an error) both when the id doesn't exist and when it belongs to someone else, so a caller
   *  can't distinguish "not found" from "not yours" via the return value alone. */
  deleteSubmission(submissionId: string, userId: string): boolean {
    const db = loadDB();
    const before = db.submissions.length;
    db.submissions = db.submissions.filter((s) => !(s.id === submissionId && s.userId === userId));
    if (db.submissions.length === before) return false;
    saveDB(db);
    return true;
  },

  // --- AI HISTORY (fix/remediation interaction telemetry -- see DBAiHistory's own doc comment) ---
  createAiHistoryRecord(record: Omit<DBAiHistory, 'id' | 'createdAt'>): DBAiHistory {
    const db = loadDB();
    const newRecord: DBAiHistory = {
      ...record,
      id: `aih_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    db.aiHistories.push(newRecord);
    saveDB(db);
    return newRecord;
  },

  getAiHistoryByUserId(userId: string): DBAiHistory[] {
    const db = loadDB();
    return db.aiHistories.filter((h) => h.userId === userId);
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

  getAuditLogs(limit = 100, userId?: string): DBAuditLog[] {
    const db = loadDB();
    const logs = userId ? db.auditLogs.filter((l) => l.userId === userId) : db.auditLogs;
    return logs.slice(-limit).reverse();
  },
};
