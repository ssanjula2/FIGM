function List({ items }) {
  return items.map(item => <Card onClick={() => handleClick(item.id)} />);
}
