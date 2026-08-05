'use client';

import React from 'react';

export default function ProfilerPage() {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ fontSize: '12px', color: '#eab308', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
          Sandboxed Execution Environment
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.5px' }}>
          Runtime Profiler & Metrics
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
          Real-time measurement of code execution latency, peak heap memory footprint, and event loop delays.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Execution Latency</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>14.2 ms</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Sandboxed execution time</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Peak Heap Memory</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#a855f7', marginTop: '4px' }}>2.4 MB</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>V8 heap allocation</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Event Loop Delay</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#22c55e', marginTop: '4px' }}>0.8 ms</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Main thread responsiveness</div>
        </div>
      </div>
    </div>
  );
}
