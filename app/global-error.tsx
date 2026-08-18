'use client';

// Only triggers if the ROOT layout itself throws (app/layout.tsx / AppShell) -- everything else is
// caught by the nearer app/error.tsx boundary, which still renders inside the normal app chrome.
// Because the root layout is what's broken, this file must render its own complete <html>/<body>
// and intentionally avoids depending on globals.css or any other app module that could itself be
// part of what's failing -- inline styles only, kept deliberately minimal.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#030712',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        <div role="alert" style={{ maxWidth: '440px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }} aria-hidden="true">
            🛡️
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px 0' }}>
            FIGM Code Inspector
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px 0', lineHeight: 1.5 }}>
            A critical error occurred and the application could not load. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
