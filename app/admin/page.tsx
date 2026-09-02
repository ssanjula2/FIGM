'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import PasswordField from '../components/PasswordField';
import { HUMAN_STUDY_TARGET_PARTICIPANTS } from '../../src/research/research-config';

type Tab = 'OVERVIEW' | 'USERS' | 'PARTICIPANTS' | 'SCANS' | 'RESEARCH' | 'FRAMEWORKS' | 'RULES' | 'AUDIT' | 'HEALTH';

const TABS: { id: Tab; label: string }[] = [
  { id: 'OVERVIEW', label: 'Overview' },
  { id: 'USERS', label: 'Users' },
  { id: 'PARTICIPANTS', label: 'Participants' },
  { id: 'SCANS', label: 'Scan History' },
  { id: 'RESEARCH', label: 'Research Metrics' },
  { id: 'FRAMEWORKS', label: 'Framework Analytics' },
  { id: 'RULES', label: 'Rule Analytics' },
  { id: 'AUDIT', label: 'Audit Logs' },
  { id: 'HEALTH', label: 'System Health' },
];

const card: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.65)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '14px',
  padding: '20px',
};

const statTile = (label: string, value: React.ReactNode, color: string) => (
  <div style={card} key={label}>
    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>{label}</div>
    <div style={{ fontSize: '28px', fontWeight: 900, color, marginTop: '6px' }}>{value}</div>
  </div>
);

const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left' };
const td: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' };
const badge = (color: string, bg: string) => ({
  padding: '2px 8px',
  borderRadius: '6px',
  fontSize: '11px',
  fontWeight: 800,
  color,
  background: bg,
  border: `1px solid ${color}44`,
});

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('figm_token') : null;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Fetches an admin API endpoint and surfaces a clear, specific message for 401/403 instead of
 *  silently falling back to an empty-data state (the previous version of this page did the
 *  latter -- a DEVELOPER visiting /admin saw a blank dashboard instead of a real "Access
 *  Restricted" explanation, since `res.ok ? json() : {}` swallows non-2xx responses entirely). */
async function fetchAdmin<T>(url: string): Promise<{ data: T | null; authError: string | null }> {
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 401) return { data: null, authError: 'You must be signed in to view this.' };
  if (res.status === 403) return { data: null, authError: 'This area requires an ADMIN role account.' };
  if (!res.ok) return { data: null, authError: `Request failed (${res.status}).` };
  return { data: (await res.json()) as T, authError: null };
}

const VALID_TABS = new Set<Tab>(TABS.map((t) => t.id));

function isValidTab(value: string | null): value is Tab {
  return !!value && VALID_TABS.has(value as Tab);
}

// AdminSidebar's nav links (app/AdminSidebar.tsx) point at /admin?tab=X so a direct link/refresh
// lands on the right tab -- useSearchParams() requires its own Suspense boundary to avoid opting
// this whole route out of static prerendering (same pattern as app/auth/login/page.tsx).
export default function AdminPage() {
  return (
    <Suspense fallback={<div style={{ padding: '80px 20px', textAlign: 'center', color: '#94a3b8' }}>Loading Admin Platform...</div>}>
      <AdminDashboard />
    </Suspense>
  );
}

function AdminDashboard() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(isValidTab(initialTab) ? initialTab : 'OVERVIEW');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState<any[]>([]);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [scans, setScans] = useState<any>({ records: [], total: 0, page: 1, totalPages: 1 });
  const [scanFilters, setScanFilters] = useState({ participantId: '', framework: '', severity: '', search: '', page: 1 });
  const [research, setResearch] = useState<any>(null);
  const [ruleStats, setRuleStats] = useState<any>(null);
  const [searchLog, setSearchLog] = useState('');

  // Admin password-reset modal state. Replaces a previous window.prompt()-based flow: prompt()
  // renders as plain, unmasked text (no type="password" equivalent), can't offer a confirm field
  // or a Show/Hide toggle, and gives the server-side strength-policy error nowhere to surface --
  // all of which this modal fixes while keeping the same server-side validation as every other
  // password-entry point in the app.
  const [resetPasswordTarget, setResetPasswordTarget] = useState<{ id: string; label: string } | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetPasswordSubmitting, setResetPasswordSubmitting] = useState(false);

  // Client-side role hint only -- purely a UX shortcut so a non-admin never even sees a flash of
  // "Loading Admin Platform..." before the (authoritative, server-side) API 403 arrives. The real
  // security boundary is authorizeRole(['ADMIN']) on every /api/admin/* route below, not this.
  const [clientRole, setClientRole] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('figm_user');
      if (raw) setClientRole(JSON.parse(raw).role || null);
    } catch {
      // ignore
    }
  }, []);

  const loadCore = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    const [usersRes, systemRes] = await Promise.all([
      fetchAdmin<{ users: any[] }>('/api/admin/users'),
      fetchAdmin<any>('/api/admin/system'),
    ]);
    if (usersRes.authError) {
      setAuthError(usersRes.authError);
      setLoading(false);
      return;
    }
    setUsers(usersRes.data?.users || []);
    setSystemInfo(systemRes.data || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  useEffect(() => {
    if (authError) return;
    if (tab === 'PARTICIPANTS') {
      fetchAdmin<{ participants: any[] }>(`/api/admin/participants?search=${encodeURIComponent(participantSearch)}`).then((r) => {
        if (r.authError) setAuthError(r.authError);
        else setParticipants(r.data?.participants || []);
      });
    }
    if (tab === 'SCANS') {
      const params = new URLSearchParams();
      params.set('page', String(scanFilters.page));
      params.set('pageSize', '25');
      if (scanFilters.participantId) params.set('participantId', scanFilters.participantId);
      if (scanFilters.framework) params.set('framework', scanFilters.framework);
      if (scanFilters.severity) params.set('severity', scanFilters.severity);
      if (scanFilters.search) params.set('search', scanFilters.search);
      fetchAdmin<any>(`/api/admin/scans?${params.toString()}`).then((r) => {
        if (r.authError) setAuthError(r.authError);
        else setScans(r.data || { records: [], total: 0, page: 1, totalPages: 1 });
      });
    }
    if (tab === 'RESEARCH' && !research) {
      fetch('/api/research-metrics')
        .then((r) => r.json())
        .then(setResearch)
        .catch(() => setResearch(null));
    }
    if (tab === 'RULES') {
      fetchAdmin<any>('/api/admin/rule-stats').then((r) => {
        if (r.authError) setAuthError(r.authError);
        else setRuleStats(r.data || null);
      });
    }
  }, [tab, participantSearch, scanFilters, authError, research]);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ userId, role: newRole }),
    });
    if (res.ok) loadCore();
  };

  const openResetPassword = (userId: string, label: string) => {
    setResetPasswordTarget({ id: userId, label });
    setResetPasswordValue('');
    setResetPasswordConfirm('');
    setResetPasswordError(null);
  };

  const closeResetPassword = () => {
    setResetPasswordTarget(null);
    setResetPasswordValue('');
    setResetPasswordConfirm('');
    setResetPasswordError(null);
  };

  const submitResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordTarget) return;
    setResetPasswordError(null);

    if (resetPasswordValue !== resetPasswordConfirm) {
      setResetPasswordError('Passwords do not match');
      return;
    }

    setResetPasswordSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId: resetPasswordTarget.id, newPassword: resetPasswordValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Surfaces the real server-side policy error (e.g. WEAK_PASSWORD) instead of assuming
        // success -- adminResetPassword() enforces the same validatePassword() policy as every
        // other password-entry point, and a weak admin-supplied password is now rejected with a
        // real 400 rather than silently persisted.
        setResetPasswordError(data.error || 'Failed to reset password');
        return;
      }
      closeResetPassword();
    } catch {
      setResetPasswordError('Failed to reset password');
    } finally {
      setResetPasswordSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    const res = await fetch(`/api/admin/users?userId=${userId}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok) loadCore();
  };

  if (clientRole && clientRole !== 'ADMIN') {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛡️</div>
        <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#f8fafc', margin: 0 }}>Access Restricted</h2>
        <p style={{ color: '#94a3b8', marginTop: '8px' }}>This area requires an ADMIN role account. Your account role is {clientRole}.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>⚙️</div>
        <div>Loading Admin Platform Control Telemetry...</div>
      </div>
    );
  }

  if (authError) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛡️</div>
        <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#f8fafc', margin: 0 }}>Access Restricted</h2>
        <p style={{ color: '#94a3b8', marginTop: '8px', maxWidth: '500px', margin: '8px auto' }}>{authError}</p>
      </div>
    );
  }

  const auditLogs: any[] = systemInfo?.auditLogs || [];
  const filteredLogs = auditLogs.filter(
    (l) =>
      (l.action && l.action.toLowerCase().includes(searchLog.toLowerCase())) ||
      (l.email && l.email.toLowerCase().includes(searchLog.toLowerCase())) ||
      (l.details && l.details.toLowerCase().includes(searchLog.toLowerCase()))
  );

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
            ADMIN — RESEARCH &amp; PLATFORM CONTROL
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#f8fafc', margin: 0, letterSpacing: '-0.5px' }}>Admin Dashboard</h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '6px', margin: 0 }}>
            Real, database-backed platform telemetry, user management, and research participant records.
          </p>
        </div>
        <button
          onClick={loadCore}
          style={{ padding: '10px 18px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
        >
          🔄 Refresh
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '24px', gap: '4px', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            style={{
              padding: '10px 14px',
              border: 'none',
              background: 'none',
              fontSize: '13px',
              fontWeight: tab === t.id ? 800 : 500,
              color: tab === t.id ? '#38bdf8' : '#94a3b8',
              borderBottom: tab === t.id ? '2px solid #38bdf8' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'OVERVIEW' && systemInfo?.usageStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          {statTile('Total Registered Users', systemInfo.usageStats.totalUsers, '#38bdf8')}
          {statTile('Total Projects', systemInfo.usageStats.totalProjects, '#a855f7')}
          {statTile('Total Scans Recorded', systemInfo.usageStats.totalScans, '#22c55e')}
          {statTile('Research Participants Registered', participants.length > 0 ? participants.filter((p) => p.status !== 'NOT_REGISTERED').length : '—', '#f59e0b')}
          {statTile('Storage Provider', systemInfo.storageUsage?.storageProvider?.startsWith('Postgres') ? 'Postgres (Supabase)' : 'JSON fallback', '#f8fafc')}
        </div>
      )}

      {tab === 'USERS' && (
        <div style={{ ...card, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#7c8ba6', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                <th style={th}>User Name</th>
                <th style={th}>Email</th>
                <th style={th}>Role</th>
                <th style={th}>Joined</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ ...td, fontWeight: 700, color: '#f8fafc' }}>{u.fullName}</td>
                  <td style={{ ...td, color: '#38bdf8' }}>{u.email}</td>
                  <td style={td}>
                    <select
                      value={u.role}
                      onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                      aria-label={`Role for ${u.fullName}`}
                      style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.12)', background: '#090d16', color: u.role === 'ADMIN' ? '#ef4444' : u.role === 'AUDITOR' ? '#f59e0b' : '#38bdf8', fontWeight: 700, fontSize: '11px' }}
                    >
                      <option value="DEVELOPER">DEVELOPER</option>
                      <option value="AUDITOR">AUDITOR</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td style={{ ...td, color: '#7c8ba6', fontSize: '12px' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => openResetPassword(u.id, u.fullName || u.email)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
                        Reset Pass
                      </button>
                      <button onClick={() => handleDeleteUser(u.id)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: '12px', cursor: 'pointer' }}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'PARTICIPANTS' && (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search participant ID (e.g. P001)..."
              value={participantSearch}
              onChange={(e) => setParticipantSearch(e.target.value)}
              aria-label="Search participant ID"
              style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: '#090d16', color: '#f8fafc', fontSize: '13px', minWidth: '260px' }}
            />
            <span style={{ color: '#7c8ba6', fontSize: '12px' }}>
              {participants.filter((p) => p.status !== 'NOT_REGISTERED').length} of {participants.length} identifiers have a real record
            </span>
          </div>
          <div style={{ ...card, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#7c8ba6', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                  <th style={th}>Participant ID</th>
                  <th style={th}>Status</th>
                  <th style={th}>Total Scans</th>
                  <th style={th}>Frameworks Used</th>
                  <th style={th}>Latest Quality Score</th>
                  <th style={th}>Total Findings</th>
                  <th style={th}>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.participantId}>
                    <td style={td}>
                      {p.status === 'NOT_REGISTERED' ? (
                        <span style={{ color: '#f8fafc', fontWeight: 700 }}>{p.participantId}</span>
                      ) : (
                        <Link href={`/admin/participants/${p.participantId}`} style={{ color: '#38bdf8', fontWeight: 700, textDecoration: 'none' }}>
                          {p.participantId}
                        </Link>
                      )}
                    </td>
                    <td style={td}>
                      {p.status === 'NOT_REGISTERED' ? (
                        <span style={badge('#7c8ba6', 'rgba(124,139,166,0.12)')}>Not Recorded</span>
                      ) : p.status === 'SUBMITTED' ? (
                        <span style={badge('#22c55e', 'rgba(34,197,94,0.12)')}>SUBMITTED</span>
                      ) : p.status === 'SCANNED' ? (
                        <span style={badge('#38bdf8', 'rgba(56,189,248,0.12)')}>SCANNED</span>
                      ) : (
                        <span style={badge('#f59e0b', 'rgba(245,158,11,0.12)')}>REGISTERED</span>
                      )}
                    </td>
                    <td style={{ ...td, color: '#f8fafc' }}>{p.status === 'NOT_REGISTERED' ? '—' : p.totalScans}</td>
                    <td style={{ ...td, color: '#94a3b8' }}>{p.frameworksUsed.length > 0 ? p.frameworksUsed.join(', ') : '—'}</td>
                    <td style={{ ...td, color: '#f8fafc' }}>{p.latestQualityScore ?? '—'}</td>
                    <td style={{ ...td, color: '#f8fafc' }}>{p.status === 'NOT_REGISTERED' ? '—' : p.totalFindings}</td>
                    <td style={{ ...td, color: '#7c8ba6', fontSize: '12px' }}>{p.lastActivity ? new Date(p.lastActivity).toLocaleString() : 'No Submission'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'SCANS' && (
        <div>
          <div style={{ marginBottom: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search file name..."
              value={scanFilters.search}
              onChange={(e) => setScanFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: '#090d16', color: '#f8fafc', fontSize: '13px' }}
            />
            <input
              type="text"
              placeholder="Participant/User ID..."
              value={scanFilters.participantId}
              onChange={(e) => setScanFilters((f) => ({ ...f, participantId: e.target.value, page: 1 }))}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: '#090d16', color: '#f8fafc', fontSize: '13px' }}
            />
            <select
              value={scanFilters.framework}
              onChange={(e) => setScanFilters((f) => ({ ...f, framework: e.target.value, page: 1 }))}
              aria-label="Framework filter"
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: '#090d16', color: '#38bdf8', fontSize: '13px' }}
            >
              <option value="">All Frameworks</option>
              <option value="React">React</option>
              <option value="Next">Next.js</option>
              <option value="Angular">Angular</option>
              <option value="Vue">Vue</option>
            </select>
            <select
              value={scanFilters.severity}
              onChange={(e) => setScanFilters((f) => ({ ...f, severity: e.target.value, page: 1 }))}
              aria-label="Severity filter"
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: '#090d16', color: '#38bdf8', fontSize: '13px' }}
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">Has Critical</option>
              <option value="HIGH">Has High</option>
              <option value="MEDIUM">Has Medium</option>
              <option value="LOW">Has Low</option>
            </select>
          </div>
          <div style={{ ...card, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#7c8ba6', fontWeight: 800 }}>
                  <th style={th}>Owner</th>
                  <th style={th}>File</th>
                  <th style={th}>Framework</th>
                  <th style={th}>Quality</th>
                  <th style={th}>Findings</th>
                  <th style={th}>Severity</th>
                  <th style={th}>Duration</th>
                  <th style={th}>Created</th>
                </tr>
              </thead>
              <tbody>
                {(scans.records || []).map((r: any) => (
                  <tr key={r.id}>
                    <td style={td}>
                      <div style={{ color: '#f8fafc', fontWeight: 700 }}>{r.owner?.fullName || r.userId}</div>
                      <div style={{ color: '#7c8ba6', fontSize: '11px' }}>{r.owner?.email || ''}</div>
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#38bdf8' }}>{r.fileName}</td>
                    <td style={{ ...td, color: '#94a3b8' }}>{r.framework}</td>
                    <td style={{ ...td, color: '#f8fafc' }}>{r.qualityScore}%</td>
                    <td style={{ ...td, color: '#f8fafc' }}>{r.ruleCount}</td>
                    <td style={td}>
                      {r.criticalCount > 0 && <span style={{ ...badge('#ef4444', 'rgba(239,68,68,0.12)'), marginRight: '4px' }}>{r.criticalCount}C</span>}
                      {r.highCount > 0 && <span style={{ ...badge('#f59e0b', 'rgba(245,158,11,0.12)'), marginRight: '4px' }}>{r.highCount}H</span>}
                      {r.mediumCount > 0 && <span style={badge('#38bdf8', 'rgba(56,189,248,0.12)')}>{r.mediumCount}M</span>}
                    </td>
                    <td style={{ ...td, color: '#94a3b8' }}>{r.scanTimeMs?.toFixed(2)} ms</td>
                    <td style={{ ...td, color: '#7c8ba6' }}>{new Date(r.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', color: '#94a3b8', fontSize: '12px' }}>
            <span>Showing page {scans.page} of {scans.totalPages} ({scans.total} total records)</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button disabled={scans.page <= 1} onClick={() => setScanFilters((f) => ({ ...f, page: f.page - 1 }))} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#f8fafc', cursor: scans.page <= 1 ? 'not-allowed' : 'pointer', opacity: scans.page <= 1 ? 0.5 : 1 }}>
                ← Previous
              </button>
              <button disabled={scans.page >= scans.totalPages} onClick={() => setScanFilters((f) => ({ ...f, page: f.page + 1 }))} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#f8fafc', cursor: scans.page >= scans.totalPages ? 'not-allowed' : 'pointer', opacity: scans.page >= scans.totalPages ? 0.5 : 1 }}>
                Next →
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'RESEARCH' && (
        <div style={{ display: 'grid', gap: '20px' }}>
          {!research && <div style={{ color: '#94a3b8' }}>Loading research metrics...</div>}
          {research && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                {statTile('Precision', research.benchmarkMetrics?.precision != null ? `${(research.benchmarkMetrics.precision * 100).toFixed(1)}%` : 'N/A', '#38bdf8')}
                {statTile('Recall', research.benchmarkMetrics?.recall != null ? `${(research.benchmarkMetrics.recall * 100).toFixed(1)}%` : 'N/A', '#a855f7')}
                {statTile('F1 Score', research.benchmarkMetrics?.f1Score != null ? `${(research.benchmarkMetrics.f1Score * 100).toFixed(1)}%` : 'N/A', '#22c55e')}
                {statTile('Human Study Participants', `${research.userStudy?.collectedParticipants ?? 0} / ${research.userStudy?.targetParticipants ?? HUMAN_STUDY_TARGET_PARTICIPANTS}`, '#f59e0b')}
              </div>
              <div style={card}>
                <h4 style={{ margin: '0 0 8px 0', color: '#f8fafc' }}>Human Study Status</h4>
                <div style={{ color: '#94a3b8', fontSize: '13px' }}>{research.userStudy?.note}</div>
                <div style={{ color: research.userStudy?.isRealHumanData ? '#22c55e' : '#f59e0b', fontSize: '12px', fontWeight: 700, marginTop: '8px' }}>
                  {research.userStudy?.collectionStatus}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'FRAMEWORKS' && systemInfo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {(['react', 'nextjs', 'angular', 'vue', 'generic'] as const).map((k) => (
            <FrameworkTile key={k} name={k} />
          ))}
        </div>
      )}

      {tab === 'RULES' && (
        <div>
          {!ruleStats && <div style={{ color: '#94a3b8' }}>Loading rule analytics...</div>}
          {ruleStats && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                {statTile('Scans Analyzed', ruleStats.totalScansAnalyzed, '#38bdf8')}
                {statTile('Total Findings', ruleStats.totalFindings, '#a855f7')}
                {statTile('Distinct Rules Triggered', ruleStats.ruleStats.length, '#22c55e')}
              </div>
              <div style={{ ...card, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#7c8ba6', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                      <th style={th}>Rule ID</th>
                      <th style={th}>Name</th>
                      <th style={th}>Severity</th>
                      <th style={th}>Occurrences</th>
                      <th style={th}>Scans Triggered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ruleStats.ruleStats.length === 0 ? (
                      <tr>
                        <td style={td} colSpan={5}>
                          No real scan data yet — rule statistics will populate as scans are recorded.
                        </td>
                      </tr>
                    ) : (
                      ruleStats.ruleStats.map((r: any) => (
                        <tr key={r.ruleId}>
                          <td style={{ ...td, fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>{r.ruleId}</td>
                          <td style={{ ...td, color: '#f8fafc' }}>{r.ruleName || '—'}</td>
                          <td style={td}>{r.severity && <span style={badge('#f87171', 'rgba(239,68,68,0.12)')}>{r.severity}</span>}</td>
                          <td style={{ ...td, color: '#f8fafc' }}>{r.totalOccurrences}</td>
                          <td style={{ ...td, color: '#94a3b8' }}>{r.scansTriggered}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'AUDIT' && (
        <div style={card}>
          <input
            type="text"
            placeholder="Search audit logs by action, email, IP..."
            value={searchLog}
            onChange={(e) => setSearchLog(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: '#090d16', color: '#f8fafc', fontSize: '13px', boxSizing: 'border-box', marginBottom: '16px' }}
          />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#7c8ba6', fontWeight: 800 }}>
                  <th style={th}>Action</th>
                  <th style={th}>User Email</th>
                  <th style={th}>Details</th>
                  <th style={th}>IP Address</th>
                  <th style={th}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((l) => (
                  <tr key={l.id}>
                    <td style={td}>
                      <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontWeight: 700, fontFamily: 'monospace' }}>{l.action}</span>
                    </td>
                    <td style={{ ...td, color: '#f8fafc' }}>{l.email || 'Anonymous'}</td>
                    <td style={{ ...td, color: '#94a3b8' }}>{l.details || '-'}</td>
                    <td style={{ ...td, color: '#7c8ba6', fontFamily: 'monospace' }}>{l.ipAddress}</td>
                    <td style={{ ...td, color: '#7c8ba6' }}>{new Date(l.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'HEALTH' && systemInfo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          <div style={card}>
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#22c55e', margin: '0 0 16px 0' }}>💚 Node.js Runtime Status</h4>
            <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.8 }}>
              <div><strong>Status:</strong> <span style={{ color: '#22c55e' }}>{systemInfo.systemHealth.status}</span></div>
              <div><strong>Node Version:</strong> {systemInfo.systemHealth.nodeVersion}</div>
              <div><strong>Uptime:</strong> {systemInfo.systemHealth.uptimeSeconds}s</div>
              <div><strong>Storage Provider:</strong> {systemInfo.storageUsage?.storageProvider}</div>
              <div><strong>DB Connected:</strong> {systemInfo.databaseStatistics?.connected ? 'Yes' : 'No (JSON fallback)'}</div>
            </div>
          </div>
          <div style={card}>
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#38bdf8', margin: '0 0 16px 0' }}>🧠 Memory Heap Usage</h4>
            <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.8 }}>
              <div><strong>Heap Used:</strong> {(systemInfo.systemHealth.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB</div>
              <div><strong>Heap Total:</strong> {(systemInfo.systemHealth.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB</div>
              <div><strong>RSS:</strong> {(systemInfo.systemHealth.memoryUsage.rss / 1024 / 1024).toFixed(2)} MB</div>
              <div><strong>Last Query Batch:</strong> {systemInfo.databaseStatistics?.lastQueryBatchMs} ms</div>
            </div>
          </div>
        </div>
      )}

      {resetPasswordTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-password-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 7, 18, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              background: '#0b1120',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
          >
            <h3 id="reset-password-modal-title" style={{ fontSize: '17px', fontWeight: 800, color: '#f8fafc', margin: '0 0 4px 0' }}>
              Reset Password
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0' }}>
              For <strong style={{ color: '#38bdf8' }}>{resetPasswordTarget.label}</strong>. This immediately revokes their existing session.
            </p>

            {resetPasswordError && (
              <div role="alert" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                ⚠️ {resetPasswordError}
              </div>
            )}

            <form onSubmit={submitResetPassword}>
              <div style={{ marginBottom: '16px' }}>
                <PasswordField
                  id="admin-reset-password-new"
                  label="New Password"
                  hint="min 8 chars, 1 uppercase, 1 number"
                  useInputFieldClass={false}
                  value={resetPasswordValue}
                  onChange={setResetPasswordValue}
                />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <PasswordField
                  id="admin-reset-password-confirm"
                  label="Confirm New Password"
                  useInputFieldClass={false}
                  value={resetPasswordConfirm}
                  onChange={setResetPasswordConfirm}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={closeResetPassword}
                  style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#94a3b8', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetPasswordSubmitting}
                  style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#0284c7', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: resetPasswordSubmitting ? 'not-allowed' : 'pointer', opacity: resetPasswordSubmitting ? 0.7 : 1 }}
                >
                  {resetPasswordSubmitting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/** Real, live framework distribution -- reuses the same public global-summary computation the
 *  homepage dashboard's framework chart uses (DashboardRepository.getSummary()), not a second,
 *  hand-maintained copy. */
function FrameworkTile({ name }: { name: 'react' | 'nextjs' | 'angular' | 'vue' | 'generic' }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    fetch('/api/dashboard/frameworks')
      .then((r) => r.json())
      .then((d) => setCount(d.frameworks?.[name] ?? 0))
      .catch(() => setCount(null));
  }, [name]);
  const labels: Record<string, string> = { react: 'React', nextjs: 'Next.js', angular: 'Angular', vue: 'Vue', generic: 'Generic' };
  return statTile(labels[name], count ?? '—', '#38bdf8');
}
