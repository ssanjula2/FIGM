import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../../src/auth/auth-middleware';
import { ProjectRepository } from '../../../../src/engine/project-repository';
import { AuditLogger } from '../../../../src/auth/audit-logger';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await ProjectRepository.getProjectById(params.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (auth.user.role !== 'ADMIN' && project.userId !== auth.user.userId) {
    return NextResponse.json({ error: 'Forbidden: You do not own this project' }, { status: 403 });
  }

  return NextResponse.json({ project });
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existingProject = await ProjectRepository.getProjectById(params.id);
  if (!existingProject) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (auth.user.role !== 'ADMIN' && existingProject.userId !== auth.user.userId) {
    return NextResponse.json({ error: 'Forbidden: You do not own this project' }, { status: 403 });
  }

  try {
    const body = await request.json();
    // Allow-list which fields a project owner/admin can change via this endpoint -- passing the
    // raw request body straight to updateProject() would let a caller overwrite fields it should
    // never control directly (e.g. userId to reassign ownership, or qualityScore/totalScans,
    // which only the scan pipeline should ever set).
    const ALLOWED_FIELDS = ['name', 'description', 'framework', 'repoUrl', 'status'] as const;
    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in body) updates[key] = body[key];
    }

    const updated = await ProjectRepository.updateProject(params.id, updates);
    return NextResponse.json({ message: 'Project updated successfully', project: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update project';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existingProject = await ProjectRepository.getProjectById(params.id);
  if (!existingProject) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (auth.user.role !== 'ADMIN' && existingProject.userId !== auth.user.userId) {
    return NextResponse.json({ error: 'Forbidden: You do not own this project' }, { status: 403 });
  }

  const success = await ProjectRepository.deleteProject(params.id);
  await AuditLogger.logEvent('DELETE_PROJECT', {
    userId: auth.user.userId,
    email: auth.user.email,
    details: `Deleted project: ${params.id}`,
  });

  return NextResponse.json({ message: 'Project deleted successfully' });
}

