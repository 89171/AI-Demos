/**
 * Real LaMa inpainting (big-lama fp32, ~198 MB, Carve/LaMa-ONNX).
 *
 * Ported from toolgarden's video watermark HD pass: the frame region around the
 * selection is squeezed into a 512² patch, the watermark rectangle is masked
 * white, and the model rebuilds the hole. Only the rebuilt patch is composited
 * back onto the full-resolution frame, softened at the edges.
 *
 * WASM execution provider only — LaMa deadlocks on WebGPU (session creation or
 * inference hangs with no error), so no WebGPU attempt is made here. Inference
 * is ~7x slower than MI-GAN; the caller should apply a generous watchdog.
 */
import type { InferenceSession } from 'onnxruntime-web/wasm';
import { createSession, fetchModel, loadOrt } from './ort';

const INPUT_SIZE = 512;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const sessions = new Map<string, Promise<InferenceSession>>();

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Context patch around the selection (toolgarden's heuristic). */
function patchRectFor(sel: Rect, imageW: number, imageH: number): Rect {
  const centerX = sel.x + sel.w / 2;
  const centerY = sel.y + sel.h / 2;
  const contextSize = Math.max(48, Math.round(Math.min(imageW, imageH) * 0.08), Math.round(Math.max(sel.w, sel.h) * 0.8));
  const squareSide = clamp(
    Math.round(Math.max(sel.w, sel.h) + contextSize * 2),
    Math.max(sel.w, sel.h, 1),
    Math.min(imageW, imageH)
  );

  const normalize = (r: Rect): Rect => {
    const x = clamp(Math.round(r.x), 0, Math.max(0, imageW - r.w));
    const y = clamp(Math.round(r.y), 0, Math.max(0, imageH - r.h));
    const w = Math.min(r.w, imageW);
    const h = Math.min(r.h, imageH);
    return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
  };

  if (sel.w <= squareSide && sel.h <= squareSide) {
    return normalize({ x: Math.round(clamp(centerX - squareSide / 2, 0, Math.max(0, imageW - squareSide))), y: Math.round(clamp(centerY - squareSide / 2, 0, Math.max(0, imageH - squareSide))), w: squareSide, h: squareSide });
  }

  // Degenerate shapes fall back to a padded bounding box.
  const padX = Math.max(24, Math.round(sel.w * 0.65), Math.round(imageW * 0.04));
  const padY = Math.max(24, Math.round(sel.h * 1.1), Math.round(imageH * 0.04));
  return normalize({
    x: Math.floor(sel.x - padX),
    y: Math.floor(sel.y - padY),
    w: Math.min(imageW, Math.ceil(sel.x + sel.w + padX)) - Math.max(0, Math.floor(sel.x - padX)),
    h: Math.min(imageH, Math.ceil(sel.y + sel.h + padY)) - Math.max(0, Math.floor(sel.y - padY)),
  });
}

/** Model output tensor → canvas; handles 0..1 vs 0..255 and CHW vs NHWC. */
function tensorToCanvas(tensor: { data: ArrayLike<number>; dims: readonly number[] }): HTMLCanvasElement | null {
  const dims = Array.from(tensor.dims);
  const data = tensor.data;
  let sampleMax = -Infinity;
  for (let i = 0; i < Math.min(data.length, 512); i++) sampleMax = Math.max(sampleMax, data[i]);
  const normalizedOutput = sampleMax <= 1.5;

  let width = INPUT_SIZE;
  let height = INPUT_SIZE;
  let layout: 'chw' | 'nhwc' = 'chw';
  if (dims.length === 4 && dims[1] >= 3) {
    height = dims[2];
    width = dims[3];
  } else if (dims.length === 4 && dims[3] >= 3) {
    height = dims[1];
    width = dims[2];
    layout = 'nhwc';
  } else if (dims.length === 3 && dims[0] >= 3) {
    height = dims[1];
    width = dims[2];
  } else if (dims.length === 3 && dims[2] >= 3) {
    height = dims[0];
    width = dims[1];
    layout = 'nhwc';
  } else {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const out = context.createImageData(width, height);
  const plane = width * height;
  const byte = (v: number) => clamp(Math.round(normalizedOutput ? v * 255 : v), 0, 255);

  for (let i = 0; i < plane; i++) {
    let r: number;
    let g: number;
    let b: number;
    if (layout === 'chw') {
      r = data[i];
      g = data[plane + i];
      b = data[plane * 2 + i];
    } else {
      r = data[i * 3];
      g = data[i * 3 + 1];
      b = data[i * 3 + 2];
    }
    out.data[i * 4] = byte(r);
    out.data[i * 4 + 1] = byte(g);
    out.data[i * 4 + 2] = byte(b);
    out.data[i * 4 + 3] = 255;
  }
  context.putImageData(out, 0, 0);
  return canvas;
}

/** Blend the selection edge so the repair melts into the surrounding frame. */
function softenRepairArea(canvas: HTMLCanvasElement, sel: Rect, feather: number) {
  const context = canvas.getContext('2d');
  if (!context || feather <= 0 || sel.w < 3 || sel.h < 3) return;
  const pad = Math.max(2, Math.ceil(feather * 1.5));
  const sx = Math.max(0, sel.x - pad);
  const sy = Math.max(0, sel.y - pad);
  const sw = Math.max(1, Math.min(canvas.width, sel.x + sel.w + pad) - sx);
  const sh = Math.max(1, Math.min(canvas.height, sel.y + sel.h + pad) - sy);
  const patch = document.createElement('canvas');
  patch.width = sw;
  patch.height = sh;
  patch.getContext('2d')!.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  context.save();
  context.beginPath();
  context.rect(sel.x, sel.y, sel.w, sel.h);
  context.clip();
  context.globalAlpha = 0.42;
  context.filter = `blur(${clamp(Math.round(feather / 3), 1, 12)}px)`;
  context.drawImage(patch, sx, sy);
  context.restore();
}

/**
 * Inpaint the watermark rectangle on a full frame with LaMa.
 * Returns a data URL of the repaired full-resolution frame.
 */
export async function lamaInpaintRegion(
  frame: HTMLCanvasElement,
  sel: Rect,
  modelUrl: string,
  feather: number,
  onProgress?: (ratio: number) => void
): Promise<string> {
  let job = sessions.get(modelUrl);
  if (!job) {
    job = fetchModel(modelUrl, (r) => onProgress?.(r)).then((b) => createSession(b));
    sessions.set(modelUrl, job);
    job.catch(() => sessions.delete(modelUrl));
  }
  const [session, ort] = await Promise.all([job, loadOrt()]);

  const patch = patchRectFor(sel, frame.width, frame.height);

  // 512² patch of the frame around the selection.
  const patchCanvas = document.createElement('canvas');
  patchCanvas.width = patchCanvas.height = INPUT_SIZE;
  const pc = patchCanvas.getContext('2d', { willReadFrequently: true })!;
  pc.imageSmoothingEnabled = true;
  pc.imageSmoothingQuality = 'high';
  pc.drawImage(frame, patch.x, patch.y, patch.w, patch.h, 0, 0, INPUT_SIZE, INPUT_SIZE);

  // Mask: black background, white block over the selection (padded).
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = maskCanvas.height = INPUT_SIZE;
  const mc = maskCanvas.getContext('2d', { willReadFrequently: true })!;
  const scaleX = INPUT_SIZE / Math.max(1, patch.w);
  const scaleY = INPUT_SIZE / Math.max(1, patch.h);
  const pad = clamp(Math.round(feather / 3), 1, 10);
  mc.fillStyle = '#000000';
  mc.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  mc.fillStyle = '#ffffff';
  mc.fillRect(
    Math.floor((sel.x - patch.x) * scaleX - pad),
    Math.floor((sel.y - patch.y) * scaleY - pad),
    Math.ceil(sel.w * scaleX + pad * 2),
    Math.ceil(sel.h * scaleY + pad * 2)
  );

  // Tensors: float32 image 0..1 CHW, float32 mask 0/1.
  const px = pc.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
  const imageTensor = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
    const a = px[i * 4 + 3] / 255;
    imageTensor[i] = (px[i * 4] * a + 255 * (1 - a)) / 255;
    imageTensor[INPUT_SIZE * INPUT_SIZE + i] = (px[i * 4 + 1] * a + 255 * (1 - a)) / 255;
    imageTensor[2 * INPUT_SIZE * INPUT_SIZE + i] = (px[i * 4 + 2] * a + 255 * (1 - a)) / 255;
  }
  const mpx = mc.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
  const maskTensor = new Float32Array(INPUT_SIZE * INPUT_SIZE);
  for (let i = 0; i < maskTensor.length; i++) maskTensor[i] = mpx[i * 4] > 127 ? 1 : 0;

  const imageInputName = session.inputNames.find((n) => /image|img|input/i.test(n)) ?? session.inputNames[0];
  const maskInputName = session.inputNames.find((n) => /mask/i.test(n)) ?? session.inputNames.find((n) => n !== imageInputName);
  if (!imageInputName || !maskInputName) throw new Error('unexpected LaMa model inputs');

  const res = await session.run({
    [imageInputName]: new ort.Tensor('float32', imageTensor, [1, 3, INPUT_SIZE, INPUT_SIZE]),
    [maskInputName]: new ort.Tensor('float32', maskTensor, [1, 1, INPUT_SIZE, INPUT_SIZE]),
  });
  const outputName = session.outputNames[0] ?? Object.keys(res)[0];
  const output = outputName ? (res as Record<string, { data: ArrayLike<number>; dims: readonly number[] }>)[outputName] : undefined;
  const outCanvas = output ? tensorToCanvas(output) : null;
  if (!outCanvas) throw new Error('unexpected LaMa model output');

  // Composite: full frame, model output drawn over the patch area, only the
  // selection rect replaced; edges softened.
  const full = document.createElement('canvas');
  full.width = frame.width;
  full.height = frame.height;
  const fc = full.getContext('2d')!;
  fc.drawImage(frame, 0, 0);
  fc.save();
  fc.beginPath();
  fc.rect(sel.x, sel.y, sel.w, sel.h);
  fc.clip();
  fc.imageSmoothingEnabled = true;
  fc.imageSmoothingQuality = 'high';
  fc.drawImage(outCanvas, patch.x, patch.y, patch.w, patch.h);
  fc.restore();
  softenRepairArea(full, sel, feather);

  return full.toDataURL('image/png');
}
