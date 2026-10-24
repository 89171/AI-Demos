import type { DemoSpec, L, ParamSpec, Sample, TextSample } from '../types';

const t = (zh: string, en: string): L => ({ zh, en });

/* ------------------------------------------------------------------ helpers */

const text = (
  id: string,
  label: L,
  zh: string,
  en: string,
  extra?: Partial<TextSample>
): TextSample => ({ id, label, text: t(zh, en), ...extra });

const field = (key: string, label: L, placeholder: L) => ({ key, label, placeholder });

const img = (id: string, label: L, src: string, caption?: L, reference?: string): Sample => ({
  id,
  label,
  src: `/samples/${src}`,
  caption,
  reference: reference ? `/samples/${reference}` : undefined,
});

/** Image / audio sample that also carries editable text fields. */
const media = (
  id: string,
  label: L,
  src: string,
  fields: Record<string, L>,
  caption?: L
): Sample => ({ id, label, src: `/samples/${src}`, fields, caption });

const aud = (id: string, label: L, src: string, caption?: L, reference?: string): Sample => ({
  id,
  label,
  src: `/samples/${src}`,
  caption,
  reference: reference ? `/samples/${reference}` : undefined,
});

const vid = (id: string, label: L, src: string, caption?: L): Sample => ({
  id,
  label,
  src: `/samples/${src}`,
  caption,
});

const p = (
  key: string,
  label: L,
  type: ParamSpec['type'],
  def: string | number | boolean,
  extra: Partial<ParamSpec> = {}
): ParamSpec => ({ key, label, type, default: def, ...extra });

/* -------------------------------------------------------------------- specs */

export const DEMOS: Record<string, Record<string, DemoSpec>> = {
  /* =================================================================== text */
  text: {
    classification: {
      category: 'text',
      subcategory: 'classification',
      tagline: t('给一段文字打上类别标签', 'Assign category labels to a piece of text'),
      task: t(
        '模型对输入文本进行判别式分类，输出候选类别与置信度。示例为通用语料，切换模型后输入保持不变。',
        'Discriminative classification returns candidate labels with confidence. Samples are shared across models.'
      ),
      inputMode: 'text',
      outputKind: 'labels',
      params: [
        p('threshold', t('置信度阈值', 'Confidence threshold'), 'range', 0.15, { min: 0, max: 0.9, step: 0.05 }),
        p(
          'task',
          t('判别任务', 'Task head'),
          'select',
          'auto',
          {
            options: [
              { value: 'auto', label: t('自动判定', 'Auto') },
              { value: 'sentiment', label: t('情感分析', 'Sentiment') },
              { value: 'intent', label: t('意图识别', 'Intent') },
              { value: 'toxicity', label: t('毒性检测', 'Toxicity') },
            ],
          }
        ),
      ],
      samples: [
        text(
          'restaurant',
          t('餐厅点评（正向）', 'Restaurant review (positive)'),
          '这家餐厅的服务态度非常好，服务员很热情，菜品也很美味，摆盘精致。人均消费一百出头，性价比很高，下次还会再来。',
          'The service at this restaurant was excellent. The staff were friendly, the food was delicious and beautifully plated. Around 100 yuan per person — great value. I will definitely come back.'
        ),
        text(
          'flight',
          t('航班延误（负向）', 'Flight delay (negative)'),
          '航班延误了四个小时，航空公司全程没有任何通知，客服电话也一直打不通。行李还丢了一件，整体体验非常糟糕。',
          'The flight was delayed by four hours with no notice from the airline, and the support line was unreachable. On top of that one of my bags was lost. A terrible experience overall.'
        ),
        text(
          'support',
          t('客服工单（意图）', 'Support ticket (intent)'),
          '我上周五下的订单到现在还没有发货，麻烦帮我查一下物流状态，如果明天还不能发出我就申请退款。',
          'My order placed last Friday still has not shipped. Please check the tracking status — if it cannot go out by tomorrow I will request a refund.'
        ),
        text(
          'moderation',
          t('社区评论（审核）', 'Community post (moderation)'),
          '这篇测评完全是在胡说八道，作者根本不懂这个行业，纯属垃圾内容，建议大家不要浪费时间。',
          'This review is complete nonsense. The author clearly knows nothing about the industry. Pure garbage — do not waste your time.'
        ),
      ],
    },

    translation: {
      category: 'text',
      subcategory: 'translation',
      tagline: t('跨语言逐句翻译', 'Translate text across languages'),
      task: t(
        '序列到序列模型把源语言文本翻译为目标语言，可调整语言对与解码策略。',
        'A sequence-to-sequence model translates the source text into the target language. Language pair and decoding are configurable.'
      ),
      inputMode: 'text',
      outputKind: 'text',
      params: [
        p('sourceLang', t('源语言', 'Source language'), 'select', 'auto', {
          options: [
            { value: 'auto', label: t('自动检测', 'Auto detect') },
            { value: 'zh', label: t('中文', 'Chinese') },
            { value: 'en', label: t('英语', 'English') },
            { value: 'ja', label: t('日语', 'Japanese') },
            { value: 'fr', label: t('法语', 'French') },
          ],
        }),
        p('targetLang', t('目标语言', 'Target language'), 'select', 'en', {
          options: [
            { value: 'en', label: t('英语', 'English') },
            { value: 'zh', label: t('中文', 'Chinese') },
            { value: 'ja', label: t('日语', 'Japanese') },
            { value: 'fr', label: t('法语', 'French') },
          ],
        }),
        p('maxTokens', t('最大长度', 'Max tokens'), 'range', 256, { min: 32, max: 1024, step: 32 }),
      ],
      samples: [
        text(
          'news',
          t('新闻导语', 'News lead'),
          '受台风外围环流影响，本市未来三天将出现持续强降雨，气象部门提醒市民减少外出，注意防范城市内涝。',
          'Influenced by the outer circulation of the typhoon, the city will see sustained heavy rainfall over the next three days. The meteorological bureau advises residents to stay indoors and guard against urban flooding.'
        ),
        text(
          'product',
          t('产品文案', 'Product copy'),
          '轻至 1.2 公斤的机身配合 18 小时续航，让你在通勤路上也能随时开始创作。',
          'A 1.2 kg chassis paired with 18 hours of battery life lets you start creating anywhere — even on your commute.'
        ),
        text(
          'tech',
          t('技术文档', 'Technical doc'),
          '该接口支持流式响应，客户端需要在收到结束标记后主动关闭连接，否则会触发服务端的空闲超时回收。',
          'This endpoint supports streaming responses. Clients must close the connection after receiving the end marker, otherwise the server reclaims it on idle timeout.'
        ),
      ],
    },

    summarization: {
      category: 'text',
      subcategory: 'summarization',
      tagline: t('把长文压成要点', 'Compress long documents into key points'),
      task: t(
        '编码器-解码器模型生成抽象式摘要，同时抽取关键句作为对照。',
        'An encoder-decoder model produces an abstractive summary, with extracted key sentences for comparison.'
      ),
      inputMode: 'text',
      outputKind: 'text',
      params: [
        p('maxLength', t('摘要长度', 'Summary length'), 'range', 96, { min: 24, max: 256, step: 8 }),
        p('style', t('风格', 'Style'), 'select', 'bullets', {
          options: [
            { value: 'paragraph', label: t('段落式', 'Paragraph') },
            { value: 'bullets', label: t('要点式', 'Bullet points') },
          ],
        }),
      ],
      samples: [
        text(
          'report',
          t('季度经营简报', 'Quarterly business brief'),
          '本季度公司实现营业收入 12.4 亿元，同比增长 18.6%，环比增长 6.2%。云服务业务贡献营收 5.1 亿元，占总收入的 41%，同比增长 34%。硬件业务受上游芯片供应影响，营收同比下滑 3.5%，毛利率从 22% 下降至 18%。研发投入 2.8 亿元，占营收比重提升至 22.6%，主要用于端侧推理框架与多模态模型。销售费用率下降 1.4 个百分点，主要得益于自助注册渠道占比提升。管理层预计下季度云服务仍将保持 25% 以上的增速，硬件业务有望在四季度随供应链缓解而回暖。',
          'Revenue this quarter reached 1.24 billion yuan, up 18.6% year on year and 6.2% quarter on quarter. Cloud services contributed 510 million yuan, 41% of total revenue and up 34% year on year. The hardware segment declined 3.5% year on year due to upstream chip supply constraints, with gross margin falling from 22% to 18%. R&D spend was 280 million yuan, lifting its share of revenue to 22.6%, focused on on-device inference frameworks and multimodal models. The sales expense ratio dropped 1.4 points, helped by a higher share of self-service signups. Management expects cloud growth above 25% next quarter, with hardware recovering in Q4 as supply eases.'
        ),
        text(
          'meeting',
          t('会议纪要', 'Meeting notes'),
          '本周项目例会先同步了上周遗留问题的关闭情况，共 12 个阻塞项中 9 个已解决，剩余 3 个集中在支付渠道对接。随后产品同学介绍了新版首页方案，会上主要争议在于信息密度，设计侧主张精简卡片数量，运营侧希望保留更多入口。最终决定采用 A/B 实验的方式验证，实验周期两周，以次日留存和点击转化作为核心指标。技术侧提出埋点方案需要在周三前完成评审，否则会影响到上线时间。最后确认下次例会改为周三上午十点，地点在 12 楼会议室。',
          'The weekly sync opened with the status of last week\u2019s blockers: 9 of 12 were resolved, with the remaining 3 concentrated in payment channel integration. Product then presented the new homepage proposal, where the main debate was information density — design wanted fewer cards while operations wanted to keep more entry points. The team agreed to settle it with a two-week A/B test using next-day retention and click-through as the primary metrics. Engineering flagged that the tracking plan must pass review by Wednesday or the launch date slips. Finally, the next sync moves to Wednesday 10:00 in the 12th-floor meeting room.'
        ),
      ],
    },
    'token-classification': {
      category: 'text',
      subcategory: 'token-classification',
      tagline: t('找出文本里的人名、地名与机构', 'Find people, places and organisations in text'),
      task: t(
        '序列标注模型为每个 token 预测实体标签，再把相邻 token 合并成完整实体。英文模型只认英文；多语言模型也覆盖中文。',
        'A sequence tagger labels every token, then adjacent tokens merge into whole entities. The English model reads English only; the multilingual one also covers Chinese.'
      ),
      inputMode: 'text',
      outputKind: 'json',
      params: [p('minScore', t('最低置信度', 'Minimum score'), 'range', 0.6, { min: 0.1, max: 0.99, step: 0.05 })],
      samples: [
        text(
          'news-en',
          t('英文新闻', 'English news'),
          'Apple CEO Tim Cook met Microsoft chief Satya Nadella in London on Monday to discuss a partnership with the University of Oxford.',
          'Apple CEO Tim Cook met Microsoft chief Satya Nadella in London on Monday to discuss a partnership with the University of Oxford.'
        ),
        text(
          'news-zh',
          t('中文新闻（需多语言模型）', 'Chinese news (multilingual model)'),
          '苹果公司首席执行官蒂姆·库克周一在北京会见了清华大学校长，双方讨论了合作事宜。',
          'Apple CEO Tim Cook met the president of Tsinghua University in Beijing on Monday to discuss cooperation.'
        ),
      ],
    },

    'question-answering': {
      category: 'text',
      subcategory: 'question-answering',
      tagline: t('从段落里找出问题的答案', 'Find the answer to a question inside a passage'),
      task: t(
        '抽取式问答模型在给定文本中预测答案的起止位置，答案一定出自原文。模型为英文 SQuAD 微调。',
        'An extractive QA model predicts the start and end of the answer span, so the answer is always quoted from the passage. The checkpoints are English SQuAD fine-tunes.'
      ),
      inputMode: 'text',
      outputKind: 'text',
      textFields: [{ key: 'question', label: t('问题', 'Question'), placeholder: t('例如：Who wrote the report?', 'e.g. Who wrote the report?') }],
      samples: [
        text(
          'paris',
          t('地理常识', 'Geography'),
          'Paris is the capital and most populous city of France. Situated on the Seine River, in the north of the country, it has an estimated population of 2.1 million residents within its city limits. The Eiffel Tower, completed in 1889, is its best-known landmark.',
          'Paris is the capital and most populous city of France. Situated on the Seine River, in the north of the country, it has an estimated population of 2.1 million residents within its city limits. The Eiffel Tower, completed in 1889, is its best-known landmark.',
          { fields: { question: t('When was the Eiffel Tower completed?', 'When was the Eiffel Tower completed?') } }
        ),
        text(
          'release',
          t('产品发布', 'Product release'),
          'Acme Cloud 3.0 was released on March 14 by the platform team led by Dana Whitfield. It adds a streaming API, cuts cold-start latency by 40 percent, and drops support for Python 3.8.',
          'Acme Cloud 3.0 was released on March 14 by the platform team led by Dana Whitfield. It adds a streaming API, cuts cold-start latency by 40 percent, and drops support for Python 3.8.',
          { fields: { question: t('Who led the team?', 'Who led the team?') } }
        ),
      ],
    },

  },

  /* ==================================================================== llm */
  llm: {
    chat: {
      category: 'llm',
      subcategory: 'chat',
      tagline: t('本地小模型的流式对话', 'Streaming chat with a local small model'),
      task: t(
        '指令微调模型在浏览器中逐 token 生成回复，可调整采样温度与系统提示。',
        'An instruction-tuned model generates token by token in the browser. Temperature and system prompt are adjustable.'
      ),
      inputMode: 'text',
      outputKind: 'chat',
      textFields: [
        {
          key: 'system',
          label: t('系统提示', 'System prompt'),
          placeholder: t('设定模型的角色与约束…', 'Set the model role and constraints…'),
          multiline: true,
        },
      ],
      params: [
        p('temperature', t('温度', 'Temperature'), 'range', 0.7, { min: 0, max: 2, step: 0.1 }),
        p('maxTokens', t('最大输出', 'Max output tokens'), 'range', 512, { min: 64, max: 2048, step: 64 }),
        p('stream', t('流式输出', 'Stream tokens'), 'toggle', true),
      ],
      samples: [
        text(
          'explain',
          t('概念解释', 'Concept explainer'),
          '用三句话解释什么是模型量化，并举一个生活中的类比。',
          'Explain in three sentences what model quantization is, and give a everyday analogy.',
          { fields: { system: t('你是一个严谨、简洁的助手，回答控制在 200 字以内。', 'You are a rigorous, concise assistant. Keep answers under 120 words.') } }
        ),
        text(
          'reason',
          t('逻辑推理', 'Reasoning'),
          '一个水池有两个进水管和一个出水管。甲管单独注满需要 6 小时，乙管需要 8 小时，出水管单独排空需要 12 小时。三管同时开启，多久能注满水池？请给出计算过程。',
          'A pool has two inlet pipes and one drain. Pipe A fills it in 6 hours, pipe B in 8 hours, and the drain empties it in 12 hours. With all three open, how long until the pool is full? Show your working.',
          { fields: { system: t('你擅长分步骤推理，先列公式再代入数值。', 'You reason step by step: set up the formula, then substitute numbers.') } }
        ),
        text(
          'writing',
          t('文案润色', 'Copy polish'),
          '帮我把这句话改得更简洁有力：我们致力于通过先进的人工智能技术，为广大用户提供更加便捷高效的服务体验。',
          'Make this sentence tighter and punchier: We are committed to leveraging advanced artificial intelligence technologies to provide our broad user base with a more convenient and efficient service experience.',
          { fields: { system: t('你是资深中文编辑，给出改写结果和简短理由。', 'You are a senior editor. Provide the rewrite and a short rationale.') } }
        ),
      ],
    },

    'structured-output': {
      category: 'llm',
      subcategory: 'structured-output',
      tagline: t('让模型只吐合法 JSON', 'Constrain the model to valid JSON'),
      task: t(
        '通过语法约束或 Schema 引导，保证输出严格符合预期结构，便于下游程序消费。',
        'Grammar constraints or schema guidance guarantee output that downstream programs can consume directly.'
      ),
      inputMode: 'text',
      outputKind: 'json',
      params: [
        p('schema', t('目标结构', 'Target schema'), 'select', 'job', {
          options: [
            { value: 'job', label: t('招聘信息', 'Job posting') },
            { value: 'event', label: t('新闻事件', 'News event') },
            { value: 'ticket', label: t('客服工单', 'Support ticket') },
          ],
        }),
        p('strict', t('严格模式', 'Strict mode'), 'toggle', true),
      ],
      samples: [
        text(
          'job',
          t('招聘 JD', 'Job description'),
          '我们正在招聘一名高级前端工程师，工作地点在深圳南山，负责公司核心数据看板的重构。要求 5 年以上前端经验，精通 React 与 TypeScript，熟悉 WebGL 或 Canvas 可视化，有大型项目性能优化经验者优先。薪资范围 35K-55K，14 薪，支持每周两天远程办公。',
          'We are hiring a Senior Front-end Engineer in Nanshan, Shenzhen to rebuild our core analytics dashboard. Requires 5+ years of front-end experience, strong React and TypeScript, familiarity with WebGL or Canvas visualisation, and large-scale performance tuning. Compensation 35–55K CNY per month, 14 months per year, with two remote days per week.'
        ),
        text(
          'event',
          t('新闻事件', 'News event'),
          '昨天下午三点左右，位于城东的物流仓库发生火情，消防部门出动 12 辆消防车赶赴现场，约两小时后明火被扑灭。事故未造成人员伤亡，初步判断由电气线路老化引起，具体损失仍在统计中。',
          'At around 3 pm yesterday a fire broke out at a logistics warehouse in the east of the city. The fire service dispatched 12 engines and the flames were put out about two hours later. No casualties were reported; the cause is preliminarily attributed to ageing electrical wiring, and losses are still being assessed.'
        ),
        text(
          'ticket',
          t('客服工单', 'Support ticket'),
          '用户反馈：昨天升级到 3.2.0 版本后，导出 Excel 时如果行数超过 5000 行就会卡死，浏览器版本是 Chrome 120，操作系统 Windows 11。已经尝试清除缓存无效，希望尽快修复。',
          'User report: after upgrading to 3.2.0 yesterday, exporting Excel hangs whenever the row count exceeds 5,000. Browser is Chrome 120 on Windows 11. Clearing the cache did not help. Please fix soon.'
        ),
      ],
    },

    code: {
      category: 'llm',
      subcategory: 'code',
      tagline: t('代码补全、解释与改写', 'Complete, explain and refactor code'),
      task: t(
        '代码大模型针对给定指令生成或改造代码片段，支持多种语言与任务类型。',
        'A code LLM generates or rewrites snippets according to an instruction, across languages and task types.'
      ),
      inputMode: 'text',
      outputKind: 'code',
      params: [
        p('language', t('目标语言', 'Language'), 'select', 'typescript', {
          options: [
            { value: 'typescript', label: t('TypeScript', 'TypeScript') },
            { value: 'python', label: t('Python', 'Python') },
            { value: 'rust', label: t('Rust', 'Rust') },
          ],
        }),
        p('task', t('任务类型', 'Task'), 'select', 'generate', {
          options: [
            { value: 'generate', label: t('生成代码', 'Generate') },
            { value: 'explain', label: t('解释代码', 'Explain') },
            { value: 'refactor', label: t('重构优化', 'Refactor') },
          ],
        }),
      ],
      samples: [
        text(
          'debounce',
          t('生成工具函数', 'Generate a utility'),
          '写一个 TypeScript 防抖函数，支持 leading 立即执行选项，并且保留 this 与参数类型。',
          'Write a TypeScript debounce helper that supports a leading option and preserves this plus argument types.'
        ),
        text(
          'explain',
          t('解释一段代码', 'Explain a snippet'),
          '解释下面这段代码做了什么，以及它可能的性能问题：\n\nconst cache = new Map();\nfunction fib(n) {\n  if (n < 2) return n;\n  if (cache.has(n)) return cache.get(n);\n  const v = fib(n - 1) + fib(n - 2);\n  cache.set(n, v);\n  return v;\n}',
          'Explain what this code does and any performance issues:\n\nconst cache = new Map();\nfunction fib(n) {\n  if (n < 2) return n;\n  if (cache.has(n)) return cache.get(n);\n  const v = fib(n - 1) + fib(n - 2);\n  cache.set(n, v);\n  return v;\n}'
        ),
        text(
          'refactor',
          t('重构冗余逻辑', 'Refactor duplication'),
          '把这段代码重构得更清晰，去掉重复判断：\n\nfunction price(user) {\n  if (user.level === "vip") {\n    if (user.years > 3) return 0.6;\n    return 0.8;\n  }\n  if (user.level === "normal") {\n    if (user.years > 3) return 0.9;\n    return 1;\n  }\n  return 1.2;\n}',
          'Refactor for clarity, removing the repeated checks:\n\nfunction price(user) {\n  if (user.level === "vip") {\n    if (user.years > 3) return 0.6;\n    return 0.8;\n  }\n  if (user.level === "normal") {\n    if (user.years > 3) return 0.9;\n    return 1;\n  }\n  return 1.2;\n}'
        ),
      ],
    },
  },

  /* ============================================================= search-rag */
  'search-rag': {
    embedding: {
      category: 'search-rag',
      subcategory: 'embedding',
      tagline: t('句子 → 向量 → 相似度', 'Sentences to vectors to similarity'),
      task: t(
        '嵌入模型把每行文本编码为稠密向量，用于相似度计算、聚类与检索。',
        'An embedding model encodes each line into a dense vector used for similarity, clustering and retrieval.'
      ),
      inputMode: 'lines',
      outputKind: 'embedding',
      params: [
        p('dim', t('展示维度', 'Displayed dims'), 'range', 16, { min: 8, max: 32, step: 4 }),
        p('normalize', t('归一化', 'L2 normalise'), 'toggle', true),
      ],
      samples: [
        {
          id: 'mixed',
          label: t('混合话题', 'Mixed topics'),
          text: t('', ''),
          lines: [
            { text: t('今天北京的最高气温达到 32 摄氏度。', 'The highest temperature in Beijing reached 32 °C today.') },
            { text: t('未来三天华北地区有强降雨。', 'Heavy rain is expected across North China over the next three days.') },
            { text: t('沪深两市今日成交额突破一万亿元。', 'Trading turnover on the Shanghai and Shenzhen exchanges topped one trillion yuan.') },
            { text: t('国家队在决赛中逆转夺冠。', 'The national team came from behind to win the final.') },
            { text: t('新一代芯片采用 3 纳米制程工艺。', 'The new chip uses a 3-nanometre process node.') },
            { text: t('大模型推理框架支持端侧部署。', 'The inference framework now supports on-device deployment.') },
          ],
        },
      ],
    },

    reranker: {
      category: 'search-rag',
      subcategory: 'reranker',
      tagline: t('给召回结果重新打分', 'Rescore retrieved candidates'),
      task: t(
        '交叉编码器把查询与每条候选拼在一起编码，输出相关性分数并重新排序。',
        'A cross-encoder encodes the query together with each candidate, producing relevance scores that reorder the list.'
      ),
      inputMode: 'lines',
      outputKind: 'ranking',
      textFields: [
        { key: 'query', label: t('查询', 'Query'), placeholder: t('输入检索问题…', 'Enter the search query…') },
      ],
      params: [
        p('topK', t('返回条数', 'Top-K'), 'range', 5, { min: 1, max: 8, step: 1 }),
      ],
      samples: [
        {
          id: 'rag',
          label: t('技术问答召回', 'Technical QA recall'),
          text: t('', ''),
          fields: {
            query: t('浏览器端如何做图像去噪？', 'How do I denoise images in the browser?'),
          },
          lines: [
            { text: t('使用 NAFNet 等轻量去噪网络，通过 onnxruntime-web 在 WebGPU 后端执行推理。', 'Use a lightweight denoiser such as NAFNet, executed on the WebGPU backend through onnxruntime-web.'), meta: t('文档 A', 'Doc A') },
            { text: t('浏览器内存受限，处理超大图片时应分块推理再拼回，避免一次性分配过多显存。', 'Browser memory is limited — tile large images and stitch the result instead of allocating everything at once.'), meta: t('文档 B', 'Doc B') },
            { text: t('WebGPU 相比 WebGL 更适合卷积网络，但需要处理设备丢失与兼容性回退。', 'WebGPU suits convolutional networks better than WebGL, but you must handle device loss and fall back gracefully.'), meta: t('文档 C', 'Doc C') },
            { text: t('语音降噪通常基于 RNNoise 或 DeepFilterNet，与图像处理无关。', 'Speech denoising usually relies on RNNoise or DeepFilterNet and is unrelated to image processing.'), meta: t('文档 D', 'Doc D') },
            { text: t('可以通过 CSS filter 调整亮度与对比度，但这不是真正的去噪。', 'CSS filters can adjust brightness and contrast, but that is not real denoising.'), meta: t('文档 E', 'Doc E') },
          ],
        },
      ],
    },

    'semantic-search': {
      category: 'search-rag',
      subcategory: 'semantic-search',
      tagline: t('用自然语言检索语料', 'Retrieve a corpus in natural language'),
      task: t(
        '查询与语料分别向量化后计算余弦相似度，返回最相关的片段。',
        'Query and corpus are embedded separately, compared by cosine similarity, and the most relevant passages are returned.'
      ),
      inputMode: 'lines',
      outputKind: 'search',
      textFields: [
        { key: 'query', label: t('查询', 'Query'), placeholder: t('想找什么？', 'What are you looking for?') },
      ],
      params: [p('topK', t('返回条数', 'Top-K'), 'range', 3, { min: 1, max: 6, step: 1 })],
      samples: [
        {
          id: 'kb',
          label: t('产品知识库', 'Product knowledge base'),
          text: t('', ''),
          fields: {
            query: t('忘记密码怎么找回？', 'How do I reset a forgotten password?'),
          },
          lines: [
            { text: t('账号安全：连续输错密码 5 次会锁定 15 分钟，可通过绑定的手机号接收验证码解锁。', 'Account security: five failed attempts lock the account for 15 minutes; unlock with an SMS code sent to the bound phone number.'), meta: t('S-01', 'S-01') },
            { text: t('重置密码：在登录页点击“忘记密码”，输入注册邮箱，系统会发送有效期 30 分钟的重置链接。', 'Password reset: click “Forgot password” on the sign-in page, enter your registered email, and the system sends a reset link valid for 30 minutes.'), meta: t('S-02', 'S-02') },
            { text: t('发票申请：订单完成后 7 天内可在“订单详情-申请开票”中提交，电子发票一般 24 小时内发出。', 'Invoicing: within 7 days of order completion, submit via Order Detail → Request Invoice. E-invoices are usually issued within 24 hours.'), meta: t('S-03', 'S-03') },
            { text: t('退款政策：未发货订单可随时取消并全额退款，已发货订单需在签收后 7 天内申请。', 'Refund policy: unshipped orders can be cancelled for a full refund at any time; shipped orders must be requested within 7 days of delivery.'), meta: t('S-04', 'S-04') },
            { text: t('企业认证：需要上传营业执照与法人身份证照片，审核通常在 1 到 2 个工作日完成。', 'Business verification: upload the business licence and legal representative ID; review usually completes in 1–2 business days.'), meta: t('S-05', 'S-05') },
          ],
        },
        {
          id: 'docs',
          label: t('技术文档', 'Engineering docs'),
          text: t('', ''),
          fields: {
            query: t('如何处理大量请求时的限流？', 'How do I rate limit under heavy traffic?'),
          },
          lines: [
            { text: t('令牌桶算法允许短时突发流量，桶容量决定突发上限，补充速率决定长期平均速率。', 'The token bucket algorithm absorbs short bursts: bucket capacity caps the burst, refill rate sets the long-run average.'), meta: t('D-01', 'D-01') },
            { text: t('滑动窗口计数可以避免固定窗口在边界处的双倍放量问题。', 'Sliding-window counters avoid the double-burst problem at fixed-window boundaries.'), meta: t('D-02', 'D-02') },
            { text: t('分布式限流需要把计数放到 Redis 中，使用 Lua 脚本保证判断与扣减的原子性。', 'Distributed rate limiting stores counters in Redis, using a Lua script to keep check-and-decrement atomic.'), meta: t('D-03', 'D-03') },
            { text: t('日志采集建议使用结构化格式，便于后续做聚合分析。', 'Prefer structured logs so downstream aggregation is straightforward.'), meta: t('D-04', 'D-04') },
            { text: t('当上游服务不可用时，熔断器会快速失败，避免级联雪崩。', 'When upstream services fail, a circuit breaker fails fast and prevents cascading collapse.'), meta: t('D-05', 'D-05') },
          ],
        },
      ],
    },
  },

  /* ================================================================= vision */
  vision: {
    detection: {
      category: 'vision',
      subcategory: 'detection',
      tagline: t('在图中找出并框选目标', 'Find and box objects in an image'),
      task: t(
        '单阶段检测器输出边界框、类别与置信度。内置示例图片自带标注，切换到任意模型都能得到一致且可对照的结果。',
        'A single-stage detector outputs boxes, classes and confidence. Built-in samples carry annotations so any model returns comparable results.'
      ),
      inputMode: 'image',
      outputKind: 'detection',
      params: [
        p('conf', t('置信度阈值', 'Confidence threshold'), 'range', 0.4, { min: 0.05, max: 0.95, step: 0.05 }),
        p('nms', t('NMS IoU', 'NMS IoU'), 'range', 0.45, { min: 0.1, max: 0.9, step: 0.05 }),
      ],
      samples: [
        img('street', t('城市街景', 'Street scene'), 'street.png', t('车辆、行人、交通设施', 'Vehicles, pedestrians, street furniture')),
        img('desk', t('桌面物品', 'Desk objects'), 'desk.png', t('办公用品布局', 'An office desk layout')),
        img('poster', t('抽象画面', 'Abstract frame'), 'poster.png', t('低纹理图像，用于观察误检', 'Low-texture image to inspect false positives')),
      ],
    },

    segmentation: {
      category: 'vision',
      subcategory: 'segmentation',
      tagline: t('分离前景与背景', 'Separate foreground from background'),
      task: t(
        '分割模型为每个像素预测前景概率，可用于抠图、换背景与区域统计。',
        'The model predicts a foreground probability per pixel, enabling matting, background replacement and area statistics.'
      ),
      inputMode: 'image',
      outputKind: 'segmentation',
      params: [
        p('mode', t('输出模式', 'Output mode'), 'select', 'matte', {
          options: [
            { value: 'matte', label: t('透明背景', 'Transparent cutout') },
            { value: 'mask', label: t('掩码叠加', 'Mask overlay') },
          ],
        }),
        p('feather', t('边缘羽化', 'Edge feather'), 'range', 2, { min: 0, max: 8, step: 1 }),
        p('thresh', t('前景阈值', 'Foreground threshold'), 'range', 0.5, { min: 0.2, max: 0.8, step: 0.02 }),
      ],
      samples: [
        img('portrait', t('人像', 'Portrait'), 'portrait.png', t('单人主体', 'Single subject')),
        img('hand', t('手部', 'Hand'), 'hand.png'),
        img('desk', t('桌面物品', 'Desk objects'), 'desk.png'),
      ],
    },

    'background-removal': {
      category: 'vision',
      subcategory: 'background-removal',
      tagline: t('一键去掉图片背景', 'Remove an image background in one click'),
      task: t(
        '抠图模型为整张图预测 alpha 通道，主体保留、背景透明，适合证件照与商品图。',
        'A matting model predicts a per-pixel alpha channel — the subject stays, the background turns transparent.'
      ),
      inputMode: 'image',
      outputKind: 'segmentation',
      params: [
        p('mode', t('输出模式', 'Output mode'), 'select', 'matte', {
          options: [
            { value: 'matte', label: t('透明背景', 'Transparent cutout') },
            { value: 'mask', label: t('掩码叠加', 'Mask overlay') },
          ],
        }),
        p('feather', t('边缘羽化', 'Edge feather'), 'range', 2, { min: 0, max: 8, step: 1 }),
        p('thresh', t('前景阈值', 'Foreground threshold'), 'range', 0.5, { min: 0.2, max: 0.8, step: 0.02 }),
      ],
      samples: [
        img('portrait', t('人像', 'Portrait'), 'portrait.png', t('单人主体', 'Single subject')),
        img('hand', t('手部', 'Hand'), 'hand.png'),
        img('desk', t('桌面物品', 'Desk objects'), 'desk.png'),
      ],
    },

    'watermark-removal': {
      category: 'vision',
      subcategory: 'watermark-removal',
      tagline: t('涂抹水印，一键修复', 'Brush over a watermark and repair it'),
      task: t(
        '先用笔刷标出水印位置，修补网络只替换选中像素，周边内容自然延续。',
        'Mark the watermark with the brush; the inpainting network replaces only the painted pixels and continues the surroundings naturally.'
      ),
      inputMode: 'image',
      outputKind: 'inpainting',
      brush: true,
      params: [
        p('brushSize', t('笔刷大小', 'Brush size'), 'range', 36, { min: 8, max: 96, step: 4 }),
        p('feather', t('边缘融合', 'Feather edges'), 'range', 6, { min: 0, max: 24, step: 2 }),
        p('method', t('补全方式', 'Fill method'), 'select', 'patch', {
          options: [
            { value: 'patch', label: t('上下文补全', 'Context aware') },
            { value: 'blur', label: t('模糊填充', 'Blur fill') },
            { value: 'clone', label: t('邻近克隆', 'Clone nearby') },
          ],
        }),
      ],
      samples: [
        img('poster', t('带水印海报', 'Watermarked poster'), 'poster.png', t('右下角有明显水印', 'Visible watermark bottom-right')),
        img('street', t('街景', 'Street scene'), 'street.png'),
      ],
    },

    'object-removal': {
      category: 'vision',
      subcategory: 'object-removal',
      tagline: t('涂抹擦除多余物体', 'Paint over clutter to erase it'),
      task: t(
        '涂抹要删掉的对象，模型根据周围环境重建被遮挡的背景，画面其余部分保持原样。',
        'Paint the object you want gone; the model rebuilds the occluded background from its surroundings while the rest of the frame stays untouched.'
      ),
      inputMode: 'image',
      outputKind: 'inpainting',
      brush: true,
      params: [
        p('brushSize', t('笔刷大小', 'Brush size'), 'range', 36, { min: 8, max: 96, step: 4 }),
        p('feather', t('边缘融合', 'Feather edges'), 'range', 6, { min: 0, max: 24, step: 2 }),
        p('method', t('补全方式', 'Fill method'), 'select', 'patch', {
          options: [
            { value: 'patch', label: t('上下文补全', 'Context aware') },
            { value: 'blur', label: t('模糊填充', 'Blur fill') },
            { value: 'clone', label: t('邻近克隆', 'Clone nearby') },
          ],
        }),
      ],
      samples: [
        img('desk', t('桌面物品', 'Desk objects'), 'desk.png', t('擦除其中一件物品试试', 'Try erasing one of the objects')),
        img('street', t('街景杂物', 'Street clutter'), 'street.png'),
      ],
    },

    ocr: {
      category: 'vision',
      subcategory: 'ocr',
      tagline: t('从图片中提取文字', 'Extract text from an image'),
      task: t(
        '文字检测定位文本行，识别网络逐行解码，输出纯文本与带坐标的行结构。',
        'Text detection locates lines, the recogniser decodes them, and results come back as plain text plus positioned lines.'
      ),
      inputMode: 'image',
      outputKind: 'ocr',
      params: [
        p('lang', t('识别语言', 'Language'), 'select', 'chi_sim+eng', {
          options: [
            { value: 'chi_sim+eng', label: t('简体中文 + 英文', 'Simplified Chinese + English') },
            { value: 'eng', label: t('仅英文', 'English only') },
            { value: 'jpn', label: t('日语', 'Japanese') },
          ],
        }),
        p('layout', t('版面分析', 'Layout analysis'), 'toggle', true),
      ],
      samples: [
        img('document', t('发票单据', 'Invoice'), 'document.png', t('中英混排表格', 'Mixed Chinese/English layout')),
        img('poster', t('海报水印', 'Poster watermark'), 'poster.png', t('单行短文本', 'Single short line')),
      ],
    },

    depth: {
      category: 'vision',
      subcategory: 'depth',
      tagline: t('预测每个像素的距离', 'Predict per-pixel distance'),
      task: t(
        '单目深度估计把 RGB 图像映射为相对深度图，越亮表示越近。',
        'Monocular depth estimation maps RGB to a relative depth map; brighter means closer.'
      ),
      inputMode: 'image',
      outputKind: 'depth',
      params: [
        p('colormap', t('色彩映射', 'Colormap'), 'select', 'gray', {
          options: [
            { value: 'gray', label: t('灰度', 'Grayscale') },
            { value: 'turbo', label: t('Turbo', 'Turbo') },
            { value: 'viridis', label: t('Viridis', 'Viridis') },
          ],
        }),
        p('overlay', t('与原因叠加', 'Blend with source'), 'range', 0, { min: 0, max: 0.8, step: 0.05 }),
      ],
      samples: [
        img('street', t('街景透视', 'Street perspective'), 'street.png'),
        img('desk', t('桌面近景', 'Desk close-up'), 'desk.png'),
        img('pose', t('人物全身', 'Full body'), 'pose.png'),
      ],
    },

    'image-restoration': {
      category: 'vision',
      subcategory: 'image-restoration',
      tagline: t('超分、去噪与去模糊', 'Super-resolve, denoise and deblur'),
      task: t(
        '图像恢复模型在像素空间重建高频细节。示例提供退化图与原始参考图，便于前后对照。',
        'Restoration models rebuild high-frequency detail in pixel space. Samples ship with a clean reference for before/after comparison.'
      ),
      inputMode: 'image',
      outputKind: 'restoration',
      params: [
        p('task', t('恢复任务', 'Task'), 'select', 'denoise', {
          options: [
            { value: 'denoise', label: t('去噪', 'Denoise') },
            { value: 'sr', label: t('超分辨率 2×', 'Super-resolution 2×') },
            { value: 'deblur', label: t('去模糊 / 锐化', 'Deblur / sharpen') },
          ],
        }),
        p('strength', t('强度', 'Strength'), 'range', 0.7, { min: 0, max: 1, step: 0.05 }),
        p('compare', t('对比原图', 'Show reference'), 'toggle', true),
      ],
      samples: [
        img('noisy', t('噪点街景', 'Noisy street'), 'street-noisy.png', t('高斯噪声 + 轻微模糊', 'Gaussian noise plus slight blur'), 'street.png'),
        img('lowres', t('低分辨率', 'Low resolution'), 'street-lowres.png', t('三分之一分辨率放大', 'Upscaled from one third resolution'), 'street.png'),
        img('pnoisy', t('噪点人像', 'Noisy portrait'), 'portrait-noisy.png', t('人物肤色区域噪声', 'Noise across skin tones'), 'portrait.png'),
      ],
    },
    'super-resolution': {
      category: 'vision',
      subcategory: 'super-resolution',
      tagline: t('把小图放大成大图', 'Turn a small image into a large one'),
      task: t(
        '超分网络逐块重建高频细节，把低分辨率输入放大 2–4 倍，比插值更锐利。',
        'A super-resolution network rebuilds high-frequency detail tile by tile, upscaling low-resolution input 2–4x — far sharper than interpolation.'
      ),
      inputMode: 'image',
      outputKind: 'restoration',
      params: [
        p('task', t('恢复任务', 'Task'), 'select', 'sr', {
          options: [
            { value: 'sr', label: t('超分辨率 2×', 'Super-resolution 2×') },
            { value: 'denoise', label: t('去噪', 'Denoise') },
            { value: 'deblur', label: t('去模糊 / 锐化', 'Deblur / sharpen') },
          ],
        }),
        p('strength', t('强度', 'Strength'), 'range', 0.7, { min: 0, max: 1, step: 0.05 }),
        p('compare', t('对比原图', 'Show reference'), 'toggle', true),
      ],
      samples: [
        img('lowres', t('低分辨率街景', 'Low-resolution street'), 'street-lowres.png', t('三分之一分辨率放大', 'Upscaled from one third resolution'), 'street.png'),
        img('noisy', t('噪点街景', 'Noisy street'), 'street-noisy.png', t('高斯噪声 + 轻微模糊', 'Gaussian noise plus slight blur'), 'street.png'),
      ],
    },
    'image-enhancement': {
      category: 'vision',
      subcategory: 'image-enhancement',
      tagline: t('让模糊照片恢复清晰', 'Bring soft photos back into focus'),
      task: t(
        '增强网络一次完成去噪、去模糊与细节重建，在原尺寸上恢复画质。',
        'An enhancement network denoises, deblurs and rebuilds detail in a single pass at the original size.'
      ),
      inputMode: 'image',
      outputKind: 'restoration',
      params: [
        p('task', t('恢复任务', 'Task'), 'select', 'denoise', {
          options: [
            { value: 'denoise', label: t('去噪', 'Denoise') },
            { value: 'deblur', label: t('去模糊 / 锐化', 'Deblur / sharpen') },
            { value: 'sr', label: t('超分辨率 2×', 'Super-resolution 2×') },
          ],
        }),
        p('strength', t('强度', 'Strength'), 'range', 0.7, { min: 0, max: 1, step: 0.05 }),
        p('compare', t('对比原图', 'Show reference'), 'toggle', true),
      ],
      samples: [
        img('noisy', t('噪点街景', 'Noisy street'), 'street-noisy.png', t('高斯噪声 + 轻微模糊', 'Gaussian noise plus slight blur'), 'street.png'),
        img('pnoisy', t('噪点人像', 'Noisy portrait'), 'portrait-noisy.png', t('人物肤色区域噪声', 'Noise across skin tones'), 'portrait.png'),
      ],
    },
    'image-classification': {
      category: 'vision',
      subcategory: 'image-classification',
      tagline: t('判断整张图片属于哪一类', 'Decide what a whole image shows'),
      task: t(
        '分类网络对整张图片输出 ImageNet 1000 类的概率分布，返回前几名。',
        'A classifier outputs a probability distribution over the 1000 ImageNet classes for the whole image and returns the top few.'
      ),
      inputMode: 'image',
      outputKind: 'labels',
      params: [p('topK', t('返回条数', 'Top-K'), 'range', 5, { min: 1, max: 10, step: 1 })],
      samples: [
        img('street', t('城市街景', 'Street scene'), 'street.png'),
        img('desk', t('桌面物品', 'Desk objects'), 'desk.png'),
        img('portrait', t('人像', 'Portrait'), 'portrait.png'),
      ],
    },

    'zero-shot-detection': {
      category: 'vision',
      subcategory: 'zero-shot-detection',
      tagline: t('用一句话描述想找的目标', 'Describe the objects you want in words'),
      task: t(
        '开放词表检测把文字查询编码为向量，与每个候选框比对，所以不局限于训练时的固定类别。',
        'Open-vocabulary detection encodes text queries and matches them against every candidate box, so it is not limited to a fixed label set.'
      ),
      inputMode: 'image',
      outputKind: 'detection',
      textFields: [{ key: 'labels', label: t('目标描述（逗号分隔）', 'Queries (comma separated)'), placeholder: t('a person, a car, a traffic light', 'a person, a car, a traffic light') }],
      params: [p('conf', t('置信度阈值', 'Confidence threshold'), 'range', 0.1, { min: 0.02, max: 0.6, step: 0.02 })],
      samples: [
        media('street', t('城市街景', 'Street scene'), 'street.png', { labels: t('a person, a car, a traffic light', 'a person, a car, a traffic light') }),
        media('desk', t('桌面物品', 'Desk objects'), 'desk.png', { labels: t('a laptop, a cup, a keyboard', 'a laptop, a cup, a keyboard') }),
      ],
    },

  },

  /* ====================================================== generative-vision */
  'generative-vision': {
    'text-to-image': {
      category: 'generative-vision',
      subcategory: 'text-to-image',
      tagline: t('一句话生成一张图', 'One sentence, one image'),
      task: t(
        '扩散模型从随机噪声出发，按提示词逐步去噪。本页用确定性程序化渲染模拟采样过程，相同种子得到相同结果。',
        'A diffusion model denoises random latent noise toward the prompt. This page renders deterministically from the seed so identical inputs reproduce identical images.'
      ),
      inputMode: 'text',
      outputKind: 'generated-image',
      textFields: [
        {
          key: 'negative',
          label: t('负面提示词', 'Negative prompt'),
          placeholder: t('不希望出现的内容…', 'What to avoid…'),
        },
      ],
      params: [
        p('steps', t('采样步数', 'Steps'), 'range', 20, { min: 4, max: 40, step: 1 }),
        p('guidance', t('引导强度', 'Guidance'), 'range', 7.5, { min: 1, max: 15, step: 0.5 }),
        p('seed', t('随机种子', 'Seed'), 'range', 42, { min: 0, max: 9999, step: 1 }),
        p('ratio', t('画幅', 'Aspect ratio'), 'select', 'square', {
          options: [
            { value: 'square', label: t('1:1 方形', '1:1 square') },
            { value: 'wide', label: t('16:9 宽幅', '16:9 wide') },
            { value: 'tall', label: t('3:4 竖幅', '3:4 portrait') },
          ],
        }),
      ],
      samples: [
        text(
          'cyberpunk',
          t('赛博朋克雨夜', 'Cyberpunk rain'),
          '雨夜中的赛博朋克城市街道，霓虹灯招牌倒映在湿滑路面上，电影感，高对比度',
          'A cyberpunk city street on a rainy night, neon signs reflecting on wet asphalt, cinematic, high contrast',
          { fields: { negative: t('白天，晴空，低对比度，模糊', 'daylight, clear sky, low contrast, blurry') } }
        ),
        text(
          'minimal',
          t('极简雪山', 'Minimal mountain'),
          '黑白极简风格的雪山日出，长曝光，柔和渐变，大面积留白',
          'Minimal black-and-white sunrise over snow mountains, long exposure, soft gradients, generous negative space',
          { fields: { negative: t('彩色，杂乱前景，高饱和', 'colourful, cluttered foreground, oversaturated') } }
        ),
        text(
          'product',
          t('产品概念图', 'Product concept'),
          '一只戴宇航头盔的柴犬，工作室柔光，超写实摄影，浅景深',
          'A Shiba Inu wearing an astronaut helmet, studio softbox lighting, hyper-realistic photography, shallow depth of field',
          { fields: { negative: t('卡通，畸变五官，多只狗', 'cartoon, distorted features, multiple dogs') } }
        ),
      ],
    },

    inpainting: {
      category: 'generative-vision',
      subcategory: 'inpainting',
      tagline: t('涂抹之后重新生成', 'Paint a region and regenerate it'),
      task: t(
        '在图像上涂抹出要修改的区域，模型根据上下文补全内容，常用于去除水印与杂物。',
        'Paint the area you want changed; the model fills it in from context. Commonly used to remove watermarks and clutter.'
      ),
      inputMode: 'image',
      outputKind: 'inpainting',
      brush: true,
      params: [
        p('brushSize', t('笔刷大小', 'Brush size'), 'range', 36, { min: 8, max: 96, step: 4 }),
        p('feather', t('边缘融合', 'Feather edges'), 'range', 6, { min: 0, max: 24, step: 2 }),
        p('method', t('补全方式', 'Fill method'), 'select', 'patch', {
          options: [
            { value: 'patch', label: t('上下文补全', 'Context aware') },
            { value: 'blur', label: t('模糊填充', 'Blur fill') },
            { value: 'clone', label: t('邻近克隆', 'Clone nearby') },
          ],
        }),
      ],
      samples: [
        img('poster', t('带水印海报', 'Watermarked poster'), 'poster.png', t('右下角有明显水印', 'Visible watermark bottom-right')),
        img('street', t('街景杂物', 'Street clutter'), 'street.png'),
        img('desk', t('桌面物品', 'Desk objects'), 'desk.png'),
      ],
    },
  },

  /* ================================================================== audio */
  audio: {
    asr: {
      category: 'audio',
      subcategory: 'asr',
      tagline: t('语音转成带时间戳的文字', 'Speech to timestamped text'),
      task: t(
        '编码器把音频频谱映射为声学特征，解码器自回归生成文本。示例音频为真实合成语音。',
        'The encoder maps the spectrogram to acoustic features and a decoder generates text autoregressively. Sample clips are real synthesised speech.'
      ),
      inputMode: 'audio',
      outputKind: 'transcript',
      params: [
        p('lang', t('语言', 'Language'), 'select', 'auto', {
          options: [
            { value: 'auto', label: t('自动检测', 'Auto detect') },
            { value: 'zh', label: t('中文', 'Chinese') },
            { value: 'en', label: t('英语', 'English') },
          ],
        }),
        p('timestamps', t('时间戳', 'Word timestamps'), 'toggle', true),
        p('punctuate', t('自动标点', 'Auto punctuation'), 'toggle', true),
      ],
      samples: [
        aud('zh', t('中文日常对话', 'Chinese conversation'), 'speech-zh.mp3', t('“今天天气很好，我们一起去公园散步吧…”', '“今天天气很好，我们一起去公园散步吧…”')),
        aud('en', t('英文朗读', 'English read-aloud'), 'speech-en.mp3', t('The quick brown fox…', 'The quick brown fox…')),
        aud('zhmusic', t('带背景音乐', 'With music bed'), 'mix-zh-music.mp3', t('人声与音乐混合，考察鲁棒性', 'Speech mixed with music')),
      ],
    },

    tts: {
      category: 'audio',
      subcategory: 'tts',
      tagline: t('文字转自然语音', 'Text to natural speech'),
      task: t(
        '声学模型预测频谱，声码器重建波形。本页调用浏览器语音合成接口直接播放，可调语速与音高。',
        'An acoustic model predicts the spectrogram and a vocoder rebuilds the waveform. This page plays audio through the browser speech synthesis API with adjustable rate and pitch.'
      ),
      inputMode: 'text',
      outputKind: 'synth-audio',
      params: [
        p('voice', t('音色', 'Voice'), 'select', 'auto', {
          options: [
            { value: 'auto', label: t('跟随语言', 'Follow language') },
            { value: 'female', label: t('女声', 'Female') },
            { value: 'male', label: t('男声', 'Male') },
          ],
        }),
        p('rate', t('语速', 'Rate'), 'range', 1, { min: 0.5, max: 2, step: 0.05 }),
        p('pitch', t('音高', 'Pitch'), 'range', 1, { min: 0.5, max: 1.8, step: 0.05 }),
      ],
      samples: [
        text('greet', t('问候语', 'Greeting'), '你好，欢迎使用浏览器端语音合成演示。所有计算都在你的设备上完成。', 'Hello, and welcome to the in-browser text-to-speech demo. Everything runs on your own device.'),
        text('notify', t('播报通知', 'Notification'), '您有一笔新的订单待处理，请在十分钟内确认，超时将自动取消。', 'You have a new order awaiting confirmation. Please approve it within ten minutes or it will be cancelled automatically.'),
        text('story', t('故事旁白', 'Narration'), '夜色沉下来，城市的灯一盏一盏亮起，像有人在天幕上慢慢点起了星星。', 'Night fell, and the city lights came on one by one, like someone slowly lighting stars across the sky.'),
      ],
    },

    denoising: {
      category: 'audio',
      subcategory: 'denoising',
      tagline: t('从噪声中还原干净信号', 'Recover a clean signal from noise'),
      task: t(
        '降噪模型在时频域估计噪声分量并抑制，示例提供噪声版与干净版对照。',
        'The model estimates and suppresses noise in the time-frequency domain. Samples provide noisy and clean versions for comparison.'
      ),
      inputMode: 'audio',
      outputKind: 'audio-compare',
      params: [
        p('strength', t('降噪强度', 'Reduction strength'), 'range', 0.8, { min: 0, max: 1, step: 0.05 }),
        p('hpf', t('高通滤波', 'High-pass filter'), 'toggle', true),
      ],
      samples: [
        aud('zhnoisy', t('噪声中的人声', 'Speech in noise'), 'speech-zh-noisy.mp3', t('粉红噪声 + 人声', 'Pink noise plus speech'), 'speech-zh.mp3'),
        aud('musicmix', t('音乐干扰', 'Music interference'), 'mix-zh-music.mp3', t('固定音调干扰', 'Steady-tone interference'), 'speech-zh.mp3'),
      ],
    },

    'source-separation': {
      category: 'audio',
      subcategory: 'source-separation',
      tagline: t('把混音拆成独立音轨', 'Split a mix into separate stems'),
      task: t(
        '分离网络在频谱图上预测每个音源的掩码，再逆变换回波形，得到人声与伴奏。',
        'The separation network predicts a mask per source on the spectrogram, then inverts back to waveforms, yielding vocals and instrumental.'
      ),
      inputMode: 'audio',
      outputKind: 'stems',
      params: [
        p('model', t('音轨数量', 'Stem count'), 'select', '2', {
          options: [
            { value: '2', label: t('2 轨：人声 / 伴奏', '2 stems: vocals / instrumental') },
            { value: '4', label: t('4 轨：人声 / 鼓 / 贝斯 / 其他', '4 stems: vocals / drums / bass / other') },
          ],
        }),
        p('shift', t('时移增强', 'Shift trick'), 'range', 1, { min: 0, max: 2, step: 1 }),
      ],
      samples: [
        aud('enmix', t('英语人声 + 伴奏', 'English vocal + backing'), 'mix-en-music.mp3'),
        aud('zhmix', t('中文人声 + 伴奏', 'Chinese vocal + backing'), 'mix-zh-music.mp3'),
      ],
    },
    'audio-classification': {
      category: 'audio',
      subcategory: 'audio-classification',
      tagline: t('识别一段声音里发生了什么', 'Recognise what is happening in a sound clip'),
      task: t(
        '音频分类模型把频谱映射到声音事件（AudioSet 527 类）或语音指令，返回置信度最高的几类。',
        'An audio classifier maps the spectrogram to sound events (AudioSet 527 classes) or spoken commands and returns the top classes.'
      ),
      inputMode: 'audio',
      outputKind: 'labels',
      params: [p('topK', t('返回条数', 'Top-K'), 'range', 5, { min: 1, max: 10, step: 1 })],
      samples: [
        aud('speech', t('英语语音', 'English speech'), 'speech-en.mp3'),
        aud('mix', t('人声 + 音乐', 'Vocals with music'), 'mix-en-music.mp3'),
        aud('music', t('纯音乐', 'Music bed'), 'music-bed.mp3'),
      ],
    },

  },

  /* ======================================================== generative-audio */
  'generative-audio': {
    'text-to-music': {
      category: 'generative-audio',
      subcategory: 'text-to-music',
      tagline: t('用文字描述生成配乐', 'Generate a score from a description'),
      task: t(
        '模型根据文本条件生成音频 token 序列并解码为波形。本页用 Web Audio 按提示词映射和弦与音色，实时合成可播放片段。',
        'The model generates audio tokens conditioned on text and decodes them to a waveform. This page maps the prompt to chords and timbres with Web Audio and synthesises a playable clip live.'
      ),
      inputMode: 'text',
      outputKind: 'music',
      params: [
        p('duration', t('时长（秒）', 'Duration (s)'), 'range', 12, { min: 4, max: 30, step: 2 }),
        p('tempo', t('速度 BPM', 'Tempo BPM'), 'range', 96, { min: 60, max: 160, step: 4 }),
        p('key', t('调式', 'Key'), 'select', 'minor', {
          options: [
            { value: 'minor', label: t('小调', 'Minor') },
            { value: 'major', label: t('大调', 'Major') },
          ],
        }),
      ],
      samples: [
        text('calm', t('舒缓钢琴', 'Calm piano'), '舒缓的钢琴独奏，慢速，温暖，适合深夜阅读', 'Calm solo piano, slow tempo, warm, perfect for late-night reading'),
        text('action', t('紧张追逐', 'Tense chase'), '紧张快速的电子配乐，低音推进，适合动作片追逐场景', 'Fast tense electronic score with a driving bass, for an action chase scene'),
        text('lofi', t('Lo-Fi 循环', 'Lo-Fi loop'), 'Lo-Fi 嘻哈循环，慵懒鼓点，复古磁带质感，适合学习', 'Lo-Fi hip hop loop, lazy drums, vintage tape texture, good for studying'),
      ],
    },

    'voice-cloning': {
      category: 'generative-audio',
      subcategory: 'voice-cloning',
      tagline: t('用参考音色朗读新文本', 'Read new text in a reference voice'),
      task: t(
        '零样本声音克隆从几秒参考音频中提取说话人向量，再从文本合成同样音色的语音。',
        'Zero-shot voice cloning extracts a speaker embedding from a few seconds of reference audio, then synthesises new speech in that timbre.'
      ),
      inputMode: 'audio+text',
      outputKind: 'synth-audio',
      textFields: [
        {
          key: 'target',
          label: t('目标文本', 'Target text'),
          placeholder: t('要让参考音色朗读的内容…', 'Text the reference voice should read…'),
          multiline: true,
        },
      ],
      params: [
        p('similarity', t('相似度强度', 'Similarity'), 'range', 0.85, { min: 0, max: 1, step: 0.05 }),
        p('emotion', t('情绪', 'Emotion'), 'select', 'neutral', {
          options: [
            { value: 'neutral', label: t('中性', 'Neutral') },
            { value: 'happy', label: t('愉快', 'Happy') },
            { value: 'serious', label: t('严肃', 'Serious') },
          ],
        }),
      ],
      samples: [
        media(
          'refzh',
          t('中文参考音色', 'Chinese reference'),
          'speech-zh.mp3',
          {
            target: t(
              '欢迎使用浏览器端语音合成，这段话会用参考音色朗读出来。',
              'Welcome to browser-side speech synthesis — this line is read in the reference voice.'
            ),
          },
          t('参考样本', 'Reference sample')
        ),
        media(
          'refen',
          t('英文参考音色', 'English reference'),
          'speech-en.mp3',
          {
            target: t(
              'Browser-side inference keeps every sample on your own device.',
              'Browser-side inference keeps every sample on your own device.'
            ),
          },
          t('参考样本', 'Reference sample')
        ),
      ],
      resultTitle: t('克隆语音', 'Cloned speech'),
    },
  },

  /* ============================================================= multimodal */
  multimodal: {
    vlm: {
      category: 'multimodal',
      subcategory: 'vlm',
      tagline: t('看图回答问题', 'Answer questions about an image'),
      task: t(
        '视觉编码器把图像转为 token，与文本一起送入语言模型，生成开放式回答。',
        'A vision encoder turns the image into tokens that join the text prompt in a language model that produces open-ended answers.'
      ),
      inputMode: 'image+text',
      outputKind: 'chat',
      textFields: [
        {
          key: 'question',
          label: t('提问', 'Question'),
          placeholder: t('想了解图中的什么？', 'What do you want to know about the image?'),
        },
      ],
      params: [
        p('temperature', t('温度', 'Temperature'), 'range', 0.4, { min: 0, max: 1.5, step: 0.1 }),
        p('detail', t('细节程度', 'Detail'), 'select', 'high', {
          options: [
            { value: 'low', label: t('简短', 'Brief') },
            { value: 'high', label: t('详细', 'Detailed') },
          ],
        }),
      ],
      samples: [
        media('street', t('街景提问', 'Street QA'), 'street.png', {
          question: t('图中有哪些主要物体？它们大致在什么位置？', 'What are the main objects and roughly where are they?'),
        }),
        media('desk', t('桌面提问', 'Desk QA'), 'desk.png', {
          question: t('这个场景可能是什么地方？请描述可见的物品。', 'What kind of place is this? Describe the visible items.'),
        }),
        media('document', t('文档提问', 'Document QA'), 'document.png', {
          question: t('这张单据的关键信息有哪些？', 'What are the key fields on this document?'),
        }),
      ],
      resultTitle: t('模型回答', 'Model answer'),
    },

    clip: {
      category: 'multimodal',
      subcategory: 'clip',
      tagline: t('图文对齐打分', 'Score image-text alignment'),
      task: t(
        '对比学习训练的模型把图像与文本映射到同一空间，可直接比较相似度做零样本分类。',
        'Contrastively trained models map images and text into one space, so similarity comparison enables zero-shot classification.'
      ),
      inputMode: 'image+text',
      outputKind: 'labels',
      textFields: [
        {
          key: 'labels',
          label: t('候选标签（每行一个）', 'Candidate labels (one per line)'),
          placeholder: t('cat\ndog\ncar', 'cat\ndog\ncar'),
          multiline: true,
        },
      ],
      params: [p('topK', t('展示条数', 'Show top-K'), 'range', 5, { min: 1, max: 8, step: 1 })],
      samples: [
        media('street', t('街景候选词', 'Street labels'), 'street.png', {
          labels: t(
            '街道与汽车\n人物肖像\n室内办公桌\n一张图表\n夜空中的星星\n菜单与价目表',
            'a street with cars\na portrait of a person\nan indoor desk\na chart or diagram\nstarry night sky\na menu with prices'
          ),
        }),
        media('document', t('文档候选词', 'Document labels'), 'document.png', {
          labels: t(
            '一张发票单据\n城市街景\n宠物照片\n风景照',
            'an invoice document\na city street scene\na pet photo\na landscape'
          ),
        }),
      ],
    },

    'document-understanding': {
      category: 'multimodal',
      subcategory: 'document-understanding',
      tagline: t('文档 → 结构化字段', 'Document to structured fields'),
      task: t(
        '文档模型同时理解文字、版面与表格结构，直接输出可入库的结构化结果。',
        'Document models understand text, layout and table structure together, emitting structured records ready for downstream storage.'
      ),
      inputMode: 'image',
      outputKind: 'ocr',
      params: [
        p('schema', t('抽取模板', 'Extraction schema'), 'select', 'invoice', {
          options: [
            { value: 'invoice', label: t('发票字段', 'Invoice fields') },
            { value: 'generic', label: t('通用键值对', 'Generic key-value') },
          ],
        }),
        p('tables', t('解析表格', 'Parse tables'), 'toggle', true),
      ],
      samples: [
        img('document', t('发票', 'Invoice'), 'document.png', t('含多处中英混排字段', 'Mixed Chinese/English fields')),
      ],
    },
  },

  /* ============================================================= real-time */
  'real-time': {
    face: {
      category: 'real-time',
      subcategory: 'face',
      tagline: t('面部网格与关键点', 'Face mesh and landmarks'),
      task: t(
        '轻量检测器定位人脸，网格模型回归数百个关键点。开启摄像头后可看到实时叠加效果。',
        'A lightweight detector locates faces and a mesh model regresses hundreds of landmarks. Turn on the camera for live overlay.'
      ),
      inputMode: 'image',
      outputKind: 'landmarks-face',
      webcam: true,
      params: [
        p('mesh', t('显示网格', 'Show mesh'), 'toggle', true),
        p('points', t('显示关键点', 'Show points'), 'toggle', true),
        p('blur', t('人脸模糊', 'Blur faces'), 'toggle', false),
      ],
      samples: [
        img('portrait', t('正面人像', 'Frontal portrait'), 'portrait.png'),
        img('street', t('远景人物', 'Distant subject'), 'street.png'),
      ],
    },

    pose: {
      category: 'real-time',
      subcategory: 'pose',
      tagline: t('人体骨骼关键点', 'Human skeleton keypoints'),
      task: t('姿态模型回归 17 到 33 个关节点并连接为骨架，可用于动作识别与健身计数。',
        'Pose models regress 17–33 joints and connect them into a skeleton, useful for action recognition and rep counting.'),
      inputMode: 'image',
      outputKind: 'landmarks-pose',
      webcam: true,
      params: [
        p('skeleton', t('绘制骨架', 'Draw skeleton'), 'toggle', true),
        p('threshold', t('置信度阈值', 'Score threshold'), 'range', 0.5, { min: 0.1, max: 0.9, step: 0.05 }),
        p('smooth', t('时序平滑', 'Temporal smoothing'), 'toggle', true),
      ],
      samples: [
        img('pose', t('全身站立', 'Full body standing'), 'pose.png'),
        img('street', t('行人', 'Pedestrian'), 'street.png'),
      ],
    },

    hand: {
      category: 'real-time',
      subcategory: 'hand',
      tagline: t('手部 21 点检测', '21-point hand detection'),
      task: t('手部模型输出 21 个关节点，可识别常见手势，用于无接触交互。',
        'The hand model outputs 21 landmarks and recognises common gestures for touch-free interaction.'),
      inputMode: 'image',
      outputKind: 'landmarks-hand',
      webcam: true,
      params: [
        p('maxHands', t('最多手数', 'Max hands'), 'range', 2, { min: 1, max: 4, step: 1 }),
        p('gesture', t('手势识别', 'Gesture recognition'), 'toggle', true),
      ],
      samples: [img('hand', t('张开的手掌', 'Open palm'), 'hand.png'), img('portrait', t('人像（用于观察误检）', 'Portrait (false-positive check)'), 'portrait.png')],
    },

    tracking: {
      category: 'real-time',
      subcategory: 'tracking',
      tagline: t('跨帧保持目标 ID', 'Persistent IDs across frames'),
      task: t('检测 + 关联算法为每个目标分配稳定 ID，即使在遮挡后也能重新匹配。',
        'Detection plus association assigns stable IDs, re-matching targets even after occlusion.'),
      inputMode: 'video',
      outputKind: 'tracking',
      params: [
        p('maxAge', t('ID 保留帧数', 'Max age'), 'range', 30, { min: 5, max: 90, step: 5 }),
        p('conf', t('检测阈值', 'Detection threshold'), 'range', 0.3, { min: 0.05, max: 0.9, step: 0.05 }),
      ],
      samples: [
        vid('street', t('街景行人车辆', 'Street traffic'), 'street.mp4', t('8 秒，含移动目标', '8 seconds with moving targets')),
      ],
    },
  },

  /* ================================================================== video */
  video: {
    'video-understanding': {
      category: 'video',
      subcategory: 'video-understanding',
      tagline: t('给视频分段并打标签', 'Segment and label a video'),
      task: t('时序模型对抽帧序列编码，输出动作类别、时间段与整体摘要。',
        'A temporal model encodes sampled frames and outputs action classes, time ranges and an overall summary.'),
      inputMode: 'video',
      outputKind: 'video-timeline',
      params: [
        p('fps', t('抽帧频率', 'Sampling FPS'), 'range', 4, { min: 1, max: 12, step: 1 }),
        p('maxSegments', t('最多分段', 'Max segments'), 'range', 6, { min: 2, max: 10, step: 1 }),
      ],
      samples: [
        vid('street', t('街景片段', 'Street clip'), 'street.mp4', t('8 秒，行人车辆横向运动', '8 seconds, pedestrian and vehicle moving across frame')),
      ],
    },

    'video-watermark-removal': {
      category: 'video',
      subcategory: 'video-watermark-removal',
      tagline: t('框选水印，逐帧重建', 'Box the watermark, rebuild every frame'),
      task: t(
        '对水印选区做时域采样：背景在动就用时域中值直接重建干净背景；背景静止就用 MI-GAN 对代表帧做 AI 补全，显式选装的高清档改用 LaMa（约 198 MB，仅 WASM，慢但大水印重建更强），再把补丁贴回每一帧，经 WebCodecs 重编码为 MP4，真实权重模式下还会用 ffmpeg.wasm 把原音轨接回来。',
        'The watermark selection is sampled over time: a moving background is rebuilt directly by a temporal median, a static one is filled by MI-GAN on a representative frame — or by LaMa (~198 MB, WASM-only, stronger on large watermarks) in the explicit HD pass. The patch is composited onto every frame, re-encoded with WebCodecs, and the original audio is muxed back with ffmpeg.wasm in real-weights mode.'
      ),
      inputMode: 'video',
      outputKind: 'video-inpainting',
      params: [
        p('method', t('修复方式', 'Repair method'), 'select', 'auto', {
          options: [
            { value: 'auto', label: t('自动判定', 'Auto') },
            { value: 'temporal', label: t('时域中值', 'Temporal median') },
            { value: 'ai', label: t('AI 单帧补全', 'AI single-frame fill') },
            { value: 'hq', label: t('LaMa 高清补全（慢）', 'LaMa HD fill (slow)') },
          ],
        }),
      ],
      samples: [
        vid('street', t('街景片段', 'Street clip'), 'street.mp4', t('先在画面上框选要去除的区域', 'Drag a rectangle over the area to remove first')),
      ],
    },
  },
};

export const getDemo = (category: string, subcategory: string): DemoSpec | undefined =>
  DEMOS[category]?.[subcategory];
