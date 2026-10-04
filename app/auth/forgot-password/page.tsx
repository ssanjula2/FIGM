'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to request password reset');
      }

      setMessage(data.message);
      if (data.resetToken) {
        setResetToken(data.resetToken);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#ffffff',
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
          background: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: '20px',
          padding: '40px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: 'rgba(0, 0, 0, 0.82)', fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0' }}>
            Forgot Password
          </h1>
          <p style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '14px', margin: 0 }}>
            Enter your email address to receive a password reset token
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#1d4ed8', padding: '12px', borderRadius: '10px', fontSize: '13px', marginBottom: '20px' }}>
            ⚠️ {error}
          </div>
        )}

        {message && (
          <div style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#1d4ed8', padding: '12px', borderRadius: '10px', fontSize: '13px', marginBottom: '20px' }}>
            ✅ {message}
          </div>
        )}

        {resetToken ? (
          <div style={{ background: 'rgba(96, 165, 250, 0.15)', border: '1px solid rgba(96, 165, 250, 0.3)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
            <div style={{ color: '#1d4ed8', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>RESET TOKEN GENERATED:</div>
            <code style={{ wordBreak: 'break-all', fontSize: '12px', color: 'rgba(0, 0, 0, 0.82)', background: 'rgba(255, 255, 255, 0.3)', padding: '6px 10px', borderRadius: '6px', display: 'block' }}>
              {resetToken}
            </code>
            <Link
              href={`/auth/reset-password?token=${resetToken}`}
              style={{ display: 'inline-block', marginTop: '14px', background: '#2563eb', color: '#ffffff', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', textDecoration: 'none' }}
            >
              Proceed to Reset Password →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="forgot-email" style={{ display: 'block', color: 'rgba(0, 0, 0, 0.7)', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
                Email Address
              </label>
              <input
                id="forgot-email"
                type="email"
                aria-label="Email Address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@figm.io"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.6)',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  color: 'rgba(0, 0, 0, 0.82)',
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
                background: 'linear-gradient(135deg, #60a5fa 0%, #60a5fa 100%)',
                border: 'none',
                color: '#000000',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Requesting Reset Token...' : 'Generate Reset Token'}
            </button>
          </form>
        )}

        <div style={{ marginTop: '28px', textAlign: 'center', color: 'rgba(0, 0, 0, 0.7)', fontSize: '13px' }}>
          Back to{' '}
          <Link href="/auth/login" style={{ color: '#1d4ed8', fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
