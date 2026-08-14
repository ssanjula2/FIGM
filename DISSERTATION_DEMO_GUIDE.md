# FIGM Code Inspector — Final Year Dissertation Demonstration Guide

This guide provides a step-by-step walkthrough for demonstrating the FIGM Code Inspector project
during the viva defense and research presentations. Every claim in Section 5 is reconciled against
the live evaluation pipeline (`docs/evidence/canonical-evaluation.json`) — reproduce it live during
the demo rather than reciting the numbers below from memory, since they can change as the
ground-truth benchmark or rule set evolves.

---

## Demonstration Agenda (15-Minute Viva Flow)

### 1. Introduction & Research Problem (2 Minutes)
- **Topic**: Automated SPA Quality & Guideline Enforcement across Frameworks.
- **Problem**: Modern web applications written in React, Next.js, Angular, and Vue suffer from framework-specific performance bottlenecks and accessibility defects that traditional linters fail to normalize under one taxonomy.
- **Solution**: Framework-Independent Guideline Model (FIGM) — a 4-layer meta-model (Domain → Concern → ALP → Rule) with 25 guideline rules.

### 2. Multi-Tenant SaaS Workspace & Dashboard (3 Minutes)
- **Live Demo**: Show overview page, active projects grid, quality statistics cards, recent scan reports, and activity feed.
- **Features Highlighted**: Supabase PostgreSQL persistence, role-based access control (`ADMIN`, `DEVELOPER`, `AUDITOR`), and realtime notifications via Supabase Realtime.
- **If asked whether this is a live public production deployment**: the architecture is genuinely multi-tenant with real auth/RLS, but state plainly that there is no public deployment serving real paying users — this is a research prototype with production-shaped architecture, not a launched commercial product.

### 3. Automated Code Inspection Engine (4 Minutes)
- **Live Demo**: Paste React JSX, Next.js, Angular, or Vue component code into the Live Scan workspace (`/live-scan`) and click **"🚀 Check My Code Now"**.
- **Results**: Show the diagnostics list — rule ID, severity, exact line/column location, evidence (with a 🌳 real-AST vs 📝 text-heuristic badge per finding), explanation, and standard reference (ISO/IEC 25010 or a specific WCAG 2.2 Success Criterion, not a blanket citation).
- **Talking point**: mention that 23 of the 25 rules are detected via the real TypeScript compiler API on the frameworks where that syntax is real; the remaining 2 (Angular template markup) plus every rule on Vue files use a labeled text-heuristic fallback — the UI never hides which mechanism produced a given finding.

### 4. AI Remediation (verified, not just generated) (3 Minutes)
- **Gemini AI Integration**: Click a defect's **"✨ Apply & Verify Fix"** button.
- **Key point to demonstrate, not just assert**: after the fix is applied, the pipeline automatically re-scans the patched code and only marks it "Verified Fixed" if the original violation is confirmed gone — show a rule where this succeeds, and (if time allows) a rule that correctly reports "Manual Review Required" instead of a fabricated success (e.g. a rule requiring a `useMemo`/`useCallback` dependency array the pipeline cannot safely infer).
- **Report Export**: Generate and download PDF, HTML, JSON, CSV, and Markdown inspection reports.

### 5. Research Benchmark & Empirical Evaluation (3 Minutes)
- **Automated Benchmark Runner**: Run `npm run research:evaluate` in a terminal. This re-scans the real ground-truth fixture set (`benchmarks/testbed`: 4 files, 147 LOC covering React, Vue, Angular, and vanilla JS) against `benchmarks/ground-truth.json`'s 19 hand-labelled violations.
- **Statistical Results**: Read the live output — currently **Precision 90.5%, Recall 100%, F1-Score 95.0%** (19 True Positives, 2 False Positives, 0 False Negatives). **State the scope explicitly**: this benchmark covers 8 of the 25 rules (`FIGM-PERF-01..04`, `FIGM-A11Y-01..04`); the other 17 rules are verified only by unit-level positive/negative fixture tests, not by this empirical benchmark. Do not present this as "100% accuracy across all 25 rules" or as evaluated against "30 repositories" — neither is true; a fabricated 30-repository/755k-LOC dataset existed earlier in this project's history and was deleted after being found to have no real scans behind it (worth mentioning proactively if asked about evaluation scale, since it is a genuine, disclosed limitation rather than something to hide).
- **Automated Thesis Exporter**: Show the generated dissertation chapter (`docs/dissertation/chapter5_empirical_validation_and_benchmarks.md`) and point out that it is regenerated directly from the same live command just run — not a separately hand-maintained document, so it cannot silently drift from the number on screen.
- **Live UI cross-check**: Open `/analytics` in the running app and show the same Precision/Recall/F1 figures appearing there, sourced from the same `GET /api/research-metrics` → `benchmarks/eval-summary.json` pipeline — demonstrating there is exactly one source of truth across the dissertation, the API, and the UI.
