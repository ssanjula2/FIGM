"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseStorageProvider = void 0;
const json_storage_provider_1 = require("./json-storage-provider");
class SupabaseStorageProvider {
    name = 'supabase';
    client = null;
    fallback;
    constructor() {
        this.fallback = new json_storage_provider_1.JsonStorageProvider();
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (url && key) {
            try {
                const { createClient } = require('@supabase/supabase-js');
                this.client = createClient(url, key);
            }
            catch {
                this.client = null;
            }
        }
    }
    isConnected() {
        return this.client !== null;
    }
    // --- USERS ---
    findUserByEmail(email) {
        return this.fallback.findUserByEmail(email);
    }
    findUserById(userId) {
        return this.fallback.findUserById(userId);
    }
    findUserByResetToken(token) {
        return this.fallback.findUserByResetToken(token);
    }
    findUserByRefreshToken(token) {
        return this.fallback.findUserByRefreshToken(token);
    }
    getAllUsers() {
        return this.fallback.getAllUsers();
    }
    createUser(user) {
        return this.fallback.createUser(user);
    }
    updateUser(userId, updates) {
        return this.fallback.updateUser(userId, updates);
    }
    deleteUser(userId) {
        return this.fallback.deleteUser(userId);
    }
    // --- PROJECTS ---
    createProject(project) {
        return this.fallback.createProject(project);
    }
    getProjects(userId) {
        return this.fallback.getProjects(userId);
    }
    getProjectById(id) {
        return this.fallback.getProjectById(id);
    }
    updateProject(id, updates) {
        return this.fallback.updateProject(id, updates);
    }
    duplicateProject(id, userId) {
        return this.fallback.duplicateProject(id, userId);
    }
    deleteProject(id) {
        return this.fallback.deleteProject(id);
    }
    // --- SCAN RECORDS ---
    createScanRecord(scan) {
        return this.fallback.createScanRecord(scan);
    }
    getScanRecords(userId) {
        return this.fallback.getScanRecords(userId);
    }
    getScanRecordById(id) {
        return this.fallback.getScanRecordById(id);
    }
    toggleFavoriteScan(id) {
        return this.fallback.toggleFavoriteScan(id);
    }
    deleteScanRecord(id) {
        return this.fallback.deleteScanRecord(id);
    }
    // --- NOTIFICATIONS ---
    createNotification(notif) {
        return this.fallback.createNotification(notif);
    }
    getNotifications(userId) {
        return this.fallback.getNotifications(userId);
    }
    markNotificationRead(id) {
        this.fallback.markNotificationRead(id);
    }
    markAllNotificationsRead(userId) {
        this.fallback.markAllNotificationsRead(userId);
    }
    clearNotifications(userId) {
        this.fallback.clearNotifications(userId);
    }
    // --- SETTINGS ---
    getUserSettings(userId) {
        return this.fallback.getUserSettings(userId);
    }
    updateUserSettings(userId, settings) {
        return this.fallback.updateUserSettings(userId, settings);
    }
    // --- AUDIT LOGS ---
    addAuditLog(log) {
        return this.fallback.addAuditLog(log);
    }
    getAuditLogs(limit = 100) {
        return this.fallback.getAuditLogs(limit);
    }
}
exports.SupabaseStorageProvider = SupabaseStorageProvider;
//# sourceMappingURL=supabase-storage-provider.js.map