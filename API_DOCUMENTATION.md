# FIGM Code Inspector — REST API Documentation

Comprehensive reference for FIGM Code Inspector REST API endpoints.

---

## Base URL
`/api`

## Authentication
All protected endpoints require HTTP Bearer authentication:
```http
Authorization: Bearer <your_jwt_access_token>
```

---

## Endpoints Summary

### 1. System & Health
#### `GET /api/health`
Returns system status, active database provider, memory usage, and timestamp.
```json
{
  "status": "HEALTHY",
  "provider": "json",
  "memoryUsageMb": 42.15,
  "timestamp": "2026-08-04T12:00:00.000Z"
}
```

---

### 2. Authentication & User Profile
#### `POST /api/auth/login`
Authenticate user credentials and obtain session tokens.

#### `POST /api/auth/refresh`
Exchange valid refresh token for a new access token.

#### `GET /api/profile`
Retrieve current user details, role, and API key.

#### `POST /api/profile/password`
Update user password.

#### `POST /api/profile/api-key`
Regenerate user API key.

---

### 3. Project Workspace
#### `GET /api/projects`
List projects owned by authenticated user.

#### `POST /api/projects`
Create a new project workspace.

#### `GET /api/projects/[id]`
Get project details and aggregated quality statistics.

#### `PATCH /api/projects/[id]`
Update project name, description, framework, or archive status.

#### `DELETE /api/projects/[id]`
Delete project workspace record.

---

### 4. Code Inspection & Scans
#### `POST /api/scans`
Execute automated FIGM code inspection on target component snippet.
Request Body:
```json
{
  "fileName": "UserProfile.tsx",
  "framework": "REACT_JSX",
  "codeContent": "const UserProfile = () => <img src='avatar.jpg' />;"
}
```

#### `GET /api/scans`
Retrieve paginated scan history records with filtering and search options.

#### `POST /api/export`
Generate downloadable PDF, HTML, JSON, CSV, or Markdown inspection reports.
