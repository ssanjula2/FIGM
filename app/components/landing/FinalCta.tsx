'use client';

import React from 'react';
import Link from 'next/link';

export default function FinalCta() {
  return (
    <section style={{ padding: '64px 0', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', margin: '0 0 12px 0', letterSpacing: '-0.5px' }}>
          Analyze your codebase before deployment
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px 0', lineHeight: 1.6 }}>
          Paste a file or upload a project and get real, actionable findings in seconds.
        </p>
        <Link
          href="/live-scan"
          style={{
            display: 'inline-block',
            padding: '13px 28px',
            borderRadius: '10px',
            background: '#38bdf8',
            color: '#020617',
            fontSize: '14px',
            fontWeight: 800,
            textDecoration: 'none',
          }}
        >
          Start a Scan
        </Link>
      </div>
    </section>
  );
}
