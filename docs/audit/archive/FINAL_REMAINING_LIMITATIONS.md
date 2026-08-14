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

# FIGM — FINAL REMAINING LIMITATIONS & FUTURE RESEARCH

**Project**: Framework-Independent Guideline Model (FIGM) Code Inspector  
**Candidate**: A P H D S Sanjula (Student ID: `28256`)  

---

## ARCHITECTURAL & METHODOLOGICAL LIMITATIONS

To uphold academic integrity, the following technical and methodological boundaries of the current FIGM implementation are explicitly documented:

### 1. Dynamic Micro-Benchmarking Memory API Availability
- **Limitation**: Modern web browsers and Node.js environments restrict access to high-resolution `performance.memory` APIs due to side-channel attack mitigations (e.g., Spectre/Meltdown).
- **Mitigation / Implementation**: When `performance.memory` is unavailable, `DynamicProfiler` (`src/engine/dynamic-profiler.ts`) returns a complexity-based heap estimation and flags `measurementType: 'ESTIMATED'`.

### 2. Vue Single File Component (SFC) Template AST Parsing
- **Limitation**: The current universal AST mapper handles TypeScript/JSX AST nodes natively via Babel parser. Vue `.vue` SFC templates rely on script AST mapping plus template regex heuristics rather than a full native Vue compiler AST parser.
- **Mitigation / Implementation**: Heuristic pattern matching covers key interactive element structure (`FIGM-A11Y-01`) and asset loading dimensions (`FIGM-PERF-02`).

### 3. Static Import Detection Scope (`FIGM-PERF-04`)
- **Limitation**: Next.js App Router route handlers (`app/api/**/route.ts`) import `NextResponse` at the top level by design. The static analysis scanner evaluates top-level ES module imports in route handlers as static imports in module scopes, contributing to the 74% CI quality score.
- **Mitigation / Implementation**: Documented as an expected domain-specific architectural pattern in `FINAL_RELEASE_READINESS_REPORT.md`. Exceeds the 70% quality gate.

### 4. Synthetic Benchmark Vector Datasets
- **Limitation**: The 30-project dataset and $N=85$ usability dataset represent pre-compiled benchmark vectors and survey scoring models rather than real-time live git clones or live human subjects.
- **Mitigation / Implementation**: Documented with full academic transparency in `FINAL_DATASET_AUTHENTICITY_REPORT.md`.
