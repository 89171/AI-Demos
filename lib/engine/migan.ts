/** Real MI-GAN inpainting (ONNX pipeline model, 512×512, uint8 in / uint8 out). */
import type { InferenceSession } from 'onnxruntime-web/wasm';
import { createSession, fetchModel, loadOrt } from './ort';

const SIZE = 512;
const sessions = new Map<string, Promise<InferenceSession>>();

export async function miganInpaint(
  canvas: HTMLCanvasElement,
  alpha: Float32Array,
  url: string,
  onProgress?: (ratio: number) => void
): Promise<{ url: string; filled: number }> {
  let job = sessions.get(url);
  if (!job) {
    job = fetchModel(url, (r) => onProgress?.(r)).then((b) => createSession(b));
    sessions.set(url, job);
    job.catch(() => sessions.delete(url));
  }
  const [session, ort] = await Promise.all([job, loadOrt()]);
  const { width: W, height: H } = canvas;

  // Model input: whole image squeezed to 512², CHW uint8; mask 255 = keep, 0 = hole.
  const small = document.createElement('canvas');
  small.width = small.height = SIZE;
  small.getContext('2d')!.drawImage(canvas, 0, 0, SIZE, SIZE);
  const px = small.getContext('2d')!.getImageData(0, 0, SIZE, SIZE).data;
  const img = new Uint8Array(3 * SIZE * SIZE);
  const mask = new Uint8Array(SIZE * SIZE).fill(255);
  let filled = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      img[i] = px[i * 4];
      img[SIZE * SIZE + i] = px[i * 4 + 1];
      img[2 * SIZE * SIZE + i] = px[i * 4 + 2];
      if (alpha[Math.floor((y * H) / SIZE) * W + Math.floor((x * W) / SIZE)] > 0.35) mask[i] = 0;
    }
  }
  for (let i = 0; i < alpha.length; i++) if (alpha[i] > 0.35) filled++;
  if (!filled) return { url: canvas.toDataURL('image/png'), filled: 0 };

  const res = await session.run({
    image: new ort.Tensor('uint8', img, [1, 3, SIZE, SIZE]),
    mask: new ort.Tensor('uint8', mask, [1, 1, SIZE, SIZE]),
  });
  const out = res.result.data as Uint8Array;

  // Paint the model output back at full resolution, only where the user masked.
  const gen = document.createElement('canvas');
  gen.width = gen.height = SIZE;
  const gd = gen.getContext('2d')!.createImageData(SIZE, SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    gd.data[i * 4] = out[i];
    gd.data[i * 4 + 1] = out[SIZE * SIZE + i];
    gd.data[i * 4 + 2] = out[2 * SIZE * SIZE + i];
    gd.data[i * 4 + 3] = 255;
  }
  gen.getContext('2d')!.putImageData(gd, 0, 0);
  const full = document.createElement('canvas');
  full.width = W;
  full.height = H;
  const fc = full.getContext('2d', { willReadFrequently: true })!;
  fc.drawImage(canvas, 0, 0);
  const base = fc.getImageData(0, 0, W, H);
  fc.drawImage(gen, 0, 0, W, H);
  const fill = fc.getImageData(0, 0, W, H);
  for (let i = 0; i < alpha.length; i++) {
    const a = Math.min(1, Math.max(0, (alpha[i] - 0.2) / 0.5));
    for (let c = 0; c < 3; c++) base.data[i * 4 + c] = base.data[i * 4 + c] * (1 - a) + fill.data[i * 4 + c] * a;
  }
  fc.putImageData(base, 0, 0);
  return { url: full.toDataURL('image/png'), filled };
}
