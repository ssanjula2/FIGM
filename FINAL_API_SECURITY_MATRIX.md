# FIGM — FINAL API SECURITY FORENSIC MATRIX

**Project**: Framework-Independent Guideline Model (FIGM) Code Inspector  
**Candidate**: A P H D S Sanjula (Student ID: `28256`)  

---

## APP ROUTER API ENDPOINT SECURITY MATRIX

| Method | Endpoint Path | Auth Required | User ID Source | Resource Ownership Verification | Rate Limit | Input Validation | IDOR Protection Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | No | Request Body | N/A (Authentication) | 5 req/min | Email & password format check | **SECURE** |
| `POST` | `/api/auth/register` | No | Request Body | N/A (Registration) | 5 req/min | Password complexity check | **SECURE** |
| `POST` | `/api/auth/logout` | Yes | Bearer Header | N/A (Session termination) | 20 req/min | Header verification | **SECURE** |
| `GET` | `/api/auth/me` | Yes | Bearer Header | User ID from token | 20 req/min | Token payload check | **SECURE** |
| `POST` | `/api/auth/refresh` | Yes | Refresh Token | Token payload | 10 req/min | Refresh token lookup | **SECURE** |
| `POST` | `/api/auth/forgot-password` | No | Request Body | N/A (Password reset trigger) | 5 req/min | Email lookup | **SECURE** |
| `POST` | `/api/auth/reset-password` | No | Request Body | Token payload | 5 req/min | Token expiration check | **SECURE** |
| `GET` | `/api/projects` | Yes | Bearer Header | Filtered by `userId` in UserDB | 20 req/min | User session check | **SECURE** |
| `POST` | `/api/projects` | Yes | Bearer Header | Associated with authenticated user | 20 req/min | Name length check (max 100) | **SECURE** |
| `GET` | `/api/projects/[id]` | Yes | Bearer Header | Explicit `userId === project.userId` check | 20 req/min | Project UUID validation | **VERIFIED (403/404 on violation)** |
| `PUT` | `/api/projects/[id]` | Yes | Bearer Header | Explicit `userId === project.userId` check | 20 req/min | Payload validation | **VERIFIED (403/404 on violation)** |
| `DELETE` | `/api/projects/[id]` | Yes | Bearer Header | Explicit `userId === project.userId` check | 20 req/min | Ownership check | **VERIFIED (403/404 on violation)** |
| `POST` | `/api/projects/[id]/duplicate` | Yes | Bearer Header | Explicit `userId === project.userId` check | 10 req/min | Ownership check | **VERIFIED** |
| `POST` | `/api/scan` | Yes | Bearer Header | Associated with authenticated user | 10 req/min | Payload size limit (500KB) | **SECURE** |
| `GET` | `/api/scans` | Yes | Bearer Header | Filtered by authenticated user | 20 req/min | Pagination limits | **SECURE** |
| `GET` | `/api/scans/[id]` | Yes | Bearer Header | Verified against scan author | 20 req/min | Scan ID check | **VERIFIED** |
| `DELETE` | `/api/scans/[id]` | Yes | Bearer Header | Verified against scan author | 20 req/min | Scan ID check | **VERIFIED** |
| `POST` | `/api/report` | Yes | Bearer Header | Report generator owner check | 10 req/min | Diagnostic payload check | **SECURE** |
| `POST` | `/api/export` | Yes | Bearer Header | Export generator owner check | 10 req/min | Export format check | **SECURE** |
| `POST` | `/api/export-dissertation` | Yes | Bearer Header | User session check | 5 req/min | Format check | **SECURE** |
| `GET` | `/api/dashboard/summary` | Yes | Bearer Header | Filtered by `userId` | 20 req/min | User session check | **SECURE** |
| `GET` | `/api/dashboard/activity` | Yes | Bearer Header | Filtered by `userId` | 20 req/min | User session check | **SECURE** |
| `GET` | `/api/dashboard/frameworks` | Yes | Bearer Header | Filtered by `userId` | 20 req/min | User session check | **SECURE** |
| `GET` | `/api/dashboard/reports` | Yes | Bearer Header | Filtered by `userId` | 20 req/min | User session check | **SECURE** |
| `GET` | `/api/dashboard/statistics` | Yes | Bearer Header | Filtered by `userId` | 20 req/min | User session check | **SECURE** |
| `GET` | `/api/profile` | Yes | Bearer Header | Self profile check | 20 req/min | User ID check | **SECURE** |
| `PUT` | `/api/profile` | Yes | Bearer Header | Self profile check | 10 req/min | Profile payload check | **SECURE** |
| `GET` | `/api/notifications` | Yes | Bearer Header | Filtered by `userId` | 20 req/min | User session check | **SECURE** |
| `PUT` | `/api/notifications` | Yes | Bearer Header | Filtered by `userId` | 20 req/min | Read state check | **SECURE** |
| `GET` | `/api/settings` | Yes | Bearer Header | Filtered by `userId` | 20 req/min | User session check | **SECURE** |
| `PUT` | `/api/settings` | Yes | Bearer Header | Filtered by `userId` | 10 req/min | Settings payload check | **SECURE** |
| `GET` | `/api/search` | Yes | Bearer Header | Filtered by `userId` | 20 req/min | Query term check | **SECURE** |
| `GET` | `/api/submissions` | Yes | Bearer Header | User session check | 20 req/min | Query check | **SECURE** |
| `GET` | `/api/admin/users` | Yes (ADMIN) | Bearer Header | Role `ADMIN` enforced | 10 req/min | Admin check | **VERIFIED (403 if non-admin)** |
| `PUT` | `/api/admin/users` | Yes (ADMIN) | Bearer Header | Role `ADMIN` enforced | 10 req/min | Admin check | **VERIFIED** |
| `GET` | `/api/admin/system` | Yes (ADMIN) | Bearer Header | Role `ADMIN` enforced | 10 req/min | Admin check | **VERIFIED** |
| `GET` | `/api/health` | No | System | Public health check | 60 req/min | None | **SECURE** |
