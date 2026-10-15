/** Deterministic hashing + PRNG so identical inputs always replay identical results. */

export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(...parts: unknown[]): number {
  return fnv1a(parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join('\u241f'));
}

export function pickWeighted<T>(rng: () => number, items: { item: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + Math.max(i.weight, 0), 0);
  if (total <= 0) return items[0].item;
  let r = rng() * total;
  for (const i of items) {
    r -= Math.max(i.weight, 0);
    if (r <= 0) return i.item;
  }
  return items[items.length - 1].item;
}

/** Softmax with a temperature, returns values summing to 1. */
export function softmax(xs: number[], temperature = 1): number[] {
  if (!xs.length) return [];
  const m = Math.max(...xs);
  const exps = xs.map((x) => Math.exp((x - m) / Math.max(temperature, 0.05)));
  const s = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / s);
}

export function round(n: number, digits = 3): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Chunk text into pseudo-tokens for the streaming chat simulation. */
export function tokenize(text: string, locale: 'zh' | 'en'): string[] {
  if (locale === 'zh') {
    const out: string[] = [];
    for (const ch of text) out.push(ch);
    return out;
  }
  return text.match(/\s*\S+/g) ?? [text];
}
