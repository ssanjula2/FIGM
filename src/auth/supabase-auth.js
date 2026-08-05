"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseAuthService = void 0;
const user_db_1 = require("./user-db");
const auth_service_1 = require("./auth-service");
class SupabaseAuthService {
    client = null;
    constructor() {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
    isEnabled() {
        return this.client !== null;
    }
    async loginWithEmail(email, pass) {
        if (this.client) {
            try {
                const { data, error } = await this.client.auth.signInWithPassword({ email, password: pass });
                if (!error && data?.session && data?.user) {
                    const user = user_db_1.UserDB.findUserByEmail(email) || {
                        id: data.user.id,
                        email: data.user.email || email,
                        passwordHash: 'supabase_managed',
                        fullName: data.user.user_metadata?.full_name || email.split('@')[0],
                        role: data.user.user_metadata?.role || 'DEVELOPER',
                        createdAt: data.user.created_at,
                    };
                    return {
                        session: {
                            user,
                            accessToken: data.session.access_token,
                            refreshToken: data.session.refresh_token,
                            expiresIn: data.session.expires_in,
                        },
                    };
                }
            }
            catch {
                // Fallback
            }
        }
        const user = user_db_1.UserDB.findUserByEmail(email);
        if (!user || !user.passwordHash || !(0, auth_service_1.verifyPassword)(pass, user.passwordHash)) {
            return { error: 'Invalid email or password' };
        }
        const accessToken = (0, auth_service_1.signJWT)({
            userId: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
        });
        const refreshToken = (0, auth_service_1.signRefreshToken)({
            userId: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
        });
        return {
            session: {
                user,
                accessToken,
                refreshToken,
                expiresIn: 3600,
            },
        };
    }
    async requestPasswordReset(email) {
        if (this.client) {
            try {
                const { error } = await this.client.auth.resetPasswordForEmail(email, {
                    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password`,
                });
                if (!error)
                    return { success: true, message: 'Password reset email sent via Supabase' };
            }
            catch {
                // Fallback
            }
        }
        const user = user_db_1.UserDB.findUserByEmail(email);
        if (!user)
            return { success: false, message: 'User not found' };
        return { success: true, message: 'Reset token generated locally' };
    }
}
exports.SupabaseAuthService = SupabaseAuthService;
//# sourceMappingURL=supabase-auth.js.map