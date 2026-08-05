"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useGlobalSearch = useGlobalSearch;
const react_1 = require("react");
function useGlobalSearch() {
    const [isOpen, setIsOpen] = (0, react_1.useState)(false);
    const [query, setQuery] = (0, react_1.useState)('');
    const [results, setResults] = (0, react_1.useState)({
        projects: [],
        scans: [],
        rules: [],
        users: [],
        repositories: [],
    });
    const [loading, setLoading] = (0, react_1.useState)(false);
    const performSearch = (0, react_1.useCallback)(async (q) => {
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
        }
        catch {
            // Error handling
        }
        finally {
            setLoading(false);
        }
    }, []);
    (0, react_1.useEffect)(() => {
        const timer = setTimeout(() => {
            performSearch(query);
        }, 200);
        return () => clearTimeout(timer);
    }, [query, performSearch]);
    // Global Cmd+K / Ctrl+K listener
    (0, react_1.useEffect)(() => {
        const handleKeyDown = (e) => {
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
//# sourceMappingURL=useGlobalSearch.js.map