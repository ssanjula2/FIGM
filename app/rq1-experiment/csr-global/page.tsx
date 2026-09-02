'use client';

/**
 * RQ1 experiment condition: CSR + GLOBAL state (docs/research/RQ1_EXPERIMENT_PROTOCOL.md).
 * Same CSR behavior as csr-local (empty shell until a client-side useEffect populates items),
 * but every item's counter lives in one shared GlobalStoreContext instead of local state.
 */
import { useEffect, useState } from 'react';
import { generateItems, type FixtureItem } from '../_shared/generate-items';
import ItemCardGlobal from '../_shared/ItemCardGlobal';
import { GlobalStoreProvider } from '../_shared/GlobalStore';

export default function CsrGlobalPage() {
  const [items, setItems] = useState<FixtureItem[]>([]);

  useEffect(() => {
    setItems(generateItems());
  }, []);

  return (
    <div data-testid="rq1-condition" data-condition="CSR_GLOBAL" style={{ padding: 24, background: '#030712', color: '#f8fafc', minHeight: '100vh' }}>
      <h1>RQ1 Experiment Fixture — CSR / GLOBAL state</h1>
      <GlobalStoreProvider itemIds={items.map((i) => i.id)}>
        <div>{items.map((item) => <ItemCardGlobal key={item.id} item={item} />)}</div>
      </GlobalStoreProvider>
    </div>
  );
}
