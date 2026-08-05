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

  public static createProject(data: Omit<DBProject, 'id' | 'createdAt' | 'totalScans' | 'qualityScore'>): DBProject {
    return ProjectRepository.provider.createProject(data) as DBProject;
  }

  public static getProjectById(id: string): DBProject | undefined {
    return ProjectRepository.provider.getProjectById(id) as DBProject | undefined;
  }

  public static getProjects(options: ProjectFilterOptions = {}): DBProject[] {
    let projects = (ProjectRepository.provider.getProjects(options.userId) as DBProject[]) || [];

    if (options.status && options.status !== 'ALL') {
      projects = projects.filter((p) => p.status === options.status);
    }

    if (options.framework && options.framework !== 'ALL') {
      projects = projects.filter((p) => p.framework.toLowerCase() === options.framework?.toLowerCase());
    }

    if (options.search && typeof options.search === 'string' && options.search.trim() !== '') {
      const q = options.search.toLowerCase().trim();
      projects = projects.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.repoUrl.toLowerCase().includes(q) ||
          p.framework.toLowerCase().includes(q)
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

  public static updateProject(id: string, updates: Partial<Omit<DBProject, 'id' | 'createdAt'>>): DBProject | undefined {
    return ProjectRepository.provider.updateProject(id, updates) as DBProject | undefined;
  }

  public static archiveProject(id: string): DBProject | undefined {
    return ProjectRepository.provider.updateProject(id, { status: 'ARCHIVED' }) as DBProject | undefined;
  }

  public static duplicateProject(id: string, userId?: string): DBProject | undefined {
    return ProjectRepository.provider.duplicateProject(id, userId || '') as DBProject | undefined;
  }

  public static deleteProject(id: string): boolean {
    return ProjectRepository.provider.deleteProject(id) as boolean;
  }

  public static getProjectStats(userId?: string): ProjectStats {
    const projects = (ProjectRepository.provider.getProjects(userId) as DBProject[]) || [];
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
