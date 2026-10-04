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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('figm_theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.backgroundColor='#000000';document.documentElement.style.color='#ffffff';}}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning style={{ margin: 0, padding: 0, background: '#ffffff', color: 'rgba(0, 0, 0, 0.82)', fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}>
        <GoogleAnalytics />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
