import { useMemo } from 'react';

// Clean: derived value computed directly during render (a real, complete expression, not
// merely the trigger token removed) -- FIGM-REACT-05 must NOT fire here, since there is no
// useEffect whose sole body is a bare set-prefixed state-setter call deriving state from props.
export function Cart({ items }) {
  const total = useMemo(() => items.reduce((sum, item) => sum + item.price, 0), [items]);
  return <div className="cart-total">Total: ${total.toFixed(2)}</div>;
}
