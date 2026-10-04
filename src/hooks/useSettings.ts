import { useState, useEffect, useCallback } from 'react';
import { DBSettings } from '../auth/user-db';

export function useSettings() {
  const [settings, setSettings] = useState<DBSettings>({
    userId: 'usr_anonymous',
    theme: 'light',
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
          const savedTheme = typeof window === 'undefined' ? null : window.localStorage.getItem('figm_theme');
          setSettings({ ...data.settings, theme: savedTheme === 'dark' ? 'dark' : 'light' });
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
    const handleThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === 'dark' || detail === 'light') {
        setSettings((prev) => ({ ...prev, theme: detail }));
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('figm-theme-change', handleThemeChange);
      return () => window.removeEventListener('figm-theme-change', handleThemeChange);
    }
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<DBSettings>) => {
    const normalized: Partial<DBSettings> = updates.theme === undefined
      ? updates
      : { ...updates, theme: updates.theme === 'dark' ? 'dark' : 'light' };
    const newSettings = { ...settings, ...normalized };
    setSettings(newSettings);
    if (normalized.theme !== undefined && typeof window !== 'undefined') {
      const theme = normalized.theme === 'dark' ? 'dark' : 'light';
      try {
        window.localStorage.setItem('figm_theme', theme);
      } catch {
        // The active tab still receives the theme if browser storage is unavailable.
      }
      window.dispatchEvent(new CustomEvent('figm-theme-change', { detail: theme }));
    }
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalized),
    });
  };

  return {
    settings,
    loading,
    updateSettings,
    refresh: fetchSettings,
  };
}
