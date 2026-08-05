'use client';

import React from 'react';

export default function AccessibilityPage() {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ fontSize: '12px', color: '#a855f7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
          WCAG 2.1 AA Audit
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.5px' }}>
          Accessibility Inspector
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
          Evaluate keyboard navigation, ARIA roles, contrast ratios, and screen reader compatibility.
        </p>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '12px' }}>
          Accessibility Rule Compliance
        </h2>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>
          Evaluating FIGM-A11Y-01 to FIGM-A11Y-06 across interactive controls, image alt attributes, and keyboard traps.
        </div>
      </div>
    </div>
  );
}
