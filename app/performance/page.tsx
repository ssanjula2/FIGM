'use client';

import React from 'react';

export default function WebVitalsPage() {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ fontSize: '12px', color: '#eab308', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
          Core Web Vitals
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.5px' }}>
          Web Vitals & Speed Diagnostics
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
          Monitor Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS), and Interaction to Next Paint (INP).
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '12px' }}>
          Layout Shift & Hydration Optimization
        </h2>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>
          Monitoring Next.js SSR hydration delays, image dimension attributes, and dynamic component imports.
        </div>
      </div>
    </div>
  );
}
