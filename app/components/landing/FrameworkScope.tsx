'use client';

import React from 'react';

export default function FrameworkScope() {
  return (
    <section style={{ padding: '56px 0', borderTop: '1px solid rgba(0, 0, 0, 0.08)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
              Primary Framework Scope
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {['React', 'Next.js', 'Angular'].map((f) => (
                <span
                  key={f}
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'rgba(0, 0, 0, 0.82)',
                    background: 'rgba(96, 165, 250, 0.08)',
                    border: '1px solid rgba(96, 165, 250, 0.25)',
                    padding: '8px 16px',
                    borderRadius: '8px',
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          <div style={{ width: '1px', height: '48px', background: 'rgba(255,255,255,0.1)' }} className="scope-divider" />

          <div>
            <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
              Additional Support
            </div>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'rgba(0, 0, 0, 0.7)',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                padding: '8px 16px',
                borderRadius: '8px',
                display: 'inline-block',
              }}
            >
              Vue
            </span>
          </div>
        </div>
        <p style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '12px', marginTop: '16px', maxWidth: '640px', lineHeight: 1.6 }}>
          Vue is supported additionally; the primary research framework scope is React, Next.js, and Angular.
        </p>
      </div>
    </section>
  );
}
