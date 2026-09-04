import { Suspense } from 'react';
import SearchResultsPanel from './search-results-panel';

// Clean: useSearchParams (inside SearchResultsPanel, not shown -- this file is the boundary)
// is wrapped in a real <Suspense> boundary at the point it is rendered -- FIGM-NEXT-08 must NOT
// fire on this file, which contains no unwrapped useSearchParams call of its own.
export default function SearchPage() {
  return (
    <Suspense fallback={<p>Loading results...</p>}>
      <SearchResultsPanel />
    </Suspense>
  );
}
