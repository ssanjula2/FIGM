'use client';

import React from 'react';
import Link from 'next/link';
import { getDomainCounts } from '../../../src/matrix/domain-counts';

// Stage 7C visual-polish pass (Section 9): a small, tasteful credibility section -- not a
// dissertation chapter. The full DSRM methodology and controlled-benchmark discussion moved to
// /methodology (ResearchOverview + BenchmarkSection, unmodified); the academic reference list
// stays at /references. Only real, verifiable facts appear here -- no bibliography, and
// deliberately no controlled-benchmark statistics presented as marketing (those belong on
// /methodology, clearly qualified as controlled/self-authored, not real-world).
export default function ResearchCredibility() {
  const counts = getDomainCounts();
  const totalRules = counts.ARCHITECTURE + counts.STATIC_PERFORMANCE + counts.ACCESSIBILITY;

  const facts = [
    `${totalRules} canonical rules`,
    // 21 open-source repositories -- real corpus size from benchmarks/real-world/README.md's
    // current tl;dr result. This is a corpus-size fact only; that corpus has no exhaustive
    // ground truth, so no correctness figure derived from it belongs here.
    '21 open-source repositories evaluated',
    'reproducible experiment protocols',
    'WCAG 2.2-aligned static accessibility checks',
  ];

  return (
    <section id="methodology" style={{ padding: '56px 0', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
        <h2 style={{ fontSize: '11px', color: '#7c8ba6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 10px 0' }}>
          Research-backed evaluation
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px 0', display: 'flex', flexWrap: 'wrap', gap: '10px 28px' }}>
          {facts.map((f) => (
            <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '13px' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#38bdf8', flexShrink: 0 }} aria-hidden="true" />
              {f}
            </li>
          ))}
        </ul>
        <Link href="/methodology" style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', textDecoration: 'none' }}>
          View methodology →
        </Link>
      </div>
    </section>
  );
}
