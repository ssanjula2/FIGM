import React, { useState } from 'react';

export function CleanComponent({ title }: { title: string }) {
  const [active, setActive] = useState(false);

  const toggle = () => {
    setActive((prev) => !prev);
  };

  return (
    <button type="button" onClick={toggle} aria-pressed={active}>
      <img src="/logo.png" alt="Logo" width={100} height={100} />
      <span>{title}</span>
    </button>
  );
}
