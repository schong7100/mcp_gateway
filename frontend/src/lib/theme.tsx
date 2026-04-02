'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

interface ThemeSettings {
  darkMode: boolean;
  primaryColor: string;
  logoUrl: string | null;
}

interface ThemeContextType extends ThemeSettings {
  toggleDarkMode: () => void;
  setPrimaryColor: (color: string) => void;
  setLogoUrl: (url: string | null) => void;
}

const defaultTheme: ThemeSettings = {
  darkMode: false,
  primaryColor: '#1e3a5f',
  logoUrl: null,
};

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = 'mcp-gateway-theme';

function loadTheme(): ThemeSettings {
  if (typeof window === 'undefined') return defaultTheme;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...defaultTheme, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return defaultTheme;
}

function saveTheme(settings: ThemeSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeSettings>(defaultTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(loadTheme());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    saveTheme(theme);
    document.documentElement.classList.toggle('dark', theme.darkMode);
    document.documentElement.style.setProperty('--color-primary', theme.primaryColor);
  }, [theme, mounted]);

  const toggleDarkMode = useCallback(() => {
    setTheme((prev) => ({ ...prev, darkMode: !prev.darkMode }));
  }, []);

  const setPrimaryColor = useCallback((color: string) => {
    setTheme((prev) => ({ ...prev, primaryColor: color }));
  }, []);

  const setLogoUrl = useCallback((url: string | null) => {
    setTheme((prev) => ({ ...prev, logoUrl: url }));
  }, []);

  return (
    <ThemeContext.Provider value={{ ...theme, toggleDarkMode, setPrimaryColor, setLogoUrl }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
