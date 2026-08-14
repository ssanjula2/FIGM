# FIGM Code Inspector — Research Traceability Matrix

Complete end-to-end mapping from research objectives and questions to codebase implementation, API
endpoints, database models, and empirical benchmark results. Every "Evaluation Metric / Result"
cell below is reconciled against `docs/evidence/canonical-evaluation.json` and
`docs/evidence/research-claim-traceability.md` — re-run `npm run research:evaluate` before citing
any number here, since it is regenerated live and will drift from a stale copy over time.

---

## Complete Traceability Matrix

| Research Objective | Research Question | Software Feature | Source Code Module | API Endpoint | Database Model | Evaluation Metric / Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RO1: Guideline Formalization** | **RQ1**: Can guidelines be mapped without abstraction loss? | 4-Layer Meta-Model & 25-Rule Taxonomy | `src/matrix/four-layer-meta-model.ts` | (static specification; exported via `src/matrix/export-spec.ts`, not a runtime API route) | N/A (static specification) | **25 rules defined**, all 25 unit-verified (positive/negative fixture per rule); **8 of 25** additionally have empirical ground-truth benchmark coverage (see RO3) |
| **RO2: Multi-Framework Normalization** | **RQ1**: Can framework ASTs be normalized? | Real-AST detection pipeline & ALP extraction | `src/parser/source-parser.ts`, `src/ast/real-syntax-node-builder.ts`, `src/parser/alp-extractor.ts` | `POST /api/scan` | `ScanReport` | **23 of 25 rules** detected via real TypeScript-compiler AST traversal (React/Next.js/plain JS-TS/Angular class body); the remaining 2 (Angular template markup) plus every rule on Vue SFCs use a labeled text-heuristic fallback. No multi-repository benchmark exists — see RO3 for the actual evaluation scope. |
| **RO3: Automated Quality Engine** | **RQ2**: How accurately does the engine detect real violations? | Automated Rule Execution Engine | `src/engine/rule-execution-engine.ts`, `src/eval/evaluation-runner.ts` | `POST /api/scan` (live detection), `GET /api/research-metrics` (benchmark results) | `ScanReport` | **Precision/Recall/F1 computed live** against 19 hand-labelled ground-truth violations across 8 of 25 rules — see `docs/evidence/canonical-evaluation.json` for the current figures (do not hardcode a copy here; read it live before citing). No fixed per-file latency budget is asserted; scan throughput (LOC/sec) is reported alongside precision/recall in the same artifact. |
| **RO4: Contextual AI Remediation** | **RQ3**: Can generated patches be verified, not just produced? | Gemini AI Remediation Pipeline with re-scan verification | `src/ai/ai-remediation-pipeline.ts`, `src/engine/remediation-engine.ts` | `POST /api/scan` with `action: 'ai-fix'` (no separate `/api/remediation` route exists) | `AiHistory` | Per-fix verification (re-scan confirms the violation is gone) is implemented and tested (`tests/live-scan-e2e.test.ts`, `tests/ai-remediation.test.ts`). **No aggregate "% patches valid" benchmark has been run** across a reproducible defect corpus — flagged as future work, not fabricated as a percentage here. |
| **RO5: Multi-Tenant SaaS Platform** | **RQ4**: Is the architecture genuinely multi-tenant with real persistence/auth? | Cloud workspace, auth, realtime, exporter | `src/storage/supabase-storage-provider.ts`, `src/auth/auth-service.ts` | `/api/projects`, `/api/auth/login`, `/api/export` | `User`, `Project`, `ScanReport`, `Notification`, `Settings` | Architecture is real and multi-tenant (Row-Level Security policies, JWT auth with fail-closed secret handling). **No live human usability study result exists** (0/85 participants collected — SUS/Cronbach's α not currently reportable; see `docs/evidence/research-claim-traceability.md` row 11). Not deployed to a public production environment with real users. |

---

## Notes on this reconciliation

- Two "evaluation metric" cells in a prior version of this table (RO3, RO5) asserted **1.00
  Precision/Recall/F1** and **Cronbach's α = 0.892** as if they were completed results. Neither was
  backed by a real computation reachable from the live pipeline: the 100%/100%/100% figure did not
  match any run of `npm run research:evaluate` (the real figure is lower, see the live artifact),
  and the α=0.892 figure was a synthetic formula-verification value, not a real human-study result.
  Both have been corrected above.
- RO2's prior version cited "30 Open-Source SPA Benchmark Repositories" — this dataset never
  existed as real scanned data; see `docs/evidence/research-claim-traceability.md` row 8.
- File paths in a prior version of this table (`src/ast/source-parser.ts`,
  `src/ast/alp-extraction-engine.ts`, `src/ast/rule-execution-engine.ts`) did not match the real
  module locations (`src/parser/`, `src/engine/`) — corrected above. API endpoints `/api/matrix`
  and `/api/remediation` did not exist as separate routes — corrected to the real endpoints.
  Database model names (`ScanReports`, `AIHistory`, plural `Users`/`Projects`) did not match
  `prisma/schema.prisma`'s real singular model names (`ScanReport`, `AiHistory`, `User`,
  `Project`) — corrected above.
