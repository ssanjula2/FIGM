import { IStorageProvider } from './storage-provider';
import { JsonStorageProvider } from './json-storage-provider';
import {
  DBUser,
  DBProject,
  DBScanRecord,
  DBNotification,
  DBSettings,
  DBAuditLog,
} from '../auth/user-db';

export class SupabaseStorageProvider implements IStorageProvider {
  public name: 'supabase' = 'supabase';
  private client: any = null;
  private fallback: JsonStorageProvider;

  constructor() {
    this.fallback = new JsonStorageProvider();
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && key) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        this.client = createClient(url, key);
      } catch {
        this.client = null;
      }
    }
  }

  public isConnected(): boolean {
    return this.client !== null;
  }

  // --- USERS ---
  findUserByEmail(email: string): DBUser | undefined {
    return this.fallback.findUserByEmail(email);
  }

  findUserById(userId: string): DBUser | undefined {
    return this.fallback.findUserById(userId);
  }

  findUserByResetToken(token: string): DBUser | undefined {
    return this.fallback.findUserByResetToken(token);
  }

  findUserByRefreshToken(token: string): DBUser | undefined {
    return this.fallback.findUserByRefreshToken(token);
  }

  getAllUsers(): DBUser[] {
    return this.fallback.getAllUsers();
  }

  createUser(user: Omit<DBUser, 'id' | 'createdAt'>): DBUser {
    return this.fallback.createUser(user);
  }

  updateUser(userId: string, updates: Partial<Omit<DBUser, 'id' | 'createdAt'>>): DBUser | undefined {
    return this.fallback.updateUser(userId, updates);
  }

  deleteUser(userId: string): boolean {
    return this.fallback.deleteUser(userId);
  }

  // --- PROJECTS ---
  createProject(project: Omit<DBProject, 'id' | 'createdAt' | 'totalScans' | 'qualityScore'>): DBProject {
    return this.fallback.createProject(project);
  }

  getProjects(userId?: string): DBProject[] {
    return this.fallback.getProjects(userId);
  }

  getProjectById(id: string): DBProject | undefined {
    return this.fallback.getProjectById(id);
  }

  updateProject(id: string, updates: Partial<Omit<DBProject, 'id' | 'createdAt'>>): DBProject | undefined {
    return this.fallback.updateProject(id, updates);
  }

  duplicateProject(id: string, userId: string): DBProject | undefined {
    return this.fallback.duplicateProject(id, userId);
  }

  deleteProject(id: string): boolean {
    return this.fallback.deleteProject(id);
  }

  // --- SCAN RECORDS ---
  createScanRecord(scan: Omit<DBScanRecord, 'id' | 'createdAt'>): DBScanRecord {
    return this.fallback.createScanRecord(scan);
  }

  getScanRecords(userId?: string): DBScanRecord[] {
    return this.fallback.getScanRecords(userId);
  }

  getScanRecordById(id: string): DBScanRecord | undefined {
    return this.fallback.getScanRecordById(id);
  }

  toggleFavoriteScan(id: string): DBScanRecord | undefined {
    return this.fallback.toggleFavoriteScan(id);
  }

  deleteScanRecord(id: string): boolean {
    return this.fallback.deleteScanRecord(id);
  }

  // --- NOTIFICATIONS ---
  createNotification(notif: Omit<DBNotification, 'id' | 'createdAt' | 'read'>): DBNotification {
    return this.fallback.createNotification(notif);
  }

  getNotifications(userId: string): DBNotification[] {
    return this.fallback.getNotifications(userId);
  }

  markNotificationRead(id: string): void {
    this.fallback.markNotificationRead(id);
  }

  markAllNotificationsRead(userId: string): void {
    this.fallback.markAllNotificationsRead(userId);
  }

  clearNotifications(userId: string): void {
    this.fallback.clearNotifications(userId);
  }

  // --- SETTINGS ---
  getUserSettings(userId: string): DBSettings {
    return this.fallback.getUserSettings(userId);
  }

  updateUserSettings(userId: string, settings: Partial<Omit<DBSettings, 'userId'>>): DBSettings {
    return this.fallback.updateUserSettings(userId, settings);
  }

  // --- AUDIT LOGS ---
  addAuditLog(log: Omit<DBAuditLog, 'id' | 'createdAt'>): DBAuditLog {
    return this.fallback.addAuditLog(log);
  }

  getAuditLogs(limit = 100): DBAuditLog[] {
    return this.fallback.getAuditLogs(limit);
  }
}
