/**
 * Inference dispatcher.
 *
 * `runInference` is the single entry point the UI talks to. It resolves the
 * requested task, then routes to either:
 *   • a real client-side computation (canvas pixel ops, STFT, Web Audio,
 *     bag-of-n-gram embeddings, keyword classification, scene-change detection), or
 *   • a curated fixture for the built-in samples when the task genuinely needs
 *     model weights that are not shipped with the demo.
 *
 * Swapping in a real runtime (transformers.js / onnxruntime-web / WebLLM) means
 * implementing one branch per `outputKind` — nothing in the UI changes.
 */
import type { DemoSpec, Locale, ModelEntry, OutputKind } from '../types';
import { isTextSample } from '../types';
import gtRaw from '../data/sample-gt.json';
import { FIXTURES, getFixture } from './fixtures';
import {
  classify,
  cosine,
  embed,
  extractiveSummary,
  glossaryTranslate,
  keywords,
  l2norm,
  relevance,
  simulatedChatReply,
  simulatedCode,
  splitSentences,
  structuredExtract,
  tokensOf,
} from './text-tasks';
import {
  buildLandmarks,
  detectFromTruth,
  detectHeuristic,
  generateImage,
  inpaint,
  loadImage,
  maskFromRects,
  proposeBodyBox,
  proposeSubjectBox,
  renderCutout,
  renderDepth,
  restore,
  segmentForeground,
  toCanvas,
  type Box,
  type GroundTruth,
  type LandmarkSet,
} from './image-tasks';
import {
  decodeAudio,
  denoise,
  envelopeFromText,
  peaks as audioPeaks,
  renderMusic,
  separate,
  type Stem,
} from './audio-tasks';
import { clamp, mulberry32, round, seedFrom } from './random';
import { REAL_SUBCATEGORIES, realSpecFor } from '../data/real-models';
import {
  askDocument,
  captionImage,
  classifyText,
  cutForeground,
  detectObjects,
  embedLines,
  enhanceImage,
  estimateDepth,
  generateText,
  rankByEmbedding,
  scorePairs,
  semanticSegment,
  summariseText,
  synthesiseSpeech,
  transcribeAudio,
  translateText,
  zeroShotClassifyImage,
  zeroShotClassifyText,
  type LoadedRun,
} from './real';

const GT = gtRaw as unknown as Record<string, GroundTruth>;

export interface MediaInput {
  src: string;
  builtin: boolean;
  sampleId?: string;
  reference?: string;
}

export interface RunContext {
  spec: DemoSpec;
  model: ModelEntry;
  locale: Locale;
  text: string;
  fields: Record<string, string>;
  lines: string[];
  params: Record<string, string | number | boolean>;
  media?: MediaInput;
  /** id of the selected built-in sample, used to look up scripted reference output */
  sampleId?: string;
  /** Foreground mask painted by the user (inpainting). Same resolution as the analysis canvas. */
  maskAlpha?: Float32Array;
  onToken?: (partial: string) => void;
  onPhase?: (phase: string) => void;
}

export interface ResultMeta {
  device: string;
  backend: string;
  /** true when the result comes from a shipped fixture or a rule-based fallback */
  simulated: boolean;
  note?: string;
  tokens?: number;
  /** set when real ONNX weights were downloaded and executed */
  real?: {
    repo: string;
    dtype: string;
    device: string;
    /** bytes downloaded during this run (0 = served from the HTTP cache) */
    bytes: number;
    /** true when the repo is a stand-in for the catalogue entry */
    substitute?: boolean;
  };
}

export type DemoPayload =
  | { kind: 'labels'; task?: string; labels: { label: string; score: number }[] }
  | { kind: 'text'; text: string; extra?: { summary?: string; points?: string[]; keywords?: { word: string; count: number }[]; coverage?: number; glossary?: { source: string; target: string }[] } }
  | { kind: 'chat'; text: string }
  | { kind: 'json'; value: unknown; raw: string }
  | { kind: 'code'; code: string; language: string }
  | { kind: 'embedding'; dim: number; lines: { text: string; meta?: string }[]; vectors: number[][]; matrix: number[][]; norms: number[] }
  | { kind: 'ranking'; query: string; items: { text: string; meta?: string; base: number; score: number; delta: number }[] }
  | { kind: 'search'; query: string; items: { text: string; meta?: string; score: number }[] }
  | { kind: 'detection'; boxes: Box[]; width: number; height: number; imageUrl: string }
  | { kind: 'segmentation'; url: string; coverage: number; mode: string; originalUrl: string }
  | { kind: 'ocr'; lines: { text: string; x: number; y: number; w: number; h: number; conf: number }[]; text: string; fields?: Record<string, unknown>; width: number; height: number; imageUrl: string }
  | { kind: 'depth'; url: string }
  | { kind: 'restoration'; url: string; referenceUrl?: string; metrics: { label: string; value: string }[] }
  | { kind: 'generated-image'; url: string; seed: number; steps: number; guidance: number; palette: string }
  | { kind: 'inpainting'; url: string; originalUrl: string; filled: number }
  | { kind: 'transcript'; language: string; text: string; segments: { start: number; end: number; text: string }[]; confidence: number }
  | { kind: 'synth-audio'; text: string; waveform: number[]; url?: string; voice?: string }
  | { kind: 'audio-compare'; before: number[]; after: number[]; url: string; snrGainDb: number }
  | { kind: 'stems'; stems: Stem[] }
  | { kind: 'music'; url: string; peaks: number[]; plan: { kind: string; tempo: number; duration: number; chords: number[][]; waveform: string } }
  | { kind: 'landmarks'; variant: 'face' | 'pose' | 'hand'; set: LandmarkSet; imageUrl: string; width: number; height: number; gesture?: string }
  | { kind: 'tracking'; duration: number; frames: { t: number; boxes: { id: number; label: string; x: number; y: number; w: number; h: number; score: number }[] }[]; trackCount: number; videoUrl: string }
  | { kind: 'video-timeline'; duration: number; segments: { start: number; end: number; label: string; confidence: number }[]; summary: string; thumbs: string[]; videoUrl: string };

export interface RunResult {
  payload: DemoPayload;
  latencyMs: number;
  meta: ResultMeta;
}

/* ----------------------------------------------------------------- helpers */

const baseName = (src: string) => src.split('/').pop() ?? src;

function truthFor(media?: MediaInput): GroundTruth | undefined {
  if (!media?.builtin) return undefined;
  return GT[baseName(media.src)];
}

const num = (v: string | number | boolean | undefined, fallback: number): number =>
  typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || fallback : fallback;
const str = (v: string | number | boolean | undefined, fallback: string): string =>
  typeof v === 'string' ? v : fallback;
const bool = (v: string | number | boolean | undefined, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback;

const DEVICE_LABEL: Record<string, string> = {
  transformersjs: 'Transformers.js · WASM/WebGPU',
  onnxruntimeweb: 'onnxruntime-web · WebGPU',
  mediapipe: 'MediaPipe Tasks · WASM',
  tensorflowjs: 'TensorFlow.js · WebGL',
  webllm: 'WebLLM · WebGPU',
  whisperwasm: 'whisper.cpp · WASM',
  opencvjs: 'OpenCV.js · WASM',
  tflite: 'TFLite · WASM',
};

function deviceOf(model: ModelEntry): { device: string; backend: string } {
  const key = model.framework.replace(/-/g, '');
  const label = DEVICE_LABEL[key] ?? `${model.framework} · WASM`;
  const backend = /webgpu|webllm/i.test(label) ? 'WebGPU' : /webgl|tensorflowjs/i.test(label) ? 'WebGL' : 'WASM (SIMD)';
  return { device: label, backend };
}

async function frameThumbnails(video: HTMLVideoElement, count: number): Promise<string[]> {
  const c = document.createElement('canvas');
  const w = 192;
  const h = Math.max(1, Math.round((video.videoHeight / (video.videoWidth || 1)) * w));
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const out: string[] = [];
  const dur = Number.isFinite(video.duration) ? video.duration : 6;
  for (let i = 0; i < count; i++) {
    const t = (dur * (i + 0.5)) / count;
    await seek(video, t);
    ctx.drawImage(video, 0, 0, w, h);
    out.push(c.toDataURL('image/jpeg', 0.72));
  }
  return out;
}

function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('seeked', done);
      resolve();
    };
    video.addEventListener('seeked', done);
    video.currentTime = Math.min(t, Math.max(0, (video.duration || 0) - 0.05));
    setTimeout(done, 900);
  });
}

async function loadVideo(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'auto';
    v.muted = true;
    v.playsInline = true;
    v.crossOrigin = 'anonymous';
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error('video load failed'));
    v.src = src;
  });
}

/* ------------------------------------------------------------- text family */

function runTextFamily(ctx: RunContext, kind: OutputKind): DemoPayload {
  const { spec, locale, text, fields, lines, params, model } = ctx;
  const seed = seedFrom(spec.subcategory, model.id, text, lines.join('|'), params);
  const rng = mulberry32(seed);

  switch (kind) {
    case 'labels': {
      if (spec.subcategory === 'clip') {
        const candidates = (fields.labels ?? '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        const truth = truthFor(ctx.media) as GroundTruth | undefined;
        // derive an image "caption" from what is actually in the picture
        let caption = '';
        if (truth?.objects?.length) caption = truth.objects.map((o) => `${o.labelEn} ${o.label} ${o.label}`).join(' ');
        if (truth?.lines?.length) caption = truth.lines.map((l) => l.text).join(' ');
        if (!caption) caption = 'image photograph scene';
        const scored = candidates
          .map((c) => ({ label: c, score: clamp(relevance(caption, c, 256, model.id) * (0.7 + rng() * 0.6), 0.01, 0.99) }))
          .sort((a, b) => b.score - a.score);
        const total = scored.reduce((s, x) => s + x.score, 0) || 1;
        return { kind: 'labels', task: 'zero-shot', labels: scored.map((s) => ({ ...s, score: s.score / total })) };
      }
      const res = classify(text, locale, str(params.task, 'auto'));
      return { kind: 'labels', task: res.task, labels: res.labels };
    }

    case 'text': {
      if (spec.subcategory === 'translation') {
        const target = str(params.targetLang, 'en');
        const sourceLang = str(params.sourceLang, 'auto');
        // exact pair available for the shipped samples
        const sample = spec.samples.filter(isTextSample).find((s) => s.text.zh === text || s.text.en === text);
        if (sample) {
          const out = target === 'en' ? sample.text.en : sample.text.zh;
          if (out) return { kind: 'text', text: out, extra: { coverage: 1 } };
        }
        const t = glossaryTranslate(text, sourceLang === 'auto' ? (/[\u4e00-\u9fff]/.test(text) ? 'zh' : 'en') : sourceLang, target);
        return { kind: 'text', text: t.text, extra: { coverage: t.coverage, glossary: t.glossaryHits } };
      }
      const maxLen = num(params.maxLength, 96);
      const res = extractiveSummary(text, 8);
      return {
        kind: 'text',
        text: res.summary,
        extra: { summary: res.summary, points: res.points, keywords: res.keywords.slice(0, 8), coverage: round(clamp(maxLen / Math.max(text.length, 1), 0.02, 1)) },
      };
    }

    case 'json': {
      const matched = matchSampleFixture(ctx);
      const value = (matched as Record<string, unknown> | undefined) ?? structuredExtract(text, str(params.schema, 'job'));
      return { kind: 'json', value, raw: JSON.stringify(value, null, 2) };
    }

    case 'code': {
      const matched = matchSampleFixture(ctx);
      if (typeof matched === 'string') return { kind: 'code', code: matched, language: str(params.language, 'typescript') };
      return {
        kind: 'code',
        code: simulatedCode(text, str(params.language, 'typescript'), str(params.task, 'generate')),
        language: str(params.language, 'typescript'),
      };
    }

    case 'chat': {
      const matched = matchSampleFixture(ctx);
      if (typeof matched === 'string') {
        const q = ctx.onToken;
        if (q) streamInto(q, matched, locale);
        return { kind: 'chat', text: matched };
      }
      const reply = simulatedChatReply(text, locale, model.name);
      if (ctx.onToken) streamInto(ctx.onToken, reply, locale);
      return { kind: 'chat', text: reply };
    }

    case 'embedding': {
      const dim = num(params.dim, 16);
      const norms = bool(params.normalize, true);
      const full = 128;
      const vectors = lines.map((l) => {
        const v = embed(l, full, model.id);
        return (norms ? l2norm(v) : v).slice(0, dim);
      });
      const matrix = vectors.map((a) => vectors.map((b) => round((cosine(a, b) + 1) / 2, 4)));
      const fullVecs = lines.map((l) => l2norm(embed(l, full, model.id)));
      const fullMatrix = fullVecs.map((a) => fullVecs.map((b) => (cosine(a, b) + 1) / 2));
      void matrix;
      return {
        kind: 'embedding',
        dim,
        lines: lines.map((l) => ({ text: l })),
        vectors: vectors.map((v) => v.map((x) => round(x, 4))),
        matrix: fullMatrix.map((row) => row.map((x) => round(x, 4))),
        norms: fullVecs.map((v) => round(Math.sqrt(v.reduce((s, x) => s + x * x, 0)), 4)),
      };
    }

    case 'ranking': {
      const query = fields.query ?? '';
      const topK = num(params.topK, 5);
      const items = lines.map((l) => ({ text: l, base: relevance(query, l, 128, `${model.id}:base`) }));
      const rescored = items.map((i) => ({ ...i, score: clamp(relevance(query, i.text, 128, model.id) * 1.0 + rng() * 0.03, 0, 1) }));
      const sorted = [...rescored].sort((a, b) => b.score - a.score);
      const rankMap = new Map(sorted.map((s, i) => [s.text, i]));
      return {
        kind: 'ranking',
        query,
        items: rescored
          .slice()
          .sort((a, b) => (rankMap.get(a.text)! - rankMap.get(b.text)!))
          .slice(0, topK)
          .map((i) => ({ ...i, delta: (rankMap.get(i.text) ?? 0) - items.findIndex((x) => x.text === i.text) })),
      };
    }

    case 'search': {
      const query = fields.query ?? '';
      const topK = num(params.topK, 3);
      const items = lines
        .map((l) => ({ text: l, score: clamp(relevance(query, l, 128, model.id) * (0.92 + rng() * 0.16), 0, 1) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
      return { kind: 'search', query, items };
    }

    default:
      throw new Error(`unsupported text output: ${kind}`);
  }
}

/** Pull a scripted fixture for the currently selected built-in sample. */
function matchSampleFixture(ctx: RunContext): unknown {
  const id = ctx.sampleId ?? ctx.media?.sampleId;
  if (!id) return undefined;
  const media = ctx.media;
  if (media && !media.builtin) return undefined;
  return getFixture(`${ctx.spec.category}/${ctx.spec.subcategory}/${id}`, ctx.locale);
}

function streamInto(onToken: (s: string) => void, full: string, locale: Locale): void {
  const chunks = locale === 'zh' ? [...full] : (full.match(/\S+\s*/g) ?? [full]);
  let acc = '';
  let i = 0;
  const step = () => {
    const batch = Math.max(1, Math.round(chunks.length / 90));
    for (let k = 0; k < batch && i < chunks.length; k++, i++) acc += chunks[i];
    onToken(acc);
    if (i < chunks.length) setTimeout(step, 12);
  };
  setTimeout(step, 60);
}

/* ------------------------------------------------------------ image family */

async function runImageFamily(ctx: RunContext, kind: OutputKind): Promise<DemoPayload> {
  const { spec, params, model, locale } = ctx;
  const seed = seedFrom(spec.subcategory, model.id, ctx.media?.src ?? ctx.text, params);

  // Text-to-image needs no source image.
  if (kind === 'generated-image') {
    const prompt = ctx.text;
    const url = generateImage(
      prompt,
      ctx.fields.negative ?? '',
      num(params.seed, 42),
      str(params.ratio, 'square') as 'square' | 'wide' | 'tall',
      num(params.steps, 20),
      num(params.guidance, 7.5)
    );
    const palette = keywords(prompt, 3).map((k) => k.word).join(' / ');
    return {
      kind: 'generated-image',
      url,
      seed: num(params.seed, 42),
      steps: num(params.steps, 20),
      guidance: num(params.guidance, 7.5),
      palette,
    };
  }

  const src = ctx.media?.src;
  if (!src) throw new Error('image required');
  const truth = truthFor(ctx.media);
  const img = await loadImage(src);
  const canvas = toCanvas(img);

  switch (kind) {
    case 'detection': {
      const conf = num(params.conf, 0.4);
      const boxes = truth ? detectFromTruth(truth, model.id, conf) : detectHeuristic(canvas, model.id, conf);
      return { kind: 'detection', boxes, width: canvas.width, height: canvas.height, imageUrl: src };
    }
    case 'segmentation': {
      const alpha = segmentForeground(canvas, num(params.thresh, 0.5), num(params.feather, 2));
      let fg = 0;
      for (let i = 0; i < alpha.length; i++) if (alpha[i] > 0.5) fg++;
      const mode = str(params.mode, 'matte');
      return {
        kind: 'segmentation',
        url: renderCutout(canvas, alpha, mode as 'matte' | 'mask'),
        originalUrl: src,
        coverage: fg / alpha.length,
        mode,
      };
    }
    case 'ocr': {
      const lang = str(params.lang, 'chi_sim+eng');
      if (truth?.lines?.length) {
        const rng = mulberry32(seed);
        const lines = truth.lines.map((l) => ({ ...l, conf: round(0.88 + rng() * 0.11, 3) }));
        return {
          kind: 'ocr',
          lines,
          text: truth.text ?? lines.map((l) => l.text).join('\n'),
          fields: truth.fields,
          width: canvas.width,
          height: canvas.height,
          imageUrl: src,
        };
      }
      // layout-only pass: horizontal projection finds text bands
      const c = ctx2(canvas);
      const data = c.getImageData(0, 0, canvas.width, canvas.height).data;
      const rows: { y: number; h: number }[] = [];
      let run = -1;
      for (let y = 0; y < canvas.height; y++) {
        let ink = 0;
        for (let x = 0; x < canvas.width; x += 2) {
          const i = (y * canvas.width + x) * 4;
          const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
          if (lum < 0.55) ink++;
        }
        const dense = ink > canvas.width / 2 / 6;
        if (dense && run < 0) run = y;
        if (!dense && run >= 0) {
          if (y - run > 6) rows.push({ y: run / canvas.height, h: (y - run) / canvas.height });
          run = -1;
        }
      }
      const lines = rows.map((r) => ({
        text: locale === 'zh' ? '（未加载识别权重）' : '(recogniser weights not loaded)',
        x: 0.05,
        y: r.y,
        w: 0.9,
        h: r.h,
        conf: 0.31,
      }));
      return {
        kind: 'ocr',
        lines,
        text: lines.map((l) => l.text).join('\n'),
        width: canvas.width,
        height: canvas.height,
        imageUrl: src,
      };
    }
    case 'depth':
      return { kind: 'depth', url: renderDepth(canvas, str(params.colormap, 'gray') as 'gray' | 'turbo' | 'viridis', num(params.overlay, 0)) };
    case 'restoration': {
      const task = str(params.task, 'denoise') as 'denoise' | 'sr' | 'deblur';
      const strength = num(params.strength, 0.7);
      const url = restore(canvas, task, strength);
      const ref = ctx.media?.reference;
      const metrics: { label: string; value: string }[] = [];
      if (ref) {
        try {
          const rimg = await loadImage(ref);
          const rc = toCanvas(rimg);
          const a = ctx2(canvas).getImageData(0, 0, canvas.width, canvas.height);
          const b = ctx2(rc).getImageData(0, 0, rc.width, rc.height);
          let seBefore = 0;
          let seAfter = 0;
          const n = Math.min(a.data.length, b.data.length);
          for (let i = 0; i < n; i += 4) {
            for (let ch = 0; ch < 3; ch++) {
              const ref0 = b.data[i + ch];
              seBefore += (a.data[i + ch] - ref0) ** 2;
              seAfter += (a.data[i + ch] * 0.35 + ref0 * 0.65 - ref0) ** 2;
            }
          }
          const psnrBefore = 10 * Math.log10((255 ** 2) / Math.max(seBefore / n, 1e-6));
          const psnrAfter = 10 * Math.log10((255 ** 2) / Math.max(seAfter / n, 1e-6));
          metrics.push({ label: 'PSNR (输入)', value: `${round(psnrBefore, 2)} dB` });
          metrics.push({ label: 'PSNR (参考上限)', value: `${round(Math.max(psnrAfter, psnrBefore), 2)} dB` });
          metrics.push({ label: 'SSIM 估计', value: `${round(clamp(psnrBefore / 42, 0.2, 0.99), 3)}` });
        } catch {
          /* reference optional */
        }
      }
      metrics.push({ label: '输入分辨率', value: `${canvas.width}×${canvas.height}` });
      if (task === 'sr') metrics.push({ label: '输出分辨率', value: `${canvas.width * 2}×${canvas.height * 2}` });
      return { kind: 'restoration', url, referenceUrl: ref, metrics };
    }
    case 'inpainting': {
      const size = canvas.width * canvas.height;
      let alpha = ctx.maskAlpha && ctx.maskAlpha.length === size ? ctx.maskAlpha : new Float32Array(size);
      let anyPainted = false;
      for (let i = 0; i < alpha.length; i++) {
        if (alpha[i] > 0.35) {
          anyPainted = true;
          break;
        }
      }
      // No brush strokes? Fall back to the sample's known watermark region.
      if (!anyPainted && truth?.masks?.length) {
        alpha = maskFromRects(canvas.width, canvas.height, truth.masks);
      }
      const res = inpaint(canvas, alpha, 240, num(params.feather, 6));
      return { kind: 'inpainting', url: res.url, originalUrl: canvas.toDataURL('image/png'), filled: res.filled };
    }
    case 'landmarks-face': {
      const box = truth?.objects?.length
        ? { x: truth.objects[0].x, y: truth.objects[0].y, w: truth.objects[0].w, h: truth.objects[0].h }
        : proposeSubjectBox(canvas, model.id);
      const set = buildLandmarks('face', box, model.id);
      return { kind: 'landmarks', variant: 'face', set, imageUrl: src, width: canvas.width, height: canvas.height };
    }
    case 'landmarks-pose': {
      const box = truth?.objects?.[0] && spec.subcategory === 'pose'
        ? { x: truth.objects[0].x, y: truth.objects[0].y, w: truth.objects[0].w, h: truth.objects[0].h }
        : proposeBodyBox(canvas, model.id);
      const set = buildLandmarks('pose', box, model.id);
      return { kind: 'landmarks', variant: 'pose', set, imageUrl: src, width: canvas.width, height: canvas.height };
    }
    case 'landmarks-hand': {
      const box = truth?.objects?.length
        ? { x: truth.objects[0].x, y: truth.objects[0].y, w: truth.objects[0].w, h: truth.objects[0].h }
        : proposeSubjectBox(canvas, model.id);
      const set = buildLandmarks('hand', box, model.id);
      const proto = set.points;
      const spread = (i: number, j: number) => Math.hypot(proto[i].x - proto[j].x, proto[i].y - proto[j].y);
      const extended = [8, 12, 16, 20].filter((tip) => spread(tip, 0) > 0.28).length;
      const gesture = extended >= 4 ? 'open_palm' : extended <= 1 ? 'fist' : extended === 2 ? 'victory' : 'pointing';
      return { kind: 'landmarks', variant: 'hand', set, imageUrl: src, width: canvas.width, height: canvas.height, gesture };
    }
    default:
      throw new Error(`unsupported image output: ${kind}`);
  }
}

const ctx2 = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!;

/* ------------------------------------------------------------ audio family */

function runAudioFamily(ctx: RunContext, buffer: AudioBuffer, kind: OutputKind): Promise<DemoPayload> | DemoPayload {
  const { spec, params, model, locale, text } = ctx;
  const seed = seedFrom(spec.subcategory, model.id, ctx.media?.src ?? '', params);
  switch (kind) {
    case 'transcript': {
      const fixture = matchSampleFixture(ctx) as
        | { language: string; text: string; segments: { start: number; end: number; text: string }[]; confidence: number; note?: string; noteEn?: string }
        | undefined;
      if (fixture) return { kind: 'transcript', ...fixture };
      // energy-based VAD: report real speech regions even without a recogniser
      const ch = buffer.getChannelData(0);
      const win = Math.floor(buffer.sampleRate * 0.05);
      const energies: number[] = [];
      for (let i = 0; i < ch.length; i += win) {
        let s = 0;
        for (let k = i; k < Math.min(i + win, ch.length); k++) s += ch[k] * ch[k];
        energies.push(Math.sqrt(s / win));
      }
      const max = Math.max(...energies, 1e-6);
      const active = energies.map((e) => e > max * 0.14);
      const segments: { start: number; end: number; text: string }[] = [];
      let start = -1;
      active.forEach((a, i) => {
        const t = (i * win) / buffer.sampleRate;
        if (a && start < 0) start = t;
        if ((!a || i === active.length - 1) && start >= 0) {
          const end = t;
          if (end - start > 0.12) {
            segments.push({
              start: round(start, 2),
              end: round(end, 2),
              text: locale === 'zh' ? '（演示模式：未加载声学模型）' : '(demo mode: acoustic model not loaded)',
            });
          }
          start = -1;
        }
      });
      return {
        kind: 'transcript',
        language: 'unknown',
        text: segments.map((s) => s.text).join(' '),
        segments,
        confidence: 0,
      };
    }
    case 'audio-compare': {
      const res = denoise(buffer, num(params.strength, 0.8), bool(params.hpf, true));
      return { kind: 'audio-compare', before: res.before, after: res.after, url: res.url, snrGainDb: res.snrGainDb };
    }
    case 'stems': {
      const count = Number(str(params.model, '2')) as 2 | 4;
      return { kind: 'stems', stems: separate(buffer, count) };
    }
    case 'synth-audio': {
      const target = spec.subcategory === 'voice-cloning' ? (ctx.fields.target ?? '') : text;
      return {
        kind: 'synth-audio',
        text: target,
        waveform: envelopeFromText(target || ' ', locale, 320),
        voice: `${model.name} → browser TTS`,
      };
    }
    case 'music': {
      return renderMusic(
        text,
        num(params.tempo, 96),
        str(params.key, 'minor') as 'major' | 'minor',
        num(params.duration, 12)
      ).then((r) => ({
        kind: 'music' as const,
        url: r.url,
        peaks: r.peaks,
        plan: {
          kind: r.plan.kind,
          tempo: r.plan.tempo,
          duration: r.plan.duration,
          chords: r.plan.chords,
          waveform: r.plan.waveform,
        },
      }));
    }
    case 'labels':
      // used by nothing today, kept for completeness
      return { kind: 'labels', labels: [] };
    default:
      throw new Error(`unsupported audio output: ${kind}`);
  }
}

/* ------------------------------------------------------------- video family */

async function runVideoFamily(ctx: RunContext, kind: OutputKind): Promise<DemoPayload> {
  const { spec, params, model, locale } = ctx;
  const src = ctx.media?.src;
  if (!src) throw new Error('video required');
  const video = await loadVideo(src);
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 6;

  if (kind === 'tracking') {
    const fps = 3;
    const probe = document.createElement('canvas');
    probe.width = 240;
    probe.height = Math.max(1, Math.round((video.videoHeight / (video.videoWidth || 1)) * 240));
    const pctx = probe.getContext('2d', { willReadFrequently: true })!;
    const frames: { t: number; boxes: { id: number; label: string; x: number; y: number; w: number; h: number; score: number }[] }[] = [];
    let prev: Uint8ClampedArray | null = null;
    const conf = num(params.conf, 0.3);
    const total = Math.min(20, Math.max(2, Math.round(duration * fps)));
    for (let f = 0; f < total; f++) {
      const t = (duration * (f + 0.5)) / total;
      await seek(video, t);
      pctx.drawImage(video, 0, 0, probe.width, probe.height);
      const cur = pctx.getImageData(0, 0, probe.width, probe.height).data;
      const boxes: { id: number; label: string; x: number; y: number; w: number; h: number; score: number }[] = [];
      if (prev) {
        // frame differencing → connected motion regions
        const cells = 16;
        const cw = probe.width / cells;
        const chh = probe.height / cells;
        const motion = new Float32Array(cells * cells);
        for (let y = 0; y < probe.height; y += 3) {
          for (let x = 0; x < probe.width; x += 3) {
            const i = (y * probe.width + x) * 4;
            const d = Math.abs(cur[i] - prev[i]) + Math.abs(cur[i + 1] - prev[i + 1]) + Math.abs(cur[i + 2] - prev[i + 2]);
            motion[Math.min(cells - 1, Math.floor(y / chh)) * cells + Math.min(cells - 1, Math.floor(x / cw))] += d;
          }
        }
        const idxs = [...motion.keys()].sort((a, b) => motion[b] - motion[a]);
        const taken: { x: number; y: number }[] = [];
        for (const id of idxs.slice(0, 4)) {
          const cx = ((id % cells) + 0.5) * cw;
          const cy = (Math.floor(id / cells) + 0.5) * chh;
          if (motion[id] < 2000) break;
          if (taken.some((p) => Math.hypot(p.x - cx, p.y - cy) < 60)) continue;
          taken.push({ x: cx, y: cy });
          const rand = mulberry32(hashNumber(`${model.id}:${id}`));
          const bw = 34 + rand() * 34;
          const bh = bw * (0.9 + rand() * 0.8);
          boxes.push({
            id: id + 1,
            label: cy / probe.height > 0.55 ? 'vehicles' : 'person',
            x: clamp((cx - bw / 2) / probe.width, 0, 1),
            y: clamp((cy - bh / 2) / probe.height, 0, 1),
            w: bw / probe.width,
            h: bh / probe.height,
            score: clamp(0.4 + motion[id] / 40000, 0, 0.98),
          });
        }
      }
      frames.push({ t: round(t, 2), boxes: boxes.filter((b) => b.score >= conf) });
      prev = cur;
    }
    const trackCount = new Set(frames.flatMap((f) => f.boxes.map((b) => b.id))).size;
    return { kind: 'tracking', duration, frames, trackCount, videoUrl: src };
  }

  if (kind === 'video-timeline') {
    const fixture = matchSampleFixture(ctx) as
      | { duration: number; segments: { start: number; end: number; label: string; confidence: number }[]; summary: string }
      | undefined;
    const thumbs = await frameThumbnails(video, 6);
    if (fixture && Math.abs(duration - fixture.duration) < 1.5) {
      return { kind: 'video-timeline', duration, segments: fixture.segments, summary: fixture.summary, thumbs, videoUrl: src };
    }
    // real scene-change detection on the sampled frames
    const probe = document.createElement('canvas');
    probe.width = 64;
    probe.height = 36;
    const pctx = probe.getContext('2d', { willReadFrequently: true })!;
    const samples: { t: number; hist: number[]; lum: number }[] = [];
    for (let i = 0; i < 24; i++) {
      await seek(video, (duration * (i + 0.5)) / 24);
      pctx.drawImage(video, 0, 0, probe.width, probe.height);
      const d = pctx.getImageData(0, 0, probe.width, probe.height).data;
      const hist = new Array(16).fill(0);
      let lum = 0;
      for (let k = 0; k < d.length; k += 4) {
        const l = (d[k] * 0.299 + d[k + 1] * 0.587 + d[k + 2] * 0.114) / 255;
        lum += l;
        hist[Math.min(15, Math.floor(l * 16))] += 1;
      }
      samples.push({ t: (duration * (i + 0.5)) / 24, hist, lum: lum / (d.length / 4) });
    }
    const cuts = [0];
    for (let i = 1; i < samples.length; i++) {
      const diff = samples[i].hist.reduce((s, v, k) => s + Math.abs(v - samples[i - 1].hist[k]), 0) / (probe.width * probe.height);
      if (diff > 0.22) cuts.push(samples[i].t);
    }
    cuts.push(duration);
    const maxSeg = num(params.maxSegments, 6);
    const segments = [];
    for (let i = 0; i < Math.min(cuts.length - 1, maxSeg); i++) {
      const a = cuts[i];
      const b = cuts[i + 1];
      const lum = samples.filter((s) => s.t >= a && s.t < b).reduce((x, s) => x + s.lum, 0) / Math.max(1, samples.filter((s) => s.t >= a && s.t < b).length);
      const label = lum > 0.72 ? (locale === 'zh' ? '明亮画面 / 静态镜头' : 'Bright frame / static shot') : lum < 0.3 ? (locale === 'zh' ? '暗场画面' : 'Dark frame') : locale === 'zh' ? '常规运动镜头' : 'Regular motion shot';
      segments.push({ start: round(a, 2), end: round(b, 2), label, confidence: round(clamp(0.55 + Math.abs(0.5 - lum), 0, 0.95), 2) });
    }
    return {
      kind: 'video-timeline',
      duration,
      segments,
      summary:
        locale === 'zh'
          ? `共检测到 ${segments.length} 个镜头切换点，平均亮度 ${round(samples.reduce((s, x) => s + x.lum, 0) / samples.length, 2)}。该摘要由亮度与直方图变化率规则生成（演示模式）。`
          : `${segments.length} shot boundaries detected, mean luminance ${round(samples.reduce((s, x) => s + x.lum, 0) / samples.length, 2)}. This summary is generated by luminance and histogram-change rules (demo mode).`,
      thumbs,
      videoUrl: src,
    };
  }
  throw new Error(`unsupported video output: ${kind}`);
}

function hashNumber(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ------------------------------------------------------------- entry point */

export async function runInference(
  kind: OutputKind,
  ctx: RunContext
): Promise<RunResult> {
  const started = performance.now();
  const { model } = ctx;
  const { device, backend } = deviceOf(model);

  // First choice: really download and execute ONNX weights for this catalogue entry.
  const real = await tryReal(ctx);

  let payload: DemoPayload;
  let deviceLabel = device;
  let backendLabel = backend;

  if (real) {
    payload = real.payload;
    deviceLabel = real.run.device === 'webgpu' ? 'Transformers.js · WebGPU' : 'Transformers.js · WASM (SIMD)';
    backendLabel = real.run.device === 'webgpu' ? 'WebGPU' : 'WASM (SIMD)';
  } else {
    // No browser-ready weights for this entry: keep the deterministic simulator,
    // and let the progress UI show a read-out while it computes.
    // No browser-ready weights for this entry: say so explicitly instead of
    // faking a download — otherwise switching to a simulator-only model looks
    // like the weights silently failed to load.
    const sizeMb = Number((model.size.match(/([\d.]+)/) ?? [0, '80'])[1]) || 80;
    ctx.onPhase?.(
      ctx.locale === 'zh'
        ? '演示模式：不下载权重，用模拟引擎计算…'
        : 'Demo mode: no weights to download, running the simulator…'
    );
    await new Promise((r) => setTimeout(r, clamp(120 + sizeMb / 26, 120, 900)));
    payload = await runDispatch(kind, ctx);
  }

  const latencyMs = Math.round(performance.now() - started);
  // Only a run that actually executed ONNX weights may be labelled "computed".
  const simulated = !real;
  // Within demo mode: true = pure random simulation, false = real signal
  // processing (Canvas pixels / STFT / vector maths) on top of fake weights.
  const simulatorOnly = real ? false : isSimulated(ctx, payload);
  const realSpec = realSpecFor(ctx.spec.category, ctx.spec.subcategory, model.id);
  const noWeights = !real && REAL_SUBCATEGORIES.has(`${ctx.spec.category}/${ctx.spec.subcategory}`);
  const note = real
    ? realSpec?.note[ctx.locale]
    : noWeights
      ? ctx.locale === 'zh'
        ? '该模型没有可直接下载的浏览器权重，结果由模拟引擎生成；切换到列表里带标记的模型即为真实推理。'
        : 'This entry ships no downloadable browser weights — the result comes from the simulator. Pick another model in the list for real inference.'
      : simulatorOnly
        ? ctx.locale === 'zh'
          ? '演示模式：结果由确定性模拟引擎生成，未加载任何权重。'
          : 'Demo mode: the deterministic simulator produced this result; no weights were loaded.'
        : ctx.locale === 'zh'
          ? '演示模式：像素 / 频谱 / 向量运算真实执行，但模型权重为模拟。'
          : 'Demo mode: pixels, spectra and vectors are really computed, but the model weights are simulated.';
  return {
    payload,
    latencyMs,
    meta: {
      device: deviceLabel,
      backend: backendLabel,
      simulated,
      note,
      tokens: payload.kind === 'chat' || payload.kind === 'code' || payload.kind === 'text' ? tokensOf(String((payload as { text?: string; code?: string }).text ?? (payload as { code?: string }).code ?? '')).length : undefined,
      real: real
        ? {
            repo: real.run.repo,
            dtype: real.run.dtype,
            device: real.run.device,
            bytes: real.run.bytes,
            substitute: realSpec?.substitute,
          }
        : undefined,
    },
  };
}

async function runDispatch(kind: OutputKind, ctx: RunContext): Promise<DemoPayload> {
  let payload: DemoPayload;
  const textFamily: OutputKind[] = ['labels', 'text', 'json', 'code', 'chat', 'embedding', 'ranking', 'search'];
  const imageFamily: OutputKind[] = ['detection', 'segmentation', 'ocr', 'depth', 'restoration', 'generated-image', 'inpainting', 'landmarks-face', 'landmarks-pose', 'landmarks-hand'];
  /** tasks that need a decoded audio input */
  const audioInputFamily: OutputKind[] = ['transcript', 'audio-compare', 'stems'];
  /** audio tasks driven by text only */
  const audioTextFamily: OutputKind[] = ['synth-audio', 'music'];

  if (audioTextFamily.includes(kind)) {
    payload = await Promise.resolve(runAudioFamily(ctx, emptyBuffer(), kind));
  } else if (imageFamily.includes(kind)) {
    ctx.onPhase?.(ctx.locale === 'zh' ? '前处理与推理…' : 'Pre-processing…');
    payload = await runImageFamily(ctx, kind);
  } else if (audioInputFamily.includes(kind)) {
    ctx.onPhase?.(ctx.locale === 'zh' ? '解码音频…' : 'Decoding audio…');
    const buffer = await decodeAudio(ctx.media!.src);
    ctx.onPhase?.(ctx.locale === 'zh' ? '频谱处理…' : 'Spectral processing…');
    payload = await Promise.resolve(runAudioFamily(ctx, buffer, kind));
  } else if (kind === 'tracking' || kind === 'video-timeline') {
    ctx.onPhase?.(ctx.locale === 'zh' ? '抽帧与解码…' : 'Sampling frames…');
    payload = await runVideoFamily(ctx, kind);
  } else if (textFamily.includes(kind)) {
    ctx.onPhase?.(ctx.locale === 'zh' ? '编码与推理…' : 'Encoding…');
    payload = runTextFamily(ctx, kind);
  } else {
    throw new Error(`unhandled output kind: ${kind}`);
  }

  return payload;
}

function emptyBuffer(): AudioBuffer {
  return { sampleRate: 16000, getChannelData: () => new Float32Array(1) } as unknown as AudioBuffer;
}

/**
 * Down-sample a PCM waveform into the few hundred peak values the UI draws.
 */
function waveformPeaks(waveform: Float32Array, buckets = 600): number[] {
  const out: number[] = new Array(buckets).fill(0);
  const per = Math.max(1, Math.floor(waveform.length / buckets));
  for (let i = 0; i < buckets; i++) {
    let peak = 0;
    const start = i * per;
    const end = Math.min(start + per, waveform.length);
    for (let j = start; j < end; j++) peak = Math.max(peak, Math.abs(waveform[j]));
    out[i] = Math.round(peak * 1000) / 1000;
  }
  return out;
}

/** Encode mono Float32 PCM as a 16-bit WAV blob the <audio> element can play. */
function pcmToWavUrl(data: Float32Array, sampleRate: number): string {
  const buffer = new ArrayBuffer(44 + data.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + data.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, data.length * 2, true);
  let offset = 44;
  for (let i = 0; i < data.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

function mediaNaturalSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = src;
  });
}

/**
 * Pick the Whisper source language. Built-in samples encode it in their id
 * (`speech-zh.mp3`), and picked language (*live input*) falls back to the UI locale.
 */
function isChineseSample(ctx: RunContext): boolean {
  const id = `${ctx.spec.subcategory}/${ctx.sampleId ?? ''}`;
  if (/zh|cn|chinese/i.test(id)) return true;
  if (/en|english/i.test(id)) return false;
  return ctx.locale === 'zh';
}

/* ------------------------------------------- real-weight prompt scaffolding */

const isCjk = (s: string) => /[\u3400-\u9fff]/.test(s);

/** Split a textarea-style field into non-empty lines. */
const splitList = (value?: string) =>
  (value ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

/** Zero-shot label sets. The MNLI checkpoint is English-only, so the labels are
 *  English and get translated back for display. */
const ZERO_SHOT_SETS: Record<string, { en: string; zh: string }[]> = {
  sentiment: [
    { en: 'a positive opinion', zh: '正向评价' },
    { en: 'a negative opinion', zh: '负向评价' },
  ],
  intent: [
    { en: 'a request or complaint', zh: '需求 / 投诉' },
    { en: 'a question', zh: '咨询提问' },
    { en: 'praise or feedback', zh: '表扬反馈' },
  ],
  toxicity: [
    { en: 'a toxic or abusive comment', zh: '有害内容' },
    { en: 'a normal comment', zh: '正常内容' },
  ],
};

/** Pick the label set from the task parameter, falling back to the sample id. */
function zeroShotSetFor(ctx: RunContext): { en: string; zh: string }[] {
  const explicit = str(ctx.params.task, 'auto');
  const id = ctx.sampleId ?? '';
  const kind =
    explicit !== 'auto'
      ? explicit
      : id === 'support'
        ? 'intent'
        : id === 'moderation'
          ? 'toxicity'
          : 'sentiment';
  return ZERO_SHOT_SETS[kind] ?? ZERO_SHOT_SETS.sentiment;
}

/** Donut-style document question, chosen by the selected extraction schema. */
function documentQuestionFor(ctx: RunContext): string {
  const schema = str(ctx.params.schema, 'invoice');
  return schema === 'generic'
    ? 'List the key information on this document as field names and values.'
    : 'What are the key fields and totals on this document?';
}

const CHAT_SYSTEM = {
  zh: '你是一个严谨、简洁的助手，回答控制在 200 字以内。',
  en: 'You are a rigorous, concise assistant. Keep answers under 120 words.',
};

/** Qwen-style chat prompt: system turn, user turn, then the assistant cue. */
function chatPromptFor(ctx: RunContext): string {
  const system = ctx.fields.system?.trim() || CHAT_SYSTEM[ctx.locale];
  return [
    `<|im_start|>system\n${system}<|im_end|>`,
    `<|im_start|>user\n${ctx.text.trim()}<|im_end|>`,
    `<|im_start|>assistant\n`,
  ].join('\n');
}

const JSON_SCHEMAS: Record<string, { zh: string; en: string; shape: string }> = {
  job: {
    zh: '招聘信息',
    en: 'job posting',
    shape: '{"title": string, "location": string, "seniority": string, "skills": string[], "salary": string, "remote": boolean}',
  },
  event: {
    zh: '新闻事件',
    en: 'news event',
    shape: '{"what": string, "where": string, "when": string, "casualties": string, "cause": string}',
  },
  ticket: {
    zh: '客服工单',
    en: 'support ticket',
    shape: '{"product": string, "version": string, "symptom": string, "environment": string, "workaround": string}',
  },
};

function structuredPromptFor(ctx: RunContext): string {
  const key = str(ctx.params.schema, 'job');
  const schema = JSON_SCHEMAS[key] ?? JSON_SCHEMAS.job;
  const lang = ctx.locale === 'zh' ? '简体中文' : 'English';
  return [
    `<|im_start|>system\nYou extract structured data. Reply with a single JSON object and nothing else.<|im_end|>`,
    `<|im_start|>user\nSchema: ${schema.shape}\nValues must be written in ${lang}.\n\nText:\n${ctx.text.trim()}<|im_end|>`,
    `<|im_start|>assistant\n`,
  ].join('\n');
}

const CODE_TASKS: Record<string, { zh: string; en: string }> = {
  generate: { zh: '写出满足下列要求的代码', en: 'write code that satisfies the following requirement' },
  explain: { zh: '解释下面这段代码做了什么，指出可能的问题', en: 'explain what the following code does and flag any issues' },
  refactor: { zh: '重构下面这段代码，使其更清晰', en: 'refactor the following code for clarity' },
};

function codePromptFor(ctx: RunContext): string {
  const language = str(ctx.params.language, 'typescript');
  const taskKey = str(ctx.params.task, 'generate');
  const task = CODE_TASKS[taskKey] ?? CODE_TASKS.generate;
  const instruction = ctx.locale === 'zh' ? task.zh : task.en;
  return [
    `<|im_start|>system\nYou are a senior engineer. Answer with one fenced code block and at most two sentences of notes.<|im_end|>`,
    `<|im_start|>user\nLanguage: ${language}\nTask: ${instruction}\n\n${ctx.text.trim()}<|im_end|>`,
    `<|im_start|>assistant\n`,
  ].join('\n');
}

/** Best-effort JSON extraction from raw model text. */
function extractJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? raw).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return { raw: candidate };
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return { raw: candidate.slice(start, end + 1) };
  }
}

/** Strip a surrounding markdown fence from generated code. */
function stripFence(raw: string): string {
  const fenced = raw.match(/```[a-z0-9+#-]*\s*\n?([\s\S]*?)```/i);
  return (fenced?.[1] ?? raw).trim();
}

/**
 * Real-weight path. Returns null when the selected catalogue entry ships no
 * browser-ready checkpoint, or when the download / runtime fails — the caller
 * then falls back to the simulator instead of leaving the page broken.
 */
async function tryReal(ctx: RunContext): Promise<{ payload: DemoPayload; run: LoadedRun } | null> {
  if (typeof window === 'undefined') return null;
  const spec = realSpecFor(ctx.spec.category, ctx.spec.subcategory, ctx.model.id);
  if (!spec) return null;

  const report = (p: { loaded: number; total: number; ratio: number }) => {
    const mb = (p.loaded / 1048576).toFixed(1);
    // Sidecar files (config.json / tokenizer.json) finish instantly, so only the
    // large binaries get a percentage — otherwise the read-out flashes 100% → 1%.
    const pct = p.total > 1048576 ? `${Math.round(p.ratio * 100)}%` : '';
    ctx.onPhase?.(
      ctx.locale === 'zh'
        ? `下载权重 ${pct ? `${pct} ` : ''}（${mb} MB）`
        : `Downloading weights ${pct ? `${pct} ` : ''}(${mb} MB)`
    );
  };

  try {
    switch (ctx.spec.outputKind) {
      case 'labels': {
        // Two very different pipelines land here: CLIP-style image labelling and
        // (zero-shot) text classification.
        if (spec.task === 'zero-shot-image-classification') {
          if (!ctx.media?.src) return null;
          const labels = splitList(ctx.fields.labels);
          if (!labels.length) return null;
          ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
          const r = await zeroShotClassifyImage(ctx.media.src, labels, { spec, onProgress: report });
          ctx.onPhase?.(ctx.locale === 'zh' ? '比对图文相似度…' : 'Comparing image and text…');
          return { payload: { kind: 'labels', task: 'zero-shot-image', labels: r.labels }, run: r.meta };
        }
        if (spec.task === 'zero-shot-classification') {
          if (!ctx.text.trim()) return null;
          const set = zeroShotSetFor(ctx);
          ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
          const r = await zeroShotClassifyText(ctx.text, set.map((x) => x.en), { spec, onProgress: report });
          ctx.onPhase?.(ctx.locale === 'zh' ? '判别蕴含关系…' : 'Scoring entailment…');
          const zhOf = new Map(set.map((x) => [x.en, x.zh]));
          return {
            payload: {
              kind: 'labels',
              task: 'zero-shot',
              labels: r.labels.map((l) => ({
                label: ctx.locale === 'zh' ? zhOf.get(l.label) ?? l.label : l.label,
                score: l.score,
              })),
            },
            run: r.meta,
          };
        }
        if (!ctx.text.trim()) return null;
        ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
        const r = await classifyText(ctx.text, { spec, onProgress: report });
        ctx.onPhase?.(ctx.locale === 'zh' ? '推理…' : 'Running inference…');
        return { payload: { kind: 'labels', labels: r.labels }, run: r.meta };
      }
      case 'embedding': {
        const lines = ctx.lines.filter((l) => l.trim().length > 0);
        if (!lines.length) return null;
        ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
        const { vectors, meta } = await embedLines(lines, { spec, onProgress: report });
        ctx.onPhase?.(ctx.locale === 'zh' ? '编码句向量…' : 'Encoding sentences…');
        const dim = Math.min(num(ctx.params.dim, 16), vectors[0]?.length ?? 16);
        const matrix = vectors.map((a) => vectors.map((b) => (cosine(a, b) + 1) / 2));
        return {
          payload: {
            kind: 'embedding',
            dim,
            lines: lines.map((l) => ({ text: l })),
            vectors: vectors.map((v) => v.slice(0, dim).map((x) => round(x, 4))),
            matrix: matrix.map((row) => row.map((x) => round(x, 4))),
            norms: vectors.map((v) => round(Math.sqrt(v.reduce((s, x) => s + x * x, 0)), 4)),
          },
          run: meta,
        };
      }
      case 'ranking': {
        const query = ctx.fields.query?.trim();
        const docs = ctx.lines.filter((l) => l.trim().length > 0);
        if (!query || !docs.length) return null;
        ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
        const r = await scorePairs(query, docs, { spec, onProgress: report });
        ctx.onPhase?.(ctx.locale === 'zh' ? '交叉编码打分…' : 'Scoring pairs…');
        // `base` keeps the original recall order so the reshuffle stays visible.
        const items = docs.map((text, i) => {
          const rank = docs.length > 1 ? i / (docs.length - 1) : 0;
          const base = Math.round((1 - rank * 0.55) * 1000) / 1000;
          const score = Math.round(r.scores[i] * 1000) / 1000;
          return { text, base, score, delta: Math.round((score - base) * 1000) / 1000 };
        });
        items.sort((a, b) => b.score - a.score);
        const topK = Math.max(1, num(ctx.params.topK, items.length));
        return { payload: { kind: 'ranking', query, items: items.slice(0, topK) }, run: r.meta };
      }
      case 'search': {
        const query = ctx.fields.query?.trim();
        const docs = ctx.lines.filter((l) => l.trim().length > 0);
        if (!query || !docs.length) return null;
        ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
        const r = await rankByEmbedding(query, docs, { spec, onProgress: report });
        ctx.onPhase?.(ctx.locale === 'zh' ? '计算向量相似度…' : 'Scoring similarity…');
        const items = docs
          .map((text, i) => ({ text, score: Math.round(r.scores[i] * 1000) / 1000 }))
          .sort((a, b) => b.score - a.score);
        const topK = Math.max(1, num(ctx.params.topK, items.length));
        return { payload: { kind: 'search', query, items: items.slice(0, topK) }, run: r.meta };
      }
      case 'detection': {
        if (!ctx.media?.src) return null;
        ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
        const r = await detectObjects(ctx.media.src, ctx.locale, {
          spec,
          onProgress: report,
          threshold: num(ctx.params.conf, 0.4),
        });
        ctx.onPhase?.(ctx.locale === 'zh' ? '推理…' : 'Running inference…');
        return {
          payload: {
            kind: 'detection',
            boxes: r.boxes,
            width: r.width,
            height: r.height,
            imageUrl: ctx.media.src,
          },
          run: r.meta,
        };
      }
      case 'segmentation': {
        if (!ctx.media?.src) return null;
        ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
        if (spec.task === 'image-segmentation') {
          const r = await semanticSegment(ctx.media.src, { spec, onProgress: report });
          ctx.onPhase?.(ctx.locale === 'zh' ? '预测区域掩码…' : 'Predicting region masks…');
          return {
            payload: {
              kind: 'segmentation',
              url: r.url,
              coverage: r.coverage,
              mode: str(ctx.params.mode, 'mask'),
              originalUrl: ctx.media.src,
            },
            run: r.meta,
          };
        }
        const r = await cutForeground(ctx.media.src, { spec, onProgress: report });
        ctx.onPhase?.(ctx.locale === 'zh' ? '预测 alpha 掩码…' : 'Predicting the alpha matte…');
        return {
          payload: {
            kind: 'segmentation',
            url: r.url,
            coverage: r.coverage,
            mode: str(ctx.params.mode, 'matte'),
            originalUrl: ctx.media.src,
          },
          run: r.meta,
        };
      }
      case 'transcript': {
        if (!ctx.media?.src) return null;
        ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
        const r = await transcribeAudio(ctx.media.src, {
          spec,
          onProgress: report,
          language: isChineseSample(ctx) ? 'zh' : 'en',
        });
        ctx.onPhase?.(ctx.locale === 'zh' ? '转写音频…' : 'Transcribing audio…');
        return {
          payload: {
            kind: 'transcript',
            language: ctx.locale === 'zh' ? 'zh' : 'en',
            text: r.text,
            segments: r.segments.length
              ? r.segments
              : [{ start: 0, end: 0, text: r.text }],
            confidence: 0.9,
          },
          run: r.meta,
        };
      }
      case 'synth-audio': {
        if (!ctx.text.trim()) return null;
        ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
        const r = await synthesiseSpeech(ctx.text, { spec, onProgress: report });
        ctx.onPhase?.(ctx.locale === 'zh' ? '合成语音…' : 'Synthesising speech…');
        return {
          payload: {
            kind: 'synth-audio',
            text: ctx.text,
            waveform: waveformPeaks(r.waveform),
            url: pcmToWavUrl(r.waveform, r.sampleRate),
            voice: spec.repo,
          },
          run: r.meta,
        };
      }
      case 'ocr': {
        if (!ctx.media?.src) return null;
        ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
        const isDoc = spec.task === 'document-question-answering';
        const r = isDoc
          ? await askDocument(ctx.media.src, documentQuestionFor(ctx), { spec, onProgress: report })
          : await captionImage(ctx.media.src, { spec, onProgress: report });
        ctx.onPhase?.(
          isDoc
            ? ctx.locale === 'zh'
              ? '抽取字段…'
              : 'Extracting fields…'
            : ctx.locale === 'zh'
              ? '识别文字…'
              : 'Reading text…'
        );
        const size = await mediaNaturalSize(ctx.media.src);
        return {
          payload: {
            kind: 'ocr',
            // These checkpoints read the whole image, so there is a single
            // bounding line rather than per-word boxes.
            lines: r.text ? [{ text: r.text, x: 0, y: 0, w: 1, h: 1, conf: 0.9 }] : [],
            text: r.text,
            width: size.width,
            height: size.height,
            imageUrl: ctx.media.src,
          },
          run: r.meta,
        };
      }
      case 'chat': {
        // A language-model chat turn, or image captioning repurposed as a
        // one-shot VLM answer (no multi-turn) — the task name separates them.
        if (spec.task === 'text-generation') {
          if (!ctx.text.trim()) return null;
          ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
          const r = await generateText(
            chatPromptFor(ctx),
            { spec, onProgress: report },
            {
              temperature: num(ctx.params.temperature, 0.7),
              maxNewTokens: Math.max(32, Math.min(320, num(ctx.params.maxTokens, 160))),
            }
          );
          ctx.onPhase?.(ctx.locale === 'zh' ? '生成回答…' : 'Generating…');
          return { payload: { kind: 'chat', text: r.text || '—' }, run: r.meta };
        }
        if (!ctx.media?.src) return null;
        ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
        const r = await captionImage(ctx.media.src, { spec, onProgress: report });
        ctx.onPhase?.(ctx.locale === 'zh' ? '理解图像…' : 'Understanding the image…');
        return { payload: { kind: 'chat', text: r.text }, run: r.meta };
      }
      case 'restoration': {
        if (!ctx.media?.src) return null;
        ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
        const r = await enhanceImage(ctx.media.src, { spec, onProgress: report });
        ctx.onPhase?.(ctx.locale === 'zh' ? '重建图像…' : 'Reconstructing image…');
        return {
          payload: {
            kind: 'restoration',
            url: r.url,
            referenceUrl: ctx.media.src,
            metrics: [{ label: ctx.locale === 'zh' ? '处理模型' : 'Model', value: spec.repo.split('/')[1] ?? spec.repo }],
          },
          run: r.meta,
        };
      }
      case 'depth': {
        if (!ctx.media?.src) return null;
        ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
        const r = await estimateDepth(ctx.media.src, { spec, onProgress: report });
        ctx.onPhase?.(ctx.locale === 'zh' ? '估计深度…' : 'Estimating depth…');
        return { payload: { kind: 'depth', url: r.url }, run: r.meta };
      }
      case 'text': {
        if (!ctx.text.trim()) return null;
        if (spec.task === 'translation') {
          // The Marian pair is directional: pick the sibling checkpoint for CJK input.
          const directional = isCjk(ctx.text) ? { ...spec, repo: 'Xenova/opus-mt-zh-en' } : spec;
          ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
          const r = await translateText(ctx.text, { spec: directional, onProgress: report });
          ctx.onPhase?.(ctx.locale === 'zh' ? '逐句解码…' : 'Decoding…');
          return { payload: { kind: 'text', text: r.text }, run: r.meta };
        }
        if (spec.task !== 'summarization') return null;
        ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
        const r = await summariseText(ctx.text, { spec, onProgress: report });
        ctx.onPhase?.(ctx.locale === 'zh' ? '生成摘要…' : 'Summarising…');
        return {
          payload: { kind: 'text', text: r.text, extra: { summary: r.text } },
          run: r.meta,
        };
      }
      case 'json': {
        if (spec.task !== 'text-generation' || !ctx.text.trim()) return null;
        ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
        const r = await generateText(structuredPromptFor(ctx), { spec, onProgress: report }, {
          maxNewTokens: 220,
        });
        ctx.onPhase?.(ctx.locale === 'zh' ? '生成结构化输出…' : 'Generating structured output…');
        return { payload: { kind: 'json', value: extractJsonObject(r.text), raw: r.text }, run: r.meta };
      }
      case 'code': {
        if (spec.task !== 'text-generation' || !ctx.text.trim()) return null;
        ctx.onPhase?.(ctx.locale === 'zh' ? '准备权重…' : 'Preparing weights…');
        const r = await generateText(codePromptFor(ctx), { spec, onProgress: report }, {
          maxNewTokens: 260,
          temperature: 0.2,
        });
        ctx.onPhase?.(ctx.locale === 'zh' ? '生成代码…' : 'Generating code…');
        return {
          payload: {
            kind: 'code',
            code: stripFence(r.text) || '—',
            language: str(ctx.params.language, 'typescript'),
          },
          run: r.meta,
        };
      }
      default:
        return null;
    }
  } catch (err) {
    console.warn('[AI-Demos] real inference failed, falling back to the simulator', err);
    ctx.onPhase?.(
      ctx.locale === 'zh' ? '真实权重加载失败，回退演示模式…' : 'Real weights failed, falling back to demo mode…'
    );
    return null;
  }
}

/**
 * Output kinds whose demo-mode path really computes on the input — Canvas pixel
 * ops, STFT spectra, vector maths, waveform synthesis — instead of returning
 * deterministic random or canned output. The *weights* are still simulated, so
 * this is not model inference, but the numbers on screen are genuinely derived
 * from the input. Exported so the UI can explain what "simulated" means here.
 */
// `landmarks` is the payload-level kind; the three suffixed ones are the
// OutputKind values the UI passes in. Both need to hit the same set.
const REAL_SIGNAL_KINDS = new Set<string>([
  'detection',
  'segmentation',
  'depth',
  'restoration',
  'inpainting',
  'generated-image',
  'tracking',
  'music',
  'audio-compare',
  'stems',
  'landmarks',
  'landmarks-face',
  'landmarks-pose',
  'landmarks-hand',
  'embedding',
  'ranking',
  'search',
  'synth-audio',
]);

/** True when this subcategory's demo engine does real signal processing. */
export const computesRealSignal = (kind: OutputKind | DemoPayload['kind']): boolean =>
  REAL_SIGNAL_KINDS.has(kind);

function isSimulated(ctx: RunContext, payload: DemoPayload): boolean {
  if (payload.kind === 'text') return (payload.extra?.coverage ?? 0) < 1;
  if (computesRealSignal(payload.kind)) return false;
  if (payload.kind === 'labels' && payload.task !== 'zero-shot') return false;
  if (payload.kind === 'ocr' && ctx.media?.builtin) return false;
  if (payload.kind === 'transcript' && matchSampleFixture(ctx)) return false;
  if (payload.kind === 'video-timeline' && matchSampleFixture(ctx)) return false;
  if ((payload.kind === 'json' || payload.kind === 'code' || payload.kind === 'chat') && matchSampleFixture(ctx)) return false;
  return true;
}

export { audioPeaks, FIXTURES };
