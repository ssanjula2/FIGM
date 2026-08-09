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
