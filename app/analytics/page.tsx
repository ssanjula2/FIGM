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
  rq4: {
    available: boolean;
    sampleCount: number | null;
    raterCount: number | null;
    precision: number | null;
    recall: number | null;
    f1Score: number | null;
    cohensKappa: number | null;
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
          <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
            INSIGHT ENGINE & EVALUATION VAULT
          </div>
          <h1 className="gradient-text-blue" style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.8px', margin: 0, lineHeight: 1.1 }}>
            Performance & Research Benchmark Analytics
          </h1>
          <p style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '14px', marginTop: '4px', margin: 0 }}>
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
        <div className="glass-panel" style={{ padding: '14px 18px', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#1d4ed8', fontSize: '13px' }}>
          ⚠ {data._meta.benchmarkError}
        </div>
      )}

      {/* Top Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: '14px' }}>
        <div className="glass-panel" style={{ padding: '20px 16px', borderTop: '2px solid #60a5fa', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', fontWeight: 700, textTransform: 'uppercase' }}>Internal fixture benchmark F1</div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#1d4ed8', marginTop: '6px', fontFamily: 'JetBrains Mono' }}>{loading ? '…' : pct(bm?.f1Score)}</div>
          <div style={{ fontSize: '10px', color: '#1d4ed8', marginTop: '4px', fontWeight: 600 }}>Harmonic Mean</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px 16px', borderTop: '2px solid #3b82f6', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', fontWeight: 700, textTransform: 'uppercase' }}>Internal fixture benchmark Precision</div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#1d4ed8', marginTop: '6px', fontFamily: 'JetBrains Mono' }}>{loading ? '…' : pct(bm?.precision)}</div>
          <div style={{ fontSize: '10px', color: 'rgba(0, 0, 0, 0.7)', marginTop: '4px' }}>TP / (TP + FP)</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px 16px', borderTop: '2px solid #3b82f6', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', fontWeight: 700, textTransform: 'uppercase' }}>Internal fixture benchmark Recall</div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#1d4ed8', marginTop: '6px', fontFamily: 'JetBrains Mono' }}>{loading ? '…' : pct(bm?.recall)}</div>
          <div style={{ fontSize: '10px', color: 'rgba(0, 0, 0, 0.7)', marginTop: '4px' }}>TP / (TP + FN)</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px 16px', borderTop: '2px solid rgba(0, 0, 0, 0.18)', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', fontWeight: 700, textTransform: 'uppercase' }}>SUS Usability</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: 'rgba(0, 0, 0, 0.82)', marginTop: '6px', fontFamily: 'JetBrains Mono' }}>No accepted responses</div>
          <div style={{ fontSize: '10px', color: '#1d4ed8', marginTop: '4px', fontWeight: 600 }}>
            0 accepted SUS response records in this system (target {data?.userStudy.targetParticipants ?? HUMAN_STUDY_TARGET_PARTICIPANTS})
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px 16px', borderTop: '2px solid #3b82f6', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', fontWeight: 700, textTransform: 'uppercase' }}>Cronbach α</div>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#1d4ed8', marginTop: '6px', fontFamily: 'JetBrains Mono' }}>Not calculated</div>
          <div style={{ fontSize: '10px', color: 'rgba(0, 0, 0, 0.7)', marginTop: '4px' }}>Not calculated; no accepted item-level responses available here</div>
        </div>
      </div>

      {data?.rq4?.available && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.82)', margin: 0 }}>RQ4 Independent Expert Evaluation</h2>
          <p style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '12px', margin: '6px 0 16px 0' }}>
            Separate controlled {data.rq4.sampleCount}-sample blinded dataset with {data.rq4.raterCount} independent experts; these figures do not describe the internal fixture benchmark.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: '14px' }}>
            {([
              ['Precision', data.rq4.precision],
              ['Recall', data.rq4.recall],
              ['F1 Score', data.rq4.f1Score],
              ["Cohen's kappa", data.rq4.cohensKappa],
            ] as const).map(([label, value]) => (
              <div key={label} style={{ padding: '14px', background: 'rgba(96, 165, 250, 0.08)', border: '1px solid rgba(96, 165, 250, 0.2)', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ color: '#1d4ed8', fontSize: '24px', fontWeight: 900 }}>{typeof value === 'number' ? (label === "Cohen's kappa" ? value.toFixed(2) : `${(value * 100).toFixed(1)}%`) : '—'}</div>
                <div style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '11px', fontWeight: 700 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confusion counts + rule metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.82)', margin: 0 }}>
              Dynamic Evaluation Counts
            </h2>
            <span className="badge badge-domain" style={{ fontSize: '11px' }}>
              {bm ? `TP+FP+FN = ${(bm.truePositives ?? 0) + (bm.falsePositives ?? 0) + (bm.falseNegatives ?? 0)}` : '—'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 700 }}>True Positives (TP)</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#1d4ed8', marginTop: '4px', fontFamily: 'JetBrains Mono' }}>{bm?.truePositives ?? '—'}</div>
              <div style={{ fontSize: '10px', color: 'rgba(0, 0, 0, 0.7)', marginTop: '2px' }}>Correctly Detected Defect</div>
            </div>

            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 700 }}>False Positives (FP)</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#1d4ed8', marginTop: '4px', fontFamily: 'JetBrains Mono' }}>{bm?.falsePositives ?? '—'}</div>
              <div style={{ fontSize: '10px', color: 'rgba(0, 0, 0, 0.7)', marginTop: '2px' }}>False Alarms</div>
            </div>

            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 700 }}>False Negatives (FN)</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#1d4ed8', marginTop: '4px', fontFamily: 'JetBrains Mono' }}>{bm?.falseNegatives ?? '—'}</div>
              <div style={{ fontSize: '10px', color: 'rgba(0, 0, 0, 0.7)', marginTop: '2px' }}>Missed Defects</div>
            </div>

            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 700 }}>Ground-Truth Items</div>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#1d4ed8', marginTop: '4px', fontFamily: 'JetBrains Mono' }}>
                {bm ? (bm.truePositives ?? 0) + (bm.falseNegatives ?? 0) : '—'}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(0, 0, 0, 0.7)', marginTop: '2px' }}>Labeled Violations (benchmarks/ground-truth.json)</div>
            </div>
          </div>

          <div style={{ padding: '12px 16px', background: 'rgba(255, 255, 255, 0.5)', borderRadius: '8px', fontSize: '12px', color: 'rgba(0, 0, 0, 0.7)', lineHeight: 1.5 }}>
            💡 True Negatives are not computed by the dynamic evaluator (no baseline &quot;clean&quot; universe is dynamically counted), so an
            overall accuracy figure is intentionally not shown here — only the directly computed Precision/Recall/F1 above are reported.
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.82)', margin: 0 }}>
              Per-Rule Detection Metrics
            </h2>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', background: 'rgba(96, 165, 250, 0.15)', padding: '2px 8px', borderRadius: '6px' }}>
              {bm?.ruleCoverage
                ? `${bm.ruleCoverage.rulesWithGroundTruth} / ${bm.ruleCoverage.totalFigmRules} Rules Empirically Measured`
                : data
                  ? `${data.systemCapabilities.totalGuidelineRules} Rules Defined`
                  : '—'}
            </span>
          </div>

          {bm?.ruleCoverage && bm.ruleCoverage.uncoveredRuleIds.length > 0 && (
            <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', fontSize: '12px', color: '#1d4ed8', lineHeight: 1.5 }}>
              ⚠ This table only covers the {bm.ruleCoverage.rulesWithGroundTruth} rules with hand-labelled ground truth in <code>benchmarks/ground-truth.json</code>. The other {bm.ruleCoverage.uncoveredRuleIds.length} rules ({bm.ruleCoverage.uncoveredRuleIds.join(', ')}) are verified only by unit-level positive/negative fixture tests, not by this empirical benchmark.
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            {ruleMetrics.length === 0 ? (
              <div style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '13px', padding: '12px 0' }}>
                {loading ? 'Loading…' : 'No per-rule metrics available from the last evaluation run.'}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'rgba(0, 0, 0, 0.7)' }}>
                    <th style={{ padding: '8px' }}>Rule ID</th>
                    <th style={{ padding: '8px' }}>TP</th>
                    <th style={{ padding: '8px' }}>FP</th>
                    <th style={{ padding: '8px' }}>FN</th>
                  </tr>
                </thead>
                <tbody style={{ color: 'rgba(0, 0, 0, 0.82)' }}>
                  {ruleMetrics.map((r: any, i: number) => (
                    <tr key={r.ruleId || i} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: 600, fontFamily: 'JetBrains Mono' }}>{r.ruleId}</td>
                      <td style={{ padding: '10px 8px', color: '#1d4ed8' }}>{r.truePositives ?? r.tp ?? 0}</td>
                      <td style={{ padding: '10px 8px', color: '#1d4ed8' }}>{r.falsePositives ?? r.fp ?? 0}</td>
                      <td style={{ padding: '10px 8px', color: '#1d4ed8' }}>{r.falseNegatives ?? r.fn ?? 0}</td>
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
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.82)', margin: 0 }}>
              Evaluation Dataset
            </h2>
            <p style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '13px', margin: '4px 0 0 0', maxWidth: '640px' }}>
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
                  background: filterFramework === fw ? '#60a5fa' : 'rgba(255, 255, 255, 0.8)',
                  color: filterFramework === fw ? '#000000' : 'rgba(0, 0, 0, 0.7)',
                }}
              >
                {fw}
              </button>
            ))}
          </div>
        </div>

        {data && (
          <div style={{ padding: '12px 16px', background: 'rgba(255, 255, 255, 0.5)', borderRadius: '8px', fontSize: '12px', color: 'rgba(0, 0, 0, 0.7)', lineHeight: 1.6 }}>
            <strong>{data.systemCapabilities.evaluationDataset.description}</strong> — {data.systemCapabilities.evaluationDataset.scope}.
            Ground truth method: {data.systemCapabilities.evaluationDataset.groundTruthMethod}.
          </div>
        )}
      </div>
    </div>
  );
}
