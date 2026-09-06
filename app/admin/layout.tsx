import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyJWT } from '../../src/auth/auth-service';

/**
 * Server-side access boundary for the entire /admin/** tree. Previously the only guard on admin
 * pages was client-side: fetch an /api/admin/* endpoint, and render an inline "Access Restricted"
 * message on a 401/403 response. That correctly stops data from leaking (the APIs verify role
 * server-side via authorizeRole()), but it doesn't stop a DEVELOPER's browser from loading and
 * rendering the admin page shell itself, and relies on every future admin page remembering to
 * check auth before rendering. This layout is a hard, structural gate every route under /admin
 * passes through, checked here once, server-side, via the httpOnly figm_token cookie -- the same
 * verifyJWT() used by API routes, not a client-decodable substitute.
 *
 * ADMIN: full access. AUDITOR: allowed only as far as this base layout gates (the audit-logs tab
 * on /admin itself, per the underlying /api/auth/audit-logs authorization) -- the nested
 * admin/profile and admin/participants layouts narrow further to ADMIN-only, since those surfaces
 * are either the ADMIN's own personal profile or participant PII, neither of which AUDITOR's
 * audit-log access extends to. DEVELOPER and anonymous visitors never reach children below.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get('figm_token')?.value;
  const user = token ? verifyJWT(token) : null;

  if (!user) {
    redirect('/auth/login?redirect=%2Fadmin');
  }

  if (user.role !== 'ADMIN' && user.role !== 'AUDITOR') {
    redirect('/?forbidden=admin');
  }

  return <>{children}</>;
}
