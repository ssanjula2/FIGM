'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { useMonaco, OnMount } from '@monaco-editor/react';
import { RemediationEngine } from '../../src/engine/remediation-engine';

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
}

/** Mirrors AIRemediationPipelineResult (src/ai/ai-remediation-pipeline.ts) -- the client must
 *  never invent its own notion of "fixed" independent of what the server actually verified. */
type VerificationStatus = 'FIXED' | 'PATCH_REJECTED' | 'UNRESOLVED' | 'MANUAL_REVIEW_REQUIRED' | 'VERIFICATION_UNAVAILABLE';

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
}

interface ScanResultResponse {
  filePath: string;
  framework: string;
  totalErrors: number;
  totalWarnings: number;
  extractedALPsCount: number;
  diagnostics: DiagnosticItem[];
  qualityScore?: number;
  profile?: { executionTimeMs: number; peakMemoryMb: number };
  complexity?: {
    cyclomaticComplexity: number;
    complexityRating: string;
    riskRating?: string;
  };
}

// ── Severity colours ────────────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f59e0b',
  MEDIUM: '#38bdf8',
  LOW: '#94a3b8',
};

// Frameworks the real engine detects (for classification) but runs zero FIGM guideline rules
// against -- must never be presented as a "clean scan," since no rule was actually evaluated.
// Mirrors FrameworkType in src/types/ast-spec.ts.
const UNSUPPORTED_FRAMEWORKS = new Set(['SVELTE']);

// Mirrors MAX_CODE_LENGTH in app/api/scan/route.ts -- checked client-side too so an obviously
// oversized paste gets an immediate, specific message instead of a network round-trip that
// ends in a generic error.
const MAX_CODE_LENGTH = 500000;

const SEV_BG: Record<string, string> = {
  CRITICAL: 'rgba(239,68,68,0.12)',
  HIGH: 'rgba(245,158,11,0.12)',
  MEDIUM: 'rgba(56,189,248,0.10)',
  LOW: 'rgba(148,163,184,0.08)',
};

// ── Fix outcome presentation — every label here must match what the real engine actually
// verified via a re-scan (AIRemediationPipeline / RemediationEngine.validatePatch). Never
// present a status here as "fixed" unless `verified === true` backs it.
const FIX_STATUS_META: Record<VerificationStatus, { icon: string; label: string; color: string; detail: string }> = {
  FIXED: {
    icon: '✅',
    label: 'Verified Fixed',
    color: '#86efac',
    detail: 'The patched code was re-scanned with the real FIGM engine and this violation no longer fires.',
  },
  MANUAL_REVIEW_REQUIRED: {
    icon: '⚠️',
    label: 'Manual Review Required',
    color: '#fde68a',
    detail: 'FIGM cannot safely auto-apply this fix (e.g. it would require inferring information like a dependency array). Review the suggested change below and apply it yourself if correct — your code was NOT changed.',
  },
  UNRESOLVED: {
    icon: '❌',
    label: 'Fix Did Not Resolve The Violation',
    color: '#fca5a5',
    detail: 'A patch was generated, but re-scanning it still detects the same violation. Your code was NOT changed.',
  },
  PATCH_REJECTED: {
    icon: '❌',
    label: 'Patch Rejected',
    color: '#fca5a5',
    detail: 'The suggested patch would introduce a new syntax or type error. Your code was NOT changed.',
  },
  VERIFICATION_UNAVAILABLE: {
    icon: '⚠️',
    label: 'Applied Locally — Not Verified',
    color: '#fde68a',
    detail: 'A local patch was applied, but it could not be re-scanned to confirm the violation is actually gone (connection unavailable). Re-scan manually to confirm before trusting this fix.',
  },
};

// ── Diff viewer helper ──────────────────────────────────────────────────────
function DiffView({ before, after }: { before: string; after: string }) {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');

  // Simple line-level diff: mark lines that differ
  const maxLen = Math.max(beforeLines.length, afterLines.length);
  const rows: Array<{ type: 'same' | 'removed' | 'added'; text: string }> = [];

  let bi = 0;
  let ai = 0;
  while (bi < beforeLines.length || ai < afterLines.length) {
    const bl = beforeLines[bi] ?? null;
    const al = afterLines[ai] ?? null;

    if (bl === al) {
      rows.push({ type: 'same', text: bl ?? '' });
      bi++;
      ai++;
    } else {
      if (bl !== null) rows.push({ type: 'removed', text: bl });
      if (al !== null) rows.push({ type: 'added', text: al });
      bi++;
      ai++;
    }
  }

  void maxLen; // suppress unused warning

  const changedCount = rows.filter((r) => r.type !== 'same').length;
  if (changedCount === 0) return null;

  return (
    <div
      style={{
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.08)',
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
          background: 'rgba(15,23,42,0.9)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          color: '#64748b',
          fontSize: '10px',
          fontWeight: 700,
          display: 'flex',
          gap: '16px',
        }}
      >
        <span style={{ color: '#ef4444' }}>− removed</span>
        <span style={{ color: '#22c55e' }}>+ added</span>
        <span style={{ marginLeft: 'auto' }}>{changedCount / 2} line(s) changed</span>
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
                ? 'rgba(34,197,94,0.08)'
                : 'transparent',
            color:
              row.type === 'removed'
                ? '#fca5a5'
                : row.type === 'added'
                ? '#86efac'
                : '#94a3b8',
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

  // Per-violation fix state
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [fixResults, setFixResults] = useState<Record<string, FixOutcome>>({});

  const editorRef = useRef<any>(null);
  const monaco = useMonaco();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScannedCode = useRef<string>('');

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
    lastScannedCode.current = targetCode;

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: targetCode, fileName: targetFile }),
      });
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      const data: ScanResultResponse = await res.json();
      setResult(data);
      setFixResults({});
    } catch (err: any) {
      setScanError(err.message || 'Failed to inspect code');
    } finally {
      setScanning(false);
    }
  }, [code, fileName]);

  // ── Auto-scan the default sample on first mount ────────────────────────
  useEffect(() => {
    handleScan(SAMPLE_REACT_CODE, 'UserProfile.jsx');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Monaco markers sync ────────────────────────────────────────────────
  useEffect(() => {
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
  }, [monaco, result]);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
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
  const applyFix = async (defect: DiagnosticItem) => {
    const fixKey = defect.ruleId + '_' + defect.location.start.line;
    setFixingId(fixKey);
    const beforeCode = code;

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, fileName, action: 'ai-fix', defect }),
      });

      if (!res.ok) throw new Error('AI fix endpoint error');
      const aiData = await res.json();

      const candidateCode: string = aiData.remediatedCode || code;
      const verified: boolean = aiData.verified === true;
      const status: VerificationStatus = aiData.verificationStatus || 'UNRESOLVED';
      const engineLabel =
        aiData.engineType === 'GEMINI_2_5_FLASH' ? '✨ Gemini 2.5 Flash' : '⚡ Deterministic Engine';

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
      try {
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

  // ── Score colour ─────────────────────────────────────────────────────
  const scoreColor = (s: number) =>
    s >= 80 ? '#22c55e' : s >= 50 ? '#eab308' : '#ef4444';

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.4px', margin: 0 }}>
            ⚡ Live Code Inspector &amp; Auto-Fix Studio
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
            Paste <strong style={{ color: '#94a3b8' }}>any</strong> code below — FIGM detects real violations from your actual code and applies targeted fixes. Nothing is hardcoded.
          </p>
        </div>

        {/* Auto-scan indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '20px',
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.25)',
            fontSize: '11px',
            fontWeight: 700,
            color: '#86efac',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: scanning ? '#eab308' : '#22c55e',
              animation: scanning ? 'pulse 1s infinite' : 'none',
              display: 'inline-block',
            }}
          />
          {scanning ? 'Scanning…' : 'Auto-scan active (1.5 s debounce)'}
        </div>
      </div>

      {/* Main Studio Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: '20px' }}>

        {/* LEFT — Editor */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Editor header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>Source Code Editor</span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#22c55e',
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                }}
              >
                Interactive
              </span>
            </div>

            {/* Sample presets */}
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: '#64748b' }}>Try Sample:</span>
              {[
                { label: 'Next.js', code: SAMPLE_NEXTJS_CODE, file: 'DashboardPage.tsx', color: '#ffffff' },
                { label: 'React', code: SAMPLE_REACT_CODE, file: 'UserProfile.jsx', color: '#38bdf8' },
                { label: 'Angular', code: SAMPLE_ANGULAR_CODE, file: 'SearchPanel.component.ts', color: '#ef4444' },
                { label: 'Vue', code: SAMPLE_VUE_CODE, file: 'UserProfile.vue', color: '#10b981' },
              ].map((p) => (
                <button
                  key={p.label}
                  onClick={() => loadPreset(p.code, p.file)}
                  className="btn-secondary"
                  style={{ padding: '3px 9px', fontSize: '11px', color: p.color, fontWeight: 700 }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* File name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>File Name:</span>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="input-field font-mono"
              style={{ flex: 1, padding: '5px 10px', fontSize: '12px' }}
              placeholder="e.g. MyComponent.tsx"
            />
          </div>

          {/* Monaco editor */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            <Editor
              height="430px"
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
              }}
            />
          </div>

          {/* Manual scan button */}
          <button
            onClick={() => handleScan()}
            disabled={scanning}
            className="btn-primary"
            style={{ padding: '11px', width: '100%', fontSize: '14px', fontWeight: 800 }}
          >
            {scanning ? '🔄 Scanning Your Code…' : '🚀 Check My Code Now'}
          </button>

          {/* Scan error */}
          {scanError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#fca5a5',
                fontSize: '12px',
              }}
            >
              ⚠️ {scanError}
            </div>
          )}
        </div>

        {/* RIGHT — Results */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Panel header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
              Detected Issues &amp; 1-Click Fixes
            </span>
            {result && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#38bdf8',
                  background: 'rgba(56,189,248,0.1)',
                  border: '1px solid rgba(56,189,248,0.25)',
                  borderRadius: '6px',
                  padding: '2px 8px',
                  fontFamily: 'JetBrains Mono',
                }}
              >
                {result.framework}
              </span>
            )}
          </div>

          {/* Empty / loading / results */}
          {!result && !scanning ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                textAlign: 'center',
                padding: '48px 20px',
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>💡</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#94a3b8' }}>
                Paste your code in the editor
              </div>
              <div style={{ fontSize: '12px', marginTop: '6px', color: '#475569' }}>
                FIGM will automatically scan it and show real violations from your code
              </div>
            </div>
          ) : scanning ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                textAlign: 'center',
                padding: '40px 20px',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
                Analyzing Code…
              </div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Running all 25 FIGM guideline rules against your code
              </div>
            </div>
          ) : result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Metrics bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[
                  {
                    label: '⏱️ Speed',
                    value: result.profile?.executionTimeMs != null
                      ? `${result.profile.executionTimeMs.toFixed(2)} ms`
                      : '—',
                    color: '#38bdf8',
                  },
                  {
                    label: '💾 Memory',
                    value: result.profile?.peakMemoryMb != null
                      ? `${result.profile.peakMemoryMb.toFixed(2)} MB`
                      : '—',
                    color: '#a855f7',
                  },
                  {
                    label: '🧩 Complexity',
                    value: `v(G)=${result.complexity?.cyclomaticComplexity ?? 1} (${result.complexity?.complexityRating ?? 'A'})`,
                    color: '#eab308',
                  },
                  {
                    label: '💯 Quality Score',
                    value: `${result.qualityScore ?? 100} / 100`,
                    color: scoreColor(result.qualityScore ?? 100),
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    style={{
                      padding: '7px 8px',
                      background: '#090d16',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>{m.label}</div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: m.color, marginTop: '2px', fontFamily: 'JetBrains Mono' }}>
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: '#64748b',
                  background: '#090d16',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                }}
              >
                <span>
                  Framework:{' '}
                  <strong style={{ color: '#38bdf8' }}>{result.framework}</strong>
                </span>
                <span>
                  ALPs extracted:{' '}
                  <strong style={{ color: '#a855f7' }}>{result.extractedALPsCount}</strong>
                </span>
                <span>
                  Issues:{' '}
                  <strong style={{ color: result.diagnostics.length > 0 ? '#ef4444' : '#22c55e' }}>
                    {result.diagnostics.length}
                  </strong>
                </span>
              </div>

              {/* Diagnostics */}
              {UNSUPPORTED_FRAMEWORKS.has(result.framework) ? (
                // A zero-violation result for a framework FIGM does not analyze at all must
                // never be presented as "your code is clean" -- that would misrepresent an
                // "unchecked" result as a "passed" one. See Task requirement: handle
                // unsupported frameworks gracefully, without implying a check occurred.
                <div
                  style={{
                    padding: '28px',
                    background: 'rgba(234,179,8,0.08)',
                    borderRadius: '10px',
                    border: '1px solid rgba(234,179,8,0.25)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '28px', marginBottom: '6px' }}>⚠️</div>
                  <strong style={{ color: '#fde68a', fontSize: '15px' }}>
                    "{result.framework}" Is Not Yet Supported
                  </strong>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    FIGM detected this framework but does not yet run any guideline rules against
                    it. This is <strong>not</strong> a "no issues found" result — no analysis was
                    performed. Supported frameworks: React, Next.js, Angular, Vue, and plain
                    JS/TS.
                  </div>
                </div>
              ) : result.diagnostics.length === 0 ? (
                <div
                  style={{
                    padding: '28px',
                    background: 'rgba(34,197,94,0.08)',
                    borderRadius: '10px',
                    border: '1px solid rgba(34,197,94,0.25)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '28px', marginBottom: '6px' }}>🎉</div>
                  <strong style={{ color: '#86efac', fontSize: '15px' }}>No Issues Found!</strong>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    Your code meets all 25 FIGM quality, performance, and accessibility rules.
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    maxHeight: '520px',
                    overflowY: 'auto',
                    paddingRight: '4px',
                  }}
                >
                  {result.diagnostics.map((d, idx) => {
                    const fixKey = d.ruleId + '_' + d.location.start.line;
                    const fixResult = fixResults[fixKey];
                    const isFixing = fixingId === fixKey;
                    const color = SEV_COLOR[d.severity] ?? '#94a3b8';
                    const bg = SEV_BG[d.severity] ?? 'rgba(148,163,184,0.08)';
                    const isFigmRule = d.ruleId.startsWith('FIGM-');
                    const statusMeta = fixResult ? FIX_STATUS_META[fixResult.status] : null;
                    const line = d.location?.start?.line && d.location.start.line > 0 ? d.location.start.line : 1;
                    const column = d.location?.start?.column;
                    const endLine = d.location?.end?.line;
                    const endColumn = d.location?.end?.column;

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '14px',
                          background: '#090d16',
                          borderRadius: '10px',
                          border: `1px solid ${
                            fixResult
                              ? fixResult.verified
                                ? 'rgba(34,197,94,0.3)'
                                : 'rgba(234,179,8,0.3)'
                              : 'rgba(255,255,255,0.07)'
                          }`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '9px',
                          transition: 'border-color 0.2s ease',
                        }}
                      >
                        {/* Violation header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                color,
                                background: bg,
                                border: `1px solid ${color}44`,
                                borderRadius: '4px',
                                padding: '2px 7px',
                              }}
                            >
                              {d.severity}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                color: '#38bdf8',
                                fontFamily: 'JetBrains Mono',
                                fontWeight: 700,
                              }}
                            >
                              {d.ruleId}
                            </span>
                            {d.sourceKind && (
                              <span
                                title={
                                  d.sourceKind === 'REAL_AST'
                                    ? 'Detected via genuine TypeScript-compiler AST traversal'
                                    : 'Detected via text/regex pattern matching (not yet AST-migrated for this framework)'
                                }
                                style={{
                                  fontSize: '9px',
                                  fontWeight: 700,
                                  color: d.sourceKind === 'REAL_AST' ? '#a855f7' : '#64748b',
                                  background: d.sourceKind === 'REAL_AST' ? 'rgba(168,85,247,0.1)' : 'rgba(100,116,139,0.1)',
                                  border: `1px solid ${d.sourceKind === 'REAL_AST' ? 'rgba(168,85,247,0.3)' : 'rgba(100,116,139,0.3)'}`,
                                  borderRadius: '4px',
                                  padding: '2px 6px',
                                }}
                              >
                                {d.sourceKind === 'REAL_AST' ? '🌳 AST' : '📝 pattern'}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {isFigmRule && (
                              <a
                                href={`/guidelines#${d.ruleId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  background: 'rgba(168,85,247,0.08)',
                                  border: '1px solid rgba(168,85,247,0.25)',
                                  borderRadius: '4px',
                                  color: '#c4b5fd',
                                  fontSize: '10px',
                                  padding: '3px 8px',
                                  cursor: 'pointer',
                                  fontFamily: 'JetBrains Mono',
                                  textDecoration: 'none',
                                }}
                              >
                                📖 Rule Guide
                              </a>
                            )}
                            <button
                              onClick={() => jumpToLine(line)}
                              style={{
                                background: 'rgba(56,189,248,0.08)',
                                border: '1px solid rgba(56,189,248,0.25)',
                                borderRadius: '4px',
                                color: '#38bdf8',
                                fontSize: '10px',
                                padding: '3px 8px',
                                cursor: 'pointer',
                                fontFamily: 'JetBrains Mono',
                              }}
                            >
                              📍 Go to Line {line}
                              {column != null ? `:${column}` : ''} →
                            </button>
                          </div>
                        </div>

                        {/* Rule name */}
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>
                          {d.ruleName}
                        </div>

                        {/* Source range + standard reference */}
                        <div style={{ fontSize: '10px', color: '#64748b', display: 'flex', gap: '10px', flexWrap: 'wrap', fontFamily: 'JetBrains Mono' }}>
                          <span>
                            Location: L{line}
                            {column != null ? `:C${column}` : ''}
                            {endLine ? ` → L${endLine}${endColumn != null ? `:C${endColumn}` : ''}` : ''}
                          </span>
                          {d.standardReference && <span>Ref: {d.standardReference}</span>}
                        </div>

                        {/* Offending code snippet */}
                        <pre
                          style={{
                            background: 'rgba(239,68,68,0.07)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            color: '#fca5a5',
                            margin: 0,
                            fontFamily: 'JetBrains Mono',
                            overflowX: 'auto',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          <code>{d.offendingCodeSnippet}</code>
                        </pre>

                        {/* Evidence (what the detector actually matched) */}
                        {d.evidence && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                            🔍 <strong>Evidence:</strong> {d.evidence}
                          </div>
                        )}

                        {/* Explanation */}
                        <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                          {d.message}
                        </div>

                        {/* How-to-fix hint */}
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#86efac',
                            background: 'rgba(34,197,94,0.06)',
                            border: '1px solid rgba(34,197,94,0.15)',
                            padding: '7px 10px',
                            borderRadius: '6px',
                          }}
                        >
                          💡 <strong>How to Fix:</strong> {d.remediation}
                        </div>

                        {/* Fix outcome -- always reflects what the real engine actually verified,
                            never a blanket "Fixed" independent of that verification. */}
                        {fixResult && statusMeta && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                              <span>{statusMeta.icon} {statusMeta.label}{fixResult.verified ? ` (by ${fixResult.engine})` : ''}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '2px' }}>
                              {statusMeta.detail}
                            </div>
                            {fixResult.description && (
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {fixResult.description}
                              </div>
                            )}
                            {fixResult.fallbackReason && (
                              <div style={{ fontSize: '10px', color: '#64748b', fontStyle: 'italic' }}>
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
                            onClick={() => applyFix(d)}
                            disabled={isFixing || !!fixingId}
                            style={{
                              alignSelf: 'flex-start',
                              padding: '7px 14px',
                              borderRadius: '6px',
                              border: '1px solid rgba(34,197,94,0.35)',
                              background: isFixing
                                ? 'rgba(234,179,8,0.1)'
                                : 'rgba(34,197,94,0.12)',
                              color: isFixing ? '#fde68a' : '#86efac',
                              fontSize: '12px',
                              fontWeight: 800,
                              cursor: isFixing ? 'wait' : 'pointer',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {isFixing
                              ? '⏳ Applying & Verifying Fix…'
                              : fixResult
                              ? '🔁 Retry Fix'
                              : '✨ Apply & Verify Fix'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
