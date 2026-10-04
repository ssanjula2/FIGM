'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { OnMount } from '@monaco-editor/react';
import { trackScanStarted, trackScanCompleted } from '../../src/lib/analytics';
import { sessionClient } from '../../src/auth/session-client';
import { primaryResearchDomain } from '../../src/matrix/four-layer-meta-model';
import { TOTAL_RULE_COUNT } from '../../src/matrix/rule-registry';
import { formatScanDuration, formatMemoryDelta, formatScanEngineStatus, scanEngineStatusBadge } from '../../src/lib/engine-diagnostics-format';
import { Clock, MemoryStick, FileCode, ListChecks, CheckCircle2, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';

// Same labels as app/diagnostics/page.tsx's RESEARCH_DOMAIN_LABEL -- kept in sync deliberately so
// the two pages never disagree about how a domain is presented to a user.
const RESEARCH_DOMAIN_CHIP: Record<string, string> = {
  ARCHITECTURE: '🏗️ Architecture',
  STATIC_PERFORMANCE: '⚡ Static Performance',
  ACCESSIBILITY: '♿ Accessibility',
};

// Monaco is a heavy browser-only editor bundle (FIGM's own FIGM-NEXT-02 rule: "Heavy browser
// module imported statically in Next.js instead of next/dynamic with ssr: false"). Code-split it
// into its own chunk, loaded only when this page actually renders the editor, rather than bundled
// into this page's main chunk. `useMonaco()` is deliberately NOT imported here (that would defeat
// the point -- it's a named export of the same module, so importing it statically re-introduces
// the exact static-import problem this fixes); the monaco instance is instead captured from
// `onMount`'s second argument below and stored in a ref.
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

// ── Sample presets (only for the "Try Sample" buttons — not hardcoded results) ─
const SAMPLE_REACT_CODE = `import React from 'react';

export function UserProfile({ user }) {
  const handleClick = () => {
    console.log("Clicked profile");
  };

  // Issue 1: Creating objects inside loop
  const items = user.history.map(item => {
    const defaultConfig = { theme: 'dark', priority: 'high' };
    return { ...item, config: defaultConfig };
  });

  return (
    <div>
      {/* Issue 2: Missing image dimensions */}
      <img src={user.avatarUrl} alt="Avatar" />

      {/* Issue 3: Clickable div missing keyboard listener */}
      <div className="card" onClick={handleClick}>
        <h3>{user.name}</h3>
      </div>
    </div>
  );
}`;

const SAMPLE_ANGULAR_CODE = `import { Component } from '@angular/core';

@Component({
  selector: 'app-search',
  template: \`
    <div class="search-box">
      <!-- Issue 1: Custom clickable div missing ARIA role -->
      <div class="btn-search" (click)="onSearch()">
        <span>Search</span>
      </div>

      <!-- Issue 2: Image missing width/height -->
      <img src="/assets/icon.png" alt="Search Icon" />
    </div>
  \`
})
export class SearchPanelComponent {
  onSearch() {}
}`;

const SAMPLE_VUE_CODE = `<template>
  <div className="vue-profile">
    <!-- Issue 1: Image missing width and height attributes -->
    <img src="/assets/avatar.png" alt="User Avatar" />

    <!-- Issue 2: Clickable div missing keyboard listener -->
    <div className="action-btn" @click="handleSave">
      <span>Save User Settings</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
const handleSave = () => { console.log('Saved'); };
</script>`;

const SAMPLE_NEXTJS_CODE = `import Image from 'next/image';

export default function DashboardPage({ data }) {
  const handleAction = () => {
    console.log("Navigated");
  };

  // Issue 1: Creating objects inside loop
  const processed = data.items.map(item => {
    const defaultMeta = { status: 'active', tier: 'premium' };
    return { ...item, meta: defaultMeta };
  });

  return (
    <main>
      <h1>Next.js Dashboard</h1>

      {/* Issue 2: Clickable div missing keyboard listener */}
      <div className="action-card" onClick={handleAction}>
        <span>Quick Action Panel</span>
      </div>

      {/* Issue 3: Image missing width/height */}
      <img src="/banner.png" alt="Dashboard Hero" />
    </main>
  );
}`;

// ── Types ───────────────────────────────────────────────────────────────────
interface DiagnosticItem {
  ruleId: string;
  ruleName: string;
  domain: string;
  concern: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  filePath: string;
  location: { start: { line: number; column?: number }; end?: { line: number; column?: number } };
  offendingCodeSnippet: string;
  message: string;
  remediation: string;
  standardReference: string;
  evidence?: string;
  sourceKind?: 'REAL_AST' | 'LEGACY_TEXT_HEURISTIC';
  /** Authoritative separation of the two independent Live Scan systems -- see
   *  src/engine/diagnostic-classifier.ts. Server-computed, never re-derived from ruleId matching. */
  kind?: 'FIGM_RULE' | 'GENERAL_CODE_ERROR';
  /** Pre-attempt fixability, computed for every diagnostic in both domains -- drives the
   *  "Apply & Verify Fix" / "Preview Suggested Fix" / disabled "No Safe Fix" button state below. */
  fixabilityStatus?: 'AUTO_FIX_AVAILABLE' | 'SUGGESTED_FIX_ONLY' | 'NO_SAFE_FIX';
  /** Human-facing compiler/parser code, GENERAL_CODE_ERROR only (e.g. "TS2322", "SYNTAX"). */
  compilerCode?: string;
}

/** Mirrors AIRemediationPipelineResult (src/ai/ai-remediation-pipeline.ts) -- the client must
 *  never invent its own notion of "fixed" independent of what the server actually verified. */
type VerificationStatus = 'FIXED' | 'PATCH_REJECTED' | 'UNRESOLVED' | 'MANUAL_REVIEW_REQUIRED' | 'VERIFICATION_UNAVAILABLE' | 'AI_UNAVAILABLE';

interface FixOutcome {
  beforeCode: string;
  afterCode: string;
  description: string;
  engine: string;
  /** True ONLY when the patched code was actually re-scanned and the original violation
   *  (defect.ruleId) is confirmed gone -- never set true just because a patch was produced. */
  verified: boolean;
  status: VerificationStatus;
  fallbackReason?: string;
  /** Which of the two independent fix systems produced this outcome -- drives the "[FIGM FIX]" /
   *  "[CODE ERROR FIX]" history label. Never inferred from the outcome itself; always the same
   *  classification (defect.kind) that chose which pipeline/action to call in the first place. */
  pipeline: 'FIGM_FIX' | 'CODE_ERROR_FIX';
}

const PIPELINE_LABEL: Record<FixOutcome['pipeline'], string> = {
  FIGM_FIX: '[FIGM FIX]',
  CODE_ERROR_FIX: '[CODE ERROR FIX]',
};

/** Mirrors AIRemediationPipelineResult['engineType'] (src/ai/ai-remediation-pipeline.ts) --
 *  distinct, honest labels per path so "AI fixed this" and "nothing could be fixed" never render
 *  as the same badge. There is no regex-fallback engineType to label -- that path no longer exists.
 *  AI_ASSISTED_FIX has no fixed label here -- which AI actually produced the patch (Claude, Gemini,
 *  or a local Ollama model) is server-reported per-response via `provider`
 *  (src/ai/ai-provider-selector.ts chooses it), so the label is built at the call site (see
 *  buildEngineLabel below) instead of hardcoded per vendor. */
const ENGINE_LABELS: Record<string, string> = {
  AST_DETERMINISTIC_FIX: '⚡ Deterministic Engine',
  MANUAL_REVIEW: '🧑 Manual Review Required',
  UNAVAILABLE: '⛔ Automated Fix Unavailable',
};

const AI_PROVIDER_LABELS: Record<string, string> = {
  CLAUDE: '✨ Claude AI Suggested Fix',
  GEMINI: '✨ Gemini AI Suggested Fix (Claude fallback)',
};

function buildEngineLabel(engineType: string | undefined, provider: string | undefined): string {
  if (engineType === 'AI_ASSISTED_FIX') {
    return (provider && AI_PROVIDER_LABELS[provider]) || '✨ AI Suggested Fix';
  }
  return ENGINE_LABELS[engineType as keyof typeof ENGINE_LABELS] || '⚡ Deterministic Engine';
}

interface ScanResultResponse {
  filePath: string;
  framework: string;
  totalErrors: number;
  totalWarnings: number;
  extractedALPsCount: number;
  diagnostics: DiagnosticItem[];
  qualityScore?: number;
  // peakMemoryMb is null when the runtime exposed no memory API to measure from (see
  // src/engine/dynamic-profiler.ts's buildProfileMetrics) -- never a fabricated placeholder
  // number. Can also legitimately be negative (GC freed more than this scan allocated).
  // profilerStatus 'UNAVAILABLE' means the sandbox infrastructure itself could not run in this
  // environment (Section 22) -- static findings above are entirely unaffected either way.
  profile?: { executionTimeMs: number; peakMemoryMb: number | null; profilerStatus?: 'OK' | 'UNAVAILABLE' };
  complexity?: {
    cyclomaticComplexity: number;
    complexityRating: string;
    riskRating?: string;
  };
  /** Server-authoritative two-system counts -- figmRuleCount + generalCodeErrorCount === diagnostics.length. */
  figmRuleCount?: number;
  generalCodeErrorCount?: number;
  /** Honest analysis-completeness status -- see RuleExecutionEngine.buildScanResult. figmStatus
   *  BLOCKED/PARTIAL means the FIGM section below reflects only what the parser could recover,
   *  not a guarantee no further violations exist in the unparsed remainder. UNSUPPORTED_FRAMEWORK
   *  is the server-authoritative "FIGM has no rule coverage for this framework at all" signal --
   *  see the "Not Yet Supported" banner below, which now reads THIS field instead of a client-only
   *  hardcoded framework set. */
  analysis?: {
    parserStatus: 'VALID' | 'INVALID';
    figmStatus: 'COMPLETE' | 'PARTIAL' | 'BLOCKED' | 'UNSUPPORTED_FRAMEWORK';
  };
  /** Third domain, distinct from FIGM_RULE/GENERAL_CODE_ERROR diagnostics -- a failure of the scan
   *  service itself (see ScanServiceStatus in app/api/scan/route.ts), not a finding about the
   *  submitted source. Only present when something about the *service* (not the code) went wrong. */
  serviceStatus?: {
    status: 'INFRASTRUCTURE_ERROR';
    stage: 'ANALYSIS_ENGINE' | 'PERSISTENCE';
    message: string;
  };
}

// ── Severity colours ────────────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#b91c1c',
  MEDIUM: '#1d4ed8',
  LOW: 'rgba(0, 0, 0, 0.6)',
};

// Phase 2 (AST/Rule Coverage Gaps): previously a hardcoded client-side framework set here had to
// be manually kept in sync with which frameworks the server actually runs zero FIGM rules against
// -- now driven directly by the server-authoritative result.analysis.figmStatus signal instead
// (see the "Not Yet Supported" banner below), so this file can never drift out of sync with
// RuleExecutionEngine.buildScanResult's own real UNSUPPORTED_FRAMEWORK determination.

// Mirrors MAX_CODE_LENGTH in app/api/scan/route.ts -- checked client-side too so an obviously
// oversized paste gets an immediate, specific message instead of a network round-trip that
// ends in a generic error.
const MAX_CODE_LENGTH = 500000;

const SEV_BG: Record<string, string> = {
  CRITICAL: 'rgba(239,68,68,0.12)',
  HIGH: 'rgba(239, 68, 68, 0.1)',
  MEDIUM: 'rgba(59, 130, 246, 0.1)',
  LOW: 'rgba(0, 0, 0, 0.04)',
};

// ── Fix outcome presentation — every label here must match what the real engine actually
// verified via a re-scan (AIRemediationPipeline / RemediationEngine.validatePatch). Never
// present a status here as "fixed" unless `verified === true` backs it.
const FIX_STATUS_META: Record<VerificationStatus, { icon: string; label: string; color: string; detail: string }> = {
  FIXED: {
    icon: '✅',
    label: 'Verified Fixed',
    color: '#1d4ed8',
    detail: 'The patched code was re-scanned with the real FIGM engine and this violation no longer fires.',
  },
  MANUAL_REVIEW_REQUIRED: {
    icon: '⚠️',
    label: 'Manual Review Required',
    color: '#1d4ed8',
    detail: 'FIGM cannot safely auto-apply this fix (e.g. it would require inferring information like a dependency array). Review the suggested change below and apply it yourself if correct — your code was NOT changed.',
  },
  UNRESOLVED: {
    icon: '❌',
    label: 'Fix Did Not Resolve The Violation',
    color: '#1d4ed8',
    detail: 'A patch was generated, but re-scanning it still detects the same violation. Your code was NOT changed.',
  },
  PATCH_REJECTED: {
    icon: '❌',
    label: 'Patch Rejected',
    color: '#1d4ed8',
    detail: 'The suggested patch would introduce a new syntax or type error. Your code was NOT changed.',
  },
  VERIFICATION_UNAVAILABLE: {
    icon: '⚠️',
    label: 'Applied Locally — Not Verified',
    color: '#1d4ed8',
    detail: 'A local patch was applied, but it could not be re-scanned to confirm the violation is actually gone (connection unavailable). Re-scan manually to confirm before trusting this fix.',
  },
  // Distinct from UNRESOLVED: no candidate patch was ever produced (every AI attempt errored —
  // unparseable output, timeout, rate limit — or the provider consciously declined), so no patch
  // was ever generated or re-scanned. See AIRemediationPipelineResult.verificationStatus's doc
  // comment (src/ai/ai-remediation-pipeline.ts) — this used to be mislabeled UNRESOLVED, which
  // wrongly implied a patch had been generated and re-scanned.
  AI_UNAVAILABLE: {
    icon: '⚠️',
    label: 'Automated Fix Unavailable',
    color: '#1d4ed8',
    detail: 'No AI-generated patch could be produced for this violation (see the reason below). Your code was NOT changed.',
  },
};

// Same verificationStatus union, same underlying pipeline/guarantees as FIX_STATUS_META above --
// only the WORDING differs, so a compile/type/syntax error (GENERAL_CODE_ERROR) is never described
// as a "violation" (FIGM guideline language that doesn't apply to a compiler diagnostic). Used only
// by the general-code-error list below; FIGM violations keep FIX_STATUS_META unchanged.
const GENERAL_ERROR_FIX_STATUS_META: Record<VerificationStatus, { icon: string; label: string; color: string; detail: string }> = {
  FIXED: {
    icon: '✅',
    label: 'Automated Fix Verified',
    color: '#1d4ed8',
    detail: 'The patched code was re-scanned with the real TypeScript compiler and this error no longer occurs.',
  },
  MANUAL_REVIEW_REQUIRED: FIX_STATUS_META.MANUAL_REVIEW_REQUIRED,
  UNRESOLVED: {
    icon: '❌',
    label: 'Fix Validation Failed',
    color: '#1d4ed8',
    detail: 'A patch was generated, but re-scanning it still detects the same compile/type/syntax error (or a related one caused by the same defect). Your code was NOT changed.',
  },
  PATCH_REJECTED: {
    icon: '❌',
    label: 'Fix Validation Failed',
    color: '#1d4ed8',
    detail: 'The suggested patch would introduce a new syntax or type error. Your code was NOT changed.',
  },
  VERIFICATION_UNAVAILABLE: FIX_STATUS_META.VERIFICATION_UNAVAILABLE,
  AI_UNAVAILABLE: {
    icon: '⚠️',
    label: 'Automated Fix Unavailable',
    color: '#1d4ed8',
    detail: 'No patch could be produced for this compile/type/syntax error (see the reason below). Your code was NOT changed.',
  },
};

// ── Fixability status presentation (General Code Errors only) — drives the button label/state
// shown BEFORE any fix is attempted. See src/engine/diagnostic-classifier.ts's getFixabilityStatus
// for how this is derived (a real, side-effect-free dry-run of the same deterministic engine the
// "Fix" button itself uses — never a separate, potentially-drifting guess).
const FIXABILITY_META: Record<
  NonNullable<DiagnosticItem['fixabilityStatus']>,
  { label: string; buttonLabel: string; color: string; bg: string; disabled: boolean }
> = {
  AUTO_FIX_AVAILABLE: {
    label: 'Auto-Fix Available',
    buttonLabel: '🛠️ Apply & Verify Fix',
    color: '#1d4ed8',
    bg: 'rgba(59, 130, 246, 0.1)',
    disabled: false,
  },
  // Clicking still calls the real pipeline (to compute and display the actual candidate patch),
  // but the server-side guard in AIRemediationPipeline.remediateDefect makes it structurally
  // impossible for this to ever come back `verified: true` -- so the source is never modified
  // automatically no matter what. This is a preview action, not an apply action.
  SUGGESTED_FIX_ONLY: {
    label: 'Suggested Fix Only',
    buttonLabel: '👁️ Preview Suggested Fix',
    color: '#1d4ed8',
    bg: 'rgba(96, 165, 250, 0.1)',
    disabled: false,
  },
  NO_SAFE_FIX: {
    label: 'No Safe Fix',
    buttonLabel: '🚫 No Safe Fix Available',
    color: '#1d4ed8',
    bg: 'rgba(239, 68, 68, 0.1)',
    disabled: true,
  },
};

// ── Diff viewer helper ──────────────────────────────────────────────────────
type DiffRow = { type: 'same' | 'removed' | 'added'; text: string };

// Real LCS-based line diff (dynamic programming), not a naive index-paired comparison. The
// naive version -- walk both files in lockstep, marking a pair "changed" whenever line[i] !==
// line[j] at the SAME position -- breaks the instant a fix inserts or deletes even one line
// (e.g. adding a `'use client'` directive): every following line then compares against its
// neighbor-shifted-by-one, mismatches, and the whole rest of the file renders as 100% removed
// + 100% added -- a real, live-reproduced bug (confirmed against FIGM's own FIGM-NEXT-01 fix,
// which inserts exactly one directive line and one blank line: the naive diff marked all 44
// rows of a 21-line file as changed). LCS alignment instead finds the actual common
// subsequence, so only the lines that truly differ are marked.
function computeLineDiff(beforeLines: string[], afterLines: string[]): DiffRow[] {
  const n = beforeLines.length;
  const m = afterLines.length;

  // Guard against the O(n*m) DP table blowing up on pathologically large pasted files -- fall
  // back to a coarse whole-block replacement rather than hang the tab.
  if (n * m > 4_000_000) {
    const rows: DiffRow[] = [];
    for (const l of beforeLines) rows.push({ type: 'removed', text: l });
    for (const l of afterLines) rows.push({ type: 'added', text: l });
    return rows;
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = beforeLines[i] === afterLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (beforeLines[i] === afterLines[j]) {
      rows.push({ type: 'same', text: beforeLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: 'removed', text: beforeLines[i] });
      i++;
    } else {
      rows.push({ type: 'added', text: afterLines[j] });
      j++;
    }
  }
  while (i < n) rows.push({ type: 'removed', text: beforeLines[i++] });
  while (j < m) rows.push({ type: 'added', text: afterLines[j++] });
  return rows;
}

function DiffView({ before, after }: { before: string; after: string }) {
  const rows = computeLineDiff(before.split('\n'), after.split('\n'));

  const addedCount = rows.filter((r) => r.type === 'added').length;
  const removedCount = rows.filter((r) => r.type === 'removed').length;
  if (addedCount === 0 && removedCount === 0) return null;

  return (
    <div
      style={{
        borderRadius: '8px',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        fontSize: '11px',
        fontFamily: 'JetBrains Mono, monospace',
        maxHeight: '220px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          padding: '6px 12px',
          background: 'rgba(255, 255, 255, 0.9)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.07)',
          color: 'rgba(0, 0, 0, 0.7)',
          fontSize: '10px',
          fontWeight: 700,
          display: 'flex',
          gap: '16px',
        }}
      >
        <span style={{ color: '#b91c1c' }}>− removed</span>
        <span style={{ color: '#1d4ed8' }}>+ added</span>
        <span style={{ marginLeft: 'auto' }}>+{addedCount} −{removedCount}</span>
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            padding: '1px 12px',
            background:
              row.type === 'removed'
                ? 'rgba(239,68,68,0.08)'
                : row.type === 'added'
                  ? 'rgba(59, 130, 246, 0.08)'
                  : 'transparent',
            color:
              row.type === 'removed'
                ? '#b91c1c'
                : row.type === 'added'
                  ? '#1d4ed8'
                  : 'rgba(0, 0, 0, 0.6)',
            whiteSpace: 'pre',
            lineHeight: '1.6',
          }}
        >
          {row.type === 'removed' ? '−  ' : row.type === 'added' ? '+  ' : '   '}
          {row.text}
        </div>
      ))}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function LiveScanPage() {
  const [code, setCode] = useState<string>(SAMPLE_REACT_CODE);
  const [fileName, setFileName] = useState<string>('UserProfile.jsx');
  const [scanning, setScanning] = useState<boolean>(false);
  const [result, setResult] = useState<ScanResultResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  // Distinct from scanError: a genuine scan-SERVICE failure (the analysis engine itself is
  // unavailable, no scan completed at all) rather than a network/parse failure on this page or a
  // finding about the submitted code. Kept separate so the two are never visually or semantically
  // conflated -- see ScanServiceStatus in app/api/scan/route.ts. A PERSISTENCE-stage service
  // status (scan succeeded, only history-saving failed) rides along on `result.serviceStatus`
  // instead, since a scan result did come back in that case.
  const [serviceError, setServiceError] = useState<string | null>(null);

  // Two-system split, computed from the server's authoritative per-diagnostic `kind` field (never
  // re-derived via ruleId.startsWith('FIGM-') here — see src/engine/diagnostic-classifier.ts).
  // `kind` is always present on a real response; the `?? 'FIGM_RULE'` fallback only guards a
  // TypeScript-optional field, not an actual expected code path.
  const figmViolations = useMemo(
    () => (result?.diagnostics ?? []).filter((d) => (d.kind ?? 'FIGM_RULE') === 'FIGM_RULE'),
    [result]
  );
  const generalCodeErrors = useMemo(
    () => (result?.diagnostics ?? []).filter((d) => d.kind === 'GENERAL_CODE_ERROR'),
    [result]
  );
  const figmRuleCount = result?.figmRuleCount ?? figmViolations.length;
  const generalCodeErrorCount = result?.generalCodeErrorCount ?? generalCodeErrors.length;

  // Per-violation fix state
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [fixResults, setFixResults] = useState<Record<string, FixOutcome>>({});

  // Save-to-history state. Whether the button is even shown to a signed-out visitor is a pure UI
  // nicety (this app has no client-side auth-state hook anywhere -- see HeaderBar.tsx, which
  // doesn't reflect login state either); the REAL authorization decision is made server-side by
  // POST /api/scans itself (via the same httpOnly session cookie every same-origin fetch already
  // carries automatically), which is what this button's 401 handling below actually relies on.
  const [savingToHistory, setSavingToHistory] = useState<boolean>(false);
  const [saveHistoryStatus, setSaveHistoryStatus] = useState<{ kind: 'success' | 'error' | 'auth'; message: string } | null>(null);

  // ── Research study enrollment (see docs/audit/LIVE_SCAN_ONLY_RESEARCH_FLOW.md) ─────────────
  // Same pattern as savingToHistory above: no client-side auth-state hook, no localStorage check
  // -- just attempt the real, cookie-authenticated GET and let the server's own 401 decide whether
  // this visitor is even signed in. `studyStatus === null` after loading means "anonymous, or
  // genuinely not enrolled" and the panel renders nothing for a visitor who was never
  // authenticated at all (a 401 is treated identically to "don't show this panel").
  const [studyStatusLoaded, setStudyStatusLoaded] = useState(false);
  const [studySignedIn, setStudySignedIn] = useState(false);
  const [studyParticipantCode, setStudyParticipantCode] = useState<string | null>(null);
  const [studyResearchStatus, setStudyResearchStatus] = useState<'ASSIGNED' | 'CONSENT_VERIFIED' | 'REVOKED' | null>(null);
  const [showJoinStudyForm, setShowJoinStudyForm] = useState(false);
  const [studyConsentChecked, setStudyConsentChecked] = useState(false);
  const [joiningStudy, setJoiningStudy] = useState(false);
  const [studyError, setStudyError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/user-study/enroll')
      .then((res) => {
        if (res.status === 401) return null; // not signed in -- panel stays hidden, not an error
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setStudySignedIn(true);
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setStudyParticipantCode(data.participantCode ?? null);
        setStudyResearchStatus(data.researchStatus ?? null);
      })
      .catch(() => {
        // Transient failure to check status -- fail silent (hide the panel) rather than show an
        // alarming error for what is, for most visitors, an entirely optional feature.
      })
      .finally(() => setStudyStatusLoaded(true));
  }, []);

  const handleJoinStudy = async () => {
    if (!studyConsentChecked || joiningStudy) return;
    setJoiningStudy(true);
    setStudyError(null);
    try {
      const res = await fetch('/api/user-study/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentConfirmed: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Unable to join the study (HTTP ${res.status})`);
      setStudyParticipantCode(data.participantCode);
      setStudyResearchStatus('ASSIGNED');
      setShowJoinStudyForm(false);
    } catch (err: any) {
      setStudyError(err?.message || 'Unable to join the study right now. Please try again.');
    } finally {
      setJoiningStudy(false);
    }
  };

  // ── File upload (paste is the default; this adds real local-file input) ────
  // A single uploaded file is fed straight into the existing single-editor flow above (same
  // code/fileName state, same handleScan/result rendering -- no new code path). Two or more files
  // switch into "batch mode": each is scanned independently via the same real /api/scan endpoint
  // the single-file flow already uses, with results kept per-file rather than merged into one
  // editor's worth of state (there is no single shared editor for N files to jump-to-line/apply-fix
  // into, so batch mode intentionally shows a simpler, non-interactive per-file diagnostic list
  // rather than reproducing every single-file panel feature N times).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [batchFiles, setBatchFiles] = useState<{ fileName: string; code: string }[] | null>(null);
  const [batchResults, setBatchResults] = useState<Record<string, { status: 'scanning' | 'done' | 'error'; result?: ScanResultResponse; error?: string }>>({});
  const [batchExpanded, setBatchExpanded] = useState<Record<string, boolean>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [diagnosticsHelpOpen, setDiagnosticsHelpOpen] = useState<boolean>(false);

  const readFilesAsText = (fileList: FileList): Promise<{ fileName: string; code: string }[]> =>
    Promise.all(
      Array.from(fileList).map(
        (file) =>
          new Promise<{ fileName: string; code: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ fileName: file.name, code: String(reader.result ?? '') });
            reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
            reader.readAsText(file);
          })
      )
    );

  const runBatchScan = async (files: { fileName: string; code: string }[]) => {
    setBatchResults(Object.fromEntries(files.map((f) => [f.fileName, { status: 'scanning' as const }])));
    // Sequential, not Promise.all -- this hits the same POST /api/scan rate limit (60 req/min per
    // IP, see app/api/scan/route.ts) real interactive paste-scanning already shares, so a batch of
    // many files must not fire them all at once and trip it for a single legitimate upload.
    for (const f of files) {
      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: f.code, fileName: f.fileName }),
        });
        const data: any = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = data?.serviceStatus?.status === 'INFRASTRUCTURE_ERROR' ? data.serviceStatus.message : data?.error;
          throw new Error(msg || `Server returned status ${res.status}`);
        }
        setBatchResults((prev) => ({ ...prev, [f.fileName]: { status: 'done', result: data as ScanResultResponse } }));
      } catch (err: any) {
        setBatchResults((prev) => ({ ...prev, [f.fileName]: { status: 'error', error: err.message || 'Scan failed' } }));
      }
    }
  };

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadError(null);

    if (fileList.length === 1) {
      // Single file: reuse the existing single-editor flow exactly as if the content were pasted.
      setBatchFiles(null);
      try {
        const [{ fileName: name, code: content }] = await readFilesAsText(fileList);
        if (content.length > MAX_CODE_LENGTH) {
          setUploadError(`${name} is too large (${(content.length / 1000).toFixed(0)} KB) — the maximum is ${MAX_CODE_LENGTH / 1000} KB.`);
          return;
        }
        setFileName(name);
        setCode(content);
        handleScan(content, name);
      } catch (err: any) {
        setUploadError(err.message || 'Could not read the selected file.');
      }
      return;
    }

    // Multiple files: batch mode.
    try {
      const files = await readFilesAsText(fileList);
      const oversized = files.find((f) => f.code.length > MAX_CODE_LENGTH);
      if (oversized) {
        setUploadError(`${oversized.fileName} is too large (${(oversized.code.length / 1000).toFixed(0)} KB) — the maximum is ${MAX_CODE_LENGTH / 1000} KB. Remove it and re-upload.`);
        return;
      }
      setBatchFiles(files);
      setBatchExpanded({});
      await runBatchScan(files);
    } catch (err: any) {
      setUploadError(err.message || 'Could not read the selected files.');
    }
  };

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScannedCode = useRef<string>('');

  // ── Uncaught-error/rejection observability ─────────────────────────────
  // This page mounts a real Monaco Editor instance, whose language mode is swapped live as the
  // sample/filename changes (see the `language={...}` prop below) and whose model/worker
  // lifecycle is torn down and recreated across React fast-refresh reloads in dev. Both are known
  // sources of Monaco throwing/rejecting with a bare, non-Error object from its own internal
  // worker message-handling code -- which DevTools then reports as an unattributable
  // "[EXCEPTION] Object" with no message or stack, exactly what live black-box testing on this
  // page observed once, unreproducibly, across two separate audit sessions (no code path in this
  // file, RemediationEngine, or the /api/scan route was found to throw/reject a non-Error value;
  // extensive targeted reproduction attempts -- rapid sample-tab switching, rapid typed input,
  // burst fix-apply clicks, forced HMR reloads -- did not reproduce it again). Rather than leave a
  // future occurrence equally unattributable, capture it with full context the moment it happens.
  useEffect(() => {
    const describe = (value: unknown): string => {
      if (value instanceof Error) return value.stack || value.message;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    };
    const onError = (e: ErrorEvent) => {
      // eslint-disable-next-line no-console
      console.error('[FIGM live-scan] Uncaught error:', e.message || describe(e.error), {
        filename: e.filename,
        line: e.lineno,
        column: e.colno,
        error: e.error,
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      // eslint-disable-next-line no-console
      console.error('[FIGM live-scan] Unhandled promise rejection:', describe(e.reason), { reason: e.reason });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  // ── Core scan function (always uses current editor code — no hardcode) ──
  const handleScan = useCallback(async (codeToScan?: string, fileToScan?: string) => {
    const targetCode = codeToScan !== undefined ? codeToScan : code;
    const targetFile = fileToScan !== undefined ? fileToScan : fileName;

    if (!targetCode.trim()) return;

    if (targetCode.length > MAX_CODE_LENGTH) {
      setScanError(
        `Payload too large (${(targetCode.length / 1000).toFixed(0)} KB) — the maximum is ${MAX_CODE_LENGTH / 1000} KB. Trim the input and try again.`
      );
      setResult(null);
      return;
    }

    setScanning(true);
    setScanError(null);
    setServiceError(null);
    lastScannedCode.current = targetCode;
    // Framework isn't known until the server responds, so this fires with 'unknown' -- matching
    // the same "detected server-side, not client-guessed" principle the rest of this file follows
    // for the actual scan result. Never includes targetCode/targetFile itself (see
    // src/lib/analytics.ts's closed parameter types).
    trackScanStarted({ framework: 'unknown', source: 'live_scan' });

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: targetCode, fileName: targetFile }),
      });
      // Always read the body before branching on status -- the server puts a real, specific
      // message in it for every non-2xx case (429 rate limit, 413 too large, 503 infra failure,
      // 500 last-resort), and discarding it in favor of a generic "Server returned status N"
      // string throws away information the API deliberately provides.
      const data: any = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.serviceStatus?.status === 'INFRASTRUCTURE_ERROR') {
          setServiceError(data.serviceStatus.message);
          setResult(null);
          return;
        }
        throw new Error(data?.error || `Server returned status ${res.status}`);
      }
      const scanData = data as ScanResultResponse;
      setResult(scanData);
      trackScanCompleted({
        framework: scanData.framework,
        ruleCount: scanData.figmRuleCount ?? scanData.diagnostics.length,
        durationMs: scanData.profile?.executionTimeMs ?? 0,
        source: 'live_scan',
      });
      // Drop fix-attempt state only for violations that are no longer at the same (ruleId,
      // line) key -- not everything. A blanket reset here was wiping every OTHER still-open
      // violation's fix badge/diff whenever ANY single violation's fix succeeded, since a
      // successful fix triggers exactly this same re-scan (see applyFix below): fix violation
      // B, then fix violation A -- B's "Manual Review Required" card, still open and unrelated
      // to A's patch, silently reverted to a blank "Apply Fix" button the instant A's rescan
      // landed. A violation whose key really did shift (line moved) is still safely dropped,
      // since we can no longer be sure the old fix attempt still describes the same content.
      setFixResults((prev) => {
        const stillPresentKeys = new Set(scanData.diagnostics.map((d) => d.ruleId + '_' + d.location.start.line));
        const next: Record<string, FixOutcome> = {};
        for (const [key, outcome] of Object.entries(prev)) {
          if (stillPresentKeys.has(key)) next[key] = outcome;
        }
        return next;
      });
    } catch (err: any) {
      setScanError(err.message || 'Failed to inspect code');
    } finally {
      setScanning(false);
    }
  }, [code, fileName]);

  // ── Save the current scan to the authenticated user's persistent history ──
  // POSTs to the real, authoritative persistence endpoint (see app/api/scans/route.ts) -- the
  // server re-runs the real engine and derives the quality score/diagnostics/severity counts
  // itself; nothing about the result this page already computed and displayed is trusted or
  // resubmitted verbatim. A 401 here is not an error state to report generically -- it is the
  // server's real, authoritative answer to "is this caller actually signed in," which this page
  // has no reliable way to know in advance (see the state declaration's comment above).
  const handleSaveToHistory = async () => {
    if (!code.trim()) return;
    setSavingToHistory(true);
    setSaveHistoryStatus(null);
    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, fileName }),
      });

      if (res.status === 401) {
        setSaveHistoryStatus({ kind: 'auth', message: 'Log in to save this scan to your history.' });
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setSaveHistoryStatus({ kind: 'error', message: data.error || 'Failed to save scan.' });
        return;
      }

      setSaveHistoryStatus({
        kind: 'success',
        message: `Saved to your history — quality score ${data.record.qualityScore}/100.`,
      });
    } catch (err: any) {
      setSaveHistoryStatus({ kind: 'error', message: err.message || 'Failed to save scan.' });
    } finally {
      setSavingToHistory(false);
    }
  };

  // ── Auto-scan the default sample on first mount ────────────────────────
  useEffect(() => {
    handleScan(SAMPLE_REACT_CODE, 'UserProfile.jsx');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Monaco markers sync ────────────────────────────────────────────────
  // `monacoRef` (not the `useMonaco()` hook -- deliberately not imported, see the dynamic Editor
  // import above) is a plain ref, so it can't drive this effect's dependency array the way a
  // reactive `monaco` value could; the `editorRef.current`/`result` dependency below is already
  // the same established pattern this effect used for `editorRef` (also a ref) before this change.
  useEffect(() => {
    const monaco = monacoRef.current;
    if (monaco && editorRef.current && result) {
      const model = editorRef.current.getModel();
      if (model) {
        const markers = result.diagnostics.map((d) => ({
          startLineNumber: d.location.start.line || 1,
          startColumn: (d.location.start.column ?? 0) + 1,
          endLineNumber: d.location.end?.line || d.location.start.line || 1,
          endColumn: (d.location.end?.column ?? 100),
          message: `[${d.ruleId}] ${d.ruleName}: ${d.remediation}`,
          severity:
            d.severity === 'CRITICAL' || d.severity === 'HIGH'
              ? monaco.MarkerSeverity.Error
              : monaco.MarkerSeverity.Warning,
          source: 'FIGM Code Inspector',
        }));
        monaco.editor.setModelMarkers(model, 'figm-analyzer', markers);
      }
    }
  }, [result]);

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;

    // Monaco's built-in TS/JS language service has no project type info (no React/Next
    // types, no tsconfig), so its semantic checks misflag ordinary JSX as errors. Those
    // squiggles are unrelated to the FIGM rule engine's own markers (set separately below
    // under the 'figm-analyzer' owner), so disable them to avoid misleading noise.
    monacoInstance.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
    monacoInstance.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
  };

  // ── Debounced auto-scan while user types ──────────────────────────────
  const handleCodeChange = (val: string | undefined) => {
    const newCode = val || '';
    setCode(newCode);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    // Empty source: nothing to scan. Clear any previous result rather than leaving it
    // displayed -- a stale diagnostics list describing code that's no longer in the editor
    // would misrepresent what's actually there.
    if (!newCode.trim()) {
      setResult(null);
      setScanError(null);
      setFixResults({});
      lastScannedCode.current = '';
      return;
    }

    debounceTimer.current = setTimeout(() => {
      if (newCode !== lastScannedCode.current) {
        handleScan(newCode, fileName);
      }
    }, 1500); // 1.5 s debounce
  };

  // ── Load sample preset ────────────────────────────────────────────────
  const loadPreset = (presetCode: string, presetFileName: string) => {
    setCode(presetCode);
    setFileName(presetFileName);
    setFixResults({});
    if (editorRef.current) editorRef.current.setValue(presetCode);
    handleScan(presetCode, presetFileName);
  };

  // ── Jump to line in editor ────────────────────────────────────────────
  const jumpToLine = (line: number) => {
    const safeLine = Number.isFinite(line) && line > 0 ? line : 1;
    if (editorRef.current) {
      editorRef.current.revealLineInCenter(safeLine);
      editorRef.current.setPosition({ lineNumber: safeLine, column: 1 });
      editorRef.current.focus();
    }
  };

  // ── Apply fix for a specific violation ───────────────────────────────
  // Contract: the editor's actual code is only ever mutated once a fix has been VERIFIED --
  // i.e. the server re-scanned the patched code with the real engine and confirmed
  // defect.ruleId no longer fires (see AIRemediationPipeline.remediateDefect /
  // RemediationEngine.validatePatch). A patch that doesn't verify is shown for inspection
  // (so the user can see what was attempted and why it wasn't applied) but never silently
  // written into the user's code, and never labeled "Fixed".
  //
  // Two genuinely separate entry points below (applyFigmFix / applyCodeErrorFix) share this one
  // implementation because the underlying detect->apply->re-scan->verify contract is identical --
  // the real separation is enforced server-side (FigmFixPipeline / CodeErrorFixPipeline each
  // refuse a defect outside their own scope, see src/ai/figm-fix-pipeline.ts) and at the call site
  // here (each wrapper hardcodes its own `action` and `pipeline` label, never inferred from the
  // defect after the fact) -- a FIGM violation can never come back labeled "[CODE ERROR FIX]" or
  // vice versa.
  const applyFix = async (
    defect: DiagnosticItem,
    action: 'fix-figm-rule' | 'fix-code-error',
    pipeline: FixOutcome['pipeline']
  ) => {
    const fixKey = defect.ruleId + '_' + defect.location.start.line;
    setFixingId(fixKey);
    const beforeCode = code;

    // Staleness guard: `defect` describes a violation found by the LAST COMPLETED scan
    // (lastScannedCode.current); `code` is whatever is in the editor right now, which the 1.5s
    // auto-scan debounce means can already be a newer, unscanned edit. Sending a mismatched
    // (code, defect) pair to the server used to produce a confusing downstream failure -- a
    // deterministic fixer locating the wrong AST node at the stale location, or the AI provider
    // correctly but unhelpfully declining because defect.offendingCodeSnippet no longer appears anywhere in the
    // current source. Caught here, before any network call, with an honest, specific message
    // instead of a wasted (and confusing) remediation attempt. The server independently enforces
    // the same check (see AIRemediationPipeline.remediateDefect's STALE_VIOLATION_CONTEXT guard)
    // as defense-in-depth, since this client check can't cover every caller.
    if (code !== lastScannedCode.current) {
      setFixResults((prev) => ({
        ...prev,
        [fixKey]: {
          beforeCode,
          afterCode: code,
          description: 'The code has changed since this violation was detected.',
          engine: '⏳ Re-scan required',
          verified: false,
          status: 'UNRESOLVED',
          fallbackReason: 'This violation was found against an earlier version of the source. Re-scan (or wait for auto-scan) before attempting a fix, so the fix is generated against the current code.',
          pipeline,
        },
      }));
      setFixingId(null);
      return;
    }

    try {
      // authFetch (src/auth/session-client.ts): if the access token had already expired by the
      // time this fires, transparently refreshes it and retries once -- this is specifically what
      // was missing when a real production AI-assisted fix (FIGM-REACT-01, provider GEMINI,
      // verified:true) produced no AiHistory row (see that module's own doc comment). The fix
      // action itself never requires auth (an anonymous caller still gets a real fix); this only
      // gives the fix-interaction TELEMETRY the best chance of being attributed to a real,
      // still-authenticated session.
      const res = await sessionClient.authFetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, fileName, action, defect }),
      });

      if (!res.ok) throw new Error('Fix endpoint error');
      const aiData = await res.json();

      const candidateCode: string = aiData.remediatedCode || code;
      const verified: boolean = aiData.verified === true;
      const status: VerificationStatus = aiData.verificationStatus || 'UNRESOLVED';
      const engineLabel = buildEngineLabel(aiData.engineType, aiData.provider);

      setFixResults((prev) => ({
        ...prev,
        [fixKey]: {
          beforeCode,
          afterCode: candidateCode,
          description: aiData.appliedFixDescription || defect.remediation,
          engine: engineLabel,
          verified,
          status,
          fallbackReason: aiData.fallbackReason,
          pipeline,
        },
      }));

      if (verified) {
        setCode(candidateCode);
        if (editorRef.current) editorRef.current.setValue(candidateCode);
        await handleScan(candidateCode, fileName);
      }
      // Not verified: leave the editor and the currently-displayed scan result untouched --
      // nothing changed, so there is nothing to re-scan.
    } catch {
      // The /api/scan round-trip itself failed (e.g. genuinely offline) -- fall back to the
      // deterministic engine running locally, but it must still be verified before being
      // trusted, not assumed to have worked just because it ran without throwing.
      //
      // Dynamically imported (not a top-level import) because RemediationEngine pulls in the
      // full server-side rule/AST/TypeScript-compiler stack via its sibling validatePatch()
      // method -- a static top-level import of this module was adding ~1MB to this page's
      // initial client bundle (999 kB page-own JS vs. 1.6-15.8 kB on every sibling page,
      // confirmed live via `npm run build`'s route size report) for a fallback branch that only
      // ever runs when the network request above has already failed.
      try {
        const { RemediationEngine } = await import('../../src/engine/remediation-engine');
        const localResult = RemediationEngine.applyQuickFix(code, defect as any);
        const { remediatedCode, appliedFixDescription, requiresManualReview } = localResult;

        if (requiresManualReview) {
          setFixResults((prev) => ({
            ...prev,
            [fixKey]: {
              beforeCode,
              afterCode: remediatedCode,
              description: appliedFixDescription,
              engine: '⚡ Deterministic Engine (offline)',
              verified: false,
              status: 'MANUAL_REVIEW_REQUIRED',
              pipeline,
            },
          }));
          return;
        }

        // Verify through the SAME real engine every other scan on this page uses -- a second
        // /api/scan call on the candidate code, not a client-reimplemented notion of "fixed".
        let verified = false;
        let status: VerificationStatus = 'VERIFICATION_UNAVAILABLE';
        try {
          const verifyRes = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: remediatedCode, fileName }),
          });
          if (verifyRes.ok) {
            const verifyData: ScanResultResponse = await verifyRes.json();
            const stillPresent = verifyData.diagnostics.some((d) => d.ruleId === defect.ruleId);
            verified = !stillPresent;
            status = verified ? 'FIXED' : 'UNRESOLVED';
          }
        } catch {
          // Still offline -- report the local patch honestly as unverified rather than "fixed".
        }

        setFixResults((prev) => ({
          ...prev,
          [fixKey]: {
            beforeCode,
            afterCode: remediatedCode,
            description: appliedFixDescription,
            engine: '⚡ Deterministic Engine (offline)',
            verified,
            status,
            pipeline,
          },
        }));

        if (verified) {
          setCode(remediatedCode);
          if (editorRef.current) editorRef.current.setValue(remediatedCode);
          await handleScan(remediatedCode, fileName);
        }
      } catch (e2) {
        setScanError('Fix failed: ' + String(e2));
      }
    } finally {
      setFixingId(null);
    }
  };

  // Pipeline A -- FIGM Rule Fixer. Scope: ONLY the 50 canonical FIGM research rules.
  const applyFigmFix = (defect: DiagnosticItem) => applyFix(defect, 'fix-figm-rule', 'FIGM_FIX');

  // Pipeline B -- General Code Error Fixer. Scope: every genuine syntax/compiler/parser diagnostic
  // that is NOT one of the 50 FIGM rules.
  const applyCodeErrorFix = (defect: DiagnosticItem) => applyFix(defect, 'fix-code-error', 'CODE_ERROR_FIX');

  // ── Score colour ─────────────────────────────────────────────────────
  const scoreColor = (s: number) =>
    s >= 80 ? '#1d4ed8' : s >= 50 ? '#b91c1c' : '#b91c1c';

  // Derived severity counts for the Code Health Overview (Step 9) -- a pure client-side
  // aggregation of `result.diagnostics[].severity`, a field the API already returns for every
  // diagnostic. This groups already-present data for display; it never calls a different
  // endpoint, never changes what is detected, and fabricates no metric the server didn't provide.
  const severityCounts = useMemo(() => {
    const counts: Record<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW', number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const d of result?.diagnostics ?? []) {
      if (counts[d.severity] !== undefined) counts[d.severity] += 1;
    }
    return counts;
  }, [result]);

  // The three research-facing domains (Architecture / Static Performance / Accessibility) via the
  // same canonical primaryResearchDomain() the detection engine and app/diagnostics/page.tsx both
  // use as their single source of truth -- never a locally re-derived grouping. Scoped to
  // kind !== 'GENERAL_CODE_ERROR' only: a general (non-FIGM-rule) code error carries a placeholder
  // domain: 'PERFORMANCE' at the server (rule-execution-engine.ts) purely so it fits the shared
  // DiagnosticItem shape, which is not a real research-domain classification -- counting it here
  // would misrepresent e.g. a TypeScript syntax error as a "Static Performance" finding. This
  // mirrors the page's own pre-existing, deliberate FIGM_RULE vs GENERAL_CODE_ERROR separation
  // (see the "Two-system summary" tiles below).
  const domainCounts = useMemo(() => {
    const counts: Record<'ARCHITECTURE' | 'STATIC_PERFORMANCE' | 'ACCESSIBILITY', number> = {
      ARCHITECTURE: 0,
      STATIC_PERFORMANCE: 0,
      ACCESSIBILITY: 0,
    };
    for (const d of result?.diagnostics ?? []) {
      if (d.kind === 'GENERAL_CODE_ERROR') continue;
      counts[primaryResearchDomain(d.domain, d.concern)] += 1;
    }
    return counts;
  }, [result]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="insp-shell animate-fade-in">

      {/* Compact top bar (Step 5) */}
      <div className="insp-topbar">
        <div className="insp-topbar-left">
          <span aria-hidden="true">⚡</span>
          <span className="insp-topbar-title">FIGM Code Inspector</span>
          {result && (
            <span className="insp-chip" style={{ ['--chip-color' as any]: '#60a5fa', ['--chip-bg' as any]: 'rgba(59, 130, 246, 0.1)', ['--chip-border' as any]: 'rgba(59, 130, 246, 0.25)' }}>
              {result.framework}
            </span>
          )}
          <span className={`insp-status${scanning ? ' is-scanning' : ''}`}>
            <span className="insp-status-dot" aria-hidden="true" />
            {scanning ? 'Scanning…' : 'Ready'}
          </span>
        </div>
        <div className="insp-topbar-actions">
          <span className="insp-topbar-sub">Auto-scan · 1.5s debounce</span>
          <Link href="/settings" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', textDecoration: 'none' }}>
            ⚙️ Settings
          </Link>
        </div>
      </div>

      <p style={{ color: 'var(--text-dim)', fontSize: '12.5px', margin: 0 }}>
        Paste <strong style={{ color: 'var(--text-muted)' }}>any</strong> code below — FIGM detects real violations from your actual code and applies targeted fixes. Nothing is hardcoded.
      </p>

      {/* Research study enrollment panel -- only ever shown to a signed-in visitor (the GET check
          above hides it entirely for an anonymous one, matching this page's own established
          convention of never gating UI on a client-side auth guess). See
          docs/audit/LIVE_SCAN_ONLY_RESEARCH_FLOW.md for the full state-machine this mirrors. */}
      {studyStatusLoaded && studySignedIn && (
        <div
          className="insp-notice"
          style={
            studyResearchStatus === 'CONSENT_VERIFIED'
              ? { color: '#1d4ed8', background: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.25)' }
              : studyResearchStatus === 'REVOKED'
                ? { color: '#1d4ed8', background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }
                : { color: '#1d4ed8', background: 'rgba(96, 165, 250, 0.08)', borderColor: 'rgba(96, 165, 250, 0.2)' }
          }
        >
          {!studyParticipantCode && !showJoinStudyForm && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <span>🔬 Research study: <strong>Not enrolled</strong></span>
              <button
                type="button"
                onClick={() => setShowJoinStudyForm(true)}
                className="btn-secondary"
                style={{ padding: '5px 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
              >
                Join Research Study
              </button>
            </div>
          )}

          {!studyParticipantCode && showJoinStudyForm && (
            <div>
              <p style={{ margin: '0 0 10px 0' }}>
                Participation is voluntary. Full details: <code>research/CONSENT_FORM.md</code>. Joining links a
                study participant code to your account; a researcher must separately verify your consent before
                any of your scans count as research data.
              </p>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={studyConsentChecked}
                  onChange={(e) => setStudyConsentChecked(e.target.checked)}
                  style={{ marginTop: '2px' }}
                />
                I have read the study description and voluntarily consent to participate.
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleJoinStudy}
                  disabled={!studyConsentChecked || joiningStudy}
                  className="btn-secondary"
                  style={{ padding: '5px 12px', fontSize: '11px' }}
                >
                  {joiningStudy ? 'Joining…' : 'Confirm & Join'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowJoinStudyForm(false); setStudyError(null); }}
                  className="btn-secondary"
                  style={{ padding: '5px 12px', fontSize: '11px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {studyParticipantCode && studyResearchStatus === 'ASSIGNED' && (
            <span>
              🔬 Participant: <strong>{studyParticipantCode}</strong> · Consent verification: Pending · Scans are not yet included in research analysis.
            </span>
          )}

          {studyParticipantCode && studyResearchStatus === 'CONSENT_VERIFIED' && (
            <span>
              ✅ Participant: <strong>{studyParticipantCode}</strong> · Research status: Verified · New scans are eligible research observations.
            </span>
          )}

          {studyParticipantCode && studyResearchStatus === 'REVOKED' && (
            <span>⛔ Research participation revoked · New scans excluded.</span>
          )}

          {studyError && (
            <div role="alert" style={{ marginTop: '8px', color: '#b91c1c' }}>⚠️ {studyError}</div>
          )}
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="insp-grid">

        {/* LEFT — Editor */}
        <div className="insp-panel">

          {/* Editor header */}
          <div className="insp-panel-header">
            <div className="insp-panel-title">
              <span aria-hidden="true">📝</span>
              <span>Source Code Editor</span>
              <span className="insp-chip" style={{ ['--chip-color' as any]: '#3b82f6', ['--chip-bg' as any]: 'rgba(59, 130, 246, 0.1)', ['--chip-border' as any]: 'rgba(59, 130, 246, 0.25)' }}>
                Interactive
              </span>
            </div>

            {/* Sample presets */}
            <div className="insp-toolbar">
              <span className="insp-toolbar-label">Try Sample:</span>
              {[
                { label: 'Next.js', code: SAMPLE_NEXTJS_CODE, file: 'DashboardPage.tsx', color: 'rgba(0, 0, 0, 0.82)' },
                { label: 'React', code: SAMPLE_REACT_CODE, file: 'UserProfile.jsx', color: '#1d4ed8' },
                { label: 'Angular', code: SAMPLE_ANGULAR_CODE, file: 'SearchPanel.component.ts', color: '#1d4ed8' },
                { label: 'Vue', code: SAMPLE_VUE_CODE, file: 'UserProfile.vue', color: '#1d4ed8' },
              ].map((p) => (
                <button
                  key={p.label}
                  onClick={() => loadPreset(p.code, p.file)}
                  className="insp-tab-btn"
                  style={{ color: p.color }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* File name + real local-file upload (single file feeds the editor below; 2+ files
              switch to the batch results panel further down) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>File Name:</span>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="input-field font-mono"
              style={{ flex: 1, padding: '5px 10px', fontSize: '12px' }}
              placeholder="e.g. MyComponent.tsx"
              aria-label="File name"
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".js,.jsx,.ts,.tsx,.vue,.mjs,.cjs"
              onChange={(e) => {
                handleFileUpload(e.target.files);
                e.target.value = '';
              }}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary"
              style={{ padding: '5px 12px', fontSize: '11px', whiteSpace: 'nowrap' }}
              title="Upload one file to load it into the editor, or several files to scan them as a batch"
            >
              📁 Upload File(s)
            </button>
          </div>

          {uploadError && (
            <div role="alert" className="insp-notice" style={{ color: '#1d4ed8', background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.25)' }}>
              ⚠️ {uploadError}
            </div>
          )}

          {batchFiles && (
            <div className="insp-notice" style={{ color: '#1d4ed8', background: 'rgba(96, 165, 250, 0.08)', borderColor: 'rgba(96, 165, 250, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📦 Batch mode: {batchFiles.length} files uploaded — see results below.</span>
              <button
                type="button"
                onClick={() => {
                  setBatchFiles(null);
                  setBatchResults({});
                }}
                style={{ background: 'none', border: 'none', color: '#1d4ed8', cursor: 'pointer', fontWeight: 700, fontSize: '11px' }}
              >
                Exit batch mode ✕
              </button>
            </div>
          )}

          {/* Monaco editor */}
          <div className="insp-editor-frame">
            <div className="insp-editor-tab-strip">
              <span>{fileName || 'untitled'}</span>
              <span>UTF-8</span>
            </div>
            <Editor
              height="520px"
              // `path` gives Monaco's TypeScript worker a real filename suffix to key its
              // ScriptKind detection off of (see node_modules/monaco-editor's tsWorker.js
              // `getScriptKind`, which switches on the model URI's file suffix, not the
              // `language` id below -- Monaco only ever registers a single "typescript" language
              // for BOTH .ts and .tsx, there is no separate "typescriptreact" id). Without a real
              // path, the default in-memory model URI has no matching suffix, so the worker falls
              // back to plain ScriptKind.TS -- which does not permit JSX syntax -- and flags
              // ordinary JSX as a real syntax error.
              //
              // This is deliberately a small fixed bucket keyed off the extension, NOT the raw
              // `fileName` state -- `fileName` is bound to a free-text input the user can type
              // into on every keystroke (see the "File Name" field above), and @monaco-editor/react
              // creates (and never disposes) one Monaco model per distinct `path` it's given, so
              // using the literal fileName here would leak a new model on every keystroke. Bucketing
              // by extension keeps the same handful of stable model identities while still giving
              // the worker the correct suffix for ScriptKind/coloring.
              path={
                fileName.endsWith('.tsx')
                  ? 'model.tsx'
                  : fileName.endsWith('.ts')
                    ? 'model.ts'
                    : fileName.endsWith('.vue')
                      ? 'model.vue'
                      : fileName.endsWith('.jsx')
                        ? 'model.jsx'
                        : 'model.js'
              }
              language={
                fileName.endsWith('.ts') || fileName.endsWith('.tsx')
                  ? 'typescript'
                  : fileName.endsWith('.vue')
                    ? 'html'
                    : 'javascript'
              }
              theme="vs-dark"
              value={code}
              onChange={handleCodeChange}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                lineNumbers: 'on',
                glyphMargin: true,
                // Monaco renders its own internal hidden textarea as the actual focusable/editable
                // element -- a wrapping <div aria-label> has no effect on it. `ariaLabel` is
                // Monaco's own supported option for naming that element for screen readers; without
                // it, a keyboard/screen-reader user tabbing into the editor gets no accessible name
                // at all. Keyboard interaction (typing, navigation, Monaco's own command palette,
                // etc.) is unaffected -- this only adds the missing name.
                ariaLabel: 'Source code editor: paste or edit the code you want FIGM to scan',
              }}
            />
          </div>

          {/* Manual scan button */}
          <button
            onClick={() => handleScan()}
            disabled={scanning}
            className="btn-primary"
            style={{ padding: '11px', width: '100%', fontSize: '13px' }}
          >
            {scanning ? '🔄 Scanning Your Code…' : '🚀 Check My Code Now'}
          </button>

          {/* Scan error */}
          {scanError && (
            <div role="alert" className="insp-notice" style={{ color: '#1d4ed8', background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }}>
              ⚠️ {scanError}
            </div>
          )}

          {/* Scan SERVICE error -- deliberately distinct styling/label from scanError above: this
              means the analysis engine itself failed, not that your code has a problem. See
              ScanServiceStatus in app/api/scan/route.ts. */}
          {serviceError && (
            <div role="alert" className="insp-notice" style={{ color: '#1d4ed8', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.35)' }}>
              <strong>🛠️ Scan Service Error:</strong> {serviceError}
            </div>
          )}
        </div>

        {/* RIGHT — Results */}
        <div className="insp-panel">

          {/* Panel header */}
          <div className="insp-panel-header">
            <div className="insp-panel-title">
              <span aria-hidden="true">🔎</span>
              <span>Inspection Results</span>
            </div>
            {result && (
              <span className="insp-chip" style={{ ['--chip-color' as any]: '#60a5fa', ['--chip-bg' as any]: 'rgba(59, 130, 246, 0.1)', ['--chip-border' as any]: 'rgba(59, 130, 246, 0.25)', fontFamily: 'var(--insp-mono)' }}>
                {result.framework}
              </span>
            )}
          </div>

          {/* Empty / loading / results -- a single aria-live region wrapping all three states so a
              screen reader announces "Analyzing…" when a scan starts and the resulting summary
              when it finishes, without stacking a separate live region per state. */}
          <div aria-live="polite" aria-atomic="false" style={{ display: 'contents' }}>
            {!result && !scanning ? (
              <div className="insp-empty-state">
                <div className="insp-empty-icon" aria-hidden="true">💡</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Paste your code in the editor
                </div>
                <div style={{ fontSize: '12px', marginTop: '6px' }}>
                  FIGM will automatically scan it and show real violations from your code
                </div>
              </div>
            ) : scanning ? (
              <div className="insp-empty-state">
                <div className="insp-empty-icon" aria-hidden="true">🔍</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                  Analyzing Code…
                </div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  Running all {TOTAL_RULE_COUNT} FIGM guideline rules against your code
                </div>
              </div>
            ) : result && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {/* Code Health Overview (Step 9): real metrics only, no invented figures. */}
                <div className="insp-metric-row" style={{ ['--insp-cols' as any]: 4 }}>
                  {[
                    { label: 'Quality Score', value: `${result.qualityScore ?? 100}`, color: scoreColor(result.qualityScore ?? 100) },
                    { label: 'Total Issues', value: `${figmRuleCount + generalCodeErrorCount}`, color: figmRuleCount + generalCodeErrorCount > 0 ? '#ef4444' : 'var(--status-ok)' },
                    { label: 'Rules Checked', value: `${TOTAL_RULE_COUNT}`, color: 'var(--text-muted)' },
                    { label: 'Complexity', value: `v(G)=${result.complexity?.cyclomaticComplexity ?? 1}`, color: '#1d4ed8' },
                  ].map((m) => (
                    <div key={m.label} className="insp-metric-tile">
                      <div className="insp-metric-label">{m.label}</div>
                      <div className="insp-metric-value" style={{ color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Severity breakdown -- a display-only aggregation of the already-returned
                    per-diagnostic `severity` field (see severityCounts above), same source of
                    truth the violation cards below use, never a separate/derived detection pass. */}
                <div className="insp-metric-row" style={{ ['--insp-cols' as any]: 4 }}>
                  {[
                    { label: 'Critical', value: severityCounts.CRITICAL, color: 'var(--sev-critical)' },
                    { label: 'High', value: severityCounts.HIGH, color: 'var(--sev-high)' },
                    { label: 'Medium', value: severityCounts.MEDIUM, color: 'var(--sev-medium)' },
                    { label: 'Low', value: severityCounts.LOW, color: 'var(--sev-low)' },
                  ].map((m) => (
                    <div key={m.label} className="insp-metric-tile">
                      <div className="insp-metric-label">{m.label}</div>
                      <div className="insp-metric-value" style={{ color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Research domain breakdown -- the canonical Architecture / Static Performance /
                  Accessibility split (primaryResearchDomain(), see domainCounts above), computed
                  from FIGM rule violations only (general code errors excluded -- they have no
                  domain classification of their own). This is the tool's actual finding taxonomy;
                  it must never be collapsed back into the older 2-domain PERF/A11Y grouping. */}
                <div className="insp-metric-row" style={{ ['--insp-cols' as any]: 3 }}>
                  {[
                    { label: '🏗️ Architecture', value: domainCounts.ARCHITECTURE, color: '#1d4ed8' },
                    { label: '⚡ Static Performance', value: domainCounts.STATIC_PERFORMANCE, color: '#1d4ed8' },
                    { label: '♿ Accessibility', value: domainCounts.ACCESSIBILITY, color: '#1d4ed8' },
                  ].map((m) => (
                    <div key={m.label} className="insp-metric-tile">
                      <div className="insp-metric-label">{m.label}</div>
                      <div className="insp-metric-value" style={{ color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Engine Diagnostics (Stage 5A audit) -- real, auditable measurements of FIGM's
                  OWN analysis execution: a real perf.now() elapsed-time delta and a real
                  process.memoryUsage() heap delta, with no synthetic formula layered on top (see
                  src/engine/dynamic-profiler.ts's buildProfileMetrics doc comment for the
                  fabrication this replaced) and no hardcoded fallback if a value happens to be
                  falsy. This describes the analysis TOOL's own execution, never the scanned
                  application's runtime performance -- FCP/TTI/Web Vitals are not measured by a
                  static scan; see /performance and the explicit note below. Visually secondary/
                  smaller than the domain and severity tiles above, which describe the actual
                  findings in the scanned code. */}
                {(() => {
                  const badge = result.analysis?.figmStatus ? scanEngineStatusBadge(result.analysis.figmStatus) : null;
                  const badgeToneColors: Record<string, { fg: string; bg: string; border: string }> = {
                    success: { fg: '#60a5fa', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.28)' },
                    warning: { fg: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.28)' },
                    danger: { fg: '#fca5a5', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.28)' },
                    neutral: { fg: 'var(--text-dim)', bg: 'var(--insp-panel-bg)', border: 'var(--insp-border-strong)' },
                  };
                  const tone = badgeToneColors[badge?.tone || 'neutral'];
                  const metrics = [
                    { key: 'duration', label: 'Scan Duration', value: result.profile?.executionTimeMs != null ? formatScanDuration(result.profile.executionTimeMs) : 'Unavailable', Icon: Clock },
                    { key: 'memory', label: 'Engine Memory Delta', value: formatMemoryDelta(result.profile?.peakMemoryMb ?? null), Icon: MemoryStick },
                    { key: 'units', label: 'Source Units', value: '1', Icon: FileCode },
                    { key: 'rules', label: 'Rules Evaluated', value: String(TOTAL_RULE_COUNT), Icon: ListChecks },
                  ];
                  return (
                    <div
                      className="insp-notice"
                      style={{ background: 'var(--insp-panel-bg-alt)', border: '1px solid var(--insp-border)', borderRadius: 'var(--insp-radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Engine Diagnostics</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>FIGM analysis execution metrics</div>
                        </div>
                        {badge && result.analysis?.figmStatus && (
                          <span
                            title={formatScanEngineStatus(result.analysis.figmStatus)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: tone.fg, background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: '999px', padding: '4px 10px' }}
                          >
                            {badge.tone === 'success' ? <CheckCircle2 size={12} /> : badge.tone === 'danger' ? <AlertCircle size={12} /> : <AlertTriangle size={12} />}
                            {badge.label}
                          </span>
                        )}
                      </div>

                      <div className="insp-diag-grid">
                        {metrics.map((m) => (
                          <div key={m.key} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <m.Icon size={15} style={{ color: 'var(--text-dim)', marginTop: '3px', flexShrink: 0 }} aria-hidden="true" />
                            <div>
                              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{m.label}</div>
                              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>{m.value}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {result.profile?.profilerStatus === 'UNAVAILABLE' && (
                        <div
                          role="status"
                          style={{ fontSize: '11px', color: '#1d4ed8', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '6px', padding: '8px 10px' }}
                        >
                          Dynamic profiler unavailable in this environment this run -- static findings
                          above are unaffected and complete; only this scan&apos;s Engine Memory Delta
                          reading reflects a sandboxed-execution attempt that could not run.
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                            Measures FIGM&apos;s analysis execution only -- not runtime performance of the scanned application.
                          </span>
                          <button
                            type="button"
                            onClick={() => setDiagnosticsHelpOpen((v) => !v)}
                            aria-expanded={diagnosticsHelpOpen}
                            aria-controls="engine-diagnostics-help"
                            aria-label="What do these metrics mean?"
                            title="What do these metrics mean?"
                            style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-dim)', display: 'inline-flex', flexShrink: 0 }}
                          >
                            <HelpCircle size={13} />
                          </button>
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>
                          Runtime performance →{' '}
                          <Link href="/performance" style={{ color: '#1d4ed8' }}>Static Analysis Timing</Link>
                          {' / '}RQ1 FCP-TTI experiment
                        </div>
                        {diagnosticsHelpOpen && (
                          <div id="engine-diagnostics-help" style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6, background: 'var(--insp-panel-bg)', border: '1px solid var(--insp-border)', borderRadius: 'var(--insp-radius-sm)', padding: '10px 12px', marginTop: '2px' }}>
                            <div><strong style={{ color: 'var(--text-main)' }}>Scan Duration</strong> -- time FIGM spent analyzing the submitted source.</div>
                            <div><strong style={{ color: 'var(--text-main)' }}>Engine Memory Delta</strong> -- change in FIGM&apos;s process heap during the analysis window.</div>
                            <div><strong style={{ color: 'var(--text-main)' }}>Source Units</strong> -- number of source units analyzed in this scan.</div>
                            <div><strong style={{ color: 'var(--text-main)' }}>Rules Evaluated</strong> -- all {TOTAL_RULE_COUNT} canonical FIGM rule-checks are run against every parsed node of this source; framework-specific rules execute but can only match when this file&apos;s framework and AST shape satisfy their condition.</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Summary row */}
                <div className="insp-notice" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-dim)', background: 'var(--insp-panel-bg-alt)' }}>
                  <span>
                    Framework:{' '}
                    <strong style={{ color: '#1d4ed8' }}>{result.framework}</strong>
                  </span>
                  <span>
                    ALPs extracted:{' '}
                    <strong style={{ color: '#1d4ed8' }}>{result.extractedALPsCount}</strong>
                  </span>
                  <span>
                    Issues:{' '}
                    <strong style={{ color: result.diagnostics.length > 0 ? '#ef4444' : '#3b82f6' }}>
                      {result.diagnostics.length}
                    </strong>
                  </span>
                </div>

                {/* Two-system summary — server-authoritative counts (RuleExecutionEngine.buildScanResult),
                  never re-derived here from ruleId string-matching. The two systems are never merged
                  into one combined "Problems" figure below; this total is only ever an additional sum. */}
                <div className="insp-metric-row" style={{ ['--insp-cols' as any]: 3 }}>
                  {[
                    { label: 'FIGM Rule Violations', value: figmRuleCount, color: '#1d4ed8' },
                    { label: 'General Code Errors', value: generalCodeErrorCount, color: '#b91c1c' },
                    { label: 'Total Issues', value: figmRuleCount + generalCodeErrorCount, color: 'var(--text-main)' },
                  ].map((s) => (
                    <div key={s.label} className="insp-metric-tile">
                      <div className="insp-metric-label">{s.label}</div>
                      <div className="insp-metric-value" style={{ color: s.color, fontSize: '17px' }}>
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Honest analysis-completeness notice -- never silently implies a full FIGM sweep
                  occurred when parsing only partially recovered (or couldn't recover at all).
                  UNSUPPORTED_FRAMEWORK is excluded here -- the dedicated "Not Yet Supported"
                  banner below already covers that case more specifically; showing both would be a
                  confusing duplicate warning for the same underlying fact. */}
                {result.analysis && result.analysis.figmStatus !== 'COMPLETE' && result.analysis.figmStatus !== 'UNSUPPORTED_FRAMEWORK' && (
                  <div role="status" className="insp-notice" style={{ color: '#1d4ed8', background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
                    ⚠️ FIGM analysis is <strong>{result.analysis.figmStatus}</strong>
                    {result.analysis.figmStatus === 'BLOCKED'
                      ? ' — the source could not be parsed into a syntax tree at all, so no FIGM rules were evaluated.'
                      : ' — the source has real parse errors, so FIGM findings below reflect only what the parser could recover, not a guarantee the rest of the file is clean.'}
                  </div>
                )}

                {/* Scan-service PERSISTENCE note -- the scan itself succeeded (everything above this
                  point is real and complete); only the automatic background save to this
                  account's history failed. Deliberately a small inline note, not a blocking
                  banner, since it doesn't affect anything the user is looking at right now. */}
                {result?.serviceStatus?.stage === 'PERSISTENCE' && (
                  <div role="status" className="insp-notice" style={{ color: '#1d4ed8', background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
                    🛠️ Scan Service Notice: {result.serviceStatus.message}
                  </div>
                )}

                {/* Save to history */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button
                    onClick={handleSaveToHistory}
                    disabled={savingToHistory}
                    className="btn-secondary"
                    style={{
                      padding: '8px',
                      fontSize: '12px',
                      opacity: savingToHistory ? 0.6 : 1,
                    }}
                  >
                    {savingToHistory ? '💾 Saving…' : '💾 Save to History'}
                  </button>
                  {saveHistoryStatus && (
                    <div
                      role="status"
                      style={{
                        fontSize: '11px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        color: saveHistoryStatus.kind === 'success' ? '#60a5fa' : saveHistoryStatus.kind === 'auth' ? '#ef4444' : '#f87171',
                        background: saveHistoryStatus.kind === 'success' ? 'rgba(59, 130, 246, 0.1)' : saveHistoryStatus.kind === 'auth' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239,68,68,0.1)',
                      }}
                    >
                      {saveHistoryStatus.message}
                      {saveHistoryStatus.kind === 'auth' && (
                        <>
                          {' '}
                          <Link href="/auth/login" style={{ color: '#1d4ed8', fontWeight: 700 }}>Log in</Link>
                        </>
                      )}
                      {saveHistoryStatus.kind === 'success' && (
                        <>
                          {' '}
                          <Link href="/history" style={{ color: '#1d4ed8', fontWeight: 700, textDecoration: 'underline' }}>View history →</Link>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Diagnostics — two completely separate systems, never merged into one combined
                  "Problems" section. See MANDATORY TWO-FIX-SYSTEM ARCHITECTURE: System A (FIGM
                  Rule Violations) below is scoped to exactly the 25 canonical FIGM rule IDs;
                  System B (General Code Errors) is scoped to every other genuine syntax/compiler/
                  parser diagnostic. Both derive from the server's authoritative `kind` field
                  (figmViolations/generalCodeErrors above), not from ruleId string-matching here. */}
                {result.analysis?.figmStatus === 'UNSUPPORTED_FRAMEWORK' ? (
                  // A zero-violation result for a framework FIGM does not analyze at all must
                  // never be presented as "your code is clean" -- that would misrepresent an
                  // "unchecked" result as a "passed" one. See Task requirement: handle
                  // unsupported frameworks gracefully, without implying a check occurred. Driven
                  // by the server-authoritative figmStatus field (Phase 2), not a client-guessed
                  // framework set.
                  <div className="insp-notice" style={{ padding: '24px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }}>
                    <div style={{ fontSize: '26px', marginBottom: '6px' }}>⚠️</div>
                    <strong style={{ color: '#1d4ed8', fontSize: '14px' }}>
                      &quot;{result.framework}&quot; Is Not Yet Supported
                    </strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      FIGM detected this framework but does not yet run any guideline rules against
                      it. This is <strong>not</strong> a &quot;no issues found&quot; result — no analysis was
                      performed. Supported frameworks: React, Next.js, Angular, Vue, and plain
                      JS/TS.
                    </div>
                  </div>
                ) : figmRuleCount + generalCodeErrorCount === 0 ? (
                  // Combined celebratory state ONLY when BOTH systems are clean — an additional
                  // summary, never a substitute for the two independent sections below.
                  <div className="insp-notice" style={{ padding: '24px', textAlign: 'center', background: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.25)' }}>
                    <div style={{ fontSize: '26px', marginBottom: '6px' }}>🎉</div>
                    <strong style={{ color: '#1d4ed8', fontSize: '14px' }}>No Issues Found!</strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Your code meets all 50 FIGM rules, and no general code/compiler errors were detected.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

                    {/* ================= SYSTEM A: FIGM RULE VIOLATIONS ================= */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                          🔬 FIGM Rule Violations
                        </span>
                        <span className="insp-chip" style={{ ['--chip-color' as any]: figmRuleCount > 0 ? '#3b82f6' : '#3b82f6', ['--chip-bg' as any]: 'rgba(59, 130, 246, 0.1)', ['--chip-border' as any]: 'rgba(59, 130, 246, 0.3)' }}>
                          {figmRuleCount} finding{figmRuleCount === 1 ? '' : 's'}
                        </span>
                      </div>

                      {figmRuleCount === 0 ? (
                        <div className="insp-notice" style={{ background: 'rgba(59, 130, 246, 0.06)', borderColor: 'rgba(59, 130, 246, 0.2)', color: '#1d4ed8' }}>
                          ✅ No violations of any of the 50 canonical FIGM rules.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
                          {figmViolations.map((d, idx) => {
                            const fixKey = d.ruleId + '_' + d.location.start.line;
                            const fixResult = fixResults[fixKey];
                            const isFixing = fixingId === fixKey;
                            const color = SEV_COLOR[d.severity] ?? 'rgba(0, 0, 0, 0.6)';
                            const bg = SEV_BG[d.severity] ?? 'rgba(0, 0, 0, 0.08)';
                            const statusMeta = fixResult ? FIX_STATUS_META[fixResult.status] : null;
                            const fixability = d.fixabilityStatus ? FIXABILITY_META[d.fixabilityStatus] : null;
                            const line = d.location?.start?.line && d.location.start.line > 0 ? d.location.start.line : 1;
                            const column = d.location?.start?.column;
                            const endLine = d.location?.end?.line;
                            const endColumn = d.location?.end?.column;
                            const cardAccent = fixResult ? (fixResult.verified ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.6)') : color;

                            return (
                              <div
                                key={idx}
                                className="insp-card"
                                style={{ ['--card-accent' as any]: cardAccent }}
                              >
                                {/* Violation header */}
                                <div className="insp-card-row">
                                  <div className="insp-card-chips">
                                    <span className="insp-chip" style={{ ['--chip-color' as any]: color, ['--chip-bg' as any]: bg, ['--chip-border' as any]: `${color}44` }}>
                                      {d.severity}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        color: '#1d4ed8',
                                        fontFamily: 'var(--insp-mono)',
                                        fontWeight: 700,
                                      }}
                                    >
                                      {d.ruleId}
                                    </span>
                                    <span
                                      className="insp-chip"
                                      style={{ ['--chip-color' as any]: 'rgba(0, 0, 0, 0.7)', ['--chip-bg' as any]: 'rgba(0, 0, 0, 0.1)', ['--chip-border' as any]: 'rgba(0, 0, 0, 0.3)' }}
                                    >
                                      {RESEARCH_DOMAIN_CHIP[primaryResearchDomain(d.domain, d.concern)]}
                                    </span>
                                    {d.sourceKind && (
                                      <span
                                        title={
                                          d.sourceKind === 'REAL_AST'
                                            ? 'Detected via genuine TypeScript-compiler AST traversal'
                                            : 'Detected via text/regex pattern matching (not yet AST-migrated for this framework)'
                                        }
                                        className="insp-chip"
                                        style={{
                                          ['--chip-color' as any]: d.sourceKind === 'REAL_AST' ? '#3b82f6' : 'rgba(0, 0, 0, 0.7)',
                                          ['--chip-bg' as any]: d.sourceKind === 'REAL_AST' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                                          ['--chip-border' as any]: d.sourceKind === 'REAL_AST' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                                        }}
                                      >
                                        {d.sourceKind === 'REAL_AST' ? '🌳 AST' : '📝 pattern'}
                                      </span>
                                    )}
                                    {fixability && (
                                      <span
                                        title="Pre-attempt fixability classification"
                                        className="insp-chip"
                                        style={{ ['--chip-color' as any]: fixability.color, ['--chip-bg' as any]: fixability.bg, ['--chip-border' as any]: `${fixability.color}55` }}
                                      >
                                        {fixability.label}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <a
                                      href={`/guidelines#${d.ruleId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="insp-link-btn"
                                      style={{ ['--chip-color' as any]: '#3b82f6', ['--chip-bg' as any]: 'rgba(59, 130, 246, 0.08)', ['--chip-border' as any]: 'rgba(59, 130, 246, 0.25)' }}
                                    >
                                      📖 Rule Guide
                                    </a>
                                    <button
                                      onClick={() => jumpToLine(line)}
                                      className="insp-link-btn"
                                    >
                                      📍 Go to Line {line}
                                      {column != null ? `:${column}` : ''} →
                                    </button>
                                  </div>
                                </div>

                                {/* Rule name */}
                                <div className="insp-card-title">
                                  {d.ruleName}
                                </div>

                                {/* Source range + standard reference */}
                                <div className="insp-card-location">
                                  <span>
                                    Location: L{line}
                                    {column != null ? `:C${column}` : ''}
                                    {endLine ? ` → L${endLine}${endColumn != null ? `:C${endColumn}` : ''}` : ''}
                                  </span>
                                  {d.standardReference && <span>Ref: {d.standardReference}</span>}
                                </div>

                                {/* Offending code snippet */}
                                <pre className="insp-card-snippet">
                                  <code>{d.offendingCodeSnippet}</code>
                                </pre>

                                {/* Evidence (what the detector actually matched) */}
                                {d.evidence && (
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    🔍 <strong>Evidence:</strong> {d.evidence}
                                  </div>
                                )}

                                {/* Explanation */}
                                <div className="insp-card-body">
                                  {d.message}
                                </div>

                                {/* How-to-fix hint */}
                                <div className="insp-card-remediation">
                                  💡 <strong>How to Fix:</strong> {d.remediation}
                                </div>

                                {/* Fix outcome -- always reflects what the real engine actually verified,
                            never a blanket "Fixed" independent of that verification. */}
                                {fixResult && statusMeta && (
                                  <div className="insp-fix-outcome">
                                    <div
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        color: statusMeta.color,
                                        display: 'flex',
                                        gap: '8px',
                                        alignItems: 'center',
                                      }}
                                    >
                                      <span>
                                        {PIPELINE_LABEL[fixResult.pipeline]} {statusMeta.icon} {statusMeta.label}
                                        {fixResult.verified ? ` (by ${fixResult.engine})` : ''}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                                      {statusMeta.detail}
                                    </div>
                                    {fixResult.description && (
                                      <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                                        {fixResult.description}
                                      </div>
                                    )}
                                    {fixResult.fallbackReason && (
                                      <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                                        ({fixResult.fallbackReason})
                                      </div>
                                    )}
                                    <DiffView before={fixResult.beforeCode} after={fixResult.afterCode} />
                                  </div>
                                )}

                                {/* Fix button -- offered again after a non-FIXED outcome so the user can
                            retry (e.g. after manually adjusting the code) rather than getting
                            permanently stuck once one attempt didn't verify. */}
                                {(!fixResult || !fixResult.verified) && (
                                  <button
                                    onClick={() => applyFigmFix(d)}
                                    disabled={isFixing || !!fixingId || fixability?.disabled}
                                    className="insp-fix-btn"
                                    style={{
                                      ['--chip-border' as any]: fixability?.disabled ? 'rgba(59, 130, 246, 0.35)' : 'rgba(59, 130, 246, 0.35)',
                                      ['--chip-bg' as any]: isFixing
                                        ? 'rgba(234,179,8,0.1)'
                                        : fixability?.disabled
                                          ? 'rgba(234,179,8,0.08)'
                                          : 'rgba(34,197,94,0.12)',
                                      ['--chip-color' as any]: isFixing ? '#3b82f6' : fixability?.disabled ? '#3b82f6' : '#3b82f6',
                                      cursor: isFixing ? 'wait' : fixability?.disabled ? 'not-allowed' : 'pointer',
                                    }}
                                  >
                                    {isFixing
                                      ? '⏳ Applying & Verifying FIGM Fix…'
                                      : fixResult
                                        ? '🔁 Retry FIGM Fix'
                                        : fixability
                                          ? fixability.buttonLabel
                                          : '✨ Fix FIGM Rule'}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* ================= SYSTEM B: GENERAL CODE ERRORS ================= */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                          🧰 General Code Errors
                        </span>
                        <span className="insp-chip" style={{ ['--chip-color' as any]: generalCodeErrorCount > 0 ? '#ef4444' : '#3b82f6', ['--chip-bg' as any]: 'rgba(239, 68, 68, 0.1)', ['--chip-border' as any]: 'rgba(239, 68, 68, 0.3)' }}>
                          {generalCodeErrorCount} error{generalCodeErrorCount === 1 ? '' : 's'}
                        </span>
                      </div>

                      {generalCodeErrorCount === 0 ? (
                        <div className="insp-notice" style={{ background: 'rgba(59, 130, 246, 0.06)', borderColor: 'rgba(59, 130, 246, 0.2)', color: '#1d4ed8' }}>
                          ✅ No syntax, TypeScript, or other compiler/parser errors detected.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
                          {generalCodeErrors.map((d, idx) => {
                            const fixKey = d.ruleId + '_' + d.location.start.line;
                            const fixResult = fixResults[fixKey];
                            const isFixing = fixingId === fixKey;
                            const color = SEV_COLOR[d.severity] ?? 'rgba(0, 0, 0, 0.6)';
                            const bg = SEV_BG[d.severity] ?? 'rgba(0, 0, 0, 0.08)';
                            const statusMeta = fixResult ? GENERAL_ERROR_FIX_STATUS_META[fixResult.status] : null;
                            const line = d.location?.start?.line && d.location.start.line > 0 ? d.location.start.line : 1;
                            const column = d.location?.start?.column;
                            const fixability = d.fixabilityStatus ? FIXABILITY_META[d.fixabilityStatus] : null;
                            const cardAccent = fixResult ? (fixResult.verified ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.6)') : color;

                            return (
                              <div
                                key={idx}
                                className="insp-card"
                                style={{ ['--card-accent' as any]: cardAccent }}
                              >
                                {/* Error header: compiler diagnostic code + category + severity */}
                                <div className="insp-card-row">
                                  <div className="insp-card-chips">
                                    <span className="insp-chip" style={{ ['--chip-color' as any]: color, ['--chip-bg' as any]: bg, ['--chip-border' as any]: `${color}44` }}>
                                      {d.severity}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#1d4ed8', fontFamily: 'var(--insp-mono)', fontWeight: 700 }}>
                                      {d.compilerCode || d.ruleId}
                                    </span>
                                    <span className="insp-chip">
                                      {d.ruleId === 'SYNTAX-PARSE-ERROR' ? 'SYNTAX_ERROR' : 'TYPE_COMPILE_ERROR'}
                                    </span>
                                    {fixability && (
                                      <span
                                        title="Pre-attempt fixability classification"
                                        className="insp-chip"
                                        style={{ ['--chip-color' as any]: fixability.color, ['--chip-bg' as any]: fixability.bg, ['--chip-border' as any]: `${fixability.color}55` }}
                                      >
                                        {fixability.label}
                                      </span>
                                    )}
                                  </div>
                                  <button onClick={() => jumpToLine(line)} className="insp-link-btn">
                                    📍 Go to Line {line}
                                    {column != null ? `:${column}` : ''} →
                                  </button>
                                </div>

                                {/* Actual compiler/parser message -- never disguised as a FIGM rule name. */}
                                <div className="insp-card-title">
                                  {d.message}
                                </div>

                                <div className="insp-card-location">
                                  Location: L{line}{column != null ? `:C${column}` : ''}
                                </div>

                                {/* Offending code snippet */}
                                <pre className="insp-card-snippet">
                                  <code>{d.offendingCodeSnippet}</code>
                                </pre>

                                {/* Fix outcome */}
                                {fixResult && statusMeta && (
                                  <div className="insp-fix-outcome">
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: statusMeta.color, display: 'flex', gap: '8px', alignItems: 'center' }}>
                                      <span>
                                        {PIPELINE_LABEL[fixResult.pipeline]} {statusMeta.icon} {statusMeta.label}
                                        {fixResult.verified ? ` (by ${fixResult.engine})` : ''}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>{statusMeta.detail}</div>
                                    {fixResult.description && <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{fixResult.description}</div>}
                                    {fixResult.fallbackReason && <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontStyle: 'italic' }}>({fixResult.fallbackReason})</div>}
                                    <DiffView before={fixResult.beforeCode} after={fixResult.afterCode} />
                                  </div>
                                )}

                                {/* Fix button -- label/enabled state driven by the pre-attempt
                                  fixabilityStatus (see FIXABILITY_META): NO_SAFE_FIX never renders
                                  an enabled button (nothing to show), and SUGGESTED_FIX_ONLY's
                                  button only ever previews a candidate -- the server-side guard in
                                  AIRemediationPipeline.remediateDefect makes it structurally
                                  impossible for that case to come back verified/auto-applied. */}
                                {(!fixResult || !fixResult.verified) && (
                                  <button
                                    onClick={() => applyCodeErrorFix(d)}
                                    disabled={isFixing || !!fixingId || fixability?.disabled}
                                    className="insp-fix-btn"
                                    style={{
                                      ['--chip-border' as any]: fixability?.disabled ? 'rgba(59, 130, 246, 0.35)' : 'rgba(59, 130, 246, 0.35)',
                                      ['--chip-bg' as any]: isFixing ? 'rgba(59, 130, 246, 0.1)' : fixability?.disabled ? 'rgba(59, 130, 246, 0.08)' : 'rgba(59, 130, 246, 0.12)',
                                      ['--chip-color' as any]: isFixing ? '#3b82f6' : fixability?.disabled ? '#3b82f6' : '#60a5fa',
                                      cursor: isFixing ? 'wait' : fixability?.disabled ? 'not-allowed' : 'pointer',
                                    }}
                                  >
                                    {isFixing
                                      ? '⏳ Applying & Verifying…'
                                      : fixResult
                                        ? '🔁 Retry'
                                        : fixability
                                          ? fixability.buttonLabel
                                          : '🛠️ Fix Code Error'}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Batch upload results -- one card per uploaded file, each independently scanned via the
          same real /api/scan endpoint the single-file editor above uses. Deliberately simpler than
          the single-file panel (no jump-to-line/apply-fix/diff view): those all assume one live
          Monaco editor instance to act on, which doesn't exist for N independently-uploaded files. */}
      {batchFiles && (
        <div className="insp-panel">
          <div className="insp-panel-header">
            <div className="insp-panel-title">
              <span aria-hidden="true">📦</span>
              <span>Batch Scan Results</span>
              <span className="insp-chip">{batchFiles.length} files</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {batchFiles.map((f) => {
              const entry = batchResults[f.fileName];
              const isExpanded = !!batchExpanded[f.fileName];
              return (
                <div key={f.fileName} className="insp-editor-frame">
                  <button
                    type="button"
                    onClick={() => setBatchExpanded((prev) => ({ ...prev, [f.fileName]: !prev[f.fileName] }))}
                    aria-expanded={isExpanded}
                    disabled={!entry || entry.status === 'scanning'}
                    className="insp-editor-tab-strip"
                    style={{
                      width: '100%',
                      border: 'none',
                      cursor: entry && entry.status !== 'scanning' ? 'pointer' : 'default',
                      color: 'var(--text-main)',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--insp-mono)' }}>{f.fileName}</span>
                    {!entry || entry.status === 'scanning' ? (
                      <span className="insp-status is-scanning">
                        <span className="insp-status-dot" aria-hidden="true" />
                        Scanning…
                      </span>
                    ) : entry.status === 'error' ? (
                      <span className="insp-chip" style={{ ['--chip-color' as any]: '#fca5a5', ['--chip-bg' as any]: 'rgba(239,68,68,0.1)', ['--chip-border' as any]: 'rgba(239,68,68,0.3)' }}>
                        ⚠️ {entry.error}
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="insp-chip" style={{ ['--chip-color' as any]: '#60a5fa', ['--chip-bg' as any]: 'rgba(59, 130, 246, 0.1)', ['--chip-border' as any]: 'rgba(59, 130, 246, 0.25)' }}>
                          {entry.result!.framework}
                        </span>
                        <span
                          className="insp-chip"
                          style={
                            entry.result!.diagnostics.length === 0
                              ? { ['--chip-color' as any]: '#3b82f6', ['--chip-bg' as any]: 'rgba(59, 130, 246, 0.1)', ['--chip-border' as any]: 'rgba(59, 130, 246, 0.25)' }
                              : { ['--chip-color' as any]: '#3b82f6', ['--chip-bg' as any]: 'rgba(59, 130, 246, 0.1)', ['--chip-border' as any]: 'rgba(59, 130, 246, 0.3)' }
                          }
                        >
                          {entry.result!.diagnostics.length === 0 ? '🎉 No issues' : `${entry.result!.diagnostics.length} issue${entry.result!.diagnostics.length === 1 ? '' : 's'}`}
                        </span>
                        {typeof entry.result!.qualityScore === 'number' && (
                          <span className="insp-chip">Quality {entry.result!.qualityScore}/100</span>
                        )}
                        <span aria-hidden="true">{isExpanded ? '▲' : '▼'}</span>
                      </span>
                    )}
                  </button>
                  {isExpanded && entry?.status === 'done' && (
                    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {entry.result!.diagnostics.length === 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>No violations found in this file.</div>
                      ) : (
                        entry.result!.diagnostics.map((d, i) => (
                          <div
                            key={`${d.ruleId}_${d.location.start.line}_${i}`}
                            className="insp-card"
                            style={{ ['--card-accent' as any]: SEV_COLOR[d.severity] || SEV_COLOR.LOW, padding: '8px 10px' }}
                          >
                            <div className="insp-card-chips">
                              <span className="insp-chip" style={{ ['--chip-color' as any]: SEV_COLOR[d.severity] || SEV_COLOR.LOW, ['--chip-bg' as any]: SEV_BG[d.severity] || SEV_BG.LOW }}>
                                {d.severity}
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', fontFamily: 'var(--insp-mono)' }}>{d.ruleId}</span>
                              <span className="insp-card-location" style={{ gap: '4px' }}>Line {d.location.start.line}</span>
                            </div>
                            <div className="insp-card-body">{d.message}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom status bar (Step 12) -- only ever surfaces information already computed above;
          introduces no new data source. */}
      <div className="insp-statusbar">
        <div className="insp-statusbar-group">
          <span>FIGM Engine</span>
          <span>50 Rules</span>
          <span>{result ? result.framework : 'TypeScript'}</span>
          <span>UTF-8</span>
        </div>
        <span className={`insp-status${scanning ? ' is-scanning' : figmRuleCount + generalCodeErrorCount > 0 ? ' is-warn' : ''}`}>
          <span className="insp-status-dot" aria-hidden="true" />
          {scanning
            ? 'Analyzing…'
            : !result
              ? 'Ready'
              : figmRuleCount + generalCodeErrorCount > 0
                ? `Issues Found (${figmRuleCount + generalCodeErrorCount})`
                : 'Scan Complete'}
        </span>
      </div>
    </div>
  );
}
