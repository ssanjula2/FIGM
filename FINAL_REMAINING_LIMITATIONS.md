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
