import type { ModelCatalog, ModelEntry } from '../types';
import raw from './models.json';
import extra from './extra-models.json';

// models.json is regenerated from ../WebAIModels by scripts/extract-models.cjs; entries that
// the upstream catalogue does not list live in extra-models.json so a re-extract cannot drop them.
const merged = Object.fromEntries(
  [...new Set([...Object.keys(raw), ...Object.keys(extra)])].map((c) => [
    c,
    { ...(raw as Record<string, object>)[c], ...(extra as Record<string, object>)[c] },
  ])
);

export const MODELS = merged as unknown as ModelCatalog;

export const listModels = (category: string, subcategory: string): ModelEntry[] =>
  MODELS[category]?.[subcategory] ?? [];

export const findModel = (category: string, subcategory: string, id: string): ModelEntry | undefined =>
  listModels(category, subcategory).find((m) => m.id === id);

export const FRAMEWORK_LABEL: Record<string, string> = {
  transformersjs: 'Transformers.js',
  'onnxruntime-web': 'ONNX Runtime Web',
  mediapipe: 'MediaPipe',
  tensorflowjs: 'TensorFlow.js',
  webllm: 'WebLLM',
  'whisper-wasm': 'whisper.cpp (WASM)',
  opencvjs: 'OpenCV.js',
  tflite: 'TFLite',
};

export const LICENSE_LABEL: Record<string, string> = {
  'apache-2-0': 'Apache-2.0',
  mit: 'MIT',
  'bsd-3': 'BSD-3-Clause',
  'cc-by-4-0': 'CC-BY-4.0',
  'cc-by-sa-4-0': 'CC-BY-SA-4.0',
  openrail: 'OpenRAIL',
  custom: 'Custom',
  other: 'Other',
};
