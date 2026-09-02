// Defect: FIGM-PERF-05
function List({ items }) {
  return items.map(item => <Card onClick={() => handleClick(item.id)} />);
}
