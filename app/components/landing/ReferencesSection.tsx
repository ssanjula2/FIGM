'use client';

import React from 'react';
import { useResearchMetrics } from '../../../src/hooks/useResearchMetrics';

export default function ReferencesSection() {
  const { data, loading, error } = useResearchMetrics();

  const refs = data?.references ?? [];

  return (
    <section
      id="references"
      style={{ padding: '80px 0', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Section header */}
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
            BIBLIOGRAPHY
          </div>
          <h2
            style={{
              fontSize: '32px',
              fontWeight: 900,
              color: '#f8fafc',
              margin: '0 0 14px 0',
              letterSpacing: '-0.5px',
            }}
          >
            Research References
          </h2>
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
            IS303.2 Research Methodology — A P H D S Sanjula (28256) · NSBM Green University · 2025
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>
            Loading references from API…
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '20px',
              color: '#fca5a5',
              textAlign: 'center',
            }}
          >
            Failed to load references: {error}
          </div>
        )}

        {/* Reference list */}
        {!loading && !error && refs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {refs.map((ref, idx) => (
              <div
                key={ref.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '20px 24px',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-start',
                }}
              >
                {/* Index badge */}
                <div
                  style={{
                    minWidth: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 900,
                    color: '#38bdf8',
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </div>

                {/* Reference text */}
                <div>
                  <span style={{ color: '#f1f5f9', fontSize: '14px', lineHeight: 1.6 }}>
                    <strong style={{ color: '#e2e8f0' }}>{ref.authors}</strong>{', '}
                    {ref.year}.{' '}
                    <em style={{ color: '#c084fc' }}>{ref.title}</em>
                    {ref.venue ? <>. {ref.venue}</> : null}
                    {(ref as { volume?: string }).volume ? <>, {(ref as { volume?: string }).volume}</> : null}
                    {ref.pages ? <>, pp. {ref.pages}</> : null}
                    {(ref as { url?: string }).url ? (
                      <>
                        {'. Available at: '}
                        <a
                          href={(ref as { url?: string }).url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#38bdf8', textDecoration: 'underline' }}
                        >
                          {(ref as { url?: string }).url}
                        </a>
                        {(ref as { accessedDate?: string }).accessedDate
                          ? ` [Accessed ${(ref as { accessedDate?: string }).accessedDate}]`
                          : null}
                      </>
                    ) : null}
                    {'.'}
                  </span>

                  {/* Ref id badge */}
                  <div style={{ marginTop: '6px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        color: '#64748b',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.07)',
                        borderRadius: '6px',
                        padding: '2px 8px',
                      }}
                    >
                      [{ref.id}]
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
