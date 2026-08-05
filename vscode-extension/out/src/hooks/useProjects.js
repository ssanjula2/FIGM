"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useProjects = useProjects;
const react_1 = require("react");
function useProjects() {
    const [projects, setProjects] = (0, react_1.useState)([]);
    const [stats, setStats] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [search, setSearch] = (0, react_1.useState)('');
    const [framework, setFramework] = (0, react_1.useState)('ALL');
    const [status, setStatus] = (0, react_1.useState)('ALL');
    const [sortBy, setSortBy] = (0, react_1.useState)('createdAt');
    const [sortOrder, setSortOrder] = (0, react_1.useState)('desc');
    const fetchProjects = (0, react_1.useCallback)(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search)
                params.set('search', search);
            if (framework !== 'ALL')
                params.set('framework', framework);
            if (status !== 'ALL')
                params.set('status', status);
            params.set('sortBy', sortBy);
            params.set('sortOrder', sortOrder);
            const res = await fetch(`/api/projects?${params.toString()}`);
            if (!res.ok)
                throw new Error('Failed to fetch projects');
            const data = await res.json();
            setProjects(data.projects || []);
            setStats(data.stats || null);
        }
        catch (err) {
            setError(err.message || 'Failed to load projects');
        }
        finally {
            setLoading(false);
        }
    }, [search, framework, status, sortBy, sortOrder]);
    (0, react_1.useEffect)(() => {
        fetchProjects();
    }, [fetchProjects]);
    const createProject = async (data) => {
        const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!res.ok)
            throw new Error(result.error || 'Failed to create project');
        await fetchProjects();
        return result.project;
    };
    const updateProject = async (id, updates) => {
        const res = await fetch(`/api/projects/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
        const result = await res.json();
        if (!res.ok)
            throw new Error(result.error || 'Failed to update project');
        await fetchProjects();
        return result.project;
    };
    const duplicateProject = async (id) => {
        const res = await fetch(`/api/projects/${id}/duplicate`, {
            method: 'POST',
        });
        const result = await res.json();
        if (!res.ok)
            throw new Error(result.error || 'Failed to duplicate project');
        await fetchProjects();
        return result.project;
    };
    const deleteProject = async (id) => {
        const res = await fetch(`/api/projects/${id}`, {
            method: 'DELETE',
        });
        const result = await res.json();
        if (!res.ok)
            throw new Error(result.error || 'Failed to delete project');
        await fetchProjects();
    };
    return {
        projects,
        stats,
        loading,
        error,
        search,
        setSearch,
        framework,
        setFramework,
        status,
        setStatus,
        sortBy,
        setSortBy,
        sortOrder,
        setSortOrder,
        refresh: fetchProjects,
        createProject,
        updateProject,
        duplicateProject,
        deleteProject,
    };
}
//# sourceMappingURL=useProjects.js.map