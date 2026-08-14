'use client';

import React, { useState, useEffect } from 'react';

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'USERS' | 'HEALTH' | 'AUDIT'>('USERS');

  const [searchLog, setSearchLog] = useState('');

  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('figm_token') : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const [usersRes, systemRes] = await Promise.all([
        fetch('/api/admin/users', { headers }),
        fetch('/api/admin/system', { headers }),
      ]);

      const usersData = usersRes.ok ? await usersRes.json() : { users: [] };
      const systemData = systemRes.ok ? await systemRes.json() : {};

      setUsers(usersData.users || []);
      setSystemInfo(systemData);
      setAuditLogs(systemData.auditLogs || []);
    } catch (err: any) {
      setError(err.message || 'Admin authorization failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('figm_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (res.ok) {
        fetchAdminData();
      }
    } catch {
      alert('Failed to update user role');
    }
  };

  const handleResetPassword = async (userId: string) => {
    const pass = prompt('Enter new password for user:');
    if (!pass) return;
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('figm_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ userId, newPassword: pass }),
      });
      if (res.ok) {
        alert('Password reset successfully');
      }
    } catch {
      alert('Failed to reset password');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('figm_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/admin/users?userId=${userId}`, { method: 'DELETE', headers });
      if (res.ok) {
        fetchAdminData();
      }
    } catch {
      alert('Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>⚙️</div>
        <div>Loading Admin Platform Control Telemetry...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#ef4444' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛡️</div>
        <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#f8fafc', margin: 0 }}>Access Restricted</h2>
        <p style={{ color: '#94a3b8', marginTop: '8px', maxWidth: '500px', margin: '8px auto' }}>{error}</p>
        <div style={{ marginTop: '20px', fontSize: '13px', color: '#7c8ba6' }}>
          Please sign in with an <strong>ADMIN</strong> role account to view system logs and user administration.
        </div>
      </div>
    );
  }

  const filteredLogs = auditLogs.filter(
    (l) =>
      (l.action && l.action.toLowerCase().includes(searchLog.toLowerCase())) ||
      (l.email && l.email.toLowerCase().includes(searchLog.toLowerCase())) ||
      (l.details && l.details.toLowerCase().includes(searchLog.toLowerCase()))
  );

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
            SUPERADMIN PRIVILEGED CONTROL
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#f8fafc', margin: 0, letterSpacing: '-0.5px' }}>
            Platform Administration & Telemetry
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '6px', margin: 0 }}>
            System health, global user management, database storage breakdown, and real-time security audit trails.
          </p>
        </div>

        <button
          onClick={fetchAdminData}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#f8fafc',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          🔄 Refresh Telemetry
        </button>
      </div>

      {/* Usage Stats Overview Grid */}
      {systemInfo && systemInfo.usageStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>Total Registered Users</div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#38bdf8', marginTop: '6px' }}>
              {systemInfo.usageStats.totalUsers}
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>Total Projects Created</div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#a855f7', marginTop: '6px' }}>
              {systemInfo.usageStats.totalProjects}
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>Total Scans Recorded</div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#22c55e', marginTop: '6px' }}>
              {systemInfo.usageStats.totalScans}
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px' }}>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>Storage Database Size</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#f59e0b', marginTop: '8px' }}>
              {systemInfo.usageStats.storageSizeFormatted}
            </div>
          </div>
        </div>
      )}

      {/* Tabs Header */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '24px', gap: '24px' }}>
        {[
          { id: 'USERS', label: `Users Registry (${users.length})` },
          { id: 'HEALTH', label: 'System Health & Metrics' },
          { id: 'AUDIT', label: `Security Audit Logs (${auditLogs.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '12px 4px',
              border: 'none',
              background: 'none',
              fontSize: '14px',
              fontWeight: activeTab === tab.id ? 800 : 500,
              color: activeTab === tab.id ? '#38bdf8' : '#94a3b8',
              borderBottom: activeTab === tab.id ? '2px solid #38bdf8' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Users Registry */}
      {activeTab === 'USERS' && (
        <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '16px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#7c8ba6', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                <th style={{ padding: '14px 16px' }}>User Name</th>
                <th style={{ padding: '14px 16px' }}>Email Address</th>
                <th style={{ padding: '14px 16px' }}>Role</th>
                <th style={{ padding: '14px 16px' }}>Joined Date</th>
                <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: '#f8fafc' }}>
                    {u.fullName}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#38bdf8' }}>{u.email}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <select
                      value={u.role}
                      onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: '#090d16',
                        color: u.role === 'ADMIN' ? '#ef4444' : u.role === 'AUDITOR' ? '#f59e0b' : '#38bdf8',
                        fontWeight: 700,
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="DEVELOPER">DEVELOPER</option>
                      <option value="AUDITOR">AUDITOR</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#7c8ba6', fontSize: '12px' }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleResetPassword(u.id)}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}
                      >
                        Reset Pass
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '12px', cursor: 'pointer' }}
                      >
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

      {/* Tab 2: System Health */}
      {activeTab === 'HEALTH' && systemInfo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#22c55e', margin: '0 0 16px 0' }}>
              💚 Node.js Runtime Status
            </h4>
            <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.8 }}>
              <div><strong>Status:</strong> <span style={{ color: '#22c55e' }}>{systemInfo.systemHealth.status}</span></div>
              <div><strong>Node Version:</strong> {systemInfo.systemHealth.nodeVersion}</div>
              <div><strong>System Uptime:</strong> {systemInfo.systemHealth.uptimeSeconds} seconds</div>
              <div><strong>API Latency:</strong> {systemInfo.systemHealth.apiLatencyMs} ms</div>
              <div><strong>Simulated CPU Load:</strong> {systemInfo.systemHealth.cpuLoadPercentage}%</div>
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '24px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#38bdf8', margin: '0 0 16px 0' }}>
              🧠 Memory Heap Usage
            </h4>
            <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.8 }}>
              <div><strong>Heap Used:</strong> {(systemInfo.systemHealth.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB</div>
              <div><strong>Heap Total:</strong> {(systemInfo.systemHealth.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB</div>
              <div><strong>RSS:</strong> {(systemInfo.systemHealth.memoryUsage.rss / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Security Audit Logs */}
      {activeTab === 'AUDIT' && (
        <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              placeholder="Search audit logs by action, email, IP..."
              value={searchLog}
              onChange={(e) => setSearchLog(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#090d16', color: '#f8fafc', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#7c8ba6', fontWeight: 800 }}>
                  <th style={{ padding: '10px' }}>Action</th>
                  <th style={{ padding: '10px' }}>User Email</th>
                  <th style={{ padding: '10px' }}>Details</th>
                  <th style={{ padding: '10px' }}>IP Address</th>
                  <th style={{ padding: '10px' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 700, fontFamily: 'monospace' }}>
                        {l.action}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: '#f8fafc' }}>{l.email || 'Anonymous'}</td>
                    <td style={{ padding: '10px', color: '#94a3b8' }}>{l.details || '-'}</td>
                    <td style={{ padding: '10px', color: '#7c8ba6', fontFamily: 'monospace' }}>{l.ipAddress}</td>
                    <td style={{ padding: '10px', color: '#7c8ba6' }}>{new Date(l.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
