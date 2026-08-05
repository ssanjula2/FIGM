"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useScans = useScans;
const react_1 = require("react");
function useScans(initialProjectId) {
    const [records, setRecords] = (0, react_1.useState)([]);
    const [total, setTotal] = (0, react_1.useState)(0);
    const [page, setPage] = (0, react_1.useState)(1);
    const [pageSize, setPageSize] = (0, react_1.useState)(10);
    const [totalPages, setTotalPages] = (0, react_1.useState)(1);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [search, setSearch] = (0, react_1.useState)('');
    const [framework, setFramework] = (0, react_1.useState)('ALL');
    const [onlyFavorites, setOnlyFavorites] = (0, react_1.useState)(false);
    const [sortBy, setSortBy] = (0, react_1.useState)('createdAt');
    const [sortOrder, setSortOrder] = (0, react_1.useState)('desc');
    const fetchScans = (0, react_1.useCallback)(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (initialProjectId)
                params.set('projectId', initialProjectId);
            if (search)
                params.set('search', search);
            if (framework !== 'ALL')
                params.set('framework', framework);
            if (onlyFavorites)
                params.set('onlyFavorites', 'true');
            params.set('sortBy', sortBy);
            params.set('sortOrder', sortOrder);
            params.set('page', String(page));
            params.set('pageSize', String(pageSize));
            const res = await fetch(`/api/scans?${params.toString()}`);
            if (!res.ok)
                throw new Error('Failed to fetch scan history');
            const data = await res.json();
            setRecords(data.records || []);
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
        }
        catch (err) {
            setError(err.message || 'Failed to load scans');
        }
        finally {
            setLoading(false);
        }
    }, [initialProjectId, search, framework, onlyFavorites, sortBy, sortOrder, page, pageSize]);
    (0, react_1.useEffect)(() => {
        fetchScans();
    }, [fetchScans]);
    const toggleFavorite = async (id) => {
        const res = await fetch(`/api/scans/${id}`, { method: 'PATCH' });
        if (res.ok) {
            await fetchScans();
        }
    };
    const deleteScan = async (id) => {
        const res = await fetch(`/api/scans/${id}`, { method: 'DELETE' });
        if (res.ok) {
            await fetchScans();
        }
    };
    const exportReport = async (scanId, format) => {
        const res = await fetch('/api/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scanId, format }),
        });
        if (!res.ok)
            throw new Error('Export failed');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const extMap = { PDF: 'html', JSON: 'json', CSV: 'csv', MD: 'md' };
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
//# sourceMappingURL=useScans.js.map