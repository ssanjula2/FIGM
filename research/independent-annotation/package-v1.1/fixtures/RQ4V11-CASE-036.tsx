'use client';

import { useCallback, useState } from 'react';

// Clean: the file carries a real "use client" directive before any React client hook is used --
// FIGM-NEXT-01 must NOT fire. The click handler is useCallback-wrapped rather than an inline
// arrow function literal in the JSX prop, to also stay compliant with FIGM-PERF-05.
export default function Counter() {
  const [count, setCount] = useState(0);
  const increment = useCallback(() => setCount((c) => c + 1), []);
  return <button onClick={increment}>Count: {count}</button>;
}
