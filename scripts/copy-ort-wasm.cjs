/**
 * Copies the ONNX Runtime Web binaries used by Transformers.js into /public/ort
 * so the demo can run offline after the first model download.
 *
 * Without this, onnxruntime-web fetches its ~20 MB wasm from a CDN at runtime.
 * Skipped silently when the runtime is not installed yet.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'node_modules', 'onnxruntime-web', 'dist');
const dest = path.join(root, 'public', 'ort');

// MediaPipe Tasks WASM (face / pose / hand / object) goes to /public/mediapipe.
const mpSrc = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
if (fs.existsSync(mpSrc)) {
  fs.cpSync(mpSrc, path.join(root, 'public', 'mediapipe'), { recursive: true });
  console.log('[copy-ort-wasm] MediaPipe wasm copied to public/mediapipe');
}

if (!fs.existsSync(src)) {
  console.log('[copy-ort-wasm] onnxruntime-web not installed, skipping');
  process.exit(0);
}

// Every `ort-wasm-*` binary must be vendored: onnxruntime-web picks between the
// plain / jsep / jspi / asyncify builds at runtime, and a missing variant makes
// session creation fail with "no available backend found".
const FILES = fs
  .readdirSync(src)
  .filter((f) => /^ort-wasm-.*\.(mjs|wasm)$/.test(f))
  .sort();

fs.mkdirSync(dest, { recursive: true });

let copied = 0;
for (const f of FILES) {
  const from = path.join(src, f);
  const to = path.join(dest, f);
  if (!fs.existsSync(from)) continue;
  const srcSize = fs.statSync(from).size;
  const alreadyOk = fs.existsSync(to) && fs.statSync(to).size === srcSize;
  if (alreadyOk) continue;
  fs.copyFileSync(from, to);
  copied++;
}

const total = FILES.reduce((a, f) => {
  try {
    return a + fs.statSync(path.join(dest, f)).size;
  } catch {
    return a;
  }
}, 0);

console.log(
  `[copy-ort-wasm] ${copied} file(s) updated, ${(total / 1024 / 1024).toFixed(1)} MB in public/ort`
);
