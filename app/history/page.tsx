'use client';

import React from 'react';
import Link from 'next/link';
import { useScans } from '../../src/hooks/useScans';
import { formatScanDuration, formatMemoryDelta } from '../../src/lib/engine-diagnostics-format';

export default function HistoryPage() {
  const {
    records,
    total,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    loading,
    error,
    search,
    setSearch,
    framework,
    setFramework,
    onlyFavorites,
    setOnlyFavorites,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    toggleFavorite,
    deleteScan,
    exportReport,
  } = useScans();

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
          Persistent Inspection Database
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'rgba(0, 0, 0, 0.82)', margin: 0, letterSpacing: '-0.5px' }}>
          Scan History & Audit Logs
        </h1>
        <p style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '14px', marginTop: '6px', margin: 0 }}>
          Filter, search, audit, favorite, and export all recorded framework static analysis scans.
        </p>
      </div>

      {/* Toolbar Filters */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
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
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(0, 0, 0, 0.7)' }}>🔍</span>
          <input
            type="text"
            placeholder="Search scans by file name, framework, repository..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 40px',
              borderRadius: '8px',
              border: '1px solid rgba(0, 0, 0, 0.12)',
              background: 'rgba(255, 255, 255, 0.8)',
              color: 'rgba(0, 0, 0, 0.82)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Framework Filter */}
          <select
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(0, 0, 0, 0.12)',
              background: 'rgba(255, 255, 255, 0.8)',
              color: '#1d4ed8',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="ALL" style={{ background: '#ffffff', color: 'rgba(0, 0, 0, 0.82)' }}>All Frameworks</option>
            <option value="React" style={{ background: '#ffffff', color: 'rgba(0, 0, 0, 0.82)' }}>React</option>
            <option value="Next.js" style={{ background: '#ffffff', color: 'rgba(0, 0, 0, 0.82)' }}>Next.js</option>
            <option value="Angular" style={{ background: '#ffffff', color: 'rgba(0, 0, 0, 0.82)' }}>Angular</option>
            <option value="Vue" style={{ background: '#ffffff', color: 'rgba(0, 0, 0, 0.82)' }}>Vue</option>
          </select>

          {/* Favorite Filter Button */}
          <button
            onClick={() => setOnlyFavorites(!onlyFavorites)}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: onlyFavorites ? '1px solid #ef4444' : '1px solid rgba(0, 0, 0, 0.12)',
              background: onlyFavorites ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.8)',
              color: onlyFavorites ? '#ef4444' : 'rgba(0, 0, 0, 0.7)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⭐ {onlyFavorites ? 'Favorites Only' : 'All Scans'}
          </button>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(0, 0, 0, 0.12)',
              background: 'rgba(255, 255, 255, 0.8)',
              color: 'rgba(0, 0, 0, 0.82)',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="createdAt" style={{ background: '#ffffff', color: 'rgba(0, 0, 0, 0.82)' }}>Timestamp</option>
            <option value="qualityScore" style={{ background: '#ffffff', color: 'rgba(0, 0, 0, 0.82)' }}>Quality Score</option>
            <option value="scanTimeMs" style={{ background: '#ffffff', color: 'rgba(0, 0, 0, 0.82)' }}>Scan Time</option>
            <option value="ruleCount" style={{ background: '#ffffff', color: 'rgba(0, 0, 0, 0.82)' }}>Violations Count</option>
          </select>

          {/* Sort Order */}
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(0, 0, 0, 0.12)',
              background: 'rgba(255, 255, 255, 0.8)',
              color: 'rgba(0, 0, 0, 0.7)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>

          {/* Page Size Selector */}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(0, 0, 0, 0.12)',
              background: 'rgba(255, 255, 255, 0.8)',
              color: 'rgba(0, 0, 0, 0.82)',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
            }}
            title="Records Per Page"
          >
            <option value="10" style={{ background: '#ffffff', color: 'rgba(0, 0, 0, 0.82)' }}>10 Per Page</option>
            <option value="25" style={{ background: '#ffffff', color: 'rgba(0, 0, 0, 0.82)' }}>25 Per Page</option>
            <option value="50" style={{ background: '#ffffff', color: 'rgba(0, 0, 0, 0.82)' }}>50 Per Page</option>
            <option value="100" style={{ background: '#ffffff', color: 'rgba(0, 0, 0, 0.82)' }}>100 Per Page (Default)</option>
            <option value="250" style={{ background: '#ffffff', color: 'rgba(0, 0, 0, 0.82)' }}>Show All (250)</option>
          </select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: '14px 20px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '10px', color: '#1d4ed8', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ height: '70px', background: 'rgba(255, 255, 255, 0.4)', borderRadius: '12px' }} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && records.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(255, 255, 255, 0.4)', borderRadius: '16px', border: '1px border-dashed rgba(0, 0, 0, 0.1)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📜</div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.82)', margin: 0 }}>No Scan Records Found</h3>
          <p style={{ fontSize: '13px', color: 'rgba(0, 0, 0, 0.7)', marginTop: '6px' }}>Run a live scan to generate your first saved report.</p>
          <Link href="/live-scan" style={{ display: 'inline-block', marginTop: '16px', padding: '10px 20px', background: '#2563eb', color: '#ffffff', borderRadius: '8px', fontWeight: 700, textDecoration: 'none' }}>
            ⚡ Launch Live Scan
          </Link>
        </div>
      )}

      {/* Records Table / List */}
      {!loading && records.length > 0 && (
        <div style={{ background: 'rgba(255, 255, 255, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(0, 0, 0, 0.08)', borderRadius: '16px', padding: '12px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.08)', color: 'rgba(0, 0, 0, 0.7)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                <th style={{ padding: '14px 16px' }}>User ID</th>
                <th style={{ padding: '14px 16px' }}>Target File</th>
                <th style={{ padding: '14px 16px' }}>Framework</th>
                <th style={{ padding: '14px 16px' }}>Quality Score</th>
                <th style={{ padding: '14px 16px' }}>Violations</th>
                <th style={{ padding: '14px 16px' }}>Latency</th>
                <th style={{ padding: '14px 16px' }}>Memory</th>
                <th style={{ padding: '14px 16px' }}>Timestamp</th>
                <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                // Real userId, truncated for display -- never a guessed/fabricated label. Every
                // non-ADMIN caller of GET /api/scans is already scoped server-side to only their
                // own records (see app/api/scans/route.ts), so this column is mainly meaningful
                // for an ADMIN browsing across users; it must show who a scan genuinely belongs
                // to, not a heuristic re-branding of their real ID into a fake "P001" participant
                // label whenever it doesn't happen to match a hardcoded pattern.
                const shortUserId = r.userId.length > 12 ? `${r.userId.slice(0, 10)}…` : r.userId;

                return (
                <tr key={r.id} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)', transition: 'background 0.2s ease' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => toggleFavorite(r.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: 0 }}
                        title="Toggle Favorite"
                      >
                        {r.isFavorite ? '⭐' : '☆'}
                      </button>
                      <span
                        title={r.userId}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 800,
                          fontFamily: 'JetBrains Mono, monospace',
                          background: 'rgba(96, 165, 250, 0.15)',
                          color: '#1d4ed8',
                          border: '1px solid rgba(96, 165, 250, 0.35)',
                          letterSpacing: '0.5px'
                        }}>
                        {shortUserId}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: 'rgba(0, 0, 0, 0.82)', fontFamily: 'JetBrains Mono, monospace' }}>
                    <Link href={`/reports/${r.id}`} style={{ color: '#1d4ed8', textDecoration: 'none' }}>
                      {r.fileName}
                    </Link>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, background: 'rgba(96, 165, 250, 0.15)', color: '#1d4ed8' }}>
                      {r.framework}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontWeight: 800, color: r.qualityScore >= 90 ? '#3b82f6' : r.qualityScore >= 75 ? '#ef4444' : '#ef4444' }}>
                      {r.qualityScore}%
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: 'rgba(0, 0, 0, 0.7)' }}>
                    {r.ruleCount} violations ({r.aiFixCount} AI fixes)
                  </td>
                  <td style={{ padding: '14px 16px', color: 'rgba(0, 0, 0, 0.7)' }}>{formatScanDuration(r.scanTimeMs)}</td>
                  <td style={{ padding: '14px 16px', color: 'rgba(0, 0, 0, 0.7)' }}>{formatMemoryDelta(r.memoryUsageMb)}</td>
                  <td style={{ padding: '14px 16px', color: 'rgba(0, 0, 0, 0.7)', fontSize: '12px' }}>
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <Link
                        href={`/reports/${r.id}`}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: 'rgba(96, 165, 250, 0.12)',
                          color: '#1d4ed8',
                          textDecoration: 'none',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        View
                      </Link>

                      <button
                        onClick={() => exportReport(r.id, 'PDF')}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(0, 0, 0, 0.1)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'rgba(0, 0, 0, 0.7)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                        title="Export Report"
                      >
                        📥 Export
                      </button>

                      <button
                        onClick={() => {
                          if (confirm('Delete this scan record?')) deleteScan(r.id);
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#1d4ed8',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                        title="Delete Scan"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>

          {/* Pagination Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 8px 8px', borderTop: '1px solid rgba(0, 0, 0, 0.08)', marginTop: '8px' }}>
            <div style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.7)' }}>
              Showing {records.length} of {total} scan records (Page {page} of {totalPages})
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: page <= 1 ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.82)',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                }}
              >
                ← Previous
              </button>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: page >= totalPages ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.82)',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                }}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
