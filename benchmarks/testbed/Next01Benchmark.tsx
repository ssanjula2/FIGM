// Defect: FIGM-NEXT-01
// The `next/link` import is a genuine Next.js content signal (see source-parser.ts's
// detectFramework nextContentHint) needed to classify this file as NEXT_JS -- required for
// FIGM-NEXT-01's real-AST detector to run at all -- without relying on a literal app/ router
// directory path, which the flat benchmarks/testbed/ layout does not support.
import Link from 'next/link';
import { useState } from 'react';

export default function Page() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <Link href="/">Home</Link>
      <span>{count}</span>
    </div>
  );
}
