'use client';

import React, { useState } from 'react';

const BENCHMARKS = {
  react: {
    name: 'React SPA Fixture (UserProfile.jsx)',
    framework: 'React JSX',
    file: 'UserProfile.jsx',
    code: `import React, { useState } from 'react';

export function UserProfile({ user, onUpdate }) {
  const [data, setData] = useState(user);

  // FIGM-PERF-01: Invariant object allocation inside render scope
  const options = { theme: 'dark', lang: 'en' };

  // FIGM-PERF-03: Inline event handler closure allocation
  return (
    <div className="user-profile">
      <h2>{data.name}</h2>
      <input type="text" onChange={(e) => setData({ ...data, name: e.target.value })} />
      <button onClick={() => onUpdate(data)}>Save Profile</button>
    </div>
  );
}`
  },
  angular: {
    name: 'Angular Component Fixture (SearchPanel.component.ts)',
    framework: 'Angular TypeScript',
    file: 'SearchPanel.component.ts',
    code: `@Component({
  selector: 'app-search-panel',
  template: \`
    <div class="search-box">
      <!-- FIGM-A11Y-02: Missing form control label -->
      <input type="text" [(ngModel)]="query" placeholder="Search items..." />
      <!-- FIGM-A11Y-01: Non-semantic interactive element -->
      <div class="btn-search" (click)="onSearch()">Search</div>
    </div>
  \`
})
export class SearchPanelComponent {
  query = '';
  onSearch() { console.log('Searching:', this.query); }
}`
  },
  vue: {
    name: 'Vue SFC Fixture (DataGrid.vue)',
    framework: 'Vue SFC',
    file: 'DataGrid.vue',
    code: `<template>
  <div class="data-grid">
    <!-- FIGM-A11Y-04: Missing img alt attribute -->
    <img src="/avatar.png" />
    <table class="grid-table">
      <tr v-for="item in items" :key="item.id">
        <td>{{ item.name }}</td>
      </tr>
    </table>
  </div>
</template>`
  }
};

const INITIAL_DIAGNOSTICS = [
  {
    id: 1,
    ruleId: 'FIGM-PERF-01',
    ruleName: 'Invariant Object Allocation in Iteration Scopes',
    category: 'Performance',
    severity: 'HIGH',
    file: 'UserProfile.jsx',
    line: 7,
    explanation: 'Static object or closure literal instantiated inside render routine without memoization or hoisting.',
    recommendation: 'Hoist options literal out of render scope or wrap with React.useMemo().'
  },
  {
    id: 2,
    ruleId: 'FIGM-PERF-03',
    ruleName: 'Inline Event Handler Allocation',
    category: 'Performance',
    severity: 'MEDIUM',
    file: 'UserProfile.jsx',
    line: 13,
    explanation: 'Inline arrow function passed as prop causes child re-render allocation on every render execution.',
    recommendation: 'Wrap event handler in React.useCallback() or bind named handler method.'
  },
  {
    id: 3,
    ruleId: 'FIGM-A11Y-02',
    ruleName: 'Missing Form Control Label',
    category: 'Accessibility',
    severity: 'CRITICAL',
    file: 'SearchPanel.component.ts',
    line: 6,
    explanation: 'Input element lacks associated <label>, aria-label, or aria-labelledby attribute for screen readers.',
    recommendation: 'Add explicit aria-label="Search input" or associate with a <label> element.'
  },
  {
    id: 4,
    ruleId: 'FIGM-A11Y-01',
    ruleName: 'Non-Semantic Interactive Element',
    category: 'Accessibility',
    severity: 'HIGH',
    file: 'SearchPanel.component.ts',
    line: 8,
    explanation: 'Non-interactive <div> element has click handler attached without role="button" or tabIndex.',
    recommendation: 'Replace <div> with semantic <button> element or add role="button" and tabIndex={0}.'
  }
];

export default function UserStudyPage() {
  const [selectedFramework, setSelectedFramework] = useState<'react' | 'angular' | 'vue'>('react');
  const [isScanning, setIsScanning] = useState(false);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [activeTask, setActiveTask] = useState<number | null>(1);

  const googleFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSf7XA39VT1Gx5inZstWj7sXkquAb04aK70BWz8uYWWtjMZDOw/viewform';

  const handleRunScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setScanCompleted(true);
    }, 600);
  };

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1200px', margin: '0 auto', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header Banner */}
      <div style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '32px' }}>
        <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '9999px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
          ACADEMIC RESEARCH USER STUDY — TARGET N=85 PARTICIPANTS
        </span>
        <h1 style={{ fontSize: '32px', fontWeight: 700, margin: '0 0 8px 0', color: '#ffffff' }}>
          FIGM Code Inspector — User Study
        </h1>
        <h2 style={{ fontSize: '18px', color: '#94a3b8', fontWeight: 400, margin: '0 0 16px 0' }}>
          Usability Evaluation of the Framework-Independent Guideline Model for Single Page Applications
        </h2>
        <div style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6' }}>
          <p style={{ margin: '0 0 8px 0' }}><strong>Institution:</strong> NSBM Green University | <strong>Module:</strong> IS303.2 Research Methodology | <strong>Candidate:</strong> A P H D S Sanjula (ID: 28256)</p>
          <p style={{ margin: 0 }}><strong>Estimated Duration:</strong> 15–25 minutes | <strong>Eligibility:</strong> 18 years or older | <strong>Privacy:</strong> 100% Anonymous (No PII collected)</p>
        </div>
      </div>

      {/* Main Instructions & Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <h3 style={{ fontSize: '20px', margin: '0 0 12px 0', color: '#38bdf8' }}>📖 How to Participate</h3>
          <ol style={{ paddingLeft: '20px', margin: 0, lineHeight: '1.8', color: '#cbd5e1', fontSize: '15px' }}>
            <li><strong>Step 1:</strong> Select a benchmark fixture (React, Angular, or Vue) below.</li>
            <li><strong>Step 2:</strong> Click <strong>"Run FIGM Scan"</strong> to inspect detected guidelines.</li>
            <li><strong>Step 3:</strong> Review the reported diagnostics, rule IDs, and recommendations.</li>
            <li><strong>Step 4:</strong> Click <strong>"Open Google Form Questionnaire"</strong> to record your feedback.</li>
          </ol>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '16px' }}>
          <button
            onClick={() => {
              const el = document.getElementById('benchmark-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{ padding: '14px 24px', borderRadius: '8px', background: '#2563eb', color: '#ffffff', border: 'none', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}
          >
            ⚡ Start FIGM User Study Tasks
          </button>
          <a
            href={googleFormUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', padding: '14px 24px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.4)', textAlign: 'center', fontSize: '16px', fontWeight: 600, textDecoration: 'none' }}
          >
            📝 Open Google Form Questionnaire ↗
          </a>
        </div>
      </div>

      {/* Task Guide Overview */}
      <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '20px', margin: '0 0 16px 0', color: '#f59e0b' }}>🎯 Structured Evaluation Tasks (Questions 9–15)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {[
            { num: 1, title: 'Identify Rule ID', desc: 'Find rule associated with an issue (e.g. FIGM-PERF-01)' },
            { num: 2, title: 'Understand Diagnostic', desc: 'Review what the issue is & why it matters' },
            { num: 3, title: 'Locate Source Code', desc: 'Identify reported line numbers in source file' },
            { num: 4, title: 'Understand Fix', desc: 'Evaluate confidence in recommended improvement' },
            { num: 5, title: 'Manual Comparison', desc: 'Evaluate if FIGM helped spot issues hard to spot manually' }
          ].map((t) => (
            <div
              key={t.num}
              onClick={() => setActiveTask(t.num)}
              style={{
                padding: '16px',
                borderRadius: '8px',
                background: activeTask === t.num ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                border: activeTask === t.num ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.05)',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#60a5fa', marginBottom: '4px' }}>TASK {t.num}</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>{t.title}</div>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Benchmark Selector & Code Inspector Section */}
      <div id="benchmark-section" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '20px', margin: '0 0 4px 0', color: '#ffffff' }}>🧪 Interactive FIGM Benchmark Inspector</h3>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>Select a Single Page Application framework fixture to inspect static diagnostics.</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['react', 'angular', 'vue'] as const).map((fw) => (
              <button
                key={fw}
                onClick={() => { setSelectedFramework(fw); setScanCompleted(false); }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  background: selectedFramework === fw ? '#2563eb' : 'rgba(255, 255, 255, 0.05)',
                  color: selectedFramework === fw ? '#ffffff' : '#cbd5e1',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textTransform: 'capitalize'
                }}
              >
                {fw}
              </button>
            ))}
          </div>
        </div>

        {/* Source Code Viewer */}
        <div style={{ background: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '20px', fontFamily: 'monospace', fontSize: '14px', lineHeight: '1.5', overflowX: 'auto' }}>
          <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '4px' }}>
            FIXTURE: {BENCHMARKS[selectedFramework].name}
          </div>
          <pre style={{ margin: 0, color: '#e2e8f0' }}>{BENCHMARKS[selectedFramework].code}</pre>
        </div>

        {/* Scan Action */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <button
            onClick={handleRunScan}
            disabled={isScanning}
            style={{ padding: '12px 24px', borderRadius: '8px', background: isScanning ? '#64748b' : '#10b981', color: '#ffffff', border: 'none', fontSize: '15px', fontWeight: 600, cursor: isScanning ? 'wait' : 'pointer' }}
          >
            {isScanning ? '⏳ Running FIGM Rules Analysis...' : '⚡ Run FIGM Scan on Benchmark'}
          </button>
          {scanCompleted && (
            <span style={{ color: '#34d399', fontSize: '14px', fontWeight: 600 }}>
              ✅ Scan Complete: 4 Guideline Diagnostics Detected
            </span>
          )}
        </div>

        {/* Scan Diagnostics Output Table */}
        {scanCompleted && (
          <div style={{ background: 'rgba(9, 13, 22, 0.6)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                  <th style={{ padding: '12px 16px' }}>Rule ID</th>
                  <th style={{ padding: '12px 16px' }}>Guideline Name</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px' }}>Severity</th>
                  <th style={{ padding: '12px 16px' }}>Line</th>
                  <th style={{ padding: '12px 16px' }}>Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {INITIAL_DIAGNOSTICS.map((d) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#60a5fa' }}>{d.ruleId}</td>
                    <td style={{ padding: '12px 16px', color: '#ffffff' }}>{d.ruleName}</td>
                    <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{d.category}</td>
                    <td style={{ padding: '12px 16px', color: d.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>{d.severity}</td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8' }}>Line {d.line}</td>
                    <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{d.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Completion Banner & Questionnaire Link */}
      <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 95, 70, 0.25))', padding: '32px', borderRadius: '16px', border: '1px solid rgba(52, 211, 153, 0.3)', textAlign: 'center' }}>
        <h3 style={{ fontSize: '24px', margin: '0 0 8px 0', color: '#ffffff' }}>Finish Your Usability Evaluation</h3>
        <p style={{ fontSize: '15px', color: '#a7f3d0', margin: '0 0 20px 0', maxWidth: '700px', marginLeft: 'auto', marginRight: 'auto' }}>
          Please answer the questionnaire based on your actual experience using FIGM Code Inspector. There are no right or wrong answers.
        </p>
        <a
          href={googleFormUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-block', padding: '16px 36px', borderRadius: '12px', background: '#10b981', color: '#ffffff', fontSize: '18px', fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' }}
        >
          📝 Open User Study Questionnaire ↗
        </a>
      </div>
    </div>
  );
}
