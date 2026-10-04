'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import SkeletonLoader from './SkeletonLoader';
import { TOTAL_RULE_COUNT } from '../../../src/matrix/rule-registry';

interface SummaryData {
  totalProjects: number;
  totalScans: number;
  totalReports: number;
  totalRulesTriggered: number;
  totalAiSuggestions: number;
  avgQualityScore: number | null;
  avgScanDurationMs: number;
  avgMemoryUsageMb: number;
  totalActiveUsers: number;
  frameworkDistribution: {
    react: number;
    nextjs: number;
    angular: number;
    vue: number;
    generic: number;
  };
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  user?: string;
  badgeColor: string;
}

interface ReportItem {
  id: string;
  fileName: string;
  framework: string;
  qualityScore: number;
  defectsCount: number;
  criticalCount: number;
  highCount: number;
  scanTimeMs: number;
  createdAt: string;
}

export default function LiveDashboardContent() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [userRole, setUserRole] = useState<string>('DEVELOPER');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // Move focus to the error message when it appears, same pattern the auth pages already use --
  // a screen-reader user landing on this page's error state needs to land on the reason, not stay
  // silently on whatever had focus before the fetch failed. role="alert" below already announces
  // it; this additionally makes it reachable for anyone tabbing/reviewing.
  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get user profile role if stored
      const storedUser = localStorage.getItem('figm_user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed.role) setUserRole(parsed.role);
        } catch {
          // Fallback
        }
      }

      const token = localStorage.getItem('figm_token');
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const [sumRes, actRes, repRes] = await Promise.all([
        fetch('/api/dashboard/summary', { headers }),
        fetch('/api/dashboard/activity', { headers }),
        fetch('/api/dashboard/reports', { headers }),
      ]);

      if (!sumRes.ok) throw new Error('Failed to fetch dashboard summary metrics');

      const sumData = await sumRes.ok ? await sumRes.json() : null;
      const actData = await actRes.ok ? await actRes.json() : { activity: [] };
      const repData = await repRes.ok ? await repRes.json() : { reports: [] };

      setSummary(sumData);
      setActivity(actData.activity || []);
      setReports(repData.reports || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading dashboard data';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  // `avgQualityScore` is `null` (not 0) when this user has no persisted scans yet -- a real 0%
  // average is a distinct, legitimate value from "no data exists to average." `hasQualityScore`
  // gates the gauge between the real-score ring and an honest "No scans yet" empty state; the
  // `?? 0` below only feeds the SVG arc math (which needs a number either way) and is never shown
  // as a percentage on its own -- the displayed `{healthScore}%` text is only rendered when
  // `hasQualityScore` is true, right below.
  const hasQualityScore = summary?.avgQualityScore !== null && summary?.avgQualityScore !== undefined;
  const healthScore = summary?.avgQualityScore ?? 0;
  const strokeDashoffset = circumference - (healthScore / 100) * circumference;

  if (loading) {
    return (
      <div role="status" aria-live="polite" aria-label="Loading dashboard data" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <span className="sr-only">Loading dashboard data…</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
          <SkeletonLoader height="90px" />
          <SkeletonLoader height="90px" />
          <SkeletonLoader height="90px" />
          <SkeletonLoader height="90px" />
          <SkeletonLoader height="90px" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px' }}>
          <SkeletonLoader height="280px" />
          <SkeletonLoader height="280px" width="100%" />
          <SkeletonLoader height="280px" />
        </div>
        <SkeletonLoader height="320px" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        ref={errorRef}
        role="alert"
        tabIndex={-1}
        className="glass-panel"
        style={{
          padding: '48px',
          textAlign: 'center',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '16px',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: '36px' }}>⚠️</span>
        <h2 style={{ color: '#1d4ed8', fontSize: '20px', fontWeight: 800, margin: '12px 0 6px 0' }}>
          Dashboard Loading Error
        </h2>
        <p style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '14px', margin: '0 0 20px 0' }}>
          {error}
        </p>
        <button
          onClick={handleRefresh}
          className="btn-glow"
          style={{ cursor: 'pointer', padding: '10px 24px', fontSize: '14px', fontWeight: 700 }}
        >
          🔄 Retry Data Fetch
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top Action Bar with Live Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
            PERSISTENT LIVE ANALYTICS ({userRole} ROLE)
          </div>
          <h1 className="gradient-text-blue" style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.8px', margin: 0, lineHeight: 1.1 }}>
            Code Inspector Dashboard
          </h1>
          <p style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '14px', marginTop: '4px', margin: 0 }}>
            Powered by real backend persistence and 4-Layer Meta-Model AST diagnostics.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={handleRefresh}
            className="btn-glass"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <span>{refreshing ? '⏳' : '🔄'}</span>
            <span>{refreshing ? 'Refreshing...' : 'Live Refresh'}</span>
          </button>

          <Link href="/live-scan" className="btn-glow">
            <span>▶</span>
            <span>Run New Scan</span>
          </Link>
        </div>
      </div>

      {/* Top 4 Metrics Cards Grid -- every value here is scoped to the authenticated user's own
          projects/scans/findings (see /api/dashboard/summary), never a platform-wide total. A
          5th "Active Developers" card previously sat here showing a global user count on every
          developer's personal workspace; removed rather than relabeled, since a per-user scope
          has no honest equivalent of "active developers" to show (platform-wide activity belongs
          on the Admin dashboard only). */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '16px' }}>
        {/* Card 1: My Projects */}
        <div className="glass-panel" style={{ padding: '20px 20px 0 20px', overflow: 'hidden', borderTop: '2px solid #60a5fa' }}>
          <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>My Projects</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: 900, color: 'rgba(0, 0, 0, 0.82)', letterSpacing: '-0.5px' }}>{summary?.totalProjects ?? 0}</span>
            {/* Previously a static "Active" status badge implying project activity with no real
                activity-tracking data behind it — removed for the same reason as the trend
                badges above. */}
          </div>
          <div style={{ marginTop: '14px', marginLeft: '-20px', marginRight: '-20px', height: '32px', background: 'linear-gradient(180deg, rgba(96, 165, 250, 0.1) 0%, rgba(96, 165, 250, 0.35) 100%)', borderTop: '1px solid #60a5fa' }} />
        </div>

        {/* Card 2: My Scans */}
        <div className="glass-panel" style={{ padding: '20px 20px 0 20px', overflow: 'hidden', borderTop: '2px solid #3b82f6' }}>
          <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>My Scans</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: 900, color: 'rgba(0, 0, 0, 0.82)', letterSpacing: '-0.5px' }}>{summary?.totalScans ?? 0}</span>
            {/* Previously a static "+100%" trend badge with no real historical data behind it —
                this codebase has no time-series scan history to compute a real trend from, so per
                the "remove the trend claim rather than fabricate it" rule, it's simply removed
                rather than replaced with a different unverifiable number. */}
          </div>
          <div style={{ marginTop: '14px', marginLeft: '-20px', marginRight: '-20px', height: '32px', background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.35) 100%)', borderTop: '1px solid #3b82f6' }} />
        </div>

        {/* Card 3: My Findings */}
        <div className="glass-panel" style={{ padding: '20px 20px 0 20px', overflow: 'hidden', borderTop: '2px solid #3b82f6' }}>
          <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>My Findings</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: 900, color: 'rgba(0, 0, 0, 0.82)', letterSpacing: '-0.5px' }}>{summary?.totalRulesTriggered ?? 0}</span>
            <span className="badge-trend-green">{TOTAL_RULE_COUNT} Rules</span>
          </div>
          <div style={{ marginTop: '14px', marginLeft: '-20px', marginRight: '-20px', height: '32px', background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.25) 100%)', borderTop: '1px solid #3b82f6' }} />
        </div>

        {/* Card 4: My AI Fix Suggestions */}
        <div className="glass-panel" style={{ padding: '20px 20px 0 20px', overflow: 'hidden', borderTop: '2px solid #60a5fa' }}>
          <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>My AI Fix Suggestions</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px' }}>
            <span style={{ fontSize: '32px', fontWeight: 900, color: 'rgba(0, 0, 0, 0.82)', letterSpacing: '-0.5px' }}>{summary?.totalAiSuggestions ?? 0}</span>
            {/* Previously a static "100% Valid" badge — no per-suggestion validity tracking
                exists in the data model to compute a real validity rate from, so the claim is
                removed rather than presented as if it were measured. */}
          </div>
          <div style={{ marginTop: '14px', marginLeft: '-20px', marginRight: '-20px', height: '32px', background: 'linear-gradient(180deg, rgba(96, 165, 250, 0.1) 0%, rgba(96, 165, 250, 0.35) 100%)', borderTop: '1px solid #60a5fa' }} />
        </div>
      </div>

      {/* Dashboard Middle Grid (Gauge, Framework Distribution, Activity Feed) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '20px' }}>
        {/* Composite Health Gauge */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.82)', marginBottom: '2px' }}>
              My Quality Score
            </h2>
            <p style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.7)', margin: 0 }}>
              Average across your own persisted scans
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '20px 0', position: 'relative' }}>
            <svg width="160" height="160" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(0, 0, 0, 0.12)" strokeWidth="12" />
              {hasQualityScore && (
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke="url(#blue-gradient-dash)"
                  strokeWidth="12"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  transform="rotate(-90 80 80)"
                />
              )}
              <defs>
                <linearGradient id="blue-gradient-dash" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1d4ed8" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
              </defs>
            </svg>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              {hasQualityScore ? (
                <>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: 'rgba(0, 0, 0, 0.82)', lineHeight: 1 }}>{healthScore}%</div>
                  <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 700, marginTop: '4px' }}>VERIFIED</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.7)', lineHeight: 1.3 }}>No scans yet</div>
                  <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', fontWeight: 700, marginTop: '4px' }}>RUN A SCAN TO SEE YOUR SCORE</div>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid rgba(0, 0, 0, 0.08)', paddingTop: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)' }}>Avg Latency</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#1d4ed8' }}>{summary?.avgScanDurationMs ?? 0} ms</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)' }}>Peak Memory</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#1d4ed8' }}>{summary?.avgMemoryUsageMb ?? 0} MB</div>
            </div>
          </div>
        </div>

        {/* Framework Distribution Cards -- from summary.frameworkDistribution, already scoped to
            this user's own scans by /api/dashboard/summary */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.82)', marginBottom: '4px' }}>
            My Framework Distribution
          </h2>
          <p style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.7)', margin: '0 0 18px 0' }}>
            Your own scanned files, by framework
          </p>

          {(() => {
            // Real counts only, honest zero when no data -- no artificial "|| 10" fallback that
            // renders a plausible-looking number indistinguishable from a real one, and no
            // hardcoded 40% bar width regardless of actual value (both previously present here;
            // see research/audits/FIGM_PRE_DATA_COLLECTION_AUDIT.md's dashboard-fallback-masking
            // finding). Bar width is now the real proportion of this framework within the three
            // shown, so an all-zero state renders three empty bars, not three identical fake ones.
            const reactCount = summary?.frameworkDistribution?.react ?? 0;
            const nextjsCount = summary?.frameworkDistribution?.nextjs ?? 0;
            const angularCount = summary?.frameworkDistribution?.angular ?? 0;
            const total = Math.max(reactCount + nextjsCount + angularCount, 1);
            const widthPct = (count: number) => `${Math.round((count / total) * 100)}%`;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'rgba(0, 0, 0, 0.82)', fontWeight: 600, marginBottom: '6px' }}>
                    <span>⚛️ React JSX / TSX</span>
                    <span style={{ color: '#1d4ed8' }}>{reactCount} Analyses</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: widthPct(reactCount), height: '100%', background: 'linear-gradient(90deg, #60a5fa, #60a5fa)', borderRadius: '4px' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'rgba(0, 0, 0, 0.82)', fontWeight: 600, marginBottom: '6px' }}>
                    <span>▲ Next.js App Router</span>
                    <span style={{ color: '#1d4ed8' }}>{nextjsCount} Analyses</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: widthPct(nextjsCount), height: '100%', background: 'linear-gradient(90deg, #60a5fa, #60a5fa)', borderRadius: '4px' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'rgba(0, 0, 0, 0.82)', fontWeight: 600, marginBottom: '6px' }}>
                    <span>🅰️ Angular Templates</span>
                    <span style={{ color: '#1d4ed8' }}>{angularCount} Analyses</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: widthPct(angularCount), height: '100%', background: 'linear-gradient(90deg, #ef4444, #ef4444)', borderRadius: '4px' }} />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Activity Timeline Feed -- scoped to this user's own account/scan events only, see
            /api/dashboard/activity */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.82)', marginBottom: '4px' }}>
            My Recent Activity
          </h2>
          <p style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.7)', margin: '0 0 16px 0' }}>
            Your own scans & account events
          </p>

          {activity.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'rgba(0, 0, 0, 0.7)' }}>
              <span style={{ fontSize: '22px' }}>🕓</span>
              <p style={{ marginTop: '6px', fontSize: '12px' }}>No recent activity yet.</p>
              <Link href="/live-scan" className="btn-glow" style={{ display: 'inline-flex', marginTop: '14px', fontSize: '12px', padding: '8px 16px' }}>
                Run your first scan
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {activity.slice(0, 4).map((act) => (
                <div key={act.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: act.badgeColor || '#60a5fa',
                      marginTop: '4px',
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', color: 'rgba(0, 0, 0, 0.82)', fontWeight: 700 }}>{act.title}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', marginTop: '2px' }}>{act.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Latest Scans Report Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.82)', margin: 0 }}>
              My Recent Scans
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(0, 0, 0, 0.7)', margin: '4px 0 0 0' }}>
              Your own persisted scan output reports
            </p>
          </div>
          <Link href="/history" style={{ fontSize: '13px', color: '#1d4ed8', fontWeight: 700, textDecoration: 'none' }}>
            View All Reports →
          </Link>
        </div>

        {reports.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(0, 0, 0, 0.7)' }}>
            <span style={{ fontSize: '28px' }}>📂</span>
            <p style={{ marginTop: '8px' }}>No scan reports found. Run a new scan to populate reports.</p>
            <Link href="/live-scan" className="btn-glow" style={{ display: 'inline-flex', marginTop: '16px', fontSize: '13px', padding: '10px 20px' }}>
              Run your first scan
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.1)', color: 'rgba(0, 0, 0, 0.7)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Target File</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Framework</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Quality Score</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Defects</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Scan Time</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((rep) => (
                  <tr key={rep.id} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)', color: 'rgba(0, 0, 0, 0.7)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'rgba(0, 0, 0, 0.82)' }}>{rep.fileName}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', background: 'rgba(96, 165, 250, 0.1)', padding: '3px 8px', borderRadius: '4px' }}>
                        {rep.framework}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: rep.qualityScore >= 80 ? '#3b82f6' : '#ef4444' }}>
                      {rep.qualityScore}%
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ color: rep.defectsCount > 0 ? '#ef4444' : '#3b82f6', fontWeight: 700 }}>
                        {rep.defectsCount} defects
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'rgba(0, 0, 0, 0.7)' }}>{rep.scanTimeMs} ms</td>
                    <td style={{ padding: '12px 16px', color: 'rgba(0, 0, 0, 0.7)', fontSize: '12px' }}>
                      {new Date(rep.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
