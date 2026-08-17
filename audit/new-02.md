# Black-Box Verification — FIGM-NEXT-03 / `'use client'` Directive-Ordering Defect

**Date:** 2026-08-17
**Base commit:** `bb01d1c1` (`fix(FIGM-REACT-03): stop flagging router.push()/document.body.style/ref.current as state mutation`)
**Scope:** One rule (`FIGM-NEXT-03` — "App Router page missing `export const revalidate`") and its remediation. No other rule, file, or UI behavior was touched.
**Method:** Every claim below was reproduced against the live running system (real `RuleExecutionEngine`/`RemediationEngine` calls, the real `POST /api/scan` route on a running `next dev` server, and the real live-scan browser UI) — nothing here is inferred from reading code alone. No result was fabricated or assumed; where something could not be reproduced, that is stated explicitly (§6).

---

## 1. The defect, confirmed against real file contents first

Per instruction, every file containing `'use client'` was inspected directly before any conclusion was drawn.

`grep -rn "use client"` across `app/**/page.tsx` (25 files) showed **`'use client'` is the first line of every single App Router page in this project** — `app/live-scan/page.tsx:1`, `app/ai-fix/page.tsx:1`, `app/guidelines/page.tsx:1`, all 25 in total. None of the 25 contains `export const revalidate`/`dynamic` anywhere (`grep -rn revalidate app/**/page.tsx` returns zero matches in any page file). `app/diagnostics/[id]/page.tsx` is a 2-line re-export of `app/reports/[id]/page.tsx` and carries no directive of its own — not in scope.

So this codebase's own App Router pages are the exact shape the bug targets: every one is a Client Component missing `revalidate`.

**Root cause, read directly from source before any fix:**
- `src/ast/real-syntax-node-builder.ts:845-856` (`buildNext03Root`, the active real-AST path) fired whenever a file was `isAppRouterPageFile()` and lacked a `revalidate` export — **with no check for `'use client'`**, even though a sibling function `hasUseClientDirective()` already existed in the same file (line 787, used only by the FIGM-NEXT-01 builder).
- `src/parser/source-parser.ts:531` (legacy fallback path) had the identical gap: `isAppRouterPage && !hasRevalidateExport`, ignoring the already-computed `root.attributes.hasUseClientDirective` (line 488).
- `src/engine/remediation-engine.ts:371-380` (FIGM-NEXT-03's "Quick-Fix") unconditionally did `` `export const revalidate = 60; ...\n\n${code}` `` — prepending to line 1 regardless of what was already there.

**Reproduced live, before any fix**, via `RuleExecutionEngine.analyzeFile('app/live-scan/page.tsx', code)` + `RemediationEngine.applyQuickFix`, on:
```ts
'use client';

import React, { useState } from 'react';

export default function Page() {
  const [count, setCount] = useState(0);
  return <div onClick={() => setCount(count + 1)}>{count}</div>;
}
```
Result: `FIGM-NEXT-03` fired, and "Apply Fix" produced:
```ts
export const revalidate = 60; // [FIGM Quick-Fix]: adjust to this page's real staleness tolerance

'use client';
...
```
— `'use client'` moved to line 3, no longer the file's first statement. Verified this is not a cosmetic problem: `node_modules/next/dist/compiled/next-server/app-page*.js` (the actual installed Next.js 14.2.35 App Router runtime, present in this project's own `node_modules`) contains the compiler's own rejection path for exporting route-segment config from a `'use client'` file — this is an enforced restriction in the exact Next.js version this project ships, not a hypothetical.

## 2. Fix applied — detection gated, remediation given a hard backstop

Only the three files above were touched; no unrelated file, rule, or UI code was changed.

1. **`src/ast/real-syntax-node-builder.ts`** (`buildNext03Root`): added `if (hasUseClientDirective(ctx.sourceFile)) return;` — the function already existed for FIGM-NEXT-01, reused here rather than duplicated.
2. **`src/parser/source-parser.ts`** (legacy fallback, line ~531): added `&& !root.attributes?.hasUseClientDirective` to the existing condition, using the attribute the file already computed but never consulted for this rule.
3. **`src/engine/remediation-engine.ts`** (FIGM-NEXT-03 case): added a defense-in-depth guard — if the source starts with a `'use client'`/`"use client"` directive, the fix is refused (`requiresManualReview = true`) with an explanation of the real architectural options (move `revalidate` to a parent Server Component `layout.tsx`, or keep `page.tsx` as an async Server Component that renders the client piece as a child) rather than silently doing nothing or guessing at a restructure. Per instruction, **no automatic conversion of the Client Component to a Server Component was performed** — that decision is left to a human, consistent with how this file already treats FIGM-NEXT-02 (`monaco-editor` lazy-loading strategy) and FIGM-NEXT-04 (font `<link>` placement) as `requiresManualReview` rather than auto-applying an architecture change it can't safely infer.

Diff size: `+40 / -6` across the three files (`git diff --stat`).

**No test fixture anywhere in the suite exercised a `'use client'` + missing-`revalidate` combination before this fix** (`tests/rule-detection-matrix.test.ts:104-108`, `tests/ast-detection-rules.test.ts:107-112`, `tests/qa-matrix-boundary-adversarial.test.ts:274-288` — all FIGM-NEXT-03 fixtures are bare Server Component shapes with no directive). That gap is why the bug was live in a codebase whose every real page is the exact shape it breaks.

## 3. Re-verification after the fix, same reproduction

Same input as §1, re-run after the fix:
- `RuleExecutionEngine.analyzeFile('app/live-scan/page.tsx', clientCode)` → `FIGM-NEXT-03` no longer in the diagnostics list (`['FIGM-A11Y-01', 'FIGM-PERF-05']` only).
- A genuine Server Component page (`export default async function Page() { const data = await fetch(...); return <div>{data.title}</div>; }`, no `'use client'`) still fires `FIGM-NEXT-03` — confirms no over-suppression / regression on the rule's real target case.
- Forcing a synthetic `FIGM-NEXT-03` diagnostic directly at `RemediationEngine.applyQuickFix` against `'use client'` source (bypassing the detection-side gate, to test the remediation engine's own defense-in-depth independently): `requiresManualReview: true`, `remediatedCode === originalCode` (byte-for-byte unchanged) — the engine now refuses rather than corrupting the file even if a caller somehow reaches it with a stale/forged defect.

## 4. TypeScript, full test suite, production build

- `npx tsc --noEmit` — **zero errors.**
- `npm test` (the project's full 57-file suite via `node --test`) — **596/596 tests pass, 0 fail, 0 skipped** (`# tests 596 / # pass 596 / # fail 0`, `duration_ms 51690`). No test needed modification.
- `npm run build` (`next build`, Next.js 14.2.35) — **compiled successfully**, type-checked, all 49 routes generated (25 static `○`, 24 dynamic `ƒ`), no errors or warnings in the build output.

## 5. Dev server + live black-box verification (`next dev`, port 3002 — 3000/3001 already occupied)

All of the following were run against the actual running server, not simulated:

**`POST /api/scan` (the real API route the live-scan UI calls):**
| Input | Framework detected | `FIGM-NEXT-03` fired? |
|---|---|---|
| `'use client'` page, no `revalidate`, `fileName: app/live-scan/page.tsx` | `NEXT_JS` | No (correct — was `Yes` before the fix) |
| Server Component page (`async function Page()`, `fetch`), no `revalidate`, `fileName: app/feed/page.tsx` | `NEXT_JS` | Yes (correct, unchanged) |
| React JSX list component (array-index key) | `REACT_JSX` | `FIGM-REACT-02` fired correctly |
| Angular `@Component` class | `ANGULAR_TEMPLATE` | `FIGM-ANG-02` fired correctly |
| Vue SFC (`<template>`/`<script>`) | `VUE_SFC` | `FIGM-A11Y-01` fired correctly |

Full detect → remediate → re-scan cycle against the live server: Server Component page flagged → `RemediationEngine.applyQuickFix` → re-`POST /api/scan` on the remediated code → `FIGM-NEXT-03` no longer present, remediated code correctly starts with `export const revalidate = 60; ...`.

**Live browser UI (`http://localhost:3002/live-scan`, driven via real mouse/keyboard automation, not scripted API calls):**
- Pasted the same `'use client'` reproduction, filename `app/live-scan/page.tsx`: UI showed `Framework: NEXT_JS`, Issues: 1 (`FIGM-PERF-05`, a real and unrelated finding), quality 97/100 — **no `FIGM-NEXT-03` card**, confirming the fix end-to-end through the actual UI, not just the engine.
- Pasted the Server Component reproduction: UI correctly showed the `FIGM-NEXT-03` card ("App Router Route Segment Revalidation"). Clicked **Apply & Verify Fix**: editor updated to `export const revalidate = 60; // [FIGM Quick-Fix]...` on line 1, re-scan panel showed **"No Issues Found!" / 100/100** — the full remediate→re-scan loop verified visually in the running app, not asserted.
- Clicked the built-in "Next.js" sample tab (`DashboardPage.tsx`, a non-`page.tsx`-named fixture) — loaded and scanned normally (3 unrelated pre-existing findings: `FIGM-PERF-01` etc.), confirming no regression to the sample-loading path.

**Server log (`next dev` stdout) for the whole session:** every `POST /api/scan` returned `200`; the only non-200 entries were `401`s from `/api/notifications` and `/api/scans`, which is expected — the browser session was an anonymous/guest session, and those routes require auth. No `500`s, no stack traces, no Prisma errors.

## 6. One unresolved, non-reproducible observation (reported, not suppressed)

`read_console_messages` on the live browser tab logged one `[EXCEPTION] Object` with no message/stack (browser console tooling could not serialize it further). It was **not reproducible**: a global `window.addEventListener('error'/'unhandledrejection', ...)` probe installed immediately after was empty across a subsequent clean reproduction of the same UI action; a screenshot request also hit one transient 30s CDP timeout that resolved on retry with the app in a correct, responsive state. Nothing in the `next dev` server log correlates with it (no failed request at that timestamp). Given: (a) it did not reproduce under controlled conditions, (b) the three files changed in this fix are pure detection/remediation logic with no UI code touched, and (c) every functional check in §5 passed both immediately before and after it appeared — this is reported as an open, unexplained, low-confidence browser-console anomaly rather than claimed as fixed, caused by this change, or safely ignorable. It should not be read as evidence against the fix in §2, but it is also not being asserted as unrelated beyond the reasoning above — that would require further reproduction this session did not achieve.

## 7. Summary

| Item | Result |
|---|---|
| `'use client'` first-statement violation via FIGM-NEXT-03 auto-fix | **Fixed** — detection no longer flags Client Component App Router pages for this rule; remediation refuses (rather than corrupts) if ever reached anyway |
| Regression on genuine Server Component pages | **None** — rule still fires and auto-fixes correctly |
| `export const revalidate`/`dynamic` inserted into a Client Component file | **No longer possible** through this rule's fix path |
| Client→Server Component conversion performed to "make it valid" | **Not done** — out of scope per instruction; flagged for manual architectural decision instead |
| `tsc --noEmit` | 0 errors |
| Full test suite | 596/596 pass |
| `next build` | Success, 49/49 routes |
| Live scan: React / Next.js / Angular / Vue | All verified working via real `POST /api/scan` calls |
| Live remediate → re-scan cycle | Verified via API and via the real browser UI (Apply & Verify Fix) |
| New runtime/compile errors introduced | None found |
| Server logs | Clean (no 5xx, no stack traces) |
| Browser console | One non-reproducible, uncorrelated exception (§6) — reported, not fabricated away |
