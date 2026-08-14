'use client';

import React, { useState } from 'react';

interface PipelineStage {
  id: number;
  stageName: string;
  shortLabel: string;
  icon: string;
  title: string;
  description: string;
  type: 'code' | 'ast' | 'alp' | 'rule' | 'violation' | 'diff' | 'validation';
  content: {
    badge?: string;
    codeBefore?: string;
    codeAfter?: string;
    astText?: string;
    alpName?: string;
    ruleId?: string;
    ruleTitle?: string;
    violationDetails?: {
      severity: string;
      confidence: string;
      category: string;
      explanation: string;
    };
    validationChecks?: string[];
  };
}

export default function ArchitecturePipeline() {
  const [activeStageId, setActiveStageId] = useState<number>(1);

  const stages: PipelineStage[] = [
    {
      id: 1,
      stageName: 'Stage 1',
      shortLabel: 'Source Code',
      icon: '📄',
      title: 'Source Code',
      description: 'Framework-specific application code written by the developer.',
      type: 'code',
      content: {
        codeBefore: `const updateUser = () => {
  user.active = true;
  setUser(user);
};`,
      },
    },
    {
      id: 2,
      stageName: 'Stage 2',
      shortLabel: 'Structural Parsing',
      icon: '🌳',
      title: 'AST-Shaped Intermediate Representation',
      description: 'FIGM parses source structure into an AST-shaped representation via pattern-based scanning, with a genuine compiler-derived AST used for select rules (see docs/audit/AST_ARCHITECTURE_AUDIT.md).',
      type: 'ast',
      content: {
        astText: `CallExpression
 ├─ Callee: Identifier(setUser)
 └─ Arguments
     └─ Identifier(user) [Mutated Property: active=true]`,
      },
    },
    {
      id: 3,
      stageName: 'Stage 3',
      shortLabel: 'ALP Mapping',
      icon: '⚙️',
      title: 'Abstract Logic Pattern (ALP)',
      description: 'Framework-specific syntax is mapped to a framework-independent Abstract Logic Pattern.',
      type: 'alp',
      content: {
        alpName: 'ALP-STATE-MUTATION',
        badge: 'Universal Logic Representation',
      },
    },
    {
      id: 4,
      stageName: 'Stage 4',
      shortLabel: 'FIGM Rule',
      icon: '📐',
      title: 'FIGM Guideline Rule Evaluation',
      description: 'The abstract logic pattern is evaluated against a formal FIGM guideline.',
      type: 'rule',
      content: {
        ruleId: 'FIGM-REACT-03',
        ruleTitle: 'Invariant React State Object Mutation Predicate',
        badge: 'FIGM Guideline Matrix v3.0',
      },
    },
    {
      id: 5,
      stageName: 'Stage 5',
      shortLabel: 'Violation',
      icon: '⚠️',
      title: 'Violation Detected',
      description: 'FIGM identifies the pattern as a potential performance, accessibility, maintainability, or framework-specific issue.',
      type: 'violation',
      content: {
        violationDetails: {
          severity: 'HIGH',
          confidence: 'High Confidence',
          category: 'Performance & State Safety',
          explanation: 'Direct state mutation detected prior to state dispatch. React re-render optimization skipped due to identical object reference.',
        },
      },
    },
    {
      id: 6,
      stageName: 'Stage 6',
      shortLabel: 'AI-Assisted Fix',
      icon: '🤖',
      title: 'AI-Assisted Fix Generation',
      description: 'FIGM generates a recommended remediation while preserving the intended behavior of the application.',
      type: 'diff',
      content: {
        codeBefore: `user.active = true;
setUser(user);`,
        codeAfter: `setUser({
  ...user,
  active: true
});`,
      },
    },
    {
      id: 7,
      stageName: 'Stage 7',
      shortLabel: 'Validation',
      icon: '✅',
      title: 'Validated Patch Verification',
      description: 'The proposed fix is re-analyzed to verify that the original violation is resolved and that the patch does not introduce a new issue.',
      type: 'validation',
      content: {
        validationChecks: [
          'Original violation resolved',
          'AST validation passed',
          'FIGM rule re-check passed',
        ],
      },
    },
  ];

  const activeStage = stages.find((s) => s.id === activeStageId) || stages[0];

  const handleKeyDown = (e: React.KeyboardEvent, id: number) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveStageId((prev) => (prev % stages.length) + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveStageId((prev) => (prev === 1 ? stages.length : prev - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setActiveStageId(id);
    }
  };

  return (
    <section
      id="how-figm-analyzes-your-code"
      style={{
        padding: '80px 0',
        background: 'rgba(15, 23, 42, 0.4)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '0 24px' }}>
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div
            style={{
              fontSize: '11px',
              color: '#38bdf8',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '8px',
            }}
          >
            RESEARCH CONTRIBUTION ARCHITECTURE
          </div>
          <h2
            style={{
              fontSize: '34px',
              fontWeight: 900,
              color: '#f8fafc',
              margin: '0 0 16px 0',
              letterSpacing: '-0.8px',
            }}
          >
            How FIGM Analyzes Your Code
          </h2>
          <p
            style={{
              color: '#94a3b8',
              fontSize: '15px',
              maxWidth: '750px',
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            An end-to-end framework-independent static analysis pipeline converting framework-specific, AST-shaped nodes into Abstract Language Primitives (ALPs) for reusable quality verification and patch validation.
          </p>
        </div>

        {/* Pipeline Stepper Navigation */}
        <div
          role="tablist"
          aria-label="FIGM Code Analysis Pipeline Stages"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '16px',
            marginBottom: '32px',
            scrollbarWidth: 'thin',
          }}
        >
          {stages.map((stage, idx) => {
            const isSelected = stage.id === activeStageId;
            return (
              <React.Fragment key={stage.id}>
                <button
                  role="tab"
                  id={`tab-stage-${stage.id}`}
                  aria-selected={isSelected}
                  aria-controls={`panel-stage-${stage.id}`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveStageId(stage.id)}
                  onKeyDown={(e) => handleKeyDown(e, stage.id)}
                  style={{
                    flex: '1 0 auto',
                    minWidth: '125px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: isSelected
                      ? '1px solid #38bdf8'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                    background: isSelected
                      ? 'rgba(56, 189, 248, 0.12)'
                      : 'rgba(15, 23, 42, 0.6)',
                    boxShadow: isSelected ? '0 0 20px rgba(56, 189, 248, 0.2)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                    outline: 'none',
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{stage.icon}</span>
                  <span style={{ fontSize: '10px', color: '#7c8ba6', fontWeight: 800 }}>
                    {stage.stageName}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: isSelected ? '#38bdf8' : '#cbd5e1',
                    }}
                  >
                    {stage.shortLabel}
                  </span>
                </button>

                {idx < stages.length - 1 && (
                  <span
                    style={{
                      color: '#475569',
                      fontSize: '14px',
                      userSelect: 'none',
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  >
                    →
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Interactive Active Stage Panel */}
        <div
          role="tabpanel"
          id={`panel-stage-${activeStage.id}`}
          aria-labelledby={`tab-stage-${activeStage.id}`}
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '20px',
            padding: '32px',
            marginBottom: '48px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
            transition: 'all 0.25s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '28px' }}>{activeStage.icon}</span>
              <div>
                <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  {activeStage.stageName} OF 7
                </span>
                <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                  {activeStage.title}
                </h3>
              </div>
            </div>

            {activeStage.content.badge && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#a855f7',
                  background: 'rgba(168, 85, 247, 0.15)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  padding: '4px 12px',
                  borderRadius: '20px',
                }}
              >
                {activeStage.content.badge}
              </span>
            )}
          </div>

          <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
            "{activeStage.description}"
          </p>

          {/* Render Stage Specific Content Example */}
          <div style={{ background: '#020617', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            {activeStage.type === 'code' && (
              <div>
                <div style={{ fontSize: '11px', color: '#7c8ba6', fontWeight: 700, marginBottom: '8px' }}>INPUT SOURCE CODE (TSX)</div>
                <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '13px', color: '#f8fafc', lineHeight: 1.5, overflowX: 'auto' }}>
                  <code>{activeStage.content.codeBefore}</code>
                </pre>
              </div>
            )}

            {activeStage.type === 'ast' && (
              <div>
                <div style={{ fontSize: '11px', color: '#7c8ba6', fontWeight: 700, marginBottom: '8px' }}>ILLUSTRATIVE AST-SHAPED STRUCTURE</div>
                <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '13px', color: '#38bdf8', lineHeight: 1.5, overflowX: 'auto' }}>
                  <code>{activeStage.content.astText}</code>
                </pre>
              </div>
            )}

            {activeStage.type === 'alp' && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '11px', color: '#7c8ba6', fontWeight: 700, marginBottom: '12px' }}>NORMALIZED ABSTRACT LOGIC PATTERN</div>
                <div
                  style={{
                    display: 'inline-block',
                    fontSize: '20px',
                    fontWeight: 900,
                    color: '#a855f7',
                    background: 'rgba(168, 85, 247, 0.12)',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    padding: '12px 28px',
                    borderRadius: '12px',
                    letterSpacing: '1px',
                    fontFamily: 'monospace',
                  }}
                >
                  {activeStage.content.alpName}
                </div>
              </div>
            )}

            {activeStage.type === 'rule' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 900,
                    color: '#f59e0b',
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    fontFamily: 'monospace',
                  }}
                >
                  {activeStage.content.ruleId}
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                    {activeStage.content.ruleTitle}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    Evaluated across 25 pre-registered formal quality predicates.
                  </div>
                </div>
              </div>
            )}

            {activeStage.type === 'violation' && activeStage.content.violationDetails && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    SEVERITY: {activeStage.content.violationDetails.severity}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                    {activeStage.content.violationDetails.confidence}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#cbd5e1' }}>
                    {activeStage.content.violationDetails.category}
                  </span>
                </div>
                <p style={{ margin: 0, color: '#cbd5e1', fontSize: '13px', lineHeight: 1.5 }}>
                  {activeStage.content.violationDetails.explanation}
                </p>
              </div>
            )}

            {activeStage.type === 'diff' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 800, marginBottom: '6px' }}>BEFORE (Violation)</div>
                  <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '12px', color: '#fca5a5', lineHeight: 1.4 }}>
                    <code>{activeStage.content.codeBefore}</code>
                  </pre>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 800, marginBottom: '6px' }}>AFTER (AI Remediation)</div>
                  <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '12px', color: '#6ee7b7', lineHeight: 1.4 }}>
                    <code>{activeStage.content.codeAfter}</code>
                  </pre>
                </div>
              </div>
            )}

            {activeStage.type === 'validation' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 800, marginBottom: '4px' }}>POST-FIX RE-ANALYSIS RESULTS</div>
                {activeStage.content.validationChecks?.map((check, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc', fontSize: '13px' }}>
                    <span style={{ color: '#10b981', fontWeight: 900 }}>✓</span>
                    <span>{check}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Framework-Independent Contribution Statement & Diagram */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '40px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', maxWidth: '850px', margin: '0 auto 28px auto', lineHeight: 1.6 }}>
            "FIGM separates framework syntax from reusable software-quality logic, enabling the same analysis model to identify comparable patterns across modern SPA frameworks."
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px',
              flexWrap: 'wrap',
              background: '#020617',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {/* Input Frameworks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                React SPA
              </span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#818cf8', background: 'rgba(129, 140, 248, 0.1)', padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(129, 140, 248, 0.2)' }}>
                Next.js App Router
              </span>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#f43f5e', background: 'rgba(244, 63, 94, 0.1)', padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                Angular 17+
              </span>
            </div>

            <span style={{ color: '#7c8ba6', fontSize: '18px', fontWeight: 700 }}>→</span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>PARSER ENGINE</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', background: 'rgba(255, 255, 255, 0.08)', padding: '8px 16px', borderRadius: '8px' }}>
                Abstract Syntax Tree (AST)
              </span>
            </div>

            <span style={{ color: '#7c8ba6', fontSize: '18px', fontWeight: 700 }}>→</span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#a855f7', fontWeight: 700 }}>INTERMEDIATE LAYER</span>
              <span style={{ fontSize: '13px', fontWeight: 900, color: '#a855f7', background: 'rgba(168, 85, 247, 0.15)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                Abstract Logic Pattern (ALP)
              </span>
            </div>

            <span style={{ color: '#7c8ba6', fontSize: '18px', fontWeight: 700 }}>→</span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>UNIFIED EVALUATION</span>
              <span style={{ fontSize: '13px', fontWeight: 900, color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                FIGM Guideline Rule
              </span>
            </div>
          </div>

          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginTop: '16px' }}>
            Different Frameworks → Common Logic Representation → Common Quality Model
          </div>
        </div>

        {/* Section 5: "Why FIGM?" Research Callout */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08) 0%, rgba(168, 85, 247, 0.05) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '16px',
            padding: '28px 32px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '20px' }}>💡</span>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              Why FIGM?
            </h3>
          </div>
          <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
            Traditional static analysis tools often rely heavily on framework-specific rules. FIGM introduces an intermediate abstraction layer that maps framework-specific code structures into reusable Abstract Logic Patterns (ALPs), enabling consistent quality inspection across SPA frameworks.
          </p>
        </div>
      </div>
    </section>
  );
}
