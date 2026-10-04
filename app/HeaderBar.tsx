'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotifications } from '../src/hooks/useNotifications';
import { useGlobalSearch } from '../src/hooks/useGlobalSearch';

import { useScans } from '../src/hooks/useScans';

interface HeaderBarProps {
  menuButtonRef: React.RefObject<HTMLButtonElement>;
  sidebarOpen: boolean;
  onMenuToggle: () => void;
}

interface StoredUser {
  fullName?: string;
  email?: string;
  avatarUrl?: string;
}

export default function HeaderBar({ menuButtonRef, sidebarOpen, onMenuToggle }: HeaderBarProps) {
  const pathname = usePathname();
  // Inside the admin/research workspace, the account control should land on the admin's own
  // administrative profile (/admin/profile) rather than the normal-user /profile page it points to
  // everywhere else -- see app/admin/profile/page.tsx and Phase 6's explicit separation.
  const profileHref = pathname?.startsWith('/admin') ? '/admin/profile' : '/profile';
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { isOpen: isSearchOpen, setIsOpen: setIsSearchOpen, query, setQuery, results, loading: searchLoading } = useGlobalSearch();
  const { records } = useScans();

  const searchTriggerRef = useRef<HTMLDivElement>(null);
  const searchDialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // The real signed-in user's identity for the profile control below -- previously this always
  // rendered the literal text "LOGIN" regardless of who was actually signed in, even though the
  // real name/email is written to localStorage by both auth pages at login/registration time (see
  // app/auth/login/page.tsx, app/auth/register/page.tsx).
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('figm_user');
      if (raw) setCurrentUser(JSON.parse(raw));
    } catch {
      // Corrupt/inaccessible localStorage -- fall back to the generic label below.
    }

    const token = localStorage.getItem('figm_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch('/api/profile', { headers })
      .then(async (response) => response.ok ? response.json() : null)
      .then((profile) => {
        if (profile?.user) setCurrentUser(profile.user);
      })
      .catch(() => undefined);

    const handleAvatarUpdated = (event: Event) => {
      const avatarUrl = (event as CustomEvent<{ avatarUrl: string }>).detail?.avatarUrl;
      if (typeof avatarUrl === 'string') {
        setCurrentUser((user) => user ? { ...user, avatarUrl } : user);
      }
    };
    window.addEventListener('figm:avatar-updated', handleAvatarUpdated);
    return () => window.removeEventListener('figm:avatar-updated', handleAvatarUpdated);
  }, []);

  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('figm_theme');
      if (saved === 'dark' || saved === 'light') {
        setTheme(saved);
      }
    } catch {}

    const handleThemeChange = (e: Event) => {
      const newTheme = (e as CustomEvent<string>).detail;
      if (newTheme === 'dark' || newTheme === 'light') {
        setTheme(newTheme);
      }
    };
    window.addEventListener('figm-theme-change', handleThemeChange);
    return () => window.removeEventListener('figm-theme-change', handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      localStorage.setItem('figm_theme', nextTheme);
    } catch {}
    window.dispatchEvent(new CustomEvent('figm-theme-change', { detail: nextTheme }));
  };

  const displayName = currentUser?.fullName || currentUser?.email || 'Account';
  const displayInitial = displayName.trim().charAt(0).toUpperCase() || '?';

  // The most recent scan only (useScans() defaults to sortBy=createdAt/sortOrder=desc, so
  // records[0] is the latest) -- not an average across every scan ever run. Previously this
  // averaged every record with a `|| 90` fallback (masking a real 0% score back to a fabricated
  // 90 percent) and fell back to a hardcoded 90-percent "PASSED" badge for a brand-new account
  // with zero real scans, presenting an invented result as if it were measured. `null` now means "no scans
  // yet" and is rendered as an honest no-data state below, never a fake percentage.
  const latestScan = records.length > 0 ? records[0] : null;
  const dynamicScore = typeof latestScan?.qualityScore === 'number' ? latestScan.qualityScore : null;
  const passed = dynamicScore !== null && dynamicScore >= 70;

  // Cmd+K search modal keyboard behavior: focus moves into the dialog on open (the input),
  // Escape closes it, Tab/Shift+Tab cycle within the dialog's own focusable elements only (a
  // proper focus trap -- aria-modal="true" alone does not actually prevent Tab from reaching
  // content behind the dimmed backdrop), and focus returns to the search trigger on close.
  useEffect(() => {
    if (!isSearchOpen) return;

    // Captured now, not read from the ref inside cleanup below -- by the time cleanup runs,
    // `searchTriggerRef.current` could in principle point at a different node than the one that
    // was actually focused when this effect opened the dialog.
    const triggerEl = searchTriggerRef.current;
    searchInputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        return;
      }

      if (e.key !== 'Tab' || !searchDialogRef.current) return;
      const focusable = searchDialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled])'
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
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      triggerEl?.focus();
    };
  }, [isSearchOpen, setIsSearchOpen]);

  return (
    <>
      <header className="header-bar-container">
        {/* Mobile/Tablet Navigation Toggle -- hidden on desktop via .mobile-menu-toggle's CSS
            (globals.css), visible below 1024px where the primary sidebar is off-canvas. */}
        <button
          type="button"
          ref={menuButtonRef}
          className="mobile-menu-toggle"
          onClick={onMenuToggle}
          aria-expanded={sidebarOpen}
          aria-controls="primary-navigation"
          aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '8px',
            width: '36px',
            height: '36px',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(0, 0, 0, 0.82)',
            fontSize: '18px',
            cursor: 'pointer',
            flexShrink: 0,
            marginRight: '12px',
          }}
        >
          <span aria-hidden="true">{sidebarOpen ? '✕' : '☰'}</span>
        </button>

        {/* Search Bar Trigger */}
        <div
          ref={searchTriggerRef}
          role="button"
          tabIndex={0}
          aria-label="Open global search"
          onClick={() => setIsSearchOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsSearchOpen(true);
            }
          }}
          style={{ position: 'relative', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <span style={{ position: 'absolute', left: '14px', color: 'rgba(0, 0, 0, 0.7)', fontSize: '14px' }}>🔍</span>
          <input
            type="text"
            readOnly
            placeholder="Search projects, reports, rules, users..."
            className="search-input"
            style={{ pointerEvents: 'none' }}
          />
          <div style={{ position: 'absolute', right: '12px', fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', background: 'rgba(255, 255, 255, 0.06)', padding: '2px 7px', borderRadius: '6px', border: '1px solid rgba(0, 0, 0, 0.1)', fontWeight: 600 }}>
            ⌘K
          </div>
        </div>

        {/* Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* DevSecOps Live Quality Score Status Bar Badge -- this user's latest scan only */}
          <Link
            href="/history"
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: dynamicScore === null ? 'rgba(255, 255, 255, 0.12)' : passed ? 'rgba(96, 165, 250, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: dynamicScore === null ? '1px solid rgba(0, 0, 0, 0.3)' : passed ? '1px solid rgba(96, 165, 250, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 700,
              color: dynamicScore === null ? 'rgba(0, 0, 0, 0.7)' : passed ? '#60a5fa' : '#ef4444',
              boxShadow: dynamicScore === null ? 'none' : passed ? '0 0 16px rgba(96, 165, 250, 0.2)' : '0 0 16px rgba(239, 68, 68, 0.2)',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dynamicScore === null ? '#ffffff' : passed ? '#60a5fa' : '#ef4444', boxShadow: dynamicScore === null ? 'none' : passed ? '0 0 10px #60a5fa' : '0 0 10px #ef4444' }}></span>
            {dynamicScore === null ? (
              <span>🛡️ No scans yet</span>
            ) : (
              <span>🛡️ Latest Scan: <b>{dynamicScore}% ({passed ? 'PASSED ✅' : 'FAILED ❌'})</b></span>
            )}
          </Link>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              cursor: 'pointer',
              color: 'inherit',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
            title={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
            aria-label={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Notification Bell */}
          <div style={{ position: 'relative' }}>
            <div
              role="button"
              tabIndex={0}
              aria-label="Notifications"
              aria-haspopup="true"
              aria-expanded={showNotifDropdown}
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setShowNotifDropdown(!showNotifDropdown);
                }
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
                color: 'rgba(0, 0, 0, 0.7)',
                cursor: 'pointer',
              }}
            >
              🔔
            </div>

            {unreadCount > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  minWidth: '16px',
                  height: '16px',
                  borderRadius: '10px',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  boxShadow: '0 0 8px #ef4444',
                }}
              >
                {unreadCount}
              </div>
            )}

            {/* Notification Dropdown Drawer */}
            {showNotifDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '48px',
                  right: '0',
                  width: 'min(360px, calc(100vw - 24px))',
                  background: '#ffffff',
                  border: '1px solid rgba(0, 0, 0, 0.15)',
                  borderRadius: '16px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.14)',
                  padding: '16px',
                  zIndex: 50,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.82)', margin: 0 }}>Notifications</h4>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      style={{ background: 'none', border: 'none', color: '#1d4ed8', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(0, 0, 0, 0.7)', fontSize: '12px' }}>
                      No notifications
                    </div>
                  ) : (
                    notifications.slice(0, 5).map((n) => (
                      <div
                        key={n.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => markAsRead(n.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            markAsRead(n.id);
                          }
                        }}
                        style={{
                          background: n.read ? 'transparent' : 'rgba(96, 165, 250, 0.08)',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(0, 0, 0, 0.05)',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: n.read ? 600 : 800, color: 'rgba(0, 0, 0, 0.82)' }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)', marginTop: '2px' }}>
                          {n.message}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ borderTop: '1px solid rgba(0, 0, 0, 0.08)', paddingTop: '10px', marginTop: '10px', textAlign: 'center' }}>
                  <Link
                    href="/notifications"
                    onClick={() => setShowNotifDropdown(false)}
                    style={{ fontSize: '12px', color: '#1d4ed8', textDecoration: 'none', fontWeight: 700 }}
                  >
                    View All Notifications &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <Link href={profileHref} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '13px',
                boxShadow: '0 0 12px rgba(96, 165, 250, 0.4)',
              }}
            >
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
                />
              ) : displayInitial}
            </div>
            <div style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'rgba(0, 0, 0, 0.82)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </div>
            </div>
          </Link>
        </div>
      </header>

      {/* Global Cmd+K Search Modal */}
      {isSearchOpen && (
        <div
          role="presentation"
          onClick={() => setIsSearchOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.35)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '100px',
            zIndex: 100,
          }}
        >
          <div
            ref={searchDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              border: '1px solid rgba(0, 0, 0, 0.15)',
              borderRadius: '20px',
              maxWidth: '650px',
              width: '100%',
              boxShadow: '0 10px 28px rgba(0, 0, 0, 0.16)',
              overflow: 'hidden',
            }}
          >
            {/* Input Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0, 0, 0, 0.08)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '18px', color: 'rgba(0, 0, 0, 0.7)' }}>🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Type to search projects, reports, rules, users..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: 'rgba(0, 0, 0, 0.82)',
                  fontSize: '16px',
                  fontWeight: 600,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => setIsSearchOpen(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(0, 0, 0, 0.7)', fontSize: '16px', cursor: 'pointer' }}
              >
                esc
              </button>
            </div>

            {/* Results Body */}
            <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '16px 20px' }}>
              {searchLoading && (
                <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(0, 0, 0, 0.7)' }}>Searching FIGM Code Inspector registry...</div>
              )}

              {!searchLoading && query.trim() === '' && (
                <div style={{ color: 'rgba(0, 0, 0, 0.7)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                  Search across Projects, Scan Reports, 50 FIGM Guidelines, Repositories, and System Users.
                </div>
              )}

              {!searchLoading && query.trim() !== '' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Projects Results */}
                  {results.projects.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', marginBottom: '8px' }}>
                        PROJECTS ({results.projects.length})
                      </div>
                      {results.projects.map((p: any) => (
                        <Link
                          key={p.id}
                          href="/projects"
                          onClick={() => setIsSearchOpen(false)}
                          style={{ display: 'block', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', color: 'rgba(0, 0, 0, 0.82)', textDecoration: 'none', marginBottom: '6px' }}
                        >
                          <strong style={{ fontSize: '13px' }}>{p.name}</strong> &bull; <span style={{ color: '#1d4ed8', fontSize: '12px' }}>{p.framework}</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Scans Results */}
                  {results.scans.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', marginBottom: '8px' }}>
                        REPORTS & SCANS ({results.scans.length})
                      </div>
                      {results.scans.map((s: any) => (
                        <Link
                          key={s.id}
                          href={`/reports/${s.id}`}
                          onClick={() => setIsSearchOpen(false)}
                          style={{ display: 'block', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', color: 'rgba(0, 0, 0, 0.82)', textDecoration: 'none', marginBottom: '6px' }}
                        >
                          <strong style={{ fontSize: '13px', fontFamily: 'JetBrains Mono' }}>{s.fileName}</strong> &bull; Score: <span style={{ color: '#1d4ed8' }}>{s.qualityScore}%</span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Rules Results */}
                  {results.rules.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', marginBottom: '8px' }}>
                        FIGM SPECIFICATION RULES ({results.rules.length})
                      </div>
                      {results.rules.map((r: any) => (
                        <Link
                          key={r.ruleId}
                          href="/guidelines"
                          onClick={() => setIsSearchOpen(false)}
                          style={{ display: 'block', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', color: 'rgba(0, 0, 0, 0.82)', textDecoration: 'none', marginBottom: '6px' }}
                        >
                          <strong style={{ fontSize: '13px', color: '#1d4ed8' }}>[{r.ruleId}] {r.name}</strong>
                          <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.7)' }}>{r.description}</div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Users Results */}
                  {results.users.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', marginBottom: '8px' }}>
                        ADMIN USERS REGISTRY ({results.users.length})
                      </div>
                      {results.users.map((u: any) => (
                        <Link
                          key={u.id}
                          href="/admin"
                          onClick={() => setIsSearchOpen(false)}
                          style={{ display: 'block', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.04)', color: 'rgba(0, 0, 0, 0.82)', textDecoration: 'none', marginBottom: '6px' }}
                        >
                          <strong style={{ fontSize: '13px' }}>{u.fullName}</strong> ({u.email}) &bull; <span style={{ color: '#1d4ed8' }}>{u.role}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
