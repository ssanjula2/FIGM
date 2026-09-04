import { useCallback } from 'react';

// Clean: the custom control declares an explicit role and an accessible name via aria-label that
// contains its own visible text (also keeping it compliant with FIGM-A11Y-07), AND (to also stay
// compliant with FIGM-A11Y-01, since this element also carries a pointer handler) a paired
// keyboard handler alongside its tabIndex, wrapped in useCallback rather than passed as an
// inline arrow function literal (to also stay compliant with FIGM-PERF-05) -- FIGM-A11Y-02 must
// NOT fire.
export function CustomSelect({ onSelect }) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') onSelect(e);
    },
    [onSelect]
  );

  return (
    <div
      role="combobox"
      aria-label="Choose an option: Custom Select"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      Custom Select
    </div>
  );
}
