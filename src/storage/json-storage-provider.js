"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonStorageProvider = void 0;
const user_db_1 = require("../auth/user-db");
class JsonStorageProvider {
    name = 'json';
    // Users
    findUserByEmail(email) {
        return user_db_1.UserDB.findUserByEmail(email);
    }
    findUserById(userId) {
        return user_db_1.UserDB.findUserById(userId);
    }
    findUserByResetToken(token) {
        return user_db_1.UserDB.findUserByResetToken(token);
    }
    findUserByRefreshToken(token) {
        return user_db_1.UserDB.findUserByRefreshToken(token);
    }
    getAllUsers() {
        return user_db_1.UserDB.getAllUsers();
    }
    createUser(user) {
        return user_db_1.UserDB.createUser(user);
    }
    updateUser(userId, updates) {
        return user_db_1.UserDB.updateUser(userId, updates);
    }
    deleteUser(userId) {
        return user_db_1.UserDB.deleteUser(userId);
    }
    // Projects
    createProject(project) {
        return user_db_1.UserDB.createProject(project);
    }
    getProjects(userId) {
        return user_db_1.UserDB.getProjects(userId);
    }
    getProjectById(id) {
        return user_db_1.UserDB.getProjectById(id);
    }
    updateProject(id, updates) {
        return user_db_1.UserDB.updateProject(id, updates);
    }
    duplicateProject(id, userId) {
        return user_db_1.UserDB.duplicateProject(id, userId);
    }
    deleteProject(id) {
        return user_db_1.UserDB.deleteProject(id);
    }
    // Scan Records
    createScanRecord(scan) {
        return user_db_1.UserDB.createScanRecord(scan);
    }
    getScanRecords(userId) {
        return user_db_1.UserDB.getScanRecords(userId);
    }
    getScanRecordById(id) {
        return user_db_1.UserDB.getScanRecordById(id);
    }
    toggleFavoriteScan(id) {
        return user_db_1.UserDB.toggleFavoriteScan(id);
    }
    deleteScanRecord(id) {
        return user_db_1.UserDB.deleteScanRecord(id);
    }
    // Notifications
    createNotification(notif) {
        return user_db_1.UserDB.createNotification(notif);
    }
    getNotifications(userId) {
        return user_db_1.UserDB.getNotifications(userId);
    }
    markNotificationRead(id) {
        user_db_1.UserDB.markNotificationRead(id);
    }
    markAllNotificationsRead(userId) {
        user_db_1.UserDB.markAllNotificationsRead(userId);
    }
    clearNotifications(userId) {
        user_db_1.UserDB.clearNotifications(userId);
    }
    // Settings
    getUserSettings(userId) {
        return user_db_1.UserDB.getUserSettings(userId);
    }
    updateUserSettings(userId, settings) {
        return user_db_1.UserDB.updateUserSettings(userId, settings);
    }
    // Audit Logs
    addAuditLog(log) {
        return user_db_1.UserDB.addAuditLog(log);
    }
    getAuditLogs(limit) {
        return user_db_1.UserDB.getAuditLogs(limit);
    }
}
exports.JsonStorageProvider = JsonStorageProvider;
//# sourceMappingURL=json-storage-provider.js.map