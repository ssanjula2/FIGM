/**
 * RQ1 experiment condition: SSR + GLOBAL state (docs/research/RQ1_EXPERIMENT_PROTOCOL.md).
 * Server Component page (no 'use client' on the page itself) -- items are generated server-side
 * and passed into GlobalStoreProvider/ItemCardGlobal. Next.js server-renders client components
 * as part of the initial HTML too (they only additionally hydrate client-side), so the item
 * list's text content is present in the server response exactly as in ssr-local; the difference
 * from ssr-local is purely the state-management strategy (shared Context vs local useState).
 */
import { generateItems } from '../_shared/generate-items';
import ItemCardGlobal from '../_shared/ItemCardGlobal';
import { GlobalStoreProvider } from '../_shared/GlobalStore';

// See ssr-local/page.tsx's identical comment: forces genuine per-request SSR instead of
// Next.js's automatic static optimization, keeping the CSR/SSR distinction honest.
export const dynamic = 'force-dynamic';

export default function SsrGlobalPage() {
  const items = generateItems();

  return (
    <div data-testid="rq1-condition" data-condition="SSR_GLOBAL" style={{ padding: 24, background: '#030712', color: '#f8fafc', minHeight: '100vh' }}>
      <h1>RQ1 Experiment Fixture — SSR / GLOBAL state</h1>
      <GlobalStoreProvider itemIds={items.map((i) => i.id)}>
        <div>{items.map((item) => <ItemCardGlobal key={item.id} item={item} />)}</div>
      </GlobalStoreProvider>
    </div>
  );
}
