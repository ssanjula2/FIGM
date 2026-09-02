'use client';

/**
 * Central, typed Google Analytics 4 event abstraction.
 *
 * Supplementary behavioral telemetry only -- per the supervisor's instruction to incorporate GA4
 * into the analysis component. GA4 data MUST NEVER be treated as a substitute for, or presented
 * as equivalent to, the SUS/Cronbach's-alpha survey results, the independent expert Precision/
 * Recall/F1 evaluation, or a real FCP/TTI runtime experiment -- see
 * research/audits/FIGM_PRE_DATA_COLLECTION_AUDIT.md Section 14 (Analysis Plan) for how this
 * evidence stream is meant to be kept separate from those.
 *
 * Every exported function below has an explicit, closed, named-fields signature -- never a
 * spread of arbitrary caller-supplied data -- specifically so a field like `code`/`email`/
 * `password`/`token`/`cookie`/`apiKey` structurally cannot pass through into an analytics
 * payload; there is no parameter slot for it to occupy. See
 * tests/analytics-payload-safety.test.ts for the regression guard that enforces this.
 */

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
  }
}

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

/** Events are only ever sent in production with a measurement ID configured -- local dev/test
 *  runs must never write to the real GA4 property, regardless of what .env.local happens to
 *  contain. */
export const GA_ENABLED = GA_MEASUREMENT_ID.length > 0 && process.env.NODE_ENV === 'production';

function send(eventName: string, params: Record<string, string | number | boolean>): void {
  if (!GA_ENABLED) return;
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params);
}

/** Manual page_view -- Next.js App Router client-side navigations do not trigger a fresh page
 *  load, so gtag.js's own automatic page_view (fired once at initial script load) misses every
 *  subsequent route change. `path` is a route path only (e.g. "/live-scan"), never a full URL
 *  with query parameters that could carry a token or other sensitive value. */
export function trackPageView(path: string): void {
  send('page_view', { page_path: path });
}

export function trackScanStarted(params: { framework: string; source: 'live_scan' | 'user_study' | 'submission' }): void {
  send('scan_started', { framework: params.framework, source: params.source });
}

export function trackScanCompleted(params: {
  framework: string;
  ruleCount: number;
  durationMs: number;
  source: 'live_scan' | 'user_study' | 'submission';
}): void {
  send('scan_completed', {
    framework: params.framework,
    rule_count: params.ruleCount,
    duration_ms: Math.round(params.durationMs),
    source: params.source,
  });
}

export function trackFixApplied(params: { ruleId: string; strategy: 'DETERMINISTIC' | 'AI_ASSISTED' }): void {
  send('fix_applied', { rule_id: params.ruleId, strategy: params.strategy });
}

export function trackFixVerified(params: { ruleId: string; verified: boolean }): void {
  send(params.verified ? 'fix_verified' : 'fix_rejected', { rule_id: params.ruleId });
}

export function trackUserStudyTaskStarted(params: { framework: string }): void {
  send('user_study_task_started', { framework: params.framework });
}

export function trackUserStudyTaskCompleted(params: { framework: string; success: boolean }): void {
  send('user_study_task_completed', { framework: params.framework, success: params.success });
}
