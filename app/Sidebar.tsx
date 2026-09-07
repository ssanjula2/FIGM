'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { sessionClient } from '../src/auth/session-client';

interface SidebarProps {
  /** Whether the mobile/tablet off-canvas sidebar is currently open (< 1024px only -- on desktop
   *  the sidebar is always visible via CSS regardless of this prop, see globals.css's
   *  `.sidebar-desktop` / `.sidebar-open` rules). */
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const asideRef = useRef<HTMLElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // Whether the signed-in user is an ADMIN -- read the same way HeaderBar reads the display name,
  // from the localStorage copy both auth pages write at login/registration time. This is only used
  // to decide whether to show a link *into* the admin workspace; the actual boundary is enforced
  // server-side by app/admin/layout.tsx, so a forged/absent value here can at most hide or show a
  // link, never grant access.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('figm_user');
      if (raw) setIsAdmin(JSON.parse(raw)?.role === 'ADMIN');
    } catch {
      // Corrupt/inaccessible localStorage -- default to not showing the admin link.
    }
  }, []);

  // Previously just a plain nav link to /login (the app's OLDER, duplicate auth page) with no
  // actual logout behavior at all -- clicking it left the real httpOnly session cookie fully
  // valid server-side. This calls the real logout endpoint (clears the httpOnly cookies, revokes
  // the stored refresh token, audit-logs the event -- see app/api/auth/logout/route.ts, which
  // existed but had zero UI callers anywhere in the app before this), clears the client-side
  // localStorage copy of the token/user the login pages themselves set, then navigates to the
  // canonical /auth/login route.
  const handleLogout = async () => {
    onClose();
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Best-effort: even if the network call fails, still clear local state and navigate away --
      // a user clicking "Log out" must never be left looking logged-in.
    }
    try {
      localStorage.removeItem('figm_token');
      localStorage.removeItem('figm_user');
    } catch {
      // localStorage can throw in some privacy-mode browser configurations; logout must not crash.
    }
    // Cancels any pending silent-refresh timer and marks this session explicitly logged out, so a
    // stray already-scheduled refresh (or a later 401 from some in-flight request) can never
    // silently re-establish a session after the user chose to log out -- see
    // src/auth/session-client.ts's markLoggedOut doc comment.
    sessionClient.markLoggedOut();
    router.push('/auth/login');
  };

  // Focus the first nav link the moment the mobile drawer opens, and trap Tab/Shift+Tab within it
  // while open -- without this, a keyboard user who opens the menu keeps tabbing through content
  // hidden behind the drawer instead of the drawer's own links.
  useEffect(() => {
    if (!isOpen) return;
    firstLinkRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !asideRef.current) return;
      const focusable = asideRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const navGroups = [
    {
      groupName: 'WORKSPACE',
      items: [
        { href: '/projects', label: 'Projects Workspace', icon: '📦' },
        { href: '/', label: 'Overview', icon: '📊' },
        { href: '/live-scan', label: 'Live Scan', icon: '⚡' },
        { href: '/diagnostics', label: 'Diagnostics', icon: '🔍' },
        { href: '/profiler', label: 'Runtime Profiler', icon: '⏱️' },
      ],
    },
    {
      groupName: 'INSIGHT',
      items: [
        { href: '/guidelines', label: 'Guidelines', icon: '📚' },
        { href: '/analytics', label: 'Performance Analytics', icon: '📈' },
        { href: '/accessibility', label: 'Accessibility', icon: '♿' },
        { href: '/performance', label: 'Static Analysis Timing', icon: '⚡' },
        { href: '/history', label: 'Scan History', icon: '📜' },
        { href: '/notifications', label: 'Notifications', icon: '🔔' },
      ],
    },
    {
      groupName: 'ACCOUNT',
      items: [
        { href: '/profile', label: 'My Profile', icon: '👤' },
        { href: '/settings', label: 'Settings', icon: '🔧' },
        // Only ever shown to an authenticated ADMIN (see isAdmin above) -- a normal user's own
        // workspace nav must never surface a link into the admin/research workspace at all, per
        // the role-separation requirement this replaces the old unconditional "Admin Panel" link
        // to satisfy: previously every DEVELOPER saw this link regardless of role.
        ...(isAdmin ? [{ href: '/admin', label: 'Admin Workspace', icon: '🛡️' }] : []),
        { href: '/auth/login', label: 'Log out', icon: '🚪', isLogout: true },
      ],
    },
  ];

  let firstLinkAssigned = false;

  return (
    <aside
      ref={asideRef}
      id="primary-navigation"
      className={`sidebar-desktop${isOpen ? ' sidebar-open' : ''}`}
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
        {/* Brand Header + mobile-only close button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '6px' }}>
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
              <div style={{ fontWeight: 900, fontSize: '15px', color: '#f8fafc', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                FIGM Code Inspector
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, lineHeight: 1.2 }}>
                Research & Developer Tool
              </div>
            </div>
          </Link>

          {/* Only rendered/visible on mobile/tablet via .sidebar-close-btn's CSS (globals.css) --
              gives keyboard/touch users an explicit, discoverable way to close the drawer beyond
              Escape or the backdrop. */}
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close navigation menu"
            style={{
              display: 'none',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f8fafc',
              fontSize: '16px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div
          role="note"
          aria-label="Workspace indicator"
          style={{
            fontSize: '10px',
            fontWeight: 800,
            color: '#7dd3fc',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '8px',
            padding: '6px 10px',
            marginBottom: '20px',
            letterSpacing: '0.5px',
            textAlign: 'center',
          }}
        >
          👤 MY WORKSPACE
        </div>

        {/* Navigation Link Groups */}
        <nav aria-label="Primary">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {navGroups.map((group) => (
              <div key={group.groupName}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    color: '#7c8ba6',
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
                    const isFirst = !firstLinkAssigned;
                    if (isFirst) firstLinkAssigned = true;
                    const itemStyle: React.CSSProperties = {
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
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
                    };
                    const content = (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span aria-hidden="true" style={{ fontSize: '15px' }}>{item.icon}</span>
                          <span>{item.label}</span>
                        </div>

                        {isActive && (
                          <div aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
                        )}
                      </>
                    );
                    if ((item as { isLogout?: boolean }).isLogout) {
                      return (
                        <button
                          key={item.href}
                          ref={isFirst ? (firstLinkRef as unknown as React.Ref<HTMLButtonElement>) : undefined}
                          type="button"
                          onClick={handleLogout}
                          style={{ ...itemStyle, cursor: 'pointer', background: 'transparent', border: '1px solid transparent', font: 'inherit', textAlign: 'left' }}
                        >
                          {content}
                        </button>
                      );
                    }
                    return (
                      <Link
                        key={item.href}
                        ref={isFirst ? firstLinkRef : undefined}
                        href={item.href}
                        onClick={onClose}
                        aria-current={isActive ? 'page' : undefined}
                        style={itemStyle}
                      >
                        {content}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>
      </div>

      {/* Footer System Badge */}
      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px', paddingLeft: '8px', marginTop: '20px' }}>
        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
          FIGM Code Inspector v3.0
        </div>
        <div style={{ fontSize: '10px', color: '#38bdf8', marginTop: '2px', fontWeight: 700 }}>
          ISO/IEC 25010 Aligned &bull; WCAG 2.2 AA Designed
        </div>
      </div>
    </aside>
  );
}
