import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { ProjectRepository } from '../../../src/engine/project-repository';
import { ScanRepository } from '../../../src/engine/scan-repository';
import { UserRepository } from '../../../src/engine/user-repository';
import { FOUR_LAYER_MAPPINGS } from '../../../src/matrix/four-layer-meta-model';

export async function GET(request: Request) {
  const auth = authenticateUser(request);
  const userId = auth.user?.userId;
  const isAdmin = auth.user?.role === 'ADMIN';

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').toLowerCase().trim();

  if (!q) {
    return NextResponse.json({
      projects: [],
      scans: [],
      rules: [],
      users: [],
      repositories: [],
    });
  }

  // Projects Search
  const projects = await ProjectRepository.getProjects({ userId, search: q });

  // Scans Search
  const scansResult = await ScanRepository.getScanRecords({ userId, search: q, pageSize: 20 });
  const scans = scansResult.records;

  // FIGM Specification Rules Search
  const rules = FOUR_LAYER_MAPPINGS.filter(
    (m) =>
      m.rule.ruleId.toLowerCase().includes(q) ||
      m.rule.ruleName.toLowerCase().includes(q) ||
      m.domain.toLowerCase().includes(q) ||
      m.concern.toLowerCase().includes(q) ||
      m.rule.description.toLowerCase().includes(q)
  ).map((m) => ({
    ruleId: m.rule.ruleId,
    name: m.rule.ruleName,
    domain: m.domain,
    description: m.rule.description,
  }));

  // Users Search (Admin Only)
  let users: any[] = [];
  if (isAdmin) {
    const allUsers = await UserRepository.getAllUsers();
    users = allUsers
      .filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
      )
      .map((u) => ({ id: u.id, fullName: u.fullName, email: u.email, role: u.role }));
  }

  // Repositories Search (unique repo URLs matching query)
  const repos = Array.from(
    new Set(
      projects
        .map((p) => p.repoUrl)
        .concat(scans.map((s) => s.repositoryUrl || ''))
        .filter((url) => url && url.toLowerCase().includes(q))
    )
  );

  return NextResponse.json({
    projects,
    scans,
    rules,
    users,
    repositories: repos,
  });
}
