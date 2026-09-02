'use client';

/**
 * Centralized/global state-management condition counterpart to ItemCardLocal -- reads and
 * dispatches through GlobalStoreContext instead of owning its own useState.
 */
import type { FixtureItem } from './generate-items';
import { useGlobalStore } from './GlobalStore';

export default function ItemCardGlobal({ item }: { item: FixtureItem }) {
  const { counters, increment } = useGlobalStore();
  const count = counters[item.id] ?? 0;
  return (
    <div className="rq1-card" data-testid="rq1-item">
      <h3>{item.title}</h3>
      <p>{item.body}</p>
      <button type="button" onClick={() => increment(item.id)} data-testid="rq1-increment">
        Count: {count}
      </button>
    </div>
  );
}
