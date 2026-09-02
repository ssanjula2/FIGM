// Defect: FIGM-REACT-08
function TodoItem({ todo }) {
  todo.done = true;
  return <li>{todo.text}</li>;
}
