/**
 * Audio tasks.
 *
 * Denoising and source separation run a real STFT → spectral processing → ISTFT
 * pipeline over the decoded samples, so the audible result genuinely differs
 * from the input. Music generation renders through an OfflineAudioContext.
 */

/* ------------------------------------------------------------------- codecs */

export async function decodeAudio(src: string, sampleRate = 16000): Promise<AudioBuffer> {
  const res = await fetch(src);
  const buf = await res.arrayBuffer();
  const AC: typeof AudioContext =
    (window as unknown as { AudioContext: typeof AudioContext }).AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC({ sampleRate });
  try {
    return await ctx.decodeAudioData(buf.slice(0));
  } finally {
    void ctx.close();
  }
}

export function peaks(buffer: AudioBuffer, buckets = 320): number[] {
  const ch = buffer.getChannelData(0);
  const size = Math.floor(ch.length / buckets) || 1;
  const out: number[] = [];
  for (let b = 0; b < buckets; b++) {
    let max = 0;
    for (let i = b * size; i < Math.min((b + 1) * size, ch.length); i++) {
      const v = Math.abs(ch[i]);
      if (v > max) max = v;
    }
    out.push(max);
  }
  return out;
}

export function toWav(samples: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
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
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buf], { type: 'audio/wav' });
}

export function wavUrl(samples: Float32Array, sampleRate: number): string {
  return URL.createObjectURL(toWav(samples, sampleRate));
}

/* ---------------------------------------------------------------------- FFT */

function fft(re: Float32Array, im: Float32Array, inverse = false): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

interface Stft {
  frames: number;
  bins: number;
  mag: Float32Array[];
  phase: Float32Array[];
  hop: number;
  size: number;
}

function stft(signal: Float32Array, size = 512, hop = 128): Stft {
  const frames = Math.max(1, Math.floor((signal.length - size) / hop) + 1);
  const bins = size / 2 + 1;
  const mag: Float32Array[] = [];
  const phase: Float32Array[] = [];
  const win = new Float32Array(size);
  for (let i = 0; i < size; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  for (let f = 0; f < frames; f++) {
    const re = new Float32Array(size);
    const im = new Float32Array(size);
    for (let i = 0; i < size; i++) re[i] = (signal[f * hop + i] ?? 0) * win[i];
    fft(re, im);
    const m = new Float32Array(bins);
    const p = new Float32Array(bins);
    for (let b = 0; b < bins; b++) {
      m[b] = Math.hypot(re[b], im[b]);
      p[b] = Math.atan2(im[b], re[b]);
    }
    mag.push(m);
    phase.push(p);
  }
  return { frames, bins, mag, phase, hop, size };
}

function istft(s: Stft, length: number): Float32Array {
  const out = new Float32Array(length);
  const norm = new Float32Array(length);
  const win = new Float32Array(s.size);
  for (let i = 0; i < s.size; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (s.size - 1));
  for (let f = 0; f < s.frames; f++) {
    const re = new Float32Array(s.size);
    const im = new Float32Array(s.size);
    for (let b = 0; b < s.bins; b++) {
      const m = s.mag[f][b];
      const p = s.phase[f][b];
      re[b] = m * Math.cos(p);
      im[b] = m * Math.sin(p);
      if (b > 0 && b < s.size / 2) {
        re[s.size - b] = re[b];
        im[s.size - b] = -im[b];
      }
    }
    fft(re, im, true);
    for (let i = 0; i < s.size; i++) {
      const idx = f * s.hop + i;
      if (idx >= length) break;
      out[idx] += re[i] * win[i];
      norm[idx] += win[i] * win[i];
    }
  }
  for (let i = 0; i < length; i++) if (norm[i] > 1e-6) out[i] /= norm[i];
  return out;
}

function rms(a: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return Math.sqrt(s / Math.max(1, a.length));
}

/* ----------------------------------------------------------------- denoise */

export interface DenoiseResult {
  url: string;
  before: number[];
  after: number[];
  snrGainDb: number;
}

export function denoise(buffer: AudioBuffer, strength: number, hpf: boolean): DenoiseResult {
  const src = new Float32Array(buffer.getChannelData(0));
  const s = stft(src, 512, 256);
  // noise profile = per-bin percentile from the quietest frames
  const frameEnergy = s.mag.map((m) => rms(m));
  const order = [...frameEnergy.keys()].sort((a, b) => frameEnergy[a] - frameEnergy[b]);
  const quiet = order.slice(0, Math.max(1, Math.floor(order.length * 0.12)));
  const noise = new Float32Array(s.bins);
  quiet.forEach((f) => {
    for (let b = 0; b < s.bins; b++) noise[b] += s.mag[f][b];
  });
  for (let b = 0; b < s.bins; b++) noise[b] = (noise[b] / quiet.length) * 1.35;
  const over = 0.9 + strength * 1.9;
  const floor = 1 - strength * 0.96;
  for (let f = 0; f < s.frames; f++) {
    for (let b = 0; b < s.bins; b++) {
      const m = s.mag[f][b];
      const g = Math.max(0, (m - over * noise[b]) / (m + 1e-9));
      s.mag[f][b] = m * (floor + (1 - floor) * g);
    }
  }
  let out = istft(s, src.length);
  if (hpf) {
    // one-pole high-pass at ~90 Hz
    const fc = 90 / buffer.sampleRate;
    const rc = 1 / (2 * Math.PI * fc);
    const dt = 1;
    const alpha = rc / (rc + dt);
    let prevIn = 0;
    let prevOut = 0;
    for (let i = 0; i < out.length; i++) {
      const y = alpha * (prevOut + out[i] - prevIn);
      prevIn = out[i];
      prevOut = y;
      out[i] = y;
    }
  }
  // normalise back to the original peak level
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  const gain = peak > 0 ? Math.min(1.6, 0.92 / peak) : 1;
  for (let i = 1; i < out.length - 1; i++) out[i] *= gain;

  return {
    url: wavUrl(out, buffer.sampleRate),
    before: peaks(buffer, 320),
    after: framePeaks(out, 320),
    snrGainDb: estimateSnrGain(src, out, buffer.sampleRate),
  };
}

/** Frame-wise peak envelope for a raw sample buffer. */
export function framePeaks(ch: Float32Array, buckets: number): number[] {
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
  return out;
}

/**
 * Estimate the SNR improvement: compare the noise floor (10th percentile of
 * short-window energy) against the speech level (90th percentile).
 */
export function estimateSnrGain(before: Float32Array, after: Float32Array, sampleRate: number): number {
  const win = Math.max(64, Math.floor(sampleRate * 0.02));
  const frames = (buf: Float32Array) => {
    const out: number[] = [];
    for (let i = 0; i + win < buf.length; i += win) {
      let s = 0;
      for (let k = i; k < i + win; k++) s += buf[k] * buf[k];
      out.push(Math.sqrt(s / win));
    }
    return out.sort((a, b) => a - b);
  };
  const pick = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 1e-6;
  const fb = frames(before);
  const fa = frames(after);
  if (!fb.length || !fa.length) return 0;
  const snrBefore = 20 * Math.log10(Math.max(pick(fb, 0.9), 1e-6) / Math.max(pick(fb, 0.1), 1e-6));
  const snrAfter = 20 * Math.log10(Math.max(pick(fa, 0.9), 1e-6) / Math.max(pick(fa, 0.1), 1e-6));
  return Math.max(0, snrAfter - snrBefore);
}

/* -------------------------------------------------------- source separation */

export interface Stem {
  name: string;
  nameEn: string;
  url: string;
  peaks: number[];
  energyDb: number;
}

export function separate(buffer: AudioBuffer, stems: 2 | 4): Stem[] {
  const src = new Float32Array(buffer.getChannelData(0));
  const s = stft(src, 512, 256);
  // Per-bin temporal stability separates steady tonal content from transient speech.
  const stability = new Float32Array(s.bins);
  for (let b = 0; b < s.bins; b++) {
    let mu = 0;
    for (let f = 0; f < s.frames; f++) mu += s.mag[f][b];
    mu /= s.frames;
    let varr = 0;
    for (let f = 0; f < s.frames; f++) varr += (s.mag[f][b] - mu) ** 2;
    varr /= s.frames;
    stability[b] = mu > 1e-4 ? Math.sqrt(varr) / (mu + 1e-9) : 1;
  }
  const tonalWeight = (b: number) => 1 / (1 + Math.exp((stability[b] - 0.75) * 6));

  const makeStem = (keep: (b: number) => number): Float32Array => {
    const copy: Stft = {
      frames: s.frames,
      bins: s.bins,
      hop: s.hop,
      size: s.size,
      mag: s.mag.map((m) => new Float32Array(m)),
      phase: s.phase.map((p) => new Float32Array(p)),
    };
    for (let f = 0; f < copy.frames; f++) {
      for (let b = 0; b < copy.bins; b++) copy.mag[f][b] *= keep(b);
    }
    return istft(copy, src.length);
  };

  const normalise = (a: Float32Array): Float32Array => {
    let peak = 0;
    for (let i = 0; i < a.length; i++) peak = Math.max(peak, Math.abs(a[i]));
    const g = peak > 0 ? 0.9 / peak : 1;
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = a[i] * g;
    return out;
  };

  const vocalsLike = normalise(makeStem((b) => 1 - tonalWeight(b)));
  const tonalLike = normalise(makeStem((b) => tonalWeight(b)));

  const toStem = (name: string, nameEn: string, a: Float32Array): Stem => ({
    name,
    nameEn,
    url: wavUrl(a, buffer.sampleRate),
    peaks: framePeaks(a, 320),
    energyDb: Math.round(20 * Math.log10(Math.max(rms(a), 1e-6)) * 10) / 10,
  });

  if (stems === 2) {
    return [toStem('人声', 'Vocals', vocalsLike), toStem('伴奏', 'Instrumental', tonalLike)];
  }
  const lowBand = normalise(makeStem((b) => (b < 18 ? 1 - tonalWeight(b) : 0)));
  const midBand = normalise(makeStem((b) => (b >= 18 && b < 60 ? 1 - tonalWeight(b) : 0)));
  const highBand = normalise(makeStem((b) => (b >= 60 ? 1 - tonalWeight(b) : 0)));
  return [
    toStem('人声', 'Vocals', midBand),
    toStem('鼓组', 'Drums', highBand),
    toStem('贝斯', 'Bass', lowBand),
    toStem('其他', 'Other', tonalLike),
  ];
}

/* -------------------------------------------------------------- music gen */

const NOTE = (semi: number) => 440 * 2 ** (semi / 12);

export function promptToPlan(prompt: string, tempo: number, key: 'major' | 'minor', duration: number) {
  const lower = prompt.toLowerCase();
  const isCalm = /calm|舒缓|slow|慢|piano|钢琴|深夜|reading/.test(lower);
  const isTense = /tense|紧张|fast|快|action|追逐|electronic|电子/.test(lower);
  const isLofi = /lofi|lo-fi|hip ?hop|慵懒|复古|tape/.test(lower);
  const scale = key === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const progressions: Record<string, number[][]> = {
    calm: [[0, 3, 4], [0, 3, 4], [-2, 2, 5], [-4, 0, 3]],
    tense: [[0, 3, 6], [-1, 2, 5], [0, 3, 6], [1, 4, 7]],
    lofi: [[0, 2, 4], [3, 5, 0], [-2, 0, 2], [1, 3, 5]],
  };
  const kind = isCalm ? 'calm' : isTense ? 'tense' : isLofi ? 'lofi' : 'calm';
  const base = 0;
  const bars = Math.max(1, Math.round((duration * tempo) / 60 / 4));
  const chords: number[][] = [];
  for (let b = 0; b < bars; b++) {
    const shape = progressions[kind][b % progressions[kind].length];
    chords.push(shape.map((d) => base + scale[(d + 7) % 7] + Math.floor((d + 7) / 7) * 12));
  }
  return {
    kind,
    chords,
    tempo,
    duration,
    waveform: isLofi ? 'triangle' : isCalm ? 'sine' : 'sawtooth',
    bassWave: isTense ? 'square' : 'sine',
    brightness: isTense ? 1 : isCalm ? 0.45 : 0.65,
    swing: isLofi ? 0.16 : 0,
  } as const;
}

export async function renderMusic(
  prompt: string,
  tempo: number,
  key: 'major' | 'minor',
  duration: number
): Promise<{ url: string; peaks: number[]; plan: ReturnType<typeof promptToPlan> }> {
  const plan = promptToPlan(prompt, tempo, key, duration);
  const sr = 22050;
  const OC: typeof OfflineAudioContext =
    (window as unknown as { OfflineAudioContext: typeof OfflineAudioContext }).OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new OC(1, sr * duration, sr);
  const master = ctx.createGain();
  master.gain.value = 0.85;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);

  const beat = 60 / tempo;
  const barLen = beat * 4;

  plan.chords.forEach((chord, barIndex) => {
    const start = barIndex * barLen;
    if (start >= duration) return;
    chord.forEach((semi, vi) => {
      const o = ctx.createOscillator();
      o.type = plan.waveform;
      o.frequency.value = NOTE(semi + (vi === 0 ? 12 : 12 + vi * 0)) + (vi - 1) * 2;
      const g = ctx.createGain();
      const amp = (plan.kind === 'calm' ? 0.12 : 0.09) / (1 + vi * 0.25);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(amp, start + Math.min(0.35, barLen * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0008, start + barLen);
      o.connect(g).connect(master);
      o.start(start);
      o.stop(Math.min(duration, start + barLen));
    });
    // bass
    const b = ctx.createOscillator();
    b.type = plan.bassWave;
    b.frequency.value = NOTE(chord[0] - 24);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(plan.kind === 'tense' ? 0.3 : 0.2, start);
    bg.gain.exponentialRampToValueAtTime(0.001, start + barLen * 0.95);
    b.connect(bg).connect(master);
    b.start(start);
    b.stop(Math.min(duration, start + barLen));
    // percussive pulse
    const pulses = plan.kind === 'calm' ? 1 : plan.kind === 'lofi' ? 2 : 4;
    for (let p = 0; p < pulses; p++) {
      const t = start + (p * barLen) / pulses + (p % 2 === 1 ? plan.swing : 0);
      if (t >= duration) break;
      const noise = ctx.createBufferSource();
      const nb = ctx.createBuffer(1, Math.floor(sr * 0.06), sr);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length) ** 2;
      noise.buffer = nb;
      const ng = ctx.createGain();
      ng.gain.value = plan.kind === 'tense' ? 0.22 : 0.13;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = plan.brightness * 3200;
      noise.connect(hp).connect(ng).connect(master);
      noise.start(t);
    }
  });

  const rendered = await ctx.startRendering();
  const ch = new Float32Array(rendered.getChannelData(0));
  return { url: wavUrl(ch, sr), peaks: peaks(rendered, 320), plan };
}

/* ------------------------------------------------------------------ speech */

export function speak(text: string, locale: 'zh' | 'en', rate: number, pitch: number, voice?: SpeechSynthesisVoice | null): Promise<void> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (!synth) return resolve();
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = locale === 'zh' ? 'zh-CN' : 'en-US';
    u.rate = rate;
    u.pitch = pitch;
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}

export function listVoices(locale: 'zh' | 'en'): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const prefix = locale === 'zh' ? 'zh' : 'en';
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(prefix));
}

/** Synthetic envelope so TTS results still visualise as a waveform. */
export function envelopeFromText(text: string, locale: 'zh' | 'en', buckets = 320): number[] {
  const units = locale === 'zh' ? [...text] : text.split(/\s+/);
  const out: number[] = [];
  units.forEach((u, i) => {
    const amp = 0.35 + 0.5 * (Math.abs(Math.sin(i * 1.7)) * 0.7 + 0.3);
    for (let k = 0; k < Math.max(1, Math.round(buckets / units.length)); k++) {
      out.push(amp * (0.55 + 0.45 * Math.abs(Math.sin((i * 3 + k) * 0.9))));
    }
  });
  const step = Math.max(1, Math.floor(out.length / buckets));
  return out.filter((_, i) => i % step === 0).slice(0, buckets);
}
