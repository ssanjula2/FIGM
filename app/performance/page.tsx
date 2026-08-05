'use client';

import React from 'react';

export default function WebVitalsPage() {
  const metrics = [
    { title: 'First Contentful Paint (FCP)', value: '0.8s', target: '< 1.8s', status: 'GOOD', color: '#10b981' },
    { title: 'Time to Interactive (TTI)', value: '1.2s', target: '< 2.5s', status: 'OPTIMAL', color: '#38bdf8' },
    { title: 'Largest Contentful Paint (LCP)', value: '1.1s', target: '< 2.5s', status: 'GOOD', color: '#10b981' },
    { title: 'Cumulative Layout Shift (CLS)', value: '0.01', target: '< 0.1', status: 'PERFECT', color: '#a855f7' },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div>
        <div style={{ fontSize: '12px', color: '#eab308', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
          Real-Time Performance Metrics
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.5px' }}>
          Web Vitals & Page Load Time Diagnostics
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
          Proactive monitoring of Single Page Application page load latency, DOM render speed, and Web Vitals benchmarks.
        </p>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
        {metrics.map((m, idx) => (
          <div key={idx} className="glass-panel" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>{m.title}</div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: m.color, margin: '12px 0 4px 0' }}>{m.value}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
              <span>Target: {m.target}</span>
              <span style={{ padding: '2px 8px', borderRadius: '12px', background: `${m.color}20`, color: m.color, fontWeight: 700 }}>
                {m.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Analytics Card */}
      <div className="glass-panel" style={{ padding: '28px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', marginBottom: '12px' }}>
          ⚡ Page Load Speed & Render Bottleneck Remediation
        </h2>
        <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.6' }}>
          FIGM Code Inspector evaluates Page Load Time by dynamically inspecting component ASTs for un-dimensioned layout containers (CLS prevention), heavy invariant object re-instantiations (FCP optimization), and static imports in deferred execution paths (TTI optimization).
        </p>
      </div>
    </div>
  );
}
