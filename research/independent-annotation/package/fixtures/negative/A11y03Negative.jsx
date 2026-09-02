// Clean: the dynamic status container carries role="status" and aria-live="polite" --
// FIGM-A11Y-03 must NOT fire.
export function StatusBanner({ statusText }) {
  return (
    <div className="status-banner" role="status" aria-live="polite">
      {statusText}
    </div>
  );
}
