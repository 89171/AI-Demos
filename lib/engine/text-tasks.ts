/**
 * Text-side task implementations used by the simulated engine.
 *
 * Everything here is derived from the actual user input: bag-of-n-gram
 * embeddings, lexical + distributional similarity, keyword-driven
 * classification, extractive summarisation and glossary translation.
 */
import { fnv1a, mulberry32 } from './random';
import type { Locale } from '../types';

/* ------------------------------------------------------------- tokenisation */

export function normalize(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Character bigrams for CJK, word tokens for latin scripts. */
export function tokensOf(text: string): string[] {
  const out: string[] = [];
  const words = text.toLowerCase().match(/[a-z0-9]+(?:['-][a-z0-9]+)*/g) ?? [];
  out.push(...words);
  const cjk = text.match(/[\u4e00-\u9fff]/g) ?? [];
  for (let i = 0; i < cjk.length; i++) {
    out.push(cjk[i]);
    if (i + 1 < cjk.length) out.push(cjk[i] + cjk[i + 1]);
  }
  return out;
}

/* --------------------------------------------------------------- embedding */

export function embed(text: string, dim: number, modelSeed: string): number[] {
  const vec = new Array(dim).fill(0);
  const toks = tokensOf(text);
  if (!toks.length) return vec;
  for (const tk of toks) {
    const h = fnv1a(`${modelSeed}:${tk}`);
    const idx = h % dim;
    const sign = (h >>> 31) & 1 ? -1 : 1;
    // sub-linear term weighting keeps long lines from dominating
    vec[idx] += sign * (1 + Math.log1p(1));
  }
  // a little cross-dimensional mixing so vectors are not sparse spikes
  const rng = mulberry32(fnv1a(`${modelSeed}:mix`));
  const mixed = vec.map((v, i) => v * 0.72 + vec[(i + 1) % dim] * 0.14 + vec[(i + 3) % dim] * 0.1);
  return mixed.map((v) => v + (rng() - 0.5) * 1e-6);
}

export function l2norm(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

/** Distributional + lexical blend, used by the reranker / search simulators. */
export function relevance(query: string, passage: string, dim = 128, modelSeed = 'm'): number {
  const qv = l2norm(embed(query, dim, modelSeed));
  const pv = l2norm(embed(passage, dim, modelSeed));
  const dist = (cosine(qv, pv) + 1) / 2;
  const qs = new Set(tokensOf(query));
  const ps = new Set(tokensOf(passage));
  let overlap = 0;
  qs.forEach((t) => {
    if (ps.has(t)) overlap += 1;
  });
  const lex = qs.size ? overlap / qs.size : 0;
  return Math.max(0, Math.min(1, 0.6 * dist + 0.4 * lex));
}

/* ---------------------------------------------------------- classification */

const POS = ['好', '很好', '不错', '满意', '推荐', '喜欢', '优秀', '美味', '热情', '高效', '惊喜', '精致', '性价比', '值得', '顺畅', '贴心', '快', '赞', 'good', 'great', 'excellent', 'love', 'recommend', 'delicious', 'friendly', 'fantastic', 'worth', 'smooth', 'helpful', 'best', 'amazing', 'perfect'];
const NEG = ['差', '糟糕', '垃圾', '失望', '延误', '投诉', '生气', '无语', '崩溃', '卡死', '丢', '打不通', '坑', '慢', '贵', '差评', '无法', '没有', '没用', '胡说八道', 'terrible', 'awful', 'garbage', 'disappointed', 'delay', 'complain', 'angry', 'crash', 'hang', 'lost', 'unusable', 'worst', 'broken', 'nonsense', 'waste', 'poor', 'hate'];
const TOXIC: Record<string, string[]> = {
  toxic: ['垃圾', '胡说八道', '废物', '滚', 'garbage', 'nonsense', 'trash', 'stupid'],
  severe_toxic: ['去死', '该死', 'die', 'kill'],
  obscene: ['傻', '白痴', 'idiot', 'moron'],
  threat: ['教训', '找人收拾', 'you will regret', 'beat you'],
  insult: ['不懂', '外行', '菜', 'clueless', 'incompetent'],
  identity_hate: ['某个群体', '那种人', 'those people'],
};
const INTENTS: { id: string; zh: string; en: string; cues: string[] }[] = [
  { id: 'refund', zh: '退款退货', en: 'Refund / Return', cues: ['退款', '退货', '退单', '取消订单', 'refund', 'return', 'cancel'] },
  { id: 'shipping', zh: '物流查询', en: 'Shipping status', cues: ['物流', '快递', '发货', '运单', '签收', 'shipping', 'tracking', 'delivery', 'parcel', 'ship'] },
  { id: 'account', zh: '账号问题', en: 'Account issue', cues: ['账号', '密码', '登录', '注册', '验证码', 'account', 'password', 'login', 'sign in', 'verification'] },
  { id: 'invoice', zh: '发票开票', en: 'Invoicing', cues: ['发票', '开票', 'invoice', 'receipt', 'billing'] },
  { id: 'technical', zh: '技术故障', en: 'Technical fault', cues: ['卡死', '报错', '崩溃', '闪退', '出错', 'bug', 'error', 'crash', 'freeze', 'broken', 'hang'] },
  { id: 'inquiry', zh: '售前咨询', en: 'Pre-sales inquiry', cues: ['怎么', '如何', '请问', '能不能', 'how', 'what', 'can i', 'question', 'support'] },
];

export interface LabelScore {
  label: string;
  score: number;
}

function scoreByCues(text: string, groups: { label: string; cues: string[] }[]): LabelScore[] {
  const raw = groups.map((g) => {
    let hits = 0;
    for (const c of g.cues) {
      let idx = 0;
      const lower = text.toLowerCase();
      const cue = c.toLowerCase();
      while (true) {
        const found = lower.indexOf(cue, idx);
        if (found === -1) break;
        hits += 1;
        idx = found + cue.length;
      }
    }
    return { label: g.label, hits };
  });
  const max = Math.max(1, ...raw.map((r) => r.hits));
  return raw.map((r) => ({ label: r.label, score: r.hits === 0 ? 0.02 : 0.35 + 0.62 * (r.hits / max) }));
}

export function detectTask(text: string): 'sentiment' | 'intent' | 'toxicity' {
  const t = text.toLowerCase();
  let tox = 0;
  Object.values(TOXIC).forEach((cues) => cues.forEach((c) => { if (t.includes(c.toLowerCase())) tox += 1; }));
  if (tox >= 2) return 'toxicity';
  let intentHits = 0;
  INTENTS.forEach((i) => i.cues.forEach((c) => { if (t.includes(c.toLowerCase())) intentHits += 1; }));
  if (intentHits >= 2) return 'intent';
  return 'sentiment';
}

export function classify(text: string, locale: Locale, task: string): { task: string; labels: LabelScore[] } {
  const resolved = task === 'auto' ? detectTask(text) : (task as 'sentiment' | 'intent' | 'toxicity');
  const lower = text.toLowerCase();
  if (resolved === 'sentiment') {
    let pos = 0;
    let neg = 0;
    POS.forEach((w) => { if (lower.includes(w.toLowerCase())) pos += 1; });
    NEG.forEach((w) => { if (lower.includes(w.toLowerCase())) neg += 1; });
    const total = pos + neg || 1;
    const pPos = (pos + 0.6) / (total + 1.2);
    return {
      task: 'sentiment',
      labels: [
        { label: locale === 'zh' ? '正面' : 'Positive', score: pPos },
        { label: locale === 'zh' ? '负面' : 'Negative', score: 1 - pPos },
        { label: locale === 'zh' ? '中性' : 'Neutral', score: Math.max(0.03, 1 - Math.abs(pos - neg) / 4) * 0.5 },
      ].sort((a, b) => b.score - a.score),
    };
  }
  if (resolved === 'intent') {
    const groups = INTENTS.map((i) => ({ label: locale === 'zh' ? i.zh : i.en, cues: i.cues }));
    return { task: 'intent', labels: scoreByCues(text, groups).sort((a, b) => b.score - a.score) };
  }
  const groups = Object.entries(TOXIC).map(([k, cues]) => ({ label: k, cues }));
  return { task: 'toxicity', labels: scoreByCues(text, groups).sort((a, b) => b.score - a.score) };
}

/* ----------------------------------------------------------- summarisation */

const STOP = new Set(['的', '了', '和', '是', '在', '我', '有', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自', '这', '那', 'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'was', 'were', 'it', 'that', 'this', 'with', 'as', 'by', 'be', 'at', 'from']);

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?；;])|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

export function keywords(text: string, limit = 8): { word: string; count: number }[] {
  const map = new Map<string, number>();
  for (const tk of tokensOf(text)) {
    if (tk.length < 2 || STOP.has(tk)) continue;
    map.set(tk, (map.get(tk) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}

export function extractiveSummary(text: string, limit: number): { summary: string; points: string[]; keywords: { word: string; count: number }[] } {
  const sentences = splitSentences(text);
  if (!sentences.length) return { summary: '', points: [], keywords: [] };
  const kw = keywords(text, 12);
  const weight = new Map(kw.map((k) => [k.word, k.count]));
  const scored = sentences.map((s, i) => {
    const toks = tokensOf(s);
    let score = 0;
    toks.forEach((t) => { score += weight.get(t) ?? 0; });
    score = score / Math.sqrt(Math.max(toks.length, 1));
    if (i === 0) score *= 1.18; // lead sentence bias
    return { s, score, i };
  });
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, Math.max(2, Math.min(4, Math.ceil(sentences.length / 3))));
  top.sort((a, b) => a.i - b.i);
  return {
    summary: top.map((t) => t.s).join(''),
    points: [...scored].sort((a, b) => b.score - a.score).slice(0, 5).map((t) => t.s),
    keywords: kw.slice(0, limit),
  };
}

/* ------------------------------------------------------------- translation */

const GLOSSARY: [string, string][] = [
  ['我们', 'we'], ['你们', 'you'], ['他们', 'they'], ['今天', 'today'], ['明天', 'tomorrow'], ['昨天', 'yesterday'],
  ['天气', 'weather'], ['很好', 'is very good'], ['非常好', 'is excellent'], ['一起', 'together'], ['公园', 'park'],
  ['散步', 'take a walk'], ['路上', 'on the way'], ['遇到', 'met'], ['小狗', 'a puppy'], ['城市', 'city'],
  ['服务', 'service'], ['产品', 'product'], ['用户', 'user'], ['客户', 'customer'], ['订单', 'order'],
  ['发货', 'ship'], ['退款', 'refund'], ['发票', 'invoice'], ['账号', 'account'], ['密码', 'password'],
  ['登录', 'sign in'], ['数据', 'data'], ['模型', 'model'], ['图像', 'image'], ['文字', 'text'],
  ['语音', 'speech'], ['视频', 'video'], ['浏览器', 'browser'], ['性能', 'performance'], ['优化', 'optimisation'],
  ['注意', 'note'], ['问题', 'issue'], ['方案', 'plan'], ['项目', 'project'], ['会议', 'meeting'],
  ['时间', 'time'], ['工作', 'work'], ['公司', 'company'], ['团队', 'team'], ['增长', 'growth'],
  ['营收', 'revenue'], ['研发', 'R&D'], ['硬件', 'hardware'], ['云服务', 'cloud services'], ['毛利率', 'gross margin'],
  ['预计', 'expects'], ['支持', 'supports'], ['需要', 'requires'], ['可以', 'can'], ['必须', 'must'],
  ['接口', 'endpoint'], ['请求', 'request'], ['响应', 'response'], ['客户端', 'client'], ['服务端', 'server'],
  ['连接', 'connection'], ['超时', 'timeout'], ['流式', 'streaming'], ['标记', 'marker'], ['关闭', 'close'],
  ['台风', 'typhoon'], ['降雨', 'rainfall'], ['气象', 'meteorological'], ['市民', 'residents'], ['外出', 'going out'],
  ['防范', 'guard against'], ['内涝', 'urban flooding'], ['影响', 'influenced by'], ['未来', 'the coming'],
  ['三天', 'three days'], ['持续', 'sustained'], ['强', 'heavy'], ['机身', 'chassis'], ['续航', 'battery life'],
  ['通勤', 'commute'], ['创作', 'create'], ['轻', 'lightweight'], ['小时', 'hours'], ['分钟', 'minutes'],
];

export interface TranslationResult {
  text: string;
  glossaryHits: { source: string; target: string }[];
  coverage: number;
  exact: boolean;
}

export function glossaryTranslate(text: string, sourceLang: string, targetLang: string): TranslationResult {
  const zhToEn = sourceLang !== 'en' && targetLang === 'en';
  let out = text;
  const hits: { source: string; target: string }[] = [];
  if (zhToEn) {
    const sorted = [...GLOSSARY].sort((a, b) => b[0].length - a[0].length);
    for (const [zh, en] of sorted) {
      if (out.includes(zh)) {
        out = out.split(zh).join(` ${en} `);
        hits.push({ source: zh, target: en });
      }
    }
    out = out.replace(/[，。！？；：、]/g, (m) => ({ '，': ', ', '。': '. ', '！': '! ', '？': '? ', '；': '; ', '：': ': ', '、': ', ' }[m] ?? m));
    out = out.replace(/\s+/g, ' ').replace(/ ([,.!?;:])/g, '$1').trim();
  } else {
    const sorted = [...GLOSSARY].sort((a, b) => b[1].length - a[1].length);
    for (const [zh, en] of sorted) {
      const re = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (re.test(out)) {
        out = out.replace(re, zh);
        hits.push({ source: en, target: zh });
      }
    }
  }
  const srcTokens = tokensOf(text).length || 1;
  const covered = hits.reduce((s, h) => s + tokensOf(h.source).length, 0);
  return { text: out, glossaryHits: hits.slice(0, 24), coverage: Math.min(1, covered / srcTokens), exact: false };
}

/* --------------------------------------------------------- structured JSON */

export function structuredExtract(text: string, schema: string): Record<string, unknown> {
  const emails = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [];
  const phones = text.match(/(?:\+?\d[\d\s-]{7,}\d)/g) ?? [];
  const dates = text.match(/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?/g) ?? [];
  const money = text.match(/[\d,]+(?:\.\d+)?\s*(?:元|万元|亿元|CNY|USD|¥|\$)/gi) ?? [];
  const versions = text.match(/\bv?\d+\.\d+(?:\.\d+)?\b/g) ?? [];
  const urls = text.match(/https?:\/\/[^\s，,、)]+/g) ?? [];
  const base: Record<string, unknown> = {
    schema,
    source_length: text.length,
    detected: {
      emails,
      phones,
      dates,
      amounts: money,
      versions,
      urls,
    },
  };
  if (schema === 'job') {
    const years = text.match(/(\d+)\s*(?:年|years?)/i);
    base.title = (text.match(/[\u4e00-\u9fff]{2,10}(?:工程师|经理|设计师|运营|销售|分析师)/) ?? [])[0] ?? null;
    base.min_experience_years = years ? Number(years[1]) : null;
    base.salary = money[0] ?? null;
    base.skills = ['React', 'TypeScript', 'WebGL', 'Canvas', 'Python', 'Rust', 'SQL'].filter((s) =>
      new RegExp(s, 'i').test(text)
    );
  } else if (schema === 'event') {
    base.event_type = /火|fire|爆炸|explosion/.test(text) ? 'incident' : 'general';
    base.location = (text.match(/[\u4e00-\u9fff]{2,12}(?:路|街|区|市|仓库|大楼|车站)/) ?? [])[0] ?? null;
    base.time = dates[0] ?? null;
  } else {
    base.category = /卡死|报错|崩溃|error|crash/i.test(text) ? 'bug' : 'question';
    base.severity = /崩溃|卡死|无法|severe/i.test(text) ? 'high' : 'medium';
    base.platform = {
      os: (text.match(/Windows\s*\d+|macOS[\w\s.]*|iOS\s*\d*|Android\s*\d*/i) ?? [])[0] ?? null,
      browser: (text.match(/Chrome\s*\d+|Safari\s*\d+|Firefox\s*\d+|Edge\s*\d+/i) ?? [])[0] ?? null,
    };
    base.version = versions[0] ?? null;
  }
  return base;
}

/* ------------------------------------------------------- chat / code stubs */

export function simulatedChatReply(prompt: string, locale: Locale, modelName: string): string {
  const kw = keywords(prompt, 5).map((k) => k.word);
  const focus = kw.length ? kw.join('、') : locale === 'zh' ? '你的问题' : 'your question';
  if (locale === 'zh') {
    return [
      `先说明：当前为演示模式，${modelName} 的权重并未真正加载，以下内容由规则引擎按输入结构生成，用于展示交互链路。`,
      `关于「${prompt.slice(0, 42)}${prompt.length > 42 ? '…' : ''}」，可以从三个角度展开：`,
      `1. 定义与边界 —— 先把 ${focus} 的范围界定清楚，避免概念漂移。`,
      `2. 关键权衡 —— 常见取舍是效果与成本，量化、蒸馏、缓存是三条主要路径。`,
      `3. 落地建议 —— 建议先用最小可用样例验证，再逐步扩大规模。`,
      '',
      '切换到内置示例可查看完整的高质量参考答案。',
    ].join('\n');
  }
  return [
    `Heads-up: this is demo mode — ${modelName} weights are not actually loaded. The text below is rule-generated from your input to exercise the interaction pipeline.`,
    `On "${prompt.slice(0, 48)}${prompt.length > 48 ? '…' : ''}", three angles are worth separating:`,
    `1. Definition and scope — pin down what ${focus} covers before anything else.`,
    `2. Key trade-offs — quality versus cost, where quantization, distillation and caching are the three main levers.`,
    `3. Next steps — validate with the smallest working example, then scale.`,
    '',
    'Switch back to a built-in sample for a full reference answer.',
  ].join('\n');
}

export function simulatedCode(prompt: string, language: string, task: string): string {
  const fence = '```' + language;
  if (task === 'explain') {
    const lines = prompt.split('\n').filter((l) => l.trim() && !l.includes('解释') && !l.includes('Explain'));
    return [
      '演示模式：代码解释由静态分析规则生成，未加载真实权重。',
      '',
      `这段代码共 ${lines.length} 个有效语句，结构上包含：`,
      `• 变量声明：${lines.filter((l) => /(const|let|var|=)/.test(l)).length} 处`,
      `• 分支或循环：${lines.filter((l) => /(if|for|while|switch)/.test(l)).length} 处`,
      `• 函数定义：${lines.filter((l) => /(function|=>)/.test(l)).length} 处`,
      '',
      '潜在关注点：',
      '1. 是否存在未收敛的递归或循环，需要检查终止条件。',
      '2. 共享状态在并发或多次调用下是否安全。',
      '3. 输入校验与边界值处理是否完整。',
    ].join('\n');
  }
  const name = (prompt.match(/[\u4e00-\u9fff]{2,8}|[a-zA-Z]{4,20}/) ?? ['helper'])[0];
  return [
    fence,
    `// 演示模式：由模板生成，未加载 ${language} 代码模型`,
    `export function ${/^[a-zA-Z]/.test(name) ? name : 'helper'}(input: string): string {`,
    `  // TODO: 依据需求「${prompt.slice(0, 40)}${prompt.length > 40 ? '…' : ''}」实现具体逻辑`,
    '  return input.trim();',
    '}',
    '```',
    '',
    '切换回内置示例可以看到完整实现。',
  ].join('\n');
}
