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
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.08)',
          padding: '40px 32px',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '12px' }} aria-hidden="true">
          🛡️
        </div>
        <h1 style={{ color: '#f8fafc', fontSize: '24px', fontWeight: 800, margin: '0 0 8px 0' }}>
          Page Not Found
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 28px 0', lineHeight: 1.5 }}>
          The page you&apos;re looking for doesn&apos;t exist, or has moved.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #0284c7, #2563eb)',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '14px',
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
          }}
        >
          Back to Overview
        </Link>
      </div>
    </div>
  );
}
