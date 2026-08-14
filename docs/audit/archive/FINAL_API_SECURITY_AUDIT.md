> **⚠ ARCHIVED — SUPERSEDED.** This document is a dated, point-in-time audit/verification
> snapshot from an earlier stage of the project (see its own "Audit Date" below). Substantial
> remediation has happened since it was written — including the JWT/auth hardening, API
> IDOR/rate-limiting fixes, the real-parser AST migration (Groups 1-4, now 23/25 rules
> real-AST), the live-scan pipeline fix, and the empirical-metrics single-source-of-truth fix
> (`docs/architecture/RULE_ENGINEERING_AUDIT.md`, `docs/evidence/canonical-evaluation.json`,
> `docs/evidence/research-claim-traceability.md`). **Any specific number, percentage, or
> pass/fail verdict below may no longer reflect the current codebase.** It is retained here
> for historical record only — do not cite it as current evidence. For current status, see
> `docs/evidence/canonical-evaluation.json` (empirical benchmark), `docs/evidence/
> research-claim-traceability.md` (claim-by-claim reconciliation), and `audit/new.md` (most
> recent full forensic audit).

---

# FIGM — FINAL API SECURITY AUDIT

**Project**: Framework-Independent Guideline Model (FIGM) Code Inspector  
**Candidate**: A P H D S Sanjula (Student ID: `28256`)  

---

## API ENDPOINT SECURITY & IDOR PROTECTION MATRIX

| Method | Endpoint Path | Auth Required | Server Ownership Verification | IDOR Protection Status | Rate Limit | Input Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | No | Request body payload | N/A (Authentication) | 5 req/min | Email & password format check |
| `POST` | `/api/auth/register` | No | Request body payload | N/A (Registration) | 5 req/min | Password complexity check |
| `GET` | `/api/projects` | Yes | Filtered by `userId` in UserDB | **SECURE** | 20 req/min | User session check |
| `GET` | `/api/projects/[id]` | Yes | Server verifies `userId === project.userId` | **VERIFIED (403/404 on violation)** | 20 req/min | UUID validation |
| `PUT` | `/api/projects/[id]` | Yes | Server verifies `userId === project.userId` | **VERIFIED (403/404 on violation)** | 20 req/min | Payload validation |
| `DELETE` | `/api/projects/[id]` | Yes | Server verifies `userId === project.userId` | **VERIFIED (403/404 on violation)** | 20 req/min | Ownership check |
| `GET` | `/api/scans/[id]` | Yes | Server checks scan author against caller | **VERIFIED (403/404 on violation)** | 20 req/min | Scan ID check |
| `DELETE` | `/api/scans/[id]` | Yes | Server checks scan author against caller | **VERIFIED (403/404 on violation)** | 20 req/min | Scan ID check |
| `GET` | `/api/admin/users` | Yes (ADMIN) | Server verifies `role === 'ADMIN'` | **VERIFIED (403 if non-admin)** | 10 req/min | Admin role check |
