/**
 * Video watermark removal — browser pipeline (ported from toolgarden.xyz).
 *
 * Flow: sample the watermark selection across time → build a repair patch with a
 * temporal median (moving background) or a single-frame MI-GAN inpaint (static
 * background) → composite the patch over every frame while re-encoding with
 * WebCodecs VideoEncoder + mp4-muxer → mux the original audio track back with
 * ffmpeg.wasm.
 *
 * Everything runs locally in the browser; the video never leaves the machine.
 *
 * Demo mode (`useMigan: false`) skips the 28 MB MI-GAN weights and always uses
 * the temporal-median patch; the real-weights path enables MI-GAN and audio mux.
 */
import { miganInpaint } from './migan';
import { lamaInpaintRegion } from './lama';

export interface VideoRect {
  /** normalised 0..1 coordinates relative to the video frame */
  x: number;
  y: number;
  w: number;
  h: number;
}

export type VideoRepairMethod = 'auto' | 'temporal' | 'ai' | 'hq';
export type VideoAppliedMethod = 'temporal' | 'ai' | 'hq';

export interface VideoWatermarkOptions {
  src: string;
  rect: VideoRect;
  method: VideoRepairMethod;
  /** enable the MI-GAN single-frame inpaint (real-weights path) */
  useMigan: boolean;
  /** MI-GAN pipeline ONNX url, required when useMigan is true */
  miganRepo?: string;
  /** big-lama fp32 ONNX url — enables the explicit 'hq' repair method */
  lamaRepo?: string;
  locale: 'zh' | 'en';
  onPhase?: (phase: string) => void;
}

export interface VideoWatermarkSuccess {
  ok: true;
  url: string;
  filename: string;
  width: number;
  height: number;
  method: VideoAppliedMethod;
  hasAudio: boolean;
  outputSize: number;
  durationMs: number;
  /** true when an explicit "ai" request was downgraded to temporal (demo mode) */
  fallback?: boolean;
}

export interface VideoWatermarkFailure {
  ok: false;
  code:
    | 'selection_required'
    | 'unsupported_browser'
    | 'unsupported_input'
    | 'video_too_long'
    | 'video_load_failed'
    | 'encode_failed'
    | 'canvas_context'
    | 'general';
  detail?: string;
}

export type VideoWatermarkResult = VideoWatermarkSuccess | VideoWatermarkFailure;

/** Demo limits — shorter than toolgarden's to keep playground runs snappy. */
export const MAX_VIDEO_DURATION_SECONDS = 120;
export const MAX_VIDEO_FILE_SIZE = 200 * 1024 * 1024;
/** Below this average per-pixel deviation the selection background counts as static. */
const STATIC_MOTION_THRESHOLD = 0.015;
const MIN_TIME_SAMPLES = 8;
const MAX_TIME_SAMPLES = 24;

const AVC_CODEC_CANDIDATES = [
  'avc1.640034',
  'avc1.640033',
  'avc1.640032',
  'avc1.640028',
  'avc1.4D4028',
  'avc1.42E03C',
  'avc1.42E01E',
] as const;

/* ----------------------------------------------------------------- helpers */

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('seek failed'));
    };
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = Math.min(time, Math.max(0, (video.duration || 0) - 0.05));
  });
}

function loadVideoElement(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.onloadeddata = () => {
      if (!video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration) || video.duration <= 0) {
        reject(new Error('video metadata unavailable'));
        return;
      }
      resolve(video);
    };
    video.onerror = () => reject(new Error('video load failed'));
    video.src = src;
  });
}

function createCanvas(width: number, height: number): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas.getContext('2d') ? canvas : null;
}

function sampleCountFor(durationSeconds: number): number {
  const bounded = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 10;
  return Math.min(MAX_TIME_SAMPLES, Math.max(MIN_TIME_SAMPLES, Math.round(Math.min(24, Math.max(8, bounded * 1.6)))));
}

function sampleTimestamps(durationSeconds: number): number[] {
  const duration = Number.isFinite(durationSeconds) && durationSeconds > 0.2 ? durationSeconds : 1;
  const count = sampleCountFor(duration);
  const margin = Math.min(0.25, duration * 0.05);
  const usable = Math.max(0.1, duration - margin * 2);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const ratio = count === 1 ? 0.5 : i / (count - 1);
    out.push(margin + usable * ratio);
  }
  return out;
}

/** Per-pixel temporal median across the sampled selection buffers. */
function computeTemporalMedian(samples: Uint8ClampedArray[]): { median: Uint8ClampedArray; motion: number } {
  if (!samples.length) return { median: new Uint8ClampedArray(0), motion: 0 };
  const len = samples[0].length;
  const usable = samples.filter((s) => s.length === len);
  if (!usable.length) return { median: new Uint8ClampedArray(0), motion: 0 };
  const n = usable.length;
  const median = new Uint8ClampedArray(len);
  let deviationSum = 0;
  let deviationCount = 0;
  const bucket = new Uint32Array(n);
  for (let i = 0; i < len; i++) {
    for (let f = 0; f < n; f++) bucket[f] = usable[f][i];
    const sorted = Array.from(bucket).sort((a, b) => a - b);
    const mid = n >> 1;
    const value = n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    median[i] = value;
    for (let f = 0; f < n; f++) {
      deviationSum += Math.abs(usable[f][i] - value);
      deviationCount += 1;
    }
  }
  const motion = deviationCount > 0 ? deviationSum / deviationCount / 255 : 0;
  return { median, motion: Math.min(1, Math.max(0, motion)) };
}

function decideRepairMethod(method: VideoRepairMethod, motion: number, useMigan: boolean, useLama: boolean): VideoAppliedMethod {
  if (method === 'temporal') return 'temporal';
  // hq: LaMa, explicit opt-in only — auto never selects it (matches toolgarden).
  // Without the LaMa weights it degrades to MI-GAN, then to the temporal patch.
  if (method === 'hq') return useLama ? 'hq' : useMigan ? 'ai' : 'temporal';
  if (method === 'ai') return useMigan ? 'ai' : 'temporal';
  // auto: a visibly moving background lets the temporal median rebuild it for free
  if (motion >= STATIC_MOTION_THRESHOLD) return 'temporal';
  return useMigan ? 'ai' : 'temporal';
}

/** Feathered alpha so the patch blends into the surrounding frame. */
function applyFeatheredAlpha(canvas: HTMLCanvasElement, feather: number) {
  if (feather <= 0) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const mask = document.createElement('canvas');
  mask.width = canvas.width;
  mask.height = canvas.height;
  const maskContext = mask.getContext('2d');
  if (!maskContext) return;
  const blur = Math.max(1, Math.round(feather / 2));
  const inset = Math.max(2, Math.round(feather));
  maskContext.filter = `blur(${blur}px)`;
  maskContext.fillStyle = '#ffffff';
  maskContext.fillRect(inset, inset, Math.max(1, canvas.width - inset * 2), Math.max(1, canvas.height - inset * 2));
  maskContext.filter = 'none';
  context.globalCompositeOperation = 'destination-in';
  context.drawImage(mask, 0, 0);
  context.globalCompositeOperation = 'source-over';
}

async function pickVideoCodec(width: number, height: number, bitrate: number, framerate: number): Promise<VideoEncoderConfig | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const codec of AVC_CODEC_CANDIDATES) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate, framerate };
    try {
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) return config;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

/* ------------------------------------------------------------ ffmpeg audio */

import { loadFfmpeg } from './ffmpeg-client';

async function muxOriginalAudio(videoBlob: Blob, sourceSrc: string): Promise<Blob> {
  const ffmpeg = await loadFfmpeg();
  const silentName = 'output-silent.mp4';
  const sourceFile = 'input-source.mp4';
  const outputName = 'output-with-audio.mp4';

  await ffmpeg.writeFile(silentName, new Uint8Array(await videoBlob.arrayBuffer()));
  const resp = await fetch(sourceSrc);
  await ffmpeg.writeFile(sourceFile, new Uint8Array(await resp.arrayBuffer()));

  try {
    await ffmpeg.exec([
      '-i', silentName,
      '-i', sourceFile,
      '-map', '0:v:0',
      '-map', '1:a:0?',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '160k',
      '-movflags', '+faststart',
      outputName,
    ]);
    const data = await ffmpeg.readFile(outputName);
    if (!data.byteLength || data.byteLength < 1024) throw new Error('muxed output too small');
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    return new Blob([copy], { type: 'video/mp4' });
  } finally {
    await Promise.allSettled([
      ffmpeg.deleteFile(silentName),
      ffmpeg.deleteFile(sourceFile),
      ffmpeg.deleteFile(outputName),
    ]);
  }
}

/* ------------------------------------------------------------ main pipeline */

async function sampleSelectionPixels(
  video: HTMLVideoElement,
  timestamps: number[],
  rectPx: { x: number; y: number; w: number; h: number },
  onPhase?: (phase: string) => void,
  locale?: 'zh' | 'en'
): Promise<Uint8ClampedArray[]> {
  const canvas = createCanvas(rectPx.w, rectPx.h);
  if (!canvas) throw new Error('canvas unavailable');
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  const samples: Uint8ClampedArray[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    onPhase?.(locale === 'zh' ? `采样选区像素 ${i + 1}/${timestamps.length}` : `Sampling selection ${i + 1}/${timestamps.length}`);
    await seekTo(video, timestamps[i]);
    context.drawImage(video, rectPx.x, rectPx.y, rectPx.w, rectPx.h, 0, 0, canvas.width, canvas.height);
    samples.push(context.getImageData(0, 0, canvas.width, canvas.height).data);
  }
  return samples;
}

async function buildMiganPatch(
  video: HTMLVideoElement,
  time: number,
  videoW: number,
  videoH: number,
  rectPx: { x: number; y: number; w: number; h: number },
  feather: number,
  repo: string,
  onPhase?: (phase: string) => void,
  locale?: 'zh' | 'en'
): Promise<HTMLCanvasElement | null> {
  await seekTo(video, time);
  const frame = createCanvas(videoW, videoH);
  if (!frame) return null;
  const fc = frame.getContext('2d', { willReadFrequently: true })!;
  fc.drawImage(video, 0, 0, videoW, videoH);

  // rect → full-frame alpha mask for the shared MI-GAN engine
  const alpha = new Float32Array(videoW * videoH);
  for (let y = rectPx.y; y < rectPx.y + rectPx.h; y++) {
    for (let x = rectPx.x; x < rectPx.x + rectPx.w; x++) {
      alpha[y * videoW + x] = 1;
    }
  }
  onPhase?.(locale === 'zh' ? 'MI-GAN 补全水印区域…' : 'MI-GAN filling the watermark area…');
  const result = await miganInpaint(frame, alpha, repo);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('inpaint result decode failed'));
    img.src = result.url;
  });
  const patch = createCanvas(rectPx.w, rectPx.h);
  if (!patch) return null;
  patch.getContext('2d')!.drawImage(img, rectPx.x, rectPx.y, rectPx.w, rectPx.h, 0, 0, rectPx.w, rectPx.h);
  applyFeatheredAlpha(patch, feather);
  return patch;
}

async function buildLamaPatch(
  video: HTMLVideoElement,
  time: number,
  videoW: number,
  videoH: number,
  rectPx: { x: number; y: number; w: number; h: number },
  feather: number,
  repo: string,
  onPhase?: (phase: string) => void,
  locale?: 'zh' | 'en'
): Promise<HTMLCanvasElement | null> {
  await seekTo(video, time);
  const frame = createCanvas(videoW, videoH);
  if (!frame) return null;
  const fc = frame.getContext('2d', { willReadFrequently: true })!;
  fc.drawImage(video, 0, 0, videoW, videoH);

  onPhase?.(
    locale === 'zh' ? 'LaMa 高清补全（首次运行下载约 198 MB）…' : 'LaMa HD inpainting (downloads ~198 MB on first run)…'
  );
  const resultUrl = await lamaInpaintRegion(
    frame,
    rectPx,
    repo,
    feather,
    (ratio) =>
      onPhase?.(
        locale === 'zh' ? `LaMa 权重下载 ${Math.round(ratio * 100)}%` : `LaMa weights download ${Math.round(ratio * 100)}%`
      )
  );
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('inpaint result decode failed'));
    img.src = resultUrl;
  });
  const patch = createCanvas(rectPx.w, rectPx.h);
  if (!patch) return null;
  patch.getContext('2d')!.drawImage(img, rectPx.x, rectPx.y, rectPx.w, rectPx.h, 0, 0, rectPx.w, rectPx.h);
  applyFeatheredAlpha(patch, feather);
  return patch;
}

async function renderAndEncode(
  video: HTMLVideoElement,
  patchCanvas: HTMLCanvasElement,
  rectPx: { x: number; y: number; w: number; h: number },
  duration: number,
  onPhase?: (phase: string) => void,
  locale?: 'zh' | 'en'
): Promise<Blob> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  const framerate = 30;
  const bitrate = Math.min(20_000_000, Math.max(1_200_000, Math.round(width * height * framerate * 0.07)));
  const encoderConfig = await pickVideoCodec(width, height, bitrate, framerate);
  if (!encoderConfig) throw new Error('WebCodecs VideoEncoder unavailable');

  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: 'avc', width, height }, fastStart: 'in-memory' });

  const encoderState: { error: Error | null } = { error: null };
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      encoderState.error = error instanceof Error ? error : new Error(String(error));
    },
  });
  encoder.configure(encoderConfig);

  const canvas = createCanvas(width, height)!;
  const context2d = canvas.getContext('2d', { alpha: false })!;

  video.pause();
  video.currentTime = 0;

  const KEYFRAME_INTERVAL_SECONDS = 2;
  const MAX_ENCODER_QUEUE_SIZE = 8;
  let lastKeyTime = -Infinity;
  let settled = false;

  try {
    await new Promise<void>((resolve, reject) => {
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      const step = (_now: number, metadata: VideoFrameCallbackMetadata) => {
        if (settled) return;
        try {
          if (encoderState.error) {
            fail(encoderState.error);
            return;
          }
          context2d.drawImage(video, 0, 0, width, height);
          context2d.drawImage(patchCanvas, rectPx.x, rectPx.y);

          const timestamp = Math.max(0, Math.round(metadata.mediaTime * 1_000_000));
          const expectedDuration = Math.round((metadata.expectedDisplayTime - metadata.mediaTime) * 1_000_000);
          const frame = new VideoFrame(canvas, { timestamp, duration: expectedDuration > 0 ? expectedDuration : 33_333 });
          const isKeyFrame = metadata.mediaTime - lastKeyTime >= KEYFRAME_INTERVAL_SECONDS;
          if (isKeyFrame) lastKeyTime = metadata.mediaTime;
          encoder.encode(frame, { keyFrame: isKeyFrame });
          frame.close();

          onPhase?.(
            locale === 'zh'
              ? `重编码 ${Math.min(100, Math.round((metadata.mediaTime / Math.max(0.1, duration)) * 100))}%`
              : `Re-encoding ${Math.min(100, Math.round((metadata.mediaTime / Math.max(0.1, duration)) * 100))}%`
          );

          if (video.ended || metadata.mediaTime >= duration - 0.04) {
            finish();
            return;
          }
          const pump = () => {
            if (settled) return;
            if (encoder.encodeQueueSize > MAX_ENCODER_QUEUE_SIZE) {
              requestAnimationFrame(pump);
              return;
            }
            video.requestVideoFrameCallback(step);
          };
          pump();
        } catch (error) {
          fail(error instanceof Error ? error : new Error(String(error)));
        }
      };

      video.onended = finish;
      video.requestVideoFrameCallback(step);
      video.play().catch(() => fail(new Error('playback blocked')));
    });
  } finally {
    video.pause();
    video.onended = null;
  }

  if (encoderState.error) {
    try {
      encoder.close();
    } catch {
      /* noop */
    }
    throw new Error(`encode failed: ${encoderState.error.message}`);
  }

  await encoder.flush();
  encoder.close();
  muxer.finalize();
  return new Blob([target.buffer], { type: 'video/mp4' });
}

/** Video watermark removal entry point. Returns a discriminated result, never throws. */
export async function removeVideoWatermark(options: VideoWatermarkOptions): Promise<VideoWatermarkResult> {
  const startedAt = performance.now();
  const { src, rect, method, useMigan, miganRepo, lamaRepo, locale, onPhase } = options;
  const useLama = Boolean(lamaRepo);

  if (!rect || rect.w <= 0 || rect.h <= 0) {
    return { ok: false, code: 'selection_required' };
  }
  if (
    typeof VideoEncoder === 'undefined' ||
    typeof HTMLVideoElement === 'undefined' ||
    typeof HTMLVideoElement.prototype.requestVideoFrameCallback !== 'function'
  ) {
    return { ok: false, code: 'unsupported_browser' };
  }
  if (useMigan && !miganRepo) {
    return { ok: false, code: 'general', detail: 'migan repo missing' };
  }

  let video: HTMLVideoElement | null = null;
  try {
    onPhase?.(locale === 'zh' ? '加载视频…' : 'Loading video…');
    video = await loadVideoElement(src);
    const width = video.videoWidth;
    const height = video.videoHeight;
    const duration = video.duration;
    if (duration > MAX_VIDEO_DURATION_SECONDS) {
      return { ok: false, code: 'video_too_long' };
    }

    const rectPx = {
      x: Math.max(0, Math.min(width - 2, Math.round(rect.x * width))),
      y: Math.max(0, Math.min(height - 2, Math.round(rect.y * height))),
      w: 0,
      h: 0,
    };
    rectPx.w = Math.max(4, Math.min(width - rectPx.x, Math.round(rect.w * width)));
    rectPx.h = Math.max(4, Math.min(height - rectPx.y, Math.round(rect.h * height)));

    const timestamps = sampleTimestamps(duration);
    onPhase?.(locale === 'zh' ? '时域采样…' : 'Temporal sampling…');
    const samples = await sampleSelectionPixels(video, timestamps, rectPx, onPhase, locale);
    const { median, motion } = computeTemporalMedian(samples);
    if (!median.length) return { ok: false, code: 'general' };

    const applied = decideRepairMethod(method, motion, useMigan, useLama);

    let patchCanvas: HTMLCanvasElement | null;
    if (applied === 'temporal') {
      patchCanvas = createCanvas(rectPx.w, rectPx.h);
      if (!patchCanvas) return { ok: false, code: 'canvas_context' };
      const pc = patchCanvas.getContext('2d')!;
      const imageData = pc.createImageData(rectPx.w, rectPx.h);
      imageData.data.set(median.subarray(0, imageData.data.length));
      pc.putImageData(imageData, 0, 0);
      applyFeatheredAlpha(patchCanvas, 8);
      if (useMigan && method === 'ai') {
        onPhase?.(
          locale === 'zh' ? '背景随时间变化，时域中值直接重建（无需 AI）' : 'Moving background — temporal median rebuilds it without AI'
        );
      }
    } else {
      const representativeTime = timestamps[Math.floor(timestamps.length / 2)];
      patchCanvas =
        applied === 'hq'
          ? await buildLamaPatch(video, representativeTime, width, height, rectPx, 8, lamaRepo!, onPhase, locale)
          : await buildMiganPatch(video, representativeTime, width, height, rectPx, 8, miganRepo!, onPhase, locale);
    }
    if (!patchCanvas) return { ok: false, code: 'canvas_context' };

    onPhase?.(locale === 'zh' ? 'WebCodecs 逐帧合成…' : 'Compositing frames with WebCodecs…');
    const videoBlob = await renderAndEncode(video, patchCanvas, rectPx, duration, onPhase, locale);

    let finalBlob = videoBlob;
    let hasAudio = false;
    if (useMigan || useLama) {
      try {
        onPhase?.(locale === 'zh' ? 'ffmpeg.wasm 回填音轨…' : 'Muxing the original audio with ffmpeg.wasm…');
        finalBlob = await muxOriginalAudio(videoBlob, src);
        hasAudio = true;
      } catch {
        // a silent output still counts as success
        finalBlob = videoBlob;
        hasAudio = false;
      }
    }

    onPhase?.(locale === 'zh' ? '完成' : 'Done');
    return {
      ok: true,
      url: URL.createObjectURL(finalBlob),
      filename: 'no-watermark.mp4',
      width,
      height,
      method: applied,
      hasAudio,
      outputSize: finalBlob.size,
      durationMs: Math.round(performance.now() - startedAt),
      fallback:
        (method === 'ai' && applied === 'temporal') || (method === 'hq' && applied !== 'hq') ? true : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/video load failed|metadata unavailable|seek failed/.test(message)) {
      return { ok: false, code: 'video_load_failed', detail: message };
    }
    if (/encode failed|VideoEncoder/.test(message)) {
      return { ok: false, code: 'encode_failed', detail: message };
    }
    return { ok: false, code: 'general', detail: message };
  } finally {
    if (video) {
      video.pause();
      video.removeAttribute('src');
    }
  }
}

