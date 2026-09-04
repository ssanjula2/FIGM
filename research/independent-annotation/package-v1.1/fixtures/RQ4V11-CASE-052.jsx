import { useEffect, useState } from 'react';

// Clean: the effect's dependency array correctly lists every destructured prop the effect body
// actually references -- FIGM-REACT-06 must NOT fire.
export function Profile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchUser(userId).then((data) => {
      if (!cancelled) setUser(data);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return <div className="profile">{user?.name}</div>;
}

async function fetchUser(id) {
  return { name: `User ${id}` };
}
