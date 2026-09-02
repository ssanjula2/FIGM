'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSettings } from '../../src/hooks/useSettings';
import PasswordField from '../components/PasswordField';

interface UserProfileData {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    apiKey?: string;
    avatarUrl?: string;
    createdAt: string;
  };
  stats: {
    projectCount: number;
    reportCount: number;
    averageScore: number;
  };
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { settings, updateSettings } = useSettings();
  const router = useRouter();

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passSubmitting, setPassSubmitting] = useState(false);

  // API Key state
  const [showApiKey, setShowApiKey] = useState(false);
  const [copied, setCopied] = useState(false);

  // Delete modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const deleteModalRef = useRef<HTMLDivElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);

  // Same focus-trap/Escape/focus-restore pattern as the Cmd+K modal (app/HeaderBar.tsx) --
  // previously this dialog had no dialog semantics at all: no role, no focus trap, no Escape
  // handling, and opening it left focus wherever it already was instead of moving into the modal.
  useEffect(() => {
    if (!isDeleteModalOpen) return;

    // Captured now, not read from the ref inside cleanup below -- by the time cleanup runs,
    // `deleteTriggerRef.current` could in principle point at a different node than the one that
    // was actually focused when this effect opened the dialog (same rationale as HeaderBar.tsx's
    // Cmd+K modal, which this pattern mirrors).
    const triggerEl = deleteTriggerRef.current;
    deleteCancelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDeleteModalOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !deleteModalRef.current) return;
      const focusable = deleteModalRef.current.querySelectorAll<HTMLElement>('button:not([disabled])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      triggerEl?.focus();
    };
  }, [isDeleteModalOpen]);

  const fetchProfile = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('figm_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/profile', { headers });
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('figm_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          action: 'CHANGE_PASSWORD',
          currentPassword,
          newPassword,
        }),
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

  const handleRegenerateApiKey = async () => {
    if (!confirm('Are you sure you want to regenerate your API key?')) return;
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('figm_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: 'REGENERATE_API_KEY' }),
      });
      if (res.ok) {
        await fetchProfile();
        alert('API Key regenerated successfully!');
      }
    } catch {
      alert('Failed to regenerate API key');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('figm_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/profile', { method: 'DELETE', headers });
      if (res.ok) {
        localStorage.removeItem('figm_token');
        localStorage.removeItem('figm_user');
        router.push('/auth/login');
      } else {
        alert('Failed to delete account');
      }
    } catch {
      alert('Failed to delete account');
    }
  };

  const copyApiKey = () => {
    if (profile?.user.apiKey) {
      navigator.clipboard.writeText(profile.user.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: '36px', marginBottom: '16px' }}>⏳</div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>Loading User Profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#ef4444' }}>
        <h2>Error Loading Profile</h2>
        <p>{error}</p>
        <Link href="/auth/login" style={{ color: '#38bdf8', fontWeight: 700 }}>Go to Login</Link>
      </div>
    );
  }

  const { user, stats } = profile;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8', letterSpacing: '1px', textTransform: 'uppercase', margin: 0 }}>
          👤 My Profile
        </h1>
        <p style={{ fontSize: '13px', color: '#7c8ba6', margin: '4px 0 0 0' }}>
          Manage your personal account and activity.
        </p>
      </div>

      {/* Note: the account-name heading below is intentionally a level-two heading, not a second
          top-level one -- "My Profile" above is this page's single top-level heading; the name is
          a subsection of it. */}

      {/* Header Avatar Banner */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '32px',
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0284c7, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 900,
              color: '#ffffff',
              boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)',
            }}
          >
            {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#f8fafc', margin: 0 }}>
                {user.fullName}
              </h2>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 900,
                  background: user.role === 'ADMIN' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                  color: user.role === 'ADMIN' ? '#ef4444' : '#38bdf8',
                  border: `1px solid ${user.role === 'ADMIN' ? '#ef4444' : '#38bdf8'}44`,
                }}
              >
                ROLE: {user.role}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
              {user.email} &bull; Member since {new Date(user.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        <button
          onClick={async () => {
            // Was previously local-storage-only (no call to the real logout endpoint), leaving the
            // actual httpOnly session cookie fully valid server-side after clicking "Sign Out" --
            // see app/api/auth/logout/route.ts, the real logout route this now actually calls.
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
          🚪 Sign Out
        </button>
      </div>

      {/* User Overview Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>Total Workspace Projects</div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#38bdf8', marginTop: '6px' }}>
            {stats.projectCount}
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>Total Saved Scan Reports</div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#a855f7', marginTop: '6px' }}>
            {stats.reportCount}
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>Average Quality Score</div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#22c55e', marginTop: '6px' }}>
            {stats.averageScore}%
          </div>
        </div>
      </div>

      {/* Section 1: Security & API Key Management */}
      <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '28px', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: '0 0 16px 0' }}>
          🔑 API Key Management
        </h3>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0' }}>
          Use your unique API Key for automated CLI inspections and CI/CD pipeline integration.
        </p>

        <label htmlFor="profile-api-key" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
          Your API Key
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <input
            id="profile-api-key"
            type={showApiKey ? 'text' : 'password'}
            readOnly
            value={user.apiKey || 'No API key generated'}
            style={{
              flex: 1,
              minWidth: '260px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: '#090d16',
              color: '#38bdf8',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '13px',
            }}
          />

          <button
            onClick={() => setShowApiKey(!showApiKey)}
            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(255, 255, 255, 0.05)', color: '#f8fafc', fontSize: '13px', cursor: 'pointer' }}
          >
            {showApiKey ? '👁️ Hide' : '👁️ Show'}
          </button>

          <button
            onClick={copyApiKey}
            style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
          >
            {copied ? '✓ Copied' : '📋 Copy Key'}
          </button>

          <button
            onClick={handleRegenerateApiKey}
            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}
          >
            🔄 Regenerate
          </button>
        </div>
      </div>

      {/* Section 2: Password Change Form */}
      <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '28px', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: '0 0 16px 0' }}>
          🔒 Password Change
        </h3>

        {passMsg && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', background: passMsg.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: passMsg.type === 'success' ? '#22c55e' : '#f87171' }}>
            {passMsg.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <PasswordField
            id="profile-current-password"
            label="Current Password"
            useInputFieldClass={false}
            autoComplete="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
          />

          <PasswordField
            id="profile-new-password"
            label="New Password"
            useInputFieldClass={false}
            autoComplete="new-password"
            value={newPassword}
            onChange={setNewPassword}
          />

          <PasswordField
            id="profile-confirm-password"
            label="Confirm New Password"
            useInputFieldClass={false}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />

          <div style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
            <button
              type="submit"
              disabled={passSubmitting}
              style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#0284c7', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}
            >
              {passSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Section 3: Preference Controls (Theme & Notifications) */}
      <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '28px', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: '0 0 16px 0' }}>
          🎨 Appearance & Preferences
        </h3>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="profile-theme" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Theme</label>
            <select
              id="profile-theme"
              value={settings.theme}
              onChange={(e) => updateSettings({ theme: e.target.value as any })}
              style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#090d16', color: '#38bdf8', fontWeight: 700, fontSize: '13px' }}
            >
              <option value="dark">🌙 Dark Glass (Vercel & Linear)</option>
              <option value="light">☀️ Light Minimal</option>
              <option value="system">🖥️ System Preference</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section 4: Account Deletion */}
      <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '16px', padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#f87171', margin: '0 0 6px 0' }}>
          ⚠️ Danger Zone — Delete Account
        </h3>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0' }}>
          Permanently delete your user account, projects, scan histories, and notifications.
        </p>

        <button
          ref={deleteTriggerRef}
          onClick={() => setIsDeleteModalOpen(true)}
          style={{ padding: '10px 18px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#f87171', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
        >
          Delete Account Permanently
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div
          role="presentation"
          onClick={() => setIsDeleteModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        >
          <div
            ref={deleteModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#0f172a', border: '1px solid #ef4444', borderRadius: '16px', padding: '32px', maxWidth: '440px', width: '100%', textAlign: 'center' }}
          >
            <div style={{ fontSize: '40px', marginBottom: '12px' }} aria-hidden="true">⚠️</div>
            <h3 id="delete-account-modal-title" style={{ fontSize: '20px', fontWeight: 900, color: '#f8fafc', margin: 0 }}>Are you absolutely sure?</h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '8px', lineHeight: 1.5 }}>
              This action cannot be undone. All your project records, scan history, settings, and API keys will be deleted immediately.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
              <button
                ref={deleteCancelRef}
                onClick={() => setIsDeleteModalOpen(false)}
                style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'transparent', color: '#94a3b8', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Yes, Delete My Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
