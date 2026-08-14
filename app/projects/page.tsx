'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useProjects } from '../../src/hooks/useProjects';

export default function ProjectsPage() {
  const {
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
    createProject,
    updateProject,
    duplicateProject,
    deleteProject,
  } = useProjects();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFramework, setSelectedFramework] = useState('React');
  const [repoUrl, setRepoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!name.trim()) {
      setFormError('Project name is required');
      return;
    }
    setSubmitting(true);
    try {
      await createProject({
        name,
        description,
        framework: selectedFramework,
        repoUrl,
      });
      setName('');
      setDescription('');
      setRepoUrl('');
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const frameworkBadges: Record<string, { bg: string; color: string; label: string }> = {
    'React': { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', label: 'React' },
    'Next.js': { bg: 'rgba(248, 250, 252, 0.15)', color: '#f8fafc', label: 'Next.js' },
    'Angular': { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Angular' },
    'Vue': { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', label: 'Vue.js' },
    'Svelte': { bg: 'rgba(249, 115, 22, 0.15)', color: '#f97316', label: 'Svelte' },
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#f8fafc', margin: 0, letterSpacing: '-0.5px' }}>
            Project Workspace
          </h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', marginTop: '6px', margin: 0 }}>
            Manage, scan, duplicate, and monitor quality metrics across all software repositories.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            padding: '12px 22px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 0 20px rgba(56, 189, 248, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
        >
          <span>＋</span> Create Project
        </button>
      </div>

      {/* Statistics Cards Grid */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '20px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '20px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Total Projects</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#38bdf8', marginTop: '8px' }}>
              {stats.totalProjects}
            </div>
            <div style={{ fontSize: '11px', color: '#7c8ba6', marginTop: '4px' }}>
              {stats.activeProjects} active &bull; {stats.archivedProjects} archived
            </div>
          </div>

          <div
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '20px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Average Quality Score</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#22c55e', marginTop: '8px' }}>
              {stats.averageQualityScore}%
            </div>
            <div style={{ fontSize: '11px', color: '#7c8ba6', marginTop: '4px' }}>
              ISO/IEC 25010 Aligned
            </div>
          </div>

          <div
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '20px',
            }}
          >
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Total Scans Executed</div>
            <div style={{ fontSize: '28px', fontWeight: 900, color: '#a855f7', marginTop: '8px' }}>
              {stats.totalScansAcrossProjects}
            </div>
            <div style={{ fontSize: '11px', color: '#7c8ba6', marginTop: '4px' }}>
              Across active projects
            </div>
          </div>
        </div>
      )}

      {/* Filter and Controls Toolbar */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '14px',
          padding: '16px 20px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {/* Search input */}
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#7c8ba6' }}>🔍</span>
          <input
            type="text"
            placeholder="Search projects by name, description, repo URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 40px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(9, 13, 22, 0.8)',
              color: '#f8fafc',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Filters & Sorting */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Framework dropdown */}
          <select
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(9, 13, 22, 0.8)',
              color: '#38bdf8',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="ALL" style={{ background: '#090d16', color: '#fff' }}>All Frameworks</option>
            <option value="React" style={{ background: '#090d16', color: '#fff' }}>React</option>
            <option value="Next.js" style={{ background: '#090d16', color: '#fff' }}>Next.js</option>
            <option value="Angular" style={{ background: '#090d16', color: '#fff' }}>Angular</option>
            <option value="Vue" style={{ background: '#090d16', color: '#fff' }}>Vue.js</option>
            <option value="Svelte" style={{ background: '#090d16', color: '#fff' }}>Svelte</option>
          </select>

          {/* Status dropdown */}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(9, 13, 22, 0.8)',
              color: '#f8fafc',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="ALL" style={{ background: '#090d16', color: '#fff' }}>All Status</option>
            <option value="ACTIVE" style={{ background: '#090d16', color: '#fff' }}>Active Only</option>
            <option value="ARCHIVED" style={{ background: '#090d16', color: '#fff' }}>Archived Only</option>
          </select>

          {/* Sort By dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(9, 13, 22, 0.8)',
              color: '#f8fafc',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="createdAt" style={{ background: '#090d16', color: '#fff' }}>Sort by Date</option>
            <option value="name" style={{ background: '#090d16', color: '#fff' }}>Sort by Name</option>
            <option value="qualityScore" style={{ background: '#090d16', color: '#fff' }}>Sort by Score</option>
            <option value="totalScans" style={{ background: '#090d16', color: '#fff' }}>Sort by Scans</option>
          </select>

          {/* Order Toggle */}
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(9, 13, 22, 0.8)',
              color: '#94a3b8',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '10px', color: '#f87171', marginBottom: '24px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              style={{
                height: '200px',
                background: 'rgba(15, 23, 42, 0.4)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                animation: 'pulse 1.5s infinite',
              }}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && projects.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '16px',
            border: '1px border-dashed rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>No Projects Found</h3>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px', maxWidth: '400px', margin: '6px auto 20px' }}>
            {search ? 'No projects matched your search criteria.' : 'Create your first project workspace to start auditing quality and security.'}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              background: '#0284c7',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ＋ Create New Project
          </button>
        </div>
      )}

      {/* Project Cards Grid */}
      {!loading && projects.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
          {projects.map((proj) => {
            const badge = frameworkBadges[proj.framework] || { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', label: proj.framework };
            const isArchived = proj.status === 'ARCHIVED';

            return (
              <div
                key={proj.id}
                style={{
                  background: isArchived ? 'rgba(15, 23, 42, 0.4)' : 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(16px)',
                  border: isArchived ? '1px dashed rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                }}
              >
                <div>
                  {/* Top Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 800,
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.color}33`,
                      }}
                    >
                      • {badge.label}
                    </span>

                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: isArchived ? '#f59e0b' : '#22c55e',
                        background: isArchived ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      {proj.status}
                    </span>
                  </div>

                  {/* Project Name & Description */}
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: 0, marginBottom: '6px' }}>
                    {proj.name}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: 1.4, height: '36px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {proj.description || 'No description provided.'}
                  </p>

                  {proj.repoUrl && (
                    <div style={{ marginTop: '10px', fontSize: '12px', color: '#38bdf8', wordBreak: 'break-all' }}>
                      🔗 <a href={proj.repoUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>{proj.repoUrl}</a>
                    </div>
                  )}
                </div>

                {/* Bottom Stats & Action Bar */}
                <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#7c8ba6', fontWeight: 600 }}>Quality Score</div>
                      <div style={{ fontSize: '20px', fontWeight: 900, color: proj.qualityScore >= 90 ? '#22c55e' : proj.qualityScore >= 75 ? '#eab308' : '#ef4444' }}>
                        {proj.qualityScore}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: '#7c8ba6', fontWeight: 600 }}>Total Scans</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                        {proj.totalScans}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Link
                      href={`/live-scan?projectId=${proj.id}`}
                      style={{
                        flex: 1,
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        fontWeight: 700,
                        textDecoration: 'none',
                        textAlign: 'center',
                      }}
                    >
                      ⚡ Scan Now
                    </Link>

                    <button
                      onClick={() => duplicateProject(proj.id)}
                      title="Duplicate Project"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: '#94a3b8',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      📋 Copy
                    </button>

                    <button
                      onClick={() => updateProject(proj.id, { status: isArchived ? 'ACTIVE' : 'ARCHIVED' })}
                      title={isArchived ? 'Unarchive Project' : 'Archive Project'}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: '#94a3b8',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {isArchived ? '📂' : '📁'}
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Delete project "${proj.name}"? This cannot be undone.`)) {
                          deleteProject(proj.id);
                        }
                      }}
                      title="Delete Project"
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Project Modal Overlay */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 7, 18, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '20px',
              padding: '32px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#f8fafc', margin: 0 }}>Create New Project</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                  Project Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Web Client"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: '#090d16',
                    color: '#f8fafc',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                  Framework
                </label>
                <select
                  value={selectedFramework}
                  onChange={(e) => setSelectedFramework(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: '#090d16',
                    color: '#f8fafc',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="React">React</option>
                  <option value="Next.js">Next.js</option>
                  <option value="Angular">Angular</option>
                  <option value="Vue">Vue.js</option>
                  <option value="Svelte">Svelte</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                  Repository URL
                </label>
                <input
                  type="text"
                  placeholder="e.g. https://github.com/org/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: '#090d16',
                    color: '#f8fafc',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Brief overview of project scope..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: '#090d16',
                    color: '#f8fafc',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'transparent',
                    color: '#94a3b8',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
