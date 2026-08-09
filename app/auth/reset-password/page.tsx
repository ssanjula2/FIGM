'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    }
  }, [searchParams]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setMessage(data.message);
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reset failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#030712',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '40px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: '#f8fafc', fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0' }}>
            Set New Password
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            Enter your reset token and new password
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', padding: '12px', borderRadius: '10px', fontSize: '13px', marginBottom: '20px' }}>
            ⚠️ {error}
          </div>
        )}

        {message && (
          <div style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#86efac', padding: '12px', borderRadius: '10px', fontSize: '13px', marginBottom: '20px' }}>
            ✅ {message}
          </div>
        )}

        <form onSubmit={handleReset}>
          <div style={{ marginBottom: '18px' }}>
            <label htmlFor="reset-token" style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Reset Token
            </label>
            <input
              id="reset-token"
              type="text"
              aria-label="Reset Token"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste token here"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#f8fafc',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label htmlFor="new-password" style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              New Password (min 8 chars, 1 uppercase, 1 number)
            </label>
            <input
              id="new-password"
              type="password"
              aria-label="New Password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#f8fafc',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="confirm-password" style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              aria-label="Confirm New Password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#f8fafc',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
              border: 'none',
              color: '#0f172a',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Resetting Password...' : 'Reset Password'}
          </button>
        </form>

        <div style={{ marginTop: '28px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          Back to{' '}
          <Link href="/auth/login" style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ color: '#94a3b8', padding: '40px', textAlign: 'center' }}>Loading Reset Password...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
