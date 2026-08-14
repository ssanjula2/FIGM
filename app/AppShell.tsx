'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import HeaderBar from './HeaderBar';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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

  return (
    <div className="layout-container">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

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
