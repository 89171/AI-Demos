'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppProvider, useApp } from '@/lib/client-context';
import { TAXONOMY } from '@/lib/data/taxonomy';
import { MODELS } from '@/lib/data/models';

function ThemeToggle() {
  const { theme, setTheme, tr } = useApp();
  return (
    <button
      type="button"
      className="btn btn-ghost w-full justify-start"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    >
      <span className="inline-block h-3 w-3 rounded-full border border-current" aria-hidden />
      {theme === 'light' ? tr('themeDark') : tr('themeLight')}
    </button>
  );
}

function LocaleToggle() {
  const { locale, setLocale } = useApp();
  return (
    <div className="flex items-center gap-1 rounded-lg border p-0.5" role="group" aria-label="language">
      {(['zh', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          className={`flex-1 rounded-md px-2 py-1 text-xs transition-colors ${
            locale === l ? '' : 'opacity-55 hover:opacity-100'
          }`}
          style={locale === l ? { background: 'var(--accent)', color: 'var(--accent-fg)' } : undefined}
        >
          {l === 'zh' ? '中文' : 'English'}
        </button>
      ))}
    </div>
  );
}

function Sidebar() {
  const { locale, tr } = useApp();
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const seg = pathname.split('/').filter(Boolean);
    if (seg[0] === 'demos' && seg[1]) setOpen(seg[1]);
  }, [pathname]);

  const totalModels = Object.values(MODELS).reduce(
    (a, s) => a + Object.values(s).reduce((b, m) => b + m.length, 0),
    0
  );

  return (
    <aside
      className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col border-r lg:flex"
      style={{ background: 'var(--bg-subtle)' }}
    >
      <div className="border-b px-4 py-4">
        <Link href="/" className="block">
          <div className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              AI
            </span>
            <span className="text-sm font-semibold tracking-tight">{tr('appName')}</span>
          </div>
        </Link>
        <p className="mt-2 text-[11px] leading-4" style={{ color: 'var(--fg-subtle)' }}>
          {tr('appTagline')}
        </p>
      </div>

      <nav className="scroll-thin flex-1 overflow-y-auto px-2 py-3">
        <div className="px-2 pb-2 text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--fg-faint)' }}>
          {tr('sideNav')}
        </div>
        {TAXONOMY.map((cat) => {
          const isOpen = open === cat.slug;
          const active = pathname.startsWith(`/demos/${cat.slug}/`);
          const count = cat.subcategories.reduce(
            (a, s) => a + (MODELS[cat.slug]?.[s.slug]?.length ?? 0),
            0
          );
          return (
            <div key={cat.slug} className="mb-0.5">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : cat.slug)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                  active ? 'font-medium' : ''
                }`}
                style={{ background: isOpen ? 'var(--bg-muted)' : 'transparent', color: active ? 'var(--fg)' : 'var(--fg-muted)' }}
              >
                <span
                  className="inline-block transition-transform"
                  style={{ transform: isOpen ? 'rotate(90deg)' : 'none', color: 'var(--fg-faint)', fontSize: 10 }}
                >
                  ▶
                </span>
                <span className="flex-1 truncate">{cat.name[locale]}</span>
                <span className="tag">{count}</span>
              </button>
              {isOpen && (
                <div className="ml-[13px] border-l pl-2">
                  {cat.subcategories.map((sub) => {
                    const href = `/demos/${cat.slug}/${sub.slug}`;
                    const on = pathname === href;
                    return (
                      <Link
                        key={sub.slug}
                        href={href}
                        className="block truncate rounded-md px-2 py-1.5 text-[12.5px] transition-colors"
                        style={{
                          background: on ? 'var(--accent)' : 'transparent',
                          color: on ? 'var(--accent-fg)' : 'var(--fg-muted)',
                        }}
                      >
                        {sub.name[locale]}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="space-y-2 border-t px-3 py-3">
        <div className="flex items-center justify-between px-1 text-[11px]" style={{ color: 'var(--fg-faint)' }}>
          <span>{tr('models')}</span>
          <span className="mono">{totalModels}</span>
        </div>
        <LocaleToggle />
        <ThemeToggle />
      </div>
    </aside>
  );
}

function MobileBar() {
  const { locale, tr, theme, setTheme } = useApp();
  return (
    <div className="flex items-center gap-3 border-b px-4 py-3 lg:hidden" style={{ background: 'var(--bg-subtle)' }}>
      <Link href="/" className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          AI
        </span>
        <span className="text-sm font-semibold">{tr('appName')}</span>
      </Link>
      <span className="ml-auto text-[11px]" style={{ color: 'var(--fg-faint)' }}>
        {locale === 'zh' ? '中文' : 'EN'}
      </span>
      <button type="button" className="btn btn-ghost !px-2" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
        ◐
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileBar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </AppProvider>
  );
}
