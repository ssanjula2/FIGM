# FIGM API Endpoint Traceability — Forensic Audit

Date: 2026-08-13
Method: Direct source inspection of all 31 route files under `app/api/**/route.ts`, cross-checked by **live HTTP calls** against a real running dev server (`http://localhost:3002`, `npm run dev`) with a real Postgres-backed session (register → login → authenticated calls → cleanup). Rows marked **[LIVE]** were actually called this session; rows marked **[SOURCE]** were verified by direct code reading only.

Legend — STATUS: GREEN (verified correct) / YELLOW (works but has a caveat) / RED (real defect, see Fixed? column).

| Method | Path | Auth | Input | DB | Frontend Consumer | Status | Fixed? |
|---|---|---|---|---|---|---|---|
| GET | /api/health | none | — | reads via provider | footer/status widgets | GREEN **[LIVE]** — confirmed `database: CONNECTED_POSTGRES`, honest `aiRemediation: TEMPLATE_FALLBACK_ONLY` when no Gemini key | Fixed this session (was fabricated) |
| POST | /api/auth/register | rate-limited | email/password/fullName/role | real Prisma User create | `/auth/register` page | GREEN **[LIVE]** — confirmed real UUID returned, JWT issued, cookies set | Fixed this session (was JSON-only) |
| POST | /api/auth/login | rate-limited | email/password | real Prisma User lookup+update | `/auth/login` page | GREEN **[LIVE]** — confirmed token issuance, `lastLoginAt` persisted | Fixed this session |
| POST | /api/auth/logout | optional | — | real Prisma update (clears refreshToken) | header logout button | GREEN **[SOURCE]** | Fixed this session |
| GET | /api/auth/me | required | — | real Prisma lookup | session bootstrap hooks | GREEN **[LIVE]** — confirmed correct profile returned | Fixed this session |
| POST | /api/auth/refresh | token-based | refreshToken (body or cookie) | real Prisma lookup+update | silent token refresh | GREEN **[SOURCE]** | Fixed this session |
| POST | /api/auth/forgot-password | rate-limited | email | real Prisma lookup+update | `/auth/forgot-password` | GREEN **[SOURCE]** — correctly masks non-existent emails | Fixed this session |
| POST | /api/auth/reset-password | rate-limited | token/newPassword | real Prisma lookup+update | `/auth/reset-password` | GREEN **[SOURCE]** | Fixed this session |
| GET | /api/auth/audit-logs | ADMIN/AUDITOR | — | real Prisma query | `/settings` audit tab | GREEN **[SOURCE]** | Fixed this session (await) |
| GET/PATCH/DELETE | /api/admin/users | ADMIN | userId/role/newPassword | real Prisma CRUD | `/admin` page | GREEN **[SOURCE]** | Fixed this session |
| GET | /api/admin/system | ADMIN | — | real Prisma queries + measured latency | `/admin` system panel | GREEN **[LIVE]** — confirmed 401 without auth; fabricated metrics removed | Fixed this session |
| GET | /api/dashboard/summary | optional | — | real Prisma aggregation | `/` dashboard | YELLOW **[LIVE]** — real data (217 projects, 219 users, live at test time), but still has hardcoded statistical floors (`Math.max(total, 30)` etc., see Phase 12 note below) | Not fixed (descoped) |
| GET | /api/dashboard/statistics | none | — | real Prisma + hardcoded fields | `/` stat cards | RED (known) **[SOURCE]** — `accessibilityScore/performanceScore/securityScore/maintainabilityScore` and trend %s are still hardcoded literals mixed with one real value | Not fixed (descoped, documented) |
| GET | /api/dashboard/reports | optional | — | real Prisma query | `/` recent reports | GREEN **[SOURCE]** | Fixed this session (await) |
| GET | /api/dashboard/frameworks | none | — | real Prisma aggregation | `/` framework chart | GREEN **[SOURCE]** | Fixed this session (await) |
| GET | /api/dashboard/activity | none | — | real Prisma audit-log query | `/` activity feed | GREEN **[SOURCE]** | Fixed this session (await) |
| POST | /api/scan | optional | code/fileName/action/defect | real Prisma create | `/live-scan` page | GREEN **[LIVE]** — confirmed real diagnostics with line/column/evidence, **found+fixed a real bug**: hardcoded fake `projectId` was silently failing FK constraint, scans never persisted | **Fixed this session** (critical) |
| GET/POST | /api/scans | required (GET) | filters / scan payload | real Prisma CRUD | `/history` page | GREEN **[LIVE]** — confirmed 401 without auth, confirmed per-user filtering (previously returned ALL users' scans regardless of caller — real security bug) | **Fixed this session** (critical) |
| GET/PATCH/DELETE | /api/scans/[id] | required + ownership | — | real Prisma CRUD | `/reports/[id]` | GREEN **[LIVE]** — confirmed 401 without auth (previously **no auth check at all**), confirmed 200 for owner | **Fixed this session** (critical security hole) |
| POST | /api/export | required + ownership | scanId/format | real Prisma read | export buttons | GREEN **[LIVE]** — confirmed 401 without auth (previously silently allowed any caller) | **Fixed this session** (critical security hole) |
| GET | /api/export-dissertation | none | — | reads static docs | dissertation export tool | YELLOW **[SOURCE]** — not DB-backed, generates LaTeX from static content; not re-audited this session | Not fixed (descoped) |
| GET | /api/report | none | — | reads static `figm-scan-report.json` or re-scans bundled sample | demo/report preview | YELLOW **[SOURCE]** — effectively a demo/stub endpoint, not tied to any real user/DB record | Not fixed (descoped) |
| GET | /api/research-metrics | none | — | reads `benchmarks/eval-summary.json` live | `/analytics` page | GREEN **[LIVE]** — confirmed genuinely dynamic (precision 0.857/recall 0.947/f1 0.9 match `research:validate` output exactly), honest `userStudy: PENDING, 0/85` | Fixed this session (23→25 rule count) |
| GET/PATCH | /api/settings | optional | theme/autoSave/etc | real Prisma upsert | `/settings` page | GREEN **[SOURCE]** | Fixed this session (was bypassing storage abstraction entirely) |
| GET/PATCH/DELETE | /api/notifications | optional | notificationId/markAll | real Prisma CRUD | notification bell | GREEN **[SOURCE]** | Fixed this session |
| GET/PATCH/DELETE | /api/profile | required | fullName/avatarUrl/password/API-key actions | real Prisma CRUD | `/profile` page | GREEN **[SOURCE]** | Fixed this session |
| GET/POST | /api/projects | required (POST) | search/framework/status filters, create payload | real Prisma CRUD | `/projects` page | GREEN **[SOURCE]** | Fixed this session |
| GET/PATCH/DELETE | /api/projects/[id] | required + ownership | — | real Prisma CRUD | `/projects/[id]` | GREEN **[SOURCE]** | Fixed this session |
| POST | /api/projects/[id]/duplicate | required | — | real Prisma create | project card menu | GREEN **[SOURCE]** | Fixed this session |
| GET | /api/search | optional | q (query string) | real Prisma queries across projects/scans/users | global search bar | GREEN **[SOURCE]** | Fixed this session |
| GET/POST | /api/submissions | required | code/fileName | JSON-file only (no Prisma model exists for submissions) | legacy CLI-style submission flow | YELLOW **[SOURCE]** — intentionally JSON-only; no `Submission` model in `prisma/schema.prisma`, documented as legacy | Not applicable (by design) |
| GET/POST | /api/user-study/log-scan | none (by design — public benchmark) | framework/fileName/code/participantId | real Prisma create | `/user-study` page | GREEN **[LIVE]** — confirmed 200 success; **found+fixed a real bug**: synthetic participant IDs ("P001") had no matching `User` row, causing every call to 500 on the required FK (`scan_reports_user_id_fkey`) | **Fixed this session** (critical, found via live testing) |

## Findings summary

- **2 previously-unknown critical bugs found only by live HTTP testing** (not visible from source review alone): `/api/scan` silently failed to persist any scan due to a hardcoded, non-existent `projectId` violating a real foreign key; `/api/user-study/log-scan` 500'd on every call due to a required foreign key to a `User` row that never existed for synthetic participant IDs. Both are now fixed and covered by a re-runnable regression script (`scratch/verify-real-db-crud.ts`).
- **2 real authorization holes confirmed fixed via live testing**: `/api/scans` previously ignored the caller's identity entirely (returned every user's scans to any authenticated caller); `/api/scans/[id]` previously had no authentication check at all.
- **Two endpoints still contain hardcoded literals mixed with real data**: `/api/dashboard/statistics` (accessibility/performance/security/maintainability scores + trend percentages) and `/api/dashboard/summary` (statistical floor padding via `Math.max(x, 30)`-style constants). Neither was fixed this session — flagged for Phase 12 follow-up.
- No dead/unreachable frontend API calls were found among the routes exercised — every route checked has a corresponding real consumer in `app/`.
- No hardcoded `localhost`/production URLs were found in the routes audited this session (consistent with the Phase 0 finding).
