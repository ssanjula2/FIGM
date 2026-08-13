import { DBUser, DBSettings, DBProject, DBScanRecord } from '../auth/user-db';
import { hashPassword, verifyPassword } from '../auth/auth-service';
import { RepositoryFactory } from '../storage/repository-factory';
import crypto from 'node:crypto';

export class UserRepository {
  private static get provider() {
    return RepositoryFactory.getStorageProvider();
  }

  public static async getUserProfile(userId: string): Promise<{ user: DBUser | undefined; stats: any; settings: DBSettings }> {
    const user = (await UserRepository.provider.findUserById(userId)) as DBUser | undefined;
    const projects = ((await UserRepository.provider.getProjects(userId)) as DBProject[]) || [];
    const scans = ((await UserRepository.provider.getScanRecords(userId)) as DBScanRecord[]) || [];

    const averageScore =
      scans.length > 0
        ? Math.round(scans.reduce((acc, s) => acc + s.qualityScore, 0) / scans.length)
        : 100;

    const stats = {
      projectCount: projects.length,
      reportCount: scans.length,
      averageScore,
    };

    const settings = (await UserRepository.provider.getUserSettings(userId)) as DBSettings;

    return { user, stats, settings };
  }

  public static async updateProfile(
    userId: string,
    updates: { fullName?: string; avatarUrl?: string; email?: string }
  ): Promise<DBUser | undefined> {
    return UserRepository.provider.updateUser(userId, updates) as Promise<DBUser | undefined>;
  }

  public static async changePassword(
    userId: string,
    currentPass: string,
    newPass: string
  ): Promise<{ success: boolean; message: string }> {
    const user = (await UserRepository.provider.findUserById(userId)) as DBUser | undefined;
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    if (!verifyPassword(currentPass, user.passwordHash)) {
      return { success: false, message: 'Current password is incorrect' };
    }

    const newHash = hashPassword(newPass);
    await UserRepository.provider.updateUser(userId, { passwordHash: newHash });
    return { success: true, message: 'Password updated successfully' };
  }

  public static async regenerateApiKey(userId: string): Promise<string | undefined> {
    const newKey = `figm_key_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const updated = (await UserRepository.provider.updateUser(userId, { apiKey: newKey })) as DBUser | undefined;
    return updated?.apiKey;
  }

  public static async deleteAccount(userId: string): Promise<boolean> {
    return UserRepository.provider.deleteUser(userId) as Promise<boolean>;
  }

  public static async getSettings(userId: string): Promise<DBSettings> {
    return UserRepository.provider.getUserSettings(userId) as Promise<DBSettings>;
  }

  public static async updateSettings(userId: string, settings: Partial<Omit<DBSettings, 'userId'>>): Promise<DBSettings> {
    return UserRepository.provider.updateUserSettings(userId, settings) as Promise<DBSettings>;
  }

  // Admin Methods
  public static async getAllUsers(): Promise<DBUser[]> {
    return ((await UserRepository.provider.getAllUsers()) as DBUser[]) || [];
  }

  public static async updateUserRole(userId: string, role: any): Promise<DBUser | undefined> {
    return UserRepository.provider.updateUser(userId, { role }) as Promise<DBUser | undefined>;
  }

  public static async adminResetPassword(userId: string, newPassword: string): Promise<DBUser | undefined> {
    const newHash = hashPassword(newPassword);
    return UserRepository.provider.updateUser(userId, { passwordHash: newHash }) as Promise<DBUser | undefined>;
  }
}
