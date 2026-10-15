/** Real OCR via Tesseract.js (WASM core + language data are fetched from the CDN on first use, then cached). */
import type { Worker } from 'tesseract.js';

const workers = new Map<string, Promise<Worker>>();

export async function tesseractOcr(src: string, lang: string) {
  let job = workers.get(lang);
  if (!job) {
    job = import('tesseract.js').then((t) => t.createWorker(lang.split('+')));
    workers.set(lang, job);
    job.catch(() => workers.delete(lang));
  }
  const { data } = await (await job).recognize(src, {}, { blocks: true });
  const lines = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
  return { text: data.text.trim(), lines };
}
