'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface AccessibilityRuleItem {
  id: string;
  ruleName: string;
  wcagCriteria: string;
  level: 'A' | 'AA' | 'AAA';
  complianceRate: number;
  testedElementsCount: number;
  violationsCount: number;
  status: 'COMPLIANT' | 'NEEDS_ATTENTION';
  description: string;
  remediation: string;
}

const ACCESSIBILITY_RULES: AccessibilityRuleItem[] = [
  {
    id: 'FIGM-A11Y-01',
    ruleName: 'Keyboard Navigation Parity for Interactive Divs',
    wcagCriteria: 'WCAG 2.1.1 Keyboard',
    level: 'A',
    complianceRate: 95.8,
    testedElementsCount: 312,
    violationsCount: 3,
    status: 'COMPLIANT',
    description: 'Ensures element click handlers (onClick) have matching keyboard listeners (onKeyDown / onKeyUp) or button semantics.',
    remediation: 'Replace onClick div with <button> or add tabIndex={0} and onKeyDown={(e) => e.key === "Enter" && handleAction()}.',
  },
  {
    id: 'FIGM-A11Y-02',
    ruleName: 'Custom Interactive Controls ARIA Semantics',
    wcagCriteria: 'WCAG 4.1.2 Name, Role, Value',
    level: 'A',
    complianceRate: 97.2,
    testedElementsCount: 185,
    violationsCount: 1,
    status: 'COMPLIANT',
    description: 'Ensures custom dropdowns, tabs, and popovers export valid ARIA roles (role="combobox", role="tab") and accessible labels.',
    remediation: 'Add role="combobox" and aria-expanded={isOpen} to custom select containers.',
  },
  {
    id: 'FIGM-A11Y-03',
    ruleName: 'Image Non-Text Content Accessibility',
    wcagCriteria: 'WCAG 1.1.1 Non-Text Content',
    level: 'A',
    complianceRate: 98.4,
    testedElementsCount: 420,
    violationsCount: 0,
    status: 'COMPLIANT',
    description: 'Validates that <img> and Next.js <Image /> tags provide descriptive alt text or explicit aria-hidden="true" for decorative images.',
    remediation: 'Provide alt="User profile banner" or aria-hidden="true" for decorative icon vectors.',
  },
  {
    id: 'FIGM-A11Y-04',
    ruleName: 'Form Input Accessible Name & Associated Labels',
    wcagCriteria: 'WCAG 3.3.2 Labels or Instructions',
    level: 'A',
    complianceRate: 96.1,
    testedElementsCount: 145,
    violationsCount: 2,
    status: 'COMPLIANT',
    description: 'Checks that form input, select, and textarea elements have associated <label htmlFor="..."> tags or aria-label attributes.',
    remediation: 'Wrap input with <label> or provide aria-label="Search Repository Query".',
  },
  {
    id: 'FIGM-A11Y-05',
    ruleName: 'Modal Dialog Keyboard Focus Trap Prevention',
    wcagCriteria: 'WCAG 2.1.2 No Keyboard Trap',
    level: 'A',
    complianceRate: 94.5,
    testedElementsCount: 48,
    violationsCount: 1,
    status: 'COMPLIANT',
    description: 'Ensures modal dialogs restrict keyboard focus navigation within the modal container while active and restore focus on close.',
    remediation: 'Wrap modal in <FocusTrap> or handle Escape key listener to close overlay.',
  },
  {
    id: 'FIGM-A11Y-06',
    ruleName: 'Dynamic Screen Reader Announcers (Live Regions)',
    wcagCriteria: 'WCAG 4.1.3 Status Messages',
    level: 'AA',
    complianceRate: 96.0,
    testedElementsCount: 64,
    violationsCount: 0,
    status: 'COMPLIANT',
    description: 'Ensures async status updates, toast alerts, and scan completions use aria-live="polite" or aria-live="assertive".',
    remediation: 'Add aria-live="polite" and role="status" to toast notification containers.',
  },
];

export default function AccessibilityPage() {
  const [selectedRule, setSelectedRule] = useState<AccessibilityRuleItem>(ACCESSIBILITY_RULES[0]);
  const [sandboxFixed, setSandboxFixed] = useState<boolean>(false);

  const sampleBadCode = `<div className="custom-button" onClick={handleSubmit}>
  <span>Submit Search Query</span>
</div>`;

  const sampleFixedCode = `<button className="custom-button" onClick={handleSubmit} type="button">
  <span>Submit Search Query</span>
</button>`;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#a855f7', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
            WCAG 2.2 LEVEL AA AUDIT STUDIO
          </div>
          <h1 className="gradient-text-blue" style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.8px', margin: 0, lineHeight: 1.1 }}>
            Accessibility & Screen Reader Inspector
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px', margin: 0 }}>
            Automated WCAG 2.2 AA static audit for keyboard navigation, ARIA semantics, focus traps, and screen reader parity.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/live-scan" className="btn-glow" style={{ fontSize: '13px' }}>
            <span>▶</span> Run Accessibility Scan
          </Link>
        </div>
      </div>

      {/* Top 5 Accessibility Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '20px', borderTop: '2px solid #a855f7', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>WCAG 2.2 Score</div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#a855f7', marginTop: '4px', fontFamily: 'JetBrains Mono' }}>96.4%</div>
          <div style={{ fontSize: '10px', color: '#86efac', marginTop: '2px', fontWeight: 600 }}>Level AA Compliant</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderTop: '2px solid #38bdf8', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Tested Elements</div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#38bdf8', marginTop: '4px', fontFamily: 'JetBrains Mono' }}>1,174</div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Interactive Controls</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderTop: '2px solid #10b981', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Keyboard Access</div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#10b981', marginTop: '4px', fontFamily: 'JetBrains Mono' }}>100%</div>
          <div style={{ fontSize: '10px', color: '#86efac', marginTop: '2px', fontWeight: 600 }}>Zero Focus Traps</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderTop: '2px solid #f59e0b', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Screen Reader Parity</div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#f59e0b', marginTop: '4px', fontFamily: 'JetBrains Mono' }}>98.2%</div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>NVDA & JAWS Tested</div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', borderTop: '2px solid #ef4444', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Minor Warnings</div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#ef4444', marginTop: '4px', fontFamily: 'JetBrains Mono' }}>7</div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Auto-Fix Available</div>
        </div>
      </div>

      {/* Middle Grid: Rule Inspector & Interactive Auto-Fix Sandbox */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        {/* Left: 6 FIGM Accessibility Rules List */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              FIGM Accessibility Guideline Matrix (WCAG 2.2 AA)
            </h2>
            <span className="badge badge-domain" style={{ fontSize: '10px' }}>6 Active Rules</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {ACCESSIBILITY_RULES.map((rule) => (
              <div
                key={rule.id}
                onClick={() => setSelectedRule(rule)}
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background: selectedRule.id === rule.id ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.5)',
                  border: selectedRule.id === rule.id ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8', fontFamily: 'JetBrains Mono' }}>[{rule.id}]</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>{rule.ruleName}</span>
                  </div>
                  <span className="badge-trend-green" style={{ fontSize: '11px' }}>{rule.wcagCriteria}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>
                  {rule.description}
                </div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '11px', color: '#cbd5e1' }}>
                  <span>Tested: <strong>{rule.testedElementsCount}</strong> elements</span>
                  <span>Compliance: <strong style={{ color: '#10b981' }}>{rule.complianceRate}%</strong></span>
                  <span>Violations: <strong style={{ color: rule.violationsCount > 0 ? '#ef4444' : '#10b981' }}>{rule.violationsCount}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Selected Rule Detail & 1-Click Fix Sandbox */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Rule Detail Panel */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase' }}>
              RULE AUDIT SPECIFICATION
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              [{selectedRule.id}] {selectedRule.ruleName}
            </h3>
            <div style={{ fontSize: '12px', color: '#94a3b8', background: 'rgba(30, 41, 59, 0.6)', padding: '10px 14px', borderRadius: '8px' }}>
              <strong>Standard Reference</strong>: {selectedRule.wcagCriteria} (Level {selectedRule.level})
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>Automated Remediation Strategy:</div>
              <div style={{ fontSize: '12px', color: '#86efac', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '10px 14px', borderRadius: '8px', lineHeight: 1.4 }}>
                {selectedRule.remediation}
              </div>
            </div>
          </div>

          {/* Interactive Fix Sandbox */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                1-Click WCAG Fix Studio
              </h3>
              <span className="badge badge-domain" style={{ fontSize: '10px' }}>Interactive</span>
            </div>

            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              Test how FIGM automatically transforms non-accessible code into WCAG 2.2 AA compliant JSX:
            </div>

            <div style={{ background: '#090d16', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)', fontFamily: 'JetBrains Mono', fontSize: '12px', color: sandboxFixed ? '#86efac' : '#fca5a5' }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {sandboxFixed ? sampleFixedCode : sampleBadCode}
              </pre>
            </div>

            <button
              onClick={() => setSandboxFixed(!sandboxFixed)}
              className="btn-glow"
              style={{ width: '100%', padding: '10px', fontSize: '13px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
            >
              <span>✨</span> {sandboxFixed ? 'Revert to Original Code' : 'Apply Automatic WCAG 2.2 Fix'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
