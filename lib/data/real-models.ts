/**
 * Real, browser-loadable checkpoints.
 *
 * The demo catalogue (`lib/data/models.json`) lists models that are interesting
 * for each subcategory, but not every one of them ships browser-ready weights.
 * This table maps a catalogue entry to an actual ONNX repository that
 * Transformers.js can download, so switching model really swaps the weights.
 *
 * Key format: `${category}/${subcategory}/${modelId}`.
 * Entries absent from this table keep running on the deterministic simulator.
 */
import type { L } from '../types';

export interface RealModelSpec {
  /** Hugging Face repo that ships `onnx/model*.onnx`. */
  repo: string;
  /**
   * Transformers.js task name. Every value here must exist in
   * `node_modules/@huggingface/transformers/src/pipelines/` — that directory is
   * the authoritative list of what the library actually implements.
   */
  task:
    | 'text-classification'
    | 'zero-shot-classification'
    | 'zero-shot-image-classification'
    | 'feature-extraction'
    | 'object-detection'
    | 'translation'
    | 'text2text-generation'
    | 'summarization'
    | 'text-generation'
    | 'automatic-speech-recognition'
    | 'text-to-audio'
    | 'image-to-text'
    | 'image-to-image'
    | 'image-segmentation'
    | 'background-removal'
    | 'depth-estimation'
    | 'image-feature-extraction'
    | 'document-question-answering';
  /** Quantisation used for the download. */
  dtype: string;
  /** One sentence explaining what actually runs. */
  note: L;
  /** True when `repo` is the closest browser-ready stand-in, not the exact upstream checkpoint. */
  substitute?: boolean;
}

export const REAL_MODELS: Record<string, RealModelSpec> = {
  /* ------------------------------------------------ text / classification */
  'text/classification/distilbert-sst2': {
    repo: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    task: 'text-classification',
    dtype: 'int8',
    note: {
      zh: '真实权重：DistilBERT SST-2 二分类，结果完全由模型给出。',
      en: 'Real weights: DistilBERT fine-tuned on SST-2. Every score comes from the model.',
    },
  },
  'text/classification/xlm-roberta-base': {
    repo: 'Xenova/bert-base-multilingual-uncased-sentiment',
    task: 'text-classification',
    dtype: 'int8',
    substitute: true,
    note: {
      zh: '浏览器端没有 XLM-RoBERTa 的 ONNX 权重，这里加载多语言 BERT 情感模型作为替身。',
      en: 'XLM-RoBERTa has no browser-ready weights; a multilingual BERT sentiment model stands in.',
    },
  },
  'text/classification/toxic-bert': {
    repo: 'Xenova/toxic-bert',
    task: 'text-classification',
    dtype: 'int8',
    note: {
      zh: '真实权重：多标签毒性判别，返回各标签独立概率。',
      en: 'Real weights: multi-label toxicity head, returning an independent probability per label.',
    },
  },
  'text/classification/mobilenet-bert': {
    repo: 'Xenova/mobilebert-uncased-mnli',
    task: 'zero-shot-classification',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: '真实权重：MNLI 微调的 MobileBERT 用「蕴含 / 矛盾」概率做零样本判别（25.7 MB）。该检查点是纯英文模型，中文输入会被判成 50/50 —— 切到右上角 English（样本自带英文对照）再运行才有区分度。',
      en: 'Real weights: MNLI-tuned MobileBERT scores entailment vs contradiction for zero-shot labels (25.7 MB). The checkpoint is English-only, so Chinese input collapses to 50/50 — switch the UI to English (samples ship an English twin) for a meaningful split.',
    },
  },

  /* --------------------------------------------------- text / translation */
  'text/translation/opus-mt-en-zh': {
    repo: 'Xenova/opus-mt-en-zh',
    task: 'translation',
    dtype: 'q8',
    note: {
      zh: '真实权重：Marian OPUS-MT 英中翻译（编码器 50 MB + 解码器 57 MB）。中文输入会自动改用同族的中英方向模型。',
      en: 'Real weights: Marian OPUS-MT English→Chinese (50 MB encoder + 57 MB decoder). Chinese input switches to the sibling zh→en checkpoint.',
    },
  },

  /* ------------------------------------------------- search-rag / embedding */
  'search-rag/embedding/all-minilm-l6-v2': {
    repo: 'Xenova/all-MiniLM-L6-v2',
    task: 'feature-extraction',
    dtype: 'int8',
    note: {
      zh: '真实权重：384 维句向量，归一化后计算余弦相似度。',
      en: 'Real weights: 384-dim sentence vectors, L2-normalised before cosine scoring.',
    },
  },
  'search-rag/embedding/bge-small-en': {
    repo: 'Xenova/bge-small-en-v1.5',
    task: 'feature-extraction',
    dtype: 'int8',
    note: {
      zh: '真实权重：BGE small EN v1.5，检索侧 query 会带推荐前缀。',
      en: 'Real weights: BGE small EN v1.5, queries get the recommended instruction prefix.',
    },
  },
  'search-rag/embedding/gte-small': {
    repo: 'Xenova/gte-small',
    task: 'feature-extraction',
    dtype: 'int8',
    note: {
      zh: '真实权重：GTE small，384 维句向量。',
      en: 'Real weights: GTE small, 384-dim sentence embeddings.',
    },
  },
  'search-rag/embedding/bge-m3': {
    repo: 'Xenova/bge-small-zh-v1.5',
    task: 'feature-extraction',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'BGE-M3 的 ONNX 权重超过 500 MB，这里换成同族的 BGE-small-zh 做真实中文句向量。',
      en: 'BGE-M3 ONNX exceeds 500 MB, so the same family’s BGE-small-zh provides real Chinese embeddings instead.',
    },
  },

  /* ---------------------------------------------------- search-rag / reranker */
  'search-rag/reranker/ms-marco-minilm': {
    repo: 'Xenova/ms-marco-MiniLM-L-6-v2',
    task: 'text-classification',
    dtype: 'q8',
    note: {
      zh: '真实权重：cross-encoder 把查询与每条候选一起编码，输出相关性分数并据此重排。',
      en: 'Real weights: a cross-encoder encodes query and candidate together and rescoring reorders the list.',
    },
  },
  'search-rag/reranker/cohere-rerank-wasm': {
    repo: 'Xenova/ms-marco-TinyBERT-L-2-v2',
    task: 'text-classification',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'Cohere Rerank 是闭源 API，这里用 4 MB 的 TinyBERT cross-encoder 做真实重排，效果弱但完全本地。',
      en: 'Cohere Rerank is a closed API; the 4 MB TinyBERT cross-encoder does the real rescoring locally instead.',
    },
  },

  /* ---------------------------------------------- search-rag / semantic search */
  'search-rag/semantic-search/hnswlib-wasm': {
    repo: 'Xenova/all-MiniLM-L6-v2',
    task: 'feature-extraction',
    dtype: 'int8',
    substitute: true,
    note: {
      zh: 'hnswlib 本身是索引库而非模型，这里真实加载 MiniLM 编码查询与语料并按余弦相似度检索。',
      en: 'hnswlib is an index library rather than a model, so MiniLM really encodes the query and corpus and ranks by cosine similarity.',
    },
  },
  'search-rag/semantic-search/voyager-wasm': {
    repo: 'Xenova/bge-small-en-v1.5',
    task: 'feature-extraction',
    dtype: 'int8',
    substitute: true,
    note: {
      zh: '真实权重：BGE-small 编码查询与语料，余弦相似度排序返回最相关片段。',
      en: 'Real weights: BGE-small encodes query and corpus, then cosine similarity ranks the most relevant passages.',
    },
  },
  'search-rag/semantic-search/lancedb-js': {
    repo: 'Xenova/gte-small',
    task: 'feature-extraction',
    dtype: 'int8',
    substitute: true,
    note: {
      zh: '真实权重：GTE-small 做检索编码，命中排序完全来自向量相似度。',
      en: 'Real weights: GTE-small performs the retrieval encoding; ranking comes purely from vector similarity.',
    },
  },
  'search-rag/semantic-search/vectra-wasm': {
    repo: 'Xenova/all-MiniLM-L6-v2',
    task: 'feature-extraction',
    dtype: 'int8',
    substitute: true,
    note: {
      zh: '真实权重：MiniLM 双编码器检索，查询与文档分别编码后比相似度。',
      en: 'Real weights: MiniLM bi-encoder retrieval — query and documents are encoded separately and compared.',
    },
  },

  /* ------------------------------------------------------- vision / detection */
  'vision/detection/yolov8n': {
    repo: 'Xenova/yolos-tiny',
    task: 'object-detection',
    dtype: 'q4',
    substitute: true,
    note: {
      zh: '浏览器端没有可直接推理的 YOLOv8n ONNX，这里加载同为 COCO 80 类的 YOLOS-tiny 作为替身。',
      en: 'YOLOv8n has no runnable browser ONNX build here, so COCO-80-class YOLOS-tiny stands in.',
    },
  },
  'vision/detection/yolov5s': {
    repo: 'Xenova/yolos-small',
    task: 'object-detection',
    dtype: 'q4',
    substitute: true,
    note: {
      zh: '同样是替身：YOLOS-small 与 YOLOv5s 同在 COCO 上训练，输出格式一致。',
      en: 'Another stand-in: YOLOS-small is trained on the same COCO-80 taxonomy.',
    },
  },
  'vision/detection/ssd-mobilenet': {
    repo: 'Xenova/detr-resnet-50',
    task: 'object-detection',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: '真实权重：SSD-MobileNet 没有浏览器 ONNX，改用 DETR-ResNet-50 做真实检测，同样是 COCO 80 类。',
      en: 'SSD-MobileNet ships no browser ONNX, so DETR-ResNet-50 does the real detection on the same COCO-80 classes.',
    },
  },
  'vision/detection/mediapipe-objectdetection': {
    repo: 'Xenova/detr-resnet-50',
    task: 'object-detection',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'MediaPipe 的 EfficientDet 走 TFJS 运行时，这里用 DETR-ResNet-50 的 ONNX 权重真实推理。',
      en: 'MediaPipe EfficientDet runs on TFJS; here DETR-ResNet-50 ONNX weights do the real inference instead.',
    },
  },

  /* ---------------------------------------------------- vision / segmentation */
  'vision/segmentation/imgly-bg-removal': {
    repo: 'briaai/RMBG-1.4',
    task: 'background-removal',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: '真实权重：BRIA RMBG-1.4 逐像素预测 alpha，背景由模型真正抠掉。',
      en: 'Real weights: BRIA RMBG-1.4 predicts a per-pixel alpha — the background is genuinely removed by the model.',
    },
  },
  'vision/segmentation/imgly-bg-removal-balanced': {
    repo: 'Xenova/modnet',
    task: 'background-removal',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: '真实权重：MODNet 人像抠图（约 6 MB），alpha 掩码逐像素由模型给出。',
      en: 'Real weights: MODNet portrait matting (~6 MB) produces the alpha mask per pixel.',
    },
  },
  'vision/segmentation/imgly-bg-removal-hd': {
    repo: 'briaai/RMBG-1.4',
    task: 'background-removal',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: '真实权重：RMBG-1.4 高清档，边缘细节由模型重建。',
      en: 'Real weights: RMBG-1.4 in its high-detail configuration; edges are reconstructed by the model.',
    },
  },
  'vision/segmentation/sam-tiny': {
    repo: 'Xenova/segformer-b0-finetuned-ade-512-512',
    task: 'image-segmentation',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'SAM 需要点/框提示，浏览器端不可用；改用 SegFormer-B0 做真实语义分割，输出 150 类区域掩码。',
      en: 'SAM needs prompt points and is not runnable here; SegFormer-B0 provides real semantic segmentation with 150 region classes.',
    },
  },
  'vision/segmentation/mediapipe-selfie': {
    repo: 'Xenova/modnet',
    task: 'background-removal',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'MediaPipe Selfie 走 TFJS，这里用 MODNet 的 ONNX 权重做真实前景分割。',
      en: 'MediaPipe Selfie runs on TFJS; MODNet ONNX weights do the real foreground segmentation here.',
    },
  },

  /* ------------------------------------------------------------ audio / asr */
  'audio/asr/whisper-tiny-wasm': {
    repo: 'Xenova/whisper-tiny',
    task: 'automatic-speech-recognition',
    dtype: 'q8',
    note: {
      zh: '真实权重：Whisper-tiny 在浏览器里对音频做语音识别，文本完全由模型转写。',
      en: 'Real weights: Whisper-tiny transcribes the audio in-browser; every word comes from the model.',
    },
  },
  'audio/asr/whisper-base': {
    repo: 'Xenova/whisper-base',
    task: 'automatic-speech-recognition',
    dtype: 'q8',
    note: {
      zh: '真实权重：Whisper-base（编码器 22 MB + 解码器 51 MB），带时间戳的逐段转写；浏览器端解码很慢，一段 10 秒音频可能需要数分钟。',
      en: 'Real weights: Whisper-base (22 MB encoder + 51 MB decoder) with per-chunk timestamps — decoding is slow, so a 10-second clip can take minutes.',
    },
  },
  'audio/asr/whisper-small': {
    repo: 'Xenova/whisper-small',
    task: 'automatic-speech-recognition',
    dtype: 'q4f16',
    note: {
      zh: '真实权重：Whisper-small，首次下载约 190 MB，准确度高于 tiny，但浏览器端转写明显更慢。',
      en: 'Real weights: Whisper-small — about 190 MB on first load, more accurate than tiny but noticeably slower in the browser.',
    },
  },

  /* ------------------------------------------------------------ audio / tts */
  'audio/tts/silero-tts': {
    repo: 'Xenova/mms-tts-eng',
    task: 'text-to-audio',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'Silero 没有 ONNX 浏览器版，这里用 Meta MMS 英语 TTS 作为替身，波形由模型真实合成。',
      en: 'Silero ships no ONNX browser build, so Meta MMS English TTS stands in — the waveform is synthesised for real.',
    },
  },
  'audio/tts/kokoro-82m-fp32': {
    repo: 'Xenova/speecht5_tts',
    task: 'text-to-audio',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: '当前运行时认不出 Kokoro 的 style_text_to_speech_2 架构，改用 SpeechT5（编码器 + 解码器 + 声码器，约 170 MB）做真实语音合成。',
      en: 'This runtime cannot load Kokoro’s style_text_to_speech_2 architecture, so SpeechT5 (encoder + decoder + vocoder, ~170 MB) does the real synthesis.',
    },
  },

  /* ------------------------------------------------------------- vision/ocr */
  'vision/ocr/paddle-ocr': {
    repo: 'Xenova/trocr-small-printed',
    task: 'image-to-text',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'PaddleOCR 没有浏览器 ONNX 权重，改用 TrOCR-small（印刷体）做真实识别；它对整图读一行文字，不像 OCR 分框。',
      en: 'PaddleOCR has no browser weights, so TrOCR-small (printed) does the real recognition — it reads whole images rather than per-box text.',
    },
  },
  'vision/ocr/easy-ocr': {
    repo: 'Xenova/trocr-small-handwritten',
    task: 'image-to-text',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'EasyOCR 的识别网络没有浏览器权重，改用 TrOCR-small（手写体）真实读取文字。',
      en: 'EasyOCR’s recogniser ships no browser weights; TrOCR-small (handwritten) reads the text for real instead.',
    },
  },
  'vision/ocr/mediapipe-text': {
    repo: 'Xenova/trocr-small-printed',
    task: 'image-to-text',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'MediaPipe Text 走 TFJS，这里用 TrOCR-small（印刷体）的 ONNX 权重做真实识别。',
      en: 'MediaPipe Text runs on TFJS, so TrOCR-small (printed) ONNX weights do the real recognition here.',
    },
  },

  /* ----------------------------------------- vision / image restoration */
  'vision/image-restoration/swinir': {
    repo: 'Xenova/swin2sr-classical-sr-x2-64',
    task: 'image-to-image',
    dtype: 'q4',
    substitute: true,
    note: {
      zh: '真实权重：Swin2SR 做 2 倍超分。SwimIR 无浏览器版，故以此为替身，输出像素由模型重建。',
      en: 'Real weights: Swin2SR performs 2x super-resolution, standing in for SwinIR. Output pixels are reconstructed by the model.',
    },
  },
  'vision/image-restoration/real-esrgan': {
    repo: 'Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr',
    task: 'image-to-image',
    dtype: 'q4',
    substitute: true,
    note: {
      zh: '真实权重：Swin2SR 真实世界 4 倍超分（在退化图像上训练），替身 Real-ESRGAN，输出像素由模型重建。',
      en: 'Real weights: Swin2SR real-world 4x super-resolution trained on degradations, standing in for Real-ESRGAN.',
    },
  },

  /* --------------------------------------------------- text / summarization */
  'text/summarization/pegasus-xsum': {
    repo: 'Xenova/t5-small',
    task: 'summarization',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'Pegasus / DistilBART 的浏览器权重超过 340 MB，改用 T5-small 做真实摘要（偏抽取式，不像 XSum 那样一句话概括）。',
      en: 'Pegasus / DistilBART browser weights exceed 340 MB, so T5-small summarises for real (more extractive than XSum-style one-liners).',
    },
  },

  /* ------------------------------------------------------------ vision/depth */
  'vision/depth/midas-small': {
    repo: 'Xenova/dpt-hybrid-midas',
    task: 'depth-estimation',
    dtype: 'q4',
    note: {
      zh: '真实权重：DPT-Hybrid-MiDaS 单目深度估计，深度图逐像素由模型预测。',
      en: 'Real weights: DPT-Hybrid-MiDaS monocular depth estimation — every depth pixel is predicted by the model.',
    },
  },
  'vision/depth/depth-anything-small': {
    repo: 'Xenova/depth-anything-small-hf',
    task: 'depth-estimation',
    dtype: 'q8',
    note: {
      zh: '真实权重：Depth Anything V2 Small 做单目深度估计，深度值逐像素由模型回归。',
      en: 'Real weights: Depth Anything V2 Small regresses the depth map pixel by pixel.',
    },
  },
  'vision/depth/mediapipe-depth': {
    repo: 'Xenova/depth-anything-small-hf',
    task: 'depth-estimation',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'MediaPipe Depth 走 TFJS，这里用 Depth Anything V2 Small 的 ONNX 权重做真实深度回归。',
      en: 'MediaPipe Depth runs on TFJS; Depth Anything V2 Small ONNX weights do the real depth regression here.',
    },
  },

  /* --------------------------------------------------------- multimodal/vlm */
  'multimodal/vlm/moondream2': {
    repo: 'Xenova/vit-gpt2-image-captioning',
    task: 'image-to-text',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'Moondream2 跑不动浏览器端，改用 ViT-GPT2 做真实图像描述；支持多轮的视觉问答暂不支持。',
      en: 'Moondream2 is too heavy for the browser, so ViT-GPT2 captions the image for real; multi-turn VQA is not supported.',
    },
  },

  /* --------------------------------------------------------- multimodal/clip */
  'multimodal/clip/clip-vit-base': {
    repo: 'onnx-community/clip-vit-base-patch32-ONNX',
    task: 'zero-shot-image-classification',
    dtype: 'q8',
    note: {
      zh: '真实权重：CLIP ViT-B/32（合并单文件 146 MB）把图片与候选标签编码到同一空间做零样本打分。CLIP 是英文模型，中文候选标签的判别力较弱，切到英文界面效果更好。',
      en: 'Real weights: CLIP ViT-B/32 (single merged 146 MB file) embeds image and labels in one space for zero-shot scoring. CLIP is English-only, so English candidate labels discriminate far better.',
    },
  },
  'multimodal/clip/siglip-base': {
    repo: 'Xenova/siglip-base-patch16-224',
    task: 'zero-shot-image-classification',
    dtype: 'q8',
    note: {
      zh: '真实权重：SigLIP-Base 图文对齐打分（约 200 MB），训练目标是 sigmoid 对比损失。',
      en: 'Real weights: SigLIP-Base scores image-text alignment (~200 MB) using its sigmoid contrastive objective.',
    },
  },
  'multimodal/clip/mobileclip': {
    repo: 'onnx-community/clip-vit-base-patch32-ONNX',
    task: 'zero-shot-image-classification',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'MobileCLIP 的权重布局与浏览器端零样本管线不兼容，改用合并版 CLIP ViT-B/32（同为对比学习图文对齐）。',
      en: 'MobileCLIP’s weight layout is incompatible with the browser zero-shot pipeline, so merged CLIP ViT-B/32 (the same contrastive paradigm) stands in.',
    },
  },

  /* ------------------------------------------- multimodal / document reading */
  'multimodal/document-understanding/donut-base': {
    repo: 'Xenova/donut-base-finetuned-cord-v2',
    task: 'document-question-answering',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: '真实权重：Donut 端到端读文档（约 209 MB），按提问直接生成字段值，无需 OCR 分步。',
      en: 'Real weights: Donut reads the document end to end (~209 MB) and generates field values directly, with no separate OCR step.',
    },
  },
  'multimodal/document-understanding/nougat-small': {
    repo: 'Xenova/nougat-small',
    task: 'image-to-text',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: '真实权重：Nougat-small（约 244 MB）把整页文档转成带结构的文本，公式与表格按标记保留。',
      en: 'Real weights: Nougat-small (~244 MB) converts a full page into structured text, keeping formulas and tables as markup.',
    },
  },

  /* ------------------------------------------------------------ llm / chat */
  'llm/chat/qwen2-1.5b': {
    repo: 'Xenova/Qwen1.5-0.5B-Chat',
    task: 'text-generation',
    dtype: 'q4f16',
    substitute: true,
    note: {
      zh: '真实权重：Qwen1.5-0.5B-Chat 是浏览器里可跑的最小中文指令模型（首次下载约 470 MB），逐 token 生成，速度取决于机器。',
      en: 'Real weights: Qwen1.5-0.5B-Chat is the smallest Chinese instruction model that runs here (~470 MB first load); tokens are generated one at a time.',
    },
  },
  'llm/chat/phi-3-mini': {
    repo: 'Xenova/Qwen1.5-0.5B-Chat',
    task: 'text-generation',
    dtype: 'q4f16',
    substitute: true,
    note: {
      zh: 'Phi-3-mini 的 ONNX 过大，这里用 Qwen1.5-0.5B-Chat 做真实多轮生成。',
      en: 'Phi-3-mini’s ONNX build is too large, so Qwen1.5-0.5B-Chat generates the replies for real.',
    },
  },

  /* -------------------------------------------------- llm / structured-output */
  'llm/structured-output/jsonformer-llama': {
    repo: 'onnx-community/Qwen2.5-0.5B-Instruct',
    task: 'text-generation',
    dtype: 'q4f16',
    substitute: true,
    note: {
      zh: '真实权重：Qwen2.5-0.5B-Instruct（约 460 MB）按 Schema 提示真实生成 JSON 文本，合法性由前端再校验。',
      en: 'Real weights: Qwen2.5-0.5B-Instruct (~460 MB) really generates JSON from the schema prompt; the front end still validates it.',
    },
  },

  /* ------------------------------------------------------------ llm / code */
  'llm/code/deepseek-coder-1.3b': {
    repo: 'onnx-community/Qwen2.5-Coder-0.5B-Instruct',
    task: 'text-generation',
    dtype: 'q4f16',
    substitute: true,
    note: {
      zh: '真实权重：Qwen2.5-Coder-0.5B-Instruct（约 530 MB）真实生成代码片段，逐 token 输出。',
      en: 'Real weights: Qwen2.5-Coder-0.5B-Instruct (~530 MB) generates code token by token.',
    },
  },

  /* NOTE: the remaining catalogue entries have no browser-runnable checkpoint:
     SDXL/FLUX inpainting and text-to-image (multi-GB), speech denoising /
     source separation / music / voice cloning (no Transformers.js pipeline at
     all), MediaPipe real-time landmarks (TFJS runtime), video understanding,
     and the 1B+ LLMs (Llama-3, CodeLlama, Mistral). */
};

export const realSpecFor = (category: string, subcategory: string, modelId: string): RealModelSpec | undefined =>
  REAL_MODELS[`${category}/${subcategory}/${modelId}`];

/** Subcategories where at least one model can really be loaded. */
export const REAL_SUBCATEGORIES = new Set(
  Object.keys(REAL_MODELS).map((k) => {
    const [c, s] = k.split('/');
    return `${c}/${s}`;
  })
);
