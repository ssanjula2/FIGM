# FIGM Code Inspector — Automated Testing Guide

This guide describes the unit, integration, and empirical benchmark test suites built into FIGM Code Inspector.

---

## 1. Test Suite Architecture

FIGM Code Inspector includes a growing suite of automated tests organized into specialized test suites under `tests/*.test.ts`. Run `npm test` to see the current test and suite count — the numbers change as the project evolves, so no fixed figure is maintained here.

The table below lists an illustrative subset of suites from an earlier snapshot of the project; it is **not exhaustive**. As of this writing there are 54 files matching `tests/*.test.ts` — list that directory (or see `package.json`'s `test` script, which enumerates every suite) for the complete, current set.

| Test File | Focus Area | Test Count |
| :--- | :--- | :---: |
| `tests/guideline-filtering.test.ts` | FIGM Guideline Filtering Matrix | 8 |
| `tests/ast-detection.test.ts` | 3-Stage AST Parser & Primitive Node Normalization | 12 |
| `tests/validation-engine.test.ts` | Rule Execution Engine & Defect Identification | 15 |
| `tests/evaluation-runner.test.ts` | 30-Repository Empirical Benchmark Runner | 6 |
| `tests/cli-analyzer.test.ts` | CLI Command Execution & Formatting | 5 |
| `tests/auth-isolation.test.ts` | Multi-Tenant Session & Isolation | 4 |
| `tests/research-gap-eval.test.ts` | Statistical Metrics (Precision, Recall, Cronbach Alpha) | 6 |
| `tests/ai-remediation.test.ts` | Gemini AI Patch Generation & Validation | 8 |
| `tests/ast-detection-rules.test.ts` | 25 Guideline Rule Mappings | 14 |
| `tests/functional-validation.test.ts` | End-to-End Functional Pipeline | 6 |
| `tests/auth-production.test.ts` | PBKDF2 Password Hashing & Refresh Tokens | 8 |
| `tests/dashboard-analytics.test.ts` | Dashboard Metrics & Recent Reports Aggregation | 5 |
| `tests/saas-projects-workspace.test.ts` | Project CRUD, Duplication, Archiving & Stats | 5 |
| `tests/saas-scan-history-export.test.ts` | Scan Persistence & PDF/JSON/CSV Export Engine | 3 |
| `tests/saas-user-notifications-settings.test.ts` | User Profile, Settings Persistence & Notifications | 3 |
| `tests/saas-search-admin.test.ts` | Global Guideline Search & Admin Management | 2 |
| `tests/supabase-storage-provider.test.ts` | Database Abstraction & StorageProvider Pattern | 4 |
| `tests/json-migration.test.ts` | JSON to Supabase Data Migration Utility | 1 |
| `tests/realtime-storage.test.ts` | Realtime Service & Cloud Storage Services | 2 |

---

## 2. Running Automated Tests

Run the full automated test suite:
```bash
npm test
```

Expected Output (illustrative format — exact counts and duration will reflect the current suite; run `npm test` for live numbers):
```text
# tests <N>
# suites <M>
# pass <N>
# fail 0
# duration_ms <...>
```

---

## 3. Running Individual Test Suites

Run a specific test suite using Node's native test runner with `tsx`:
```bash
npx tsx --test tests/ast-detection.test.ts
npx tsx --test tests/saas-projects-workspace.test.ts
```
