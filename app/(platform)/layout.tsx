import React from 'react';
import Sidebar from '../Sidebar';
import HeaderBar from '../HeaderBar';

export const metadata = {
  title: 'FIGM Code Inspector',
  description: 'Monitor application quality, accessibility, security, and performance in real time.',
};

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
      <Sidebar />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          marginLeft: '260px',
          width: 'calc(100% - 260px)',
        }}
      >
        <HeaderBar />

        <main
          style={{
            flex: 1,
            padding: '36px 40px',
            maxWidth: '1480px',
            width: '100%',
            boxSizing: 'border-box',
            margin: '0 auto',
          }}
        >
          {children}
        </main>

        <footer
          style={{
            padding: '20px 40px',
            fontSize: '12px',
            color: '#64748b',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(9, 13, 22, 0.85)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>Framework Independent Guideline Model (FIGM) &copy; 2026. All rights reserved.</div>
          <div style={{ display: 'flex', gap: '16px', color: '#38bdf8', fontWeight: 600 }}>
            <span>Next.js App Router</span>
            <span>React 18</span>
            <span>Angular 17</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
