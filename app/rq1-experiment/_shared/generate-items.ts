/**
 * Deterministic fixture content shared by all four RQ1 experiment conditions
 * (docs/research/RQ1_EXPERIMENT_PROTOCOL.md). Every condition renders exactly the same
 * ITEM_COUNT items with exactly this text, so the only intentional difference between
 * conditions is the rendering strategy (CSR vs SSR) and state-management strategy
 * (local vs global) -- never the content or workload size. No Math.random or Date-based
 * content: the same run always produces the same DOM.
 */
export const ITEM_COUNT = 50;

export interface FixtureItem {
  id: number;
  title: string;
  body: string;
}

export function generateItems(count: number = ITEM_COUNT): FixtureItem[] {
  const items: FixtureItem[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: i,
      title: `RQ1 Fixture Item #${i + 1}`,
      body:
        `This is deterministic fixture content for RQ1 experiment item ${i + 1} of ${count}. ` +
        `It exists only to give every rendering/state-management condition an identical, ` +
        `reproducible DOM size and text-content volume (see docs/research/RQ1_EXPERIMENT_PROTOCOL.md, ` +
        `Section 7, fixture equivalence).`,
    });
  }
  return items;
}
