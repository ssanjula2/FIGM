"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogger = void 0;
const user_db_1 = require("./user-db");
class AuditLogger {
    static logEvent(action, options) {
        return user_db_1.UserDB.addAuditLog({
            action,
            userId: options.userId,
            email: options.email,
            ipAddress: options.ipAddress || '127.0.0.1',
            userAgent: options.userAgent || 'system',
            status: options.status || 'SUCCESS',
            details: options.details,
        });
    }
    static getRecentLogs(limit = 100) {
        return user_db_1.UserDB.getAuditLogs(limit);
    }
}
exports.AuditLogger = AuditLogger;
//# sourceMappingURL=audit-logger.js.map