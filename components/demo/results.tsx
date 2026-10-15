'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DemoPayload, RunResult } from '@/lib/engine';
import { useApp } from '@/lib/client-context';

/* ------------------------------------------------------------------ shared */

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { tr } = useApp();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost !px-2 !text-[11px]"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {done ? tr('copied') : (label ?? tr('copy'))}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="surface-inset rounded-lg px-3 py-2">
      <div className="text-[10px]" style={{ color: 'var(--fg-faint)' }}>
        {label}
      </div>
      <div className="mono mt-0.5 text-[13px] font-medium">{value}</div>
    </div>
  );
}

function Bar({ value, max = 1 }: { value: number; max?: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--bg-muted)' }}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(1, (value / max) * 100)}%`, background: 'var(--fg)' }}
      />
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  return (
    <div className="relative">
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <CopyButton text={code} />
      </div>
      <pre
        className="scroll-thin max-h-[460px] overflow-auto rounded-lg border p-3 text-[12px] leading-[1.65]"
        style={{ background: 'var(--bg-inset)' }}
      >
        <code className="mono">{code}</code>
      </pre>
      {language && (
        <span className="tag absolute bottom-2 right-2">{language}</span>
      )}
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  const html = useMemo(() => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/("(?:\\.|[^"\\])*")(\s*:)?/g, (m, str, colon) =>
        colon
          ? `<span style="color:var(--fg)">${str}</span>${colon}`
          : `<span style="color:var(--fg-muted)">${str}</span>`
      )
      .replace(/\b(true|false|null)\b/g, '<span style="color:var(--fg-subtle)">$1</span>')
      .replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span style="color:var(--fg-muted)">$1</span>');
  }, [text]);
  return (
    <div className="relative">
      <div className="absolute right-2 top-2 z-10">
        <CopyButton text={text} />
      </div>
      <pre
        className="scroll-thin max-h-[460px] overflow-auto rounded-lg border p-3 text-[12px] leading-[1.65]"
        style={{ background: 'var(--bg-inset)' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function AudioPlayer({ src, autoPlay }: { src: string; autoPlay?: boolean }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  return (
    <div className="flex items-center gap-2">
      <audio ref={ref} src={src} controls autoPlay={autoPlay} className="h-9 max-w-full flex-1" />
      <a className="btn btn-ghost !px-2 !text-[11px]" href={src} download>
        ↓
      </a>
    </div>
  );
}

/* ------------------------------------------------------------- result view */

export function ResultView({ result, running, phase }: { result: RunResult | null; running: boolean; phase?: string }) {
  const { locale, tr } = useApp();
  if (running) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3">
        <span className="pulse text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
          {phase ?? tr('running')}
        </span>
      </div>
    );
  }
  if (!result) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 text-center">
        <span className="text-[13px]" style={{ color: 'var(--fg-muted)' }}>
          {tr('empty')}
        </span>
        <span className="max-w-xs text-[11px] leading-5" style={{ color: 'var(--fg-faint)' }}>
          {tr('emptyHint')}
        </span>
      </div>
    );
  }

  return (
    <div className="animate-in space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="tag">{result.meta.device}</span>
        <span className="tag">{result.meta.backend}</span>
        <span className="tag">
          {tr('latency')} {result.latencyMs} ms
        </span>
        {result.meta.tokens ? (
          <span className="tag">
            {result.meta.tokens} {tr('tokens')}
          </span>
        ) : null}
        {result.meta.real ? (
          <>
            <span
              className="tag"
              style={{ background: 'var(--fg)', color: 'var(--bg)', borderColor: 'var(--fg)' }}
              title={result.meta.note}
            >
              {tr('realWeights')}
              {result.meta.real.substitute ? ' *' : ''}
            </span>
            <span className="tag" title={result.meta.real.repo}>
              {result.meta.real.repo.replace(/^[^/]+\//, '')} · {result.meta.real.dtype}
            </span>
            <span className="tag" title={tr('weightsMovedHint')}>
              {result.meta.real.bytes > 0
                ? locale === 'zh'
                  ? `权重 ${(result.meta.real.bytes / 1048576).toFixed(1)} MB`
                  : `weights ${(result.meta.real.bytes / 1048576).toFixed(1)} MB`
                : tr('weightsCached')}
            </span>
          </>
        ) : (
          <span className="tag" title={result.meta.note}>
            {result.meta.simulated ? tr('demoMode') : locale === 'zh' ? '真实计算' : 'Computed'}
          </span>
        )}
      </div>
      {result.meta.real?.substitute ? (
        <p className="text-[11px] leading-5" style={{ color: 'var(--fg-faint)' }}>
          {locale === 'zh'
            ? '* 原模型没有浏览器可直接推理的权重，这里加载的是同类任务的实际检查点（ONNX / TFLite）。'
            : '* The original checkpoint has no browser build; a real ONNX or TFLite model for the same task is loaded instead.'}
        </p>
      ) : null}
      <Body payload={result.payload} />
    </div>
  );
}

function Body({ payload }: { payload: DemoPayload }) {
  const p = payload;
  switch (p.kind) {
    case 'labels':
      return <LabelsView p={p} />;
    case 'text':
      return <TextView p={p} />;
    case 'chat':
      return <ChatView p={p} />;
    case 'json':
      return <JsonView p={p} />;
    case 'code':
      return <CodeView p={p} />;
    case 'embedding':
      return <EmbeddingView p={p} />;
    case 'ranking':
      return <RankingView p={p} />;
    case 'search':
      return <SearchView p={p} />;
    case 'detection':
      return <DetectionView p={p} />;
    case 'segmentation':
      return <SegmentationView p={p} />;
    case 'depth':
      return (
        <div className="surface overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt="depth" className="block w-full" />
        </div>
      );
    case 'ocr':
      return <OcrView p={p} />;
    case 'restoration':
      return <RestorationView p={p} />;
    case 'generated-image':
      return <GeneratedView p={p} />;
    case 'inpainting':
      return <InpaintingView p={p} />;
    case 'transcript':
      return <TranscriptView p={p} />;
    case 'synth-audio':
      return <SynthView p={p} />;
    case 'audio-compare':
      return <AudioCompareView p={p} />;
    case 'stems':
      return <StemsView p={p} />;
    case 'music':
      return <MusicView p={p} />;
    case 'landmarks':
      return <LandmarksView p={p} />;
    case 'tracking':
      return <TrackingView p={p} />;
    case 'video-timeline':
      return <VideoTimelineView p={p} />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ labels */

function LabelsView({ p }: { p: Extract<DemoPayload, { kind: 'labels' }> }) {
  const { tr } = useApp();
  const max = Math.max(...p.labels.map((l) => l.score), 0.0001);
  return (
    <div className="space-y-3">
      {p.task && (
        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
          <span>{tr('task')}</span>
          <span className="tag mono">{p.task}</span>
        </div>
      )}
      <div className="space-y-2.5">
        {p.labels.map((l) => (
          <div key={l.label}>
            <div className="mb-1 flex items-center justify-between text-[12.5px]">
              <span>{l.label}</span>
              <span className="mono text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
                {(l.score * 100).toFixed(1)}%
              </span>
            </div>
            <Bar value={l.score} max={max} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- text */

function TextView({ p }: { p: Extract<DemoPayload, { kind: 'text' }> }) {
  const { locale, tr } = useApp();
  return (
    <div className="space-y-3">
      <div className="surface-inset relative rounded-lg p-3">
        <div className="absolute right-2 top-2">
          <CopyButton text={p.text} />
        </div>
        <p className="whitespace-pre-wrap pr-14 text-[13px] leading-6">{p.text}</p>
      </div>
      {p.extra?.points?.length ? (
        <div>
          <div className="mb-1.5 text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
            {tr('points')}
          </div>
          <ul className="space-y-1.5">
            {p.extra.points.map((pt, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-5">
                <span className="mono shrink-0 text-[10px]" style={{ color: 'var(--fg-faint)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ color: 'var(--fg-muted)' }}>{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {p.extra?.keywords?.length ? (
        <div>
          <div className="mb-1.5 text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
            {tr('keywords')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {p.extra.keywords.map((k) => (
              <span key={k.word} className="chip !cursor-default">
                {k.word}
                <span className="mono text-[10px]" style={{ color: 'var(--fg-faint)' }}>
                  {k.count}
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {p.extra?.glossary?.length ? (
        <div>
          <div className="mb-1.5 text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
            {locale === 'zh' ? '术语对齐' : 'Glossary alignment'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {p.extra.glossary.map((g) => (
              <span key={g.source} className="tag mono">
                {g.source} → {g.target}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px]" style={{ color: 'var(--fg-faint)' }}>
            {locale === 'zh'
              ? `词典覆盖率约 ${Math.round((p.extra.coverage ?? 0) * 100)}%，未命中的词保留原文。`
              : `Glossary coverage ≈ ${Math.round((p.extra.coverage ?? 0) * 100)}%; unmatched words are kept as-is.`}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------- chat */

function ChatView({ p }: { p: Extract<DemoPayload, { kind: 'chat' }> }) {
  const { locale, tr } = useApp();
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!p.text) return;
    setTyped('');
    const chunks = locale === 'zh' ? [...p.text] : (p.text.match(/\S+\s*/g) ?? [p.text]);
    let i = 0;
    let raf = 0;
    const tick = () => {
      const batch = Math.max(1, Math.round(chunks.length / 70));
      for (let k = 0; k < batch && i < chunks.length; k++, i++) setTyped((prev) => prev + chunks[i]);
      if (i < chunks.length) raf = window.setTimeout(tick, 10);
    };
    raf = window.setTimeout(tick, 40);
    return () => window.clearTimeout(raf);
  }, [p.text, locale]);

  return (
    <div className="surface-inset relative rounded-lg p-3">
      <div className="absolute right-2 top-2">
        <CopyButton text={p.text} />
      </div>
      <p className="whitespace-pre-wrap pr-14 text-[13px] leading-6">
        {typed}
        {typed.length < p.text.length && <span className="pulse">▍</span>}
      </p>
    </div>
  );
}

function JsonView({ p }: { p: Extract<DemoPayload, { kind: 'json' }> }) {
  return <JsonBlock value={p.value} />;
}

function CodeView({ p }: { p: Extract<DemoPayload, { kind: 'code' }> }) {
  return <CodeBlock code={p.code} language={p.language} />;
}

/* --------------------------------------------------------------- embedding */

function EmbeddingView({ p }: { p: Extract<DemoPayload, { kind: 'embedding' }> }) {
  const { locale } = useApp();
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {p.vectors.map((v, i) => (
          <div key={i} className="surface-inset rounded-lg px-3 py-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[12.5px]">{p.lines[i]?.text}</span>
              <span className="mono shrink-0 text-[10px]" style={{ color: 'var(--fg-faint)' }}>
                L2={p.norms[i]}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-[3px]">
              {v.map((x, k) => (
                <span
                  key={k}
                  className="mono flex h-5 min-w-[30px] items-center justify-center rounded-sm text-[9px]"
                  style={{
                    background: x >= 0 ? `rgba(24,24,27,${0.06 + Math.min(Math.abs(x), 0.5)})` : 'var(--bg)',
                    color: 'var(--fg-muted)',
                    border: '1px solid var(--border)',
                  }}
                  title={`dim ${k}: ${x}`}
                >
                  {x.toFixed(2)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-1.5 text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
          {locale === 'zh' ? '余弦相似度矩阵（归一化到 0–1）' : 'Cosine similarity matrix (mapped to 0–1)'}
        </div>
        <div className="scroll-thin overflow-x-auto">
          <table className="mono border-collapse text-[9px]">
            <tbody>
              <tr>
                <td />
                {p.lines.map((_, i) => (
                  <td key={i} className="p-0.5 text-center" style={{ color: 'var(--fg-faint)' }}>
                    {i + 1}
                  </td>
                ))}
              </tr>
              {p.matrix.map((row, i) => (
                <tr key={i}>
                  <td className="pr-1 text-right" style={{ color: 'var(--fg-faint)' }}>
                    {i + 1}
                  </td>
                  {row.map((v, k) => (
                    <td
                      key={k}
                      className="h-6 w-8 text-center"
                      style={{
                        background: `rgba(24,24,27,${Math.max(0, (v - 0.55) * 2.2)})`,
                        color: v > 0.82 ? '#fafafa' : 'var(--fg-muted)',
                        border: '1px solid var(--border)',
                      }}
                      title={`${i + 1}×${k + 1}: ${v.toFixed(3)}`}
                    >
                      {(v * 100).toFixed(0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- ranking */

function RankingView({ p }: { p: Extract<DemoPayload, { kind: 'ranking' }> }) {
  const { locale } = useApp();
  return (
    <div className="space-y-2.5">
      <div className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
        {locale === 'zh' ? '查询' : 'Query'}：<span style={{ color: 'var(--fg)' }}>{p.query}</span>
      </div>
      {p.items.map((it, i) => (
        <div key={i} className="surface-inset rounded-lg px-3 py-2.5">
          <div className="flex items-start gap-3">
            <span className="mono mt-0.5 shrink-0 text-[11px]" style={{ color: 'var(--fg-faint)' }}>
              #{i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] leading-5">{it.text}</p>
              {it.meta && (
                <span className="tag mt-1.5 inline-block">{it.meta}</span>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="mono text-[13px] font-medium">{(it.score * 100).toFixed(1)}</div>
              <div className="text-[10px]" style={{ color: 'var(--fg-faint)' }}>
                {locale === 'zh' ? '基线' : 'base'} {(it.base * 100).toFixed(0)}
              </div>
            </div>
          </div>
          <div className="mt-2">
            <Bar value={it.score} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchView({ p }: { p: Extract<DemoPayload, { kind: 'search' }> }) {
  const { locale } = useApp();
  return (
    <div className="space-y-2.5">
      <div className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
        {locale === 'zh' ? '查询' : 'Query'}：<span style={{ color: 'var(--fg)' }}>{p.query}</span>
      </div>
      {p.items.map((it, i) => (
        <div key={i} className="surface-inset rounded-lg px-3 py-2.5">
          <div className="flex items-start gap-3">
            <span className="mono mt-0.5 shrink-0 text-[11px]" style={{ color: 'var(--fg-faint)' }}>
              {(it.score * 100).toFixed(0)}
            </span>
            <p className="min-w-0 flex-1 text-[12.5px] leading-5">{it.text}</p>
            {it.meta && <span className="tag shrink-0">{it.meta}</span>}
          </div>
          <div className="mt-2">
            <Bar value={it.score} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- detection */

function DetectionView({ p }: { p: Extract<DemoPayload, { kind: 'detection' }> }) {
  const { locale, tr } = useApp();
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border" style={{ background: 'var(--bg-inset)' }}>
        <BoxOverlay imgSrc={p.imageUrl} boxes={p.boxes} hover={hover} onHover={setHover} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {p.boxes.map((b, i) => (
          <div
            key={i}
            className="surface-inset cursor-default rounded-lg px-2.5 py-2"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={hover === i ? { borderColor: 'var(--fg)' } : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[12px]">{locale === 'zh' ? b.label : b.labelEn}</span>
              <span className="mono text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
                {(b.score * 100).toFixed(1)}
              </span>
            </div>
            <div className="mt-1.5">
              <Bar value={b.score} />
            </div>
          </div>
        ))}
      </div>
      {!p.boxes.length && (
        <p className="text-center text-[12px]" style={{ color: 'var(--fg-faint)' }}>
          {tr('noDetection')}
        </p>
      )}
    </div>
  );
}

function BoxOverlay({
  imgSrc,
  boxes,
  hover,
  onHover,
  landmarks,
}: {
  imgSrc: string;
  boxes: { label: string; labelEn: string; score: number; x: number; y: number; w: number; h: number }[];
  hover: number | null;
  onHover: (i: number | null) => void;
  landmarks?: React.ReactNode;
}) {
  if (!imgSrc) return null;
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgSrc} alt="result" className="block w-full" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        {boxes.map((b, i) => (
          <g key={i}>
            <rect
              x={b.x * 100}
              y={b.y * 100}
              width={b.w * 100}
              height={b.h * 100}
              fill="none"
              stroke={hover === i ? '#000' : '#fff'}
              strokeWidth={hover === i ? 1.1 : 0.7}
              vectorEffect="non-scaling-stroke"
              style={{ filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,.85))' }}
            />
            <rect
              x={b.x * 100}
              y={Math.max(0, b.y * 100 - 4)}
              width={Math.max(8, (b.labelEn.length + 5) * 2.1)}
              height={3.6}
              fill="#000"
              opacity={hover === i ? 0.92 : 0.72}
            />
            <text
              x={b.x * 100 + 0.8}
              y={Math.max(2.8, b.y * 100 - 1.3)}
              fontSize={2.6}
              fill="#fff"
              style={{ fontFamily: 'monospace' }}
            >
              {b.labelEn} {b.score.toFixed(2)}
            </text>
          </g>
        ))}
        {landmarks}
      </svg>
    </div>
  );
}

export { BoxOverlay };

/* --------------------------------------------------------------------- ocr */

function OcrView({ p }: { p: Extract<DemoPayload, { kind: 'ocr' }> }) {
  const { locale, tr } = useApp();
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border" style={{ background: 'var(--bg-inset)' }}>
        <BoxOverlay
          imgSrc={p.imageUrl}
          hover={hover}
          onHover={setHover}
          boxes={p.lines.map((l, i) => ({
            label: l.text,
            labelEn: `L${i + 1}`,
            score: l.conf,
            x: l.x,
            y: l.y,
            w: l.w,
            h: l.h,
          }))}
        />
      </div>
      <div className="surface-inset relative rounded-lg p-3">
        <div className="absolute right-2 top-2">
          <CopyButton text={p.text} />
        </div>
        <pre className="whitespace-pre-wrap pr-14 text-[12.5px] leading-6">{p.text || '—'}</pre>
      </div>
      <div>
        <div className="mb-1.5 text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
          {locale === 'zh' ? `识别到 ${p.lines.length} 行文本` : `${p.lines.length} text lines`}
        </div>
        <div className="scroll-thin max-h-[260px] space-y-1 overflow-y-auto">
          {p.lines.map((l, i) => (
            <div
              key={i}
              className="surface-inset flex items-center gap-2 rounded-md px-2.5 py-1.5"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={hover === i ? { borderColor: 'var(--fg)' } : undefined}
            >
              <span className="mono text-[10px]" style={{ color: 'var(--fg-faint)' }}>
                {(l.y * 100).toFixed(0)}%
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px]">{l.text}</span>
              <span className="mono text-[10px]" style={{ color: 'var(--fg-subtle)' }}>
                {(l.conf * 100).toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      </div>
      {p.fields ? (
        <div>
          <div className="mb-1.5 text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
            {tr('result')}
          </div>
          <JsonBlock value={p.fields} />
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- restoration */

function SegmentationView({ p }: { p: Extract<DemoPayload, { kind: 'segmentation' }> }) {
  const { locale } = useApp();
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[10px]" style={{ color: 'var(--fg-faint)' }}>
            {locale === 'zh' ? '输入' : 'Input'}
          </div>
          <div className="overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.originalUrl} alt="input" className="block w-full" />
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[10px]" style={{ color: 'var(--fg-faint)' }}>
            {locale === 'zh' ? '分割结果' : 'Segmentation'}
          </div>
          <div className="checker overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="mask" className="block w-full" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label={locale === 'zh' ? '前景占比' : 'Foreground'} value={`${(p.coverage * 100).toFixed(1)}%`} />
        <Stat label={locale === 'zh' ? '输出模式' : 'Mode'} value={p.mode} />
      </div>
      <a className="btn w-full" href={p.url} download="cutout.png">
        ↓ {locale === 'zh' ? '下载结果图' : 'Download result'}
      </a>
    </div>
  );
}

function RestorationView({ p }: { p: Extract<DemoPayload, { kind: 'restoration' }> }) {
  const { locale } = useApp();
  const [pos, setPos] = useState(50);
  return (
    <div className="space-y-3">
      {p.referenceUrl ? (
        <div>
          <div className="relative overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.referenceUrl} alt="reference" className="block w-full" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="result" className="block h-full w-full object-cover" style={{ width: `${(100 / pos) * 100}%`, maxWidth: 'none' }} />
            </div>
            <div className="absolute inset-y-0 w-px" style={{ left: `${pos}%`, background: '#fff', boxShadow: '0 0 0 1px rgba(0,0,0,.35)' }} />
            <span className="tag absolute left-2 top-2">{locale === 'zh' ? '恢复结果' : 'Restored'}</span>
            <span className="tag absolute right-2 top-2">{locale === 'zh' ? '参考原图' : 'Reference'}</span>
          </div>
          <input
            className="mt-3"
            type="range"
            min={0}
            max={100}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt="restored" className="block w-full" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {p.metrics.map((m) => (
          <Stat key={m.label} label={m.label} value={m.value} />
        ))}
      </div>
      <a className="btn w-full" href={p.url} download="restored.png">
        ↓ {locale === 'zh' ? '下载结果图' : 'Download result'}
      </a>
    </div>
  );
}

/* ------------------------------------------------------------ generated */

function GeneratedView({ p }: { p: Extract<DemoPayload, { kind: 'generated-image' }> }) {
  const { locale } = useApp();
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.url} alt="generated" className="block w-full" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label={locale === 'zh' ? '种子' : 'Seed'} value={p.seed} />
        <Stat label={locale === 'zh' ? '步数' : 'Steps'} value={p.steps} />
        <Stat label="CFG" value={p.guidance} />
      </div>
      <a className="btn w-full" href={p.url} download={`generated-${p.seed}.png`}>
        ↓ {locale === 'zh' ? '下载图片' : 'Download image'}
      </a>
    </div>
  );
}

function InpaintingView({ p }: { p: Extract<DemoPayload, { kind: 'inpainting' }> }) {
  const { locale, tr } = useApp();
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[10px]" style={{ color: 'var(--fg-faint)' }}>
            {locale === 'zh' ? '原图 + 掩码' : 'Input + mask'}
          </div>
          <div className="overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.originalUrl} alt="original" className="block w-full" />
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[10px]" style={{ color: 'var(--fg-faint)' }}>
            {locale === 'zh' ? '修补结果' : 'Inpainted'}
          </div>
          <div className="overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="result" className="block w-full" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label={tr('filled')} value={p.filled ? `${p.filled.toLocaleString()} px` : '0'} />
        <Stat label={locale === 'zh' ? '算法' : 'Algorithm'} value={p.method ?? 'diffusion fill'} />
      </div>
      <a className="btn w-full" href={p.url} download="inpainted.png">
        ↓ {locale === 'zh' ? '下载结果图' : 'Download result'}
      </a>
    </div>
  );
}

/* --------------------------------------------------------------- transcript */

function TranscriptView({ p }: { p: Extract<DemoPayload, { kind: 'transcript' }> }) {
  const { locale, tr } = useApp();
  return (
    <div className="space-y-3">
      <div className="surface-inset relative rounded-lg p-3">
        <div className="absolute right-2 top-2">
          <CopyButton text={p.text} />
        </div>
        <p className="whitespace-pre-wrap pr-14 text-[13px] leading-6">{p.text || '—'}</p>
      </div>
      <div className="space-y-1.5">
        {p.segments.map((s, i) => (
          <div key={i} className="surface-inset flex items-center gap-3 rounded-md px-2.5 py-1.5">
            <span className="mono shrink-0 text-[10px]" style={{ color: 'var(--fg-faint)' }}>
              {s.start.toFixed(2)} – {s.end.toFixed(2)}
            </span>
            <span className="min-w-0 flex-1 text-[12.5px]">{s.text}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label={locale === 'zh' ? '语言' : 'Language'} value={p.language} />
        <Stat
          label={locale === 'zh' ? '置信度' : 'Confidence'}
          value={p.confidence ? `${(p.confidence * 100).toFixed(0)}%` : '—'}
        />
        <Stat label={tr('segments')} value={p.segments.length} />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- audio */

function SynthView({ p }: { p: Extract<DemoPayload, { kind: 'synth-audio' }> }) {
  const { locale } = useApp();
  const [speaking, setSpeaking] = useState(false);
  const speak = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(p.text);
    u.lang = /[\u4e00-\u9fff]/.test(p.text) ? 'zh-CN' : 'en-US';
    u.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };
  const stop = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  };
  const max = Math.max(...p.waveform, 0.001);
  return (
    <div className="space-y-3">
      <div className="surface-inset rounded-lg px-3 py-3">
        <div className="flex h-16 items-center gap-[2px]">
          {p.waveform.map((v, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: `${Math.max(2, (v / max) * 64)}px`,
                background: 'var(--fg-subtle)',
                opacity: 0.3 + (v / max) * 0.7,
              }}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={speak} disabled={speaking}>
          {speaking ? (locale === 'zh' ? '正在播放…' : 'Speaking…') : locale === 'zh' ? '▶ 播放语音' : '▶ Play speech'}
        </button>
        <button type="button" className="btn" onClick={stop} disabled={!speaking}>
          {locale === 'zh' ? '停止' : 'Stop'}
        </button>
        {p.voice && <span className="tag truncate">{p.voice}</span>}
      </div>
      <p className="text-[10px] leading-4" style={{ color: 'var(--fg-faint)' }}>
        {locale === 'zh'
          ? '音频由浏览器原生语音合成接口实时生成，波形为文本驱动的包络估计。'
          : 'Audio is synthesised live by the browser speech API; the waveform is a text-driven envelope estimate.'}
      </p>
    </div>
  );
}

function WaveCompare({ peaks }: { peaks: number[] }) {
  const max = Math.max(...peaks, 0.001);
  return (
    <div className="flex h-14 items-center gap-[2px]">
      {peaks.map((p, i) => (
        <span
          key={i}
          className="flex-1 rounded-sm"
          style={{ height: `${Math.max(2, (p / max) * 54)}px`, background: 'var(--fg-subtle)', opacity: 0.35 + (p / max) * 0.65 }}
        />
      ))}
    </div>
  );
}

function AudioCompareView({ p }: { p: Extract<DemoPayload, { kind: 'audio-compare' }> }) {
  const { locale } = useApp();
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
          {locale === 'zh' ? '降噪后' : 'Denoised'}
        </div>
        <div className="surface-inset rounded-lg px-3 py-2">
          <WaveCompare peaks={p.after} />
        </div>
        <div className="mt-2">
          <AudioPlayer src={p.url} />
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
          {locale === 'zh' ? '输入（含噪）' : 'Input (noisy)'}
        </div>
        <div className="rounded-lg border px-3 py-2" style={{ background: 'var(--bg-inset)', opacity: 0.75 }}>
          <WaveCompare peaks={p.before} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label={locale === 'zh' ? '信噪比提升' : 'SNR gain'} value={`${p.snrGainDb.toFixed(1)} dB`} />
        <Stat label={locale === 'zh' ? '处理方式' : 'Method'} value={p.method ?? 'STFT spectral gate'} />
      </div>
    </div>
  );
}

function StemsView({ p }: { p: Extract<DemoPayload, { kind: 'stems' }> }) {
  const { locale } = useApp();
  return (
    <div className="space-y-3">
      {p.stems.map((s) => (
        <div key={s.name} className="surface-inset rounded-lg p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12.5px] font-medium">{locale === 'zh' ? s.name : s.nameEn}</span>
            <span className="mono text-[10px]" style={{ color: 'var(--fg-faint)' }}>
              {s.energyDb} dBFS
            </span>
          </div>
          <WaveCompare peaks={s.peaks} />
          <div className="mt-2">
            <AudioPlayer src={s.url} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MusicView({ p }: { p: Extract<DemoPayload, { kind: 'music' }> }) {
  const { locale } = useApp();
  return (
    <div className="space-y-3">
      <div className="surface-inset rounded-lg px-3 py-3">
        <WaveCompare peaks={p.peaks} />
      </div>
      <AudioPlayer src={p.url} />
      <div className="grid grid-cols-3 gap-2">
        <Stat label={locale === 'zh' ? '风格判定' : 'Style'} value={p.plan.kind} />
        <Stat label="BPM" value={p.plan.tempo} />
        <Stat label={locale === 'zh' ? '时长' : 'Duration'} value={`${p.plan.duration}s`} />
      </div>
      <div>
        <div className="mb-1.5 text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
          {locale === 'zh' ? '和弦进行（半音偏移）' : 'Chord progression (semitones)'}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {p.plan.chords.map((c, i) => (
            <span key={i} className="tag mono">
              {c.join('·')}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- landmarks */

function LandmarksView({ p }: { p: Extract<DemoPayload, { kind: 'landmarks' }> }) {
  const { locale, tr } = useApp();
  const { set, variant } = p;
  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border" style={{ background: 'var(--bg-inset)' }}>
        <BoxOverlay
          imgSrc={p.imageUrl}
          boxes={set.points.length ? [{ label: 'target', labelEn: variant, score: 0.94, x: set.box.x, y: set.box.y, w: set.box.w, h: set.box.h }] : []}
          hover={null}
          onHover={() => undefined}
          landmarks={
            <>
              {set.mesh?.map((row, ri) => (
                <polyline
                  key={`m${ri}`}
                  points={row.map((pt) => `${(pt.x / p.width) * 100},${(pt.y / p.height) * 100}`).join(' ')}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={0.4}
                  vectorEffect="non-scaling-stroke"
                  opacity={0.75}
                />
              ))}
              {set.edges.map(([a, b], i) => (
                <line
                  key={`e${i}`}
                  x1={(set.points[a].x / p.width) * 100}
                  y1={(set.points[a].y / p.height) * 100}
                  x2={(set.points[b].x / p.width) * 100}
                  y2={(set.points[b].y / p.height) * 100}
                  stroke="#fff"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  opacity={0.9}
                />
              ))}
              {set.points.map((pt, i) => (
                <circle
                  key={`p${i}`}
                  cx={(pt.x / p.width) * 100}
                  cy={(pt.y / p.height) * 100}
                  r={0.6}
                  fill="#fff"
                  stroke="#000"
                  strokeWidth={0.2}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </>
          }
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label={locale === 'zh' ? '关键点' : 'Landmarks'} value={set.points.length} />
        <Stat label={locale === 'zh' ? '网格线' : 'Mesh rows'} value={set.mesh?.length ?? 0} />
        <Stat label={tr('gesture')} value={p.gesture ?? '—'} />
      </div>
      <p className="text-[10px] leading-4" style={{ color: 'var(--fg-faint)' }}>
        {locale === 'zh'
          ? '真实权重：关键点由 MediaPipe 模型对该图像直接推理得出；标记为演示模式时则由目标框推导。'
          : 'Real-weights runs: landmarks come straight from the MediaPipe model. In demo mode they are derived from a target box.'}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- tracking */

function TrackingView({ p }: { p: Extract<DemoPayload, { kind: 'tracking' }> }) {
  const { locale, tr } = useApp();
  const [idx, setIdx] = useState(0);
  const frame = p.frames[idx];
  const colors = ['#fff', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b', '#3f3f46'];
  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border" style={{ background: '#000' }}>
        <video src={p.videoUrl} muted playsInline className="block w-full" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          {frame?.boxes.map((b) => (
            <g key={b.id}>
              <rect
                x={b.x * 100}
                y={b.y * 100}
                width={b.w * 100}
                height={b.h * 100}
                fill="none"
                stroke={colors[b.id % colors.length]}
                strokeWidth={0.9}
                vectorEffect="non-scaling-stroke"
              />
              <rect x={b.x * 100} y={Math.max(0, b.y * 100 - 4)} width={12} height={3.6} fill="#000" opacity={0.7} />
              <text x={b.x * 100 + 0.8} y={Math.max(2.8, b.y * 100 - 1.3)} fontSize={2.6} fill="#fff" style={{ fontFamily: 'monospace' }}>
                ID{b.id} {b.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <input type="range" min={0} max={Math.max(0, p.frames.length - 1)} value={idx} onChange={(e) => setIdx(Number(e.target.value))} />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="t" value={`${frame?.t ?? 0}s`} />
        <Stat label={tr('tracks')} value={p.trackCount} />
        <Stat label={locale === 'zh' ? '采样帧' : 'Frames'} value={p.frames.length} />
      </div>
      <div>
        <div className="mb-1.5 text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
          {locale === 'zh' ? '目标轨迹（归一化坐标）' : 'Trajectories (normalised)'}
        </div>
        <div className="surface-inset relative h-24 overflow-hidden rounded-lg">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
            {Array.from(new Set(p.frames.flatMap((f) => f.boxes.map((b) => b.id)))).map((id) => {
              const pts = p.frames
                .filter((f) => f.boxes.some((b) => b.id === id))
                .map((f) => {
                  const b = f.boxes.find((x) => x.id === id)!;
                  return `${(b.x + b.w / 2) * 100},${(b.y + b.h / 2) * 100}`;
                });
              return <polyline key={id} points={pts.join(' ')} fill="none" stroke={colors[id % colors.length]} strokeWidth={1} vectorEffect="non-scaling-stroke" />;
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- video timeline */

function VideoTimelineView({ p }: { p: Extract<DemoPayload, { kind: 'video-timeline' }> }) {
  const { locale, tr } = useApp();
  const [t, setT] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border" style={{ background: '#000' }}>
        <video
          ref={videoRef}
          src={p.videoUrl}
          controls
          muted
          playsInline
          className="block w-full"
          onTimeUpdate={(e) => setT((e.target as HTMLVideoElement).currentTime)}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
          <span>{locale === 'zh' ? '时间轴' : 'Timeline'}</span>
          <span className="mono">
            {t.toFixed(1)}s / {p.duration.toFixed(1)}s
          </span>
        </div>
        <div className="relative h-9 overflow-hidden rounded-lg border" style={{ background: 'var(--bg-inset)' }}>
          {p.segments.map((s, i) => (
            <div
              key={i}
              className="absolute top-0 flex h-full items-center overflow-hidden px-2 text-[10px]"
              style={{
                left: `${(s.start / p.duration) * 100}%`,
                width: `${((s.end - s.start) / p.duration) * 100}%`,
                background: i % 2 === 0 ? 'var(--bg-muted)' : 'var(--bg)',
                borderRight: '1px solid var(--border)',
                color: t >= s.start && t < s.end ? 'var(--fg)' : 'var(--fg-subtle)',
                fontWeight: t >= s.start && t < s.end ? 600 : 400,
              }}
              title={s.label}
            >
              <span className="truncate">{s.label}</span>
            </div>
          ))}
          <div className="absolute inset-y-0 w-px" style={{ left: `${(t / p.duration) * 100}%`, background: 'var(--fg)' }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {p.segments.map((s, i) => (
          <button
            key={i}
            type="button"
            className="surface-inset rounded-lg px-3 py-2 text-left transition-colors"
            onClick={() => {
              if (videoRef.current) videoRef.current.currentTime = s.start;
            }}
          >
            <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--fg-faint)' }}>
              <span className="mono">
                {s.start.toFixed(1)}–{s.end.toFixed(1)}s
              </span>
              <span className="mono">{(s.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="mt-1 text-[12px]">{s.label}</div>
          </button>
        ))}
      </div>

      {p.thumbs.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scroll-thin">
          {p.thumbs.map((th, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={th} alt={`frame ${i}`} className="h-14 shrink-0 rounded border" />
          ))}
        </div>
      )}

      <div className="surface-inset rounded-lg p-3">
        <div className="mb-1 text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
          {locale === 'zh' ? '内容摘要' : 'Summary'}
        </div>
        <p className="text-[12.5px] leading-5">{p.summary}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label={tr('duration')} value={`${p.duration.toFixed(1)}s`} />
        <Stat label={tr('segments')} value={p.segments.length} />
      </div>
    </div>
  );
}
