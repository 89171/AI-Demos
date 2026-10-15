/** Real stem separation: HT-Demucs ONNX in a Worker, mapped onto the demo's Stem shape. */
import { decodeAudio, framePeaks, wavUrl, type Stem } from './audio-tasks';

const SOURCES = {
  '4': ['drums', 'bass', 'other', 'vocals'],
  '6': ['drums', 'bass', 'other', 'vocals', 'guitar', 'piano'],
} as const;
const NAMES: Record<string, [string, string]> = {
  vocals: ['人声', 'Vocals'],
  drums: ['鼓组', 'Drums'],
  bass: ['贝斯', 'Bass'],
  other: ['其他', 'Other'],
  guitar: ['吉他', 'Guitar'],
  piano: ['钢琴', 'Piano'],
  instrumental: ['伴奏', 'Instrumental'],
};
const MAX_SECONDS = 6 * 60; // f32 accumulators for every stem live in memory

export async function separateReal(
  src: string,
  url: string,
  model: '4' | '6',
  count: 2 | 4,
  onPhase: (phase: 'model' | 'session' | 'separating', ratio: number) => void
): Promise<Stem[]> {
  const buffer = await decodeAudio(src, 44100);
  if (buffer.duration > MAX_SECONDS) throw new Error('audio too long for in-browser separation');
  const left = new Float32Array(buffer.getChannelData(0));
  const right = new Float32Array(buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0));
  const names = SOURCES[model];

  const worker = new Worker(new URL('./stems.worker.ts', import.meta.url), { type: 'module' });
  const raw = await new Promise<Float32Array[][]>((resolve, reject) => {
    worker.onmessage = (e) => {
      if (e.data.type === 'progress') onPhase(e.data.phase, e.data.ratio);
      else if (e.data.type === 'result') resolve(e.data.stems);
      else reject(new Error(e.data.message));
    };
    worker.onerror = (e) => reject(new Error(e.message));
    worker.postMessage({ url, left, right, sources: names.length }, [left.buffer, right.buffer]);
  }).finally(() => worker.terminate());

  // Mono downmix for playback/waveform — the demo's stem players are mono.
  const mono = raw.map(([l, r]) => l.map((v, i) => (v + r[i]) / 2));
  const idx = (n: string) => names.indexOf(n as never);
  const sum = (ns: string[]) => {
    const o = new Float32Array(mono[0].length);
    for (const n of ns) mono[idx(n)].forEach((v, i) => (o[i] += v));
    return o;
  };
  const picked: [string, Float32Array][] =
    count === 2
      ? [['vocals', mono[idx('vocals')]], ['instrumental', sum(names.filter((n) => n !== 'vocals'))]]
      : model === '6'
        ? names.map((n, i) => [n, mono[i]] as [string, Float32Array])
        : (['vocals', 'drums', 'bass', 'other'] as const).map((n) => [n, mono[idx(n)]] as [string, Float32Array]);

  return picked.map(([n, a]) => {
    let peak = 0;
    let e = 0;
    for (const v of a) (peak = Math.max(peak, Math.abs(v)), (e += v * v));
    const g = peak > 1 ? 0.99 / peak : 1; // avoid clipping, keep relative levels otherwise
    const out = g === 1 ? a : a.map((v) => v * g);
    return {
      name: NAMES[n][0],
      nameEn: NAMES[n][1],
      url: wavUrl(out, 44100),
      peaks: framePeaks(out, 320),
      energyDb: Math.round(20 * Math.log10(Math.max(Math.sqrt(e / a.length), 1e-6)) * 10) / 10,
    };
  });
}
