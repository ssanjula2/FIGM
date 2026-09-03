'use client';

import React, { useState } from 'react';

interface Stage {
  id: number;
  label: string;
  title: string;
  description: string;
}

const STAGES: Stage[] = [
  { id: 1, label: 'Source Code', title: 'Source Code', description: 'Framework-specific application code you paste, upload, or scan via CLI.' },
  { id: 2, label: 'Parser / AST', title: 'Parser / AST', description: 'FIGM parses the source into an AST-shaped representation, with a genuine compiler-derived AST used for select rules.' },
  { id: 3, label: 'Rule Engine', title: 'FIGM Rule Engine', description: 'The parsed structure is evaluated against the canonical rule registry -- Architecture, Static Performance, and Accessibility checks.' },
  { id: 4, label: 'Findings', title: 'Findings', description: 'Each match becomes a finding: rule ID, severity, research domain, exact source location, and a concrete recommendation.' },
  { id: 5, label: 'Fix', title: 'Fix', description: 'Deterministic-first: an AST-based fix is applied where one exists. AI-assisted remediation is an optional fallback for findings without a deterministic fix, never the primary path.' },
  { id: 6, label: 'Validate', title: 'Validate', description: 'Every candidate fix is checked for syntax validity and, where applicable, type/compile correctness before it is offered.' },
  { id: 7, label: 'Re-scan', title: 'Re-scan', description: 'The file is re-analyzed. A finding is marked VERIFIED only if it is confirmed gone -- never assumed fixed because a patch was generated.' },
];

export default function ArchitecturePipeline() {
  const [activeId, setActiveId] = useState(1);
  const active = STAGES.find((s) => s.id === activeId) || STAGES[0];

  const handleKeyDown = (e: React.KeyboardEvent, id: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveId((id % STAGES.length) + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveId(id === 1 ? STAGES.length : id - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setActiveId(id);
    }
  };

  return (
    <section id="how-it-works" style={{ padding: '72px 0', background: 'rgba(15, 23, 42, 0.35)', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ marginBottom: '36px' }}>
          <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
            How It Works
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', margin: '0 0 12px 0', letterSpacing: '-0.5px' }}>
            Deterministic-first remediation, AI as fallback
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '680px', lineHeight: 1.6, margin: 0 }}>
            FIGM tries an AST-based deterministic fix first. AI-assisted remediation only runs when
            no deterministic fix exists, and every candidate -- deterministic or AI-assisted -- is
            re-scanned before it is ever marked verified.
          </p>
        </div>

        <div role="tablist" aria-label="FIGM analysis pipeline stages" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '24px' }}>
          {STAGES.map((stage) => {
            const isSelected = stage.id === activeId;
            return (
              <button
                key={stage.id}
                role="tab"
                id={`pipeline-tab-${stage.id}`}
                aria-selected={isSelected}
                aria-controls={`pipeline-panel-${stage.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveId(stage.id)}
                onKeyDown={(e) => handleKeyDown(e, stage.id)}
                style={{
                  flex: '1 0 auto',
                  minWidth: '110px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: isSelected ? 'rgba(56, 189, 248, 0.1)' : 'rgba(15, 23, 42, 0.5)',
                  color: isSelected ? '#38bdf8' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {stage.id}. {stage.label}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`pipeline-panel-${active.id}`}
          aria-labelledby={`pipeline-tab-${active.id}`}
          style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '28px',
          }}
        >
          <div style={{ fontSize: '11px', color: '#7c8ba6', fontWeight: 700, marginBottom: '6px' }}>STAGE {active.id} OF {STAGES.length}</div>
          <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#f8fafc', margin: '0 0 12px 0' }}>{active.title}</h3>
          <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>{active.description}</p>
        </div>
      </div>
    </section>
  );
}
