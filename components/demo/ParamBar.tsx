'use client';

import type { DemoSpec, ParamSpec } from '@/lib/types';
import { useApp } from '@/lib/client-context';

export function ParamBar({
  spec,
  values,
  onChange,
}: {
  spec: DemoSpec;
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
}) {
  const { locale, tr } = useApp();
  const params = (spec.params ?? []).filter((p) => p.key !== 'brushSize');
  if (!params.length) return null;

  return (
    <div>
      <div className="mb-2 text-[11px] font-medium" style={{ color: 'var(--fg-subtle)' }}>
        {tr('params')}
      </div>
      <div className="space-y-3">
        {params.map((p) => (
          <ParamRow
            key={p.key}
            spec={p}
            value={values[p.key] ?? p.default}
            onChange={(v) => onChange(p.key, v)}
            locale={locale}
          />
        ))}
      </div>
    </div>
  );
}

function ParamRow({
  spec,
  value,
  onChange,
  locale,
}: {
  spec: ParamSpec;
  value: string | number | boolean;
  onChange: (v: string | number | boolean) => void;
  locale: 'zh' | 'en';
}) {
  if (spec.type === 'toggle') {
    return (
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span className="text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>
          {spec.label[locale]}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(value)}
          onClick={() => onChange(!value)}
          className="relative h-5 w-9 shrink-0 rounded-full border transition-colors"
          style={{ background: value ? 'var(--accent)' : 'var(--bg-muted)' }}
        >
          <span
            className="absolute top-[2px] h-3.5 w-3.5 rounded-full transition-all"
            style={{
              left: value ? '19px' : '3px',
              background: value ? 'var(--accent-fg)' : 'var(--fg-faint)',
            }}
          />
        </button>
      </label>
    );
  }

  if (spec.type === 'select') {
    return (
      <label className="block">
        <span className="mb-1 block text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>
          {spec.label[locale]}
        </span>
        <select className="field !text-[12.5px]" value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {spec.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label[locale]}
            </option>
          ))}
        </select>
        {spec.hint && (
          <span className="mt-1 block text-[10px]" style={{ color: 'var(--fg-faint)' }}>
            {spec.hint[locale]}
          </span>
        )}
      </label>
    );
  }

  if (spec.type === 'range') {
    return (
      <label className="block">
        <span className="mb-1 flex items-center justify-between text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>
          <span>{spec.label[locale]}</span>
          <span className="mono text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
            {Number(value).toFixed(spec.step && spec.step < 1 ? 2 : 0)}
          </span>
        </span>
        <input
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={Number(value)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
    );
  }

  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px]" style={{ color: 'var(--fg-muted)' }}>
        {spec.label[locale]}
      </span>
      <input className="field !text-[12.5px]" value={String(value)} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
