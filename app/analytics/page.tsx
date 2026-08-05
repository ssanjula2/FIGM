'use client';

import React from 'react';

export default function AnalyticsPage() {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
          Insight Engine
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.5px' }}>
          Performance Analytics
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
          Deep-dive analysis into SPA execution bottlenecks, memory allocation curves, and render counts.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '12px' }}>
          Quality & Throughput Metrics
        </h2>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>
          Throughput: <strong>24,100 LOC / sec</strong> &bull; Average scan duration: <strong>7.2 seconds</strong> across 30 repositories.
        </div>
      </div>
    </div>
  );
}
