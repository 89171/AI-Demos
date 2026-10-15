/**
 * Real client-side inference on top of Transformers.js.
 *
 * Everything here is lazy: the runtime (~30 MB of ESM) is imported on the first
 * run, and each checkpoint is downloaded once per (repo, dtype, device) and then
 * kept in an in-memory Map, while the files themselves live in the browser
 * Cache Storage — so a second visit to the same model costs nothing.
 *
 * Nothing in this module is touched unless a catalogue entry has a matching
 * `REAL_MODELS` specification, which keeps every other subcategory offline.
 */
import type { RealModelSpec } from '../data/real-models';

export interface ProgressInfo {
  /** accumulated bytes downloaded so far for this pipeline */
  loaded: number;
  total: number;
  file?: string;
  /** 0..1 */
  ratio: number;
}

export interface LoadedRun {
  /** Execute this pipeline. Options vary per task (object, label array, string). */
  call: (input: unknown, ...args: unknown[]) => Promise<unknown>;
  repo: string;
  dtype: string;
  device: string;
  /** bytes actually downloaded during this load (0 when served from cache) */
  bytes: number;
}

type Pipe = (input: unknown, ...args: any[]) => Promise<unknown>;

type Runtime = any;

let runtimePromise: Promise<Runtime> | null = null;
const pipelineCache = new Map<string, Promise<LoadedRun>>();

async function importRuntime(): Promise<Runtime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const mod = await import('@huggingface/transformers');
      const env = mod.env;
      env.allowLocalModels = false;
      // Prefer the vendored binaries in /public/ort (copied by scripts/copy-ort-wasm.cjs)
      // so the page works without a CDN once the weights are cached.
      try {
        const head = await fetch('/ort/ort-wasm-simd-threaded.jsep.mjs', { method: 'HEAD' });
        if (head.ok && env.backends?.onnx?.wasm) env.backends.onnx.wasm.wasmPaths = '/ort/';
      } catch {
        /* fall through to the default CDN paths */
      }
      return mod;
    })();
  }
  return runtimePromise;
}

const prefersWebGPU = () => typeof navigator !== 'undefined' && !!(navigator as { gpu?: unknown }).gpu;

export interface LoadOptions {
  spec: RealModelSpec;
  onProgress?: (p: ProgressInfo) => void;
  /** force WASM (used after a WebGPU failure) */
  forceDevice?: string;
  /** confidence threshold for object detection */
  threshold?: number;
  /**
   * Forced source language for ASR. Whisper defaults to English decoding when
   * this is unset, which silently mangles non-English audio.
   */
  language?: string;
}

async function loadPipeline({ spec, onProgress, forceDevice }: LoadOptions): Promise<LoadedRun> {
  const mod = await importRuntime();
  const device = forceDevice ?? (prefersWebGPU() ? 'webgpu' : 'wasm');
  const key = `${spec.task}|${spec.repo}|${spec.dtype}|${device}`;
  const cached = pipelineCache.get(key);
  if (cached) {
    // Report 0 bytes: nothing was fetched on this run, the session is reused.
    return { ...(await cached), bytes: 0 };
  }

  const job = (async (): Promise<LoadedRun> => {
    let loaded = 0;
    let total = 0;
    let lastFile: string | undefined;
    const progress_callback = (e: {
      status?: string;
      file?: string;
      name?: string;
      loaded?: number;
      total?: number;
      progress?: number;
    }) => {
      if (e.file && e.file !== lastFile) lastFile = e.file;
      if (e.status === 'progress' && typeof e.loaded === 'number' && typeof e.total === 'number') {
        loaded = Math.max(loaded, e.loaded);
        total = Math.max(total, e.total);
        onProgress?.({ loaded, total, file: lastFile, ratio: total ? loaded / total : 0 });
      }
    };
    const pipe: Pipe = spec.repo === 'briaai/RMBG-1.4' ? await loadRmbg(mod, spec, device, progress_callback) : await mod.pipeline(spec.task, spec.repo, {
      dtype: spec.dtype,
      device,
      progress_callback,
    } as any);
    return {
      call: (input: unknown, ...args: unknown[]) => pipe(input, ...(args.length ? args : [{}])) as Promise<unknown>,
      repo: spec.repo,
      dtype: spec.dtype,
      device,
      bytes: loaded,
    };
  })();

  pipelineCache.set(key, job);
  try {
    return await job;
  } catch (err) {
    pipelineCache.delete(key);
    throw err;
  }
}

/**
 * RMBG-1.4 ships a custom `BriaRMBG` architecture that the generic background-removal pipeline
 * cannot resolve (it falls through to SegformerForSemanticSegmentation), so load it as a raw model
 * with the preprocessing from its model card and rebuild the RGBA cut-out ourselves.
 */
async function loadRmbg(mod: Runtime, spec: RealModelSpec, device: string, progress_callback: (e: never) => void): Promise<Pipe> {
  const model = await mod.AutoModel.from_pretrained(spec.repo, { config: { model_type: 'custom' }, dtype: spec.dtype, device, progress_callback });
  const processor = await mod.AutoProcessor.from_pretrained(spec.repo, {
    config: {
      do_normalize: true,
      do_pad: false,
      do_rescale: true,
      do_resize: true,
      image_mean: [0.5, 0.5, 0.5],
      feature_extractor_type: 'ImageFeatureExtractor',
      image_std: [1, 1, 1],
      resample: 2,
      rescale_factor: 1 / 255,
      size: { width: 1024, height: 1024 },
    },
  });
  return async (src: unknown) => {
    const image = await mod.RawImage.read(src as string);
    const { pixel_values } = await processor(image);
    const { output } = await model({ input: pixel_values });
    const mask = await mod.RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width, image.height);
    const cut = image.clone();
    cut.putAlpha(mask);
    return cut;
  };
}

/** Load a real pipeline, falling back to WASM when WebGPU is unavailable or broken. */
export async function getRun(opts: LoadOptions): Promise<LoadedRun> {
  try {
    return await loadPipeline(opts);
  } catch (err) {
    if (!opts.forceDevice && prefersWebGPU()) {
      return loadPipeline({ ...opts, forceDevice: 'wasm' });
    }
    throw err;
  }
}

/** Forget every cached pipeline (used by the UI when the user wants a cold start). */
export function clearRuntimeCache() {
  pipelineCache.clear();
}

/* --------------------------------------------------------------- task helpers */

const COCO_ZH: Record<string, string> = {
  person: '人',
  bicycle: '自行车',
  car: '汽车',
  motorcycle: '摩托车',
  airplane: '飞机',
  bus: '公交车',
  train: '火车',
  truck: '卡车',
  boat: '船',
  'traffic light': '红绿灯',
  'fire hydrant': '消防栓',
  'stop sign': '停止标志',
  'parking meter': '停车计时器',
  bench: '长椅',
  bird: '鸟',
  cat: '猫',
  dog: '狗',
  horse: '马',
  sheep: '羊',
  cow: '牛',
  elephant: '大象',
  bear: '熊',
  zebra: '斑马',
  giraffe: '长颈鹿',
  backpack: '背包',
  umbrella: '雨伞',
  handbag: '手提包',
  tie: '领带',
  suitcase: '行李箱',
  frisbee: '飞盘',
  skis: '滑雪板',
  snowboard: '单板',
  'sports ball': '球',
  kite: '风筝',
  'baseball bat': '棒球棍',
  'baseball glove': '棒球手套',
  skateboard: '滑板',
  surfboard: '冲浪板',
  'tennis racket': '网球拍',
  bottle: '瓶子',
  'wine glass': '酒杯',
  cup: '杯子',
  fork: '叉子',
  knife: '刀',
  spoon: '勺子',
  bowl: '碗',
  banana: '香蕉',
  apple: '苹果',
  sandwich: '三明治',
  orange: '橙子',
  broccoli: '西兰花',
  carrot: '胡萝卜',
  'hot dog': '热狗',
  pizza: '披萨',
  donut: '甜甜圈',
  cake: '蛋糕',
  chair: '椅子',
  couch: '沙发',
  'potted plant': '盆栽',
  bed: '床',
  'dining table': '餐桌',
  toilet: '马桶',
  tv: '电视',
  laptop: '笔记本电脑',
  mouse: '鼠标',
  remote: '遥控器',
  keyboard: '键盘',
  'cell phone': '手机',
  microwave: '微波炉',
  oven: '烤箱',
  toaster: '烤面包机',
  sink: '水槽',
  refrigerator: '冰箱',
  book: '书',
  clock: '时钟',
  vase: '花瓶',
  scissors: '剪刀',
  'teddy bear': '泰迪熊',
  'hair drier': '吹风机',
  toothbrush: '牙刷',
};

export const cocoLabel = (en: string, locale: 'zh' | 'en') => (locale === 'zh' ? COCO_ZH[en] ?? en : en);

/** Mean-pooled, L2-normalised sentence embeddings for every line. */
export async function embedLines(
  lines: string[],
  opts: LoadOptions
): Promise<{ vectors: number[][]; meta: LoadedRun }> {
  const run = await getRun(opts);
  const out = (await run.call(lines, { pooling: 'mean', normalize: true })) as {
    dims: number[];
    data: Float32Array | number[];
  };
  const [n, dim] = out.dims.length === 2 ? out.dims : [lines.length, out.dims[out.dims.length - 1]];
  const flat = Array.from(out.data as ArrayLike<number>);
  const vectors: number[][] = [];
  for (let i = 0; i < n; i++) {
    const v = flat.slice(i * dim, (i + 1) * dim);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    vectors.push(v.map((x) => x / norm));
  }
  return { vectors, meta: run };
}

export interface DetectedBox {
  label: string;
  labelEn: string;
  score: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function detectObjects(
  imageSrc: string,
  locale: 'zh' | 'en',
  opts: LoadOptions
): Promise<{ boxes: DetectedBox[]; width: number; height: number; meta: LoadedRun }> {
  const run = await getRun(opts);
  const threshold = opts.threshold ?? 0.4;
  const raw = (await run.call(imageSrc, { threshold })) as {
    score: number;
    label: string;
    box: { xmin: number; ymin: number; xmax: number; ymax: number };
  }[];
  const size = await naturalSize(imageSrc);
  const boxes: DetectedBox[] = raw.map((d) => ({
    label: cocoLabel(d.label, locale),
    labelEn: d.label,
    score: Math.round(d.score * 1000) / 1000,
    x: clamp01((d.box.xmin / size.width) * 1),
    y: clamp01(d.box.ymin / size.height),
    w: clamp01((d.box.xmax - d.box.xmin) / size.width),
    h: clamp01((d.box.ymax - d.box.ymin) / size.height),
  }));
  return { boxes, width: size.width, height: size.height, meta: run };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

async function naturalSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = src;
  });
}

export interface TranscribedSegment {
  start: number;
  end: number;
  text: string;
}

/** Whisper-style transcription with optional per-chunk timestamps. */
export async function transcribeAudio(
  audioSrc: string,
  opts: LoadOptions
): Promise<{ text: string; segments: TranscribedSegment[]; meta: LoadedRun }> {
  const run = await getRun(opts);
  // Whisper decodes as English unless told otherwise, so always pass a language.
  const out = (await run.call(audioSrc, {
    return_timestamps: true,
    ...(opts.language ? { language: opts.language, task: 'transcribe' } : {}),
  })) as {
    text?: string;
    chunks?: { timestamp: [number, number | null]; text: string }[];
  };
  const segments: TranscribedSegment[] = (out.chunks ?? []).map((c) => ({
    start: Math.round((c.timestamp?.[0] ?? 0) * 100) / 100,
    end: Math.round((c.timestamp?.[1] ?? 0) * 100) / 100,
    text: c.text.trim(),
  }));
  return { text: (out.text ?? '').trim(), segments, meta: run };
}

/** Text-to-speech: returns the raw waveform plus its sample rate. */
export async function synthesiseSpeech(
  text: string,
  opts: LoadOptions
): Promise<{ waveform: Float32Array; sampleRate: number; meta: LoadedRun }> {
  const run = await getRun(opts);
  // Both TTS families are conditioned on a speaker vector: the stock CMU-Arctic x-vector for SpeechT5, voice F1 for Supertonic.
  const options = opts.spec.repo.includes('speecht5')
    ? { speaker_embeddings: 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin' }
    : opts.spec.repo.includes('Supertonic')
      ? { speaker_embeddings: 'https://huggingface.co/onnx-community/Supertonic-TTS-ONNX/resolve/main/voices/F1.bin' }
      : undefined;
  const out = (await run.call(text, options)) as { audio?: Float32Array | number[]; sampling_rate?: number };
  const raw = out.audio;
  const waveform = raw instanceof Float32Array ? raw : new Float32Array(Array.from(raw ?? []));
  return { waveform, sampleRate: out.sampling_rate ?? 16000, meta: run };
}

/** Image captioning / OCR-style image reading via an image-to-text checkpoint. */
export async function captionImage(
  imageSrc: string,
  opts: LoadOptions
): Promise<{ text: string; meta: LoadedRun }> {
  const run = await getRun(opts);
  const out = (await run.call(imageSrc)) as { generated_text?: string }[] | { generated_text?: string };
  const list = Array.isArray(out) ? out : [out];
  return { text: (list[0]?.generated_text ?? '').trim(), meta: run };
}

/** Abstractive summarisation. */
export async function summariseText(
  text: string,
  opts: LoadOptions
): Promise<{ text: string; meta: LoadedRun }> {
  const run = await getRun(opts);
  const max = Math.max(24, Math.min(180, Math.round(text.length / 3)));
  const out = (await run.call(text, { max_new_tokens: max })) as
    | { summary_text?: string }[]
    | { summary_text?: string };
  const list = Array.isArray(out) ? out : [out];
  return { text: (list[0]?.summary_text ?? '').trim(), meta: run };
}

/**
 * Convert whatever a vision pipeline hands back into a data URL the UI can render.
 * RawImage exposes different helpers across versions — and on the web its
 * `toCanvas()` returns an OffscreenCanvas, which has no `toDataURL`.
 */
async function toDataUrl(image: unknown): Promise<string> {
  const img = image as {
    toDataURL?: () => string | Promise<string>;
    toCanvas?: () => HTMLCanvasElement | OffscreenCanvas;
  };
  if (typeof img?.toDataURL === 'function') return img.toDataURL();
  if (typeof img?.toCanvas === 'function') {
    const canvas = img.toCanvas();
    if (typeof (canvas as HTMLCanvasElement).toDataURL === 'function') {
      return (canvas as HTMLCanvasElement).toDataURL('image/png');
    }
    const dom = document.createElement('canvas');
    dom.width = canvas.width;
    dom.height = canvas.height;
    dom.getContext('2d')?.drawImage(canvas as unknown as CanvasImageSource, 0, 0);
    return dom.toDataURL('image/png');
  }
  throw new Error('vision pipeline returned an image that cannot be serialised');
}

/** Image-to-image tasks such as super-resolution. */
export async function enhanceImage(
  imageSrc: string,
  opts: LoadOptions
): Promise<{ url: string; meta: LoadedRun }> {
  const run = await getRun(opts);
  const out = await run.call(imageSrc);
  return { url: await toDataUrl(out), meta: run };
}

/** Monocular depth estimation: returns the greyscale depth map. */
export async function estimateDepth(
  imageSrc: string,
  opts: LoadOptions
): Promise<{ url: string; meta: LoadedRun }> {
  const run = await getRun(opts);
  const out = (await run.call(imageSrc)) as { depth?: unknown; predicted_depth?: unknown };
  return { url: await toDataUrl(out.depth ?? out.predicted_depth), meta: run };
}

export async function classifyText(
  text: string,
  opts: LoadOptions
): Promise<{ labels: { label: string; score: number }[]; meta: LoadedRun }> {
  const run = await getRun(opts);
  const multiLabel = opts.spec.repo.includes('toxic');
  const out = (await run.call(text, multiLabel ? { topk: null } : { topk: 5 })) as
    | { label: string; score: number }[]
    | { label: string; score: number };
  const list = Array.isArray(out) ? out : [out];
  return {
    labels: list.map((x) => ({ label: x.label, score: Math.round(x.score * 1000) / 1000 })),
    meta: run,
  };
}

/* ------------------------------------------------------- cross-encoder rerank */

/**
 * Reduce whatever label/score shape the classifier returns into one relevance
 * number. Cross-encoders emit either a positive-class entry or a two-label pair.
 */
function pickPositiveScore(entry: unknown): number {
  const list = Array.isArray(entry) ? entry : [entry];
  const positive = list.find((x) =>
    /label_1|positive|entail|relevant|yes/i.test(String((x as { label?: string })?.label ?? ''))
  );
  const chosen = (positive ?? list[0]) as { score?: number } | undefined;
  return Number(chosen?.score ?? 0);
}

/** Relevance score for every (query, candidate) pair via a cross-encoder. */
export async function scorePairs(
  query: string,
  docs: string[],
  opts: LoadOptions
): Promise<{ scores: number[]; meta: LoadedRun }> {
  const run = await getRun(opts);
  let scores: number[] = [];
  try {
    const out = (await run.call(query, { text_pair: docs })) as unknown;
    const entries = Array.isArray(out) ? out : [out];
    scores = entries.map((e) => pickPositiveScore(e));
  } catch {
    scores = [];
  }
  if (scores.length !== docs.length) {
    // Some builds only accept one pair per call — score them individually.
    scores = [];
    for (const doc of docs) {
      const out = (await run.call(query, { text_pair: doc })) as unknown;
      scores.push(pickPositiveScore(out));
    }
  }
  return { scores, meta: run };
}

/** Cosine ranking of a corpus against a query using a bi-encoder. */
export async function rankByEmbedding(
  query: string,
  docs: string[],
  opts: LoadOptions
): Promise<{ scores: number[]; meta: LoadedRun }> {
  const { vectors, meta } = await embedLines([query, ...docs], opts);
  const q = vectors[0] ?? [];
  const scores = vectors.slice(1).map((v) => {
    let dot = 0;
    for (let i = 0; i < q.length; i++) dot += q[i] * v[i];
    return Math.round(((dot + 1) / 2) * 1000) / 1000;
  });
  return { scores, meta };
}

/* -------------------------------------------------------------- translation */

/** Sequence-to-sequence translation (Marian / NLLB style). */
export async function translateText(
  text: string,
  opts: LoadOptions
): Promise<{ text: string; meta: LoadedRun }> {
  const run = await getRun(opts);
  const max = Math.min(256, Math.max(48, Math.round(text.length * 1.6)));
  const out = (await run.call(text, { max_new_tokens: max })) as
    | { translation_text?: string }[]
    | { translation_text?: string };
  const list = Array.isArray(out) ? out : [out];
  return { text: (list[0]?.translation_text ?? '').trim(), meta: run };
}

/* ------------------------------------------------------- zero-shot scoring */

/** Text zero-shot classification against free-form candidate labels. */
export async function zeroShotClassifyText(
  text: string,
  labels: string[],
  opts: LoadOptions
): Promise<{ labels: { label: string; score: number }[]; meta: LoadedRun }> {
  const run = await getRun(opts);
  const out = (await run.call(text, labels)) as
    | { labels?: string[]; scores?: number[] }[]
    | { labels?: string[]; scores?: number[] };
  const first = Array.isArray(out) ? out[0] : out;
  const names = first?.labels ?? [];
  const scores = first?.scores ?? [];
  return {
    labels: names.map((label, i) => ({ label, score: Math.round((scores[i] ?? 0) * 1000) / 1000 })),
    meta: run,
  };
}

/** Image zero-shot classification (CLIP / SigLIP / MobileCLIP). */
export async function zeroShotClassifyImage(
  imageSrc: string,
  labels: string[],
  opts: LoadOptions
): Promise<{ labels: { label: string; score: number }[]; meta: LoadedRun }> {
  const run = await getRun(opts);
  const out = (await run.call(imageSrc, labels)) as
    | { label: string; score: number }[]
    | { label: string; score: number };
  const list = Array.isArray(out) ? out : [out];
  return {
    labels: list.map((x) => ({ label: x.label, score: Math.round(x.score * 1000) / 1000 })),
    meta: run,
  };
}

/** Document question answering (Donut-style, answers read straight off the page). */
export async function askDocument(
  imageSrc: string,
  question: string,
  opts: LoadOptions
): Promise<{ text: string; meta: LoadedRun }> {
  const run = await getRun(opts);
  const out = (await run.call(imageSrc, question)) as
    | { answer?: string }[]
    | { answer?: string };
  const list = Array.isArray(out) ? out : [out];
  return { text: (list[0]?.answer ?? '').trim(), meta: run };
}

/* ------------------------------------------------------- token generation */

/** Autoregressive text generation for the small chat / code checkpoints. */
export async function generateText(
  prompt: string,
  opts: LoadOptions,
  gen: { maxNewTokens?: number; temperature?: number } = {}
): Promise<{ text: string; meta: LoadedRun }> {
  const run = await getRun(opts);
  const greedy = !gen.temperature;
  const out = (await run.call(prompt, {
    max_new_tokens: gen.maxNewTokens ?? 160,
    do_sample: !greedy,
    ...(greedy ? {} : { temperature: gen.temperature }),
    repetition_penalty: 1.1,
  })) as { generated_text?: string }[] | { generated_text?: string };
  const list = Array.isArray(out) ? out : [out];
  const raw = list[0]?.generated_text ?? '';
  // The text-generation pipeline echoes the prompt back on the first result.
  const text = raw.startsWith(prompt) ? raw.slice(prompt.length) : raw;
  return { text: text.trim(), meta: run };
}

/* --------------------------------------------- pixel-space segmentation */

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  return canvas;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image could not be decoded'));
    img.src = src;
  });
}

async function toCanvas(image: unknown): Promise<HTMLCanvasElement | null> {
  const maybe = image as { toCanvas?: () => HTMLCanvasElement | OffscreenCanvas };
  if (typeof maybe?.toCanvas === 'function') {
    const raw = maybe.toCanvas();
    const dom = document.createElement('canvas');
    dom.width = raw.width;
    dom.height = raw.height;
    dom.getContext('2d')?.drawImage(raw as unknown as CanvasImageSource, 0, 0);
    return dom;
  }
  try {
    const url = await toDataUrl(image);
    const el = await loadImage(url);
    const canvas = createCanvas(el.naturalWidth, el.naturalHeight);
    canvas.getContext('2d')?.drawImage(el, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}

/** Share of pixels the model kept as foreground (alpha > 0.5). */
async function alphaCoverage(url: string): Promise<number> {
  const img = await loadImage(url);
  const canvas = createCanvas(img.naturalWidth, img.naturalHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let hits = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 127) hits++;
  return Math.round((hits / (canvas.width * canvas.height)) * 1000) / 1000;
}

/** Background removal: the model predicts a per-pixel alpha matte. */
export async function cutForeground(
  imageSrc: string,
  opts: LoadOptions
): Promise<{ url: string; coverage: number; meta: LoadedRun }> {
  const run = await getRun(opts);
  const out = await run.call(imageSrc);
  const url = await toDataUrl(out);
  return { url, coverage: await alphaCoverage(url), meta: run };
}

const SEG_PALETTE = ['#4f8ef7', '#f2994a', '#27ae60', '#eb5757', '#9b51e0', '#2d9cdb', '#e8c547'];

const hexToRgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Semantic segmentation: colour every predicted region over the source image. */
export async function semanticSegment(
  imageSrc: string,
  opts: LoadOptions
): Promise<{ url: string; coverage: number; meta: LoadedRun }> {
  const run = await getRun(opts);
  const raw = (await run.call(imageSrc)) as
    | { mask?: unknown; label?: string; score?: number }[]
    | { mask?: unknown };
  const list = Array.isArray(raw) ? raw : [raw];

  const base = await loadImage(imageSrc);
  const width = base.naturalWidth;
  const height = base.naturalHeight;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  ctx.drawImage(base, 0, 0);

  let largest = 0;
  for (let i = 0; i < list.length; i++) {
    const maskCanvas = await toCanvas(list[i]?.mask);
    if (!maskCanvas) continue;
    const overlay = createCanvas(width, height);
    const octx = overlay.getContext('2d');
    if (!octx) continue;
    octx.drawImage(maskCanvas, 0, 0, width, height);
    const frame = octx.getImageData(0, 0, width, height);
    const [r, g, b] = hexToRgb(SEG_PALETTE[i % SEG_PALETTE.length]);
    let hits = 0;
    for (let p = 0; p < frame.data.length; p += 4) {
      const on = frame.data[p] > 127;
      if (!on) {
        frame.data[p + 3] = 0;
        continue;
      }
      hits++;
      frame.data[p] = r;
      frame.data[p + 1] = g;
      frame.data[p + 2] = b;
      frame.data[p + 3] = 110;
    }
    largest = Math.max(largest, hits / (width * height));
    octx.putImageData(frame, 0, 0);
    ctx.drawImage(overlay, 0, 0);
  }
  return {
    url: canvas.toDataURL('image/png'),
    coverage: Math.round(largest * 1000) / 1000,
    meta: run,
  };
}

/* ------------------------------------------------- token / span / class tasks */

const CJK = /[\u3400-\u9fff]/;

export interface Entity {
  text: string;
  type: string;
  score: number;
}

/** BIO token tags → whole entities (sub-word pieces and adjacent I- tags merge). */
export async function tagEntities(
  text: string,
  opts: LoadOptions
): Promise<{ entities: Entity[]; meta: LoadedRun }> {
  const run = await getRun(opts);
  const raw = (await run.call(text, { ignore_labels: ['O'] })) as {
    entity: string;
    score: number;
    word: string;
    index: number;
  }[];
  const out: (Entity & { last: number; n: number })[] = [];
  for (const t of raw) {
    const type = t.entity.replace(/^[BI]-/, '');
    const sub = t.word.startsWith('##');
    const word = t.word.replace(/^##/, '');
    const prev = out[out.length - 1];
    const joins = prev && t.index === prev.last + 1 && (sub || (t.entity.startsWith('I-') && prev.type === type));
    if (joins) {
      const glue = sub || CJK.test(word) || CJK.test(prev.text.slice(-1)) ? '' : ' ';
      prev.text += glue + word;
      prev.score += t.score;
      prev.n++;
      prev.last = t.index;
    } else {
      out.push({ text: word, type, score: t.score, last: t.index, n: 1 });
    }
  }
  return {
    entities: out.map((e) => ({ text: e.text, type: e.type, score: Math.round((e.score / e.n) * 1000) / 1000 })),
    meta: run,
  };
}

export async function answerQuestion(
  question: string,
  context: string,
  opts: LoadOptions
): Promise<{ answer: string; score: number; meta: LoadedRun }> {
  const run = await getRun(opts);
  const out = (await run.call(question, context)) as { answer?: string; score?: number } | { answer?: string; score?: number }[];
  const best = Array.isArray(out) ? out[0] : out;
  return { answer: (best?.answer ?? '').trim(), score: Math.round((best?.score ?? 0) * 1000) / 1000, meta: run };
}

/** Image or audio classification: top-k labels. */
export async function classifyMedia(
  src: string,
  topK: number,
  opts: LoadOptions
): Promise<{ labels: { label: string; score: number }[]; meta: LoadedRun }> {
  const run = await getRun(opts);
  const out = (await run.call(src, { top_k: topK })) as { label: string; score: number }[];
  return { labels: out.map((x) => ({ label: x.label, score: Math.round(x.score * 1000) / 1000 })), meta: run };
}

/** Open-vocabulary detection: boxes for whatever the text queries describe. */
export async function detectZeroShot(
  imageSrc: string,
  queries: string[],
  threshold: number,
  opts: LoadOptions
): Promise<{ boxes: DetectedBox[]; width: number; height: number; meta: LoadedRun }> {
  const run = await getRun(opts);
  const raw = (await run.call(imageSrc, queries, { threshold })) as {
    score: number;
    label: string;
    box: { xmin: number; ymin: number; xmax: number; ymax: number };
  }[];
  const size = await naturalSize(imageSrc);
  const boxes: DetectedBox[] = raw.map((d) => ({
    label: d.label,
    labelEn: d.label,
    score: Math.round(d.score * 1000) / 1000,
    x: clamp01(d.box.xmin / size.width),
    y: clamp01(d.box.ymin / size.height),
    w: clamp01((d.box.xmax - d.box.xmin) / size.width),
    h: clamp01((d.box.ymax - d.box.ymin) / size.height),
  }));
  return { boxes, width: size.width, height: size.height, meta: run };
}
