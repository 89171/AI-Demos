/**
 * HT-Demucs ONNX inference worker (ported from json-toolkit's stem-separation worker).
 * Input: 44.1 kHz stereo PCM. Model contract: mix [1,2,343980] → stems [1,N,2,343980],
 * overlap-add over 1/4-overlapping segments with a linear fade window.
 */
import { createSession, fetchModel, loadOrt } from './ort';

const SEG = 343_980;
const OVERLAP = SEG / 4;
const STRIDE = SEG - OVERLAP;

interface Req {
  url: string;
  left: Float32Array;
  right: Float32Array;
  sources: number;
}

const post = (m: unknown, t?: Transferable[]) => (self as unknown as Worker).postMessage(m, t ?? []);

self.addEventListener('message', async (e: MessageEvent<Req>) => {
  try {
    const { url, left, right, sources } = e.data;
    const total = left.length;
    const bytes = await fetchModel(url, (ratio) => post({ type: 'progress', phase: 'model', ratio }));
    post({ type: 'progress', phase: 'session', ratio: 0 });
    // Resolve /ort relative to the page origin: workers have their own location, which is the same origin.
    const ort = await loadOrt();
    const session = await createSession(bytes, self.location.origin);

    const win = new Float32Array(SEG).fill(1);
    for (let i = 0; i < OVERLAP; i++) win[i] = win[SEG - 1 - i] = i / (OVERLAP - 1);

    const acc = Array.from({ length: sources }, () => [new Float32Array(total), new Float32Array(total)]);
    const weight = new Float32Array(total);
    const input = new Float32Array(2 * SEG);
    const chunks = Math.max(1, Math.ceil(total / STRIDE));
    for (let c = 0; c < chunks; c++) {
      const start = c * STRIDE;
      if (start >= total) break;
      const len = Math.min(SEG, total - start);
      input.fill(0);
      input.set(left.subarray(start, start + len), 0);
      input.set(right.subarray(start, start + len), SEG);
      const res = await session.run({ mix: new ort.Tensor('float32', input, [1, 2, SEG]) });
      const out = res.stems.data as Float32Array;
      for (let s = 0; s < sources; s++) {
        for (let ch = 0; ch < 2; ch++) {
          const base = (s * 2 + ch) * SEG;
          const a = acc[s][ch];
          for (let i = 0; i < len; i++) a[start + i] += out[base + i] * win[i];
        }
      }
      for (let i = 0; i < len; i++) weight[start + i] += win[i];
      res.stems.dispose?.();
      post({ type: 'progress', phase: 'separating', ratio: (c + 1) / chunks });
    }
    for (const [l, r] of acc) for (let i = 0; i < total; i++) (l[i] /= Math.max(weight[i], 1e-8), (r[i] /= Math.max(weight[i], 1e-8)));
    post({ type: 'result', stems: acc }, acc.flatMap(([l, r]) => [l.buffer, r.buffer]));
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
});
