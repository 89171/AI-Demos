// Extract the model catalogue from the sibling WebAIModels project into a plain
// JSON file consumable by the demo playground.
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../../WebAIModels/data/models.ts');
const OUT = path.resolve(__dirname, '../lib/data/models.json');

let src = fs.readFileSync(SRC, 'utf8');
src = src.replace(/^import[^\n]*\n/m, '');
src = src.replace('export const MODELS: CategoryModels =', 'const MODELS =');
src = src.replace(/^export const[\s\S]*$/m, '');
src += '\nmodule.exports = MODELS;\n';

const tmp = path.join(__dirname, '.models.cjs');
fs.writeFileSync(tmp, src);
const MODELS = require(tmp);
fs.unlinkSync(tmp);

const MB = 1024 * 1024;
// Largest pinned variant download, rounded like "~33.4 MB". Variants are
// alternative precisions of the same model, not additive parts.
function sizeOf(m) {
  const bytes = (m.variants ?? [])
    .map((v) => v.downloadBytes)
    .filter((n) => typeof n === 'number');
  if (!bytes.length) return m.size ?? '—';
  return `~${(Math.max(...bytes) / MB).toFixed(1)} MB`;
}

// Upstream subcategories the playground cannot host yet:
// - text/ner: same task as text/token-classification, which AI-Demos already ships.
// - audio/vad: needs a speech-timeline output kind the playground lacks.
// (video/video-watermark-removal used to be skipped; it now runs on the
//  temporal-median + WebCodecs pipeline in lib/engine/video-watermark.ts.)
const SKIP = new Set(['text/ner', 'audio/vad']);

const slim = {};
for (const [cat, subs] of Object.entries(MODELS)) {
  slim[cat] = {};
  for (const [sub, models] of Object.entries(subs)) {
    if (SKIP.has(`${cat}/${sub}`)) continue;
    slim[cat][sub] = models.map((m) => ({
      id: m.id,
      name: m.name,
      framework: m.framework,
      size: sizeOf(m),
      license: m.weightLicense ?? m.codeLicense ?? '—',
      languages: m.naturalLanguages ?? [],
      description: m.description,
      demoUrl: m.demoBase && m.demoPath ? m.demoBase + m.demoPath : m.demoUrl,
      docsUrl: m.docsUrl,
    }));
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(slim, null, 2));
const total = Object.values(slim).reduce((a, s) => a + Object.values(s).reduce((b, m) => b + m.length, 0), 0);
console.log('categories:', Object.keys(slim).length, 'subcategories:', Object.values(slim).reduce((a, s) => a + Object.keys(s).length, 0), 'models:', total);
