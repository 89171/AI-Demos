/**
 * Shared onnxruntime-web helpers for custom ONNX checkpoints (MI-GAN, HT-Demucs) that have no
 * Transformers.js pipeline. Safe to import from a Worker or the main thread.
 */
import type * as OrtTypes from 'onnxruntime-web/wasm';

// Imported lazily: the package touches import.meta.url at load, which breaks Next's server render.
export const loadOrt = () => import('onnxruntime-web/wasm');

const CACHE = 'ai-demos-onnx-v1';

/** Download once, then serve from Cache Storage. Reports 0..1. */
export async function fetchModel(url: string, onProgress?: (ratio: number, received: number, total: number) => void): Promise<Uint8Array<ArrayBuffer>> {
  const cache = typeof caches !== 'undefined' ? await caches.open(CACHE).catch(() => null) : null;
  const hit = await cache?.match(url);
  const res = hit ?? (await fetch(url));
  if (!res.ok) throw new Error(`model download failed: ${res.status}`);
  const total = Number(res.headers.get('Content-Length')) || 0;
  const body = res.clone().body;
  const chunks: Uint8Array[] = [];
  let got = 0;
  if (body) {
    const reader = body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.byteLength;
      onProgress?.(total ? got / total : 0, got, total);
    }
  }
  const out = new Uint8Array(new ArrayBuffer(got));
  let off = 0;
  for (const c of chunks) (out.set(c, off), (off += c.byteLength));
  if (!hit) await cache?.put(url, new Response(out, { headers: { 'Content-Type': 'application/octet-stream' } })).catch(() => undefined);
  return out;
}

/** wasm EP, single thread (no COOP/COEP), graph optimiser off — it aborts on large exported graphs. */
export async function createSession(bytes: Uint8Array<ArrayBuffer>, origin = ''): Promise<OrtTypes.InferenceSession> {
  const ort = await loadOrt();
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = { wasm: `${origin}/ort/ort-wasm-simd-threaded.wasm`, mjs: `${origin}/ort/ort-wasm-simd-threaded.mjs` };
  return ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'disabled' });
}
