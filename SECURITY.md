# FIGM Code Inspector — Security Policy & Controls

Security controls, authentication standards, RBAC enforcement, and vulnerability reporting procedures.

---

## 1. Authentication & Session Management
- **Password Hashing**: PBKDF2 with SHA-512 and 10,000 iterations using a 16-byte random salt per user.
- **Session Tokens**: JWT access tokens signed with HMAC-SHA256 (default expiration: 1 hour).
- **Refresh Tokens**: Cryptographically random base64url strings stored securely (default expiration: 7 days).

---

## 2. Authorization & RBAC
Roles enforced across system endpoints:
- **`ADMIN`**: Full platform management, user role updates, password resets, system metrics.
- **`AUDITOR`**: Read-only compliance auditing, benchmark viewing, report exporting.
- **`DEVELOPER`**: Workspace project creation, scan execution, AI patch application.

---

## 3. Data Protection Controls
- **XSS Prevention**: Dynamic text HTML-entity encoded prior to PDF/HTML report rendering.
- **SQL Injection Prevention**: Parameterized queries via Prisma ORM.
- **Rate Limiting**: Sliding window rate limiter enforcing API request quotas per IP address.
