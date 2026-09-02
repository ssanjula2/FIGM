import { NextResponse } from 'next/server';
import { authorizeRole } from '../../../../src/auth/auth-middleware';
import { ParticipantRepository } from '../../../../src/engine/participant-repository';

// GET() reads `request` (search param), so this is already dynamic -- but kept explicit for the
// same reason every other admin/dashboard route in this codebase does (see e.g.
// app/api/dashboard/activity/route.ts's comment): a future edit that drops the request read must
// not silently regress this back to a build-time-frozen static response.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = authorizeRole(request, ['ADMIN']);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || undefined;

  const rows = await ParticipantRepository.getMatrix(search);
  const registeredCount = rows.filter((r) => r.status !== 'NOT_REGISTERED').length;

  return NextResponse.json({
    participants: rows,
    total: rows.length,
    registeredCount,
  });
}
