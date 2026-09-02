# FIGM Layer 2 AI Remediation & Sandbox Verification Report

## Executive Summary
Layer 2 AI remediation in FIGM utilizes the official `@google/genai` SDK with the active `gemini-3.6-flash` model. Candidate patches returned by Gemini are NEVER trusted blindly; every patch must pass through an isolated 6-stage sandbox validation pipeline before acceptance.

---

## 1. Gemini Integration Architecture

- **Active Model**: `gemini-3.6-flash` (overridable via `process.env.GEMINI_MODEL`).
- **SDK**: Official `@google/genai` (server-side only, `src/ai/gemini-client.server.ts`).
- **Structured JSON Schema**:
  ```json
  {
    "status": "PATCH | DECLINE",
    "patch": "<complete source file>",
    "explanation": "<description>",
    "confidence": 0-100,
    "reason": "<decline reason>"
  }
  ```
- **Quota & API Failure Policy**: When Gemini returns HTTP 429 (`RESOURCE_EXHAUSTED`), timeout, network error, or invalid JSON, the client returns `{ status: 'AI_UNAVAILABLE', reason }`. No patches are fabricated, no regex fallbacks are invoked, and the original source file remains byte-for-byte unchanged.

---

## 2. 6-Stage Sandbox Validation Pipeline (`src/ai/sandbox-validation-pipeline.ts`)

```
Candidate AI Patch
       ↓
Stage 1: ISOLATION (written to os.tmpdir() isolated file)
       ↓
Stage 2: SYNTAX (ts.createSourceFile re-parse)
       ↓
Stage 3: PATCH_SCOPE (minimal patch heuristic LCS ratio check)
       ↓
Stage 4: COMPILE_AND_RESCAN (TypeScript TypeChecker + FIGM RuleExecutionEngine re-scan)
       ↓
Stage 5: FRAMEWORK_STRUCTURAL (@vue/compiler-sfc or angular-html-parser)
       ↓
Stage 6: TEST (runs co-located node --test file against temporary patch in place)
       ↓
ACCEPT (only if ALL stages PASS) / REJECT (original source preserved)
```

---

## 3. Mandatory Verification Results

1. **Re-Scan Final Authority**: Tested with `FIGM-PERF-05` (inline callback in render loop). Candidate patch leaving an unmemoized inline callback was detected again on Stage 4 re-scan and REJECTED.
2. **Quota / Error Handling**: Tested with malformed JSON and syntax errors. Status returned as `AI_UNAVAILABLE` or `REJECTED`, leaving source code unchanged.
3. **Original Source Preservation**: Verified byte-for-byte equality of original file SHA before and after any rejected patch.
