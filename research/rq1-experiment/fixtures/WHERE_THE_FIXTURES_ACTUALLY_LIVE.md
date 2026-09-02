# Fixture pages live in `app/rq1-experiment/`, not here

The RQ1 experiment fixture pages must be real, servable Next.js App Router routes so a real
browser (via Lighthouse/chrome-launcher) can navigate to them against the real production server —
a static file under `research/` cannot be measured that way. The fixtures are therefore
implemented as actual routes:

- `app/rq1-experiment/csr-local/page.tsx`
- `app/rq1-experiment/csr-global/page.tsx`
- `app/rq1-experiment/ssr-local/page.tsx`
- `app/rq1-experiment/ssr-global/page.tsx`
- `app/rq1-experiment/_shared/` — shared, deterministic fixture content and components
  (`generate-items.ts`, `GlobalStore.tsx`, `ItemCardLocal.tsx`, `ItemCardGlobal.tsx`)

See `docs/research/RQ1_EXPERIMENT_PROTOCOL.md` Section 7 for fixture equivalence documentation
(content size, DOM size, interaction workload) and the rationale for each condition's implementation.
