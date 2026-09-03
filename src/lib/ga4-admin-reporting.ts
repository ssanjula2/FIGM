/**
 * GA4 Data API admin-reporting configuration check.
 *
 * The public client-side `NEXT_PUBLIC_GA_MEASUREMENT_ID` (see src/lib/analytics.ts) is enough to
 * load gtag.js in the browser and send events -- it is NOT enough to query GA4's historical
 * Website Analytics data for the Admin dashboard. That requires a separate server-side
 * integration: a GA4 Property ID and an authorized Google service-account credential with GA4
 * Data API access, neither of which this deployment has configured. Rather than fabricate charts
 * from the client-only Measurement ID, the Admin "Website Analytics" surface reports this
 * honestly as "not configured" until that real integration exists.
 */
export interface GA4AdminReportingStatus {
  /** Whether the GA4 Data API (server-side, admin reporting) is fully configured. */
  configured: boolean;
  /** Whether the client-side gtag.js tracking script is configured (independent of the above). */
  clientTrackingConfigured: boolean;
  reason?: string;
}

export function getGA4AdminReportingStatus(): GA4AdminReportingStatus {
  const clientTrackingConfigured = !!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const propertyId = process.env.GA4_PROPERTY_ID;
  const serviceAccountConfigured = !!process.env.GA4_SERVICE_ACCOUNT_KEY;

  if (propertyId && serviceAccountConfigured) {
    return { configured: true, clientTrackingConfigured };
  }

  return {
    configured: false,
    clientTrackingConfigured,
    reason:
      'GA4 Website Analytics is not configured for admin reporting. The public Measurement ID ' +
      'enables client-side tracking only -- querying historical GA4 data for this dashboard ' +
      'requires a separate GA4 Property ID and an authorized Google service-account credential ' +
      '(GA4_PROPERTY_ID, GA4_SERVICE_ACCOUNT_KEY env vars), which are not present in this ' +
      'environment.',
  };
}
