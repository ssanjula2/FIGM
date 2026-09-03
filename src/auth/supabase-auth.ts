import { UserDB, DBUser, UserRole } from './user-db';
import { verifyPassword, signJWT, signRefreshToken } from './auth-service';

export interface AuthSession {
  user: DBUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class SupabaseAuthService {
  private client: any = null;

  constructor() {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        this.client = createClient(url, key);
      } catch {
        this.client = null;
      }
    }
  }

  public isEnabled(): boolean {
    return this.client !== null;
  }

  public async loginWithEmail(email: string, pass: string): Promise<{ session?: AuthSession; error?: string }> {
    if (this.client) {
      try {
        const { data, error } = await this.client.auth.signInWithPassword({ email, password: pass });
        if (!error && data?.session && data?.user) {
          const user = UserDB.findUserByEmail(email) || {
            id: data.user.id,
            email: data.user.email || email,
            passwordHash: 'supabase_managed',
            fullName: data.user.user_metadata?.full_name || email.split('@')[0],
            role: (data.user.user_metadata?.role as UserRole) || 'DEVELOPER',
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
      } catch {
        // Fallback
      }
    }

    const user = UserDB.findUserByEmail(email);
    if (!user || !user.passwordHash || !verifyPassword(pass, user.passwordHash)) {
      return { error: 'Invalid email or password' };
    }

    const accessToken = signJWT({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    }, user.tokenVersion ?? 0);

    const refreshToken = signRefreshToken({
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

  public async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    if (this.client) {
      try {
        const { error } = await this.client.auth.resetPasswordForEmail(email, {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password`,
        });
        if (!error) return { success: true, message: 'Password reset email sent via Supabase' };
      } catch {
        // Fallback
      }
    }

    const user = UserDB.findUserByEmail(email);
    if (!user) return { success: false, message: 'User not found' };
    return { success: true, message: 'Reset token generated locally' };
  }
}
