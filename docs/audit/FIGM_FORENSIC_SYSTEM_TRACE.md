# FIGM Code Inspector — Forensic System Trace Documentation

**Audit Date**: August 11, 2026  
**Auditor**: Senior Static-Analysis Engineer & Research Software Auditor  
**Repository**: `ssanjula2/FIGM`

---

## 1. End-to-End Execution Traceability Matrix

```
USER INPUT / UPLOAD / CODE PASTE
  │
  ▼
[1. Input Handler & File Classifier] ─── (src/parser/source-parser.ts :: detectFramework)
  │
  ▼
[2. AST Scope Parsing] ────────────────── (src/parser/source-parser.ts :: parseSource)
  │
  ├─► If Syntax Error: Inject SYNTAX_ERROR Diagnostic into ScanResult
  │
  ▼
[3. TypeScript Compiler Service] ──────── (src/analysis/type-checker-service.ts :: getTypeDiagnostics)
  │
  ├─► If Compiler Error: Inject TYPE_COMPILE_ERROR Diagnostic (e.g. TYPE-TS-2322)
  │
  ▼
[4. Abstract Logic Pattern Extraction] ─ (src/parser/alp-extractor.ts :: extractPrimitives)
  │
  ▼
[5. Guideline Predicate Execution] ────── (src/ast/ast-detection-engine.ts :: evaluateNode)
  │
  ▼
[6. Control-Flow Complexity Profiling] ─ (src/analysis/complexity/complexity-engine.ts :: calculateComplexity)
  │
  ▼
[7. Dynamic Runtime Profiling] ───────── (src/engine/dynamic-profiler.ts :: profileExecution)
  │
  ▼
[8. AI Remediation Patch Generation] ── (src/engine/remediation-engine.ts :: generateRemediation)
  │
  ▼
[9. Patch Isolated Re-Scan Loop] ─────── (src/engine/remediation-engine.ts :: validatePatch)
  │
  ├─► Re-run Syntax + TS Compiler + FIGM Rule Evaluation
  ├─► Mark FIXED ONLY IF Original Violation Resolved AND 0 New Syntax Errors
  │
  ▼
[10. Diagnostic Aggregation & Reporting] (app/api/scan/route.ts & UI Dashboard)
```

---

## 2. Component Execution Specification

| Stage | Implementation File | Key Function | Input Type | Output Artifact / Model | Fallback Mechanism | Test Coverage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Framework Detection** | `src/parser/source-parser.ts` | `detectFramework(filePath, code)` | `(string, string)` | `FrameworkType` | Defaults to `REACT_JSX` | `tests/adversarial-user-code-detection.test.ts` |
| **AST Parsing** | `src/parser/source-parser.ts` | `parseSource(code, filePath)` | `(string, string)` | `ParseResult` | Creates fallback Program AST node with `parseErrors` | `tests/adversarial-user-code-detection.test.ts` |
| **TS Type Checking** | `src/analysis/type-checker-service.ts` | `getTypeDiagnostics(code, filePath)` | `(string, string)` | `TypeDiagnostic[]` | Standalone file disclaimer notice | `tests/adversarial-user-code-detection.test.ts` |
| **ALP Extraction** | `src/parser/alp-extractor.ts` | `extractPrimitives(ast, framework)` | `(ASTNode, FrameworkType)` | `ALPPrimitiveNode[]` | Returns empty primitive list | `tests/alp-extraction.test.ts` |
| **Rule Execution** | `src/ast/ast-detection-engine.ts` | `evaluateNode(ast, filePath, framework)` | `(ASTNode, string, FrameworkType)` | `DiagnosticReport[]` | Skips unhandled nodes gracefully | `tests/rule-execution-engine.test.ts` |
| **Complexity Analysis** | `src/analysis/complexity/complexity-engine.ts` | `calculateComplexity(ast, code)` | `(ASTNode, string)` | `ComplexityMetrics` | Cyclomatic complexity baseline = 1 | `tests/code-complexity.test.ts` |
| **AI Remediation** | `src/engine/remediation-engine.ts` | `generateRemediation(code, diagnostic)` | `(string, DiagnosticReport)` | `PatchResult` | Fallback template patch generator | `tests/remediation-engine.test.ts` |
| **Patch Validation** | `src/engine/remediation-engine.ts` | `validatePatch(originalCode, patch, diag)` | `(string, string, DiagnosticReport)` | `PatchValidationResult` | Sets `PATCH_REJECTED` if re-scan fails | `tests/adversarial-user-code-detection.test.ts` |
