'use client';

import React, { useState } from 'react';
import Link from 'next/link';

// Compact, sticky landing header (Stage 7C). Every link here is either a real in-page anchor to a
// section that actually exists below, or a real app route -- never an empty placeholder anchor.
const NAV_LINKS = [
  { href: '#product-preview', label: 'Product' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#methodology', label: 'Methodology' },
  { href: '#about', label: 'About' },
];

export default function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 24px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link href="#top" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '7px',
              background: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 900,
              color: '#020617',
            }}
          >
            FI
          </div>
          <span style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc' }}>FIGM Code Inspector</span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Landing page sections" style={{ display: 'flex', alignItems: 'center', gap: '28px' }} className="landing-nav-desktop">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '13px', fontWeight: 600 }}>
              {l.label}
            </a>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="landing-nav-desktop">
          <Link
            href="/auth/login"
            style={{ padding: '9px 16px', fontSize: '13px', fontWeight: 700, color: '#f8fafc', textDecoration: 'none', borderRadius: '8px' }}
          >
            Sign In
          </Link>
          <Link
            href="/auth/register"
            style={{
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#020617',
              background: '#38bdf8',
              textDecoration: 'none',
              borderRadius: '8px',
            }}
          >
            Get Started
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="landing-mobile-nav"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileOpen((v) => !v)}
          className="landing-nav-mobile-toggle"
          style={{
            display: 'none',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px',
            width: '38px',
            height: '38px',
            color: '#f8fafc',
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile nav panel */}
      {mobileOpen && (
        <nav
          id="landing-mobile-nav"
          aria-label="Landing page sections (mobile)"
          className="landing-nav-mobile-panel"
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '16px 24px 20px 24px',
            display: 'none',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              style={{ color: '#e2e8f0', textDecoration: 'none', fontSize: '15px', fontWeight: 600, padding: '10px 0' }}
            >
              {l.label}
            </a>
          ))}
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <Link
              href="/auth/login"
              style={{ flex: 1, textAlign: 'center', padding: '10px', fontSize: '13px', fontWeight: 700, color: '#f8fafc', border: '1px solid rgba(255,255,255,0.15)', textDecoration: 'none', borderRadius: '8px' }}
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              style={{ flex: 1, textAlign: 'center', padding: '10px', fontSize: '13px', fontWeight: 700, color: '#020617', background: '#38bdf8', textDecoration: 'none', borderRadius: '8px' }}
            >
              Get Started
            </Link>
          </div>
        </nav>
      )}

      {/* Responsive rules kept in one inline stylesheet local to this component -- avoids a new
          global CSS dependency for a single breakpoint swap (desktop nav/CTAs <-> mobile toggle). */}
      <style>{`
        @media (max-width: 860px) {
          .landing-nav-desktop { display: none !important; }
          .landing-nav-mobile-toggle { display: flex !important; align-items: center; justify-content: center; }
        }
        .landing-nav-mobile-panel { display: flex; }
        @media (min-width: 861px) {
          .landing-nav-mobile-panel { display: none !important; }
        }
      `}</style>
    </header>
  );
}
