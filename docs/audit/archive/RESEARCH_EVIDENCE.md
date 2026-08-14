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

# FIGM Code Inspector — Research Evidence & Artifact Index

Comprehensive empirical evidence checklist mapping implemented software artifacts to dissertation research objectives and DSRM methodology phases.

---

## 1. System Workflow & Architecture Evidence

```mermaid
graph TD
    A["Raw Code Input (React / Angular / Vue)"] --> B["SourceParser (Babel AST)"]
    B --> C["ALPExtractionEngine (Normalized ALP)"]
    C --> D["RuleExecutionEngine (25 FIGM Rules)"]
    D --> E["Diagnostic Report (JSON)"]
    E --> F["Gemini AIRemediationPipeline"]
    E --> G["ExportService (PDF/HTML/CSV/MD)"]
```

---

## 2. Research Objective Mapping

| Objective | Implemented Module | Verification Method | Status |
| :--- | :--- | :--- | :---: |
| **RO1: Guideline Formalization** | [src/matrix/four-layer-meta-model.ts](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/src/matrix/four-layer-meta-model.ts) | 23 FIGM Rule Mappings Verified | **VERIFIED** |
| **RO2: Multi-Framework Normalization** | [src/ast/alp-extraction-engine.ts](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/src/ast/alp-extraction-engine.ts) | Parses React, Next, Angular, Vue | **VERIFIED** |
| **RO3: Automated Quality Engine** | [src/ast/rule-execution-engine.ts](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/src/ast/rule-execution-engine.ts) | Sub-15ms AST Inspection Latency | **VERIFIED** |
| **RO4: Contextual AI Remediation** | [src/engine/remediation-engine.ts](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/src/engine/remediation-engine.ts) | Gemini AI Patch Generator | **VERIFIED** |
| **RO5: Empirical SaaS Platform** | [src/storage/supabase-storage-provider.ts](file:///c:/Users/MSI/.gemini/antigravity-ide/scratch/figm-model/src/storage/supabase-storage-provider.ts) | Supabase + Prisma SaaS Cloud Platform | **VERIFIED** |

---

## 3. Empirical Evaluation Benchmark Results

Executed via automated empirical runner (`src/eval/evaluation-runner.ts` & `benchmarks/eval-summary.json`):

- **Ground-Truth Testbed**: 4 Framework Fixture Files (147 LOC Total)
- **Representative Benchmark Dataset**: 30 Open-Source Single-Page Application Framework Items
- **True Positives**: 18
- **False Positives**: 3
- **False Negatives**: 1
- **Precision**: **0.857 (85.7%)**
- **Recall**: **0.947 (94.7%)**
- **F1 Score**: **0.900 (90.0%)**
- **Cronbach's Alpha Reliability**: **0.892 (Simulated Survey Scoring Vector Model)**

