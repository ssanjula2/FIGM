// Defect: FIGM-REACT-07
function Profile({ isActive }) {
  if (isActive) {
    const [count, setCount] = useState(0);
  }
  return <div>{isActive}</div>;
}
