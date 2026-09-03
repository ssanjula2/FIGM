'use client';

import React from 'react';
import { useResearchMetrics } from '../../../src/hooks/useResearchMetrics';

// Tool comparison matrix — structural/design values (from dissertation GAP analysis)
// These reflect which rule *categories* each tool can cover — not live metrics
const TOOLS_COMPARISON = [
  { domain: 'Universal Performance (6 Rules)', figm: '100%', eslint: '33.3%', sonar: '16.7%', light: '50.0%' },
  { domain: 'Universal Accessibility (6 Rules)', figm: '100%', eslint: '66.7%', sonar: '50.0%', light: '83.3%' },
  { domain: 'Next.js App Router (4 Rules)', figm: '100%', eslint: '75.0%', sonar: '25.0%', light: '25.0%' },
  { domain: 'React Rendering & State (4 Rules)', figm: '100%', eslint: '75.0%', sonar: '50.0%', light: '0.0%' },
  { domain: 'Angular RxJS / DOM Safety (5 Rules)', figm: '100%', eslint: '20.0%', sonar: '40.0%', light: '0.0%' },
];

export default function BenchmarkSection() {
  const { data, loading } = useResearchMetrics();

  const bm = data?.benchmarkMetrics;
  const us = data?.userStudy;
  const perf = bm
    ? (data?.benchmarkMetrics as Record<string, unknown> & { performanceMetrics?: { scanSpeedLOCPerSec?: number } })?.performanceMetrics
    : null;

  // Build stats from live API — never hardcoded
  const stats = bm
    ? [
        {
          value: `${(bm.f1Score * 100).toFixed(1)}%`,
          label: 'Controlled Benchmark F1',
          sub: 'Self-authored fixtures, not real-world accuracy',
        },
        {
          value: `${(bm.precision * 100).toFixed(1)}%`,
          label: 'Controlled Benchmark Precision',
          sub: 'Self-authored fixtures, not real-world accuracy',
        },
        {
          value: `${(bm.recall * 100).toFixed(1)}%`,
          label: 'Controlled Benchmark Recall',
          sub: 'Self-authored fixtures, not real-world accuracy',
        },
        {
          value: perf?.scanSpeedLOCPerSec
            ? `${Math.round(perf.scanSpeedLOCPerSec).toLocaleString()}`
            : '—',
          label: 'LOC / Second',
          sub: 'Scan Throughput',
        },
        {
          value: us?.collectedParticipants ?? 0,
          label: 'Human Participants',
          sub:
            us?.collectionStatus === 'COLLECTED'
              ? "Cronbach's α computed"
              : "Cronbach's α — pending data",
          highlight: us?.collectionStatus !== 'COLLECTED',
        },
      ]
    : null;

  return (
    <section id="research-credibility" style={{ padding: '72px 0', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
          Research Credibility
        </div>
        <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', margin: '0 0 16px 0', letterSpacing: '-0.5px' }}>
          Controlled benchmark, real-world corpus, reproducible protocol
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '720px', margin: '0 auto 20px auto', lineHeight: 1.6 }}>
          The figures below come from FIGM&apos;s <strong style={{ color: '#f1f5f9' }}>controlled benchmark</strong> --
          a hand-labelled fixture suite (<code style={{ color: '#38bdf8', fontSize: '13px' }}>benchmarks/eval-summary.json</code>)
          built and labelled by the same team that built the rules. This is a construction-validity
          check, not an independent real-world accuracy measurement -- that requires expert
          validation against manual architectural review, which has not yet been collected.
          Separately, FIGM has been run across a real, pinned-commit 21-repository open-source
          corpus (React, Next.js, Angular, plus Vue and generic JS/TS) under a reproducible
          experiment protocol; no precision/recall is claimed for that corpus without expert review.
        </p>

        {/* Loading placeholder */}
        {loading && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '16px',
              marginBottom: '60px',
            }}
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  height: '100px',
                  borderRadius: '16px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        )}

        {/* 5 Stats Counter Grid — from API */}
        {!loading && stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '60px' }}>
            {stats.map((st) => (
              <div
                key={st.label}
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  backdropFilter: 'blur(16px)',
                  border: `1px solid ${(st as { highlight?: boolean }).highlight ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '16px',
                  padding: '24px 16px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '28px', fontWeight: 900, color: (st as { highlight?: boolean }).highlight ? '#f59e0b' : '#38bdf8', letterSpacing: '-0.5px', marginBottom: '4px' }}>
                  {st.value}
                </div>
                <div style={{ color: '#f8fafc', fontSize: '13px', fontWeight: 700, marginBottom: '2px' }}>{st.label}</div>
                <div style={{ color: '#7c8ba6', fontSize: '11px' }}>{st.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Human study data notice */}
        {!loading && us && us.collectionStatus !== 'COLLECTED' && (
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '12px',
              padding: '14px 20px',
              marginBottom: '40px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '20px' }}>⏳</span>
            <span style={{ color: '#fbbf24', fontSize: '13px', lineHeight: 1.5 }}>
              <strong>Human Usability Study ({us.collectedParticipants}/{us.targetParticipants} participants):</strong>{' '}
              {us.note} Cronbach&apos;s α will be computed once all real survey responses are collected and ingested.
            </span>
          </div>
        )}

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 800, margin: 0 }}>
              Comparative Rule Coverage Matrix (FIGM vs Industrial Tools)
            </h3>
            <span style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 700, background: 'rgba(56, 189, 248, 0.1)', padding: '4px 12px', borderRadius: '20px' }}>
              FIGM Coverage: {data?.systemCapabilities?.totalGuidelineRules ?? '—'}/{data?.systemCapabilities?.totalGuidelineRules ?? '—'} Rules
            </span>
          </div>
          <p style={{ color: '#f59e0b', fontSize: '12px', margin: '0 0 16px 0', lineHeight: 1.5 }}>
            ⚠ Qualitative estimate, not an empirical benchmark: no competitor tool listed below was run against this
            codebase. Percentages reflect a manual judgment of which rule domains each tool&apos;s documented
            capabilities could plausibly cover, not a measured detection rate. Only the stats above (F1-Score,
            Precision, Recall, LOC/Second) are live benchmark measurements.
          </p>

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
                {TOOLS_COMPARISON.map((row) => (
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
