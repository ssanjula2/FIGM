'use client';

import React from 'react';
import ReferencesSection from '../components/landing/ReferencesSection';

export default function ReferencesPage() {
  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div
        style={{
          padding: '32px 0 0 0',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: '20px',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            color: '#38bdf8',
            fontSize: '12px',
            fontWeight: 700,
            marginBottom: '16px',
            boxShadow: '0 0 20px rgba(56, 189, 248, 0.15)',
          }}
        >
          <span>📚</span>
          <span>IS303.2 Repeat Coursework 2025 — NSBM Green University</span>
        </div>
        <h1
          style={{
            fontSize: '36px',
            fontWeight: 900,
            color: '#f8fafc',
            margin: '0 0 10px 0',
            letterSpacing: '-1px',
          }}
        >
          Dissertation Bibliography
        </h1>
        <p style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
          All 9 references cited in the research proposal for{' '}
          <em style={{ color: '#94a3b8' }}>
            &ldquo;Usability Evaluation of the Framework-Independent Guideline Model (FIGM) Code Inspector for Single Page Applications&rdquo;
          </em>
          . References are served dynamically from{' '}
          <code style={{ color: '#1d4ed8', fontSize: '13px' }}>/api/research-metrics</code>.
        </p>

        {/* Dissertation identity card */}
        <div
          style={{
            display: 'flex',
            gap: '24px',
            flexWrap: 'wrap',
            marginTop: '24px',
            padding: '20px 24px',
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            backdropFilter: 'blur(16px)',
          }}
        >
          {[
            { label: 'Candidate', value: 'A P H D S Sanjula' },
            { label: 'Student ID', value: '28256' },
            { label: 'Module', value: 'IS303.2 Research Methodology' },
            { label: 'Institution', value: 'NSBM Green University' },
            { label: 'Year', value: '2025' },
          ].map((item) => (
            <div key={item.label}>
              <div style={{ fontSize: '10px', color: 'rgba(0, 0, 0, 0.7)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                {item.label}
              </div>
              <div style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.82)', fontWeight: 700 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* References list — from /api/research-metrics */}
      <ReferencesSection />
    </div>
  );
}
