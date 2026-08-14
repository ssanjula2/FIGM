'use client';

import React, { useState } from 'react';
import { useSettings } from '../../src/hooks/useSettings';

export default function SettingsPage() {
  const { settings, loading, updateSettings } = useSettings();
  const [savedNotice, setSavedNotice] = useState(false);

  // Local state for extended settings
  const [language, setLanguage] = useState('English (US)');
  const [timezone, setTimezone] = useState('UTC (Coordinated Universal Time)');
  const [temperature, setTemperature] = useState(0.2);
  const [remediationStyle, setRemediationStyle] = useState('Conservative & ISO Compliant');
  const [samplingIntervalMs, setSamplingIntervalMs] = useState(50);
  const [maxCallDepth, setMaxCallDepth] = useState(32);
  const [includeResearchRefs, setIncludeResearchRefs] = useState(true);
  const [includeCharts, setIncludeCharts] = useState(true);

  const handleSaveAll = async () => {
    await updateSettings({
      theme: settings.theme,
      autoSave: settings.autoSave,
      autoScan: settings.autoScan,
      aiModel: settings.aiModel,
      exportFormat: settings.exportFormat,
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
        <div>Loading FIGM Code Inspector Configurations...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
            Platform Control Panel
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#f8fafc', margin: 0, letterSpacing: '-0.5px' }}>
            Application & Engine Settings
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '6px', margin: 0 }}>
            Customize scanner thresholds, AI model parameters, profiler sampling, and export defaults.
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            padding: '12px 24px',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 0 20px rgba(56, 189, 248, 0.3)',
          }}
        >
          {savedNotice ? '✓ Saved!' : '💾 Save Settings'}
        </button>
      </div>

      {/* 1. Application Settings */}
      <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '28px', marginBottom: '28px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: '0 0 20px 0' }}>
          ⚙️ General Application Settings
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          <div>
            <label id="theme-label" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Theme</label>
            {/* A prior version of this control offered two additional light-palette and
                OS-preference-following options alongside the dark one -- every page in this app
                is hardcoded to the dark palette via inline styles, so selecting either did
                nothing visually while still persisting the choice, a misleading affordance.
                Rather than leave a non-functional selector (or silently drop the setting the
                backend still stores), this is now honest static text: one real theme exists
                today. */}
            <div
              aria-labelledby="theme-label"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#090d16', color: '#38bdf8', fontWeight: 700, fontSize: '13px', boxSizing: 'border-box' }}
            >
              🌙 Dark Glass (Vercel &amp; Linear)
            </div>
            <p style={{ fontSize: '11px', color: '#7c8ba6', margin: '6px 0 0 0' }}>
              Light theme and system-based switching are not implemented yet — every page currently ships in Dark Glass only.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#090d16', color: '#f8fafc', fontWeight: 600, fontSize: '13px' }}
            >
              <option value="English (US)">English (US)</option>
              <option value="Spanish">Spanish (Español)</option>
              <option value="French">French (Français)</option>
              <option value="German">German (Deutsch)</option>
              <option value="Japanese">Japanese (日本語)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#090d16', color: '#f8fafc', fontWeight: 600, fontSize: '13px' }}
            >
              <option value="UTC (Coordinated Universal Time)">UTC (Coordinated Universal Time)</option>
              <option value="EST (Eastern Standard Time)">EST (Eastern Standard Time)</option>
              <option value="PST (Pacific Standard Time)">PST (Pacific Standard Time)</option>
              <option value="GMT (Greenwich Mean Time)">GMT (Greenwich Mean Time)</option>
              <option value="IST (Indian Standard Time)">IST (Indian Standard Time)</option>
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '24px', marginTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={(e) => updateSettings({ autoSave: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: '#38bdf8' }}
              />
              <strong>Auto-Save Scan History & Diagnostics</strong>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.autoScan}
                onChange={(e) => updateSettings({ autoScan: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: '#38bdf8' }}
              />
              <strong>Auto-Scan on Code Paste / Repository Commit</strong>
            </label>
          </div>
        </div>
      </div>

      {/* 2. AI Settings */}
      <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '28px', marginBottom: '28px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#a855f7', margin: '0 0 20px 0' }}>
          🤖 AI Remediation Engine Settings
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>AI Model Selection</label>
            <select
              value={settings.aiModel}
              onChange={(e) => updateSettings({ aiModel: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#090d16', color: '#a855f7', fontWeight: 700, fontSize: '13px' }}
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Ultra Fast)</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep AST Remediation)</option>
              <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
              <option value="gpt-4o">GPT-4o Static Analysis Mode</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>
              Temperature (Creativity): {temperature}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#a855f7', cursor: 'pointer' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Remediation Style</label>
            <select
              value={remediationStyle}
              onChange={(e) => setRemediationStyle(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#090d16', color: '#f8fafc', fontWeight: 600, fontSize: '13px' }}
            >
              <option value="Conservative & ISO Compliant">Conservative & ISO Compliant</option>
              <option value="Aggressive Performance Tuning">Aggressive Performance Tuning</option>
              <option value="Strict Accessibility (WCAG AAA)">Strict Accessibility (WCAG AAA)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Dynamic Profiler Settings */}
      <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '28px', marginBottom: '28px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#38bdf8', margin: '0 0 20px 0' }}>
          ⏱️ Dynamic Runtime Profiler Settings
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Memory Sampling Interval (ms)</label>
            <input
              type="number"
              value={samplingIntervalMs}
              onChange={(e) => setSamplingIntervalMs(Number(e.target.value))}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#090d16', color: '#f8fafc', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Maximum Call Stack Depth</label>
            <input
              type="number"
              value={maxCallDepth}
              onChange={(e) => setMaxCallDepth(Number(e.target.value))}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#090d16', color: '#f8fafc', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      </div>

      {/* 4. Export Engine Defaults */}
      <div style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '28px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#22c55e', margin: '0 0 20px 0' }}>
          📊 Export Engine Defaults
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#94a3b8', marginBottom: '6px' }}>Default Export Format</label>
            <select
              value={settings.exportFormat}
              onChange={(e) => updateSettings({ exportFormat: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.12)', background: '#090d16', color: '#22c55e', fontWeight: 700, fontSize: '13px' }}
            >
              <option value="PDF">PDF Document (HTML Print View)</option>
              <option value="JSON">Raw JSON Spec Report</option>
              <option value="CSV">Tabular CSV Matrix</option>
              <option value="MARKDOWN">Formatted Markdown (MD)</option>
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeResearchRefs}
                onChange={(e) => setIncludeResearchRefs(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#22c55e' }}
              />
              <strong>Include ISO/IEC 25010 & WCAG Research Citations</strong>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeCharts}
                onChange={(e) => setIncludeCharts(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#22c55e' }}
              />
              <strong>Include Graphical Performance Charts</strong>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
