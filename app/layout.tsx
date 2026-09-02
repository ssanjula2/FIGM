import './globals.css';
import React from 'react';
import AppShell from './AppShell';
import GoogleAnalytics from './components/GoogleAnalytics';

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
        <GoogleAnalytics />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
