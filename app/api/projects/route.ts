import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { ProjectRepository } from '../../../src/engine/project-repository';
import { AuditLogger } from '../../../src/auth/audit-logger';

export async function GET(request: Request) {
  const auth = authenticateUser(request);
  const userId = auth.user?.userId;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || undefined;
  const framework = searchParams.get('framework') || undefined;
  const status = (searchParams.get('status') as any) || undefined;
  const sortBy = (searchParams.get('sortBy') as any) || undefined;
  const sortOrder = (searchParams.get('sortOrder') as any) || undefined;

  const projects = await ProjectRepository.getProjects({
    userId,
    search,
    framework,
    status,
    sortBy,
    sortOrder,
  });

  const stats = await ProjectRepository.getProjectStats(userId);

  return NextResponse.json({ projects, stats });
}

export async function POST(request: Request) {
  const auth = authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, framework, repoUrl } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Project name must be at least 2 characters long', code: 'INVALID_NAME' },
        { status: 400 }
      );
    }

    const project = await ProjectRepository.createProject({
      userId: auth.user.userId,
      name: name.trim(),
      description: description || '',
      framework: framework || 'React',
      repoUrl: repoUrl || '',
      status: 'ACTIVE',
    });

    await AuditLogger.logEvent('CREATE_PROJECT', {
      userId: auth.user.userId,
      email: auth.user.email,
      details: `Created project: ${project.name}`,
    });

    return NextResponse.json({
      message: 'Project created successfully',
      project,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create project';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
