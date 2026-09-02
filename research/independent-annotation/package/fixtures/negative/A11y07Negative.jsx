// Clean: the button's aria-label contains its own visible text ("Send") as a substring --
// FIGM-A11Y-07 must NOT fire.
export function SendButton() {
  return <button aria-label="Send message">Send</button>;
}
