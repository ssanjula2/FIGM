'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PasswordField from '../../components/PasswordField';

interface AdminProfileData {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    avatarUrl?: string;
    createdAt: string;
    lastLoginAt?: string;
  };
}

interface AuditLogEntry {
  id: string;
  action: string;
  status: 'SUCCESS' | 'FAILURE';
  details?: string;
  createdAt?: string;
  timestamp?: string;
  userId?: string;
  email?: string;
}

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('figm_token') : null;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const card: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.75)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '20px',
  padding: '32px',
};

/**
 * The ADMIN's own administrative profile -- separate from /admin's global "Users" tab (which lists
 * every user) and from /admin/participants (research subject data). This is one authenticated
 * account's own record, same as /profile, just presented in the admin workspace's own layout
 * (app/admin/layout.tsx gates the whole tree; app/admin/profile/layout.tsx narrows this specific
 * route to ADMIN only). Reuses /api/profile rather than a separate endpoint -- it already resolves
 * identity from the session token, never from client input, so there's nothing admin-specific left
 * to add server-side other than the page-level route guard.
 */
export default function AdminProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<AdminProfileData | null>(null);
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passSubmitting, setPassSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/profile', { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to load admin profile');
        const data = await res.json();
        if (data.user?.role !== 'ADMIN') {
          // Belt-and-suspenders: app/admin/profile/layout.tsx already redirects a non-ADMIN before
          // this component ever renders. This only covers the case where a role changed mid-session
          // and the client still holds a stale (but otherwise still valid) token/cookie.
          setError('This profile is only available to ADMIN accounts.');
          return;
        }
        setProfile(data);

        // Real audit-trail entries for this specific admin account, filtered client-side from the
        // shared /api/auth/audit-logs feed (ADMIN/AUDITOR authorized) -- not a fabricated "admin
        // action summary" metric, just this account's own recent LOGIN/RESET_PASSWORD/etc rows.
        const logsRes = await fetch('/api/auth/audit-logs', { headers: authHeaders() });
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          const mine = (logsData.logs || []).filter(
            (l: AuditLogEntry) => l.userId === data.user.id || l.email === data.user.email
          );
          setRecentActivity(mine.slice(0, 8));
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load admin profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);

    if (newPassword !== confirmPassword) {
      setPassMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      setPassMsg({ type: 'error', text: 'Password must be at least 8 characters long' });
      return;
    }

    setPassSubmitting(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ action: 'CHANGE_PASSWORD', currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Password update failed');
      setPassMsg({ type: 'success', text: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPassMsg({ type: 'error', text: err.message || 'Failed to change password' });
    } finally {
      setPassSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: '36px', marginBottom: '16px' }}>⏳</div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>Loading Admin Profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#ef4444' }}>
        <h2>Error Loading Admin Profile</h2>
        <p>{error}</p>
        <Link href="/admin" style={{ color: '#38bdf8', fontWeight: 700 }}>Back to Admin Overview</Link>
      </div>
    );
  }

  const { user } = profile;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/admin" style={{ color: '#94a3b8', fontSize: '13px', textDecoration: 'none', fontWeight: 600 }}>
          &larr; Back to Admin Overview
        </Link>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '13px', fontWeight: 800, color: '#f87171', letterSpacing: '1px', textTransform: 'uppercase', margin: 0 }}>
          🛡️ Admin Profile
        </h1>
        <p style={{ fontSize: '13px', color: '#7c8ba6', margin: '4px 0 0 0' }}>
          Manage your administrative account and security.
        </p>
      </div>

      <div style={{ ...card, marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f87171, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 900,
              color: '#ffffff',
              boxShadow: '0 0 20px rgba(248, 113, 113, 0.4)',
            }}
          >
            {user.fullName ? user.fullName[0].toUpperCase() : 'A'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#f8fafc', margin: 0 }}>{user.fullName}</h2>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 900,
                  background: 'rgba(248, 113, 113, 0.2)',
                  color: '#f87171',
                  border: '1px solid #f8717144',
                }}
              >
                ROLE: ADMIN
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
              {user.email} &bull; Administrator since {new Date(user.createdAt).toLocaleDateString()}
            </div>
            <div style={{ fontSize: '12px', color: '#7c8ba6', marginTop: '2px' }}>
              Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'No prior login recorded'}
            </div>
          </div>
        </div>

        <button
          onClick={async () => {
            try {
              await fetch('/api/auth/logout', { method: 'POST' });
            } catch {
              // Best-effort -- still clear local state and navigate away even if this fails.
            }
            localStorage.removeItem('figm_token');
            localStorage.removeItem('figm_user');
            router.push('/auth/login');
          }}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </div>

      <div style={{ ...card, marginBottom: '24px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc', marginTop: 0, marginBottom: '4px' }}>
          Recent Account Activity
        </h2>
        <p style={{ fontSize: '12px', color: '#7c8ba6', marginTop: 0, marginBottom: '16px' }}>
          Real audit-log entries for this admin account only (not aggregated system-wide activity).
        </p>
        {recentActivity.length === 0 ? (
          <div style={{ color: '#7c8ba6', fontSize: '13px' }}>No recent activity recorded for this account.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentActivity.map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.03)',
                  fontSize: '12px',
                }}
              >
                <span style={{ color: '#f8fafc', fontWeight: 700 }}>{log.action}</span>
                <span style={{ color: log.status === 'SUCCESS' ? '#34d399' : '#f87171' }}>{log.status}</span>
                <span style={{ color: '#7c8ba6' }}>
                  {log.createdAt || log.timestamp ? new Date(log.createdAt || log.timestamp!).toLocaleString() : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...card, marginBottom: '24px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc', marginTop: 0, marginBottom: '16px' }}>
          Change Password
        </h2>
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '400px' }}>
          <PasswordField
            id="admin-profile-current-password"
            label="Current password"
            hideLabel
            placeholder="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            useInputFieldClass={false}
            inputStyle={inputStyle}
          />
          <PasswordField
            id="admin-profile-new-password"
            label="New password"
            hideLabel
            placeholder="New password"
            value={newPassword}
            onChange={setNewPassword}
            useInputFieldClass={false}
            inputStyle={inputStyle}
          />
          <PasswordField
            id="admin-profile-confirm-password"
            label="Confirm new password"
            hideLabel
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            useInputFieldClass={false}
            inputStyle={inputStyle}
          />
          {passMsg && (
            <div role="alert" style={{ fontSize: '12px', color: passMsg.type === 'success' ? '#34d399' : '#f87171' }}>
              {passMsg.text}
            </div>
          )}
          <button
            type="submit"
            disabled={passSubmitting}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              fontWeight: 700,
              fontSize: '13px',
              cursor: passSubmitting ? 'not-allowed' : 'pointer',
              opacity: passSubmitting ? 0.6 : 1,
              width: 'fit-content',
            }}
          >
            {passSubmitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      <div style={{ ...card, fontSize: '13px', color: '#94a3b8' }}>
        Need to manage your API key or delete this account? Those actions live on your{' '}
        <Link href="/profile" style={{ color: '#38bdf8', fontWeight: 700 }}>personal profile page</Link> --
        the same underlying account record, just outside the admin workspace.
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '8px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#f8fafc',
  fontSize: '13px',
};
