'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { HUMAN_STUDY_TARGET_PARTICIPANTS } from '../../src/research/research-config';

/**
 * Study enrollment / onboarding page (see docs/audit/NORMAL_LIVE_SCAN_RESEARCH_INTEGRATION.md).
 *
 * Previously this page ran its own anonymous STUDY_COOKIE session (GET /api/user-study/log-scan)
 * and a self-contained, diagnostics-only benchmark scanner that duplicated a small slice of the
 * real Live Scan experience. That anonymous flow and its backing routes
 * (/api/user-study/log-scan, /api/user-study/consent) still exist unchanged for whatever
 * QA/back-compat purposes still need them -- this page just no longer calls them.
 *
 * This page now does exactly one thing: let an already-logged-in normal product user join the
 * real human study by linking a P001-P020 participant code onto their OWN account (never a
 * second shadow account), record their session-level informed-consent confirmation, and then
 * send them to the real, unmodified /live-scan page -- the same scanner every other product user
 * uses, backed by the same RuleExecutionEngine and the same real fix/remediation pipelines.
 * Nothing here re-implements or duplicates any of that.
 */
export default function UserStudyPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [participantCode, setParticipantCode] = useState<string | null>(null);
  const [researchStatus, setResearchStatus] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = (): HeadersInit => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('figm_token') : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('figm_token') : null;
    setIsLoggedIn(!!token);
    setAuthChecked(true);

    if (!token) {
      setLoadingStatus(false);
      return;
    }

    fetch('/api/user-study/enroll', { headers: authHeaders(), credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) throw new Error(`Unable to check study status (HTTP ${res.status})`);
        return res.json();
      })
      .then((data) => {
        setParticipantCode(data.participantCode ?? null);
        setResearchStatus(data.researchStatus ?? null);
      })
      .catch((err) => setError(err?.message || 'Unable to check study status.'))
      .finally(() => setLoadingStatus(false));
  }, []);

  const handleJoinStudy = async () => {
    if (!consentChecked || joining) return;
    setJoining(true);
    setError(null);
    try {
      const res = await fetch('/api/user-study/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'same-origin',
        body: JSON.stringify({ consentConfirmed: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Unable to join the study (HTTP ${res.status})`);
      }
      setParticipantCode(data.participantCode);
    } catch (err: any) {
      setError(err?.message || 'Unable to join the study right now. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const consentVerified = researchStatus === 'CONSENT_VERIFIED';

  return (
    <div
      className="user-study-container"
      style={{ padding: '32px 24px', maxWidth: '900px', width: '100%', margin: '0 auto', color: 'rgba(0, 0, 0, 0.82)', fontFamily: 'system-ui, -apple-system, sans-serif', boxSizing: 'border-box' }}
    >
      <div
        className="user-study-hero"
        style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.95))', padding: '32px', borderRadius: '16px', border: '1px solid rgba(0, 0, 0, 0.1)', marginBottom: '32px', boxSizing: 'border-box' }}
      >
        <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '9999px', background: 'rgba(59, 130, 246, 0.2)', color: '#1d4ed8', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
          ACADEMIC RESEARCH USER STUDY — TARGET N={HUMAN_STUDY_TARGET_PARTICIPANTS} PARTICIPANTS
        </span>
        <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px 0', color: 'rgba(0, 0, 0, 0.82)' }}>
          Join the FIGM Code Inspector Usability Study
        </h1>
        <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6', margin: 0 }}>
          Institution: NSBM Green University | Module: IS303.2 Research Methodology | Candidate: A P H D S Sanjula (ID: 28256)
        </p>
      </div>

      {!authChecked || loadingStatus ? (
        <div role="status" style={{ color: 'rgba(0, 0, 0, 0.7)' }}>Loading…</div>
      ) : !isLoggedIn ? (
        <div className="user-study-card" style={{ background: 'rgba(255, 255, 255, 0.6)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(96, 165, 250, 0.35)' }}>
          <h3 style={{ fontSize: '18px', margin: '0 0 12px 0', color: '#1d4ed8' }}>Log in to join the study</h3>
          <p style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.7)', lineHeight: '1.6', margin: '0 0 16px 0' }}>
            Study participation now uses your normal FIGM account and the real Live Scan experience —
            register or log in first, then come back to this page to join.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link href="/auth/login?redirect=%2Fuser-study" style={{ padding: '12px 24px', borderRadius: '8px', background: '#2563eb', color: '#ffffff', textDecoration: 'none', fontWeight: 600 }}>
              Log In
            </Link>
            <Link href="/auth/register" style={{ padding: '12px 24px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', color: 'rgba(0, 0, 0, 0.82)', textDecoration: 'none', fontWeight: 600 }}>
              Register
            </Link>
          </div>
        </div>
      ) : participantCode ? (
        <div className="user-study-card" style={{ background: consentVerified ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.6)', padding: '24px', borderRadius: '12px', border: consentVerified ? '1px solid rgba(96, 165, 250, 0.35)' : '1px solid rgba(96, 165, 250, 0.35)' }}>
          <h3 style={{ fontSize: '18px', margin: '0 0 12px 0', color: '#1d4ed8' }}>
            {consentVerified ? '✅ Consent Verified — You are ' : '👤 You are '}
            <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>{participantCode}</span>
          </h3>
          <p style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.7)', lineHeight: '1.6', margin: '0 0 16px 0' }}>
            {consentVerified
              ? 'Your consent has been verified by the research team. Real scans you run on the Live Scan page from now on are eligible research data.'
              : 'Your enrollment and session-level consent have been recorded. A member of the research team must verify your consent before your scans become eligible research data — this can take a little time.'}
          </p>
          <Link href="/live-scan" style={{ display: 'inline-block', padding: '14px 28px', borderRadius: '8px', background: '#2563eb', color: '#ffffff', textDecoration: 'none', fontWeight: 700 }}>
            ⚡ Go to Live Scan
          </Link>
        </div>
      ) : (
        <div className="user-study-card" style={{ background: 'rgba(255, 255, 255, 0.6)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(96, 165, 250, 0.35)' }}>
          <h3 style={{ fontSize: '18px', margin: '0 0 12px 0', color: '#1d4ed8' }}>📋 Informed Consent</h3>
          <p style={{ fontSize: '14px', color: 'rgba(0, 0, 0, 0.7)', lineHeight: '1.6', margin: '0 0 12px 0' }}>
            Participation is voluntary. Full details: <code>research/CONSENT_FORM.md</code>. Joining links a
            study participant code to your account and records this consent confirmation; a researcher must
            separately verify your consent before any of your scans count as research data.
          </p>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: 'rgba(0, 0, 0, 0.82)', marginBottom: '16px', cursor: 'pointer' }}>
            <input type="checkbox" checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} style={{ marginTop: '3px', width: '18px', height: '18px', flexShrink: 0 }} />
            I have read the study description and voluntarily consent to participate.
          </label>
          <button
            type="button"
            onClick={handleJoinStudy}
            disabled={!consentChecked || joining}
            style={{ padding: '12px 24px', borderRadius: '8px', background: !consentChecked || joining ? '#ffffff' : '#2563eb', color: 'rgba(0, 0, 0, 0.82)', border: 'none', fontSize: '15px', fontWeight: 600, cursor: !consentChecked || joining ? 'not-allowed' : 'pointer', minHeight: '44px' }}
          >
            {joining ? 'Joining…' : 'Join the Study'}
          </button>
        </div>
      )}

      {error && (
        <div role="alert" style={{ marginTop: '16px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '10px', padding: '14px 18px', color: '#1d4ed8', fontSize: '14px' }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
