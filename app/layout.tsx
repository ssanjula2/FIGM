import './globals.css';
import React from 'react';

export const metadata = {
  title: 'FIGM Code Inspector — Framework-independent code intelligence',
  description:
    'FIGM normalizes React, Next.js, Angular and Vue source into a shared quality model: 23 executable rules, diagnostics, AI remediation and empirical evaluation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
