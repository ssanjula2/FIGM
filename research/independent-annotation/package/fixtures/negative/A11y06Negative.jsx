// Clean: tabIndex is 0 (added to the natural tab sequence), never a positive value that would
// override the natural focus order -- FIGM-A11Y-06 must NOT fire.
export function SubmitButton() {
  return <button tabIndex={0}>Submit</button>;
}
