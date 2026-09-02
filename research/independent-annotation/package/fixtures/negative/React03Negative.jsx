import { useCallback, useState } from 'react';

// Clean: state is updated via the setter with a new object reference, never mutated in place --
// FIGM-REACT-03 must NOT fire. The click handler is useCallback-wrapped rather than an inline
// arrow function literal in the JSX prop, to also stay compliant with FIGM-PERF-05.
export function ProfileEditor() {
  const [user, setUser] = useState({ name: 'Jane' });

  const rename = useCallback((newName) => {
    setUser((prev) => ({ ...prev, name: newName }));
  }, []);

  const handleClick = useCallback(() => rename('New Name'), [rename]);

  return <button onClick={handleClick}>{user.name}</button>;
}
