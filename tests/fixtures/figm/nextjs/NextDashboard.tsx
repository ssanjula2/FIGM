import { useState } from 'react';

export default function NextDashboard() {
  // FIGM-NEXT-01: useState in RSC without "use client"
  const [search, setSearch] = useState('');

  const handleFetch = () => {
    // FIGM-NEXT-04: window access in RSC
    const token = window.localStorage.getItem('token');
    console.log(search, token);
  };

  return (
    <main>
      <h1>Dashboard</h1>
      {/* FIGM-NEXT-02: Native img in App Router */}
      <img src="/logo.png" alt="Logo" />
      <button onClick={handleFetch}>Fetch Data</button>
    </main>
  );
}
