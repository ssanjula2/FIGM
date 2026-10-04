'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface AdminSidebarProps {
  /** Whether the mobile/tablet off-canvas sidebar is currently open (< 1024px only -- on desktop
   *  the sidebar is always visible via CSS regardless of this prop, see globals.css's
   *  `.sidebar-desktop` / `.sidebar-open` rules). Mirrors Sidebar.tsx's contract exactly so
   *  AppShell can swap between the two without touching its own open/close state machine. */
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The ADMIN/AUDITOR workspace's own navigation -- deliberately a separate component from the
 * normal-user Sidebar rather than one nav list branching on role. A shared list either leaks
 * admin-only links into every user's chrome (the previous state: a plain "Admin Panel" entry
 * every DEVELOPER saw regardless of role) or grows a maze of role-conditional items that's hard
 * to reason about. The actual access boundary is enforced server-side by app/admin/layout.tsx
 * (and its nested profile/participants layouts) -- this nav is presentation only.
 */
export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const asideRef = useRef<HTMLElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  const handleLogout = async () => {
    onClose();
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Best-effort: even if the network call fails, still clear local state and navigate away.
    }
    try {
      localStorage.removeItem('figm_token');
      localStorage.removeItem('figm_user');
    } catch {
      // localStorage can throw in some privacy-mode browser configurations; logout must not crash.
    }
    router.push('/auth/login');
  };

  // Same focus-trap/keyboard behavior as the user Sidebar -- see that component for the rationale.
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
      groupName: 'RESEARCH & ADMINISTRATION',
      items: [
        { href: '/admin?tab=OVERVIEW', label: 'Admin Overview' },
        { href: '/admin?tab=USERS', label: 'Users' },
        { href: '/admin?tab=PARTICIPANTS', label: 'Participants' },
        { href: '/admin?tab=SCANS', label: 'Global Scan History' },
        { href: '/admin?tab=RESEARCH', label: 'Research Metrics' },
        { href: '/admin?tab=FRAMEWORKS', label: 'Framework Analytics' },
        { href: '/admin?tab=RULES', label: 'Rule Analytics' },
        { href: '/admin?tab=WEBSITE_ANALYTICS', label: 'Website Analytics (GA4)' },
        { href: '/admin?tab=AUDIT', label: 'Audit Logs' },
        { href: '/admin?tab=HEALTH', label: 'System Health' },
      ],
    },
    {
      groupName: 'ACCOUNT',
      items: [
        { href: '/admin/profile', label: 'Admin Profile' },
        { href: '/settings', label: 'Admin Settings' },
        { href: '/', label: 'Back to User Workspace' },
        { href: '/auth/login', label: 'Log out', isLogout: true },
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
        // Distinct from the user workspace's neutral slate background -- a deliberate, subtle
        // visual cue (per Phase 5/13) that this is a different workspace, not just a page within
        // the normal app. Kept dark/glass to match the rest of the design system, not a jarring
        // color swap.
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        borderRight: '1px solid rgba(248, 113, 113, 0.18)',
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <Link href="/admin" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '6px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                color: '#ffffff',
                fontSize: '15px',
                letterSpacing: '0.5px',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.18)',
                flexShrink: 0,
              }}
            >
              FI
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: '15px', color: 'rgba(0, 0, 0, 0.82)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                FIGM Code Inspector
              </div>
              <div style={{ fontSize: '10px', color: '#1d4ed8', fontWeight: 700, lineHeight: 1.2 }}>
                Administrative Workspace
              </div>
            </div>
          </Link>

          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close navigation menu"
            style={{
              display: 'none',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(0, 0, 0, 0.82)',
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
            color: '#1d4ed8',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '8px',
            padding: '6px 10px',
            marginBottom: '20px',
            letterSpacing: '0.5px',
            textAlign: 'center',
          }}
        >
          🛡️ ADMIN / RESEARCH WORKSPACE
        </div>

        <nav aria-label="Admin">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {navGroups.map((group) => (
              <div key={group.groupName}>
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    color: 'rgba(0, 0, 0, 0.7)',
                    letterSpacing: '1px',
                    marginBottom: '8px',
                    paddingLeft: '10px',
                  }}
                >
                  {group.groupName}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {group.items.map((item) => {
                    // '/admin?tab=X' links are active by matching just the pathname (not query --
                    // usePathname() doesn't include it), plus '/admin' itself for the base OVERVIEW
                    // link so *something* shows active when no ?tab is present yet.
                    const isActive =
                      item.href === '/admin/profile'
                        ? pathname === '/admin/profile'
                        : item.href.startsWith('/admin?')
                          ? pathname === '/admin'
                          : pathname === item.href;
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
                      color: isActive ? '#f87171' : 'rgba(0, 0, 0, 0.7)',
                      background: isActive ? 'rgba(248, 113, 113, 0.12)' : 'transparent',
                      border: isActive ? '1px solid rgba(248, 113, 113, 0.3)' : '1px solid transparent',
                      boxShadow: isActive ? '0 0 15px rgba(248, 113, 113, 0.15)' : 'none',
                      textDecoration: 'none',
                      transition: 'all 0.2s ease',
                    };
                    const content = (
                      <>
                        <span>{item.label}</span>

                        {isActive && (
                          <div aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f87171', boxShadow: '0 0 8px #f87171' }} />
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

      <div style={{ borderTop: '1px solid rgba(0, 0, 0, 0.08)', paddingTop: '14px', paddingLeft: '8px', marginTop: '20px' }}>
        <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', fontWeight: 600 }}>
          FIGM Code Inspector v3.0
        </div>
        <div style={{ fontSize: '10px', color: '#1d4ed8', marginTop: '2px', fontWeight: 700 }}>
          Administrative / Research Workspace
        </div>
      </div>
    </aside>
  );
}
