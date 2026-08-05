import { NextResponse } from 'next/server';
import { verifyJWT, UserPayload } from './auth-service';
import { UserRole } from './user-db';

export interface AuthenticatedRequestResult {
  user: UserPayload | null;
  errorResponse?: NextResponse;
}

/**
 * Authenticate incoming HTTP request via Bearer token or authorization header/cookie
 */
export function authenticateUser(request: Request): AuthenticatedRequestResult {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  let token: string | null = null;

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
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Authentication token is missing', code: 'UNAUTHORIZED' },
        { status: 401 }
      ),
    };
  }

  const user = verifyJWT(token);
  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Authentication token is invalid or expired', code: 'INVALID_TOKEN' },
        { status: 401 }
      ),
    };
  }

  return { user };
}

/**
 * Enforce Role-Based Access Control (RBAC)
 */
export function authorizeRole(
  request: Request,
  allowedRoles: UserRole[]
): AuthenticatedRequestResult {
  const auth = authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth;
  }

  if (!allowedRoles.includes(auth.user.role)) {
    return {
      user: auth.user,
      errorResponse: NextResponse.json(
        {
          error: `Forbidden: Required role [${allowedRoles.join(', ')}] not satisfied. Current role: ${auth.user.role}`,
          code: 'FORBIDDEN',
        },
        { status: 403 }
      ),
    };
  }

  return { user: auth.user };
}
