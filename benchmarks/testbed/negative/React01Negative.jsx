import { useMemo } from 'react';

// Clean: the expensive .sort() derived computation is wrapped in useMemo with a correct
// dependency array -- FIGM-REACT-01 must NOT fire.
export function SortedList({ items }) {
  const sortedItems = useMemo(() => [...items].sort((a, b) => a.value - b.value), [items]);
  return (
    <ul>
      {sortedItems.map((item) => (
        <li key={item.id}>{item.value}</li>
      ))}
    </ul>
  );
}
