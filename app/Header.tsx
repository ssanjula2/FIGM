'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Overview', icon: '📊' },
    { href: '/diagnostics', label: 'Issue Explorer', icon: '🔍' },
    { href: '/guidelines', label: 'Rule Book', icon: '📚' },
    { href: '/live-scan', label: 'Live Inspector', icon: '⚡' },
    { href: '/profile', label: 'My Profile', icon: '👤' },
    { href: '/login', label: 'Sign In', icon: '🔒' },
  ];

  return (
    <header
      className="glass-panel"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        borderRadius: 0,
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        padding: '14px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(9, 13, 22, 0.85)',
      }}
    >
      {/* Brand Logo */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '800',
            color: '#090d16',
            fontSize: '18px',
            boxShadow: '0 0 16px rgba(56, 189, 248, 0.4)',
          }}
        >
          ⚡
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 800, fontSize: '19px', letterSpacing: '-0.4px', color: '#f8fafc' }}>
              Code Health Inspector
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
              Next.js &bull; React &bull; Angular
            </span>
            <span className="badge badge-domain" style={{ fontSize: '10px', padding: '2px 8px' }}>
              Multi-Tenant Security
            </span>
          </div>
        </div>
      </Link>

      {/* Dynamic Navigation Tabs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${isActive ? 'active' : ''}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
