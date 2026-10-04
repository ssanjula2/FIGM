'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Server-side error boundaries have nothing else logging this by default -- surface it in the
  // browser console at minimum so it isn't silently swallowed.
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[FIGM] Route error boundary caught:', error);
  }, [error]);

  return (
    <div
      role="alert"
      style={{
        minHeight: 'calc(100vh - 120px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '460px',
          borderRadius: '20px',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.1)',
          padding: '40px 32px',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '12px' }} aria-hidden="true">
          ⚠️
        </div>
        <h1 style={{ color: 'rgba(0, 0, 0, 0.82)', fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0' }}>
          Something Went Wrong
        </h1>
        <p style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '14px', margin: '0 0 28px 0', lineHeight: 1.5 }}>
          An unexpected error occurred while loading this page. You can try again, or head back to
          the overview.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: 'rgba(0, 0, 0, 0.82)',
              fontWeight: 700,
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
            }}
          >
            Try Again
          </button>
          <a
            href="/"
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(0, 0, 0, 0.12)',
              color: 'rgba(0, 0, 0, 0.82)',
              fontWeight: 700,
              fontSize: '14px',
              textDecoration: 'none',
            }}
          >
            Back to Overview
          </a>
        </div>
      </div>
    </div>
  );
}
