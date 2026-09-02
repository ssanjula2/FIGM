import { useState, useEffect, useCallback } from 'react';
import { DBSettings } from '../auth/user-db';

export function useSettings() {
  const [settings, setSettings] = useState<DBSettings>({
    userId: 'usr_anonymous',
    theme: 'dark',
    autoSave: true,
    autoScan: true,
    aiModel: 'claude-opus-5',
    exportFormat: 'PDF',
  });
  const [loading, setLoading] = useState<boolean>(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch {
      // Fallback defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<DBSettings>) => {
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
