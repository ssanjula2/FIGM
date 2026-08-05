import { DBUser, DBSettings, DBProject, DBScanRecord } from '../auth/user-db';
import { hashPassword, verifyPassword } from '../auth/auth-service';
import { RepositoryFactory } from '../storage/repository-factory';
import crypto from 'node:crypto';

export class UserRepository {
  private static get provider() {
    return RepositoryFactory.getStorageProvider();
  }

  public static getUserProfile(userId: string): { user: DBUser | undefined; stats: any; settings: DBSettings } {
    const user = UserRepository.provider.findUserById(userId) as DBUser | undefined;
    const projects = (UserRepository.provider.getProjects(userId) as DBProject[]) || [];
    const scans = (UserRepository.provider.getScanRecords(userId) as DBScanRecord[]) || [];

    const averageScore =
      scans.length > 0
        ? Math.round(scans.reduce((acc, s) => acc + s.qualityScore, 0) / scans.length)
        : 100;

    const stats = {
      projectCount: projects.length,
      reportCount: scans.length,
      averageScore,
    };

    const settings = UserRepository.provider.getUserSettings(userId) as DBSettings;

    return { user, stats, settings };
  }

  public static updateProfile(
    userId: string,
    updates: { fullName?: string; avatarUrl?: string; email?: string }
  ): DBUser | undefined {
    return UserRepository.provider.updateUser(userId, updates) as DBUser | undefined;
  }

  public static changePassword(
    userId: string,
    currentPass: string,
    newPass: string
  ): { success: boolean; message: string } {
    const user = UserRepository.provider.findUserById(userId) as DBUser | undefined;
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    if (!verifyPassword(currentPass, user.passwordHash)) {
      return { success: false, message: 'Current password is incorrect' };
    }

    const newHash = hashPassword(newPass);
    UserRepository.provider.updateUser(userId, { passwordHash: newHash });
    return { success: true, message: 'Password updated successfully' };
  }

  public static regenerateApiKey(userId: string): string | undefined {
    const newKey = `figm_key_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const updated = UserRepository.provider.updateUser(userId, { apiKey: newKey }) as DBUser | undefined;
    return updated?.apiKey;
  }

  public static deleteAccount(userId: string): boolean {
    return UserRepository.provider.deleteUser(userId) as boolean;
  }

  public static getSettings(userId: string): DBSettings {
    return UserRepository.provider.getUserSettings(userId) as DBSettings;
  }

  public static updateSettings(userId: string, settings: Partial<Omit<DBSettings, 'userId'>>): DBSettings {
    return UserRepository.provider.updateUserSettings(userId, settings) as DBSettings;
  }

  // Admin Methods
  public static getAllUsers(): DBUser[] {
    return (UserRepository.provider.getAllUsers() as DBUser[]) || [];
  }

  public static updateUserRole(userId: string, role: any): DBUser | undefined {
    return UserRepository.provider.updateUser(userId, { role }) as DBUser | undefined;
  }

  public static adminResetPassword(userId: string, newPassword: string): DBUser | undefined {
    const newHash = hashPassword(newPassword);
    return UserRepository.provider.updateUser(userId, { passwordHash: newHash }) as DBUser | undefined;
  }
}
