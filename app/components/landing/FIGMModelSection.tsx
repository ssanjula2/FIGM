'use client';

import React, { useState } from 'react';
import { RULE_CATALOG } from '../../../src/matrix/rule-registry';

// Per-rule static evidence weight from ASTDetectionEngine.createReport's confidenceScore argument
// (src/ast/ast-detection-engine.ts) -- not part of the canonical rule metadata model (which
// describes what a rule IS, not a runtime scoring constant), so it stays local to this display.
const CONFIDENCE_WEIGHT: Record<string, string> = {
  'FIGM-PERF-01': '95%', 'FIGM-PERF-02': '92%', 'FIGM-PERF-03': '98%', 'FIGM-PERF-04': '88%',
  'FIGM-PERF-05': '85%', 'FIGM-PERF-06': '90%',
  'FIGM-A11Y-01': '96%', 'FIGM-A11Y-02': '94%', 'FIGM-A11Y-03': '91%', 'FIGM-A11Y-04': '95%',
  'FIGM-A11Y-05': '97%', 'FIGM-A11Y-06': '93%',
  'FIGM-NEXT-01': '99%', 'FIGM-NEXT-02': '90%', 'FIGM-NEXT-03': '85%', 'FIGM-NEXT-04': '92%',
  'FIGM-REACT-01': '88%', 'FIGM-REACT-02': '96%', 'FIGM-REACT-03': '99%', 'FIGM-REACT-04': '87%',
  'FIGM-ANG-01': '98%', 'FIGM-ANG-02': '92%', 'FIGM-ANG-03': '95%', 'FIGM-ANG-04': '90%', 'FIGM-ANG-05': '97%',
};

const DOMAIN_LABEL: Record<string, string> = { PERFORMANCE: 'Performance', ACCESSIBILITY: 'Accessibility' };

export default function FIGMModelSection() {
  const [selectedFramework, setSelectedFramework] = useState<'UNIVERSAL' | 'REACT' | 'NEXTJS' | 'ANGULAR'>('UNIVERSAL');

  // Rule id/name/domain/ALP membership all come live from RULE_CATALOG (src/matrix/rule-registry.ts)
  // -- this component previously hardcoded its own copy with invented ALP ids that did not match
  // CORE_ALPS and an Angular bucket that silently omitted FIGM-ANG-04. Deriving live makes both
  // classes of drift structurally impossible.
  const rulesData = {
    UNIVERSAL: RULE_CATALOG.filter((r) => r.category === 'COMMON'),
    REACT: RULE_CATALOG.filter((r) => r.category === 'REACT'),
    NEXTJS: RULE_CATALOG.filter((r) => r.category === 'NEXTJS'),
    ANGULAR: RULE_CATALOG.filter((r) => r.category === 'ANGULAR'),
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
        <p style={{ color: '#7c8ba6', fontSize: '12px', maxWidth: '720px', margin: '0 auto 40px auto', lineHeight: 1.5 }}>
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
              {fw === 'UNIVERSAL' && `🌐 Universal (${rulesData.UNIVERSAL.length} Rules)`}
              {fw === 'REACT' && `⚛️ React JSX (${rulesData.REACT.length} Rules)`}
              {fw === 'NEXTJS' && `▲ Next.js App Router (${rulesData.NEXTJS.length} Rules)`}
              {fw === 'ANGULAR' && `🅰️ Angular (.ts) (${rulesData.ANGULAR.length} Rules)`}
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
                    {DOMAIN_LABEL[rule.domain]}
                  </span>
                </div>
                <div style={{ color: '#f8fafc', fontSize: '14px', fontWeight: 700 }}>
                  {rule.name}
                </div>
                <div style={{ color: '#7c8ba6', fontSize: '12px', marginTop: '4px', fontFamily: 'monospace' }}>
                  ALP Primitive: {rule.alpId}
                </div>
              </div>

              <div style={{ textAlign: 'right' }} title="A static per-diagnostic weight configured in the detection engine, not a measured empirical accuracy score. See /analytics for live benchmark Precision/Recall/F1.">
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Detection Weight</div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#10b981' }}>{CONFIDENCE_WEIGHT[rule.id]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
