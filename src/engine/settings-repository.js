"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsRepository = void 0;
const user_db_1 = require("../auth/user-db");
class SettingsRepository {
    static getSettings(userId) {
        return user_db_1.UserDB.getUserSettings(userId);
    }
    static updateSettings(userId, settings) {
        return user_db_1.UserDB.updateUserSettings(userId, settings);
    }
}
exports.SettingsRepository = SettingsRepository;
//# sourceMappingURL=settings-repository.js.map