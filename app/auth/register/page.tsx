'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'DEVELOPER' | 'AUDITOR'>('DEVELOPER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // Move focus to the error message when a new one appears -- same fix as app/auth/login/page.tsx
  // (see its comment for the full rationale); role="alert" announces it, this makes it reachable.
  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to register');
      }

      if (data.accessToken || data.token) {
        localStorage.setItem('figm_token', data.accessToken || data.token);
        if (data.user) {
          localStorage.setItem('figm_user', JSON.stringify(data.user));
        }
      }

      router.push('/guidelines');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
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
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
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
          <h1 style={{ color: '#f8fafc', fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0' }}>
            Create Account
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            Join FIGM Code Inspector workspace
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
              outline: 'none',
            }}
          >
            <span aria-hidden="true">⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: '18px' }}>
            <label htmlFor="reg-fullname" style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Full Name
            </label>
            <input
              id="reg-fullname"
              type="text"
              aria-label="Full Name"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              className="input-field"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label htmlFor="reg-email" style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Email Address
            </label>
            <input
              id="reg-email"
              type="email"
              aria-label="Email Address"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com"
              className="input-field"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label htmlFor="reg-role" style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Account Role
            </label>
            <select
              id="reg-role"
              aria-label="Account Role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'DEVELOPER' | 'AUDITOR')}
              className="input-field"
              style={{ width: '100%', color: '#38bdf8', fontWeight: 600 }}
            >
              <option value="DEVELOPER">Developer (Scan & Fix)</option>
              <option value="AUDITOR">Auditor (Read-Only Diagnostics)</option>
            </select>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="reg-password" style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Password (min 8 chars, 1 uppercase, 1 number)
            </label>
            <input
              id="reg-password"
              type="password"
              aria-label="Password"
              required
              autoComplete="new-password"
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
            }}
          >
            {loading ? 'Creating Account...' : 'Register Account'}
          </button>
        </form>

        <div style={{ marginTop: '28px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
