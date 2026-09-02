'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { primaryResearchDomain } from '../../src/matrix/four-layer-meta-model';

const RESEARCH_DOMAIN_LABEL: Record<string, string> = {
  ARCHITECTURE: '🏗️ Architecture',
  STATIC_PERFORMANCE: '⚡ Static Performance',
  ACCESSIBILITY: '♿ Accessibility',
};

interface DiagnosticReport {
  ruleId: string;
  ruleName: string;
  domain: string;
  concern: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  filePath: string;
  location: { start: { line: number } };
  offendingCodeSnippet: string;
  remediation: string;
  standardReference: string;
}

function DiagnosticsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [diagnostics, setDiagnostics] = useState<DiagnosticReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>(searchParams.get('severity') || 'ALL');
  const [domainFilter, setDomainFilter] = useState<string>(searchParams.get('domain') || 'ALL');
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('q') || '');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadDiagnostics() {
      try {
        setLoading(true);
        setErrorMsg(null);
        const res = await fetch('/api/report');
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
        const data = await res.json();
        setDiagnostics(data.allDiagnostics || []);
      } catch (err: any) {
        console.error('Failed to load diagnostics:', err);
        setErrorMsg(err.message || 'Failed to fetch scan diagnostics');
      } finally {
        setLoading(false);
      }
    }
    loadDiagnostics();
  }, []);

  useEffect(() => {
    const sev = searchParams.get('severity');
    const dom = searchParams.get('domain');
    const q = searchParams.get('q');
    if (sev) setSeverityFilter(sev);
    if (dom) setDomainFilter(dom);
    if (q) setSearchQuery(q);
  }, [searchParams]);

  const handleCopyCode = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const clearAllFilters = () => {
    setSeverityFilter('ALL');
    setDomainFilter('ALL');
    setSearchQuery('');
    router.push('/diagnostics');
  };

  const filteredDiagnostics = diagnostics.filter((d) => {
    if (severityFilter !== 'ALL' && d.severity !== severityFilter) return false;
    // Filters against the 3-way research-domain split (ARCHITECTURE / STATIC_PERFORMANCE /
    // ACCESSIBILITY), not the raw 2-value domain field a diagnostic carries -- see
    // primaryResearchDomain()'s own doc comment for why the raw field alone under-distinguishes
    // Architecture findings from Static Performance findings (docs/audit/STAGE_4_PRODUCTION_BROWSER_ACCEPTANCE_REPORT.md).
    if (domainFilter !== 'ALL' && primaryResearchDomain(d.domain, d.concern) !== domainFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesRule = d.ruleId.toLowerCase().includes(q) || d.ruleName.toLowerCase().includes(q);
      const matchesFile = d.filePath.toLowerCase().includes(q);
      const matchesSnippet = d.offendingCodeSnippet.toLowerCase().includes(q);
      if (!matchesRule && !matchesFile && !matchesSnippet) return false;
    }
    return true;
  });

  const isFilterActive = severityFilter !== 'ALL' || domainFilter !== 'ALL' || searchQuery.trim() !== '';

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.4px' }}>
            🔍 Issue & Fix Explorer
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
            Browse detected code issues by filename or severity, see exact line numbers, and learn how to fix them.
          </p>
        </div>

        <div style={{ fontSize: '13px', color: '#94a3b8', background: 'rgba(30, 41, 59, 0.6)', padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          Showing <strong>{filteredDiagnostics.length}</strong> of {diagnostics.length} issues
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="glass-panel"
        style={{
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1', minWidth: '260px' }}>
            <input
              type="text"
              placeholder="Search by filename, error type, or code line..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ width: '100%', paddingLeft: '34px' }}
            />
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#7c8ba6' }}>🔍</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Domain Filter Dropdown */}
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="select-field"
          >
            <option value="ALL">All Research Domains</option>
            <option value="ARCHITECTURE">🏗️ Architecture & Code Quality</option>
            <option value="STATIC_PERFORMANCE">⚡ Static Performance</option>
            <option value="ACCESSIBILITY">♿ Accessibility (WCAG 2.2)</option>
          </select>

          {/* Clear Filters Button */}
          {isFilterActive && (
            <button
              onClick={clearAllFilters}
              className="btn-secondary"
              style={{ padding: '8px 12px', fontSize: '12px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            >
              Reset Filters ✕
            </button>
          )}
        </div>

        {/* Severity Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginRight: '4px' }}>Filter by Severity:</span>
          {[
            { key: 'ALL', label: 'All Severities' },
            { key: 'CRITICAL', label: '🔴 Critical' },
            { key: 'HIGH', label: '🟠 High' },
            { key: 'MEDIUM', label: '🟡 Medium' },
            { key: 'LOW', label: '🟢 Low' },
          ].map((item) => {
            const isSelected = severityFilter === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setSeverityFilter(item.key)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: isSelected ? '1px solid currentColor' : '1px solid var(--border)',
                  background: isSelected
                    ? item.key === 'CRITICAL'
                      ? 'rgba(239, 68, 68, 0.25)'
                      : item.key === 'HIGH'
                      ? 'rgba(249, 115, 22, 0.25)'
                      : item.key === 'MEDIUM'
                      ? 'rgba(234, 179, 8, 0.25)'
                      : item.key === 'LOW'
                      ? 'rgba(34, 197, 94, 0.25)'
                      : 'rgba(56, 189, 248, 0.25)'
                    : 'rgba(9, 13, 22, 0.6)',
                  color: item.key === 'CRITICAL'
                    ? '#ef4444'
                    : item.key === 'HIGH'
                    ? '#f97316'
                    : item.key === 'MEDIUM'
                    ? '#eab308'
                    : item.key === 'LOW'
                    ? '#22c55e'
                    : '#38bdf8',
                  transition: 'all 0.2s ease',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Diagnostics List */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
          Loading issues...
        </div>
      ) : filteredDiagnostics.length === 0 ? (
        <div className="glass-panel" style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎯</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc' }}>No matching issues found</div>
          <div style={{ fontSize: '13px', marginTop: '4px' }}>Try clearing your search term or severity filter.</div>
          {isFilterActive && (
            <button onClick={clearAllFilters} className="btn-secondary" style={{ marginTop: '16px' }}>
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredDiagnostics.map((d, idx) => (
            <div
              key={idx}
              className="glass-panel"
              style={{
                padding: '22px',
                borderLeft: `4px solid ${
                  d.severity === 'CRITICAL'
                    ? '#ef4444'
                    : d.severity === 'HIGH'
                    ? '#f97316'
                    : d.severity === 'MEDIUM'
                    ? '#eab308'
                    : '#22c55e'
                }`,
              }}
            >
              {/* Card Header Row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span className={`badge badge-${d.severity.toLowerCase()}`}>{d.severity}</span>
                  <span className="badge badge-domain">{d.ruleId}</span>
                  <span className="badge badge-domain" style={{ fontSize: '10px', opacity: 0.85 }}>
                    {RESEARCH_DOMAIN_LABEL[primaryResearchDomain(d.domain, d.concern)]}
                  </span>
                  <strong style={{ fontSize: '16px', color: '#f8fafc' }}>{d.ruleName}</strong>
                </div>

                <div
                  style={{
                    fontSize: '12px',
                    color: '#38bdf8',
                    fontFamily: 'JetBrains Mono',
                    background: '#090d16',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    fontWeight: 600,
                  }}
                >
                  📍 {d.filePath} : Line {d.location.start.line}
                </div>
              </div>

              {/* Concern & Standard Reference */}
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '14px', lineHeight: 1.5 }}>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Why it matters:</span> {d.concern} &bull;{' '}
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Standard:</span>{' '}
                <span style={{ color: '#38bdf8', fontWeight: 500 }}>{d.standardReference}</span>
              </div>

              {/* Offending Code Snippet Box */}
              <div
                style={{
                  background: '#090d16',
                  borderRadius: '8px',
                  padding: '14px',
                  marginBottom: '14px',
                  border: '1px solid #1e293b',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#7c8ba6', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
                    Code Line with Issue
                  </span>
                  <button
                    onClick={() => handleCopyCode(d.offendingCodeSnippet, idx)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: copiedIdx === idx ? '#22c55e' : '#94a3b8',
                      fontSize: '11px',
                      padding: '3px 8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {copiedIdx === idx ? '✓ Copied' : '📋 Copy Code'}
                  </button>
                </div>
                <pre style={{ margin: 0, fontSize: '13px', color: '#f8fafc', fontFamily: 'JetBrains Mono', overflowX: 'auto' }}>
                  <code>{d.offendingCodeSnippet}</code>
                </pre>
              </div>

              {/* Remediation Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div
                  style={{
                    flex: 1,
                    fontSize: '13px',
                    color: '#86efac',
                    background: 'rgba(34, 197, 94, 0.08)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                  }}
                >
                  💡 <strong>Recommended Fix:</strong> {d.remediation}
                </div>

                <Link
                  href="/live-scan"
                  className="btn-secondary"
                  style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
                >
                  ⚡ Open in Live Inspector &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DiagnosticsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Loading Explorer...</div>}>
      <DiagnosticsContent />
    </Suspense>
  );
}
