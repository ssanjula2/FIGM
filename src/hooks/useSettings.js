"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSettings = useSettings;
const react_1 = require("react");
function useSettings() {
    const [settings, setSettings] = (0, react_1.useState)({
        userId: 'usr_anonymous',
        theme: 'dark',
        autoSave: true,
        autoScan: true,
        aiModel: 'gemini-2.5-flash',
        exportFormat: 'PDF',
    });
    const [loading, setLoading] = (0, react_1.useState)(true);
    const fetchSettings = (0, react_1.useCallback)(async () => {
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const data = await res.json();
                if (data.settings) {
                    setSettings(data.settings);
                }
            }
        }
        catch {
            // Fallback defaults
        }
        finally {
            setLoading(false);
        }
    }, []);
    (0, react_1.useEffect)(() => {
        fetchSettings();
    }, [fetchSettings]);
    const updateSettings = async (updates) => {
        const newSettings = { ...settings, ...updates };
        setSettings(newSettings);
        await fetch('/api/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
    };
    return {
        settings,
        loading,
        updateSettings,
        refresh: fetchSettings,
    };
}
//# sourceMappingURL=useSettings.js.map