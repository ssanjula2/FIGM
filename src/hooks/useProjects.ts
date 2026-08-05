import { useState, useEffect, useCallback } from 'react';

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  framework: string;
  repoUrl: string;
  status: 'ACTIVE' | 'ARCHIVED';
  qualityScore: number;
  totalScans: number;
  lastScanAt?: string;
  createdAt: string;
}

export interface ProjectStats {
  totalProjects: number;
  activeProjects: number;
  archivedProjects: number;
  averageQualityScore: number;
  totalScansAcrossProjects: number;
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>('');
  const [framework, setFramework] = useState<string>('ALL');
  const [status, setStatus] = useState<'ACTIVE' | 'ARCHIVED' | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'qualityScore' | 'totalScans' | 'lastScanAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (framework !== 'ALL') params.set('framework', framework);
      if (status !== 'ALL') params.set('status', status);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);

      const res = await fetch(`/api/projects?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      setProjects(data.projects || []);
      setStats(data.stats || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [search, framework, status, sortBy, sortOrder]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async (data: { name: string; description?: string; framework?: string; repoUrl?: string }) => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create project');
    await fetchProjects();
    return result.project;
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update project');
    await fetchProjects();
    return result.project;
  };

  const duplicateProject = async (id: string) => {
    const res = await fetch(`/api/projects/${id}/duplicate`, {
      method: 'POST',
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to duplicate project');
    await fetchProjects();
    return result.project;
  };

  const deleteProject = async (id: string) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to delete project');
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
