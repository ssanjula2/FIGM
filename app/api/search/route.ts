import { NextResponse } from 'next/server';
import { authenticateUser } from '../../../src/auth/auth-middleware';
import { ProjectRepository } from '../../../src/engine/project-repository';
import { ScanRepository } from '../../../src/engine/scan-repository';
import { UserRepository } from '../../../src/engine/user-repository';
import { RULE_CATALOG } from '../../../src/matrix/rule-registry';
import { checkRateLimit, getClientIp } from '../../../src/auth/rate-limiter';

export async function GET(request: Request) {
  // Rate-limited before auth is enforced (same as every other IP-keyed limit in this codebase) so
  // a flood of missing/invalid-token requests is bounded too, not just successfully-authenticated
  // ones.
  const rateLimitError = await checkRateLimit(getClientIp(request), 30, 60000);
  if (rateLimitError) return rateLimitError;

  // Fixed (Phase 1 follow-up): this handler previously computed `auth` but never checked
  // auth.errorResponse, so a missing/invalid token fell through with userId=undefined instead of
  // being rejected -- the only route in this codebase that didn't enforce auth like every sibling
  // route does. No data ever actually leaked (results were still correctly scoped to an empty set
  // for userId=undefined, and the admin user-search branch was already isAdmin-gated), but the
  // endpoint was reachable without authentication at all, unlike its apparent intent. Now matches
  // the same authenticateUser/errorResponse/401 pattern used by every other authenticated route.
  const auth = authenticateUser(request);
  if (auth.errorResponse || !auth.user) {
    return auth.errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = auth.user.userId;
  const isAdmin = auth.user.role === 'ADMIN';

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

  // Projects & Scans Search — scoped to the caller's own data (or all data for ADMIN). auth is
  // enforced above, so userId is always a real, verified value here -- never let it fall through
  // as undefined, since getProjects/getScanRecords treat a missing userId as "return every user's
  // records."
  const projects = await ProjectRepository.getProjects({ userId: isAdmin ? undefined : userId, search: q });
  const scans = (await ScanRepository.getScanRecords({ userId: isAdmin ? undefined : userId, search: q, pageSize: 20 })).records;

  // FIGM Specification Rules Search — sourced from RULE_CATALOG (src/matrix/rule-registry.ts),
  // the same canonical registry the guidelines UI and figm-spec.json generator read, so this
  // endpoint's rule metadata can never drift from either of them.
  const rules = RULE_CATALOG.filter(
    (r) =>
      r.id.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.domain.toLowerCase().includes(q) ||
      r.concern.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
  ).map((r) => ({
    ruleId: r.id,
    name: r.name,
    category: r.category,
    domain: r.domain,
    severity: r.severity,
    description: r.description,
    frameworks: r.frameworks,
    isFrameworkIndependent: r.isFrameworkIndependent,
    example: r.example,
    remediation: r.remediation,
    remediationStatus: r.remediationStatus,
    knownLimitation: r.knownLimitation,
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
