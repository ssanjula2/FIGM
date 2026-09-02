import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyJWT } from '../../../src/auth/auth-service';

/**
 * /admin/profile is the ADMIN's own administrative profile (Phase 6) -- narrower than the base
 * /admin/layout.tsx gate, which also admits AUDITOR. AUDITOR's only explicitly-permitted admin
 * surface is the audit-logs tab on /admin itself; an admin-profile page doesn't apply to that
 * role, so it's sent back to /admin rather than shown a page that isn't theirs. The parent layout
 * has already rejected anonymous/DEVELOPER visitors before this ever runs, but the check is
 * repeated here rather than assumed, since layouts can be restructured independently later.
 */
export default async function AdminProfileLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get('figm_token')?.value;
  const user = token ? verifyJWT(token) : null;

  if (!user) {
    redirect('/auth/login?redirect=%2Fadmin%2Fprofile');
  }

  if (user.role !== 'ADMIN') {
    redirect('/admin');
  }

  return <>{children}</>;
}
