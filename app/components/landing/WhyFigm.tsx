'use client';

import React from 'react';
import { FileCode, Wrench, Layers, Terminal } from 'lucide-react';

// Stage 7C visual-polish pass (Section 3 / "Why FIGM"): a small, restrained capabilities section --
// four short, verifiable facts about how the engine actually works, not marketing adjectives.
const CAPABILITIES = [
  {
    Icon: FileCode,
    title: 'Real AST analysis',
    desc: 'Findings come from the TypeScript compiler and framework-native parsers, not regex heuristics.',
  },
  {
    Icon: Wrench,
    title: 'Deterministic-first remediation',
    desc: 'Safe AST-based fixes where possible, AI-assisted fallback when not -- every fix verified by a real re-scan.',
  },
  {
    Icon: Layers,
    title: 'One framework-independent model',
    desc: 'A single rule taxonomy mapped consistently across React, Next.js, Angular, and Vue.',
  },
  {
    Icon: Terminal,
    title: 'CLI and CI-ready',
    desc: 'The same rule engine runs from the web app or the figm-analyze CLI.',
  },
];

export default function WhyFigm() {
  return (
    <section style={{ padding: '56px 0', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
          Why FIGM
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', margin: '0 0 24px 0', letterSpacing: '-0.3px' }}>
          How the engine actually works
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          {CAPABILITIES.map((c) => (
            <div key={c.title} style={{ display: 'flex', gap: '12px' }}>
              <c.Icon size={18} style={{ color: '#38bdf8', flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
              <div>
                <div style={{ color: '#f8fafc', fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>{c.title}</div>
                <div style={{ color: '#94a3b8', fontSize: '12.5px', lineHeight: 1.55 }}>{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
