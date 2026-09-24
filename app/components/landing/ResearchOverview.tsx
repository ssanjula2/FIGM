'use client';

import React from 'react';
import { useResearchMetrics } from '../../../src/hooks/useResearchMetrics';
import { HUMAN_STUDY_TARGET_PARTICIPANTS } from '../../../src/research/research-config';

// ── Fallback static DSRM phase descriptions (structural, not metric-bearing) ─
const DSRM_PHASES = [
  { num: '01', title: 'Problem Identification', desc: 'Fragmented SPA quality tooling across React, Next.js, Angular, and Vue — no unified framework-independent model exists.' },
  { num: '02', title: 'Objective Definition', desc: 'Formalized 4-layer meta-model & 50 canonical guideline rules (12 framework-independent, 38 framework-specific across Next.js, React, Angular & Vue) aligned with WCAG 2.2 and ISO 25010.' },
  { num: '03', title: 'Design & Development', desc: 'Implemented SourceParser, AST engine, ALP extraction pipeline & Claude Opus 5 AI remediation.' },
  { num: '04', title: 'Demonstration', desc: 'Deployed interactive Next.js web application and executable CLI runner (figm-analyze).' },
  { num: '05', title: 'Evaluation', desc: '' /* populated dynamically from API */ },
  { num: '06', title: 'Communication', desc: 'Published LaTeX dissertation artifacts & IEEE tool demo documentation.' },
];

export default function ResearchOverview() {
  const { data, loading } = useResearchMetrics();

  // Build Phase 05 description from live API data
  const evalDataset = data?.systemCapabilities?.evaluationDataset;
  const bm = data?.benchmarkMetrics;
  const rq4 = data?.rq4;
  const us = data?.userStudy;

  const phase05Desc = bm
    ? `Internal fixture benchmark: ${evalDataset?.sizeTarget ?? '45 hand-authored fixture files'} (P=${(bm.precision * 100).toFixed(1)}%, R=${(bm.recall * 100).toFixed(1)}%, F1=${(bm.f1Score * 100).toFixed(1)}%). ${rq4?.available ? `Separately, RQ4 independent expert evaluation: ${rq4.sampleCount}-sample blinded review (P=${((rq4.precision ?? 0) * 100).toFixed(1)}%, R=${((rq4.recall ?? 0) * 100).toFixed(1)}%, F1=${((rq4.f1Score ?? 0) * 100).toFixed(1)}%, Cohen's kappa=${rq4.cohensKappa?.toFixed(2) ?? '—'}).` : ''} P001–P020 have scan activity as supplementary product-use evidence; this is separate from questionnaire/SUS evidence, which currently has 0/${us?.targetParticipants ?? HUMAN_STUDY_TARGET_PARTICIPANTS} accepted responses.`
    : `Internal fixture benchmark and RQ4 expert evaluation are loaded separately. P001–P020 have scan activity as supplementary product-use evidence; this is separate from questionnaire/SUS evidence, which currently has 0/${HUMAN_STUDY_TARGET_PARTICIPANTS} accepted responses.`;

  const dsrmPhases = DSRM_PHASES.map((p) =>
    p.num === '05' ? { ...p, desc: phase05Desc } : p
  );

  // Research gaps from API
  const gaps = data?.researchGaps ?? [
    { id: 'GAP1', title: 'Lack of Framework Agnosticism', desc: 'Existing design patterns are heavily siloed within specific framework ecosystems.' },
    { id: 'GAP2', title: 'Runtime vs. Static Gap', desc: 'Tools like Lighthouse operate at runtime; limited research exists on static pre-compilation validation.' },
    { id: 'GAP3', title: 'Lack of Actionable Structural Feedback', desc: 'Current automation highlights raw metrics but fails to connect them to specific architectural anti-patterns.' },
  ];

  return (
    <section id="methodology" style={{ padding: '60px 0', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center', padding: '0 24px' }}>
        <div style={{ fontSize: '11px', color: '#a855f7', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
          RESEARCH METHODOLOGY &amp; FRAMEWORK
        </div>
        <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#f8fafc', margin: '0 0 16px 0', letterSpacing: '-0.5px' }}>
          Design Science Research Methodology (DSRM)
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '15px', maxWidth: '700px', margin: '0 auto 48px auto', lineHeight: 1.6 }}>
          Adopting Peffers et al. (2007) canonical 6-phase framework for rigorous software engineering artifact creation.
        </p>

        {/* DSRM 6-Phase Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '60px' }}>
          {dsrmPhases.map((phase) => (
            <div
              key={phase.num}
              style={{
                background: 'rgba(15, 23, 42, 0.6)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '24px',
                textAlign: 'left',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: '-10px', right: '16px', fontSize: '48px', fontWeight: 900, color: 'rgba(255, 255, 255, 0.03)', userSelect: 'none' }}>
                {phase.num}
              </div>
              <div style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 800, marginBottom: '8px' }}>
                PHASE {phase.num}
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#f8fafc', margin: '0 0 8px 0' }}>
                {phase.title}
              </h3>
              <p style={{ color: loading && phase.num === '05' ? '#7c8ba6' : '#94a3b8', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
                {loading && phase.num === '05' ? 'Loading live metrics…' : phase.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Research Gaps — from API */}
        <div style={{ marginBottom: '60px' }}>
          <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
            RESEARCH GAPS IDENTIFIED (IS303.2)
          </div>
          <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', margin: '0 0 28px 0' }}>
            Threefold Literature Gap
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {gaps.map((gap) => (
              <div
                key={gap.id}
                style={{
                  background: 'rgba(245, 158, 11, 0.06)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: '12px',
                  padding: '20px',
                  textAlign: 'left',
                }}
              >
                <div style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 800, marginBottom: '6px' }}>{gap.id}</div>
                <div style={{ color: '#f8fafc', fontSize: '15px', fontWeight: 800, marginBottom: '8px' }}>{gap.title}</div>
                <div style={{ color: '#94a3b8', fontSize: '12px', lineHeight: 1.5 }}>{gap.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Benchmark metrics pill */}
        {bm && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              marginBottom: '40px',
            }}
          >
            {[
              { label: 'Precision', value: `${(bm.precision * 100).toFixed(1)}%`, color: '#38bdf8' },
              { label: 'Recall', value: `${(bm.recall * 100).toFixed(1)}%`, color: '#a855f7' },
              { label: 'F1 Score', value: `${(bm.f1Score * 100).toFixed(1)}%`, color: '#10b981' },
              { label: 'True Positives', value: String(bm.truePositives), color: '#6ee7b7' },
              { label: 'False Positives', value: String(bm.falsePositives), color: '#fca5a5' },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '14px 22px',
                  textAlign: 'center',
                  minWidth: '110px',
                }}
              >
                <div style={{ fontSize: '22px', fontWeight: 900, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: '11px', color: '#7c8ba6', fontWeight: 700, marginTop: '4px' }}>{m.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Problem Statement Banner */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '16px',
            padding: '32px',
            textAlign: 'left',
          }}
        >
          <div>
            <h3 style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0' }}>
              The Research Problem Statement
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
              Existing static analysis tools (e.g. ESLint, SonarQube) are heavily framework-siloed, requiring duplicate
              custom rule plugins for React, Vue, and Angular. FIGM resolves this by introducing{' '}
              <strong style={{ color: '#38bdf8' }}>Abstract Language Primitives (ALPs)</strong> that extract canonical
              AST behaviours across heterogeneous template syntaxes — addressing all three research gaps identified in
              the IS303.2 literature review.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
