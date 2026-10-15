import type { TaxonomyEntry } from '../types';

export const TAXONOMY: TaxonomyEntry[] = [
  {
    slug: 'text',
    name: { zh: '文本处理', en: 'Text' },
    blurb: { zh: '经典 NLP 任务的浏览器端实现', en: 'Classic NLP tasks running in the browser' },
    subcategories: [
      {
        slug: 'classification',
        name: { zh: '文本分类', en: 'Text Classification' },
        blurb: { zh: '情感分析、意图识别、毒性检测', en: 'Sentiment, intent and toxicity detection' },
      },
      {
        slug: 'translation',
        name: { zh: '机器翻译', en: 'Machine Translation' },
        blurb: { zh: '多语种互译，支持语言对切换', en: 'Multilingual translation with language pairs' },
      },
      {
        slug: 'summarization',
        name: { zh: '文本摘要', en: 'Summarization' },
        blurb: { zh: '长文压缩为要点与摘要', en: 'Compress long documents into key points' },
      },
      {
        slug: 'token-classification',
        name: { zh: '命名实体识别', en: 'Named Entity Recognition' },
        blurb: { zh: '抽取人名、地名、机构名', en: 'Extract people, places and organisations' },
      },
      {
        slug: 'question-answering',
        name: { zh: '抽取式问答', en: 'Question Answering' },
        blurb: { zh: '从给定文本中定位答案', en: 'Locate the answer span inside a passage' },
      },
    ],
  },
  {
    slug: 'llm',
    name: { zh: '大语言模型', en: 'LLM' },
    blurb: { zh: '本地运行的小型指令模型', en: 'Small instruction models running locally' },
    subcategories: [
      {
        slug: 'chat',
        name: { zh: '对话生成', en: 'Chat' },
        blurb: { zh: '多轮对话与流式输出', en: 'Multi-turn chat with streaming output' },
      },
      {
        slug: 'structured-output',
        name: { zh: '结构化输出', en: 'Structured Output' },
        blurb: { zh: '按 Schema 输出 JSON', en: 'Constrain generation to a JSON schema' },
      },
      {
        slug: 'code',
        name: { zh: '代码生成', en: 'Code Generation' },
        blurb: { zh: '代码补全、解释与改写', en: 'Code completion, explanation and refactor' },
      },
    ],
  },
  {
    slug: 'search-rag',
    name: { zh: '检索与 RAG', en: 'Search & RAG' },
    blurb: { zh: '向量化、重排序与语义检索', en: 'Embedding, reranking and semantic retrieval' },
    subcategories: [
      {
        slug: 'embedding',
        name: { zh: '文本嵌入', en: 'Embedding' },
        blurb: { zh: '句向量与相似度矩阵', en: 'Sentence vectors and similarity matrices' },
      },
      {
        slug: 'reranker',
        name: { zh: '重排序', en: 'Reranker' },
        blurb: { zh: '对召回结果精排打分', en: 'Cross-encoder rescoring of candidates' },
      },
      {
        slug: 'semantic-search',
        name: { zh: '语义搜索', en: 'Semantic Search' },
        blurb: { zh: '自然语言查询语料库', en: 'Query a corpus in natural language' },
      },
    ],
  },
  {
    slug: 'vision',
    name: { zh: '视觉理解', en: 'Vision' },
    blurb: { zh: '检测、分割、识别与图像恢复', en: 'Detection, segmentation, OCR and restoration' },
    subcategories: [
      {
        slug: 'detection',
        name: { zh: '目标检测', en: 'Object Detection' },
        blurb: { zh: '定位并分类图中的目标', en: 'Locate and classify objects' },
      },
      {
        slug: 'segmentation',
        name: { zh: '图像分割', en: 'Segmentation' },
        blurb: { zh: '前景抠图与区域掩码', en: 'Foreground matting and region masks' },
      },
      {
        slug: 'ocr',
        name: { zh: '文字识别', en: 'OCR' },
        blurb: { zh: '图片文字提取与版面分析', en: 'Text extraction and layout analysis' },
      },
      {
        slug: 'depth',
        name: { zh: '深度估计', en: 'Depth Estimation' },
        blurb: { zh: '单目深度图预测', en: 'Monocular depth prediction' },
      },
      {
        slug: 'image-restoration',
        name: { zh: '图像增强修复', en: 'Image Restoration' },
        blurb: { zh: '超分、去噪与去模糊', en: 'Super-resolution, denoise and deblur' },
      },
      {
        slug: 'image-classification',
        name: { zh: '图像分类', en: 'Image Classification' },
        blurb: { zh: '为整张图片预测类别', en: 'Predict the class of a whole image' },
      },
      {
        slug: 'zero-shot-detection',
        name: { zh: '开放词表检测', en: 'Zero-shot Detection' },
        blurb: { zh: '用文字描述任意目标并框选', en: 'Box any object you can describe in words' },
      },
    ],
  },
  {
    slug: 'generative-vision',
    name: { zh: '生成式视觉', en: 'Generative Vision' },
    blurb: { zh: '扩散模型驱动的图像生成与编辑', en: 'Diffusion-based image synthesis and editing' },
    subcategories: [
      {
        slug: 'text-to-image',
        name: { zh: '文生图', en: 'Text-to-Image' },
        blurb: { zh: '提示词到图像', en: 'Prompt to image' },
      },
      {
        slug: 'inpainting',
        name: { zh: '图像修补', en: 'Inpainting' },
        blurb: { zh: '涂抹区域重绘与去水印', en: 'Repaint masked regions, remove watermarks' },
      },
    ],
  },
  {
    slug: 'audio',
    name: { zh: '音频处理', en: 'Audio' },
    blurb: { zh: '识别、合成、降噪与分离', en: 'Recognition, synthesis, denoise and separation' },
    subcategories: [
      {
        slug: 'asr',
        name: { zh: '语音识别', en: 'Speech Recognition' },
        blurb: { zh: '带时间戳的转写', en: 'Transcription with timestamps' },
      },
      {
        slug: 'tts',
        name: { zh: '语音合成', en: 'Text-to-Speech' },
        blurb: { zh: '文本转自然语音', en: 'Turn text into natural speech' },
      },
      {
        slug: 'denoising',
        name: { zh: '音频降噪', en: 'Audio Denoising' },
        blurb: { zh: '去除背景噪声', en: 'Remove background noise' },
      },
      {
        slug: 'source-separation',
        name: { zh: '音源分离', en: 'Source Separation' },
        blurb: { zh: '拆分为人声与伴奏', en: 'Split into vocals and instrumental' },
      },
      {
        slug: 'audio-classification',
        name: { zh: '音频分类', en: 'Audio Classification' },
        blurb: { zh: '识别声音事件与语音指令', en: 'Recognise sound events and spoken commands' },
      },
    ],
  },
  {
    slug: 'generative-audio',
    name: { zh: '生成式音频', en: 'Generative Audio' },
    blurb: { zh: '音乐生成与声音克隆', en: 'Music generation and voice cloning' },
    subcategories: [
      {
        slug: 'text-to-music',
        name: { zh: '文生音乐', en: 'Text-to-Music' },
        blurb: { zh: '用文字描述生成配乐', en: 'Generate music from a description' },
      },
      {
        slug: 'voice-cloning',
        name: { zh: '声音克隆', en: 'Voice Cloning' },
        blurb: { zh: '用参考音色合成新内容', en: 'Synthesise new speech in a reference voice' },
      },
    ],
  },
  {
    slug: 'multimodal',
    name: { zh: '多模态', en: 'Multimodal' },
    blurb: { zh: '图文联合理解', en: 'Joint image-text understanding' },
    subcategories: [
      {
        slug: 'vlm',
        name: { zh: '视觉语言模型', en: 'Vision-Language Model' },
        blurb: { zh: '看图问答与描述', en: 'Visual question answering and captioning' },
      },
      {
        slug: 'clip',
        name: { zh: '图文匹配', en: 'Image-Text Matching' },
        blurb: { zh: '零样本分类与相似度', en: 'Zero-shot classification and similarity' },
      },
      {
        slug: 'document-understanding',
        name: { zh: '文档理解', en: 'Document Understanding' },
        blurb: { zh: '版面解析为结构化字段', en: 'Parse layouts into structured fields' },
      },
    ],
  },
  {
    slug: 'real-time',
    name: { zh: '实时感知', en: 'Real-time' },
    blurb: { zh: '摄像头实时关键点与追踪', en: 'Live landmarks and tracking from the camera' },
    subcategories: [
      {
        slug: 'face',
        name: { zh: '人脸关键点', en: 'Face Landmarks' },
        blurb: { zh: '面部网格与表情点', en: 'Face mesh and expression points' },
      },
      {
        slug: 'pose',
        name: { zh: '人体姿态', en: 'Pose Estimation' },
        blurb: { zh: '骨骼关节点估计', en: 'Skeleton keypoint estimation' },
      },
      {
        slug: 'hand',
        name: { zh: '手势关键点', en: 'Hand Landmarks' },
        blurb: { zh: '手部 21 点检测', en: '21-point hand detection' },
      },
      {
        slug: 'tracking',
        name: { zh: '目标追踪', en: 'Object Tracking' },
        blurb: { zh: '跨帧目标 ID 关联', en: 'Assign persistent IDs across frames' },
      },
    ],
  },
  {
    slug: 'video',
    name: { zh: '视频理解', en: 'Video' },
    blurb: { zh: '时序行为与场景识别', en: 'Temporal action and scene recognition' },
    subcategories: [
      {
        slug: 'video-understanding',
        name: { zh: '视频理解', en: 'Video Understanding' },
        blurb: { zh: '分段标注与内容摘要', en: 'Segment labelling and content summary' },
      },
    ],
  },
];

export const getCategory = (slug: string) => TAXONOMY.find((c) => c.slug === slug);

export const getSubMeta = (cat: string, sub: string) =>
  getCategory(cat)?.subcategories.find((s) => s.slug === sub);

export const allDemoPaths = () =>
  TAXONOMY.flatMap((c) => c.subcategories.map((s) => ({ category: c.slug, subcategory: s.slug })));
