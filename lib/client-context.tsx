'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Locale } from './types';
import { UI, type UIKey } from './i18n';

type Theme = 'light' | 'dark';

interface AppCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  tr: (key: UIKey) => string;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh');
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const l = window.localStorage.getItem('aidemos.locale') as Locale | null;
    if (l === 'zh' || l === 'en') setLocaleState(l);
    const t = window.localStorage.getItem('aidemos.theme') as Theme | null;
    const initial = t ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setThemeState(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem('aidemos.locale', l);
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem('aidemos.theme', next);
    document.documentElement.dataset.theme = next;
  }, []);

  const tr = useCallback((key: UIKey) => UI[key][locale], [locale]);

  const value = useMemo(() => ({ locale, setLocale, theme, setTheme, tr }), [locale, setLocale, theme, setTheme, tr]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
