'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

  const navGroups = [
    {
      groupName: 'WORKSPACE',
      items: [
        { href: '/projects', label: 'Projects Workspace', icon: '📦' },
        { href: '/dashboard', label: 'Overview', icon: '📊' },
        { href: '/live-scan', label: 'Live Scan', icon: '⚡' },
        { href: '/diagnostics', label: 'Diagnostics', icon: '🔍' },
        { href: '/ai-fix', label: 'AI Fix Assistant', icon: '🤖' },
        { href: '/profiler', label: 'Runtime Profiler', icon: '⏱️' },
      ],
    },
    {
      groupName: 'INSIGHT',
      items: [
        { href: '/guidelines', label: 'Guidelines', icon: '📚' },
        { href: '/analytics', label: 'Performance Analytics', icon: '📈' },
        { href: '/accessibility', label: 'Accessibility', icon: '♿' },
        { href: '/performance', label: 'Web Vitals', icon: '⚡' },
        { href: '/history', label: 'Scan History', icon: '📜' },
        { href: '/user-study', label: 'User Usability Study', icon: '📝' },
        { href: '/notifications', label: 'Notifications', icon: '🔔' },
      ],
    },
    {
      groupName: 'ACCOUNT & ADMIN',
      items: [
        { href: '/security', label: 'Tenant Security', icon: '🛡️' },
        { href: '/admin', label: 'Admin Panel', icon: '⚙️' },
        { href: '/profile', label: 'User Profile', icon: '👤' },
        { href: '/settings', label: 'Settings', icon: '🔧' },
        { href: '/login', label: 'Log out', icon: '🚪' },
      ],
    },
  ];

  return (
    <aside
      className="sidebar-desktop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '260px',
        minWidth: '260px',
        maxWidth: '260px',
        height: '100vh',
        background: 'rgba(9, 13, 22, 0.95)',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        overflowY: 'auto',
        flexShrink: 0,
        zIndex: 50,
      }}
    >
      <div>
        {/* Brand Header */}
        <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px', paddingLeft: '6px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #38bdf8 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#030712',
              fontSize: '15px',
              letterSpacing: '0.5px',
              boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)',
              flexShrink: 0,
            }}
          >
            FI
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: '18px', color: '#f8fafc', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              FIGM SaaS
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, lineHeight: 1.2 }}>
              Production SaaS Platform
            </div>
          </div>
        </Link>

        {/* Navigation Link Groups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {navGroups.map((group) => (
            <div key={group.groupName}>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#64748b',
                  letterSpacing: '1px',
                  marginBottom: '8px',
                  paddingLeft: '10px',
                }}
              >
                {group.groupName}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#38bdf8' : '#94a3b8',
                        background: isActive ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                        border: isActive ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                        boxShadow: isActive ? '0 0 15px rgba(56, 189, 248, 0.15)' : 'none',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '15px' }}>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>

                      {isActive && (
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer System Badge */}
      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px', paddingLeft: '8px', marginTop: '20px' }}>
        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
          FIGM SaaS Platform v3.0
        </div>
        <div style={{ fontSize: '10px', color: '#38bdf8', marginTop: '2px', fontWeight: 700 }}>
          ISO/IEC 25010 &bull; WCAG 2.2 AA
        </div>
      </div>
    </aside>
  );
}
