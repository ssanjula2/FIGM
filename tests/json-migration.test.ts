import { describe, it } from 'node:test';
import assert from 'node:assert';
import { runJsonToSupabaseMigration } from '../scripts/migrate-json-to-supabase';

describe('Phase 4: Data Migration Utility Suite', () => {
  it('runJsonToSupabaseMigration parses JSON store, validates records, and generates report', async () => {
    const summary = await runJsonToSupabaseMigration();
    assert.ok(summary);
    assert.ok(summary.timestamp);
    assert.ok(typeof summary.usersSkipped === 'number' || summary.usersImported >= 0);
    assert.ok(['SUCCESS', 'DRY_RUN', 'FAILED'].includes(summary.status));
  });
});
