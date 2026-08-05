'use client';

import React from 'react';

export default function BenchmarkSection() {
  const stats = [
    { value: '90.0%', label: 'Empirical F1-Score', sub: 'Ground Truth Accuracy' },
    { value: '88.5%', label: 'Precision Rate', sub: 'Low False Positives' },
    { value: '91.6%', label: 'Recall Rate', sub: 'High Defect Coverage' },
    { value: '45,200', label: 'LOC / Second', sub: 'Scan Throughput' },
    { value: '4.42 / 5.0', label: 'Usability Score', sub: "Cronbach's α = 0.892" },
  ];

  const toolsComparison = [
    { domain: 'Universal Performance (6 Rules)', figm: '100%', eslint: '33.3%', sonar: '16.7%', light: '50.0%' },
    { domain: 'Universal Accessibility (6 Rules)', figm: '100%', eslint: '66.7%', sonar: '50.0%', light: '83.3%' },
    { domain: 'Next.js App Router (4 Rules)', figm: '100%', eslint: '75.0%', sonar: '25.0%', light: '25.0%' },
    { domain: 'React Rendering & State (4 Rules)', figm: '100%', eslint: '75.0%', sonar: '50.0%', light: '0.0%' },
    { domain: 'Angular RxJS / DOM Safety (5 Rules)', figm: '100%', eslint: '20.0%', sonar: '40.0%', light: '0.0%' },
  ];

  return (
    <section style={{ padding: '80px 0', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
          EMPIRICAL EVALUATION & RESULTS
        </div>
        <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#f8fafc', margin: '0 0 16px 0', letterSpacing: '-0.5px' }}>
          Real-World Benchmark Performance
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '15px', maxWidth: '720px', margin: '0 auto 48px auto', lineHeight: 1.6 }}>
          Evaluated against 30 open-source GitHub repositories ($N=30$, 755,300 LOC) and an annotated ground-truth benchmark suite.
        </p>

        {/* 5 Stats Counter Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '60px' }}>
          {stats.map((st) => (
            <div
              key={st.label}
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                padding: '24px 16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#38bdf8', letterSpacing: '-0.5px', marginBottom: '4px' }}>
                {st.value}
              </div>
              <div style={{ color: '#f8fafc', fontSize: '13px', fontWeight: 700, marginBottom: '2px' }}>
                {st.label}
              </div>
              <div style={{ color: '#64748b', fontSize: '11px' }}>
                {st.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Tool Comparison Matrix */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '28px',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 800, margin: 0 }}>
              Comparative Rule Coverage Matrix (FIGM vs Industrial Tools)
            </h3>
            <span style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 700, background: 'rgba(56, 189, 248, 0.1)', padding: '4px 12px', borderRadius: '20px' }}>
              Overall FIGM Coverage: 84.2%
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Rule Domain</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#38bdf8' }}>FIGM</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>ESLint</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>SonarQube</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Lighthouse</th>
                </tr>
              </thead>
              <tbody>
                {toolsComparison.map((row) => (
                  <tr key={row.domain} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', color: '#cbd5e1' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.domain}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#38bdf8' }}>{row.figm}</td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{row.eslint}</td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{row.sonar}</td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>{row.light}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
