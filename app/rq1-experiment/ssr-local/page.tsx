/**
 * RQ1 experiment condition: SSR + LOCAL state (docs/research/RQ1_EXPERIMENT_PROTOCOL.md).
 * Server-Side Rendering: this is a Next.js Server Component (no 'use client') -- all 50
 * fixture items are generated and rendered into the initial HTML on the server, so they are
 * present the moment the response arrives, before any client JS executes. Only the per-item
 * counter (ItemCardLocal) is a client component leaf; the list structure itself is server-
 * rendered, matching how a real SSR page ships pre-rendered content.
 */
import { generateItems } from '../_shared/generate-items';
import ItemCardLocal from '../_shared/ItemCardLocal';

// Without this, Next.js statically optimizes this page at build time (since generateItems() has
// no request-time input), which would make this condition Static Generation, not genuine
// per-request Server-Side Rendering -- forcing dynamic rendering keeps the CSR/SSR distinction
// honest (see docs/research/RQ1_EXPERIMENT_PROTOCOL.md, Section A.1).
export const dynamic = 'force-dynamic';

export default function SsrLocalPage() {
  const items = generateItems();

  return (
    <div data-testid="rq1-condition" data-condition="SSR_LOCAL" style={{ padding: 24, background: '#030712', color: '#f8fafc', minHeight: '100vh' }}>
      <h1>RQ1 Experiment Fixture — SSR / LOCAL state</h1>
      <div>{items.map((item) => <ItemCardLocal key={item.id} item={item} />)}</div>
    </div>
  );
}
