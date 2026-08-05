import React, { useState } from 'react';

export function UserProfile({ user }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="profile-card">
      {/* Defect: FIGM-PERF-02 (Un-dimensioned img) */}
      <img src={user.avatarUrl} alt={user.name} />

      {/* Defect: FIGM-A11Y-01 (div onClick without keyboard handler or tabindex) */}
      <div onClick={() => setIsOpen(!isOpen)} className="toggle-btn">
        Toggle Profile Modal
      </div>

      {/* Defect: FIGM-A11Y-04 (Modal overlay without focus restoration) */}
      {isOpen && (
        <Modal isOpen={isOpen} role="dialog" aria-label="User Profile Details">
          <h2>User Details</h2>
          <p>{user.bio}</p>
        </Modal>
      )}
    </div>
  );
}
