import './globals.css';
import React from 'react';
import Sidebar from './Sidebar';
import HeaderBar from './HeaderBar';

export const metadata = {
  title: 'Code Health Overview — FIGM Code Inspector',
  description: 'Monitor application quality, accessibility, security, and performance in real time.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#030712', color: '#f8fafc', fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}>
        <div className="layout-container">
          {/* Sidebar Navigation */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="main-content-wrapper">
            <HeaderBar />

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
      </body>
    </html>
  );
}
