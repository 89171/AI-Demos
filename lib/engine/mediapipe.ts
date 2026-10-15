/**
 * Real MediaPipe Tasks inference (face / pose / hand / object).
 *
 * Models are the official TFLite bundles from storage.googleapis.com/mediapipe-models
 * (3–8 MB each); the WASM runtime is vendored to /public/mediapipe by
 * scripts/copy-ort-wasm.cjs. Everything runs on CPU/XNNPACK — these nets are tiny.
 */
import type { LandmarkSet } from './image-tasks';

export type MpKind = 'face-detect' | 'face-mesh' | 'pose' | 'hand' | 'object' | 'classify';
type LandmarkKind = Exclude<MpKind, 'object' | 'classify'>;

const GCS = 'https://storage.googleapis.com/mediapipe-models';
export const MP_URL: Record<MpKind, string> = {
  'face-detect': `${GCS}/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`,
  'face-mesh': `${GCS}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
  pose: `${GCS}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
  hand: `${GCS}/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`,
  classify: `${GCS}/image_classifier/efficientnet_lite0/float32/1/efficientnet_lite0.tflite`,
  object: `${GCS}/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`,
};

/** Default model per live-overlay variant. */
export const MP_VARIANT: Record<'face' | 'pose' | 'hand', MpKind> = {
  face: 'face-mesh',
  pose: 'pose',
  hand: 'hand',
};

export const MP_VARIANT_KINDS = { 'face-detect': 1, 'face-mesh': 1, pose: 1, hand: 1 } as const;

type Source = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;
type Mode = 'IMAGE' | 'VIDEO';
type Task = any;

let modPromise: Promise<typeof import('@mediapipe/tasks-vision')> | null = null;
const tasks = new Map<string, Promise<Task>>();

const mod = () =>
  (modPromise ??= import('@mediapipe/tasks-vision').then((m) => {
    // The runtime reports "INFO: Created TensorFlow Lite XNNPACK delegate" via console.error,
    // which trips the Next dev error overlay. Route INFO lines to console.info.
    const err = console.error;
    console.error = (...a: unknown[]) => (typeof a[0] === 'string' && a[0].startsWith('INFO:') ? console.info(...a) : err(...a));
    return m;
  }));

function getTask(kind: MpKind, mode: Mode): Promise<Task> {
  const key = `${kind}|${mode}`;
  let job = tasks.get(key);
  if (!job) {
    job = (async () => {
      const mp = await mod();
      const fileset = await mp.FilesetResolver.forVisionTasks('/mediapipe');
      const o = { baseOptions: { modelAssetPath: MP_URL[kind] }, runningMode: mode };
      switch (kind) {
        case 'face-detect':
          return mp.FaceDetector.createFromOptions(fileset, o);
        case 'face-mesh':
          return mp.FaceLandmarker.createFromOptions(fileset, { ...o, numFaces: 1 });
        case 'pose':
          return mp.PoseLandmarker.createFromOptions(fileset, { ...o, numPoses: 1 });
        case 'hand':
          return mp.GestureRecognizer.createFromOptions(fileset, { ...o, numHands: 2 });
        case 'classify':
          return mp.ImageClassifier.createFromOptions(fileset, { ...o, maxResults: 3 });
        case 'object':
          return mp.ObjectDetector.createFromOptions(fileset, { ...o, scoreThreshold: 0.05, maxResults: 12 });
      }
    })();
    tasks.set(key, job);
    job.catch(() => tasks.delete(key));
  }
  return job;
}

const dims = (s: Source) =>
  s instanceof HTMLVideoElement
    ? { w: s.videoWidth, h: s.videoHeight }
    : s instanceof HTMLImageElement
      ? { w: s.naturalWidth, h: s.naturalHeight }
      : { w: s.width, h: s.height };

const bounds = (pts: { x: number; y: number }[]) => {
  if (!pts.length) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

/** Run a landmark-style task and return pixel-space points scaled to `out`. */
export async function detectLandmarks(
  kind: LandmarkKind,
  src: Source,
  opts: { mode?: Mode; ts?: number; out?: { w: number; h: number } } = {}
): Promise<{ set: LandmarkSet; gesture?: string }> {
  const mode = opts.mode ?? 'IMAGE';
  const [task, mp] = await Promise.all([getTask(kind, mode), mod()]);
  const { w: sw, h: sh } = dims(src);
  const { w, h } = opts.out ?? { w: sw, h: sh };
  const call = kind === 'hand' ? 'recognize' : 'detect'; // GestureRecognizer has its own method names
  const res = mode === 'VIDEO' ? task[`${call}ForVideo`](src, opts.ts ?? performance.now()) : task[call](src);
  const px = (p: { x: number; y: number; visibility?: number }) => ({
    x: p.x * w,
    y: p.y * h,
    score: p.visibility ?? 1,
  });
  const conn = (c: { start: number; end: number }[], n: number) =>
    n ? c.map((e) => [e.start, e.end] as [number, number]) : []; // nothing detected → nothing to connect

  if (kind === 'face-detect') {
    const d = res.detections?.[0];
    const bb = d?.boundingBox;
    const points = (d?.keypoints ?? []).map(px);
    const box = bb
      ? { x: (bb.originX / sw) * w, y: (bb.originY / sh) * h, w: (bb.width / sw) * w, h: (bb.height / sh) * h }
      : bounds(points);
    return { set: { kind: 'face', box, points, edges: [] } };
  }
  if (kind === 'face-mesh') {
    const points = (res.faceLandmarks?.[0] ?? []).map(px);
    return { set: { kind: 'face', box: bounds(points), points, edges: conn(mp.FaceLandmarker.FACE_LANDMARKS_CONTOURS, points.length) } };
  }
  if (kind === 'pose') {
    const points = (res.landmarks?.[0] ?? []).map(px);
    return { set: { kind: 'pose', box: bounds(points), points, edges: conn(mp.PoseLandmarker.POSE_CONNECTIONS, points.length) } };
  }
  const points = (res.landmarks?.[0] ?? []).map(px);
  const g = res.gestures?.[0]?.[0]?.categoryName as string | undefined;
  return {
    set: { kind: 'hand', box: bounds(points), points, edges: conn(mp.HandLandmarker.HAND_CONNECTIONS, points.length) },
    gesture: g && g !== 'None' ? g.toLowerCase() : undefined,
  };
}

export interface MpBox {
  label: string;
  score: number;
  /** normalised 0..1 */
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function detectObjectsMp(src: Source, threshold: number): Promise<MpBox[]> {
  const task = await getTask('object', 'IMAGE');
  const { w, h } = dims(src);
  const res = task.detect(src);
  return (res.detections ?? [])
    .filter((d: { categories: { score: number }[] }) => d.categories[0].score >= threshold)
    .map((d: { categories: { score: number; categoryName: string }[]; boundingBox: { originX: number; originY: number; width: number; height: number } }) => ({
      label: d.categories[0].categoryName,
      score: Math.round(d.categories[0].score * 1000) / 1000,
      x: d.boundingBox.originX / w,
      y: d.boundingBox.originY / h,
      w: d.boundingBox.width / w,
      h: d.boundingBox.height / h,
    }));
}

const iou = (a: MpBox, b: MpBox) => {
  const iw = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const ih = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (iw <= 0 || ih <= 0) return 0;
  const inter = iw * ih;
  return inter / (a.w * a.h + b.w * b.h - inter);
};

/** Greedy IoU association of per-frame detections into persistent IDs (ByteTrack-lite). */
export function makeTracker(maxAgeFrames: number) {
  let nextId = 1;
  let tracks: { id: number; box: MpBox; age: number }[] = [];
  return (dets: MpBox[]) => {
    const out: (MpBox & { id: number })[] = [];
    const free = new Set(tracks.keys());
    for (const d of [...dets].sort((a, b) => b.score - a.score)) {
      let best = -1;
      let bestIou = 0.25;
      for (const i of free) {
        const v = tracks[i].box.label === d.label ? iou(tracks[i].box, d) : 0;
        if (v > bestIou) [best, bestIou] = [i, v];
      }
      if (best >= 0) {
        free.delete(best);
        tracks[best] = { ...tracks[best], box: d, age: 0 };
        out.push({ ...d, id: tracks[best].id });
      } else {
        tracks.push({ id: nextId, box: d, age: 0 });
        out.push({ ...d, id: nextId++ });
      }
    }
    for (const i of free) tracks[i].age++;
    tracks = tracks.filter((t) => t.age <= maxAgeFrames);
    return out;
  };
}

/** Top-1 ImageNet label for one frame/image. */
export async function classifyImage(src: Source): Promise<{ label: string; score: number }> {
  const c = (await getTask('classify', 'IMAGE')).classify(src).classifications[0]?.categories[0];
  return { label: c?.categoryName ?? '—', score: c?.score ?? 0 };
}
