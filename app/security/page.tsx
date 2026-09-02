'use client';

import React from 'react';

export default function SecurityPage() {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
          Data Privacy & Cross-User Protection
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.5px' }}>
          Tenant Security Specification
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
          Multi-tenant isolation status and cryptographic session protection.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(34, 197, 94, 0.08)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
          <span style={{ fontSize: '24px' }}>🔒</span>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#22c55e' }}>Application-Layer Tenant Isolation Active</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              Every repository query is explicitly scoped by the authenticated request&apos;s <code style={{ color: '#38bdf8' }}>userId</code>, verified server-side from the JWT -- not by Postgres Row-Level Security, which this deployment does not use (see <code style={{ color: '#38bdf8' }}>DATABASE.md</code> for detail).
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ background: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', marginBottom: '4px' }}>JWT Bearer Token Guard</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>HMAC-SHA256 access tokens (1-hour expiration) and refresh tokens (7-day expiration) enforce 401 Unauthorized protection on all API endpoints.</div>
          </div>

          <div style={{ background: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#a855f7', marginBottom: '4px' }}>scrypt Password Hashing</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>New and updated passwords are hashed with salted scrypt (N=2^16, r=8, p=1); legacy PBKDF2-SHA512 hashes from before this migration are transparently upgraded on next login.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
