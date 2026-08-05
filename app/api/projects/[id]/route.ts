import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../../src/auth/auth-middleware';
import { ProjectRepository } from '../../../../src/engine/project-repository';
import { AuditLogger } from '../../../../src/auth/audit-logger';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const project = ProjectRepository.getProjectById(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  return NextResponse.json({ project });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const updated = ProjectRepository.updateProject(params.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Project updated successfully', project: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update project';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const success = ProjectRepository.deleteProject(params.id);
  if (!success) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  AuditLogger.logEvent('DELETE_PROJECT', {
    userId: auth.user.userId,
    email: auth.user.email,
    details: `Deleted project: ${params.id}`,
  });

  return NextResponse.json({ message: 'Project deleted successfully' });
}
