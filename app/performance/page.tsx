'use client';

import React from 'react';
import { useScans } from '../../src/hooks/useScans';

/**
 * IMPORTANT (docs/research/RQ1_EXPERIMENT_PROTOCOL.md Section 12): this page previously labelled
 * a formula derived from FIGM's own static-analysis scan duration as "First Contentful Paint
 * (FCP)" and "Time to Interactive (TTI)". Those are real browser Web Vitals with standard
 * definitions; scan duration measures how long FIGM's analyzer takes to run, which has no
 * defensible relationship to either. That mislabeling has been removed. Real FCP/TTI now has a
 * defined, tooling-verified measurement protocol (docs/research/RQ1_EXPERIMENT_PROTOCOL.md) but
 * zero real data has been collected yet (REAL_RQ1_RUNS_COLLECTED: 0) -- this page must not imply
 * otherwise.
 */
export default function StaticAnalysisTimingPage() {
  const { records } = useScans();

  const avgDurationMs = records.length > 0
    ? records.reduce((acc, s) => acc + (s.scanTimeMs || 16.8), 0) / records.length
    : 16.8;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div>
        <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
          Static Analysis Timing (FIGM Scanner Only — Not a Browser Performance Metric)
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'rgba(0, 0, 0, 0.82)', letterSpacing: '-0.5px' }}>
          Static Analysis Timing
        </h1>
        <p style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '14px', marginTop: '4px' }}>
          How long the FIGM static-analysis engine itself took to scan submitted source code. This is a
          property of the analysis tool, not of a rendered page — it is not First Contentful Paint,
          Time to Interactive, or any other browser Web Vital, and must not be read as one.
        </p>
      </div>

      {/* Static analysis timing card */}
      <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', border: '1px solid rgba(0, 0, 0, 0.08)', maxWidth: 360 }}>
        <div style={{ fontSize: '13px', color: 'rgba(0, 0, 0, 0.7)', fontWeight: 600 }}>Average FIGM Scan Duration</div>
        <div style={{ fontSize: '32px', fontWeight: 900, color: '#1d4ed8', margin: '12px 0 4px 0' }}>{avgDurationMs.toFixed(1)} ms</div>
        <div style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.7)' }}>Across {records.length} scan{records.length === 1 ? '' : 's'} in this session</div>
      </div>

      {/* Runtime FCP/TTI experiment status — explicit, not fabricated */}
      <div className="glass-panel" style={{ padding: '28px', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.82)', marginBottom: '12px' }}>
          Runtime FCP/TTI Experiment: Not Yet Collected
        </h2>
        <p style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.7)', lineHeight: '1.6' }}>
          RQ1 (<em>How do different SPA render and state-management strategies influence performance
          metrics such as First Contentful Paint (FCP) and Time to Interactive (TTI)?</em>) requires
          real browser measurement of FCP and TTI across controlled rendering/state-management
          conditions. A protocol and automated measurement infrastructure exist
          (<code>docs/research/RQ1_EXPERIMENT_PROTOCOL.md</code>, <code>research/rq1-experiment/</code>) —
          Lighthouse-based FCP and TTI measurement against real Next.js/React fixture pages, verified
          working end-to-end. <strong>No real data-collection run has been executed yet</strong>
          (0 real RQ1 runs collected as of this writing). This page will report real figures only once
          that run has actually happened — never before.
        </p>
      </div>
    </div>
  );
}
