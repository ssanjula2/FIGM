"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateUser = authenticateUser;
exports.authorizeRole = authorizeRole;
const server_1 = require("next/server");
const auth_service_1 = require("./auth-service");
/**
 * Authenticate incoming HTTP request via Bearer token or authorization header/cookie
 */
function authenticateUser(request) {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
    }
    if (!token) {
        // Also check for cookie fallback
        const cookieHeader = request.headers.get('cookie') || '';
        const match = cookieHeader.match(/figm_token=([^;]+)/);
        if (match) {
            token = match[1];
        }
    }
    if (!token) {
        return {
            user: null,
            errorResponse: server_1.NextResponse.json({ error: 'Unauthorized: Authentication token is missing', code: 'UNAUTHORIZED' }, { status: 401 }),
        };
    }
    const user = (0, auth_service_1.verifyJWT)(token);
    if (!user) {
        return {
            user: null,
            errorResponse: server_1.NextResponse.json({ error: 'Unauthorized: Authentication token is invalid or expired', code: 'INVALID_TOKEN' }, { status: 401 }),
        };
    }
    return { user };
}
/**
 * Enforce Role-Based Access Control (RBAC)
 */
function authorizeRole(request, allowedRoles) {
    const auth = authenticateUser(request);
    if (auth.errorResponse || !auth.user) {
        return auth;
    }
    if (!allowedRoles.includes(auth.user.role)) {
        return {
            user: auth.user,
            errorResponse: server_1.NextResponse.json({
                error: `Forbidden: Required role [${allowedRoles.join(', ')}] not satisfied. Current role: ${auth.user.role}`,
                code: 'FORBIDDEN',
            }, { status: 403 }),
        };
    }
    return { user: auth.user };
}
//# sourceMappingURL=auth-middleware.js.map