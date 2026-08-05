"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const auth_service_1 = require("../auth/auth-service");
const repository_factory_1 = require("../storage/repository-factory");
const node_crypto_1 = __importDefault(require("node:crypto"));
class UserRepository {
    static get provider() {
        return repository_factory_1.RepositoryFactory.getStorageProvider();
    }
    static getUserProfile(userId) {
        const user = UserRepository.provider.findUserById(userId);
        const projects = UserRepository.provider.getProjects(userId) || [];
        const scans = UserRepository.provider.getScanRecords(userId) || [];
        const averageScore = scans.length > 0
            ? Math.round(scans.reduce((acc, s) => acc + s.qualityScore, 0) / scans.length)
            : 100;
        const stats = {
            projectCount: projects.length,
            reportCount: scans.length,
            averageScore,
        };
        const settings = UserRepository.provider.getUserSettings(userId);
        return { user, stats, settings };
    }
    static updateProfile(userId, updates) {
        return UserRepository.provider.updateUser(userId, updates);
    }
    static changePassword(userId, currentPass, newPass) {
        const user = UserRepository.provider.findUserById(userId);
        if (!user) {
            return { success: false, message: 'User not found' };
        }
        if (!(0, auth_service_1.verifyPassword)(currentPass, user.passwordHash)) {
            return { success: false, message: 'Current password is incorrect' };
        }
        const newHash = (0, auth_service_1.hashPassword)(newPass);
        UserRepository.provider.updateUser(userId, { passwordHash: newHash });
        return { success: true, message: 'Password updated successfully' };
    }
    static regenerateApiKey(userId) {
        const newKey = `figm_key_${Date.now()}_${node_crypto_1.default.randomBytes(6).toString('hex')}`;
        const updated = UserRepository.provider.updateUser(userId, { apiKey: newKey });
        return updated?.apiKey;
    }
    static deleteAccount(userId) {
        return UserRepository.provider.deleteUser(userId);
    }
    static getSettings(userId) {
        return UserRepository.provider.getUserSettings(userId);
    }
    static updateSettings(userId, settings) {
        return UserRepository.provider.updateUserSettings(userId, settings);
    }
    // Admin Methods
    static getAllUsers() {
        return UserRepository.provider.getAllUsers() || [];
    }
    static updateUserRole(userId, role) {
        return UserRepository.provider.updateUser(userId, { role });
    }
    static adminResetPassword(userId, newPassword) {
        const newHash = (0, auth_service_1.hashPassword)(newPassword);
        return UserRepository.provider.updateUser(userId, { passwordHash: newHash });
    }
}
exports.UserRepository = UserRepository;
//# sourceMappingURL=user-repository.js.map