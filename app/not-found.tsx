import Link from 'next/link';

export default function NotFound() {
  return (
    <div
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
          maxWidth: '440px',
          borderRadius: '20px',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 30px rgba(96, 165, 250, 0.08)',
          padding: '40px 32px',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '12px' }} aria-hidden="true">
          🛡️
        </div>
        <h1 style={{ color: 'rgba(0, 0, 0, 0.82)', fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0' }}>
          Page Not Found
        </h1>
        <p style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '14px', margin: '0 0 28px 0', lineHeight: 1.5 }}>
          The page you&apos;re looking for doesn&apos;t exist, or has moved.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: 'rgba(0, 0, 0, 0.82)',
            fontWeight: 700,
            fontSize: '14px',
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
          }}
        >
          Back to Overview
        </Link>
      </div>
    </div>
  );
}
