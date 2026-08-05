import { IStorageProvider } from './storage-provider';
import {
  UserDB,
  DBUser,
  DBProject,
  DBScanRecord,
  DBNotification,
  DBSettings,
  DBAuditLog,
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
  createScanRecord(scan: Omit<DBScanRecord, 'id' | 'createdAt'>): DBScanRecord {
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

  getAuditLogs(limit?: number): DBAuditLog[] {
    return UserDB.getAuditLogs(limit);
  }
}
