'use client';

import React, { useState } from 'react';

export default function FIGMModelSection() {
  const [selectedFramework, setSelectedFramework] = useState<'UNIVERSAL' | 'REACT' | 'NEXTJS' | 'ANGULAR'>('UNIVERSAL');

  const rulesData = {
    UNIVERSAL: [
      { id: 'FIGM-PERF-01', name: 'Invariant Object Allocation in Loops', domain: 'Performance', alp: 'ALP-LOOP-ALLOC', confidence: '95%' },
      { id: 'FIGM-PERF-02', name: 'Un-dimensioned Dynamic Layout Elements', domain: 'Performance', alp: 'ALP-LAYOUT-ELEMENT', confidence: '92%' },
      { id: 'FIGM-A11Y-01', name: 'Keyboard Event Parity on Handlers', domain: 'Accessibility', alp: 'ALP-EVENT-KEYBOARD', confidence: '96%' },
      { id: 'FIGM-A11Y-02', name: 'Accessible Name & Role for Controls', domain: 'Accessibility', alp: 'ALP-ARIA-NAMING', confidence: '94%' },
    ],
    REACT: [
      { id: 'FIGM-REACT-01', name: 'Memoize Derived State Computations', domain: 'Performance', alp: 'ALP-DERIVED-STATE', confidence: '88%' },
      { id: 'FIGM-REACT-02', name: 'Stable List Key Prop Assignment', domain: 'Performance', alp: 'ALP-KEY-ASSIGNMENT', confidence: '96%' },
      { id: 'FIGM-REACT-03', name: 'Avoid Direct React State Mutation', domain: 'Architecture', alp: 'ALP-MUTATION-DIRECT', confidence: '99%' },
      { id: 'FIGM-REACT-04', name: 'Wrap Child Callbacks in useCallback', domain: 'Performance', alp: 'ALP-CALLBACK-MEMO', confidence: '87%' },
    ],
    NEXTJS: [
      { id: 'FIGM-NEXT-01', name: 'Client Hooks Require "use client"', domain: 'Architecture', alp: 'ALP-CLIENT-DIRECTIVE', confidence: '99%' },
      { id: 'FIGM-NEXT-02', name: 'Dynamic Imports for Heavy Modules', domain: 'Performance', alp: 'ALP-DYNAMIC-IMPORT', confidence: '90%' },
      { id: 'FIGM-NEXT-03', name: 'App Router Route Revalidation', domain: 'Performance', alp: 'ALP-ROUTE-REVALIDATE', confidence: '85%' },
      { id: 'FIGM-NEXT-04', name: 'Zero-Layout-Shift Fonts (next/font)', domain: 'Performance', alp: 'ALP-ZERO-SHIFT-FONT', confidence: '92%' },
    ],
    ANGULAR: [
      { id: 'FIGM-ANG-01', name: 'Unsubscribe RxJS Observables', domain: 'Performance', alp: 'ALP-RXJS-DISPOSAL', confidence: '98%' },
      { id: 'FIGM-ANG-02', name: 'Angular OnPush Change Detection', domain: 'Performance', alp: 'ALP-ONPUSH-STRATEGY', confidence: '92%' },
      { id: 'FIGM-ANG-03', name: 'Angular *ngFor trackBy Reference', domain: 'Performance', alp: 'ALP-TRACKBY-REF', confidence: '95%' },
      { id: 'FIGM-ANG-05', name: 'Renderer2 DOM Safety Execution', domain: 'Security', alp: 'ALP-RENDERER2-SAFETY', confidence: '97%' },
    ],
  };

  return (
    <section style={{ padding: '80px 0', background: 'rgba(15, 23, 42, 0.4)', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
          THE 4-LAYER META-MODEL TAXONOMY
        </div>
        <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#f8fafc', margin: '0 0 16px 0', letterSpacing: '-0.5px' }}>
          Abstract Language Primitives (ALPs)
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '15px', maxWidth: '720px', margin: '0 auto 12px auto', lineHeight: 1.6 }}>
          Mapping framework-specific syntax to formal mathematical predicates (<strong style={{ color: '#38bdf8' }}>Domain → Concern → ALP → Rule</strong>).
        </p>
        <p style={{ color: '#64748b', fontSize: '12px', maxWidth: '720px', margin: '0 auto 40px auto', lineHeight: 1.5 }}>
          &quot;Detection Weight&quot; below is a static per-rule confidence value configured in the detection engine's evidence
          scoring, not a measured empirical accuracy figure — see <a href="/analytics" style={{ color: '#38bdf8' }}>/analytics</a> for live benchmark Precision/Recall/F1.
        </p>

        {/* Framework Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
          {(['UNIVERSAL', 'REACT', 'NEXTJS', 'ANGULAR'] as const).map((fw) => (
            <button
              key={fw}
              onClick={() => setSelectedFramework(fw)}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: selectedFramework === fw ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                background: selectedFramework === fw ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                color: selectedFramework === fw ? '#38bdf8' : '#94a3b8',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {fw === 'UNIVERSAL' && '🌐 Universal (12 Rules)'}
              {fw === 'REACT' && '⚛️ React JSX (4 Rules)'}
              {fw === 'NEXTJS' && '▲ Next.js App Router (4 Rules)'}
              {fw === 'ANGULAR' && '🅰️ Angular (.ts) (5 Rules)'}
            </button>
          ))}
        </div>

        {/* Rules Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          {rulesData[selectedFramework].map((rule) => (
            <div
              key={rule.id}
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '20px',
                textAlign: 'left',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                    {rule.id}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#a855f7' }}>
                    {rule.domain}
                  </span>
                </div>
                <div style={{ color: '#f8fafc', fontSize: '14px', fontWeight: 700 }}>
                  {rule.name}
                </div>
                <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', fontFamily: 'monospace' }}>
                  ALP Primitive: {rule.alp}
                </div>
              </div>

              <div style={{ textAlign: 'right' }} title="A static per-diagnostic weight configured in the detection engine, not a measured empirical accuracy score. See /analytics for live benchmark Precision/Recall/F1.">
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Detection Weight</div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#10b981' }}>{rule.confidence}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
