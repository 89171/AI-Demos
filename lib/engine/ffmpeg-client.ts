/**
 * Minimal ffmpeg.wasm client.
 *
 * Talks the @ffmpeg/ffmpeg 0.12 postMessage protocol directly against the
 * vendored module worker in /public/vendor/ffmpeg/worker.js. We deliberately do
 * NOT import `@ffmpeg/ffmpeg` itself: its classes.js instantiates the worker
 * through `new URL(classWorkerURL, import.meta.url)`, which Turbopack tries to
 * statically resolve and fails the whole build. A plain worker path string
 * (`new Worker('/vendor/ffmpeg/worker.js')`) is invisible to the bundler.
 *
 * The core (ffmpeg-core.js / ffmpeg-core.wasm, ~31 MB) is fetched from the
 * jsdelivr CDN as blob URLs at runtime, same as toolgarden.xyz.
 */

const FFMPEG_CORE_CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
const WORKER_URL = '/vendor/ffmpeg/worker.js';

type MessageType =
  | 'LOAD'
  | 'EXEC'
  | 'WRITE_FILE'
  | 'READ_FILE'
  | 'DELETE_FILE';

interface WorkerResponse {
  id: number;
  type: MessageType | 'ERROR' | 'LOG' | 'PROGRESS';
  data: unknown;
}

async function toBlobURL(url: string, mime: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`failed to fetch ${url}: ${resp.status}`);
  return URL.createObjectURL(new Blob([await resp.arrayBuffer()], { type: mime }));
}

export class FfmpegClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  private spawn(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(WORKER_URL, { type: 'module' });
    worker.onmessage = ({ data }: { data: WorkerResponse }) => {
      if (data.type === 'LOG' || data.type === 'PROGRESS') return;
      const job = this.pending.get(data.id);
      if (!job) return;
      this.pending.delete(data.id);
      if (data.type === 'ERROR') {
        job.reject(new Error(String(data.data)));
      } else {
        job.resolve(data.data);
      }
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || 'ffmpeg worker crashed');
      this.pending.forEach((job) => job.reject(error));
      this.pending.clear();
      this.worker = null;
    };
    this.worker = worker;
    return worker;
  }

  private request(type: MessageType, data: unknown, transfer?: Transferable[]): Promise<unknown> {
    const worker = this.spawn();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, type, data }, transfer ?? []);
    });
  }

  async load(onPhase?: (phase: string) => void): Promise<void> {
    onPhase?.('下载 ffmpeg-core…');
    const coreURL = await toBlobURL(`${FFMPEG_CORE_CDN}/ffmpeg-core.js`, 'text/javascript');
    onPhase?.('下载 ffmpeg-core.wasm…');
    const wasmURL = await toBlobURL(`${FFMPEG_CORE_CDN}/ffmpeg-core.wasm`, 'application/wasm');
    await this.request('LOAD', { coreURL, wasmURL });
    onPhase?.('ffmpeg 就绪');
  }

  writeFile(path: string, data: Uint8Array): Promise<unknown> {
    return this.request('WRITE_FILE', { path, data });
  }

  readFile(path: string): Promise<Uint8Array> {
    return this.request('READ_FILE', { path }) as Promise<Uint8Array>;
  }

  deleteFile(path: string): Promise<unknown> {
    return this.request('DELETE_FILE', { path });
  }

  exec(args: string[]): Promise<unknown> {
    return this.request('EXEC', { args });
  }
}

let clientPromise: Promise<FfmpegClient> | null = null;

export async function loadFfmpeg(onPhase?: (phase: string) => void): Promise<FfmpegClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = new FfmpegClient();
      await client.load(onPhase);
      return client;
    })().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}
