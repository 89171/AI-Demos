declare module '@jitsi/rnnoise-wasm' {
  interface RnnoiseModule {
    HEAPF32: Float32Array;
    _malloc(n: number): number;
    _free(p: number): void;
    _rnnoise_create(model: number): number;
    _rnnoise_destroy(state: number): void;
    _rnnoise_process_frame(state: number, out: number, input: number): number;
  }
  export function createRNNWasmModuleSync(): Promise<RnnoiseModule>;
  export function createRNNWasmModule(): Promise<RnnoiseModule>;
}
