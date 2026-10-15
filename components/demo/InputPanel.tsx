'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DemoSpec, Locale, MediaSample, MediaState, TextSample } from '@/lib/types';
import type { InputState } from '@/lib/types';
import { isTextSample } from '@/lib/types';
import { useApp } from '@/lib/client-context';

export type { InputState, MediaState };

/* ------------------------------------------------------------------ sample */

export function SampleBar({
  spec,
  sampleId,
  onPick,
}: {
  spec: DemoSpec;
  sampleId: string;
  onPick: (id: string) => void;
}) {
  const { locale, tr } = useApp();
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium" style={{ color: 'var(--fg-subtle)' }}>
          {tr('samples')}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--fg-faint)' }}>
          {tr('editingSample')}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {spec.samples.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            className={`chip ${sampleId === s.id ? 'chip-active' : ''}`}
            title={isTextSample(s) ? s.text[locale] : s.caption?.[locale]}
          >
            {s.label[locale]}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- text */

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  rows = 7,
  hint,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 flex items-center justify-between text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
          <span>{label}</span>
          {hint && <span className="mono text-[10px]" style={{ color: 'var(--fg-faint)' }}>{hint}</span>}
        </span>
      )}
      {multiline ? (
        <textarea
          className="field scroll-thin"
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="field"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

/* ------------------------------------------------------------------- lines */

export function LinesEditor({
  lines,
  onChange,
  meta,
}: {
  lines: string[];
  onChange: (lines: string[]) => void;
  meta?: string[];
}) {
  const { locale } = useApp();
  return (
    <div className="space-y-1.5">
      {lines.map((l, i) => (
        <div key={i} className="flex items-start gap-2">
          <span
            className="mono mt-2 w-6 shrink-0 text-right text-[10px]"
            style={{ color: 'var(--fg-faint)' }}
          >
            {meta?.[i] ?? `#${i + 1}`}
          </span>
          <textarea
            className="field scroll-thin !text-[12.5px]"
            rows={Math.max(1, Math.min(3, Math.ceil(l.length / 46)))}
            value={l}
            onChange={(e) => {
              const next = [...lines];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            className="btn btn-ghost mt-0.5 !px-2"
            title={locale === 'zh' ? '删除该行' : 'Remove line'}
            onClick={() => onChange(lines.filter((_, k) => k !== i))}
            disabled={lines.length <= 1}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn w-full !text-[12px]"
        onClick={() => onChange([...lines, ''])}
      >
        + {locale === 'zh' ? '添加一行' : 'Add line'}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------- image */

/** Painter that produces a normalised float mask for inpainting. */
function MaskCanvas({
  src,
  brush,
  onMask,
  maskKey,
}: {
  src: string;
  brush: number;
  onMask: (m: Float32Array, w: number, h: number) => void;
  maskKey: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const drawing = useRef(false);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(1, 720 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      setSize({ w, h });
      const c = canvasRef.current;
      if (!c) return;
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      onMask(new Float32Array(w * h), w, h);
    };
    img.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, maskKey]);

  const paint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * c.width;
    const y = ((e.clientY - rect.top) / rect.height) * c.height;
    const ctx = c.getContext('2d')!;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(x, y, brush, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };

  const pushMask = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const m = new Float32Array(c.width * c.height);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 8 ? 1 : 0;
    onMask(m, c.width, c.height);
  };

  return (
    <div className="overflow-hidden rounded-lg border" style={{ background: 'var(--bg-inset)' }}>
      <canvas
        ref={canvasRef}
        className="block w-full cursor-crosshair touch-none"
        style={{ aspectRatio: size.w && size.h ? `${size.w} / ${size.h}` : '16 / 10' }}
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          paint(e);
        }}
        onPointerMove={(e) => {
          if (drawing.current) paint(e);
        }}
        onPointerUp={() => {
          drawing.current = false;
          pushMask();
        }}
        onPointerLeave={() => {
          if (drawing.current) {
            drawing.current = false;
            pushMask();
          }
        }}
      />
    </div>
  );
}

export function ImagePanel({
  spec,
  media,
  onMedia,
  brushMask,
  onBrushMask,
  maskKey,
}: {
  spec: DemoSpec;
  media?: MediaState;
  onMedia: (m: MediaState | undefined) => void;
  brushMask?: { w: number; h: number };
  onBrushMask?: (m: Float32Array, w: number, h: number) => void;
  maskKey: number;
}) {
  const { locale, tr } = useApp();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState(false);
  const brushParam = spec.params?.find((pp) => pp.key === 'brushSize')?.default;
  const [brushSize, setBrushSize] = useState(typeof brushParam === 'number' ? brushParam : 36);

  const accept = 'image/png,image/jpeg,image/webp';

  const take = (file: File) => {
    const url = URL.createObjectURL(file);
    onMedia({ src: url, builtin: false, name: file.name });
  };

  return (
    <div className="space-y-2">
      <div
        className="relative overflow-hidden rounded-lg border"
        style={{ background: 'var(--bg-inset)', borderStyle: drag ? 'dashed' : 'solid' }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) take(f);
        }}
      >
        {!media ? (
          <div
            className="flex h-48 flex-col items-center justify-center gap-1 text-center text-[12px]"
            style={{ color: 'var(--fg-faint)' }}
          >
            <span>{locale === 'zh' ? '选择上方示例或上传图片' : 'Pick a sample above or upload an image'}</span>
            <span className="text-[10px]">{locale === 'zh' ? '也可以把文件拖到这里' : 'or drop a file here'}</span>
          </div>
        ) : spec.brush ? (
          <MaskCanvas src={media.src} brush={brushSize} onMask={onBrushMask!} maskKey={maskKey} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.src} alt="input" className="block w-full" />
        )}
      </div>

      {spec.brush && (
        <div className="flex items-center gap-3">
          <span className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
            {tr('brush')}
          </span>
          <input
            type="range"
            min={8}
            max={96}
            step={4}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="max-w-[140px]"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) take(f);
            e.target.value = '';
          }}
        />
        <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
          {tr('uploadImage')}
        </button>
        {media && !media.builtin && (
          <span className="tag" title={media.name}>
            {media.name?.slice(0, 24) ?? 'upload'}
          </span>
        )}
        {media && (
          <button type="button" className="btn btn-ghost" onClick={() => onMedia(undefined)}>
            {locale === 'zh' ? '移除' : 'Remove'}
          </button>
        )}
      </div>
      {brushMask && (
        <p className="text-[10px]" style={{ color: 'var(--fg-faint)' }}>
          {locale === 'zh'
            ? `掩码区域：${brushMask.w}×${brushMask.h}`
            : `Mask region: ${brushMask.w}×${brushMask.h}`}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- audio */

function Waveform({ peaks, height = 44 }: { peaks: number[]; height?: number }) {
  const max = Math.max(...peaks, 0.0001);
  return (
    <div className="flex items-center gap-[2px]" style={{ height }}>
      {peaks.map((p, i) => (
        <span
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${Math.max(2, (p / max) * height)}px`,
            background: 'var(--fg-subtle)',
            opacity: 0.35 + (p / max) * 0.65,
          }}
        />
      ))}
    </div>
  );
}

export function AudioPanel({
  media,
  onMedia,
  peaks,
  onPeaks,
}: {
  media?: MediaState;
  onMedia: (m: MediaState | undefined) => void;
  peaks: number[];
  onPeaks: (p: number[]) => void;
}) {
  const { locale, tr } = useApp();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!media) {
      onPeaks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(media.src);
        const buf = await res.arrayBuffer();
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ac = new AC({ sampleRate: 16000 });
        const decoded = await ac.decodeAudioData(buf.slice(0));
        const ch = decoded.getChannelData(0);
        const buckets = 200;
        const size = Math.max(1, Math.floor(ch.length / buckets));
        const out: number[] = [];
        for (let b = 0; b < buckets; b++) {
          let max = 0;
          for (let i = b * size; i < Math.min((b + 1) * size, ch.length); i++) {
            const v = Math.abs(ch[i]);
            if (v > max) max = v;
          }
          out.push(max);
        }
        if (!cancelled) onPeaks(out);
        ac.close();
      } catch {
        if (!cancelled) onPeaks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media?.src]);

  const toggleRecord = async () => {
    if (recording) {
      recRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        onMedia({ src: URL.createObjectURL(blob), builtin: false, name: 'recording.webm' });
        stream.getTracks().forEach((t) => t.stop());
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      setError(null);
    } catch {
      setError(locale === 'zh' ? '无法访问麦克风' : 'Microphone unavailable');
    }
  };

  return (
    <div className="space-y-3">
      <div className="surface-inset rounded-lg px-3 py-3">
        {peaks.length ? (
          <Waveform peaks={peaks} />
        ) : (
          <div className="flex h-11 items-center justify-center text-[12px]" style={{ color: 'var(--fg-faint)' }}>
            {locale === 'zh' ? '暂无音频' : 'No audio loaded'}
          </div>
        )}
      </div>

      {media && (
        <div className="flex flex-wrap items-center gap-2">
          <audio ref={audioRef} src={media.src} controls className="h-9 max-w-full" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onMedia({ src: URL.createObjectURL(f), builtin: false, name: f.name });
            e.target.value = '';
          }}
        />
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          {tr('uploadAudio')}
        </button>
        <button type="button" className="btn" onClick={toggleRecord}>
          {recording ? `● ${tr('recording')}` : tr('record')}
        </button>
        {media && !media.builtin && <span className="tag">{media.name?.slice(0, 22) ?? 'upload'}</span>}
        {media && (
          <button type="button" className="btn btn-ghost" onClick={() => onMedia(undefined)}>
            {locale === 'zh' ? '移除' : 'Remove'}
          </button>
        )}
      </div>
      {error && <p className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>{error}</p>}
      <p className="text-[10px] leading-4" style={{ color: 'var(--fg-faint)' }}>
        {tr('uploadTip')}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- video */

export function VideoPanel({
  media,
  onMedia,
  webcam,
}: {
  media?: MediaState;
  onMedia: (m: MediaState | undefined) => void;
  webcam?: boolean;
}) {
  const { locale, tr } = useApp();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera(false);
  };

  const toggleCamera = async () => {
    if (camera) {
      stopCamera();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 } });
      streamRef.current = stream;
      setCamera(true);
      setError(null);
      onMedia({ src: 'webcam', builtin: false, name: 'camera' });
    } catch {
      setError(locale === 'zh' ? '无法访问摄像头' : 'Camera unavailable');
    }
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (camera && streamRef.current) {
      v.srcObject = streamRef.current;
      v.play().catch(() => undefined);
    } else if (media && media.src !== 'webcam') {
      v.srcObject = null;
      v.src = media.src;
    }
    return () => {
      // keep stream alive across re-renders, released on unmount
    };
  }, [camera, media]);

  useEffect(() => () => stopCamera(), []);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border" style={{ background: '#000' }}>
        <video ref={videoRef} controls muted playsInline className="block w-full" style={{ aspectRatio: '16 / 9' }} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              stopCamera();
              onMedia({ src: URL.createObjectURL(f), builtin: false, name: f.name });
            }
            e.target.value = '';
          }}
        />
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          {tr('uploadVideo')}
        </button>
        {webcam && (
          <button type="button" className="btn" onClick={toggleCamera}>
            {camera ? tr('cameraOn') : tr('camera')}
          </button>
        )}
        {media && !media.builtin && <span className="tag">{media.name?.slice(0, 22) ?? 'upload'}</span>}
      </div>
      {error && <p className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------- webcam */

export function WebcamPanel({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const { locale } = useApp();
  return (
    <button type="button" className="btn" onClick={onToggle}>
      {active ? (locale === 'zh' ? '关闭实时画面' : 'Stop live view') : locale === 'zh' ? '开启摄像头实时叠加' : 'Live camera overlay'}
    </button>
  );
}

export function defaultInput(spec: DemoSpec, locale: Locale): InputState {
  const first = spec.samples[0];
  if (!first) return { text: '', fields: {}, lines: [] };
  if (isTextSample(first)) return sampleToInput(first, locale);
  return sampleToInput(first, locale);
}

export function sampleToInput(sample: TextSample | MediaSample, locale: Locale): InputState {
  if (isTextSample(sample)) {
    const fields: Record<string, string> = {};
    Object.entries(sample.fields ?? {}).forEach(([k, v]) => {
      fields[k] = v[locale];
    });
    return {
      text: sample.text[locale],
      fields,
      lines: (sample.lines ?? []).map((l) => l.text[locale]),
    };
  }
  const fields: Record<string, string> = {};
  Object.entries(sample.fields ?? {}).forEach(([k, v]) => {
    fields[k] = v[locale];
  });
  return {
    text: sample.text?.[locale] ?? '',
    fields,
    lines: [],
    media: {
      src: sample.src,
      builtin: true,
      sampleId: sample.id,
      reference: sample.reference,
      name: sample.src.split('/').pop(),
    },
  };
}

export function useMediaJson(spec: DemoSpec, input: InputState, locale: Locale) {
  return useMemo(() => {
    const first = spec.samples[0];
    return { hasSamples: Boolean(first), defaultInput: defaultInput(spec, locale), input };
  }, [spec, input, locale]);
}
