# FIGM Metric Source Registry

Stage 7G full product metric-truth audit. Every visible metric surfaced anywhere in the product,
with its exact source, semantics, and empty-state behavior. Compiled by tracing UI → API →
repository/service → DB query for each entry (not inferred from labels). No entry below has a
hardcoded plausible-looking fallback; every stated "empty-state" is a real code path.

Legend: **Audience** = who can see it. **Research usage allowed?** = whether this value may be
cited in the dissertation/thesis as evidence (YES only for values with a real, traceable
ground-truth computation; NO for anything derived from unauthenticated/aggregate/GA4 sources not
part of the formal evaluation protocol).

---

## Developer Dashboard (`/` — `app/page.tsx` → `LiveDashboardContent.tsx`)

All values on this page are scoped to the authenticated caller's own `userId` (never the
platform-wide total) as of Stage 7G — see `app/api/dashboard/summary/route.ts` and
`app/api/dashboard/activity/route.ts`.

| Metric | UI location | API | Repository | Source | Aggregation/filter | Empty state | Eng-test excluded | Research use |
|---|---|---|---|---|---|---|---|---|
| My Projects | Top card 1 | `GET /api/dashboard/summary` | `DashboardRepository.getSummary(userId)` | `projects` table, `WHERE user_id = :caller` | `projects.length` | `0` (real) | N/A (own data always shown) | NO |
| My Scans | Top card 2 | same | same | `scan_reports` (+ legacy `submissions`), `WHERE user_id = :caller` | `scanRecords.length + submissions.length` | `0` | N/A | NO |
| My Findings | Top card 3 (labelled "Rules Triggered" pre-7G) | same | same | `scan_reports.rule_count`, `WHERE user_id = :caller` | `Σ ruleCount` across own scans | `0` | N/A | NO |
| My AI Fix Suggestions | Top card 4 | same | same | `scan_reports.ai_fix_count`, own scans | `Σ aiFixCount` | `0` | N/A | NO |
| My Quality Score | Composite gauge (labelled "Composite Health Score" pre-7G) | same | same | `scan_reports.quality_score`, own scans | `round(Σ qualityScore / totalScans)` | **`null`** (no-data state: "No scans yet"), not `0%` | N/A | NO |
| My Framework Distribution | Middle panel | same | same | `scan_reports.framework`, own scans | count by react/nextjs/angular/vue/generic | three empty bars | N/A | NO |
| My Recent Activity | Right panel (labelled "Recent Activity Feed" pre-7G) | `GET /api/dashboard/activity` | `DashboardRepository.getActivityFeed(limit, userId)` | `audit_logs`, `WHERE user_id = :caller` | latest N, own events only | "No recent activity yet." + Run-first-scan CTA | RESEARCH_*/`@user-study.figm.local`/engtest filtered even from own feed | NO |
| My Recent Scans | Bottom table (labelled "Recent Static Inspection Reports" pre-7G) | `GET /api/dashboard/reports` | `DashboardRepository.getRecentReports(userId)` | `scan_reports`, `WHERE user_id = :caller` (already correctly scoped before Stage 7G) | latest 10 | "No scan reports found." + Run-first-scan CTA | N/A | NO |

**Removed in Stage 7G:** the "Active Developers" 5th top card, which showed the platform-wide
distinct-user count on every individual developer's personal workspace — no honest per-user
equivalent exists, so it was dropped rather than relabeled. Platform-wide active-user counts
remain available to ADMIN only (Overview tab, `Total Registered Users`).

## Header (`app/HeaderBar.tsx`, shown on every authenticated page)

| Metric | Source | Semantic | Empty state | Research use |
|---|---|---|---|---|
| "🛡️ Latest Scan: X% (PASSED/FAILED)" badge | `useScans()` → `GET /api/scans` (already user-scoped server-side, `authenticateUser` + `role==='ADMIN' ? undefined : userId`), `records[0]` (default sort `createdAt desc`) | The caller's single most recent persisted scan's real `qualityScore`. **Not** an average of every scan (pre-Stage-7G behavior). `passed = score >= 70`. | "🛡️ No scans yet" (neutral badge) when `records.length === 0` — never a fabricated 90%/PASSED default | NO |

## Admin Dashboard (`/admin` — `app/admin/page.tsx`)

Global/platform-wide by design; Supabase/Postgres is the canonical source throughout.

| Metric | Tab | API | Source | Notes |
|---|---|---|---|---|
| Total Registered Users / Projects / Scans Recorded | Overview | `GET /api/admin/system` | `provider.getAllUsers/getProjects/getScanRecords()`, unfiltered counts | Real live counts, no floor |
| Research Participants Registered | Overview | `GET /api/admin/participants` | `User.researchStatus != null`, filtered to `!= 'NOT_REGISTERED'` | |
| Storage Provider | Overview | `GET /api/admin/system` | `provider.name` (`supabase` vs JSON fallback) | |
| Users table | Users tab | `GET /api/admin/users` | `users` table, all columns incl. `accountType` | Admin-only, real rows |
| Framework Analytics | Frameworks tab | `GET /api/dashboard/frameworks` | `DashboardRepository.getSummary()` (no userId ⇒ platform-wide), engineering-test accounts excluded | Same computation the pre-7G developer dashboard used to show everyone — now admin-only |
| Rule Analytics | Rules tab | `GET /api/admin/rule-stats` | `RuleAnalyticsRepository.getSummary()`, real persisted diagnostics | Scans Analyzed / Total Findings / Distinct Rules Triggered / per-rule occurrence table |
| System Health | Health tab | `GET /api/admin/system` | `process.uptime()`, `process.memoryUsage()`, live DB connectivity check | Real process telemetry, not canned |
| Audit Logs | Audit tab | `GET /api/admin/system` (`auditLogs`) | `audit_logs` table | Searchable, real |
| Website Analytics (GA4) | **New in Stage 7G** | `GET /api/admin/analytics/website` | `src/lib/ga4-admin-reporting.ts` | See GA4 section below — deliberately separate panel, never merged with the table above |

Research use: admin/system counts are operational, not part of the formal RQ1/RQ4 evaluation
protocol — YES only as supporting operational evidence (e.g. "the deployed system processed N real
scans"), never as a substitute for the controlled benchmark/human-study results.

## Scanner (`/live-scan`, `app/api/scan`)

| Metric | Source | Semantic |
|---|---|---|
| Quality Score | `RuleExecutionEngine` → `result.qualityScore`, server-computed per scan | Real, deterministic function of this scan's diagnostics |
| Total Issues | `figmRuleCount + generalCodeErrorCount`, both counted from `result.diagnostics`/`result.errors` | Real per-scan count |
| Source Units | Static `'1'` (one file per scan in the current UI) | Not derived data; a fixed label for the current single-file scan UX, not a fabricated aggregate |
| Rules Evaluated | `TOTAL_RULE_COUNT` (`src/matrix/rule-registry.ts`) | Static catalog size (all 50 canonical rules are always evaluated against every parse), not a per-scan count |
| Engine Diagnostics (timing/memory) | `result.analysis.profile` — server `process.hrtime`/`process.memoryUsage` deltas measured during the actual scan | Real measurement, `measurementType: MEASURED` |
| parser/figmStatus | `result.analysis.figmStatus` (`COMPLETE`/`PARTIAL`/`BLOCKED`/`UNSUPPORTED_FRAMEWORK`) | Server-authoritative; never silently reported `COMPLETE` for a partial/failed parse |

Research use: YES — this is the actual evaluation engine; RQ1/RQ4 results are derived from these
same code paths, not a separate "demo" path.

## GA4 (client tracking vs. admin reporting — kept structurally separate, never merged with the
above)

| Metric | Source | Status as of Stage 7G |
|---|---|---|
| gtag.js load / `page_view` events | `app/components/GoogleAnalytics.tsx`, gated by `GA_ENABLED` (`NEXT_PUBLIC_GA_MEASUREMENT_ID` set **and** `NODE_ENV==='production'`) | Client-side only; see this stage's production report for live verification results |
| Active Users / Sessions / Page Views / Device / Browser / Traffic Source / Geography (Admin "Website Analytics" panel) | `GET /api/admin/analytics/website` → `getGA4AdminReportingStatus()` | **NOT_CONFIGURED** — requires a separate `GA4_PROPERTY_ID` + `GA4_SERVICE_ACCOUNT_KEY` server-side GA4 Data API integration, absent in this environment. Renders an honest "Not configured for admin reporting" state; never a fabricated chart. |

GA4 values, if/when admin reporting is configured, describe **website traffic**, not product usage
— never to be presented as "registered users," "scans," or any Supabase/Postgres-sourced count.
Research use: NO (GA4 is explicitly supplementary, not a research source-of-truth per this
project's own protocol).

## Fields intentionally not covered above

`totalActiveUsers` remains present in the `DashboardSummary` API shape (backward-compatible field,
now scoped to the caller) but is no longer rendered on the developer dashboard UI (see "Removed in
Stage 7G" note). `securityScore`/`maintainabilityScore` (`/api/dashboard/statistics`) are `null` by
design — no SECURITY/MAINTAINABILITY rule domain exists in the canonical 50-rule taxonomy (see
`docs/audit/GUIDELINE_FORENSIC_TRACEABILITY.md`).

---

*Compiled Stage 7G (2026-09-03). Update this document whenever a metric's source, scope, or
empty-state behavior changes — it is the single reference for "is this number real, and what does
it actually mean" across the product.*
