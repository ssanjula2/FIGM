import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../../src/auth/auth-middleware';
import { ProjectRepository } from '../../../../src/engine/project-repository';
import { AuditLogger } from '../../../../src/auth/audit-logger';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = authenticateUser(request);
  const project = ProjectRepository.getProjectById(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (auth.user && auth.user.role !== 'ADMIN' && project.userId !== auth.user.userId) {
    return NextResponse.json({ error: 'Forbidden: You do not own this project' }, { status: 403 });
  }

  return NextResponse.json({ project });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existingProject = ProjectRepository.getProjectById(params.id);
  if (!existingProject) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (auth.user.role !== 'ADMIN' && existingProject.userId !== auth.user.userId) {
    return NextResponse.json({ error: 'Forbidden: You do not own this project' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updated = ProjectRepository.updateProject(params.id, body);
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

  const existingProject = ProjectRepository.getProjectById(params.id);
  if (!existingProject) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (auth.user.role !== 'ADMIN' && existingProject.userId !== auth.user.userId) {
    return NextResponse.json({ error: 'Forbidden: You do not own this project' }, { status: 403 });
  }

  const success = ProjectRepository.deleteProject(params.id);
  AuditLogger.logEvent('DELETE_PROJECT', {
    userId: auth.user.userId,
    email: auth.user.email,
    details: `Deleted project: ${params.id}`,
  });

  return NextResponse.json({ message: 'Project deleted successfully' });
}

