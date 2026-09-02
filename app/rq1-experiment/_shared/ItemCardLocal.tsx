'use client';

/**
 * Local/component state-management condition (docs/research/RQ1_EXPERIMENT_PROTOCOL.md,
 * Section A.2). Each card owns its own counter via useState -- no state is shared or lifted.
 */
import { useState } from 'react';
import type { FixtureItem } from './generate-items';

export default function ItemCardLocal({ item }: { item: FixtureItem }) {
  const [count, setCount] = useState(0);
  return (
    <div className="rq1-card" data-testid="rq1-item">
      <h3>{item.title}</h3>
      <p>{item.body}</p>
      <button type="button" onClick={() => setCount((c) => c + 1)} data-testid="rq1-increment">
        Count: {count}
      </button>
    </div>
  );
}
