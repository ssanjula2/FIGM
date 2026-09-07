'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import AdminSidebar from './AdminSidebar';
import HeaderBar from './HeaderBar';
import { sessionClient, SESSION_EXPIRED_EVENT } from '../src/auth/session-client';

// Routes that must render standalone -- no Sidebar/HeaderBar app chrome around them. These are
// exactly the public, pre-authentication routes (see middleware.ts's isPublicPath): the canonical
// /auth/* pages, their top-level redirect stubs, and the public research/about page. Previously
// AppShell wrapped every route unconditionally, so an unauthenticated visitor on the login page
// saw the authenticated app's Sidebar/HeaderBar (which itself has no real "signed out" state --
// see HeaderBar's profile control) rendered around the login form. The primary product requirement
// is "login/register is the first, standalone experience" -- that requires the chrome to not be
// there at all until a session exists, not just a static/misleading nav.
function isBareRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith('/auth/') ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/about' ||
    // Stage 7C visual-polish pass: the full DSRM/benchmark methodology page, linked from the
    // public landing page and footer -- must render standalone like /about, not wrapped in the
    // authenticated app's Sidebar/HeaderBar chrome (see middleware.ts's isPublicPath, which this
    // list must stay in sync with).
    pathname === '/methodology' ||
    // RQ1 FCP/TTI experiment fixture pages (docs/research/RQ1_EXPERIMENT_PROTOCOL.md) -- must
    // render with no dashboard chrome (Sidebar/HeaderBar) around them, since the experiment
    // measures each fixture's own render/state-management strategy in isolation; the shared
    // AppShell chrome would add identical DOM/JS weight to every condition and mask the
    // intentional differences the experiment exists to measure.
    pathname.startsWith('/rq1-experiment') ||
    // The anonymous real-participant usability study entry point (see middleware.ts's
    // isPublicPath, which this list must stay in sync with) -- an unauthenticated participant must
    // never see the authenticated app's Sidebar/HeaderBar (no real "signed out" state) around the
    // study page.
    pathname === '/user-study'
  );
}

/**
 * Owns the mobile/tablet navigation drawer's open/closed state, shared between HeaderBar (renders
 * the hamburger trigger) and Sidebar (the drawer itself) -- they are siblings, so this state has
 * to live in their nearest common client-component ancestor rather than in either of them alone.
 *
 * Wires up `.sidebar-open` (globals.css), a CSS class that existed and had real slide-in styling
 * defined for it, but was never actually applied to any element anywhere in the app -- below
 * 1024px there was previously no way at all to open the primary navigation.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Resumes (or starts) silent access-token refresh for the lifetime of the app -- see
  // src/auth/session-client.ts's own doc comment for the real production incident this closes.
  // Runs once per app mount (this layout persists across client-side route changes; only a hard
  // page reload re-runs it, which is exactly when the in-memory refresh timer needs resuming from
  // the expiry persisted in storage). A no-op for a visitor with no known session -- never treats
  // an anonymous visitor as authenticated. On a confirmed-dead session (refresh failed, or a
  // non-retriable 401 occurred somewhere in the app), redirects to /auth/login -- the same
  // destination Sidebar's own logout handler already uses, so a session ending because it expired
  // looks the same to the user as choosing to log out.
  useEffect(() => {
    sessionClient.init();
    const handleSessionExpired = () => {
      router.push('/auth/login');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [router]);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    // Return focus to the trigger that opened the drawer -- otherwise a keyboard user closing the
    // menu (via Escape, the in-drawer close button, or a backdrop click) loses their place
    // entirely, with focus reset to the top of the document.
    menuButtonRef.current?.focus();
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((open) => !open);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSidebar();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen, closeSidebar]);

  // Prevent the page behind the drawer from scrolling while it's open on mobile.
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [sidebarOpen]);

  if (isBareRoute(pathname)) {
    return <>{children}</>;
  }

  // The admin/research workspace (see app/admin/layout.tsx, which is the actual server-side
  // access boundary -- this is presentation only) gets its own nav chrome instead of the normal
  // user Sidebar, so an ADMIN's own "Admin Panel" link isn't just another item mixed into every
  // DEVELOPER's workspace nav (the previous state). HeaderBar (search, notifications, account
  // control) is shared -- nothing role-sensitive lives there.
  const isAdminWorkspace = pathname?.startsWith('/admin') ?? false;

  return (
    <div className="layout-container">
      {isAdminWorkspace ? (
        <AdminSidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      ) : (
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      )}

      {/* Backdrop: only rendered while the drawer is open (mobile/tablet only in practice, since
          the drawer is permanently visible and this state has no visual effect on desktop widths
          per globals.css's `@media (max-width: 1023px)` gate). Clicking it closes the menu, same
          as Escape. */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <div className="main-content-wrapper">
        <HeaderBar
          menuButtonRef={menuButtonRef}
          sidebarOpen={sidebarOpen}
          onMenuToggle={toggleSidebar}
        />

        <main className="main-container">
          {children}
        </main>

        <footer className="main-footer">
          <div>
            Framework Independent Guideline Model (FIGM) &copy; 2026. All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: '16px', color: '#38bdf8', fontWeight: 600, flexWrap: 'wrap' }}>
            <span>Next.js App Router</span>
            <span>React 18</span>
            <span>Angular 17</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
