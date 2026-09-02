'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { GA_MEASUREMENT_ID, GA_ENABLED, trackPageView } from '../../src/lib/analytics';

/**
 * Mounts the GA4 loader script (only when NEXT_PUBLIC_GA_MEASUREMENT_ID is configured AND
 * NODE_ENV=production -- see src/lib/analytics.ts's GA_ENABLED) and fires a manual page_view on
 * every client-side route change (Next.js App Router navigations don't trigger gtag.js's own
 * automatic page_view, which only fires once at initial script load). Renders nothing when GA is
 * not configured -- the app must continue functioning identically either way.
 */
export default function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!GA_ENABLED) return;
    trackPageView(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!GA_ENABLED) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
        `}
      </Script>
    </>
  );
}
