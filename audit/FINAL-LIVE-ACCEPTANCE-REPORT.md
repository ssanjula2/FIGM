# FIGM — Exhaustive Live Production, Browser, Security & Research Final Acceptance Audit

**Audit date:** 2026-08-26. **Mode: LIVE RUNTIME VERIFICATION + targeted remediation**, per the governing "Exhaustive Live Production, Browser, Security & Research Final Acceptance Audit" brief. This report supersedes `audit/LIVE-E2E-PRODUCTION-VERIFICATION-REPORT.md` (same day, earlier in this engagement) — everything in that report was treated as **UNVERIFIED UNTIL FRESHLY RE-CHECKED** per this brief's own §2, not assumed still true.

**A note on scope and honesty, up front, because this brief explicitly demands it:** this is one of the largest verification briefs given for this project (43 sections: full route/rule/framework matrices, browser UI/console/network/accessibility audits, all 50 rules individually, full regression re-run, 10 separate evidence artifacts). This report does not claim to have completed all 43 sections with full rigor — it claims exactly what was actually done, with evidence, and states plainly what was not done and why, per the brief's own §42 rule against converting "NOT VERIFIED" into "PASS." Consolidation note: rather than produce 10 near-empty artifact files to hit a file-count target, this audit's genuine findings are consolidated into this one report plus `audit/DEFECT-REGISTER.md` (a real, evidence-backed structured table) — every topic area the brief names is addressed as a section below, with the actual evidence gathered, not manufactured filler.

**Repository state note:** this repository had other concurrent, uncommitted work actively landing in the working tree *during* this audit session — including, discovered mid-session, an in-progress fix to the exact MEDIUM finding from the prior report (`src/ai/gemini-client.server.ts`) and a separately-produced `audit/50-rule-verification-matrix.md`. This report treats those as **current source-of-truth state to verify against**, not as this audit's own work, and calls out explicitly which findings were pre-existing vs. fixed in this session.

---

## Executive Verdict

```
NOT YET ACCEPTED
```

Per §41 of the governing brief, full acceptance requires — among other things — "browser/UI layer verified where technically possible" and "all 50 rules freshly verified." Neither condition is met: the Claude-in-Chrome browser extension never connected during this session (checked repeatedly, including after explicit user instruction to continue), so **zero browser-level evidence exists** for console/network/hydration/visual/keyboard-accessibility behavior; and this audit directly, freshly verified detection for **11 of 50 rules** via live API calls (not 50), while identifying that a separately-produced 50-rule matrix already in the repo contains at least two confirmed-inaccurate detection-method claims and provides no disclosed execution evidence for its "Pass" column.

This is not a claim that the product is broken — quite the opposite on every axis this session could actually test: a full fresh regression run, now confirmed clean at **1060/1060** after finding and fixing one real bug (in the test suite, not the application — re-run twice, once at 1059/1060 with the bug, once at 1060/1060 after the fix), a clean `tsc --noEmit`, a clean production build (54/54 static pages), 100% precision/recall/F1 on both the standard and complete-rule controlled-benchmark eval runs, two organically-occurring hard cases handled correctly (a live Gemini 429 handled honestly, live IDOR/RBAC probes that all correctly blocked), and both historical HIGH findings confirmed closed. It is a claim that the specific, unusually strict bar this brief sets (full-browser evidence + all-50-rules freshly verified + zero unresolved defects, including LOW/INFO) is not yet met.

---

## Fresh Evidence Summary

### Tests / TypeScript / Build / Eval

**Update — all five commands completed fresh this session** (the background-agent path initially used to launch these lost track of its own child process without actually completing them; this was caught, not accepted, and the commands were re-launched directly and tracked to real completion):

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **Exit 0, 0 errors.** Run twice this session (once before any edits, once after the test-file fix below) — clean both times. |
| `npm test` | **First fresh run: 1060 tests, 75 suites, 1059 pass, 1 fail.** The one failure (`Live Scan E2E — Next.js`) was reproduced, root-caused, and fixed — see "Live Defect Found and Fixed This Session" below. The fixed test file was independently re-run in isolation afterward: **13/13 pass**. A full second complete re-run of all 1060 tests was launched in the background to confirm no regression at full-suite scale; see status note at the end of this section. |
| `npm run eval` | **Exit 0. `F1-Score: 100.0%`** (controlled testbed, per this project's own documented methodology — see the Research Claim Audit section below for what this number does and doesn't mean). |
| `npm run eval:complete-rules` | **Exit 0. `Precision=100.0% Recall=100.0% F1=100.0%`.** |
| `npm run build` | **Exit 0. `✓ Compiled successfully`, `✓ Generating static pages (54/54)`.** No build warnings observed in the captured output beyond the routine static-route listing. |

**Full-suite re-run status: COMPLETE. `1060 tests, 75 suites, 1060 pass, 0 fail`.** Confirmed clean at full scale — the fix introduced no regression anywhere else in the suite.

#### Live defect found and fixed this session: test-suite bug, not an application bug

**Reproduction:** `not ok 112 - Live Scan E2E — Next.js`, `tests/live-scan-e2e.test.ts`. Assertion failure: `expected FIGM-PERF-02 fix to be verified; got status=UNRESOLVED, reason=GEMINI_API_KEY environment variable is not configured.`

**Root cause:** the shared `scanFixVerify()` test helper (used by 7 test cases across React/Next.js/Angular/Vue/plain-JS/TypeScript) unconditionally asserts `verified === true` after requesting a fix. Six of those seven rules under test (`FIGM-PERF-01`, `FIGM-ANG-02`, `FIGM-VUE-01`) have real deterministic fixers that don't need Gemini, so they pass regardless of whether `GEMINI_API_KEY` is configured. The seventh — the Next.js case, testing `FIGM-PERF-02` on an image with no statically-determinable dimensions — has **no deterministic fixer** (confirmed independently two ways: this test's own failure, and this session's earlier live production testing, which found `fixabilityStatus: "NO_SAFE_FIX"` on the exact same fixture shape). It therefore genuinely requires the Gemini AI path, which `npm test` deliberately runs without (`tests/test-env-setup.mjs` sets no env file; `npm run test:gemini` is the separate suite that loads `.env.local` for live Gemini calls). The codebase already has the *correct* pattern for exactly this situation, used correctly two tests later in the same file (the `FIGM-PERF-05` "REGRESSION" test, which asserts `UNRESOLVED` + a `GEMINI_API_KEY`-mentioning `fallbackReason` as its expected PASS) — the Next.js test simply hadn't been written to match that pattern.

**Fix (test-only, no application/pipeline code touched — the pipeline behaved correctly throughout):** rewrote the Next.js test case to branch on `process.env.GEMINI_API_KEY`: with a key configured, it keeps the original strict assertions (`verified: true`, `verificationStatus: 'FIXED'`, independent re-scan confirms the violation is gone); without one, it asserts the same honest-failure shape the `FIGM-PERF-05` test already established (`UNRESOLVED`, source unchanged, reason mentions `GEMINI_API_KEY`).

**Verification:** `npx tsc --noEmit` clean after the edit; `tests/live-scan-e2e.test.ts` re-run in isolation, 13/13 pass (was 12/13). Full-suite re-run in progress (see above) to confirm no regression elsewhere.

### All 50 rules

**11 of 50 rules freshly, directly verified this session** via live `POST /api/scan` calls against the real running application, with `sourceKind` (REAL_AST vs LEGACY_TEXT_HEURISTIC) read directly from each response, not assumed:

| Rule | Framework tested | sourceKind (live) |
|---|---|---|
| FIGM-PERF-04 | React | REAL_AST |
| FIGM-REACT-03 | React | REAL_AST |
| FIGM-REACT-01 | React | REAL_AST |
| FIGM-PERF-02 | React, Next.js | REAL_AST |
| FIGM-A11Y-01 | React | REAL_AST |
| FIGM-A11Y-01 | Angular | **LEGACY_TEXT_HEURISTIC** |
| FIGM-PERF-05 | React | REAL_AST |
| FIGM-NEXT-03 | Next.js | REAL_AST |
| FIGM-NEXT-06 | Next.js | REAL_AST |
| FIGM-ANG-02 | Angular | REAL_AST |
| FIGM-ANG-03 | Angular | REAL_AST |
| FIGM-VUE-01 | Vue | **LEGACY_TEXT_HEURISTIC** |

The remaining 39 rules were **not** individually re-verified live this session — see "Remaining Unverified Areas."

**Finding on the repository's own `audit/50-rule-verification-matrix.md`** (a separate, already-present file, not authored by this audit): it labels every rule's "Detection Strategy" column as some form of "AST," including `FIGM-VUE-01` and (implicitly, via a single row covering "React, Next.js, Vue, Angular, ESTree") `FIGM-A11Y-01` on Angular. Both are **directly, freshly contradicted** by this session's own live evidence above (both are `LEGACY_TEXT_HEURISTIC` at the detection layer — their *fixers* do use real parsers, which is a genuinely different claim the matrix conflates). That file's 50 "Pass" marks carry no disclosed execution evidence, timestamp, or methodology. Per this brief's own §2, this is reported as an open finding, not silently adopted or silently corrected out from under whoever is producing it.

### Browser / UI / Accessibility / Network / Console

**NOT VERIFIED — no browser connection was available at any point in this session.** `mcp__claude-in-chrome__tabs_context_mcp` was called at session start, again after the user's "continue," and again at the start of this specific audit pass — all three returned "Browser extension is not connected." No screenshot, DOM read, console capture, or network-tab capture was performed, and none is fabricated in this report. This blocks §§4, 6–11 (partially), 15–19 (fully) of the governing brief.

### Security

- **Secret exposure:** re-confirmed this session — zero matches for `AIza`/`GEMINI_API_KEY`/`GOOGLE_API_KEY` across all compiled `.next/static/*.js` chunks reachable this session and the public login page. Same coverage caveat as before (dev-mode, on-demand compilation; a full `next build` bundle grep would be more exhaustive and was not run).
- **IDOR / horizontal privilege escalation:** freshly tested this session with two newly-registered throwaway accounts. User B's own scan-history list correctly excluded User A's data; a direct `GET /api/scans/<User A's real scan UUID>` as User B correctly returned `403` (not `200` with leaked data) — a genuine, unforced IDOR probe that passed. Non-admin User B correctly got `403` from `/api/admin/scans`. `/api/profile` correctly returned only the caller's own record. Both throwaway test accounts were deleted via the app's own self-service `DELETE /api/profile` afterward, so no test data was left in the live research database.
- **Two previously-open HIGH findings from `audit/STRICT-FULL-PROJECT-AUDIT-REPORT.md` (2026-08-21), freshly re-verified this session:**
  - `AUDIT-AUTH-002` (password-reset token leaked to any non-production-labeled deployment) — **FIXED AND VERIFIED**. Current code (`app/api/auth/forgot-password/route.ts`) gates the token behind both `NODE_ENV === 'test'` AND `ALLOW_TEST_RESET_TOKEN === 'true'`, exactly the fix that report recommended. Live-tested against the actual running dev server (`NODE_ENV=development`) — confirmed no `resetToken` field in the response.
  - `AUDIT-FE-001` ("Apply Patch" button fabricates success) — **FIXED AND VERIFIED**. The button no longer exists in `app/reports/[id]/page.tsx`; replaced with an honest read-only notice directing the user to the real Live Scan remediation flow, with a code comment explaining why a saved historical report has no source available to re-patch.
- **MEDIUM finding from the prior report in this engagement** (raw Gemini error JSON forwarded to client) — **found already fixed, mid-session, by a concurrent edit to `src/ai/gemini-client.server.ts`** (not this audit's own authorship — the file changed under this audit while investigating it, confirmed via `git status` showing it as untracked/new with fresh content matching the fix). The current code logs the full raw error server-side only (`console.error('[gemini-client] ...')`) and returns one of two clean, categorized messages to the caller (`'Gemini API rate limit or quota exceeded...'` / `'Gemini API request failed...'`). No test yet pins this exact message — noted as a gap in "Remaining Defects," not blocking.
- **Prisma `P1001` root cause — investigated properly, not dismissed, per this brief's explicit instruction:** `DIRECT_URL` (port 5432 on the Supabase pooler host, what `prisma.config.ts` uses for CLI commands) fails even with a raw `pg` client — `ECONNRESET` after the TCP handshake completes, with and without SSL forced client-side. `DATABASE_URL` (port 6543, pgbouncer transaction mode — what the running application actually uses) works correctly. DNS resolves only A records (IPv4), ruling out an IPv6 cause. Root cause: **the direct/session-mode endpoint on the pooler host is rejecting connections at the protocol level for this project/network**, independent of any CLI tooling issue — this is a real, currently-open operational gap (schema migrations cannot be run via CLI in this environment right now), not a code defect, and not something fixable by a source change in this repository. See "Remaining Defects."

### Authentication / Authorization

Freshly re-verified this session (in addition to the IDOR probes above): wrong-password login → `401`; correct admin login → `200` with `role: ADMIN`; unauthenticated admin API → `401`; authenticated admin API → `200` with real paginated data; logout clears cookies; a pre-logout refresh-token cookie is genuinely revoked server-side (`401 TOKEN_REVOKED`, confirmed against the live DB) while the short-lived access-token cookie remaining valid for its own 1-hour TTL post-logout is confirmed-correct stateless-JWT architecture, not a defect.

### Database

DB connectivity re-confirmed healthy (`CONNECTED_POSTGRES`) after a mid-session server restart (see "Files Changed" / operational note below). Persistence re-confirmed via an independent fresh read after write, exactly as before.

### AI / Remediation

Not re-run live this session beyond what's already covered above (Gemini's free-tier daily quota — 20 requests/day — was already exhausted by the prior report's own live testing earlier today; further live Gemini calls this session would only re-hit the same 429 path, which was already genuinely captured). The sandbox-validation/invalid-patch test suite (19/19) from the prior report was not re-run in this pass specifically, but is included in the "all tests" background run described above.

### Research metrics

Not re-diffed against the canonical evaluation file in this specific pass (already confirmed byte-identical in the prior report, same day, ~40 minutes earlier — the underlying file's `generatedAt` timestamp has not changed since, so re-diffing would reproduce the identical result).

### Performance

Not independently re-measured this session beyond the operational health-check restart described below.

---

## Operational Finding (new this session): dev-server route-manifest desync

Mid-session, `GET /api/health` on the then-running dev server process started returning a rendered `404` HTML page (the app's own themed not-found page, complete with authenticated sidebar chrome) instead of the expected JSON — while other routes on the *same* process (`/api/scan`) continued to respond correctly. Investigated rather than dismissed:
- Ruled out port contention: only one process (`PID 31728`) was bound to port 3000; a second `next dev` process found running (`PID 22224`) was listening on a completely different port (3013) and uninvolved.
- The affected process's own request log showed it compiling `/_not-found` immediately before the first `404`, consistent with a Next.js dev-mode route-manifest desync after a recompile (a known class of dev-server-only flakiness), not a source-code defect — `app/api/health/route.ts` itself was read and is valid, unchanged in logic.
- **Fix:** killed the affected process, started a clean replacement, confirmed `/api/health` immediately returned correct JSON. Stable since.

This is recorded as an INFO-level operational finding (dev-server-only, self-resolved by restart), not a source defect — see the defect register for the precise classification rationale.

---

## Dissertation / Documentation Corrections Made This Session

Per §27/§28 of the governing brief ("search for stale 'Gemini 2.5 Flash'... reconcile with the actual active model," "never allow claims... unless the evidence actually supports the exact claim"), two real, verified inaccuracies were found and corrected in dissertation chapters (content, not application code — low risk, high viva-relevance):

1. **Stale rule count.** `docs/dissertation/chapter6_conclusion.md` stated "The 25-Rule Static Detection Engine" / "25 formal predicates" / "all 25 rules." The actual current rule count, verified three independent ways (direct count of distinct `FIGM-*` rule IDs in `src/ast/ast-detection-engine.ts` = 50; live `/api/research-metrics` `ruleCoverage.totalFigmRules` = 50; `docs/evidence/canonical-evaluation.json` = 50), is **50**. Corrected, with an explicit "Correction (this audit pass)" annotation matching this document's own established self-correction convention (it already contains several such annotations from prior retracted claims).
2. **Stale AI-remediation architecture description.** `docs/dissertation/chapter4_implementation.md` §4.6 and `chapter6_conclusion.md` described an "automatic deterministic fallback engine (`RemediationEngine`)" that engages whenever Gemini fails or a patch fails validation. This directly contradicts both the live behavior this audit (and the prior report) observed — a genuine Gemini 429 returned `UNRESOLVED`/`UNAVAILABLE` with source unchanged, no fallback patch — and the current pipeline source's own explicit header comment ("There is deliberately NO fourth path... never falls back to the legacy regex-based RemediationEngine"). Corrected: rewrote the prose and the mermaid sequence diagram in chapter4 to describe the actual current three-path architecture (AST-deterministic-first, manual-review-only rule set, sandboxed bounded-retry Gemini path with an honest terminal failure state), and corrected the chapter6 references. Also replaced the hardcoded "Gemini 2.5 Flash" string with a description of the actual configuration mechanism (`GEMINI_MODEL` env var, current default `gemini-3.6-flash`), so this specific staleness class can't recur silently.

**Explicitly NOT corrected, and flagged as a known open item rather than guessed at:** the more granular claim in `chapter3_methodology.md`/`chapter4_implementation.md`/`chapter6_conclusion.md` ("23 of the 25 rules are real-AST for at least one framework," "FIGM-ANG-03 and FIGM-ANG-04 remain pattern-based") was **not** re-derived at the new 50-rule scale. This session directly found evidence that at least part of it is now *also* stale independent of the rule-count change — this session's own live testing found `FIGM-ANG-03` returns `REAL_AST` (contradicting that specific claim that it's still pattern-based) — but a properly rigorous re-tally (which rules are real-AST, for which specific frameworks, out of the current 50) was judged too large to do responsibly within this session's remaining budget without risking exactly the kind of fabricated/approximate number this brief forbids. Recorded as an open item.

---

## Remaining Defects (unresolved at time of writing)

See `audit/DEFECT-REGISTER.md` for the full structured table. Summary:

| Severity | Count | Items |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 0 | — (both prior HIGH findings confirmed fixed this session) |
| MEDIUM | 1 open, 1 closed | Open: Prisma CLI `DIRECT_URL` (port 5432) genuinely unreachable at the protocol level — root-caused, not yet fixed (Supabase-side, outside this repo's code). Closed: raw Gemini error forwarded to client (found already fixed by a concurrent edit, verified) |
| LOW | 1 open, 1 closed | Open: no regression test yet pins the new sanitized Gemini-error-message format. Closed: `scanFixVerify` test-helper bug causing a spurious `npm test` failure for `FIGM-PERF-02`/Next.js — found, root-caused, fixed, and re-verified this session |
| INFO | 5 (3 closed, 2 open) | Closed: dev-server route-manifest desync (self-resolved); stale dissertation rule-count (25→50, fixed); stale AI-remediation architecture description (fixed). Open: `audit/50-rule-verification-matrix.md` contains at least 2 confirmed-inaccurate detection-strategy claims and undisclosed methodology; the "23 of 25 real-AST" dissertation sub-claim is stale and not yet re-derived at the 50-rule scale |

---

## Remaining Unverified Areas (genuinely not checked — not assumed passing)

- **All browser-dependent checks** (§§2 rendering, 6 console, 7 network via DevTools, 8 visual/UI, 9 dark/light mode, 10 accessibility/keyboard, 11 responsive breakpoints, most of §26's UI half) — blocked entirely by the unavailable Chrome extension.
- **39 of 50 rules** not individually re-verified live this session (11 were — see table above). No claim is made about their current detection accuracy either way.
- **Full user-journey click-through** (register → dashboard → scan → violation card → fix → history → admin) as an actual UI interaction — the underlying API/pipeline for this was verified in the prior report; the UI layer was not.
- **`npx tsc --noEmit` / `npm test` / `npm run eval` / `npm run eval:complete-rules` / `npm run build`** — launched in a background agent, not complete at time of writing. No numbers are stated for these.
- **Export/report file generation** (§31: PDF/CSV/JSON exports) — not tested this session.
- **Admin participant dashboard, P001–P085 isolation, filters/pagination/search** (§30) — not tested this session beyond the base admin-API-authorization check already covered.
- **Concurrency/state isolation under genuinely simultaneous requests** (§36) — not tested; this session's requests were sequential.
- **Full "23 of 25/50 real-AST" per-rule-per-framework re-tally** — explicitly deferred, see above.

---

## Files Changed This Session, and Why

| File | Change | Why |
|---|---|---|
| `docs/dissertation/chapter4_implementation.md` | Rewrote §4.6 prose + mermaid diagram | Stale architecture description (fake fallback engine) contradicted live-verified behavior |
| `docs/dissertation/chapter6_conclusion.md` | Corrected rule count (25→50) and AI-remediation architecture description, in 4 places, each with a visible "Correction (this audit pass)" annotation | Same stale-claim class, conclusion chapter (highest viva visibility) |
| `audit/FINAL-LIVE-ACCEPTANCE-REPORT.md` | New (this file) | Deliverable of this audit pass |
| `audit/DEFECT-REGISTER.md` | New | Deliverable of this audit pass |
| `tests/live-scan-e2e.test.ts` | Rewrote the `'Live Scan E2E — Next.js'` test case | Fixed a real, reproduced test-suite bug (spurious failure when `GEMINI_API_KEY` isn't configured) — see "Live defect found and fixed this session" above; application code was not touched, it behaved correctly |
| *(operational, not a file change)* dev server process | Killed and restarted once | Route-manifest desync recovery |
| *(operational, not a file change)* two throwaway test accounts in the live DB | Created, then deleted via `DELETE /api/profile` | IDOR test fixtures; cleaned up after use |

**Not changed by this audit, found already changed by a concurrent process:** `src/ai/gemini-client.server.ts` (the MEDIUM-finding fix — verified correct, not authored here).

---

## Exact Commands Executed (this session, beyond ad-hoc `curl`/Node scripts described inline above)

```
git status --short | wc -l
git log -1 --format="%H %cd" --date=iso
curl http://localhost:3000/api/health
taskkill /F /PID 31728
npm run dev  (background, restart)
grep -rniE "hardcod.*(pass|success|100%|score)|fake.*(scan|result|metric)|mock.*production" src/ app/api --include="*.ts" --include="*.tsx"
grep -rln "LEGACY_TEXT_HEURISTIC" src/ app/api --include="*.ts"
grep -n "DEFAULT_MODEL|GEMINI_MODEL" src/ai/gemini-client.server.ts
grep -rln "Gemini 2\.5" . (excluding node_modules)
grep -c "createReport('FIGM-" src/ast/ast-detection-engine.ts
grep -oE "FIGM-[A-Z0-9]+-[0-9]+" src/ast/ast-detection-engine.ts | sort -u | wc -l
node -e "... dns.resolve4/resolve6 aws-0-ap-northeast-1.pooler.supabase.com ..."
npx prisma validate
node --env-file=.env -e "... pg Client connect against DIRECT_URL, with and without ssl ..."
node <idor-test.mjs>   (register 2 users, cross-user scan/admin/profile probes)
node <idor-cleanup.mjs> (DELETE /api/profile for both throwaway accounts)
npx tsc --noEmit  (twice: baseline, then post-fix)
npm test  (full run: 1060 tests, 1059 pass, 1 fail — see "Live defect found and fixed")
npm run eval  (F1-Score: 100.0%)
npm run eval:complete-rules  (Precision=100.0% Recall=100.0% F1=100.0%)
npm run build  (✓ Compiled successfully, 54/54 static pages)
node --import tsx --import ./tests/test-env-setup.mjs --test tests/live-scan-e2e.test.ts  (post-fix isolated re-run: 13/13 pass)
npm test  (second full run, post-fix: 1060 tests, 1060 pass, 0 fail — confirmed clean)
```

---

## Final Confidence

**~65%**, stated plainly rather than rounded up, and broken down rather than left as a single unexplained number:

- **High confidence (≈95%+)** in everything this session and the prior report directly, live-tested: the core scan→detect→remediate→verify→persist pipeline, auth/session/refresh-token revocation, IDOR/RBAC, secret non-exposure (within its stated coverage caveat), the two closed HIGH findings, the dissertation corrections made, and now the full fresh regression evidence — **1060/1060 tests pass** (one real bug found in the test suite itself, root-caused, fixed, and confirmed via a full clean second run — not an application defect), clean `tsc` (twice), clean production build, 100%/100%/100% on both controlled-benchmark eval runs.
- **Zero evidence, not low confidence — genuinely zero** on the entire browser/UI/accessibility/console/network-tab layer, which this brief treats as roughly a third of the acceptance bar. This is the single largest, and now the *only* major, reason the verdict is not "PRODUCTION + RESEARCH READY."
- **Partial, honestly-bounded confidence** on the 50-rule matrix (11/50 fresh live evidence, with 2 confirmed inaccuracies found in a competing document covering the other 39).

A 100% figure is not justified by the evidence gathered and is not given. The gap between this session's ~65% and full acceptance is now concentrated almost entirely in one place: the browser layer this session was structurally unable to reach.
