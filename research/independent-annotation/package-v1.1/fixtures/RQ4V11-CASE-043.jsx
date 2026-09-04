function Cart({ items }) {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    setTotal(items.length * 2);
  }, [items]);
  return <div>{total}</div>;
}
