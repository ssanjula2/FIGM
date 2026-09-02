// Defect: FIGM-REACT-01
function List({ items }) {
  const sortedData = items.sort((a, b) => a.val - b.val);
  return <ul>{sortedData.map(i => <li key={i.id}>{i.val}</li>)}</ul>;
}
