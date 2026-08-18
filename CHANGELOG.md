# Changelog — FIGM Code Inspector

All notable changes to the FIGM Code Inspector project are documented below.

---

## [3.0.0] - 2026-08-04
### Production SaaS & Cloud Platform Release
- **Database Abstraction**: Implemented `StorageProvider` pattern supporting `SupabaseStorageProvider` (PostgreSQL with RLS) and `JsonStorageProvider` (Local JSON engine).
- **Prisma Schema**: Created 12 normalized Prisma models with indexes and relations.
- **Migration Engine**: Added `migrate-json-to-supabase.ts` script for importing legacy data.
- **Real-Time Integration**: Integrated Supabase Realtime WebSocket events for notifications and dashboard activity feed broadcasts.
- **Cloud Storage**: Enabled report export uploading to Supabase Storage bucket `figm-reports`.
- **Security Hardening**: Enforced production JWT secret validations, HTML entity escaping in PDF exporter, and RBAC authorization.
- **Testing**: Reached 103/103 passing automated tests across 12 test suites (test count as of this release; the suite has grown substantially since — run `npm test` for the current count).
