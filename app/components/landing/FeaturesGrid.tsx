'use client';

import React from 'react';
import { getDomainCounts } from '../../../src/matrix/domain-counts';

export default function FeaturesGrid() {
  const counts = getDomainCounts();

  const domains = [
    {
      title: 'Architecture / Code Quality',
      count: counts.ARCHITECTURE,
      color: '#38bdf8',
      desc: 'Structural and maintainability patterns -- state handling, component boundaries, and framework-specific anti-patterns that undermine long-term code health.',
    },
    {
      title: 'Static Performance',
      count: counts.STATIC_PERFORMANCE,
      color: '#eab308',
      desc: 'Source-level risk patterns associated with runtime cost -- allocation inside render/loop scopes, un-dimensioned layout elements, missing memoization. Static findings only; runtime performance is not measured during a static scan.',
    },
    {
      title: 'Accessibility',
      count: counts.ACCESSIBILITY,
      color: '#a855f7',
      desc: 'WCAG 2.2-aligned static checks -- keyboard operability, labelling, and semantic structure that a static analyzer can verify from source alone.',
    },
  ];

  return (
    <section style={{ padding: '72px 0', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
            Three Research-Facing Domains
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', margin: '0 0 12px 0', letterSpacing: '-0.5px' }}>
            Every finding falls into exactly one domain
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '640px', lineHeight: 1.6, margin: 0 }}>
            Rule counts below come directly from the live rule registry -- the same source the
            scanner and admin dashboard read from.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px' }}>
          {domains.map((d) => (
            <div
              key={d.title}
              style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <div style={{ fontSize: '30px', fontWeight: 800, color: d.color, marginBottom: '6px' }}>{d.count}</div>
              <div style={{ color: '#f8fafc', fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>{d.title}</div>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: 1.6 }}>{d.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
