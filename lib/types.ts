export type Locale = 'zh' | 'en';

/** A bilingual string. */
export interface L {
  zh: string;
  en: string;
}

export type FrameworkId =
  | 'transformersjs'
  | 'mediapipe'
  | 'onnxruntime-web'
  | 'tensorflowjs'
  | 'webllm'
  | 'whisper-wasm'
  | 'opencvjs'
  | 'tflite';

export interface ModelEntry {
  id: string;
  name: string;
  framework: FrameworkId;
  size: string;
  license: string;
  languages: string[];
  description: string;
  demoUrl?: string;
  docsUrl?: string;
}

export type ModelCatalog = Record<string, Record<string, ModelEntry[]>>;

/* ------------------------------------------------------------------ inputs */

export type InputMode =
  | 'text'
  | 'lines'
  | 'image'
  | 'image+text'
  | 'audio'
  | 'audio+text'
  | 'video';

export interface TextSample {
  id: string;
  label: L;
  /** Primary text payload. */
  text: L;
  /** Secondary fields, keyed by TextField.key */
  fields?: Record<string, L>;
  /** Line-based payload (embedding / reranker / semantic search). */
  lines?: { text: L; meta?: L }[];
}

export interface MediaSample {
  id: string;
  label: L;
  /** Absolute path under /public. */
  src: string;
  /** Optional known reference (e.g. the clean version of a degraded image). */
  reference?: string;
  /** Ground-truth payload used by the simulated engine for built-in samples. */
  truth?: unknown;
  /** Friendly caption shown under the preview. */
  caption?: L;
  /** Optional accompanying text payload (image+text / audio+text modes). */
  text?: L;
  /** Optional secondary fields, keyed by TextField.key. */
  fields?: Record<string, L>;
}

export type Sample = TextSample | MediaSample;

export const isTextSample = (s: Sample): s is TextSample => 'text' in s;
export const isMediaSample = (s: Sample): s is MediaSample => 'src' in s;

/* ----------------------------------------------------------------- params */

export interface ParamSpec {
  key: string;
  label: L;
  type: 'select' | 'range' | 'toggle' | 'text';
  options?: { value: string; label: L }[];
  min?: number;
  max?: number;
  step?: number;
  default: string | number | boolean;
  hint?: L;
}

/* ------------------------------------------------------------------ specs */

export type OutputKind =
  | 'labels'
  | 'text'
  | 'chat'
  | 'json'
  | 'code'
  | 'embedding'
  | 'ranking'
  | 'search'
  | 'detection'
  | 'segmentation'
  | 'ocr'
  | 'depth'
  | 'restoration'
  | 'generated-image'
  | 'inpainting'
  | 'transcript'
  | 'synth-audio'
  | 'audio-compare'
  | 'stems'
  | 'music'
  | 'landmarks-face'
  | 'landmarks-pose'
  | 'landmarks-hand'
  | 'tracking'
  | 'video-timeline';

export interface DemoSpec {
  category: string;
  subcategory: string;
  /** Short headline shown on the demo page. */
  tagline: L;
  /** Task description. */
  task: L;
  inputMode: InputMode;
  outputKind: OutputKind;
  samples: Sample[];
  params?: ParamSpec[];
  /** Field definitions for `lines` / `image+text` / `audio+text` modes. */
  textFields?: { key: string; label: L; placeholder?: L; multiline?: boolean }[];
  /** Enable the webcam capture panel (used by the real-time category). */
  webcam?: boolean;
  /** Enable brush-mask painting (inpainting). */
  brush?: boolean;
  /** Result column title hint. */
  resultTitle?: L;
}

export interface TaxonomyEntry {
  slug: string;
  name: L;
  blurb: L;
  subcategories: { slug: string; name: L; blurb: L }[];
}

/* ------------------------------------------------------------ runtime input */

export interface MediaState {
  src: string;
  /** true when the media comes from /public/samples (ground truth available) */
  builtin: boolean;
  sampleId?: string;
  reference?: string;
  name?: string;
}

export interface InputState {
  text: string;
  fields: Record<string, string>;
  lines: string[];
  media?: MediaState;
}
