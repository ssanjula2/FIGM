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
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              color: '#38bdf8',
              fontSize: '12px',
              fontWeight: 700,
              marginBottom: '24px',
            }}
          >
            Framework-Independent Guideline Model
          </div>

          <h1
            style={{
              fontSize: '44px',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-1px',
              color: '#f8fafc',
              margin: '0 0 20px 0',
            }}
          >
            Framework-independent code quality analysis for modern SPAs
          </h1>

          <p style={{ fontSize: '17px', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 32px 0' }}>
            FIGM analyzes architecture, static performance, and accessibility risks before
            deployment and provides actionable findings with validated remediation.
          </p>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <Link
              href="/live-scan"
              style={{
                padding: '13px 24px',
                borderRadius: '10px',
                background: '#38bdf8',
                color: '#020617',
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
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#f8fafc',
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
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#6ee7b7', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.28)', borderRadius: '999px', padding: '3px 10px' }}>
                Scan Complete
              </span>
              <span style={{ fontSize: '11px', color: '#7c8ba6' }}>UserProfile.jsx</span>
            </div>
            <span style={{ fontSize: '10px', color: '#5c6b85', fontStyle: 'italic' }}>Product preview — not a live scan</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            {[
              { label: 'Architecture', value: counts.ARCHITECTURE, color: '#38bdf8' },
              { label: 'Static Performance', value: counts.STATIC_PERFORMANCE, color: '#eab308' },
              { label: 'Accessibility', value: counts.ACCESSIBILITY, color: '#a855f7' },
            ].map((d) => (
              <div key={d.label} style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>{d.label} rules</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: d.color }}>{d.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background: '#020617', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '18px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 8px', borderRadius: '5px' }}>
                HIGH
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>FIGM-A11Y-01</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>UserProfile.jsx:22</span>
            </div>
            <div style={{ color: '#f8fafc', fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>
              Keyboard Event Parity on Pointer Handlers
            </div>
            <div style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.5, marginBottom: '12px' }}>
              Recommendation: use a native interactive element (&lt;button&gt;) or add tabIndex=&quot;0&quot; with an onKeyDown handler.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span
                aria-hidden="true"
                style={{ fontSize: '12px', fontWeight: 700, color: '#020617', background: '#6ee7b7', padding: '6px 14px', borderRadius: '7px' }}
              >
                Apply Fix
              </span>
              <span style={{ fontSize: '11px', color: '#7c8ba6' }}>Deterministic fix — verified after re-scan</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
