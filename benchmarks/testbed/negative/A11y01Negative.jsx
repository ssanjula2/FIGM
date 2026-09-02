// Clean: a real native <button> element is used for an interactive control, which is keyboard-
// operable by default -- FIGM-A11Y-01 must NOT fire (it only targets non-interactive elements
// like div/span/section carrying a pointer-only handler).
export function TogglePanel({ onToggle }) {
  return (
    <button type="button" onClick={onToggle}>
      Toggle Panel
    </button>
  );
}
