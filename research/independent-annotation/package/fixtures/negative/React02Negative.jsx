// Clean: each list item's key is a stable identifier from the data itself, not the array
// index -- FIGM-REACT-02 must NOT fire.
export function TodoList({ todos }) {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}
