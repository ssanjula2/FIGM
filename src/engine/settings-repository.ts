import { UserDB, DBSettings } from '../auth/user-db';

export class SettingsRepository {
  public static getSettings(userId: string): DBSettings {
    return UserDB.getUserSettings(userId);
  }

  public static updateSettings(userId: string, settings: Partial<Omit<DBSettings, 'userId'>>): DBSettings {
    return UserDB.updateUserSettings(userId, settings);
  }
}
