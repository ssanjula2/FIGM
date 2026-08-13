import { DBSettings } from '../auth/user-db';
import { RepositoryFactory } from '../storage/repository-factory';

export class SettingsRepository {
  public static async getSettings(userId: string): Promise<DBSettings> {
    return RepositoryFactory.getStorageProvider().getUserSettings(userId) as Promise<DBSettings>;
  }

  public static async updateSettings(userId: string, settings: Partial<Omit<DBSettings, 'userId'>>): Promise<DBSettings> {
    return RepositoryFactory.getStorageProvider().updateUserSettings(userId, settings) as Promise<DBSettings>;
  }
}
