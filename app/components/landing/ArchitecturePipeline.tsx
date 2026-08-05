'use client';

import React from 'react';

export default function ArchitecturePipeline() {
  const steps = [
    { step: '01', name: 'Source Parser', desc: 'Resilient scope parser extracts AST nodes from TSX, JSX, SFC, or Angular templates.' },
    { step: '02', name: 'Universal AST Mapper', desc: 'Translates native syntax into Abstract Language Primitives (ALPs).' },
    { step: '03', name: 'AST Detection Engine', desc: 'Evaluates 25 formal predicates across performance and accessibility rules.' },
    { step: '04', name: 'AI Remediation Pipeline', desc: 'Generates Gemini 2.5 Flash git diff patches with AST re-parsing syntax verification.' },
    { step: '05', name: 'Deterministic Fallback', desc: 'Routes to RemediationEngine template fixes if API connection or syntax validation fails.' },
    { step: '06', name: 'CLI & Dashboard Export', desc: 'Outputs machine-readable JSON reports and interactive glassmorphic HTML dashboards.' },
  ];

  return (
    <section style={{ padding: '80px 0', background: 'rgba(15, 23, 42, 0.4)', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
          SYSTEM PIPELINE VISUALIZATION
        </div>
        <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#f8fafc', margin: '0 0 16px 0', letterSpacing: '-0.5px' }}>
          End-to-End Processing Architecture
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '15px', maxWidth: '700px', margin: '0 auto 48px auto', lineHeight: 1.6 }}>
          Decoupled multi-stage execution pipeline ensuring high scan throughput (45,200 LOC/sec) and zero application runtime crashes.
        </p>

        {/* Pipeline Step Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          {steps.map((s) => (
            <div
              key={s.step}
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'left',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
                    color: '#0f172a',
                    fontWeight: 900,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {s.step}
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                  {s.name}
                </h3>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
