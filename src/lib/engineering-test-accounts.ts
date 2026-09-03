/**
 * Stage 7C/7D engineering-test-data separation (Section 20/6). Identifies accounts created for
 * engineering QA (e.g. this project's own Stage 7B/7C hardening-pass browser walkthroughs) so
 * their scan/report/activity records can be excluded from admin-wide and research-facing
 * aggregates -- without conflating them with either normal product users or real research-study
 * participants (`User.researchStatus`, `@user-study.figm.local`, already handled separately in
 * `DashboardRepository.getActivityFeed`).
 *
 * Stage 7D applied the `20260903072448_add_account_type` migration and re-ran `prisma generate`
 * (verified via a direct information_schema query before this file was touched -- see
 * docs/audit/STAGE_7D_VERCEL_PREVIEW_AND_FREEZE_V2_REPORT.md), so `User.accountType` is now a real,
 * queryable column. `isEngineeringTestAccount` below is the current canonical check: it trusts the
 * persisted `accountType` column first, and falls back to the original email-convention match only
 * to keep the 9 pre-migration accounts (created before this column existed, so they all defaulted
 * to `NORMAL` on migration) still correctly excluded without a manual backfill. `isEngineeringTestEmail`
 * is kept as the narrower, email-only primitive both for that fallback and for call sites (like the
 * public audit-log feed below) that only have an email string, not a full user/account-type row.
 */

const ENGINEERING_TEST_EMAIL_PATTERNS = [/^engtest[._-]/i, /^curltest/i];

export function isEngineeringTestEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ENGINEERING_TEST_EMAIL_PATTERNS.some((p) => p.test(email));
}

/**
 * Canonical engineering-test-account check. Prefers the real, server-controlled `accountType`
 * column (see app/api/admin/users/route.ts PATCH -- the only trusted path that can set it); falls
 * back to the email convention for accounts created before that column was wired in.
 */
export function isEngineeringTestAccount(user: { email?: string | null; accountType?: string | null } | undefined | null): boolean {
  if (!user) return false;
  if (user.accountType === 'ENGINEERING_TEST') return true;
  return isEngineeringTestEmail(user.email);
}
