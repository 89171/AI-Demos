/** Real RNNoise (Xiph's GRU noise suppressor, ~85 KB weights baked into the WASM) running on 48 kHz mono. */
import { decodeAudio, estimateSnrGain, framePeaks, peaks, wavUrl } from './audio-tasks';

const RATE = 48000;
const FRAME = 480; // RNNoise works on 10 ms frames

export async function rnnoiseDenoise(src: string, mix: number) {
  const { createRNNWasmModuleSync } = await import('@jitsi/rnnoise-wasm');
  const mod = await createRNNWasmModuleSync();
  const buffer = await decodeAudio(src, RATE);
  const input = buffer.getChannelData(0);
  const state = mod._rnnoise_create(0);
  const inPtr = mod._malloc(FRAME * 4);
  const outPtr = mod._malloc(FRAME * 4);
  const out = new Float32Array(input.length);
  const frame = new Float32Array(FRAME);
  try {
    for (let i = 0; i < input.length; i += FRAME) {
      frame.fill(0);
      frame.set(input.subarray(i, i + FRAME));
      for (let k = 0; k < FRAME; k++) frame[k] *= 32768; // RNNoise expects int16-range floats
      mod.HEAPF32.set(frame, inPtr >> 2);
      mod._rnnoise_process_frame(state, outPtr, inPtr);
      const den = mod.HEAPF32.subarray(outPtr >> 2, (outPtr >> 2) + FRAME);
      const n = Math.min(FRAME, input.length - i);
      // mix = how much of the dry signal leaks back in (0 = fully denoised)
      for (let k = 0; k < n; k++) out[i + k] = (den[k] / 32768) * (1 - mix) + input[i + k] * mix;
    }
  } finally {
    mod._rnnoise_destroy(state);
    mod._free(inPtr);
    mod._free(outPtr);
  }
  return {
    url: wavUrl(out, RATE),
    before: peaks(buffer, 320),
    after: framePeaks(out, 320),
    snrGainDb: estimateSnrGain(input, out, RATE),
  };
}
