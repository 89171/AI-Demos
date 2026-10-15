/**
 * Curated reference outputs for the built-in samples.
 *
 * These are what a real model is expected to produce on the shipped fixtures,
 * so the demo reads coherently regardless of which model card is selected.
 * User-supplied input falls through to the deterministic simulator instead.
 */
import type { Locale } from '../types';

type Fixture = { zh: unknown; en: unknown };

/** key: `${category}/${subcategory}/${sampleId}` */
export const FIXTURES: Record<string, Fixture> = {
  'llm/chat/explain': {
    zh: '模型量化是把权重和激活从 32 位浮点压缩成 8 位、甚至 4 位整数，用更少的比特表示同样的数值范围。它把显存占用和访存带宽降到原来的四分之一左右，因此端侧推理更快、更省电，代价是精度通常掉一到两个百分点。可以类比成把无损音乐转成 320 kbps 的 MP3：体积小了一个数量级，几乎听不出差别，但确实丢掉了一些细节。',
    en: 'Quantization compresses weights and activations from 32-bit floats into 8-bit or even 4-bit integers, representing the same numeric range with fewer bits. It cuts memory footprint and bandwidth roughly fourfold, so on-device inference is faster and more power-efficient — at the cost of a percentage point or two of accuracy. Think of converting lossless audio to a 320 kbps MP3: an order of magnitude smaller, nearly indistinguishable, though some detail is genuinely lost.',
  },
  'llm/chat/reason': {
    zh: '设水池容量为 1。\n\n甲管每小时注入 1/6，乙管每小时注入 1/8，出水管每小时排出 1/12。\n\n三管同开时净注入速率为：\n1/6 + 1/8 − 1/12 = 4/24 + 3/24 − 2/24 = 5/24\n\n所需时间 = 1 ÷ (5/24) = 24/5 = 4.8 小时，即 4 小时 48 分钟。\n\n结论：约 4.8 小时注满水池。',
    en: 'Let the pool capacity be 1.\n\nPipe A adds 1/6 per hour, pipe B adds 1/8 per hour, and the drain removes 1/12 per hour.\n\nNet fill rate with all three open:\n1/6 + 1/8 − 1/12 = 4/24 + 3/24 − 2/24 = 5/24\n\nTime required = 1 ÷ (5/24) = 24/5 = 4.8 hours, i.e. 4 hours 48 minutes.\n\nAnswer: about 4.8 hours to fill the pool.',
  },
  'llm/chat/writing': {
    zh: '改写：以先进的人工智能技术，让每一位用户的服务体验更快、更省心。\n\n理由：原句 42 字，“致力于”与“为广大用户提供”都属于填充性表达，删掉不影响信息量；把“便捷高效的服务体验”拆成“更快、更省心”两个具体感受，读起来更有画面；“每一位用户”比“广大用户”更具体，也更有温度。',
    en: 'Rewrite: Advanced AI, so every user gets service that is faster and easier.\n\nWhy: the original leans on filler ("committed to leveraging", "broad user base") that carries no extra information. Splitting "convenient and efficient" into two concrete feelings — faster, easier — gives the reader something to picture, and "every user" is warmer and more concrete than "our broad user base".',
  },

  'llm/code/debounce': {
    zh: '```typescript\nexport interface DebounceOptions {\n  /** 首次调用是否立即执行 */\n  leading?: boolean;\n}\n\nexport function debounce<A extends unknown[]>(\n  fn: (...args: A) => void,\n  wait = 200,\n  { leading = false }: DebounceOptions = {}\n) {\n  let timer: ReturnType<typeof setTimeout> | null = null;\n  let pending: A | null = null;\n  let trailingThis: unknown = undefined;\n\n  return function (this: unknown, ...args: A) {\n    pending = args;\n    trailingThis = this;\n\n    if (leading && timer === null) {\n      fn.apply(this, args);\n      pending = null;\n    }\n\n    if (timer !== null) clearTimeout(timer);\n    timer = setTimeout(() => {\n      timer = null;\n      if (pending) {\n        fn.apply(trailingThis, pending);\n        pending = null;\n      }\n    }, wait);\n  };\n}\n```\n\n要点：\n1. `leading` 打开时，沉默期内的第一次调用立刻执行。\n2. 尾调用始终保留，避免最后一次输入被丢弃。\n3. 通过 `this` 转发与泛型参数 `A`，保持了调用方的上下文与类型。',
    en: '```typescript\nexport interface DebounceOptions {\n  /** Fire immediately on the first call */\n  leading?: boolean;\n}\n\nexport function debounce<A extends unknown[]>(\n  fn: (...args: A) => void,\n  wait = 200,\n  { leading = false }: DebounceOptions = {}\n) {\n  let timer: ReturnType<typeof setTimeout> | null = null;\n  let pending: A | null = null;\n  let trailingThis: unknown = undefined;\n\n  return function (this: unknown, ...args: A) {\n    pending = args;\n    trailingThis = this;\n\n    if (leading && timer === null) {\n      fn.apply(this, args);\n      pending = null;\n    }\n\n    if (timer !== null) clearTimeout(timer);\n    timer = setTimeout(() => {\n      timer = null;\n      if (pending) {\n        fn.apply(trailingThis, pending);\n        pending = null;\n      }\n    }, wait);\n  };\n}\n```\n\nNotes:\n1. With `leading` on, the first call inside a quiet period runs immediately.\n2. The trailing call is kept so the final keystroke is never dropped.\n3. Forwarding `this` and parameterising on `A` preserves both context and types.',
  },
  'llm/code/explain': {
    zh: '这段代码用记忆化递归计算第 n 个斐波那契数：`cache` 保存已算出的结果，命中缓存就直接返回，否则递归求解 `fib(n-1) + fib(n-2)` 并写回缓存，把朴素递归的 O(2ⁿ) 降到 O(n)。\n\n潜在问题：\n1. `cache` 是模块级变量，永久驻留内存，长时间运行会持续增长；应该限制规模或改为局部缓存。\n2. n 较大时递归深度等于 n，约 10⁴ 以上就有栈溢出风险，建议改成自底向上的迭代写法。\n3. 数值超过 Number.MAX_SAFE_INTEGER 后结果不再精确，如需大数应使用 BigInt。\n4. 没有做参数校验，负数或非整数会返回错误结果。',
    en: 'This code computes the n-th Fibonacci number with memoised recursion: `cache` stores results that have already been computed, a hit returns immediately, otherwise it recursively solves `fib(n-1) + fib(n-2)` and writes the result back — turning the naive O(2ⁿ) into O(n).\n\nIssues to watch:\n1. `cache` is module-level and lives forever, so it grows without bound in a long-running process; cap its size or make it local.\n2. Recursion depth equals n, so beyond ~10⁴ frames you risk a stack overflow. An iterative bottom-up loop is safer.\n3. Results stop being exact past Number.MAX_SAFE_INTEGER — switch to BigInt for large n.\n4. There is no argument validation; negative or fractional inputs return nonsense.',
  },
  'llm/code/refactor': {
    zh: '```typescript\nconst PRICE_MATRIX: Record<string, readonly [afterYears: number, regular: number]> = {\n  vip: [0.6, 0.8],\n  normal: [0.9, 1],\n};\n\nexport function price(user: { level: string; years: number }): number {\n  const row = PRICE_MATRIX[user.level];\n  if (!row) return 1.2;\n  return user.years > 3 ? row[0] : row[1];\n}\n```\n\n改动说明：\n1. 用一张矩阵表替代四层 if 嵌套，把“等级 × 年限”的映射关系显式化。\n2. 未知等级走默认分支，行为与原实现一致（1.2）。\n3. 常数抽取到模块顶层，避免每次调用重新创建对象。\n4. 增加返回类型标注，调用方可获得类型提示。',
    en: '```typescript\nconst PRICE_MATRIX: Record<string, readonly [afterYears: number, regular: number]> = {\n  vip: [0.6, 0.8],\n  normal: [0.9, 1],\n};\n\nexport function price(user: { level: string; years: number }): number {\n  const row = PRICE_MATRIX[user.level];\n  if (!row) return 1.2;\n  return user.years > 3 ? row[0] : row[1];\n}\n```\n\nWhat changed:\n1. A lookup table replaces four levels of nesting, making the "level × tenure" mapping explicit.\n2. Unknown levels fall through to the default branch, matching the original behaviour (1.2).\n3. Constants move to module scope so no object is allocated per call.\n4. An explicit return type gives callers proper inference.',
  },

  'text/summarization/report': {
    zh: '摘要：本季度营收 12.4 亿元，同比增长 18.6%，增长主要由云服务驱动；硬件业务受芯片供应影响小幅下滑，毛利率承压；研发投入占比升至 22.6%，销售费用率下降；管理层预计下季度云服务维持 25% 以上增速，硬件将在四季度回暖。\n\n要点：\n• 总营收 12.4 亿元，同比 +18.6%，环比 +6.2%\n• 云服务营收 5.1 亿元，占比 41%，同比 +34%，是主要增长引擎\n• 硬件营收同比 −3.5%，毛利率 22% → 18%，受上游芯片供应拖累\n• 研发投入 2.8 亿元，占营收 22.6%，投向端侧推理与多模态\n• 销售费用率下降 1.4 个百分点，自助注册渠道占比提升\n• 指引：下季度云服务增速 >25%，硬件四季度有望回暖',
    en: 'Summary: revenue for the quarter was 1.24 billion yuan, up 18.6% year on year, driven mainly by cloud services. Hardware softened on chip supply and margin pressure, R&D intensity rose to 22.6%, and the sales expense ratio fell. Management guides to above 25% cloud growth next quarter with hardware recovering in Q4.\n\nKey points:\n• Total revenue 1.24bn CNY, +18.6% YoY, +6.2% QoQ\n• Cloud revenue 510m CNY, 41% of total, +34% YoY — the growth engine\n• Hardware −3.5% YoY, gross margin 22% → 18% on upstream chip supply\n• R&D 280m CNY, 22.6% of revenue, focused on on-device inference and multimodal\n• Sales expense ratio down 1.4 points on more self-service signups\n• Guidance: cloud growth >25% next quarter, hardware recovery in Q4',
  },
  'text/summarization/meeting': {
    zh: '摘要：例会同步了 12 个阻塞项中 9 个已关闭，剩余集中在支付渠道对接；新版首页方案因信息密度存在分歧，决定用两周 A/B 实验按次日留存与点击转化裁决；埋点方案需周三前完成评审。\n\n要点：\n• 遗留阻塞项：12 个中已解决 9 个，其余 3 个均为支付渠道对接\n• 新首页争议点：设计主张精简卡片，运营希望保留更多入口\n• 决策方式：两周 A/B 实验，核心指标为次日留存与点击转化\n• 风险：埋点方案若周三前未过评审，将影响上线时间\n• 行动项：下次例会改至周三 10:00，12 楼会议室',
    en: 'Summary: the sync closed 9 of 12 blockers, with the rest concentrated in payment integration. The new homepage proposal split the room on information density, so it moves to a two-week A/B test judged on next-day retention and click-through. The tracking plan needs review by Wednesday.\n\nKey points:\n• Blockers: 9 of 12 resolved; the remaining 3 are all payment channel integration\n• Homepage debate: design wants fewer cards, operations wants more entry points\n• Decision: two-week A/B test, metrics are next-day retention and click-through\n• Risk: launch slips if the tracking plan misses Wednesday review\n• Action: next sync moves to Wednesday 10:00, 12th-floor meeting room',
  },

  'multimodal/vlm/street': {
    zh: '画面是一条城市街道的正面视角。主要物体包括：\n\n1. 左侧一辆浅灰色轿车，位于画面中下部，车头朝左。\n2. 右侧一辆深灰色车辆，位置略高于左侧车辆，部分被自行车遮挡。\n3. 画面中央偏左有一名行人，站姿笔直，位于人行道与车道交界处。\n4. 行人身后偏上是一组交通信号灯，三个灯位自上而下排列。\n5. 画面右侧有一棵树，树冠位于上半部分，树干延伸到人行道。\n6. 中下部还有一辆自行车，与右侧车辆重叠。\n\n整体是白天、光线均匀的户外场景，色调偏灰，适合作为目标检测的基线样例。',
    en: 'The frame shows a frontal view of a city street. Main objects:\n\n1. A light grey car on the left, lower-middle of the frame, facing left.\n2. A darker grey vehicle on the right, sitting slightly higher and partly occluded by a bicycle.\n3. One pedestrian left of centre, standing upright at the kerb between pavement and roadway.\n4. A traffic signal behind and above the pedestrian, with three lamps stacked vertically.\n5. A tree on the right whose canopy fills the upper area, trunk reaching the pavement.\n6. A bicycle in the lower-middle, overlapping the right-hand vehicle.\n\nOverall a flat, evenly lit outdoor daytime scene with a grey palette — a good baseline for detection.',
  },
  'multimodal/vlm/desk': {
    zh: '这看起来是一张办公桌面。可见物品：正中是一台打开的笔记本电脑，屏幕朝向镜头；笔记本前方是一个黑色键盘，右侧有一只鼠标；左前方放着一只白色马克杯，杯里有深色饮品；右后方是一本打开的笔记本或书本。背景是浅灰色墙面，桌面为暖灰色木质或复合材料。整体是有序、偏工作状态的桌面布置。',
    en: 'This looks like an office desk. Visible items: an open laptop at centre with the screen facing the camera; a black keyboard in front of it with a mouse to the right; a white mug with a dark drink at front-left; and an open notebook or book at the back-right. The background is a light grey wall and the desk surface reads as warm grey wood or laminate. It is an orderly, working desk setup.',
  },
  'multimodal/vlm/document': {
    zh: '这是一张发票（INVOICE / 发票），关键信息包括：发票号码 INV-2026-1008；开票日期 2026-10-08；客户名称 Acme Technologies Ltd.；地址为上海市浦东新区世纪大道 100 号。明细共三项：Cloud GPU Hours 120 单位 3,600.00；Model Fine-tuning 4 单位 1,280.00；Storage (TB/month) 12 单位 720.00。合计 Total (CNY) 5,600.00。票据为中英混排的表格版面，底部有致谢语。',
    en: 'This is an invoice (INVOICE / 发票). Key fields: invoice number INV-2026-1008; issue date 2026-10-08; customer Acme Technologies Ltd.; address 100 Century Avenue, Pudong, Shanghai. Three line items: Cloud GPU Hours 120 units at 3,600.00; Model Fine-tuning 4 units at 1,280.00; Storage (TB/month) 12 units at 720.00. Total (CNY) 5,600.00. The layout is a mixed Chinese/English table with a closing thank-you line.',
  },

  'audio/asr/zh': {
    zh: {
      language: 'zh',
      text: '今天天气很好，我们一起去公园散步吧。路上还遇到了一只可爱的小狗。',
      segments: [
        { start: 0.42, end: 2.18, text: '今天天气很好' },
        { start: 2.18, end: 4.36, text: '我们一起去公园散步吧' },
        { start: 5.02, end: 7.64, text: '路上还遇到了一只可爱的小狗' },
      ],
      confidence: 0.94,
    },
    en: null,
  },
  'audio/asr/en': {
    zh: null,
    en: {
      language: 'en',
      text: 'The quick brown fox jumps over the lazy dog. It was a sunny afternoon in the city park.',
      segments: [
        { start: 0.35, end: 2.62, text: 'The quick brown fox jumps over the lazy dog.' },
        { start: 3.08, end: 6.42, text: 'It was a sunny afternoon in the city park.' },
      ],
      confidence: 0.96,
    },
  },
  'audio/asr/zhmusic': {
    zh: {
      language: 'zh',
      text: '今天天气很好，我们一起去公园散步吧。路上还遇到了一只可爱的小狗。',
      segments: [
        { start: 0.48, end: 2.30, text: '今天天气很好' },
        { start: 2.30, end: 4.52, text: '我们一起去公园散步吧' },
        { start: 5.18, end: 7.80, text: '路上还遇到了一只可爱的小狗' },
      ],
      confidence: 0.87,
      note: '音源分离后的人声轨作为前置处理',
      noteEn: 'Vocal stem from source separation used as pre-processing',
    },
    en: null,
  },

  'video/video-understanding/street': {
    zh: {
      duration: 8,
      segments: [
        { start: 0, end: 4, label: '行人自左向右通过', confidence: 0.82 },
        { start: 4, end: 8, label: '车辆自右向左行驶', confidence: 0.79 },
      ],
      summary: '固定机位拍摄的街道片段。前景有行人横向移动，车道上有车辆反向通过，两者在约第 4 秒交汇。画面运动连续，无镜头切换。',
    },
    en: {
      duration: 8,
      segments: [
        { start: 0, end: 4, label: 'Pedestrian crossing left to right', confidence: 0.82 },
        { start: 4, end: 8, label: 'Vehicle travelling right to left', confidence: 0.79 },
      ],
      summary: 'A fixed-camera street clip. A pedestrian moves laterally in the foreground while a vehicle travels the opposite way in the lane; they cross at roughly the 4-second mark. Motion is continuous with no cuts.',
    },
  },
};

const JSON_FIXTURES: Record<string, Fixture> = {
  'llm/structured-output/job': {
    zh: {
      title: '高级前端工程师',
      location: { city: '深圳', district: '南山', remote_days_per_week: 2 },
      employment_type: 'full_time',
      seniority: 'senior',
      min_experience_years: 5,
      skills: ['React', 'TypeScript', 'WebGL', 'Canvas', '性能优化'],
      salary: { currency: 'CNY', min_monthly: 35000, max_monthly: 55000, months_per_year: 14 },
      responsibilities: ['公司核心数据看板的重构'],
      highlights: ['每周两天远程办公'],
    },
    en: {
      title: 'Senior Front-end Engineer',
      location: { city: 'Shenzhen', district: 'Nanshan', remote_days_per_week: 2 },
      employment_type: 'full_time',
      seniority: 'senior',
      min_experience_years: 5,
      skills: ['React', 'TypeScript', 'WebGL', 'Canvas', 'Performance tuning'],
      salary: { currency: 'CNY', min_monthly: 35000, max_monthly: 55000, months_per_year: 14 },
      responsibilities: ['Rebuild the core analytics dashboard'],
      highlights: ['Two remote days per week'],
    },
  },
  'llm/structured-output/event': {
    zh: {
      event_type: 'fire',
      location: '城东物流仓库',
      time: '昨日 15:00 前后',
      casualties: { dead: 0, injured: 0 },
      cause: '电气线路老化（初步判断）',
      response: { fire_engines: 12, extinguished_after_minutes: 120 },
      status: '损失统计中',
      confidence: 0.86,
    },
    en: {
      event_type: 'fire',
      location: 'Logistics warehouse, east of the city',
      time: 'Yesterday, around 15:00',
      casualties: { dead: 0, injured: 0 },
      cause: 'Ageing electrical wiring (preliminary)',
      response: { fire_engines: 12, extinguished_after_minutes: 120 },
      status: 'Losses still being assessed',
      confidence: 0.86,
    },
  },
  'llm/structured-output/ticket': {
    zh: {
      category: 'bug',
      severity: 'high',
      priority: 'P1',
      product_version: '3.2.0',
      platform: { os: 'Windows 11', browser: 'Chrome 120' },
      summary: '导出 Excel 行数超过 5000 时页面卡死',
      reproduction: ['升级到 3.2.0 版本', '导出超过 5000 行的数据集'],
      attempted_fixes: ['清除浏览器缓存'],
      expected: '导出正常完成',
      customer_impact: '无法导出运营报表',
    },
    en: {
      category: 'bug',
      severity: 'high',
      priority: 'P1',
      product_version: '3.2.0',
      platform: { os: 'Windows 11', browser: 'Chrome 120' },
      summary: 'Excel export hangs when row count exceeds 5,000',
      reproduction: ['Upgrade to 3.2.0', 'Export a dataset with more than 5,000 rows'],
      attempted_fixes: ['Clearing the browser cache'],
      expected: 'Export completes successfully',
      customer_impact: 'Operations reports cannot be exported',
    },
  },
};

export function getFixture(key: string, locale: Locale): unknown | undefined {
  const f = FIXTURES[key] ?? JSON_FIXTURES[key];
  if (!f) return undefined;
  return f[locale];
}
