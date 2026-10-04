'use client';

/**
 * STAGE 4 CORRECTION (docs/audit/STAGE_4_PRODUCTION_BROWSER_ACCEPTANCE_REPORT.md): this page
 * previously hardcoded an entirely fabricated summary -- "96.4% WCAG 2.2 Level AA Compliant",
 * "98.2% Screen Reader Parity (NVDA & JAWS Tested)", "100% Keyboard Access (Zero Focus Traps)" --
 * none of it computed from any real scan, and none of it something a static analyzer can
 * honestly claim (NVDA/JAWS are real assistive-technology screen readers; testing with them
 * requires real runtime AT testing this project does not perform). Its per-rule table also
 * described the WRONG rule under several real rule IDs (e.g. the old FIGM-A11Y-03 entry here was
 * "Image Non-Text Content Accessibility, WCAG 1.1.1" -- the real FIGM-A11Y-03 is "ARIA Live
 * Announcer for Dynamic Mutations, WCAG SC 4.1.3", a different rule entirely).
 *
 * This page now sources every rule fact from RULE_CATALOG and WCAG_22_MAPPINGS
 * (src/matrix/rule-registry.ts / four-layer-meta-model.ts) -- the same single source of truth
 * the detection engine itself reads -- so it cannot drift out of sync or state a fabricated
 * number again. It states plainly, in its own header, that this is a static-analysis reference
 * with heuristic/partial detectability, never a claim of full WCAG 2.2 Level AA conformance or
 * of any real assistive-technology testing.
 */
import React, { useState } from 'react';
import Link from 'next/link';
import { RULE_CATALOG } from '../../src/matrix/rule-registry';
import { WCAG_22_MAPPINGS } from '../../src/matrix/four-layer-meta-model';

const ACCESSIBILITY_RULES = RULE_CATALOG.filter((r) => r.domain === 'ACCESSIBILITY');

const DETECTABILITY_LABEL: Record<string, string> = {
  DIRECT_STATIC_CHECK: 'Direct static check',
  PARTIAL_STATIC_CHECK: 'Partial static check',
  HEURISTIC: 'Heuristic static check',
  MANUAL_REVIEW_REQUIRED: 'Manual review required',
  NOT_SUPPORTED: 'Not supported',
};

export default function AccessibilityPage() {
  const [selectedRuleId, setSelectedRuleId] = useState<string>(ACCESSIBILITY_RULES[0]?.id ?? '');
  const [sandboxFixed, setSandboxFixed] = useState<boolean>(false);

  const selectedRule = ACCESSIBILITY_RULES.find((r) => r.id === selectedRuleId) ?? ACCESSIBILITY_RULES[0];
  const selectedWcag = selectedRule ? WCAG_22_MAPPINGS[selectedRule.id] : undefined;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
            WCAG 2.2-Aligned Static Checks — Not a Conformance Audit
          </div>
          <h1 className="gradient-text-blue" style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.8px', margin: 0, lineHeight: 1.1 }}>
            Accessibility Rule Reference
          </h1>
          <p style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '14px', marginTop: '4px', margin: 0, maxWidth: 720 }}>
            {ACCESSIBILITY_RULES.length} static-analysis rules, each mapped to a specific WCAG 2.2
            Success Criterion with an honest detectability classification. This is a{' '}
            <strong>statically detectable subset</strong> of WCAG 2.2 — it does not test with real
            assistive technology (no NVDA/JAWS testing is performed) and is not a claim of full
            WCAG 2.2 Level AA conformance. Run a real scan under <Link href="/live-scan" style={{ color: '#1d4ed8' }}>Live Scan</Link> to
            see real findings against your own code.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/live-scan" className="btn-glow" style={{ fontSize: '13px' }}>
            <span>▶</span> Run a Real Scan
          </Link>
        </div>
      </div>

      {/* Middle Grid: Rule Inspector & Interactive Auto-Fix Sandbox */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        {/* Left: real accessibility rules list, sourced from RULE_CATALOG */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.82)', margin: 0 }}>
              FIGM Accessibility Guideline Matrix (WCAG 2.2)
            </h2>
            <span className="badge badge-domain" style={{ fontSize: '10px' }}>{ACCESSIBILITY_RULES.length} Active Rules</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {ACCESSIBILITY_RULES.map((rule) => {
              const wcag = WCAG_22_MAPPINGS[rule.id];
              return (
                <div
                  key={rule.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedRuleId === rule.id}
                  onClick={() => setSelectedRuleId(rule.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedRuleId(rule.id);
                    }
                  }}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    background: selectedRuleId === rule.id ? 'rgba(96, 165, 250, 0.12)' : 'rgba(255, 255, 255, 0.5)',
                    border: selectedRuleId === rule.id ? '1px solid #60a5fa' : '1px solid rgba(0, 0, 0, 0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#1d4ed8', fontFamily: 'JetBrains Mono' }}>[{rule.id}]</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(0, 0, 0, 0.82)' }}>{rule.name}</span>
                    </div>
                    {wcag && <span className="badge-trend-green" style={{ fontSize: '11px' }}>{wcag.clause} {wcag.title}</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.7)', lineHeight: 1.4 }}>
                    {rule.description}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', flexWrap: 'wrap' }}>
                    <span>Severity: <strong>{rule.severity}</strong></span>
                    {wcag && <span>Detectability: <strong>{DETECTABILITY_LABEL[wcag.automatedDetectability ?? ''] ?? wcag.automatedDetectability}</strong></span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Rule Detail & 1-Click Fix Sandbox */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Rule Detail Panel */}
          {selectedRule && (
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 800, textTransform: 'uppercase' }}>
                RULE SPECIFICATION
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.82)', margin: 0 }}>
                [{selectedRule.id}] {selectedRule.name}
              </h3>
              {selectedWcag && (
                <div style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.7)', background: 'rgba(255, 255, 255, 0.6)', padding: '10px 14px', borderRadius: '8px' }}>
                  <div><strong>Standard Reference</strong>: WCAG 2.2 {selectedWcag.clause} — {selectedWcag.title} (Level {selectedWcag.level})</div>
                  <div style={{ marginTop: '6px' }}><strong>Mapping rationale</strong>: {selectedWcag.mappingRationale}</div>
                  <div style={{ marginTop: '6px' }}><strong>Automated detectability</strong>: {DETECTABILITY_LABEL[selectedWcag.automatedDetectability ?? ''] ?? selectedWcag.automatedDetectability}</div>
                </div>
              )}

              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(0, 0, 0, 0.82)', marginBottom: '4px' }}>Known limitation:</div>
                <div style={{ fontSize: '12px', color: '#1d4ed8', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '10px 14px', borderRadius: '8px', lineHeight: 1.4 }}>
                  {selectedRule.knownLimitation}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(0, 0, 0, 0.82)', marginBottom: '4px' }}>Remediation:</div>
                <div style={{ fontSize: '12px', color: '#1d4ed8', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '10px 14px', borderRadius: '8px', lineHeight: 1.4 }}>
                  {selectedRule.remediation}
                </div>
              </div>
            </div>
          )}

          {/* Illustrative Fix Sandbox -- explicitly labelled as a static example, not a live pipeline run */}
          {selectedRule && (
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.82)', margin: 0 }}>
                  Illustrative Example
                </h3>
                <span className="badge badge-domain" style={{ fontSize: '10px' }}>Static example — not a live fix run</span>
              </div>

              <div style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.7)' }}>
                This toggles between this rule&apos;s documented non-compliant and compliant example code.
                It does not run FIGM&apos;s real fix pipeline — for a real fix on your own code, use{' '}
                <Link href="/live-scan" style={{ color: '#1d4ed8' }}>Live Scan</Link>.
              </div>

              <div style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)', fontFamily: 'JetBrains Mono', fontSize: '12px', color: sandboxFixed ? '#60a5fa' : '#fca5a5' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {sandboxFixed ? selectedRule.example.compliant : selectedRule.example.nonCompliant}
                </pre>
              </div>

              <button
                onClick={() => setSandboxFixed(!sandboxFixed)}
                className="btn-glow"
                style={{ width: '100%', padding: '10px', fontSize: '13px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
              >
                <span>✨</span> {sandboxFixed ? 'Show Non-Compliant Example' : 'Show Compliant Example'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
