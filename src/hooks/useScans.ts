import { useState, useEffect, useCallback } from 'react';
import { DBScanRecord } from '../auth/user-db';

export function useScans(initialProjectId?: string) {
  const [records, setRecords] = useState<DBScanRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(100);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>('');
  const [framework, setFramework] = useState<string>('ALL');
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchScans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (initialProjectId) params.set('projectId', initialProjectId);
      if (search) params.set('search', search);
      if (framework !== 'ALL') params.set('framework', framework);
      if (onlyFavorites) params.set('onlyFavorites', 'true');
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      const res = await fetch(`/api/scans?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch scan history');
      const data = await res.json();
      setRecords(data.records || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load scans');
    } finally {
      setLoading(false);
    }
  }, [initialProjectId, search, framework, onlyFavorites, sortBy, sortOrder, page, pageSize]);

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  const toggleFavorite = async (id: string) => {
    const res = await fetch(`/api/scans/${id}`, { method: 'PATCH' });
    if (res.ok) {
      await fetchScans();
    }
  };

  const deleteScan = async (id: string) => {
    const res = await fetch(`/api/scans/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchScans();
    }
  };

  const exportReport = async (scanId: string, format: 'PDF' | 'JSON' | 'CSV' | 'MD') => {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scanId, format }),
    });

    if (!res.ok) throw new Error('Export failed');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const extMap: Record<string, string> = { PDF: 'html', JSON: 'json', CSV: 'csv', MD: 'md' };
    a.download = `figm-report-${scanId}.${extMap[format] || 'txt'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return {
    records,
    total,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    loading,
    error,
    search,
    setSearch,
    framework,
    setFramework,
    onlyFavorites,
    setOnlyFavorites,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    refresh: fetchScans,
    toggleFavorite,
    deleteScan,
    exportReport,
  };
}
