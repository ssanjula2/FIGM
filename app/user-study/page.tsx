'use client';

import React, { useState, useEffect } from 'react';

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
  nextjs: {
    name: 'Next.js App Router Fixture (DashboardPage.tsx)',
    framework: 'Next.js App Router',
    file: 'DashboardPage.tsx',
    code: `import React, { useState } from 'react';

// FIGM-NEXT-01: React state hook used in Next.js Server Component without "use client"
export default function DashboardPage() {
  const [data, setData] = useState({ title: 'Analytics Dashboard' });

  // FIGM-PERF-04: Static import in deferred execution path
  return (
    <div className="dashboard-page">
      <h2>{data.title}</h2>
      <button onClick={() => setData({ title: 'Updated Analytics' })}>Refresh Data</button>
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

export default function UserStudyPage() {
  const [selectedFramework, setSelectedFramework] = useState<'react' | 'nextjs' | 'angular' | 'vue'>('react');
  const [isScanning, setIsScanning] = useState(false);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [activeTask, setActiveTask] = useState<number | null>(1);
  const [participantId, setParticipantId] = useState<string>('P001');

  const googleFormUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSf7XA39VT1Gx5inZstWj7sXkquAb04aK70BWz8uYWWtjMZDOw/viewform';

  useEffect(() => {
    // Check if browser has persistent study participant session ID
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('figm_study_participant_id');
      if (stored) {
        setParticipantId(stored);
      } else {
        // Fetch next sequential participant ID from server
        fetch('/api/user-study/log-scan')
          .then(res => res.json())
          .then(data => {
            if (data.nextParticipantId) {
              setParticipantId(data.nextParticipantId);
              localStorage.setItem('figm_study_participant_id', data.nextParticipantId);
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  const handleStartNewParticipantSession = () => {
    fetch('/api/user-study/log-scan')
      .then(res => res.json())
      .then(data => {
        const nextId = data.nextParticipantId || 'P001';
        setParticipantId(nextId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('figm_study_participant_id', nextId);
        }
        setScanCompleted(false);
      })
      .catch(() => {
        // Fallback increment
        const currentNum = parseInt(participantId.replace('P', ''), 10) || 1;
        const nextId = `P${String(currentNum + 1).padStart(3, '0')}`;
        setParticipantId(nextId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('figm_study_participant_id', nextId);
        }
        setScanCompleted(false);
      });
  };

  const [dynamicScanResult, setDynamicScanResult] = useState<any>(null);

  const handleRunScan = async () => {
    setIsScanning(true);
    setDynamicScanResult(null);
    try {
      const benchmark = BENCHMARKS[selectedFramework];
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: benchmark.code, fileName: benchmark.file }),
      });
      if (res.ok) {
        const data = await res.json();
        setDynamicScanResult(data);
      }

      // Send the real source (`code`) rather than a client-computed score/count -- the research
      // log-scan endpoint independently re-runs the real analysis engine on it server-side
      // (src/engine/rule-execution-engine.ts) and persists THAT result. Previously this sent a
      // hardcoded qualityScore/diagnosticsCount (88 / 4) for every participant regardless of
      // framework or actual findings, which meant the benchmark-task portion of the study's
      // "research data" was fabricated rather than measured.
      fetch('/api/user-study/log-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId,
          framework: benchmark.framework,
          fileName: benchmark.file,
          code: benchmark.code,
        })
      }).catch(() => {});
    } catch (err) {
      console.error('Dynamic scan error:', err);
    } finally {
      setIsScanning(false);
      setScanCompleted(true);
    }
  };

  return (
    <div className="user-study-container" style={{ padding: '32px 24px', maxWidth: '1200px', width: '100%', margin: '0 auto', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', boxSizing: 'border-box' }}>
      {/* Header Banner */}
      <div className="user-study-hero" style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))', padding: '32px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '32px', boxSizing: 'border-box' }}>
        <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '9999px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', fontSize: '13px', fontWeight: 600, marginBottom: '12px', whiteSpace: 'normal', lineHeight: '1.4' }}>
          ACADEMIC RESEARCH USER STUDY — TARGET N=85 PARTICIPANTS (HUMAN COLLECTION PENDING)
        </span>
        <h1 style={{ fontSize: '32px', fontWeight: 700, margin: '0 0 8px 0', color: '#ffffff', lineHeight: '1.2' }}>
          FIGM Code Inspector — User Study
        </h1>
        <h2 style={{ fontSize: '18px', color: '#94a3b8', fontWeight: 400, margin: '0 0 16px 0', lineHeight: '1.4' }}>
          Usability Evaluation of the Framework-Independent Guideline Model for Single Page Applications
        </h2>
        <div style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6' }}>
          <p style={{ margin: '0 0 8px 0' }}><strong>Institution:</strong> NSBM Green University | <strong>Module:</strong> IS303.2 Research Methodology | <strong>Candidate:</strong> A P H D S Sanjula (ID: 28256)</p>
          <p style={{ margin: 0 }}><strong>Estimated Duration:</strong> 15–25 minutes | <strong>Eligibility:</strong> 18 years or older | <strong>Privacy:</strong> 100% Anonymous (No PII collected)</p>
        </div>
      </div>

      {/* Main Instructions & Action Buttons */}
      <div className="user-study-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div className="user-study-card" style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', boxSizing: 'border-box' }}>
          <h3 style={{ fontSize: '20px', margin: '0 0 12px 0', color: '#38bdf8' }}>📖 How to Participate</h3>
          <ol style={{ paddingLeft: '20px', margin: 0, lineHeight: '1.8', color: '#cbd5e1', fontSize: '15px' }}>
            <li><strong>Step 1:</strong> Select a benchmark fixture (React, Next.js, Angular, or Vue) below.</li>
            <li><strong>Step 2:</strong> Click <strong>"Run FIGM Scan"</strong> to inspect detected guidelines.</li>
            <li><strong>Step 3:</strong> Review the reported diagnostics, rule IDs, and recommendations.</li>
            <li><strong>Step 4:</strong> Click <strong>"Open Google Form Questionnaire"</strong> to record your feedback.</li>
          </ol>
        </div>

        <div className="user-study-card" style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '16px', boxSizing: 'border-box' }}>
          <button
            className="user-study-cta-btn touch-target"
            onClick={() => {
              const el = document.getElementById('benchmark-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{ padding: '14px 24px', borderRadius: '8px', background: '#2563eb', color: '#ffffff', border: 'none', fontSize: '16px', fontWeight: 600, cursor: 'pointer', minHeight: '44px', width: '100%', boxSizing: 'border-box' }}
          >
            ⚡ Start FIGM User Study Tasks
          </button>
          <a
            className="user-study-cta-btn touch-target"
            href={googleFormUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 24px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.4)', textAlign: 'center', fontSize: '16px', fontWeight: 600, textDecoration: 'none', minHeight: '44px', width: '100%', boxSizing: 'border-box' }}
          >
            📝 Open Google Form Questionnaire ↗
          </a>
        </div>
      </div>

      {/* Task Guide Overview */}
      <div className="user-study-card" style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '32px', boxSizing: 'border-box' }}>
        <h3 style={{ fontSize: '20px', margin: '0 0 16px 0', color: '#f59e0b' }}>🎯 Structured Evaluation Tasks (Questions 9–15)</h3>
        <div className="user-study-grid-tasks" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
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
                cursor: 'pointer',
                minHeight: '44px',
                boxSizing: 'border-box'
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
      <div id="benchmark-section" className="user-study-card" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '32px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <h3 style={{ fontSize: '20px', margin: 0, color: '#ffffff' }}>🧪 Interactive FIGM Benchmark Inspector</h3>
              <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: '1px solid rgba(6, 182, 212, 0.35)', fontWeight: 800, fontFamily: 'monospace' }}>
                👤 Participant ID: {participantId}
              </span>
              <button
                onClick={handleStartNewParticipantSession}
                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8', border: '1px solid rgba(255, 255, 255, 0.1)', cursor: 'pointer', fontWeight: 600 }}
                title="Start session as next participant (e.g. P002, P003...)"
              >
                🔄 New Participant
              </button>
            </div>
            <span style={{ fontSize: '14px', color: '#94a3b8' }}>Select a Single Page Application framework fixture to inspect static diagnostics.</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', maxWidth: '400px' }}>
            {(['react', 'nextjs', 'angular', 'vue'] as const).map((fw) => (
              <button
                key={fw}
                className="touch-target"
                onClick={() => { setSelectedFramework(fw); setScanCompleted(false); }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: selectedFramework === fw ? '#2563eb' : 'rgba(255, 255, 255, 0.05)',
                  color: selectedFramework === fw ? '#ffffff' : '#cbd5e1',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  minHeight: '44px'
                }}
              >
                {fw === 'nextjs' ? 'Next.js' : fw === 'react' ? 'React' : fw === 'angular' ? 'Angular' : 'Vue'}
              </button>
            ))}
          </div>
        </div>

        {/* Source Code Viewer */}
        <div className="code-scroll-container" style={{ background: '#090d16', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '20px', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.5', overflowX: 'auto', boxSizing: 'border-box' }}>
          <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '4px' }}>
            FIXTURE: {BENCHMARKS[selectedFramework].name}
          </div>
          <pre style={{ margin: 0, color: '#e2e8f0', whiteSpace: 'pre', minWidth: 'fit-content' }}>{BENCHMARKS[selectedFramework].code}</pre>
        </div>

        {/* Scan Action */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <button
            className="touch-target user-study-cta-btn"
            onClick={handleRunScan}
            disabled={isScanning}
            style={{ padding: '12px 24px', borderRadius: '8px', background: isScanning ? '#64748b' : '#10b981', color: '#ffffff', border: 'none', fontSize: '15px', fontWeight: 600, cursor: isScanning ? 'wait' : 'pointer', minHeight: '44px' }}
          >
            {isScanning ? '⏳ Running FIGM Rules Analysis...' : '⚡ Run FIGM Scan on Benchmark'}
          </button>
          {scanCompleted && dynamicScanResult && (
            <span style={{ color: '#34d399', fontSize: '14px', fontWeight: 600 }}>
              ✅ Scan Complete: {dynamicScanResult.diagnostics?.length ?? 0} Guideline Diagnostics Detected
            </span>
          )}
          {scanCompleted && !dynamicScanResult && (
            <span style={{ color: '#f87171', fontSize: '14px', fontWeight: 600 }}>
              ⚠️ Scan request failed — no result to report
            </span>
          )}
        </div>

        {/* Calculated Benchmark Metrics & Diagnostics Summary -- rendered from the real,
            live /api/scan response (dynamicScanResult) captured in handleRunScan above, never
            from static placeholder content. If the request failed, nothing is shown rather than
            substituting a fabricated result. */}
        {scanCompleted && dynamicScanResult && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '12px 16px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>QUALITY SCORE</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>{dynamicScanResult.qualityScore ?? '—'} / 100</div>
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>ISSUES DETECTED</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace' }}>{dynamicScanResult.diagnostics?.length ?? 0} Violations</div>
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>SCAN LATENCY</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#34d399', fontFamily: 'monospace' }}>{dynamicScanResult.profile?.executionTimeMs?.toFixed?.(2) ?? '—'} ms</div>
              </div>
              <div style={{ padding: '12px 16px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>FRAMEWORK ENGINE</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#c084fc', marginTop: '2px' }}>{dynamicScanResult.framework ?? selectedFramework.toUpperCase()}</div>
              </div>
            </div>

            <div className="table-scroll-container" style={{ background: 'rgba(9, 13, 22, 0.6)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                  <th style={{ padding: '12px 16px', minWidth: '100px' }}>Rule ID</th>
                  <th style={{ padding: '12px 16px', minWidth: '160px' }}>Guideline Name</th>
                  <th style={{ padding: '12px 16px', minWidth: '110px' }}>Domain</th>
                  <th style={{ padding: '12px 16px', minWidth: '90px' }}>Severity</th>
                  <th style={{ padding: '12px 16px', minWidth: '70px' }}>Line</th>
                  <th style={{ padding: '12px 16px', minWidth: '200px' }}>Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {(dynamicScanResult.diagnostics ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '16px', color: '#94a3b8', textAlign: 'center' }}>
                      No guideline violations detected in this scan.
                    </td>
                  </tr>
                ) : (
                  dynamicScanResult.diagnostics.map((d: any, idx: number) => (
                    <tr key={`${d.ruleId}-${idx}`} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#60a5fa', whiteSpace: 'nowrap' }}>{d.ruleId}</td>
                      <td style={{ padding: '12px 16px', color: '#ffffff' }}>{d.ruleName}</td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{d.domain}</td>
                      <td style={{ padding: '12px 16px', color: d.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b', fontWeight: 600 }}>{d.severity}</td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8', whiteSpace: 'nowrap' }}>Line {d.location?.start?.line ?? d.line ?? '—'}</td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{d.remediation}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>

      {/* Completion Banner & Questionnaire Link */}
      <div className="user-study-hero" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 95, 70, 0.25))', padding: '32px', borderRadius: '16px', border: '1px solid rgba(52, 211, 153, 0.3)', textAlign: 'center', boxSizing: 'border-box' }}>
        <h3 style={{ fontSize: '24px', margin: '0 0 8px 0', color: '#ffffff' }}>Finish Your Usability Evaluation</h3>
        <p style={{ fontSize: '15px', color: '#a7f3d0', margin: '0 0 20px 0', maxWidth: '700px', marginLeft: 'auto', marginRight: 'auto' }}>
          Please answer the questionnaire based on your actual experience using FIGM Code Inspector. There are no right or wrong answers.
        </p>
        <a
          className="user-study-cta-btn touch-target"
          href={googleFormUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '16px 36px', borderRadius: '12px', background: '#10b981', color: '#ffffff', fontSize: '18px', fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)', minHeight: '44px', boxSizing: 'border-box' }}
        >
          📝 Open User Study Questionnaire ↗
        </a>
      </div>
    </div>
  );
}
