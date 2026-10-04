'use client';

import React from 'react';
import Link from 'next/link';
import { getDomainCounts } from '../../../src/matrix/domain-counts';

export default function HeroSection() {
  const counts = getDomainCounts();

  return (
    <section id="top" style={{ padding: '72px 0 64px 0' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ maxWidth: '760px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 14px',
              borderRadius: '20px',
              background: 'rgba(96, 165, 250, 0.08)',
              border: '1px solid rgba(96, 165, 250, 0.25)',
              color: '#1d4ed8',
              fontSize: '12px',
              fontWeight: 700,
              marginBottom: '24px',
            }}
          >
            Framework-Agnostic Guideline Model
          </div>

          <h1
            style={{
              fontSize: '44px',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-1px',
              color: 'rgba(0, 0, 0, 0.82)',
              margin: '0 0 20px 0',
            }}
          >
            Framework-independent code quality analysis for modern SPAs
          </h1>

          <p style={{ fontSize: '17px', color: 'rgba(0, 0, 0, 0.7)', lineHeight: 1.6, margin: '0 0 32px 0' }}>
            FIGM analyzes architecture, static performance, and accessibility risks before
            deployment and provides actionable findings with validated remediation.
          </p>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <Link
              href="/live-scan"
              style={{
                padding: '13px 24px',
                borderRadius: '10px',
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 800,
                textDecoration: 'none',
              }}
            >
              Start a Scan
            </Link>
            <Link
              href="/guidelines"
              style={{
                padding: '13px 24px',
                borderRadius: '10px',
                border: '1px solid rgba(0, 0, 0, 0.15)',
                color: 'rgba(0, 0, 0, 0.82)',
                fontSize: '14px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Explore Guidelines
            </Link>
          </div>
        </div>

        {/* Product Preview -- a representative, clearly-labelled UI mockup of a real scan result
            shape, never presented as a live/claimed measurement. Domain counts are the real,
            registry-derived rule totals; the finding card below is illustrative sample content. */}
        <div
          id="product-preview"
          style={{
            marginTop: '56px',
            background: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: '14px',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#1d4ed8', background: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.28)', borderRadius: '999px', padding: '3px 10px' }}>
                Scan Complete
              </span>
              <span style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)' }}>UserProfile.jsx</span>
            </div>
            <span style={{ fontSize: '10px', color: 'rgba(0, 0, 0, 0.7)', fontStyle: 'italic' }}>Product preview — not a live scan</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Architecture', value: counts.ARCHITECTURE, color: '#1d4ed8' },
              { label: 'Static Performance', value: counts.STATIC_PERFORMANCE, color: '#1d4ed8' },
              { label: 'Accessibility', value: counts.ACCESSIBILITY, color: '#1d4ed8' },
            ].map((d) => (
              <div key={d.label} style={{ background: '#ffffff', border: '1px solid rgba(0, 0, 0, 0.06)', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', marginBottom: '4px' }}>{d.label} rules</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: d.color }}>{d.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#ffffff', border: '1px solid rgba(0, 0, 0, 0.06)', borderRadius: '10px', padding: '18px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 8px', borderRadius: '5px' }}>
                HIGH
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', fontFamily: 'monospace' }}>FIGM-A11Y-01</span>
              <span style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)' }}>UserProfile.jsx:22</span>
            </div>
            <div style={{ color: 'rgba(0, 0, 0, 0.82)', fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>
              Keyboard Event Parity on Pointer Handlers
            </div>
            <div style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '13px', lineHeight: 1.5, marginBottom: '12px' }}>
              Recommendation: use a native interactive element (&lt;button&gt;) or add tabIndex=&quot;0&quot; with an onKeyDown handler.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span
                aria-hidden="true"
                style={{ fontSize: '12px', fontWeight: 700, color: '#000000', background: '#60a5fa', padding: '6px 14px', borderRadius: '7px' }}
              >
                Apply Fix
              </span>
              <span style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)' }}>Deterministic fix — verified after re-scan</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
