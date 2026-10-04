'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const card: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.65)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(0, 0, 0, 0.08)',
  borderRadius: '14px',
  padding: '20px',
};
const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left' };
const td: React.CSSProperties = { padding: '10px 12px', borderBottom: '1px solid rgba(0, 0, 0, 0.05)' };

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('figm_token') : null;
}

export default function ParticipantDetailPage() {
  const params = useParams<{ participantId: string }>();
  const participantId = params?.participantId as string;

  const [data, setData] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusActionPending, setStatusActionPending] = useState(false);
  const [statusActionError, setStatusActionError] = useState<string | null>(null);

  const loadDetail = () => {
    if (!participantId) return;
    const token = getToken();
    return fetch(`/api/admin/participants/${participantId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (res.status === 401) {
          setAuthError('You must be signed in to view this.');
          return;
        }
        if (res.status === 403) {
          setAuthError('This area requires an ADMIN role account.');
          return;
        }
        if (!res.ok) {
          setAuthError(`Request failed (${res.status}).`);
          return;
        }
        const body = await res.json();
        setData(body.participant);
      });
  };

  useEffect(() => {
    loadDetail()?.finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId]);

  const setResearchStatus = async (status: 'CONSENT_VERIFIED' | 'REVOKED') => {
    setStatusActionPending(true);
    setStatusActionError(null);
    try {
      const token = getToken();
      const res = await fetch(`/api/admin/participants/${participantId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setStatusActionError(body.error || `Request failed (${res.status}).`);
        return;
      }
      await loadDetail();
    } catch {
      setStatusActionError('Request failed.');
    } finally {
      setStatusActionPending(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(0, 0, 0, 0.7)' }}>Loading participant record...</div>;
  }

  if (authError) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛡️</div>
        <h2 style={{ fontSize: '22px', fontWeight: 900, color: 'rgba(0, 0, 0, 0.82)', margin: 0 }}>Access Restricted</h2>
        <p style={{ color: 'rgba(0, 0, 0, 0.7)', marginTop: '8px' }}>{authError}</p>
      </div>
    );
  }

  if (!data) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(0, 0, 0, 0.7)' }}>Not found.</div>;
  }

  const isRegistered = data.status !== 'NOT_REGISTERED';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <Link href="/admin" style={{ color: '#1d4ed8', fontSize: '13px', textDecoration: 'none' }}>
        ← Back to Admin Dashboard
      </Link>
      <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'rgba(0, 0, 0, 0.82)', margin: '12px 0 24px 0' }}>
        Participant {data.participantId}
      </h1>

      {!isRegistered ? (
        <div style={card}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
          <h3 style={{ color: 'rgba(0, 0, 0, 0.82)', margin: '0 0 4px 0' }}>Not Recorded</h3>
          <p style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '13px' }}>
            No real database record exists for this participant identifier. No account has registered under this id, and no scan or submission has ever been logged for it.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* A. Profile */}
          <div style={card}>
            <h3 style={{ margin: '0 0 12px 0', color: 'rgba(0, 0, 0, 0.82)', fontSize: '15px' }}>Profile</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '13px', color: 'rgba(0, 0, 0, 0.7)' }}>
              <div><strong style={{ color: 'rgba(0, 0, 0, 0.82)' }}>Participant ID:</strong> {data.participantId}</div>
              <div><strong style={{ color: 'rgba(0, 0, 0, 0.82)' }}>Linked User ID:</strong> {data.profile.linkedUserId}</div>
              <div><strong style={{ color: 'rgba(0, 0, 0, 0.82)' }}>Account Status:</strong> {data.profile.accountStatus}</div>
              <div><strong style={{ color: 'rgba(0, 0, 0, 0.82)' }}>Created:</strong> {new Date(data.profile.createdAt).toLocaleString()}</div>
              <div><strong style={{ color: 'rgba(0, 0, 0, 0.82)' }}>Last Activity:</strong> {data.profile.lastActivity ? new Date(data.profile.lastActivity).toLocaleString() : 'No Submission'}</div>
            </div>
          </div>

          {/* B. Scan Summary */}
          <div style={card}>
            <h3 style={{ margin: '0 0 12px 0', color: 'rgba(0, 0, 0, 0.82)', fontSize: '15px' }}>Scan Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              {[
                ['Total Scans', data.scanSummary.totalScans],
                ['Successful', data.scanSummary.successfulScans],
                ['Failed', data.scanSummary.failedScans],
                ['Avg Quality Score', data.scanSummary.averageQualityScore ?? '—'],
                ['Avg Scan Time', data.scanSummary.averageScanTimeMs != null ? `${data.scanSummary.averageScanTimeMs} ms` : '—'],
                ['Total Findings', data.scanSummary.totalFindings],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: '#1d4ed8' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* C. Framework Usage */}
          <div style={card}>
            <h3 style={{ margin: '0 0 12px 0', color: 'rgba(0, 0, 0, 0.82)', fontSize: '15px' }}>Framework Usage</h3>
            {data.frameworkUsage.length === 0 ? (
              <div style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '13px' }}>No scans recorded yet.</div>
            ) : (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {data.frameworkUsage.map((f: any) => (
                  <div key={f.framework} style={{ padding: '10px 16px', borderRadius: '10px', background: 'rgba(96, 165, 250, 0.08)', border: '1px solid rgba(96, 165, 250, 0.2)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1d4ed8' }}>{f.framework}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)' }}>{f.count} scan{f.count === 1 ? '' : 's'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* D. Rule Findings */}
          <div style={card}>
            <h3 style={{ margin: '0 0 12px 0', color: 'rgba(0, 0, 0, 0.82)', fontSize: '15px' }}>Rule Findings</h3>
            {data.ruleFindings.length === 0 ? (
              <div style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '13px' }}>No findings recorded yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}>
                      <th style={th}>Rule ID</th>
                      <th style={th}>Severity</th>
                      <th style={th}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ruleFindings.map((f: any) => (
                      <tr key={f.ruleId}>
                        <td style={{ ...td, fontFamily: 'monospace', color: '#1d4ed8' }}>{f.ruleId}</td>
                        <td style={{ ...td, color: 'rgba(0, 0, 0, 0.7)' }}>{f.severity || '—'}</td>
                        <td style={{ ...td, color: 'rgba(0, 0, 0, 0.82)' }}>{f.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* E. Scan History */}
          <div style={card}>
            <h3 style={{ margin: '0 0 12px 0', color: 'rgba(0, 0, 0, 0.82)', fontSize: '15px' }}>Scan History</h3>
            {data.scanHistory.length === 0 ? (
              <div style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '13px' }}>No scans recorded yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ color: 'rgba(0, 0, 0, 0.7)', fontWeight: 800, borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}>
                      <th style={th}>File</th>
                      <th style={th}>Framework</th>
                      <th style={th}>Quality</th>
                      <th style={th}>Findings</th>
                      <th style={th}>Duration</th>
                      <th style={th}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.scanHistory.map((s: any) => (
                      <tr key={s.id}>
                        <td style={{ ...td, fontFamily: 'monospace', color: '#1d4ed8' }}>{s.fileName}</td>
                        <td style={{ ...td, color: 'rgba(0, 0, 0, 0.7)' }}>{s.framework}</td>
                        <td style={{ ...td, color: 'rgba(0, 0, 0, 0.82)' }}>{s.qualityScore}%</td>
                        <td style={{ ...td, color: 'rgba(0, 0, 0, 0.82)' }}>{s.findingCount}</td>
                        <td style={{ ...td, color: 'rgba(0, 0, 0, 0.7)' }}>{s.scanTimeMs?.toFixed(2)} ms</td>
                        <td style={{ ...td, color: 'rgba(0, 0, 0, 0.7)' }}>{new Date(s.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* F. Research Eligibility / Consent */}
          <div style={card}>
            <h3 style={{ margin: '0 0 12px 0', color: 'rgba(0, 0, 0, 0.82)', fontSize: '15px' }}>Research Eligibility</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '13px', color: 'rgba(0, 0, 0, 0.7)', marginBottom: '16px' }}>
              <div>
                <strong style={{ color: 'rgba(0, 0, 0, 0.82)' }}>Status:</strong>{' '}
                {data.profile.researchStatus || 'ASSIGNED'}
              </div>
              <div>
                <strong style={{ color: 'rgba(0, 0, 0, 0.82)' }}>Assigned:</strong>{' '}
                {data.profile.researchAssignedAt ? new Date(data.profile.researchAssignedAt).toLocaleString() : '—'}
              </div>
              <div>
                <strong style={{ color: 'rgba(0, 0, 0, 0.82)' }}>Consent verified:</strong>{' '}
                {data.profile.researchConsentVerifiedAt ? new Date(data.profile.researchConsentVerifiedAt).toLocaleString() : 'NOT VERIFIED'}
              </div>
            </div>
            <p style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '12px', marginBottom: '12px' }}>
              Consent is collected off-platform (external questionnaire); marking it verified here records that a
              researcher reconciled a real submission against this participant id -- it is never set automatically.
              No independently-collected research record (questionnaire, task response) is displayed here beyond
              that reconciliation state.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={statusActionPending || data.profile.researchStatus === 'CONSENT_VERIFIED'}
                onClick={() => setResearchStatus('CONSENT_VERIFIED')}
                style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.15)', color: '#1d4ed8', border: '1px solid rgba(59, 130, 246, 0.35)', cursor: statusActionPending ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 700 }}
              >
                Mark Consent Verified
              </button>
              <button
                type="button"
                disabled={statusActionPending || data.profile.researchStatus === 'REVOKED'}
                onClick={() => setResearchStatus('REVOKED')}
                style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(248,113,113,0.15)', color: '#1d4ed8', border: '1px solid rgba(248,113,113,0.35)', cursor: statusActionPending ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 700 }}
              >
                Revoke Assignment
              </button>
            </div>
            {statusActionError && (
              <p role="alert" style={{ color: '#b91c1c', fontSize: '12px', marginTop: '10px' }}>{statusActionError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
