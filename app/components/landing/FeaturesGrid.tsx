'use client';

import React from 'react';

export default function FeaturesGrid() {
  const features = [
    {
      icon: '⚡',
      title: '25 AST Rule Predicates',
      desc: 'Formally defined static inspection predicates detecting invariant allocations, un-dimensioned elements, missing ARIA names, and RxJS memory leaks.',
      tag: 'AST Engine',
    },
    {
      icon: '🤖',
      title: 'Gemini 2.5 Flash AI Remediation',
      desc: 'Generates syntactically valid unified git diff patches with AST re-parsing syntax validation and automatic deterministic fallback protection.',
      tag: 'AI Pipeline',
    },
    {
      icon: '⏱️',
      title: 'Dynamic Profiler Engine',
      desc: 'Measures real-time V8 heap memory usage and execution latency, computing estimated Web Vitals proxies (FCP / TTI).',
      tag: 'Runtime Profiler',
    },
    {
      icon: '🔒',
      title: 'Multi-Tenant Auth & RBAC',
      desc: 'JWT authentication with salted password hashing, refresh token rotation, and role-based permissions (ADMIN, DEVELOPER, AUDITOR).',
      tag: 'Security & Auth',
    },
    {
      icon: '💻',
      title: 'CLI Static Scanner',
      desc: 'Executable command-line runner (figm-analyze) with configurable quality gates (--threshold) for CI/CD integration pipelines.',
      tag: 'DevOps & CLI',
    },
    {
      icon: '📄',
      title: 'Interactive Exporters',
      desc: 'Generates structured JSON scan data and self-contained glassmorphic HTML dashboards featuring CSS severity badges and rule traceability.',
      tag: 'Reporting Engine',
    },
  ];

  return (
    <section style={{ padding: '80px 0', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
          ENTERPRISE-GRADE CAPABILITIES
        </div>
        <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#f8fafc', margin: '0 0 16px 0', letterSpacing: '-0.5px' }}>
          Core System Components
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '15px', maxWidth: '700px', margin: '0 auto 48px auto', lineHeight: 1.6 }}>
          Designed with modular, decoupled architecture following SOLID principles and ISO/IEC 25010 quality standards.
        </p>

        {/* 6 Features Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {features.map((feat) => (
            <div
              key={feat.title}
              style={{
                background: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '28px',
                textAlign: 'left',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '28px', background: 'rgba(255, 255, 255, 0.05)', padding: '10px', borderRadius: '12px' }}>
                  {feat.icon}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '4px 10px', borderRadius: '20px' }}>
                  {feat.tag}
                </span>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: '0 0 8px 0' }}>
                {feat.title}
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: 1.6 }}>
                {feat.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
