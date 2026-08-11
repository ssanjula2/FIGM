import { useState } from 'react';

export default function NextPage() {
  // Anti-pattern 1: useState in Server Component without "use client" directive
  const [query, setQuery] = useState('');

  const handleSearch = () => {
    // Anti-pattern 2: Direct window access in RSC scope
    const token = window.localStorage.getItem('token');
    console.log('Searching', query, token);
  };

  return (
    <main>
      <h1>Next.js Dashboard</h1>
      {/* Anti-pattern 3: Native img tag in Next.js app router */}
      <img src="/banner.png" alt="Next Banner" />
      <button onClick={handleSearch}>Search</button>
    </main>
  );
}
