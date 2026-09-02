'use client';

/**
 * RQ1 experiment condition: CSR + LOCAL state (docs/research/RQ1_EXPERIMENT_PROTOCOL.md).
 * Client-Side Rendering: the initial HTML/hydration payload contains no fixture items -- they
 * are generated and painted only after the client-side useEffect runs, matching how a
 * pure-CSR SPA behaves (empty shell, then a client-side render pass populates content).
 * State management: each item owns its own local useState counter (ItemCardLocal).
 */
import { useEffect, useState } from 'react';
import { generateItems, type FixtureItem } from '../_shared/generate-items';
import ItemCardLocal from '../_shared/ItemCardLocal';

export default function CsrLocalPage() {
  const [items, setItems] = useState<FixtureItem[]>([]);

  useEffect(() => {
    setItems(generateItems());
  }, []);

  return (
    <div data-testid="rq1-condition" data-condition="CSR_LOCAL" style={{ padding: 24, background: '#030712', color: '#f8fafc', minHeight: '100vh' }}>
      <h1>RQ1 Experiment Fixture — CSR / LOCAL state</h1>
      <div>{items.map((item) => <ItemCardLocal key={item.id} item={item} />)}</div>
    </div>
  );
}
