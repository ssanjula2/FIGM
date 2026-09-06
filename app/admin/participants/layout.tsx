import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyJWT } from '../../../src/auth/auth-service';

/**
 * Participant detail records (/admin/participants/[participantId]) are ADMIN-only per Phase 12 --
 * they carry research-subject data that AUDITOR's audit-log access doesn't extend to. Same pattern
 * as app/admin/profile/layout.tsx: the base /admin/layout.tsx already rejects anonymous/DEVELOPER,
 * this narrows the remaining AUDITOR case.
 */
export default async function AdminParticipantsLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get('figm_token')?.value;
  const user = token ? verifyJWT(token) : null;

  if (!user) {
    redirect('/auth/login?redirect=%2Fadmin%2Fparticipants');
  }

  if (user.role !== 'ADMIN') {
    redirect('/admin');
  }

  return <>{children}</>;
}
