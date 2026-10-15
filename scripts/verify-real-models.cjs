/**
 * Node-side smoke test for the checkpoints used by the demo.
 *
 * `node scripts/verify-real-models.cjs`
 *
 * It exercises the same three tasks the browser does, so a broken/deleted HF
 * repo or an unsupported dtype is caught without opening a browser.
 */
const { pipeline } = require('@huggingface/transformers');

const CASES = [
  {
    task: 'text-classification',
    repo: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    dtype: 'int8',
    input: 'This little demo actually loads real weights.',
    options: { topk: 3 },
  },
  {
    task: 'text-classification',
    repo: 'Xenova/toxic-bert',
    dtype: 'int8',
    input: 'You are a wonderful person and I appreciate your help.',
    options: { topk: null },
  },
  {
    task: 'feature-extraction',
    repo: 'Xenova/all-MiniLM-L6-v2',
    dtype: 'int8',
    input: ['今天北京的最高气温达到 32 摄氏度。', '沪深两市今日成交额突破一万亿元。'],
    options: { pooling: 'mean', normalize: true },
  },
  {
    task: 'object-detection',
    repo: 'Xenova/yolos-tiny',
    dtype: 'q4',
    inputPath: `${__dirname}/../public/samples/street.png`,
    options: { threshold: 0.35 },
  },
];

(async () => {
  for (const c of CASES) {
    const t0 = Date.now();
    try {
      const pipe = await pipeline(c.task, c.repo, { dtype: c.dtype });
      const loadMs = Date.now() - t0;
      const input = c.inputPath ? c.inputPath : c.input;
      const t1 = Date.now();
      const out = await pipe(input, c.options);
      const inferMs = Date.now() - t1;
      let summary;
      if (c.task === 'feature-extraction') {
        summary = `dims=${JSON.stringify(out.dims)} first=${Array.from(out.data.slice(0, 3))
          .map((x) => Number(x).toFixed(4))
          .join(',')}`;
      } else if (c.task === 'object-detection') {
        summary = `${out.length} boxes: ${out
          .slice(0, 4)
          .map((o) => `${o.label}@${o.score.toFixed(2)}`)
          .join(', ')}`;
      } else {
        summary = (Array.isArray(out) ? out : [out])
          .slice(0, 3)
          .map((o) => `${o.label}=${o.score.toFixed(3)}`)
          .join(', ');
      }
      console.log(`OK   ${c.repo} (${c.dtype}) load=${loadMs}ms infer=${inferMs}ms :: ${summary}`);
    } catch (e) {
      console.log(`FAIL ${c.repo} (${c.dtype}) :: ${e && e.message ? e.message.split('\n')[0] : e}`);
    }
  }
})();
