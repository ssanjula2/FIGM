import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../../../src/auth/auth-middleware';
import { ProjectRepository } from '../../../../../src/engine/project-repository';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
