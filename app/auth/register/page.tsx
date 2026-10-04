'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { sessionClient } from '../../../src/auth/session-client';
import PasswordField from '../../components/PasswordField';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    setError(null);

    // Client-side confirmation check only -- the actual password-strength policy is enforced
    // server-side in POST /api/auth/register (see src/auth/auth-service.ts's validatePassword),
    // which is the real, non-bypassable boundary. This is purely a UX guard against a typo.
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

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
        const accessToken = data.accessToken || data.token;
        localStorage.setItem('figm_token', accessToken);
        if (data.user) {
          localStorage.setItem('figm_user', JSON.stringify(data.user));
        }
        // See src/auth/session-client.ts -- schedules silent refresh against this token's real
        // expiry so authenticated side effects (e.g. AI-fix telemetry) survive past the access
        // token's 1-hour lifetime.
        sessionClient.recordSession(accessToken);
      }

      // Registration issues a real session immediately (see app/api/auth/register/route.ts) --
      // land directly in the authenticated application, same role-based default as a normal login
      // (register/route.ts never assigns ADMIN, but AUDITOR is self-registerable and belongs in the
      // admin/research workspace, not the developer one).
      router.push(data.user?.role === 'AUDITOR' ? '/admin' : '/');
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
        background: '#ffffff',
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
          background: '#ffffff',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: '20px',
          padding: '40px',
          boxShadow: '0 8px 24px -8px rgba(0, 0, 0, 0.14)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: 'rgba(0, 0, 0, 0.82)', fontSize: '24px', fontWeight: 700, margin: '0 0 8px 0' }}>
            Create Account
          </h1>
          <p style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '14px', margin: 0 }}>
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
              color: '#1d4ed8',
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
            <label htmlFor="reg-fullname" style={{ display: 'block', color: 'rgba(0, 0, 0, 0.7)', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
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
            <label htmlFor="reg-email" style={{ display: 'block', color: 'rgba(0, 0, 0, 0.7)', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
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
            <label htmlFor="reg-role" style={{ display: 'block', color: 'rgba(0, 0, 0, 0.7)', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Account Role
            </label>
            <select
              id="reg-role"
              aria-label="Account Role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'DEVELOPER' | 'AUDITOR')}
              className="input-field"
              style={{ width: '100%', color: '#1d4ed8', fontWeight: 600 }}
            >
              <option value="DEVELOPER">Developer (Scan & Fix)</option>
              <option value="AUDITOR">Auditor (Read-Only Diagnostics)</option>
            </select>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <PasswordField
              id="reg-password"
              label="Password"
              hint="min 8 chars, 1 uppercase, 1 number"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <PasswordField
              id="reg-confirm-password"
              label="Confirm Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '10px',
              background: '#2563eb',
              border: 'none',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Creating Account...' : 'Register Account'}
          </button>
        </form>

        <div style={{ marginTop: '28px', textAlign: 'center', color: 'rgba(0, 0, 0, 0.7)', fontSize: '13px' }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: '#1d4ed8', fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
