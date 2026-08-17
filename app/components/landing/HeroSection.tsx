'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useResearchMetrics } from '../../../src/hooks/useResearchMetrics';

export default function HeroSection() {
  const [activeTab, setActiveTab] = useState<'nonCompliant' | 'compliant'>('nonCompliant');
  const { data } = useResearchMetrics();
  const f1 = data?.benchmarkMetrics?.f1Score;
  const benchmarkStatsLabel = typeof f1 === 'number' ? `Benchmark Stats (F1 = ${(f1 * 100).toFixed(1)}%)` : 'Benchmark Stats';

  const nonCompliantCode = `// ❌ FIGM-REACT-03 & FIGM-PERF-05 Violation
function UserList({ users }) {
  const [userState, setUserState] = useState(users);
  
  // Direct mutation of React state
  const handleUpdate = (id) => {
    userState.find(u => u.id === id).active = true;
    setUserState(userState); // Same object reference!
  };

  return (
    <div>
      {users.map(u => (
        // Inline callback in render loop
        <UserCard key={u.id} onClick={() => handleUpdate(u.id)} />
      ))}
    </div>
  );
}`;

  const compliantCode = `// ✅ FIGM Compliant Implementation
function UserList({ users }) {
  const [userState, setUserState] = useState(users);
  
  // Immutable functional state update
  const handleUpdate = useCallback((id: string) => {
    setUserState(prev => prev.map(u => 
      u.id === id ? { ...u, active: true } : u
    ));
  }, []);

  return (
    <div>
      {userState.map(u => (
        // Stable reference callback
        <UserCard key={u.id} userId={u.id} onSelect={handleUpdate} />
      ))}
    </div>
  );
}`;

  return (
    <section
      style={{
        position: 'relative',
        padding: '60px 0 80px 0',
        overflow: 'hidden',
      }}
    >
      {/* Animated Background Mesh */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '1000px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(168, 85, 247, 0.1) 40%, rgba(3, 7, 18, 0) 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '1000px', margin: '0 auto' }}>
        {/* Research Badge */}
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
            marginBottom: '24px',
            boxShadow: '0 0 20px rgba(56, 189, 248, 0.2)',
          }}
        >
          <span style={{ fontSize: '14px' }}>🎓</span>
          <span>NSBM Green University · IS303.2 Research Methodology — Framework-Independent Guideline Model</span>
        </div>

        {/* Hero Title */}
        <h1
          style={{
            fontSize: '52px',
            fontWeight: 900,
            lineHeight: 1.1,
            letterSpacing: '-1.5px',
            color: '#f8fafc',
            margin: '0 0 20px 0',
          }}
        >
          Automated Code Quality Inspection &{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #38bdf8 0%, #a855f7 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            AI Remediation
          </span>{' '}
          for Modern SPAs
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontSize: '18px',
            color: '#94a3b8',
            maxWidth: '760px',
            margin: '0 auto 36px auto',
            lineHeight: 1.6,
          }}
        >
          Unifying performance, accessibility, and architectural quality assurance across{' '}
          <strong style={{ color: '#f1f5f9' }}>React</strong>,{' '}
          <strong style={{ color: '#f1f5f9' }}>Next.js App Router</strong>,{' '}
          <strong style={{ color: '#f1f5f9' }}>Angular</strong>, and{' '}
          <strong style={{ color: '#f1f5f9' }}>Vue 3 SFCs</strong> via 4-Layer Meta-Model primitives and Gemini 2.5 Flash.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '60px' }}>
          <Link
            href="/live-scan"
            style={{
              padding: '14px 28px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
              color: '#0f172a',
              fontSize: '15px',
              fontWeight: 800,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 8px 24px rgba(56, 189, 248, 0.35)',
              transition: 'transform 0.2s ease',
            }}
          >
            <span>▶</span>
            <span>Launch Live Inspector</span>
          </Link>

          <Link
            href="/guidelines"
            style={{
              padding: '14px 28px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#f8fafc',
              fontSize: '15px',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <span>🔍</span>
            <span>Explore {data?.systemCapabilities?.totalGuidelineRules ?? 25} Rules</span>
          </Link>

          <Link
            href="/analytics"
            style={{
              padding: '14px 28px',
              borderRadius: '12px',
              background: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              color: '#c084fc',
              fontSize: '15px',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>📊</span>
            <span>{benchmarkStatsLabel}</span>
          </Link>
        </div>

        {/* Code Diff Preview Widget */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'left',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            maxWidth: '820px',
            margin: '0 auto',
          }}
        >
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span style={{ marginLeft: '12px', color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>figm-inspector // UserList.tsx</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setActiveTab('nonCompliant')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === 'nonCompliant' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                  color: activeTab === 'nonCompliant' ? '#fca5a5' : '#7c8ba6',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🔴 Anti-Pattern (Sample A)
              </button>
              <button
                onClick={() => setActiveTab('compliant')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === 'compliant' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                  color: activeTab === 'compliant' ? '#6ee7b7' : '#7c8ba6',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🟢 Gemini AI Patch (Sample B)
              </button>
            </div>
          </div>

          {/* Code Block */}
          <pre
            style={{
              fontFamily: "'Fira Code', 'Cascadia Code', monospace",
              fontSize: '13px',
              color: activeTab === 'nonCompliant' ? '#fca5a5' : '#86efac',
              margin: 0,
              lineHeight: 1.6,
              overflowX: 'auto',
            }}
          >
            <code>{activeTab === 'nonCompliant' ? nonCompliantCode : compliantCode}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
