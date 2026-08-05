'use client';

import React from 'react';

export default function ResearchOverview() {
  const dsrmPhases = [
    { num: '01', title: 'Problem Identification', desc: 'Fragmented SPA quality tooling across React, Next.js, and Angular.' },
    { num: '02', title: 'Objective Definition', desc: 'Formalized 4-layer meta-model & 25 framework-independent rules.' },
    { num: '03', title: 'Design & Development', desc: 'Implemented SourceParser, AST engine & Gemini 2.5 Flash pipeline.' },
    { num: '04', title: 'Demonstration', desc: 'Deployed interactive Next.js web application and CLI runner.' },
    { num: '05', title: 'Evaluation', desc: 'Evaluated 30 repos (755k LOC), ground truth (F1=90%), and user study (α=0.89).' },
    { num: '06', title: 'Communication', desc: 'Published LaTeX dissertation artifacts & IEEE tool demo documentation.' },
  ];

  return (
    <section style={{ padding: '60px 0', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', color: '#a855f7', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
          RESEARCH METHODOLOGY & FRAMEWORK
        </div>
        <h2 style={{ fontSize: '32px', fontWeight: 900, color: '#f8fafc', margin: '0 0 16px 0', letterSpacing: '-0.5px' }}>
          Design Science Research Methodology (DSRM)
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '15px', maxWidth: '700px', margin: '0 auto 48px auto', lineHeight: 1.6 }}>
          Adopting Peffers et al. (2007) canonical 6-phase framework for rigorous software engineering artifact creation.
        </p>

        {/* DSRM 6-Phase Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '60px' }}>
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
              <div
                style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '16px',
                  fontSize: '48px',
                  fontWeight: 900,
                  color: 'rgba(255, 255, 255, 0.03)',
                  userSelect: 'none',
                }}
              >
                {phase.num}
              </div>
              <div style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 800, marginBottom: '8px' }}>
                PHASE {phase.num}
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#f8fafc', margin: '0 0 8px 0' }}>
                {phase.title}
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
                {phase.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Problem Statement Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '16px',
            padding: '32px',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          <div
            style={{
              fontSize: '36px',
              background: 'rgba(56, 189, 248, 0.1)',
              padding: '16px',
              borderRadius: '14px',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            ⚖️
          </div>
          <div>
            <h3 style={{ color: '#f8fafc', fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0' }}>
              The Research Problem Statement
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
              Existing static analysis tools (e.g. ESLint, SonarQube) are heavily framework-siloed, requiring duplicate custom rule plugins for React, Vue, and Angular. FIGM resolves this by introducing <strong style={{ color: '#38bdf8' }}>Abstract Language Primitives (ALPs)</strong> that extract canonical AST behaviors across heterogeneous template syntaxes.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
