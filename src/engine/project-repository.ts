import { DBProject } from '../auth/user-db';
import { RepositoryFactory } from '../storage/repository-factory';

export interface ProjectFilterOptions {
  userId?: string;
  search?: string;
  framework?: string;
  status?: 'ACTIVE' | 'ARCHIVED' | 'ALL';
  sortBy?: 'name' | 'createdAt' | 'qualityScore' | 'totalScans' | 'lastScanAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ProjectStats {
  totalProjects: number;
  activeProjects: number;
  archivedProjects: number;
  averageQualityScore: number;
  totalScansAcrossProjects: number;
}

export class ProjectRepository {
  private static get provider() {
    return RepositoryFactory.getStorageProvider();
  }

  public static async createProject(data: Omit<DBProject, 'id' | 'createdAt' | 'totalScans' | 'qualityScore'>): Promise<DBProject> {
    return ProjectRepository.provider.createProject(data) as Promise<DBProject>;
  }

  public static async getProjectById(id: string): Promise<DBProject | undefined> {
    return ProjectRepository.provider.getProjectById(id) as Promise<DBProject | undefined>;
  }

  public static async getProjects(options: ProjectFilterOptions = {}): Promise<DBProject[]> {
    let projects = ((await ProjectRepository.provider.getProjects(options.userId)) as DBProject[]) || [];

    if (options.status && options.status !== 'ALL') {
      projects = projects.filter((p) => p.status === options.status);
    }

    if (options.framework && options.framework !== 'ALL') {
      projects = projects.filter((p) => p.framework.toLowerCase() === options.framework?.toLowerCase());
    }

    if (options.search && typeof options.search === 'string' && options.search.trim() !== '') {
      const q = options.search.toLowerCase().trim();
      // Defensive against a malformed/legacy record missing one of these fields (found via a
      // pre-existing test fixture that constructs a project with `description` omitted entirely) --
      // `|| ''` never changes behavior for a well-formed record, only stops a single bad record
      // from throwing and losing every result for every caller (including an ADMIN searching
      // across every user's projects, where one other user's stray bad record would otherwise be
      // fatal to the whole request).
      projects = projects.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          (p.repoUrl || '').toLowerCase().includes(q) ||
          (p.framework || '').toLowerCase().includes(q)
      );
    }

    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';

    projects.sort((a, b) => {
      let valA: any = (a as any)[sortBy];
      let valB: any = (b as any)[sortBy];

      if ((sortBy as string) === 'name' || (sortBy as string) === 'framework') {
        valA = (valA || '').toLowerCase();
        valB = (valB || '').toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      valA = valA ? new Date(valA).getTime() || valA : 0;
      valB = valB ? new Date(valB).getTime() || valB : 0;

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return projects;
  }

  public static async updateProject(id: string, updates: Partial<Omit<DBProject, 'id' | 'createdAt'>>): Promise<DBProject | undefined> {
    return ProjectRepository.provider.updateProject(id, updates) as Promise<DBProject | undefined>;
  }

  public static async archiveProject(id: string): Promise<DBProject | undefined> {
    return ProjectRepository.provider.updateProject(id, { status: 'ARCHIVED' }) as Promise<DBProject | undefined>;
  }

  public static async duplicateProject(id: string, userId?: string): Promise<DBProject | undefined> {
    return ProjectRepository.provider.duplicateProject(id, userId || '') as Promise<DBProject | undefined>;
  }

  public static async deleteProject(id: string): Promise<boolean> {
    return ProjectRepository.provider.deleteProject(id) as Promise<boolean>;
  }

  public static async getProjectStats(userId?: string): Promise<ProjectStats> {
    const projects = ((await ProjectRepository.provider.getProjects(userId)) as DBProject[]) || [];
    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;
    const archivedProjects = projects.filter((p) => p.status === 'ARCHIVED').length;

    const totalScansAcrossProjects = projects.reduce((sum, p) => sum + (p.totalScans || 0), 0);
    const avgScore =
      totalProjects > 0
        ? Math.round(projects.reduce((sum, p) => sum + (p.qualityScore || 100), 0) / totalProjects)
        : 100;

    return {
      totalProjects,
      activeProjects,
      archivedProjects,
      averageQualityScore: avgScore,
      totalScansAcrossProjects,
    };
  }
}
