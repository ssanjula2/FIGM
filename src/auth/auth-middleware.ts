import { NextResponse } from 'next/server';
import { verifyJWT, UserPayload } from './auth-service';
import { UserRole } from './user-db';
import { RepositoryFactory } from '../storage/repository-factory';

export interface AuthenticatedRequestResult {
  user: UserPayload | null;
  errorResponse?: NextResponse;
}

/**
 * Authenticate incoming HTTP request via Bearer token or authorization header/cookie.
 *
 * Async because, beyond the stateless signature/expiry check verifyJWT already does, this also
 * checks the token's embedded tokenVersion against the user's current DB value -- the real fix for
 * "logout doesn't revoke an already-issued access token" (see prisma/schema.prisma's tokenVersion
 * doc comment). Every call site must `await` this; a missed `await` fails TypeScript compilation
 * (the returned Promise has no `.user`/`.errorResponse`), which is deliberately relied on here as
 * the safety net against silently reintroducing an auth bypass across ~24 call sites.
 */
export async function authenticateUser(request: Request): Promise<AuthenticatedRequestResult> {
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

  // Real revocation check: a token that verifies (correct signature, not expired) can still have
  // been logged-out since it was issued. POST /api/auth/logout bumps the user's DB tokenVersion;
  // any token signed with an older value -- e.g. a copy left in a second tab's localStorage, or
  // captured via XSS before logout -- is rejected here even though it would otherwise still be a
  // "valid" JWT for up to its own 1h lifetime. See prisma/schema.prisma's tokenVersion doc comment.
  //
  // Only enforced when the user row is actually found. A real access token is only ever minted
  // after reading a real DB user row (login/register/refresh), so in production `dbUser` missing
  // here means the account was deleted after the token was issued -- an edge case outside this
  // fix's scope, left to whatever behavior existed before this change (the token's own claims are
  // trusted). This deliberately does NOT turn into a blanket "reject any token for an unknown user
  // ID" check: several existing IDOR/ownership regression tests sign tokens for synthetic user IDs
  // that are never inserted into the users table (only referenced as a resource's `userId` field)
  // to exercise route-level ownership checks without full user-fixture setup -- that is an
  // established, intentional testing pattern in this codebase, not a gap this fix should close as
  // an unrequested side effect.
  const dbUser = await RepositoryFactory.getStorageProvider().findUserById(user.userId);
  if (dbUser && (dbUser.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Session has been revoked, please log in again', code: 'TOKEN_REVOKED' },
        { status: 401 }
      ),
    };
  }

  return { user };
}

/**
 * Enforce Role-Based Access Control (RBAC)
 */
export async function authorizeRole(
  request: Request,
  allowedRoles: UserRole[]
): Promise<AuthenticatedRequestResult> {
  const auth = await authenticateUser(request);
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
