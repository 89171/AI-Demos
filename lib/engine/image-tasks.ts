/** Canvas-based image tasks. All of these run real pixel operations in the browser. */
import { fnv1a, mulberry32, clamp } from './random';

export interface Box {
  label: string;
  labelEn: string;
  score: number;
  /** normalised 0..1 */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
  score?: number;
}

export interface GroundTruth {
  type: string;
  objects?: { label: string; labelEn: string; x: number; y: number; w: number; h: number }[];
  lines?: { text: string; x: number; y: number; w: number; h: number }[];
  text?: string;
  fields?: Record<string, unknown>;
  masks?: { x: number; y: number; w: number; h: number }[];
  reference?: string;
  width?: number;
  height?: number;
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('image load failed'));
    el.src = src;
  });
}

export function toCanvas(img: HTMLImageElement | HTMLVideoElement, maxSide = 720): HTMLCanvasElement {
  const w = 'videoWidth' in img ? img.videoWidth : img.naturalWidth;
  const h = 'videoHeight' in img ? img.videoHeight : img.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(w || 1, h || 1));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round((w || 1) * scale));
  c.height = Math.max(1, Math.round((h || 1) * scale));
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img as CanvasImageSource, 0, 0, c.width, c.height);
  return c;
}

function ctxOf(c: HTMLCanvasElement): CanvasRenderingContext2D {
  return c.getContext('2d', { willReadFrequently: true })!;
}

/* ------------------------------------------------------------------ detection */

/** Saliency proposals: local edge density peaks, merged into boxes. */
export function detectHeuristic(canvas: HTMLCanvasElement, modelSeed: string, conf: number): Box[] {
  const ctx = ctxOf(canvas);
  const { width: W, height: H } = canvas;
  const data = ctx.getImageData(0, 0, W, H).data;
  const cells = 24;
  const cw = W / cells;
  const ch = H / cells;
  const energy = new Float32Array(cells * cells);
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    lum[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;
  }
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = lum[i + 1] - lum[i - 1];
      const gy = lum[i + W] - lum[i - W];
      const g = Math.abs(gx) + Math.abs(gy);
      const cx = Math.min(cells - 1, Math.floor(x / cw));
      const cy = Math.min(cells - 1, Math.floor(y / ch));
      energy[cy * cells + cx] += g;
    }
  }
  const sorted = [...energy.keys()].sort((a, b) => energy[b] - energy[a]);
  const rng = mulberry32(fnv1a(`${modelSeed}:detect`));
  const boxes: Box[] = [];
  const taken: { x: number; y: number; r: number }[] = [];
  for (const idx of sorted) {
    if (boxes.length >= 6) break;
    if (energy[idx] < 6) break;
    const cx = idx % cells;
    const cy = Math.floor(idx / cells);
    const px = (cx + 0.5) * cw;
    const py = (cy + 0.5) * ch;
    if (taken.some((t) => Math.hypot(t.x - px, t.y - py) < Math.max(cw, ch) * 1.6)) continue;
    taken.push({ x: px, y: py, r: 1 });
    const bw = cw * (2.2 + rng() * 1.6);
    const bh = ch * (2.2 + rng() * 1.6);
    boxes.push({
      label: '物体',
      labelEn: 'object',
      score: clamp(0.42 + 0.5 * (energy[idx] / (energy[sorted[0]] || 1)) * (0.85 + rng() * 0.3), 0, 0.99),
      x: clamp((px - bw / 2) / W, 0, 1),
      y: clamp((py - bh / 2) / H, 0, 1),
      w: clamp(bw / W, 0.05, 1),
      h: clamp(bh / H, 0.05, 1),
    });
  }
  return boxes.filter((b) => b.score >= conf);
}

export function detectFromTruth(truth: GroundTruth, modelSeed: string, conf: number): Box[] {
  const rng = mulberry32(fnv1a(`${modelSeed}:truth`));
  return (truth.objects ?? [])
    .map((o) => ({
      label: o.label,
      labelEn: o.labelEn,
      score: clamp(0.72 + rng() * 0.27, 0, 0.999),
      x: o.x,
      y: o.y,
      w: o.w,
      h: o.h,
    }))
    .filter((b) => b.score >= conf);
}

/* --------------------------------------------------------------- segmentation */

/** Border-palette background model → per-pixel foreground probability. */
export function segmentForeground(canvas: HTMLCanvasElement, thresh: number, feather: number): Float32Array {
  const ctx = ctxOf(canvas);
  const { width: W, height: H } = canvas;
  const { data } = ctx.getImageData(0, 0, W, H);
  const palette: number[][] = [];
  const step = Math.max(1, Math.floor(Math.min(W, H) / 40));
  const push = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    palette.push([data[i], data[i + 1], data[i + 2]]);
  };
  for (let x = 0; x < W; x += step) {
    push(x, 0);
    push(x, H - 1);
  }
  for (let y = 0; y < H; y += step) {
    push(0, y);
    push(W - 1, y);
  }
  const alpha = new Float32Array(W * H);
  const t = clamp(thresh, 0.05, 0.95) * 120;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let best = Infinity;
      for (const p of palette) {
        const d = Math.abs(data[i] - p[0]) + Math.abs(data[i + 1] - p[1]) + Math.abs(data[i + 2] - p[2]);
        if (d < best) best = d;
      }
      alpha[y * W + x] = clamp((best - t * 0.45) / (t * 0.9), 0, 1);
    }
  }
  return feather > 0 ? boxBlur(alpha, W, H, feather) : alpha;
}

function boxBlur(src: Float32Array, W: number, H: number, radius: number): Float32Array {
  const r = Math.max(1, Math.round(radius));
  let a = src;
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let sum = 0;
        let n = 0;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            sum += a[ny * W + nx];
            n++;
          }
        }
        out[y * W + x] = sum / n;
      }
    }
    a = out;
  }
  return a;
}

export function renderCutout(
  canvas: HTMLCanvasElement,
  alpha: Float32Array,
  mode: 'matte' | 'mask'
): string {
  const { width: W, height: H } = canvas;
  const src = ctxOf(canvas).getImageData(0, 0, W, H);
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d')!;
  const img = octx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const a = alpha[y * W + x];
      if (mode === 'matte') {
        // checkerboard compositing so transparency is visible
        const cb = ((x >> 4) + (y >> 4)) % 2 === 0 ? 235 : 205;
        img.data[i] = src.data[i] * a + cb * (1 - a);
        img.data[i + 1] = src.data[i + 1] * a + cb * (1 - a);
        img.data[i + 2] = src.data[i + 2] * a + cb * (1 - a);
        img.data[i + 3] = 255;
      } else {
        img.data[i] = src.data[i] * (1 - a) + 20 * a;
        img.data[i + 1] = src.data[i + 1] * (1 - a) + 240 * a;
        img.data[i + 2] = src.data[i + 2] * (1 - a) + 180 * a;
        img.data[i + 3] = 255;
      }
    }
  }
  octx.putImageData(img, 0, 0);
  return out.toDataURL('image/png');
}

/* --------------------------------------------------------------------- depth */

export function renderDepth(
  canvas: HTMLCanvasElement,
  colormap: 'gray' | 'turbo' | 'viridis',
  overlay: number
): string {
  const { width: W, height: H } = canvas;
  const src = ctxOf(canvas).getImageData(0, 0, W, H);
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d')!;
  const img = octx.createImageData(W, H);
  // Toy monocular cue: darker+lower+lower-contrast ⇒ nearer.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const lum = (src.data[i] * 0.299 + src.data[i + 1] * 0.587 + src.data[i + 2] * 0.114) / 255;
      const horiz = 1 - Math.abs(x / W - 0.5) * 0.55;
      const vert = 1 - y / H;
      const contrast = Math.abs(
        lum - (src.data[i + 4] * 0.299 + src.data[i + 5] * 0.587 + src.data[i + 6] * 0.114) / 255
      );
      let d = clamp(0.52 * (1 - lum) + 0.3 * vert + 0.18 * horiz + contrast * 1.4, 0, 1);
      d = clamp(Math.pow(d, 0.85), 0, 1);
      const [r, g, b] = colorize(d, colormap);
      img.data[i] = r * (1 - overlay) + src.data[i] * overlay;
      img.data[i + 1] = g * (1 - overlay) + src.data[i + 1] * overlay;
      img.data[i + 2] = b * (1 - overlay) + src.data[i + 2] * overlay;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out.toDataURL('image/png');
}

function colorize(t: number, map: 'gray' | 'turbo' | 'viridis'): [number, number, number] {
  if (map === 'gray') {
    const v = Math.round(t * 245 + 8);
    return [v, v, v];
  }
  if (map === 'turbo') {
    const r = clamp(34 + 255 * Math.sin(Math.PI * (t * 1.1 - 0.05)), 0, 255);
    const g = clamp(30 + 255 * Math.sin(Math.PI * (t * 1.3 + 0.05)), 0, 255);
    const b = clamp(140 - 210 * t + 120 * Math.sin(Math.PI * t * 1.6), 0, 255);
    return [r, g, b];
  }
  const stops: [number, number[]][] = [
    [0, [68, 1, 84]],
    [0.25, [59, 82, 139]],
    [0.5, [33, 145, 140]],
    [0.75, [94, 201, 98]],
    [1, [253, 231, 37]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i];
    const [b, cb] = stops[i + 1];
    if (t >= a && t <= b) {
      const k = (t - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k];
    }
  }
  return [253, 231, 37];
}

/* -------------------------------------------------------------- restoration */

export function restore(
  canvas: HTMLCanvasElement,
  task: 'denoise' | 'sr' | 'deblur',
  strength: number
): string {
  const { width: W, height: H } = canvas;
  const scale = task === 'sr' ? 2 : 1;
  const src = ctxOf(canvas).getImageData(0, 0, W, H);

  // 1. a blurred copy drives the edge-aware blend (bilateral approximation)
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = W;
  blurCanvas.height = H;
  const bctx = blurCanvas.getContext('2d')!;
  bctx.filter = `blur(${task === 'denoise' ? 1.6 : 0.9}px)`;
  bctx.drawImage(canvas, 0, 0);
  bctx.filter = 'none';
  const blur = bctx.getImageData(0, 0, W, H);

  const work = document.createElement('canvas');
  work.width = W;
  work.height = H;
  const wctx = work.getContext('2d')!;
  const base = wctx.createImageData(W, H);
  const sigma = task === 'denoise' ? 900 + (1 - strength) * 2400 : 1800;
  for (let i = 0; i < src.data.length; i += 4) {
    const dr = src.data[i] - blur.data[i];
    const dg = src.data[i + 1] - blur.data[i + 1];
    const db = src.data[i + 2] - blur.data[i + 2];
    const edge = dr * dr + dg * dg + db * db;
    // keep detail where the image has structure, smooth where it is flat
    const keep = 1 - Math.exp(-edge / sigma);
    const mix = task === 'denoise' ? clamp(keep * (1 - strength) + strength * 0.08, 0, 1) : 1;
    base.data[i] = blur.data[i] * (1 - mix) + src.data[i] * mix;
    base.data[i + 1] = blur.data[i + 1] * (1 - mix) + src.data[i + 1] * mix;
    base.data[i + 2] = blur.data[i + 2] * (1 - mix) + src.data[i + 2] * mix;
    base.data[i + 3] = 255;
  }
  wctx.putImageData(base, 0, 0);

  // 2. resample (for SR) and apply an unsharp pass for perceived detail
  const out = document.createElement('canvas');
  out.width = W * scale;
  out.height = H * scale;
  const octx = out.getContext('2d')!;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(work, 0, 0, out.width, out.height);

  const lowCanvas = document.createElement('canvas');
  lowCanvas.width = out.width;
  lowCanvas.height = out.height;
  const lctx = lowCanvas.getContext('2d')!;
  lctx.filter = `blur(${task === 'deblur' ? 2.4 : 1.2}px)`;
  lctx.drawImage(out, 0, 0);
  lctx.filter = 'none';

  const A = octx.getImageData(0, 0, out.width, out.height);
  const B = lctx.getImageData(0, 0, out.width, out.height);
  const amount = (task === 'deblur' ? 1.5 : task === 'sr' ? 1.0 : 0.8) * (0.35 + strength * 0.9);
  for (let i = 0; i < A.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      A.data[i + c] = clamp(A.data[i + c] + (A.data[i + c] - B.data[i + c]) * amount, 0, 255);
    }
  }
  octx.putImageData(A, 0, 0);
  return out.toDataURL('image/png');
}

/* ---------------------------------------------------------------- inpainting */

/** Diffusion-based fill: propagate surrounding pixels into the masked region.
 *  Runs only inside the mask bounding box so large images stay fast. */
export function inpaint(
  canvas: HTMLCanvasElement,
  maskAlpha: Float32Array,
  iterations: number,
  feather: number
): { url: string; filled: number } {
  const { width: W, height: H } = canvas;
  const ctx = ctxOf(canvas);
  const src = ctx.getImageData(0, 0, W, H);

  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;
  let filled = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (maskAlpha[y * W + x] > 0.35) {
        filled++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!filled) return { url: canvas.toDataURL('image/png'), filled: 0 };

  const pad = Math.max(6, Math.round(feather));
  const x0 = Math.max(0, minX - pad);
  const y0 = Math.max(0, minY - pad);
  const x1 = Math.min(W - 1, maxX + pad);
  const y1 = Math.min(H - 1, maxY + pad);
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;

  const buf = new Float32Array(bw * bh * 3);
  const known = new Float32Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const gi = (y0 + y) * W + (x0 + x);
      const li = y * bw + x;
      buf[li * 3] = src.data[gi * 4];
      buf[li * 3 + 1] = src.data[gi * 4 + 1];
      buf[li * 3 + 2] = src.data[gi * 4 + 2];
      known[li] = maskAlpha[gi] > 0.35 ? 0 : 1;
    }
  }

  const total = Math.min(iterations, Math.max(24, Math.round(Math.max(bw, bh) * 1.2)));
  for (let it = 0; it < total; it++) {
    const next = buf.slice();
    for (let y = 1; y < bh - 1; y++) {
      for (let x = 1; x < bw - 1; x++) {
        const li = y * bw + x;
        if (known[li]) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let k = 0; k < 8; k++) {
          const dx = DIRS[k * 2];
          const dy = DIRS[k * 2 + 1];
          const j = (y + dy) * bw + (x + dx);
          const w = k < 4 ? 1 : 0.7;
          r += buf[j * 3] * w;
          g += buf[j * 3 + 1] * w;
          b += buf[j * 3 + 2] * w;
          n += w;
        }
        next[li * 3] = r / n;
        next[li * 3 + 1] = g / n;
        next[li * 3 + 2] = b / n;
      }
    }
    buf.set(next);
  }

  const out = ctx.createImageData(W, H);
  out.data.set(src.data);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const gi = (y0 + y) * W + (x0 + x);
      const li = y * bw + x;
      const a = clamp(maskAlpha[gi], 0, 1);
      // a little grain keeps the filled area from reading as a flat patch
      const grain = ((fnv1a(`${gi % 977}`) % 1000) / 1000 - 0.5) * 5;
      out.data[gi * 4] = buf[li * 3] * a + src.data[gi * 4] * (1 - a) + grain;
      out.data[gi * 4 + 1] = buf[li * 3 + 1] * a + src.data[gi * 4 + 1] * (1 - a) + grain;
      out.data[gi * 4 + 2] = buf[li * 3 + 2] * a + src.data[gi * 4 + 2] * (1 - a) + grain;
      out.data[gi * 4 + 3] = 255;
    }
  }
  const oc = document.createElement('canvas');
  oc.width = W;
  oc.height = H;
  oc.getContext('2d')!.putImageData(out, 0, 0);
  return { url: oc.toDataURL('image/png'), filled };
}

const DIRS = [-1, 0, 1, 0, 0, -1, 0, 1, -1, -1, 1, 1, -1, 1, 1, -1];

/** Build a mask from the sample's ground-truth regions (e.g. watermarks). */
export function maskFromRects(
  width: number,
  height: number,
  rects: { x: number; y: number; w: number; h: number }[]
): Float32Array {
  const m = new Float32Array(width * height);
  for (const r of rects) {
    const x0 = Math.floor(r.x * width);
    const y0 = Math.floor(r.y * height);
    const x1 = Math.ceil((r.x + r.w) * width);
    const y1 = Math.ceil((r.y + r.h) * height);
    for (let y = Math.max(0, y0); y < Math.min(height, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(width, x1); x++) m[y * width + x] = 1;
    }
  }
  return m;
}

/* ------------------------------------------------------------ text-to-image */

const PALETTES: { cues: string[]; colors: [number, number, number][] }[] = [
  { cues: ['cyberpunk', '赛博', '霓虹', 'neon', '雨夜'], colors: [[18, 16, 42], [86, 42, 140], [220, 60, 160], [40, 220, 220], [250, 240, 250]] },
  { cues: ['黑白', 'black', 'white', 'minimal', '极简', '雪'], colors: [[16, 16, 18], [90, 90, 94], [160, 160, 164], [222, 222, 226], [250, 250, 250]] },
  { cues: ['product', '产品', 'studio', '工作室', '摄影'], colors: [[28, 28, 30], [120, 116, 110], [200, 190, 178], [240, 236, 228], [255, 252, 246]] },
  { cues: ['nature', '自然', '森林', '山', 'forest', 'mountain'], colors: [[22, 34, 26], [58, 92, 68], [130, 150, 120], [200, 205, 190], [246, 240, 226]] },
  { cues: ['sunset', '日落', '暖', 'warm'], colors: [[40, 18, 26], [140, 52, 40], [230, 120, 60], [248, 196, 96], [255, 244, 216]] },
];

export function generateImage(
  prompt: string,
  negative: string,
  seed: number,
  ratio: 'square' | 'wide' | 'tall',
  steps: number,
  guidance: number
): string {
  const dims = ratio === 'wide' ? [832, 468] : ratio === 'tall' ? [540, 720] : [640, 640];
  const [W, H] = dims;
  const rng = mulberry32(fnv1a(`${prompt}|${negative}|${seed}`));
  const lower = prompt.toLowerCase();
  let palette = PALETTES[3].colors;
  let bestScore = -1;
  for (const p of PALETTES) {
    const s = p.cues.reduce((acc, c) => acc + (lower.includes(c.toLowerCase()) ? 1 : 0), 0);
    if (s > bestScore) {
      bestScore = s;
      palette = p.colors;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const strength = clamp(guidance / 12, 0.25, 1);

  // background gradient
  const g = ctx.createLinearGradient(0, 0, W * (0.3 + rng() * 0.7), H);
  g.addColorStop(0, `rgb(${palette[0].join(',')})`);
  g.addColorStop(0.55, `rgb(${palette[2].join(',')})`);
  g.addColorStop(1, `rgb(${palette[0].join(',')})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // diffusion-like progressive layers: each pass adds a coarser→finer structure
  const passes = Math.max(4, Math.round(steps / 3));
  for (let pass = 0; pass < passes; pass++) {
    const scale = 1 - pass / (passes + 1);
    const blobs = 4 + Math.round(rng() * 8);
    ctx.globalAlpha = 0.16 + 0.5 * strength * (1 - scale);
    for (let b = 0; b < blobs; b++) {
      const cx = rng() * W;
      const cy = rng() * H;
      const r = (20 + rng() * Math.min(W, H) * 0.42) * (0.35 + scale);
      const col = palette[1 + Math.floor(rng() * (palette.length - 1))];
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, `rgba(${col.join(',')},0.95)`);
      rg.addColorStop(1, `rgba(${col.join(',')},0)`);
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // structural strokes
  ctx.globalAlpha = 0.3 * strength;
  ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const col = palette[3 + Math.floor(rng() * (palette.length - 3))] ?? palette[4];
    ctx.strokeStyle = `rgb(${col.join(',')})`;
    ctx.lineWidth = 1 + rng() * 8;
    ctx.beginPath();
    const y0 = rng() * H;
    ctx.moveTo(0, y0);
    for (let x = 0; x <= W; x += W / 8) {
      ctx.lineTo(x, y0 + Math.sin(x / W * Math.PI * (1 + rng() * 3)) * H * 0.12 * strength);
    }
    ctx.stroke();
  }
  // grain
  ctx.globalAlpha = 1;
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rng() - 0.5) * 26;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/* --------------------------------------------------------------- landmarks */

export interface LandmarkSet {
  kind: 'face' | 'pose' | 'hand' | 'object';
  box: { x: number; y: number; w: number; h: number };
  points: Point[];
  edges: [number, number][];
  mesh?: { x: number; y: number }[][];
}

function faceMesh(box: { x: number; y: number; w: number; h: number }): { x: number; y: number }[][] {
  const rows: { x: number; y: number }[][] = [];
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  for (let row = 0; row < 14; row++) {
    const ty = row / 13;
    const yy = cy - box.h * 0.48 + ty * box.h * 0.96;
    // narrower toward chin / forehead
    const shrink = 0.34 + 0.66 * Math.sin(Math.PI * clamp(ty * 0.92 + 0.06, 0, 1)) ** 0.7;
    const halfW = (box.w / 2) * shrink;
    const pts: { x: number; y: number }[] = [];
    const cols = Math.round(8 + shrink * 8);
    for (let c = 0; c < cols; c++) {
      const tx = cols === 1 ? 0.5 : c / (cols - 1);
      pts.push({ x: cx - halfW + tx * halfW * 2, y: yy });
    }
    rows.push(pts);
  }
  return rows;
}

export function buildLandmarks(
  kind: 'face' | 'pose' | 'hand',
  box: { x: number; y: number; w: number; h: number },
  modelSeed: string
): LandmarkSet {
  const rng = mulberry32(fnv1a(`${modelSeed}:${kind}`));
  const jit = (amount: number) => (rng() - 0.5) * amount;
  if (kind === 'face') {
    const points: Point[] = [];
    const meshRows = faceMesh(box);
    meshRows.forEach((row) => row.forEach((pt) => points.push({ x: pt.x + jit(2), y: pt.y + jit(2), score: 0.9 + rng() * 0.09 })));
    // face oval contour
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      points.push({
        x: box.x + box.w / 2 + Math.cos(a) * box.w * 0.5,
        y: box.y + box.h / 2 + Math.sin(a) * box.h * 0.5,
        score: 0.95,
      });
    }
    return { kind, box, points, edges: [], mesh: meshRows };
  }
  if (kind === 'hand') {
    // canonical hand topology in normalised box space
    const proto: [number, number][] = [
      [0.5, 0.95], // wrist
      [0.30, 0.78], [0.20, 0.58], [0.14, 0.40], [0.10, 0.24], // thumb
      [0.40, 0.62], [0.38, 0.40], [0.37, 0.24], [0.36, 0.10], // index
      [0.52, 0.60], [0.53, 0.36], [0.53, 0.19], [0.53, 0.04], // middle
      [0.64, 0.63], [0.68, 0.41], [0.70, 0.25], [0.72, 0.11], // ring
      [0.75, 0.70], [0.82, 0.54], [0.86, 0.42], [0.89, 0.31], // pinky
    ];
    const edges: [number, number][] = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17],
    ];
    const points = proto.map(([nx, ny]) => ({
      x: box.x + nx * box.w + jit(3),
      y: box.y + ny * box.h + jit(3),
      score: 0.85 + rng() * 0.14,
    }));
    return { kind, box, points, edges };
  }
  const proto: [number, number][] = [
    [0.50, 0.06], [0.42, 0.04], [0.58, 0.04], [0.34, 0.05], [0.66, 0.05],
    [0.38, 0.26], [0.62, 0.26], [0.30, 0.46], [0.70, 0.46],
    [0.26, 0.66], [0.74, 0.66], [0.24, 0.84], [0.76, 0.84],
    [0.42, 0.56], [0.58, 0.56], [0.40, 0.80], [0.60, 0.80],
  ];
  const edges: [number, number][] = [
    [0, 1], [0, 2], [1, 3], [2, 4], [1, 5], [2, 6],
    [5, 7], [7, 9], [6, 8], [8, 10],
    [5, 11], [11, 13], [6, 12], [12, 14], [13, 15], [14, 16],
    [5, 6], [11, 12],
  ];
  const points = proto.map(([nx, ny]) => ({
    x: box.x + nx * box.w + jit(4),
    y: box.y + ny * box.h + jit(4),
    score: 0.8 + rng() * 0.19,
  }));
  return { kind, box, points, edges };
}

/** Skinish-pixel clustering to propose a plausible subject/frame box. */
export function proposeSubjectBox(canvas: HTMLCanvasElement, seed: string): { x: number; y: number; w: number; h: number } {
  const { width: W, height: H } = canvas;
  const data = ctxOf(canvas).getImageData(0, 0, W, H).data;
  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;
  let hits = 0;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const skin = r > 120 && r > g && g > b && r - b > 18 && r - b < 130;
      if (skin) {
        hits++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const rng = mulberry32(fnv1a(`${seed}:subject`));
  if (hits < 40) {
    const w = 0.36 + rng() * 0.1;
    const h = w * 1.34;
    return { x: 0.5 - w / 2, y: 0.42 - h / 2, w, h };
  }
  const pad = 0.05;
  return {
    x: clamp(minX / W - pad, 0, 1),
    y: clamp(minY / H - pad, 0, 1),
    w: clamp((maxX - minX) / W + pad * 2, 0.08, 1),
    h: clamp((maxY - minY) / H + pad * 2, 0.08, 1),
  };
}

/** Vertical silhouette scan, used to seed the pose skeleton. */
export function proposeBodyBox(canvas: HTMLCanvasElement, seed: string): { x: number; y: number; w: number; h: number } {
  const { width: W, height: H } = canvas;
  const ctximg = ctxOf(canvas).getImageData(0, 0, W, H).data;
  let bestCol = -1;
  let bestScore = -1;
  const colEnergy = new Float32Array(W);
  for (let x = 1; x < W - 1; x++) {
    let s = 0;
    for (let y = 0; y < H; y += 3) {
      const i = (y * W + x) * 4;
      const j = (y * W + x + 1) * 4;
      s += Math.abs(ctximg[i] - ctximg[j]);
    }
    colEnergy[x] = s;
  }
  for (let x = 0; x < W; x++) {
    if (colEnergy[x] > bestScore) {
      bestScore = colEnergy[x];
      bestCol = x;
    }
  }
  const rng = mulberry32(fnv1a(`${seed}:body`));
  const h = 0.72 + rng() * 0.16;
  const w = h * 0.36;
  const cx = bestCol >= 0 ? bestCol / W : 0.5;
  return { x: clamp(cx - w / 2, 0.02, 1 - w), y: clamp(0.5 - h / 2, 0.02, 1 - h), w, h };
}
