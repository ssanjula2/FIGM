# Pre-Study Synthetic DB Residue Audit

Date: 2026-09-04
Scope: Phase 1 of the P0 data-integrity request. Read-only inspection of the live Supabase
database, performed with explicit researcher authorization. No rows were modified.

## Correction to the prior turn's claim

The previous message in this conversation asserted that the automated test suite writes into the
same live Supabase database backing production, and that the `P2002` unique-constraint collision
observed while re-running tests was evidence of that. **That claim was wrong, and this audit
corrects it before any destructive action was taken on its basis.**

What actually happened, traced end to end:

- `tests/research-dataset-consent-gate.test.ts` creates its fixtures via `UserDB.createUser()`
  (`src/auth/user-db.ts`), not through `RepositoryFactory`.
- `UserDB` is a **plain local JSON file store** — always. `loadDB()`/`saveDB()`
  (`src/auth/user-db.ts:149,217,266`) read/write `figm-user-db.json` in the project root (or
  `/tmp/figm-user-db.json` if present). This has no code path to Postgres/Supabase at all,
  regardless of any environment variable.
- That local file exists, is 4,259,392 bytes, and is correctly `.gitignore`d (line 33). It has
  clearly accumulated real residue from months of local `npm test` runs — nothing in the test
  suite ever cleans it up. **That accumulated local residue, not production, is what the `P2002`
  collision came from.**
- The project's actual `test` script (`package.json`) never passes `--env-file` and never sets
  `DATABASE_URL`/`SUPABASE_URL`. Verified directly: a plain `node -e "console.log(process.env
  .DATABASE_URL)"` in this shell prints `UNSET`. Without those variables, `RepositoryFactory
  .getStorageProvider()` cannot select `SupabaseStorageProvider` (it requires `SUPABASE_URL`/
  `NEXT_PUBLIC_SUPABASE_URL` **and** an anon/service key — confirmed by reading
  `src/storage/repository-factory.ts:9-53`) and falls back to `JsonStorageProvider`, which is also
  disk-file-backed, not Postgres. This exact behavior has its own passing test:
  `tests/supabase-storage-provider.test.ts:9-13`, `'RepositoryFactory defaults cleanly to
  JsonStorageProvider when Supabase is unconfigured'`.
- So: **local `npm test` runs never touch Supabase.** The apparent alarm was conflating "a real
  P2002-shaped error" with "a real production write" — the error code is deliberately mirrored by
  the JSON provider for API-compatibility (`src/auth/user-db.ts:322-335`'s own doc comment says so
  explicitly), not evidence of which backend produced it.

The one genuine (but different, and smaller) risk this surfaced is in CI, addressed in Phase 3's
report (`docs/audit/PRE_STUDY_DATA_INTEGRITY_FINAL.md` once written): `.github/workflows
/figm-scan.yml`'s "Execute Automated Unit & Integration Tests" step injects `DATABASE_URL`/
`DIRECT_URL` (real secrets, or a harmless localhost fallback) into the `npm test` environment.
Reading every test that constructs a storage provider directly (`tests/supabase-storage-provider
.test.ts`) confirms none of them call a write method on a directly-instantiated
`SupabaseStorageProvider` — the only write-capable path in that file goes through
`ProjectRepository`, which is itself gated by `RepositoryFactory`'s Supabase-URL-and-key
requirement, absent in that CI step. So even in CI, no current test performs a real Postgres
write. It is nonetheless worth closing off by construction rather than relying on "no test happens
to do this today" — see Phase 3.

## Live database inspection (read-only, authorized)

Connected using the real credentials in `.env`/`.env.local` (`STORAGE_PROVIDER=supabase`,
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` via the Prisma/pg
adapter) — the same configuration the deployed app itself uses. Confirmed
`RepositoryFactory.getStorageProvider()` returned `SupabaseStorageProvider` (i.e., this genuinely
queried the live Postgres database, not the JSON fallback). No writes were issued — only
`getAllUsers()`, `getScanRecords()`, and `ParticipantRepository.getResearchDataset()` (itself
read-only).

```
totalUsers:                                  29
totalScans:                                1,062
totalParticipantPatternUsers:                 0
p001_p020_users:                              0
outOfRangeParticipantCount:                   0
syntheticHighRangeCount_P900000_P989999:      0
outOfRangeByResearchStatus:                  {}   (empty -- no out-of-range rows exist at all)
consentVerifiedOutOfRangeCount:               0
withResearchConsentVerifiedAtOutOfRangeCount: 0
normalProductTestLikeUsers:                   0
scansWithKnownTestArtifactFileNames:          0
  PreConsentScan.tsx:      0
  PostConsentScan.tsx:     0
  ContaminatedScan.tsx:    0
  OrdinaryProductScan.tsx: 0
currentGetResearchDatasetTotalRows:           0
currentGetResearchDatasetOutOfRangeRows:      0
```

**Finding: the live database is clean.** Zero participant-pattern users of any kind exist in
production — not in the real P001–P020 range, not in the P900000+ synthetic-test range, and none
of the known test-fixture filenames (`PreConsentScan.tsx`, `PostConsentScan.tsx`,
`ContaminatedScan.tsx`, `OrdinaryProductScan.tsx`) appear anywhere in the 1,062 real scan records.
`ParticipantRepository.getResearchDataset()`, run against production data with its **current,
pre-fix** eligibility logic, already returns zero rows — there is nothing today that would leak
into a real research export even before Phase 2's tightened range guard is applied.

This matches the researcher's own originally-reported state exactly (0/20, all research columns
NULL) — it was accurate then and remains accurate now. There was never contamination in the
production database; the earlier concern was a misdiagnosis of a local-file artifact.

## Phase 5 disposition

Phase 5 (classify and, if authorized, delete existing synthetic residue) has **no work to do**.
There are zero out-of-range participant rows, zero synthetic P900000+ rows, and zero scans
matching known test-fixture filenames in the live database. No deletion plan is needed and none is
executed. (The local `figm-user-db.json` residue file is out of scope for a production-DB cleanup
request — it never reaches Supabase and is not read by the deployed application. If the researcher
wants it pruned to speed up local `npm test` runs, that is a separate, low-priority local hygiene
item, not a P0.)

## Structured answers

```
LIVE_DB_TOTAL_USERS=29
LIVE_DB_TOTAL_SCANS=1062
LIVE_DB_PARTICIPANT_PATTERN_USERS=0
LIVE_DB_P001_P020_USERS=0
LIVE_DB_OUT_OF_RANGE_PARTICIPANT_USERS=0
LIVE_DB_SYNTHETIC_P900000_P989999_USERS=0
LIVE_DB_CONSENT_VERIFIED_OUT_OF_RANGE=0
LIVE_DB_KNOWN_TEST_FILENAME_SCANS=0
LIVE_DB_CURRENT_RESEARCH_DATASET_ROWS=0
LIVE_DB_CURRENT_RESEARCH_DATASET_OUT_OF_RANGE_ROWS=0
RESIDUE_REQUIRING_DELETION=NONE
PHASE_5_DELETION_EXECUTED=NO (nothing to delete)
```
