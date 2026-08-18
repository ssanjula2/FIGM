'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // Move focus to the error message when a new one appears -- a screen-reader user submitting
  // invalid credentials needs to land on the reason, not stay silently on the submit button.
  // role="alert" below already announces it; this additionally makes it reachable for anyone
  // tabbing/reviewing. This is the canonical login page (the old /login duplicate, which had this
  // exact fix, now redirects here) -- it must carry the same accessibility bar forward.
  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to log in');
      }

      if (data.token || data.accessToken) {
        localStorage.setItem('figm_token', data.token || data.accessToken);
        if (data.user) {
          localStorage.setItem('figm_user', JSON.stringify(data.user));
        }
      }

      router.push('/guidelines');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
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
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Background Glow Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '30%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(3, 7, 18, 0) 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-20%',
          right: '20%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, rgba(3, 7, 18, 0) 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '40px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(168, 85, 247, 0.2))',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              marginBottom: '16px',
              fontSize: '24px',
            }}
          >
            🛡️
          </div>
          <h1 style={{ color: '#f8fafc', fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0' }}>
            Welcome to FIGM
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            Sign in to access your code inspector workspace
          </p>
        </div>

        {error && (
          <div
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '12px 16px',
              borderRadius: '10px',
              fontSize: '13px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              outline: 'none',
            }}
          >
            <span aria-hidden="true">⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="login-email" style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              aria-label="Email Address"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="developer@figm.io"
              className="input-field"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label htmlFor="login-password" style={{ color: '#cbd5e1', fontSize: '13px', fontWeight: 600, margin: 0 }}>
                Password
              </label>
              <Link href="/auth/forgot-password" style={{ color: '#38bdf8', fontSize: '12px', textDecoration: 'none', fontWeight: 500 }}>
                Forgot Password?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              aria-label="Password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-field"
              style={{ width: '100%' }}
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
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(56, 189, 248, 0.25)',
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '28px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          Don't have an account?{' '}
          <Link href="/auth/register" style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'none' }}>
            Register Now
          </Link>
        </div>
      </div>
    </div>
  );
}
