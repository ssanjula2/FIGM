'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { HUMAN_STUDY_TARGET_PARTICIPANTS } from '../../src/research/research-config';

interface ResearchMetricsResponse {
  benchmarkMetrics: {
    timestamp?: string;
    precision: number | null;
    recall: number | null;
    f1Score: number | null;
    truePositives: number | null;
    falsePositives: number | null;
    falseNegatives: number | null;
    ruleCoverage: { totalFigmRules: number; rulesWithGroundTruth: number; coveredRuleIds: string[]; uncoveredRuleIds: string[] } | null;
    ruleMetrics: any[];
    frameworkMetrics: any[];
    performanceMetrics: Record<string, unknown>;
  } | null;
  systemCapabilities: {
    totalGuidelineRules: number;
    totalASTPredicates: number;
    supportedFrameworks: string[];
    evaluationDataset: { description: string; scope: string; sizeTarget: string; groundTruthMethod: string };
  };
  userStudy: {
    targetParticipants: number;
    collectedParticipants: number;
    collectionStatus: string;
    note: string;
  };
  _meta: { benchmarkError: string | null };
}

export default function AnalyticsPage() {
  const [filterFramework, setFilterFramework] = useState<string>('ALL');
  const [data, setData] = useState<ResearchMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/research-metrics')
      .then((r) => r.json())
      .then((json) => setData(json))
      .finally(() => setLoading(false));
  }, []);

  const bm = data?.benchmarkMetrics;
  const ruleMetrics: any[] = (bm?.ruleMetrics || []).filter(
    (r) => filterFramework === 'ALL' || (r.framework || '').toUpperCase().includes(filterFramework.toUpperCase())
  );
  const pct = (v: number | null | undefined) => (typeof v === 'number' ? `${(v <= 1 ? v * 100 : v).toFixed(1)}%` : '—');

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
            INSIGHT ENGINE & EVALUATION VAULT
          </div>
          <h1 className="gradient-text-blue" style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.8px', margin: 0, lineHeight: 1.1 }}>
            Performance & Research Benchmark Analytics
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px', margin: 0 }}>
            Live metrics loaded from the dynamic evaluation pipeline (benchmarks/eval-summary.json). No values on this page are hardcoded.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <a
            href="/eval-results/benchmark-results.csv"
            download="benchmark-results.csv"
            className="btn-glass"
            style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>📊</span> Export Benchmark CSV
          </a>
          <Link href="/live-scan" className="btn-glow" style={{ fontSize: '13px' }}>
            <span>▶</span> Run Custom Scan
          </Link>
        </div>
      </div>

      {data?._meta?.benchmarkError && (
        <div className="glass-panel" style={{ padding: '14px 18px', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fcd34d', fontSize: '13px' }}>
          ⚠ {data._meta.benchmarkError}
        </div>
      )}

      {/* Top Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
        <div className="glass-panel" style={{ padding: '20px 16px', borderTop: '2px solid #38bdf8', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>F1-Score</div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#38bdf8', marginTop: '6px', fontFamily: 'JetBrains Mono' }}>{loading ? '…' : pct(bm?.f1Score)}</div>
          <div style={{ fontSize: '10px', color: '#86efac', marginTop: '4px', fontWeight: 600 }}>Harmonic Mean</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px 16px', borderTop: '2px solid #10b981', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Precision</div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#10b981', marginTop: '6px', fontFamily: 'JetBrains Mono' }}>{loading ? '…' : pct(bm?.precision)}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>TP / (TP + FP)</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px 16px', borderTop: '2px solid #f59e0b', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Recall</div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#f59e0b', marginTop: '6px', fontFamily: 'JetBrains Mono' }}>{loading ? '…' : pct(bm?.recall)}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>TP / (TP + FN)</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px 16px', borderTop: '2px solid #ec4899', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>SUS Usability</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#ec4899', marginTop: '6px', fontFamily: 'JetBrains Mono' }}>Pending Data</div>
          <div style={{ fontSize: '10px', color: '#f59e0b', marginTop: '4px', fontWeight: 600 }}>
            {data ? `${data.userStudy.collectedParticipants}/${data.userStudy.targetParticipants} Real Responses` : `0/${HUMAN_STUDY_TARGET_PARTICIPANTS} Real Responses`}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px 16px', borderTop: '2px solid #06b6d4', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Cronbach α</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#06b6d4', marginTop: '6px', fontFamily: 'JetBrains Mono' }}>Pending Data</div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>Target: N={HUMAN_STUDY_TARGET_PARTICIPANTS}</div>
        </div>
      </div>

      {/* Confusion counts + rule metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              Dynamic Evaluation Counts
            </h2>
            <span className="badge badge-domain" style={{ fontSize: '11px' }}>
              {bm ? `TP+FP+FN = ${(bm.truePositives ?? 0) + (bm.falsePositives ?? 0) + (bm.falseNegatives ?? 0)}` : '—'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#6ee7b7', fontWeight: 700 }}>True Positives (TP)</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#10b981', marginTop: '4px', fontFamily: 'JetBrains Mono' }}>{bm?.truePositives ?? '—'}</div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Correctly Detected Defect</div>
            </div>

            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#fca5a5', fontWeight: 700 }}>False Positives (FP)</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#ef4444', marginTop: '4px', fontFamily: 'JetBrains Mono' }}>{bm?.falsePositives ?? '—'}</div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>False Alarms</div>
            </div>

            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#fcd34d', fontWeight: 700 }}>False Negatives (FN)</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#f59e0b', marginTop: '4px', fontFamily: 'JetBrains Mono' }}>{bm?.falseNegatives ?? '—'}</div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Missed Defects</div>
            </div>

            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#7dd3fc', fontWeight: 700 }}>Ground-Truth Items</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#38bdf8', marginTop: '4px', fontFamily: 'JetBrains Mono' }}>
                {bm ? (bm.truePositives ?? 0) + (bm.falseNegatives ?? 0) : '—'}
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Labeled Violations (benchmarks/ground-truth.json)</div>
            </div>
          </div>

          <div style={{ padding: '12px 16px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.5 }}>
            💡 True Negatives are not computed by the dynamic evaluator (no baseline &quot;clean&quot; universe is dynamically counted), so an
            overall accuracy figure is intentionally not shown here — only the directly computed Precision/Recall/F1 above are reported.
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              Per-Rule Detection Metrics
            </h2>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '2px 8px', borderRadius: '6px' }}>
              {bm?.ruleCoverage
                ? `${bm.ruleCoverage.rulesWithGroundTruth} / ${bm.ruleCoverage.totalFigmRules} Rules Empirically Measured`
                : data
                  ? `${data.systemCapabilities.totalGuidelineRules} Rules Defined`
                  : '—'}
            </span>
          </div>

          {bm?.ruleCoverage && bm.ruleCoverage.uncoveredRuleIds.length > 0 && (
            <div style={{ padding: '10px 14px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', fontSize: '12px', color: '#fbbf24', lineHeight: 1.5 }}>
              ⚠ This table only covers the {bm.ruleCoverage.rulesWithGroundTruth} rules with hand-labelled ground truth in <code>benchmarks/ground-truth.json</code>. The other {bm.ruleCoverage.uncoveredRuleIds.length} rules ({bm.ruleCoverage.uncoveredRuleIds.join(', ')}) are verified only by unit-level positive/negative fixture tests, not by this empirical benchmark.
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            {ruleMetrics.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '13px', padding: '12px 0' }}>
                {loading ? 'Loading…' : 'No per-rule metrics available from the last evaluation run.'}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: '#94a3b8' }}>
                    <th style={{ padding: '8px' }}>Rule ID</th>
                    <th style={{ padding: '8px' }}>TP</th>
                    <th style={{ padding: '8px' }}>FP</th>
                    <th style={{ padding: '8px' }}>FN</th>
                  </tr>
                </thead>
                <tbody style={{ color: '#e2e8f0' }}>
                  {ruleMetrics.map((r: any, i: number) => (
                    <tr key={r.ruleId || i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 600, fontFamily: 'JetBrains Mono' }}>{r.ruleId}</td>
                      <td style={{ padding: '10px 8px', color: '#10b981' }}>{r.truePositives ?? r.tp ?? 0}</td>
                      <td style={{ padding: '10px 8px', color: '#ef4444' }}>{r.falsePositives ?? r.fp ?? 0}</td>
                      <td style={{ padding: '10px 8px', color: '#f59e0b' }}>{r.falseNegatives ?? r.fn ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Evaluation dataset description (honest, no per-repo fabricated table) */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              Evaluation Dataset
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0 0', maxWidth: '640px' }}>
              The Precision/Recall/F1 figures above are computed by dynamically re-running the scanner against a hand-authored,
              manually-labeled ground-truth fixture set (<code>benchmarks/ground-truth.json</code> + <code>benchmarks/testbed/*</code>)
              spanning React, Vue, Angular, and Vanilla JS fixtures. No multi-repository or GitHub-scale dataset is scanned —
              a prior fabricated 30-repository dataset (<code>src/eval/repo-evaluator.ts</code>) has been removed.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['ALL', 'React', 'Next.js', 'Angular', 'Vue'].map((fw) => (
              <button
                key={fw}
                onClick={() => setFilterFramework(fw)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filterFramework === fw ? '#38bdf8' : 'rgba(30, 41, 59, 0.8)',
                  color: filterFramework === fw ? '#0f172a' : '#94a3b8',
                }}
              >
                {fw}
              </button>
            ))}
          </div>
        </div>

        {data && (
          <div style={{ padding: '12px 16px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6 }}>
            <strong>{data.systemCapabilities.evaluationDataset.description}</strong> — {data.systemCapabilities.evaluationDataset.scope}.
            Ground truth method: {data.systemCapabilities.evaluationDataset.groundTruthMethod}.
          </div>
        )}
      </div>
    </div>
  );
}
