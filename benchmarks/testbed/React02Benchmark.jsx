// Defect: FIGM-REACT-02
function List({ items }) {
  return <ul>{items.map((item, index) => <li key={index}>{item.name}</li>)}</ul>;
}
