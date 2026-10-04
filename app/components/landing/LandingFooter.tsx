'use client';

import React from 'react';
import Link from 'next/link';

export default function LandingFooter() {
  return (
    <footer
      id="about"
      style={{
        background: '#020617',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '56px 0 28px 0',
        color: '#94a3b8',
        fontSize: '13px',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '40px', marginBottom: '40px' }} className="landing-footer-grid">
          {/* Brand Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 900, color: '#ffffff' }}>
                FI
              </div>
              <span style={{ fontSize: '16px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.82)' }}>FIGM Code Inspector</span>
            </div>
            <p style={{ color: '#7c8ba6', fontSize: '13px', lineHeight: 1.6, maxWidth: '320px', margin: 0 }}>
              A framework-independent guideline model for architecture, static performance, and
              accessibility analysis across React, Next.js, Angular, and Vue.
            </p>
          </div>

          {/* Product */}
          <div>
            <div style={{ color: 'rgba(0, 0, 0, 0.82)', fontWeight: 700, fontSize: '13px', marginBottom: '14px' }}>Product</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <li><Link href="/live-scan" style={{ color: 'rgba(0, 0, 0, 0.7)', textDecoration: 'none' }}>Live Scan</Link></li>
              <li><Link href="/guidelines" style={{ color: 'rgba(0, 0, 0, 0.7)', textDecoration: 'none' }}>Guidelines</Link></li>
              <li><Link href="/history" style={{ color: 'rgba(0, 0, 0, 0.7)', textDecoration: 'none' }}>Scan History</Link></li>
            </ul>
          </div>

          {/* Research */}
          <div>
            <div style={{ color: 'rgba(0, 0, 0, 0.82)', fontWeight: 700, fontSize: '13px', marginBottom: '14px' }}>Research</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <li><Link href="/methodology" style={{ color: 'rgba(0, 0, 0, 0.7)', textDecoration: 'none' }}>Methodology</Link></li>
              <li>
                <a
                  href="https://github.com/ssanjula2/FIGM/blob/main/docs/research/KNOWN_LIMITATIONS_REGISTER.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'rgba(0, 0, 0, 0.7)', textDecoration: 'none' }}
                >
                  Known Limitations ↗
                </a>
              </li>
              <li><a href="https://github.com/ssanjula2/FIGM" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(0, 0, 0, 0.7)', textDecoration: 'none' }}>GitHub Repository ↗</a></li>
              <li><a href="https://github.com/ssanjula2/FIGM/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(0, 0, 0, 0.7)', textDecoration: 'none' }}>Privacy &amp; Data Retention Policy ↗</a></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <div style={{ color: 'rgba(0, 0, 0, 0.82)', fontWeight: 700, fontSize: '13px', marginBottom: '14px' }}>Account</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <li><Link href="/auth/login" style={{ color: 'rgba(0, 0, 0, 0.7)', textDecoration: 'none' }}>Sign In</Link></li>
              <li><Link href="/auth/register" style={{ color: 'rgba(0, 0, 0, 0.7)', textDecoration: 'none' }}>Register</Link></li>
            </ul>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(0, 0, 0, 0.08)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>© 2026 FIGM Code Inspector. MIT License.</div>
          <div style={{ color: '#7c8ba6', fontSize: '12px' }}>IS303.2 Research Methodology Coursework</div>
        </div>
      </div>

      <style>{`
        @media (max-width: 700px) {
          .landing-footer-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
        }
      `}</style>
    </footer>
  );
}
