import React, { useState } from 'react';

export function ReactComponent({ items }: { items: Array<{ id: string; name: string }> }) {
  const [data, setData] = useState({ count: 0 });

  const handleClick = () => {
    // FIGM-REACT-03: Direct state mutation
    data.count += 1;
    setData(data);
  };

  return (
    <div>
      {/* FIGM-A11Y-01: Non-interactive div with click handler */}
      <div onClick={handleClick}>
        {/* FIGM-PERF-02: Native img tag missing explicit width/height */}
        <img src="/avatar.png" alt="Avatar" />
        <span>Count: {data.count}</span>
      </div>

      <ul>
        {items.map((item) => {
          // FIGM-PERF-01: Invariant object allocation in loop
          const style = { padding: '8px', color: 'red' };
          return <li key={item.id} style={style}>{item.name}</li>;
        })}
      </ul>
    </div>
  );
}
