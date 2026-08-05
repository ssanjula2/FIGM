"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectRepository = void 0;
const repository_factory_1 = require("../storage/repository-factory");
class ProjectRepository {
    static get provider() {
        return repository_factory_1.RepositoryFactory.getStorageProvider();
    }
    static createProject(data) {
        return ProjectRepository.provider.createProject(data);
    }
    static getProjectById(id) {
        return ProjectRepository.provider.getProjectById(id);
    }
    static getProjects(options = {}) {
        let projects = ProjectRepository.provider.getProjects(options.userId) || [];
        if (options.status && options.status !== 'ALL') {
            projects = projects.filter((p) => p.status === options.status);
        }
        if (options.framework && options.framework !== 'ALL') {
            projects = projects.filter((p) => p.framework.toLowerCase() === options.framework?.toLowerCase());
        }
        if (options.search && typeof options.search === 'string' && options.search.trim() !== '') {
            const q = options.search.toLowerCase().trim();
            projects = projects.filter((p) => p.name.toLowerCase().includes(q) ||
                p.description.toLowerCase().includes(q) ||
                p.repoUrl.toLowerCase().includes(q) ||
                p.framework.toLowerCase().includes(q));
        }
        const sortBy = options.sortBy || 'createdAt';
        const sortOrder = options.sortOrder || 'desc';
        projects.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];
            if (sortBy === 'name' || sortBy === 'framework') {
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
    static updateProject(id, updates) {
        return ProjectRepository.provider.updateProject(id, updates);
    }
    static archiveProject(id) {
        return ProjectRepository.provider.updateProject(id, { status: 'ARCHIVED' });
    }
    static duplicateProject(id, userId) {
        return ProjectRepository.provider.duplicateProject(id, userId || '');
    }
    static deleteProject(id) {
        return ProjectRepository.provider.deleteProject(id);
    }
    static getProjectStats(userId) {
        const projects = ProjectRepository.provider.getProjects(userId) || [];
        const totalProjects = projects.length;
        const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;
        const archivedProjects = projects.filter((p) => p.status === 'ARCHIVED').length;
        const totalScansAcrossProjects = projects.reduce((sum, p) => sum + (p.totalScans || 0), 0);
        const avgScore = totalProjects > 0
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
exports.ProjectRepository = ProjectRepository;
//# sourceMappingURL=project-repository.js.map