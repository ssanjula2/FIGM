/**
 * Stage 7C/7D engineering-test-data cleanup (Section 21/7-8).
 *
 * Identifies accounts created during this project's own hardening-pass browser walkthroughs
 * (Stage 7B/7C) via the canonical isEngineeringTestAccount check (src/lib/engineering-test-accounts.ts):
 * the real, persisted `accountType === 'ENGINEERING_TEST'` column first, falling back to the
 * `engtest.*` / `curltest*` email convention for the pre-migration rows that predate the column.
 *
 * SAFE BY DEFAULT: this script only LISTS matching accounts and their real, currently-persisted
 * project/scan/submission/notification/audit-log counts. It never deletes anything unless run with
 * --confirm, and even then only ever targets accounts isEngineeringTestAccount() matches -- never a
 * real participant (@user-study.figm.local, User.researchStatus), a normal (NORMAL/no-match)
 * product account, or an ADMIN account (hard-excluded below regardless of email/accountType, as a
 * second independent safety check). Deleting a user cascades (prisma/schema.prisma
 * onDelete: Cascade) to that user's own projects/scan reports/notifications/audit logs/settings/api
 * keys/saved reports/AI history/export history/submissions -- nothing else.
 *
 * Usage:
 *   node --import tsx scripts/cleanup-engineering-test-accounts.ts             # list only (dry run)
 *   node --import tsx scripts/cleanup-engineering-test-accounts.ts --confirm   # actually delete
 */
import { RepositoryFactory } from '../src/storage/repository-factory';
import { isEngineeringTestAccount } from '../src/lib/engineering-test-accounts';

async function main() {
  const confirm = process.argv.includes('--confirm');
  const provider = RepositoryFactory.getStorageProvider();

  const allUsers = (await provider.getAllUsers()) as Array<{
    id: string; email: string; fullName: string; createdAt: string; role: string;
    accountType?: string | null; researchStatus?: string | null;
  }>;
  const targets = allUsers.filter((u) => isEngineeringTestAccount(u) && u.role !== 'ADMIN' && !u.researchStatus);

  if (targets.length === 0) {
    console.log('[cleanup-engineering-test-accounts] No accounts matching the ENGINEERING_TEST account type / ENGTEST*/curltest* email convention were found. Nothing to do.');
    return;
  }

  console.log(`[cleanup-engineering-test-accounts] Found ${targets.length} engineering-test account(s):\n`);
  for (const u of targets) {
    const scans = (await provider.getScanRecords(u.id)) as unknown[];
    const projects = (await provider.getProjects(u.id)) as unknown[];
    const submissions = (await provider.getSubmissionsByUserId(u.id)) as unknown[];
    console.log(`  - ${u.email}  (id=${u.id}, name="${u.fullName}", role=${u.role}, accountType=${u.accountType ?? 'NORMAL (email-convention match)'}, created=${u.createdAt})`);
    console.log(`      cascade impact: ${projects.length} project(s), ${scans.length} scan record(s), ${submissions.length} submission(s) would be deleted, plus that user's own notifications/audit-log rows/settings/api-keys/saved-reports/AI-history/export-history (all FK onDelete: Cascade or SetNull -- no other user's rows are affected)`);
  }

  if (!confirm) {
    console.log('\n[cleanup-engineering-test-accounts] DRY RUN ONLY -- no data was deleted. Re-run with --confirm to actually delete the accounts listed above.');
    return;
  }

  console.log('\n[cleanup-engineering-test-accounts] --confirm passed. Deleting the accounts listed above now...');
  for (const u of targets) {
    const ok = await provider.deleteUser(u.id);
    console.log(`  - ${u.email}: ${ok ? 'deleted' : 'FAILED (not found or already deleted)'}`);
  }
  console.log('[cleanup-engineering-test-accounts] Done.');
}

main().catch((err) => {
  console.error('[cleanup-engineering-test-accounts] Fatal error:', err);
  process.exitCode = 1;
});
