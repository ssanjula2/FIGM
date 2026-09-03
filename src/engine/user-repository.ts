import { DBUser, DBSettings, DBProject, DBScanRecord } from '../auth/user-db';
import { hashPassword, verifyPassword, validatePassword } from '../auth/auth-service';
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

    // Previously unenforced here -- register/route.ts and reset-password/route.ts both already
    // require this same policy, but CHANGE_PASSWORD let an authenticated caller set an arbitrarily
    // weak new password (e.g. a single character) despite knowing the current one. Closing that
    // inconsistency, not introducing a new policy.
    const strength = validatePassword(newPass);
    if (!strength.valid) {
      return { success: false, message: strength.message || 'New password does not meet the required strength policy' };
    }

    const newHash = hashPassword(newPass);
    // `refreshToken: null` (not omitted) -- same explicit-null requirement as logout/reset-password
    // (Prisma's update() no-ops on an undefined-valued field, only a real null clears the column on
    // the Postgres backend). A refresh token issued before this change (e.g. one an attacker stole
    // while the account was compromised) must not go on working after the legitimate owner changes
    // their password -- that would leave the old, possibly-leaked credential materially equivalent
    // to a live session even after the password itself is no longer valid.
    await UserRepository.provider.updateUser(userId, { passwordHash: newHash, refreshToken: null });
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

  // Stage 7D: the ONLY trusted write path for User.accountType. Called exclusively from the
  // ADMIN-authorized PATCH /api/admin/users route -- never reachable from public registration or
  // any other client-facing endpoint (see AccountType's doc comment in prisma/schema.prisma).
  public static async updateAccountType(userId: string, accountType: 'NORMAL' | 'ENGINEERING_TEST'): Promise<DBUser | undefined> {
    return UserRepository.provider.updateUser(userId, { accountType }) as Promise<DBUser | undefined>;
  }

  public static async adminResetPassword(
    userId: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    // Same policy as self-service registration/change-password/reset -- an admin-issued password
    // is still a real credential the target user will authenticate with, so it must satisfy the
    // identical strength requirement rather than trusting the admin's input unchecked. Previously
    // this bypassed validatePassword() entirely, letting an admin set an arbitrarily weak (even
    // empty-after-hash) password for any account.
    const strength = validatePassword(newPassword);
    if (!strength.valid) {
      return { success: false, message: strength.message || 'New password does not meet the required strength policy' };
    }

    const user = (await UserRepository.provider.findUserById(userId)) as DBUser | undefined;
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    const newHash = hashPassword(newPassword);
    // `refreshToken: null` -- an admin-forced reset must revoke the target user's existing refresh
    // token for the same reason a self-service change does (see changePassword above): the whole
    // point of an admin reset is to cut off access using the old credential, which a still-valid
    // refresh token would undermine.
    await UserRepository.provider.updateUser(userId, { passwordHash: newHash, refreshToken: null });
    return { success: true, message: 'Password reset successfully' };
  }
}
