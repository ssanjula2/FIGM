import { useState, useEffect, useCallback } from 'react';

export interface SearchResults {
  projects: any[];
  scans: any[];
  rules: any[];
  users: any[];
  repositories: string[];
}

export function useGlobalSearch() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<SearchResults>({
    projects: [],
    scans: [],
    rules: [],
    users: [],
    repositories: [],
  });
  const [loading, setLoading] = useState<boolean>(false);

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults({ projects: [], scans: [], rules: [], users: [], repositories: [] });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    results,
    loading,
  };
}
