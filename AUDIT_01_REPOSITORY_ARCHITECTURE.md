# FIGM Code Inspector — Phase 1 Repository Architecture Audit

**Audit Date**: August 11, 2026  
**Auditor**: Senior Static-Analysis Engineer & Research Software Auditor  
**Repository**: `ssanjula2/FIGM`

---

## 1. End-to-End Execution Flow Architecture

```
[User Upload / Code Input]
         │
         ▼
[1. File Classifier] ──────────── (src/parser/source-parser.ts :: detectFramework)
         │
         ▼
[2. AST Parser] ───────────────── (src/parser/source-parser.ts :: parseSource)
         │
         ├─► Syntax Errors ──────► Inject SYNTAX-PARSE-ERROR Diagnostic
         │
         ▼
[3. TS Compiler Service] ──────── (src/analysis/type-checker-service.ts :: checkCode)
         │
         ├─► Compiler Errors ────► Inject TYPE-TS-xxxx Diagnostic
         │
         ▼
[4. ALP Extractor] ────────────── (src/parser/alp-extractor.ts :: extractPrimitives)
         │
         ▼
[5. Rule Predicate Engine] ────── (src/ast/ast-detection-engine.ts :: evaluateNode)
         │
         ├─► FIGM Guidelines ────► Inject FIGM-PERF / FIGM-A11Y / FIGM-REACT / etc.
         │
         ▼
[6. Dynamic Complexity] ───────── (src/analysis/complexity/complexity-engine.ts :: analyzeComplexity)
         │
         ▼
[7. Dynamic Profiling] ────────── (src/engine/dynamic-profiler.ts :: profileExecution)
         │
         ▼
[8. AI Patch Generator] ───────── (src/engine/remediation-engine.ts :: applyQuickFix)
         │
         ▼
[9. Patch Validation Loop] ────── (src/engine/remediation-engine.ts :: validatePatch)
         │
         ├─► Re-scan ────────────► Mark FIXED if zero syntax errors & violation resolved
         │
         ▼
[10. Dashboard & Report UI] ───── (app/live-scan/page.tsx & ExportService)
```

---

## 2. Silent Failure Risk Audit & Safeguards

| Subsystem | Potential Failure Point | Vulnerability / Risk | Mitigation Implemented |
| :--- | :--- | :--- | :--- |
| **Parser** | Malformed Syntax (`const x = ;`) | Parser returns null AST, returning empty diagnostics | `SourceParser.validateSyntax` catches syntax errors & injects `SYNTAX_ERROR` |
| **Type Checker** | Standalone TS file missing `tsconfig` | Silent crash on missing import dependencies | `TypeCheckerService` uses in-memory Compiler Host with standalone disclaimer |
| **AST Engine** | Unrecognized AST Node | AST node skipped silently | Fallback node traversal visits all AST keys recursively |
| **Complexity** | Complex Control Flow | Static heuristic calculation | AST decision point CFG traversal computes exact cyclomatic complexity |
| **AI Patch** | Hallucinated invalid AI code | Patch applied blindly without verification | `validatePatch` re-scans in isolated copy; rejects patch if syntax errors occur |
| **Data Provenance** | Synthetic vs Human data | Synthetic data presented as human evidence | Strict metadata separation (`isRealHumanData = false`, `validParticipantCount = 0`) |
