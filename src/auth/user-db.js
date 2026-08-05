"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserDB = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const DB_FILE = node_path_1.default.resolve(process.cwd(), 'figm-user-db.json');
function loadDB() {
    if (node_fs_1.default.existsSync(DB_FILE)) {
        try {
            const data = node_fs_1.default.readFileSync(DB_FILE, 'utf-8');
            const parsed = JSON.parse(data);
            return {
                users: (parsed.users || []).map((u) => ({
                    ...u,
                    role: u.role || 'DEVELOPER',
                })),
                submissions: parsed.submissions || [],
                projects: parsed.projects || [],
                scanRecords: parsed.scanRecords || [],
                notifications: parsed.notifications || [],
                settings: parsed.settings || [],
                auditLogs: parsed.auditLogs || [],
            };
        }
        catch {
            // Fallback
        }
    }
    return {
        users: [],
        submissions: [],
        projects: [],
        scanRecords: [],
        notifications: [],
        settings: [],
        auditLogs: [],
    };
}
function saveDB(store) {
    node_fs_1.default.writeFileSync(DB_FILE, JSON.stringify(store, null, 2), 'utf-8');
}
exports.UserDB = {
    // --- USERS ---
    findUserByEmail(email) {
        const db = loadDB();
        return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    },
    findUserById(userId) {
        const db = loadDB();
        return db.users.find((u) => u.id === userId);
    },
    findUserByResetToken(token) {
        const db = loadDB();
        const now = Date.now();
        return db.users.find((u) => u.resetToken === token && (!u.resetTokenExpiry || new Date(u.resetTokenExpiry).getTime() > now));
    },
    findUserByRefreshToken(token) {
        const db = loadDB();
        return db.users.find((u) => u.refreshToken === token);
    },
    getAllUsers() {
        const db = loadDB();
        return db.users;
    },
    createUser(user) {
        const db = loadDB();
        const newUser = {
            ...user,
            id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            email: user.email.toLowerCase(),
            passwordHash: user.passwordHash,
            fullName: user.fullName,
            role: user.role || 'DEVELOPER',
            apiKey: `figm_key_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
            createdAt: new Date().toISOString(),
        };
        db.users.push(newUser);
        saveDB(db);
        return newUser;
    },
    updateUser(userId, updates) {
        const db = loadDB();
        const index = db.users.findIndex((u) => u.id === userId);
        if (index === -1)
            return undefined;
        const updatedUser = {
            ...db.users[index],
            ...updates,
        };
        db.users[index] = updatedUser;
        saveDB(db);
        return updatedUser;
    },
    deleteUser(userId) {
        const db = loadDB();
        const initialLength = db.users.length;
        db.users = db.users.filter((u) => u.id !== userId);
        db.projects = db.projects.filter((p) => p.userId !== userId);
        db.scanRecords = db.scanRecords.filter((s) => s.userId !== userId);
        db.notifications = db.notifications.filter((n) => n.userId !== userId);
        db.settings = db.settings.filter((s) => s.userId !== userId);
        db.submissions = db.submissions.filter((sub) => sub.userId !== userId);
        saveDB(db);
        return true;
    },
    // --- PROJECTS ---
    createProject(project) {
        const db = loadDB();
        const newProj = {
            ...project,
            id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            qualityScore: 100,
            totalScans: 0,
            createdAt: new Date().toISOString(),
        };
        db.projects.push(newProj);
        saveDB(db);
        return newProj;
    },
    getProjects(userId) {
        const db = loadDB();
        if (!userId)
            return db.projects;
        return db.projects.filter((p) => p.userId === userId);
    },
    getProjectById(id) {
        const db = loadDB();
        return db.projects.find((p) => p.id === id);
    },
    updateProject(id, updates) {
        const db = loadDB();
        const idx = db.projects.findIndex((p) => p.id === id);
        if (idx === -1)
            return undefined;
        db.projects[idx] = { ...db.projects[idx], ...updates };
        saveDB(db);
        return db.projects[idx];
    },
    duplicateProject(id, userId) {
        const original = exports.UserDB.getProjectById(id);
        if (!original)
            return undefined;
        return exports.UserDB.createProject({
            userId: userId || original.userId,
            name: `${original.name} (Copy)`,
            description: original.description,
            framework: original.framework,
            repoUrl: original.repoUrl,
            status: original.status,
        });
    },
    deleteProject(id) {
        const db = loadDB();
        const initLen = db.projects.length;
        db.projects = db.projects.filter((p) => p.id !== id);
        saveDB(db);
        return db.projects.length !== initLen;
    },
    // --- SCAN RECORDS ---
    createScanRecord(scan) {
        const db = loadDB();
        const newScan = {
            ...scan,
            id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            createdAt: new Date().toISOString(),
        };
        db.scanRecords.push(newScan);
        // Update project stats if associated
        if (scan.projectId) {
            const projIndex = db.projects.findIndex((p) => p.id === scan.projectId);
            if (projIndex !== -1) {
                db.projects[projIndex].totalScans += 1;
                db.projects[projIndex].qualityScore = scan.qualityScore;
                db.projects[projIndex].lastScanAt = newScan.createdAt;
            }
        }
        saveDB(db);
        return newScan;
    },
    getScanRecords(userId) {
        const db = loadDB();
        if (!userId)
            return db.scanRecords;
        return db.scanRecords.filter((s) => s.userId === userId);
    },
    getScanRecordById(id) {
        const db = loadDB();
        return db.scanRecords.find((s) => s.id === id);
    },
    toggleFavoriteScan(id) {
        const db = loadDB();
        const idx = db.scanRecords.findIndex((s) => s.id === id);
        if (idx !== -1) {
            db.scanRecords[idx].isFavorite = !db.scanRecords[idx].isFavorite;
            saveDB(db);
            return db.scanRecords[idx];
        }
        return undefined;
    },
    deleteScanRecord(id) {
        const db = loadDB();
        const initLen = db.scanRecords.length;
        db.scanRecords = db.scanRecords.filter((s) => s.id !== id);
        if (db.scanRecords.length !== initLen) {
            saveDB(db);
            return true;
        }
        return false;
    },
    // --- NOTIFICATIONS ---
    createNotification(notif) {
        const db = loadDB();
        const newNotif = {
            ...notif,
            id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            read: false,
            createdAt: new Date().toISOString(),
        };
        db.notifications.push(newNotif);
        saveDB(db);
        return newNotif;
    },
    getNotifications(userId) {
        const db = loadDB();
        return db.notifications.filter((n) => n.userId === userId).reverse();
    },
    markNotificationRead(id) {
        const db = loadDB();
        const idx = db.notifications.findIndex((n) => n.id === id);
        if (idx !== -1) {
            db.notifications[idx].read = true;
            saveDB(db);
        }
    },
    markAllNotificationsRead(userId) {
        const db = loadDB();
        db.notifications.forEach((n) => {
            if (n.userId === userId) {
                n.read = true;
            }
        });
        saveDB(db);
    },
    clearNotifications(userId) {
        const db = loadDB();
        db.notifications = db.notifications.filter((n) => n.userId !== userId);
        saveDB(db);
    },
    // --- SETTINGS ---
    getUserSettings(userId) {
        const db = loadDB();
        const found = db.settings.find((s) => s.userId === userId);
        if (found)
            return found;
        return {
            userId,
            theme: 'dark',
            autoSave: true,
            autoScan: true,
            aiModel: 'gemini-2.5-flash',
            exportFormat: 'PDF',
        };
    },
    updateUserSettings(userId, settings) {
        const db = loadDB();
        const idx = db.settings.findIndex((s) => s.userId === userId);
        const existing = this.getUserSettings(userId);
        const updated = { ...existing, ...settings };
        if (idx !== -1) {
            db.settings[idx] = updated;
        }
        else {
            db.settings.push(updated);
        }
        saveDB(db);
        return updated;
    },
    // --- SUBMISSIONS (Legacy compatibility) ---
    createSubmission(submission) {
        const db = loadDB();
        const newSubmission = {
            ...submission,
            id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            createdAt: new Date().toISOString(),
        };
        db.submissions.push(newSubmission);
        saveDB(db);
        return newSubmission;
    },
    getSubmissionsByUserId(userId) {
        const db = loadDB();
        if (userId === 'all_users')
            return db.submissions;
        return db.submissions.filter((s) => s.userId === userId);
    },
    getSubmissionById(submissionId, userId) {
        const db = loadDB();
        return db.submissions.find((s) => s.id === submissionId && s.userId === userId);
    },
    // --- AUDIT LOGS ---
    addAuditLog(log) {
        const db = loadDB();
        const newLog = {
            ...log,
            id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            createdAt: new Date().toISOString(),
        };
        db.auditLogs.push(newLog);
        if (db.auditLogs.length > 1000) {
            db.auditLogs = db.auditLogs.slice(db.auditLogs.length - 1000);
        }
        saveDB(db);
        return newLog;
    },
    getAuditLogs(limit = 100) {
        const db = loadDB();
        return db.auditLogs.slice(-limit).reverse();
    },
};
//# sourceMappingURL=user-db.js.map