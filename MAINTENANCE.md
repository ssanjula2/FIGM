# FIGM Code Inspector — System Maintenance & Operations Guide

Operational maintenance procedures, backup workflows, and health diagnostics for system administrators.

---

## 1. System Health Monitoring

### Health Endpoint
Check platform status via `/api/health`:
```bash
curl -X GET https://your-domain.vercel.app/api/health
```

Sample Response:
```json
{
  "status": "HEALTHY",
  "provider": "json",
  "memoryUsageMb": 42.15,
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

---

## 2. Database Maintenance & Backups

### Supabase Cloud Database Backups
- Automatic daily backups are performed natively by Supabase.
- Manual point-in-time recovery (PITR) can be initiated from the Supabase Project Dashboard.

### Local JSON Database Backup
Backup `figm-user-db.json`:
```bash
cp figm-user-db.json backups/figm-user-db-backup-$(date +%Y%m%d).json
```

---

## 3. Data Migration Utility
To sync or re-import data from `figm-user-db.json` into Supabase PostgreSQL:
```bash
npm run migrate-json-to-supabase
```
Review generated report: `docs/migration-report.json`.
