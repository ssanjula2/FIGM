import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../../../src/auth/auth-middleware';
import { ProjectRepository } from '../../../../../src/engine/project-repository';
import { checkRateLimit, getClientIp } from '../../../../../src/auth/rate-limiter';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Duplication is a heavier DB write than a plain create (copies the source project's own
  // data) with the same unbounded-repeat-abuse profile -- same limit applied for the same reason
  // as POST /api/projects above.
  const rateLimitError = await checkRateLimit(getClientIp(request), 10, 60000);
  if (rateLimitError) return rateLimitError;

  const source = await ProjectRepository.getProjectById(params.id);
  if (!source) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Without this check, any authenticated user could duplicate (i.e. read a full copy of) any
  // other user's project by id, regardless of ownership.
  if (auth.user.role !== 'ADMIN' && source.userId !== auth.user.userId) {
    return NextResponse.json({ error: 'Forbidden: You do not own this project' }, { status: 403 });
  }

  const duplicated = await ProjectRepository.duplicateProject(params.id, auth.user.userId);
  if (!duplicated) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({
    message: 'Project duplicated successfully',
    project: duplicated,
  });
}
