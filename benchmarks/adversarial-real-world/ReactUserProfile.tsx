import React, { useState } from 'react';

export interface User {
  id: string;
  name: string;
  avatarUrl: string;
  profile: {
    active: boolean;
    role: string;
  };
}

export function ReactUserProfile({ user, items }: { user: User; items: Array<{ id: string; name: string }> }) {
  const [activeUser, setActiveUser] = useState(user);

  const handleUpdate = () => {
    // Anti-pattern 1: Direct State Mutation
    user.profile.active = true;
    setActiveUser(user);
  };

  return (
    <div>
      {/* Anti-pattern 2: Non-interactive element with click handler without keyboard listener */}
      <div className="user-header" onClick={handleUpdate}>
        {/* Anti-pattern 3: Native img tag missing explicit width and height */}
        <img src={user.avatarUrl} alt={user.name} />
        <h2>{user.name}</h2>
      </div>

      <ul className="item-list">
        {items.map((item) => {
          // Anti-pattern 4: Invariant object allocation inside loop scope
          const cardStyle = { padding: '12px', marginBottom: '8px', borderRadius: '4px' };
          return (
            <li key={item.id} style={cardStyle}>
              {item.name}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
