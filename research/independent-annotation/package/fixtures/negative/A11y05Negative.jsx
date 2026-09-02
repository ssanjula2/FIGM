// Clean: the form input has an associated <label> via htmlFor/id -- FIGM-A11Y-05 must NOT fire.
export function NameField() {
  return (
    <div>
      <label htmlFor="name">Name</label>
      <input id="name" type="text" />
    </div>
  );
}
