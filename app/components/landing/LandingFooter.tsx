'use client';

import React from 'react';
import Link from 'next/link';

export default function LandingFooter() {
  return (
    <footer
      style={{
        background: '#020617',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '60px 0 32px 0',
        color: '#94a3b8',
        fontSize: '13px',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '40px', marginBottom: '48px' }}>
          {/* Brand Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #38bdf8 0%, #a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
                🛡️
              </div>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>FIGM Code Inspector</span>
            </div>
            <p style={{ color: '#64748b', fontSize: '13px', lineHeight: 1.6, maxWidth: '320px', margin: '0 0 16px 0' }}>
              Framework-Independent Guideline Model for Single-Page Applications across React, Next.js, Angular, and Vue.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                Aligned with ISO/IEC 25010 quality characteristics
              </span>
              <span style={{ fontSize: '11px', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                Designed with WCAG 2.2 AA accessibility principles
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '14px', marginBottom: '16px' }}>Navigation</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li><Link href="/live-scan" style={{ color: '#94a3b8', textDecoration: 'none' }}>Live Code Scanner</Link></li>
              <li><Link href="/guidelines" style={{ color: '#94a3b8', textDecoration: 'none' }}>23 Guideline Rules</Link></li>
              <li><Link href="/diagnostics" style={{ color: '#94a3b8', textDecoration: 'none' }}>Diagnostics Hub</Link></li>
              <li><Link href="/profiler" style={{ color: '#94a3b8', textDecoration: 'none' }}>Dynamic Profiler</Link></li>
              <li><Link href="/ai-fix" style={{ color: '#94a3b8', textDecoration: 'none' }}>Gemini AI Remediation</Link></li>
            </ul>
          </div>

          {/* Research & Docs */}
          <div>
            <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '14px', marginBottom: '16px' }}>Research & Docs</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li><Link href="/analytics" style={{ color: '#94a3b8', textDecoration: 'none' }}>Empirical Metrics</Link></li>
              <li><Link href="/history" style={{ color: '#94a3b8', textDecoration: 'none' }}>Scan History</Link></li>
              <li><Link href="/auth/login" style={{ color: '#94a3b8', textDecoration: 'none' }}>Auth Workspace</Link></li>
              <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'none' }}>GitHub Repository ↗</a></li>
              <li><a href="https://www.w3.org/TR/WCAG22/" target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'none' }}>W3C WCAG 2.2 Spec ↗</a></li>
            </ul>
          </div>

          {/* Academic Info */}
          <div>
            <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '14px', marginBottom: '16px' }}>Academic Citation</div>
            <p style={{ color: '#64748b', fontSize: '12px', lineHeight: 1.6, margin: '0 0 12px 0' }}>
              Framework-Independent Guideline Model for Automated SPA Quality Assurance and AI-Assisted Remediation (2026).
            </p>
            <div style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 700 }}>
              MSc Software Engineering Thesis
            </div>
          </div>
        </div>

        {/* Copyright Bar */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            © 2026 FIGM Code Inspector. All rights reserved. MIT License.
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Link href="/settings" style={{ color: '#64748b', textDecoration: 'none' }}>Settings</Link>
            <Link href="/admin" style={{ color: '#64748b', textDecoration: 'none' }}>Admin Panel</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
