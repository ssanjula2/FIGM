// Explicit, opt-in admin account provisioning for the live (Postgres/Supabase) database.
//
// BACKGROUND: the JSON-file storage backend (src/auth/user-db.ts) has always self-seeded the two
// DEFAULT_ADMIN_ACCOUNTS on first boot of an empty store, using resolveBootstrapAdminPassword()
// (fails closed outside development/test -- requires ADMIN_BOOTSTRAP_PASSWORD, >=12 chars, no
// hardcoded/guessable default). SupabaseStorageProvider has no equivalent auto-seed step at all --
// a freshly-provisioned or rotated production database therefore has zero users and no
// application-level path to create the first one (self-registration deliberately cannot create an
// ADMIN account -- see app/api/auth/register/route.ts). This script closes that gap without
// introducing a second, silent, auto-run seeding mechanism: it must be run explicitly (`npm run
// db:seed-admin`), it is idempotent (never overwrites an existing account's password or role), and
// it reuses the exact same password-resolution and default-account logic already used by the JSON
// backend, so there is exactly one definition of "how a default admin password is resolved" in the
// codebase, not two.
//
// Never prints the resolved password itself, except via resolveBootstrapAdminPassword()'s own
// existing dev/test-only console.error (unchanged, and already scoped to insecure environments
// only -- see src/auth/user-db.ts).

import { RepositoryFactory } from '../src/storage/repository-factory';
import {
  DEFAULT_ADMIN_ACCOUNTS,
  resolveBootstrapAdminPassword,
} from '../src/auth/user-db';
import { hashPassword } from '../src/auth/auth-service';

export interface SeedAdminSummary {
  created: string[];
  skippedExisting: string[];
}

export async function seedAdminAccounts(): Promise<SeedAdminSummary> {
  const provider = RepositoryFactory.getStorageProvider();
  const created: string[] = [];
  const skippedExisting: string[] = [];

  // Resolved once, outside the loop: this throws (fails closed) if ADMIN_BOOTSTRAP_PASSWORD is
  // missing/weak outside development/test, before touching the database at all.
  const password = resolveBootstrapAdminPassword();
  const passwordHash = hashPassword(password);

  for (const account of DEFAULT_ADMIN_ACCOUNTS) {
    const existing = await provider.findUserByEmail(account.email);
    if (existing) {
      skippedExisting.push(account.email);
      continue;
    }

    await provider.createUser({
      id: account.id,
      email: account.email,
      fullName: account.fullName,
      role: 'ADMIN',
      passwordHash,
    });
    created.push(account.email);
  }

  return { created, skippedExisting };
}

async function main(): Promise<void> {
  console.log('====================================================');
  console.log('FIGM Admin Account Bootstrap');
  console.log(`Storage provider: ${RepositoryFactory.getStorageProvider().name}`);
  console.log('====================================================');

  const { created, skippedExisting } = await seedAdminAccounts();

  if (created.length > 0) {
    console.log(`Created ${created.length} admin account(s): ${created.join(', ')}`);
  }
  if (skippedExisting.length > 0) {
    console.log(
      `Skipped ${skippedExisting.length} account(s) that already exist (password/role left ` +
      `untouched): ${skippedExisting.join(', ')}`
    );
  }
  if (created.length === 0 && skippedExisting.length === DEFAULT_ADMIN_ACCOUNTS.length) {
    console.log('Nothing to do -- all default admin accounts already exist.');
  }
  console.log('Done.');
}

// Only auto-run when executed directly (`node --import tsx scripts/seed-admin.ts`), not when
// imported by a test.
if (require.main === module) {
  main().catch((err) => {
    console.error('[seed-admin] FAILED:', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
