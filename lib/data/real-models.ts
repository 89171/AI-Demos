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
import { MP_URL, type MpKind } from '../engine/mediapipe';

export interface RealModelSpec {
  /** Hugging Face repo that ships `onnx/model*.onnx`. */
  repo: string;
  /**
   * Transformers.js task name. Every value here must exist in
   * `node_modules/@huggingface/transformers/src/pipelines/` — that directory is
   * the authoritative list of what the library actually implements. `mediapipe`
   * is the exception: it runs via @mediapipe/tasks-vision, see `mp`.
   */
  task:
    | 'mediapipe'
    | 'tesseract'
    | 'token-classification'
    | 'question-answering'
    | 'image-classification'
    | 'audio-classification'
    | 'zero-shot-object-detection'
    | 'rnnoise'
    | 'onnxruntime'
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
  /** Custom ONNX graph to run when `task` is 'onnxruntime' (`repo` is then the model URL). */
  ort?: 'migan' | 'demucs';
  /** Demucs variant (4 or 6 stems). */
  stems?: '4' | '6';
  /** MediaPipe task to run when `task` is 'mediapipe' (`repo` is then the model URL). */
  mp?: MpKind;
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

  /* ----------------------------------------------- vision / bg removal */
  'vision/background-removal/imgly-bg-removal': {
    repo: 'briaai/RMBG-1.4',
    task: 'background-removal',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: '真实权重：BRIA RMBG-1.4 逐像素预测 alpha，背景由模型真正抠掉。IMG.LY 的 IS-Net 权重不在 Hugging Face 上，这里以 RMBG-1.4 替代。',
      en: 'Real weights: BRIA RMBG-1.4 predicts a per-pixel alpha — the background is genuinely removed by the model. IMG.LY’s IS-Net weights are not on Hugging Face, so RMBG-1.4 stands in.',
    },
  },
  'vision/background-removal/birefnet-lite-512': {
    repo: 'briaai/RMBG-1.4',
    task: 'background-removal',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'BiRefNet-lite 的 fp16 权重约 94 MB 且要求 WebGPU，这里换用 RMBG-1.4（q8）做真实抠图，效果同为整图 alpha 预测。',
      en: 'BiRefNet-lite’s fp16 weights are ~94 MB and need WebGPU; RMBG-1.4 (q8) performs the real matting instead — both predict a whole-image alpha.',
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
      zh: '（仅英文文本）Silero 没有 ONNX 浏览器版，这里用 Meta MMS 英语 TTS 作为替身，波形由模型真实合成。',
      en: '(English text only) Silero ships no ONNX browser build, so Meta MMS English TTS stands in — the waveform is synthesised for real.',
    },
  },
  'audio/tts/kokoro-82m-fp32': {
    repo: 'onnx-community/Supertonic-TTS-ONNX',
    task: 'text-to-audio',
    dtype: 'fp32',
    substitute: true,
    note: {
      zh: '（仅英文文本）当前运行时认不出 Kokoro 的 style_text_to_speech_2 架构，改用 Supertonic TTS（文本编码器 + 潜变量去噪器 + 声码器，约 260 MB，44.1 kHz）做真实语音合成。',
      en: '(English text only) This runtime cannot load Kokoro’s style_text_to_speech_2 architecture, so Supertonic TTS (text encoder + latent denoiser + vocoder, ~260 MB, 44.1 kHz) does the real synthesis.',
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

  /* ------------------------------------- vision / super resolution + enhancement */
  'vision/super-resolution/swinir': {
    repo: 'Xenova/swin2sr-classical-sr-x2-64',
    task: 'image-to-image',
    dtype: 'q4',
    substitute: true,
    note: {
      zh: '真实权重：Swin2SR 做 2 倍超分。SwimIR 无浏览器版，故以此为替身，输出像素由模型重建。',
      en: 'Real weights: Swin2SR performs 2x super-resolution, standing in for SwinIR. Output pixels are reconstructed by the model.',
    },
  },
  'vision/super-resolution/esrgan-slim': {
    repo: 'Xenova/swin2sr-classical-sr-x2-64',
    task: 'image-to-image',
    dtype: 'q4',
    substitute: true,
    note: {
      zh: 'UpscalerJS 的 ESRGAN-slim 是 TFJS 格式，Transformers.js 无法加载，这里用 Swin2SR 2× 做真实超分替身。',
      en: 'UpscalerJS’s ESRGAN-slim ships in TFJS format which Transformers.js cannot load, so Swin2SR 2x performs the real super-resolution instead.',
    },
  },
  'vision/image-enhancement/real-esrgan': {
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
  'vision/ocr/tesseractjs': {
    repo: 'tesseract.js',
    task: 'tesseract',
    dtype: 'fast',
    note: {
      zh: '真实权重：Tesseract.js（WASM 引擎 + 对应语言的 fast 训练数据，首次运行从 CDN 下载并缓存），逐行返回坐标与置信度。',
      en: 'Real weights: Tesseract.js (WASM engine + fast traineddata per language, fetched from a CDN on first run and cached) with per-line boxes and confidence.',
    },
  },
  'video/video-understanding/mediapipe-classifier': {
    repo: MP_URL['classify'],
    task: 'mediapipe',
    mp: 'classify',
    dtype: 'float32',
    substitute: true,
    note: {
      zh: 'MediaPipe 没有公开的视频动作分类器，这里对抽样帧逐帧运行 EfficientNet-Lite0（约 18 MB，ImageNet 1000 类），并把相邻同类帧合并成时间段。',
      en: 'MediaPipe ships no public video action classifier, so EfficientNet-Lite0 (~18 MB, ImageNet-1k) classifies each sampled frame and adjacent frames with the same label merge into segments.',
    },
  },
  /* ---------------------------------------------- vision / watermark removal */
  'vision/watermark-removal/mi-gan-watermark': {
    repo: 'https://huggingface.co/anyisalin/migan-onnx/resolve/main/onnx/migan_pipeline.onnx',
    task: 'onnxruntime',
    ort: 'migan',
    dtype: 'uint8',
    note: {
      zh: '真实权重：MI-GAN 修补网络（28 MB ONNX，onnxruntime-web）。只替换你涂抹的水印区域，其余像素保持原样。',
      en: 'Real weights: the MI-GAN inpainting network (28 MB ONNX on onnxruntime-web). Only the watermark area you painted is replaced.',
    },
  },
  'vision/watermark-removal/lama-watermark': {
    repo: 'https://huggingface.co/anyisalin/migan-onnx/resolve/main/onnx/migan_pipeline.onnx',
    task: 'onnxruntime',
    ort: 'migan',
    dtype: 'uint8',
    substitute: true,
    note: {
      zh: 'LaMa 的 ONNX 约 208 MB 且无法在 wasm 端建立会话，这里换用同类的 MI-GAN（28 MB）真实修补。',
      en: 'LaMa’s ~208 MB ONNX does not load on the wasm backend, so MI-GAN (28 MB) performs the real inpainting instead.',
    },
  },
  'vision/object-removal/image-object-eraser': {
    repo: 'https://huggingface.co/anyisalin/migan-onnx/resolve/main/onnx/migan_pipeline.onnx',
    task: 'onnxruntime',
    ort: 'migan',
    dtype: 'uint8',
    note: {
      zh: '真实权重：与去水印共用的 MI-GAN 修补网络（28 MB ONNX），蒙版来自你的涂抹笔触，只重建擦除区域。',
      en: 'Real weights: the same MI-GAN inpainting network the watermark remover uses (28 MB ONNX); the mask comes from your brush strokes and only the erased area is rebuilt.',
    },
  },
  'audio/denoising/rnnoise-wasm': {
    repo: '@jitsi/rnnoise-wasm',
    task: 'rnnoise',
    dtype: 'fp32',
    note: {
      zh: '真实权重：RNNoise（GRU 噪声抑制，权重内嵌在 WASM 中），按 48 kHz / 10 ms 帧逐帧处理。「降噪强度」控制干声回混比例。',
      en: 'Real weights: RNNoise (GRU suppressor, weights embedded in the WASM) processing 10 ms frames at 48 kHz. “Reduction strength” controls how much dry signal is mixed back.',
    },
  },
  'audio/denoising/deepfilternet': {
    repo: '@jitsi/rnnoise-wasm',
    task: 'rnnoise',
    dtype: 'fp32',
    substitute: true,
    note: {
      zh: 'DeepFilterNet 没有可用的浏览器 ONNX 权重，改用 RNNoise 做真实降噪。',
      en: 'DeepFilterNet has no usable browser ONNX weights; RNNoise performs the real denoising instead.',
    },
  },
  'audio/denoising/facebook-denoiser': {
    repo: '@jitsi/rnnoise-wasm',
    task: 'rnnoise',
    dtype: 'fp32',
    substitute: true,
    note: {
      zh: 'Facebook Denoiser 没有可用的浏览器 ONNX 权重，改用 RNNoise 做真实降噪。',
      en: 'Facebook Denoiser has no usable browser ONNX weights; RNNoise performs the real denoising instead.',
    },
  },
  'audio/source-separation/htdemucs-4-stem': {
    repo: 'https://huggingface.co/StemSplitio/htdemucs-onnx/resolve/main/htdemucs_fp16weights.onnx',
    task: 'onnxruntime',
    ort: 'demucs',
    stems: '4',
    dtype: 'fp16',
    note: {
      zh: '真实权重：HT-Demucs 4 轨（166 MB ONNX，Worker 中单线程 wasm 推理，7.8 秒分段重叠相加）。较慢，请耐心等待。',
      en: 'Real weights: HT-Demucs 4-stem (166 MB ONNX, single-thread wasm in a Worker, 7.8 s overlap-add segments). Slow — be patient.',
    },
  },
  'audio/source-separation/htdemucs-6-stem': {
    repo: 'https://huggingface.co/StemSplitio/htdemucs-6s-onnx/resolve/main/htdemucs_6s_fp16weights.onnx',
    task: 'onnxruntime',
    ort: 'demucs',
    stems: '6',
    dtype: 'fp16',
    note: {
      zh: '真实权重：HT-Demucs 6 轨（136 MB ONNX），额外分出吉他与钢琴。选「2 轨」时输出人声 + 伴奏。',
      en: 'Real weights: HT-Demucs 6-stem (136 MB ONNX) adding guitar and piano. “2 stems” yields vocals + instrumental.',
    },
  },
  'audio/source-separation/open-unmix': {
    repo: 'https://huggingface.co/StemSplitio/htdemucs-onnx/resolve/main/htdemucs_fp16weights.onnx',
    task: 'onnxruntime',
    ort: 'demucs',
    stems: '4',
    dtype: 'fp16',
    substitute: true,
    note: {
      zh: 'Open-Unmix 没有可用的浏览器 ONNX 权重，改用 HT-Demucs 4 轨（166 MB）做真实分离。',
      en: 'Open-Unmix has no usable browser ONNX weights; HT-Demucs 4-stem (166 MB) performs the real separation instead.',
    },
  },
  'text/summarization/t5-small': {
    repo: 'Xenova/t5-small',
    task: 'summarization',
    dtype: 'q8',
    note: {
      zh: '真实权重：T5-small（约 60 MB）逐 token 生成摘要，偏抽取式。',
      en: 'Real weights: T5-small (~60 MB) generates the summary token by token; output is fairly extractive.',
    },
  },
  'vision/image-restoration/nafnet-denoise': {
    repo: 'Xenova/swin2SR-lightweight-x2-64',
    task: 'image-to-image',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'NAFNet 无浏览器 ONNX 权重，改用轻量 Swin2SR（2 倍重建）作替身，输出像素由模型真实生成。',
      en: 'NAFNet has no browser ONNX weights; the lightweight Swin2SR (2x reconstruction) stands in. Output pixels are generated by the model.',
    },
  },
  'audio/tts/piper-tts': {
    repo: 'Xenova/mms-tts-eng',
    task: 'text-to-audio',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: '（仅英文文本）Piper 没有 Transformers.js 可加载的权重，这里用 Meta MMS 英语 TTS 作替身，波形由模型真实合成。',
      en: '(English text only) Piper has no Transformers.js-loadable weights, so Meta MMS English TTS stands in — the waveform is synthesised for real.',
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
  'llm/chat/qwen2-1-5b': {
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
  'llm/code/deepseek-coder-1-3b': {
    repo: 'onnx-community/Qwen2.5-Coder-0.5B-Instruct',
    task: 'text-generation',
    dtype: 'q4f16',
    substitute: true,
    note: {
      zh: '真实权重：Qwen2.5-Coder-0.5B-Instruct（约 530 MB）真实生成代码片段，逐 token 输出。',
      en: 'Real weights: Qwen2.5-Coder-0.5B-Instruct (~530 MB) generates code token by token.',
    },
  },

  /* ------------------------------------------------ real-time (MediaPipe) */
  'real-time/face/mediapipe-facedetection': {
    repo: MP_URL['face-detect'],
    task: 'mediapipe',
    mp: 'face-detect',
    dtype: 'float16',
    note: {
      zh: '真实权重：MediaPipe BlazeFace 短距离人脸检测（约 3.7 MB），框与 6 个关键点均来自模型。',
      en: 'Real weights: MediaPipe BlazeFace short-range face detector (~3.7 MB); the box and 6 keypoints come from the model.',
    },
  },
  'real-time/face/mediapipe-facemesh': {
    repo: MP_URL['face-mesh'],
    task: 'mediapipe',
    mp: 'face-mesh',
    dtype: 'float16',
    note: {
      zh: '真实权重：MediaPipe Face Landmarker（约 3.7 MB），输出 478 个人脸关键点。',
      en: 'Real weights: MediaPipe Face Landmarker (~3.7 MB), 478 face landmarks.',
    },
  },
  'real-time/face/blazeface': {
    repo: MP_URL['face-detect'],
    task: 'mediapipe',
    mp: 'face-detect',
    dtype: 'float16',
    substitute: true,
    note: {
      zh: 'TFJS 版 BlazeFace 与此为同一架构，这里加载 TFLite 版，MediaPipe BlazeFace 短距离人脸检测（约 3.7 MB）。',
      en: 'The TFJS BlazeFace is the same architecture; the TFLite build is loaded instead. ~3.7 MB.',
    },
  },
  'real-time/pose/mediapipe-pose': {
    repo: MP_URL['pose'],
    task: 'mediapipe',
    mp: 'pose',
    dtype: 'float16',
    note: {
      zh: '真实权重：MediaPipe BlazePose Lite（约 5.8 MB），输出 33 个人体关键点。',
      en: 'Real weights: MediaPipe BlazePose Lite (~5.8 MB), 33 body landmarks.',
    },
  },
  'real-time/pose/mediapipe-pose-landmarker': {
    repo: MP_URL['pose'],
    task: 'mediapipe',
    mp: 'pose',
    dtype: 'float16',
    note: {
      zh: '真实权重：MediaPipe BlazePose Lite（约 5.8 MB），输出 33 个人体关键点。',
      en: 'Real weights: MediaPipe BlazePose Lite (~5.8 MB), 33 body landmarks.',
    },
  },
  'real-time/pose/movenet': {
    repo: MP_URL['pose'],
    task: 'mediapipe',
    mp: 'pose',
    dtype: 'float16',
    substitute: true,
    note: {
      zh: 'MoveNet 无 TFLite 浏览器包，换用 BlazePose Lite（33 点），MediaPipe BlazePose Lite（约 5.8 MB）。',
      en: 'MoveNet has no browser-ready bundle; BlazePose Lite (33 points) stands in. ~5.8 MB.',
    },
  },
  'real-time/pose/posenet': {
    repo: MP_URL['pose'],
    task: 'mediapipe',
    mp: 'pose',
    dtype: 'float16',
    substitute: true,
    note: {
      zh: 'PoseNet 无 TFLite 浏览器包，换用 BlazePose Lite（33 点），MediaPipe BlazePose Lite（约 5.8 MB）。',
      en: 'PoseNet has no browser-ready bundle; BlazePose Lite (33 points) stands in. ~5.8 MB.',
    },
  },
  'real-time/hand/mediapipe-hands': {
    repo: MP_URL['hand'],
    task: 'mediapipe',
    mp: 'hand',
    dtype: 'float16',
    note: {
      zh: '真实权重：MediaPipe Gesture Recognizer（手部检测 + 21 点关键点 + 手势分类，约 8 MB）。',
      en: 'Real weights: MediaPipe Gesture Recognizer (hand detector + 21 landmarks + gesture classifier, ~8 MB).',
    },
  },
  'real-time/hand/mediapipe-handlandmarker': {
    repo: MP_URL['hand'],
    task: 'mediapipe',
    mp: 'hand',
    dtype: 'float16',
    note: {
      zh: '真实权重：MediaPipe Gesture Recognizer（手部检测 + 21 点关键点 + 手势分类，约 8 MB）。',
      en: 'Real weights: MediaPipe Gesture Recognizer (hand detector + 21 landmarks + gesture classifier, ~8 MB).',
    },
  },
  'real-time/tracking/bytetrack-wasm': {
    repo: MP_URL['object'],
    task: 'mediapipe',
    mp: 'object',
    dtype: 'float16',
    substitute: true,
    note: {
      zh: 'ByteTrack 需要外部检测器，这里用：MediaPipe EfficientDet-Lite0（约 4.4 MB）逐帧检测，再用 IoU 关联分配稳定 ID。',
      en: 'ByteTrack needs an external detector; this uses MediaPipe EfficientDet-Lite0 (~4.4 MB) per frame, then IoU association assigns persistent IDs.',
    },
  },
  'real-time/tracking/mediapipe-holistic': {
    repo: MP_URL['object'],
    task: 'mediapipe',
    mp: 'object',
    dtype: 'float16',
    substitute: true,
    note: {
      zh: 'Holistic 不是多目标跟踪器，这里改为：MediaPipe EfficientDet-Lite0（约 4.4 MB）逐帧检测，再用 IoU 关联分配稳定 ID。',
      en: 'Holistic is not a multi-object tracker; this uses MediaPipe EfficientDet-Lite0 (~4.4 MB) per frame, then IoU association assigns persistent IDs.',
    },
  },
  'real-time/tracking/mediapipe-objectron': {
    repo: MP_URL['object'],
    task: 'mediapipe',
    mp: 'object',
    dtype: 'float16',
    substitute: true,
    note: {
      zh: 'Objectron 无公开 Web 权重，这里改为：MediaPipe EfficientDet-Lite0（约 4.4 MB）逐帧检测，再用 IoU 关联分配稳定 ID。',
      en: 'Objectron has no public web weights; this uses MediaPipe EfficientDet-Lite0 (~4.4 MB) per frame, then IoU association assigns persistent IDs.',
    },
  },

  'text/translation/nllb-200': {
    repo: 'Xenova/opus-mt-en-zh',
    task: 'translation',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'NLLB-200 的浏览器权重过大（约 600 MB），改用 Marian OPUS-MT 英↔中（约 107 MB）做真实翻译，仅覆盖中英方向。',
      en: 'NLLB-200 is too large for the browser (~600 MB), so Marian OPUS-MT en↔zh (~107 MB) translates for real; only the English/Chinese pair is covered.',
    },
  },
  'text/translation/m2m100-418m': {
    repo: 'Xenova/opus-mt-en-zh',
    task: 'translation',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'M2M100 的浏览器权重约 1.7 GB，改用 Marian OPUS-MT 英↔中（约 107 MB）做真实翻译，仅覆盖中英方向。',
      en: 'M2M100 is ~1.7 GB in the browser, so Marian OPUS-MT en↔zh (~107 MB) translates for real; only the English/Chinese pair is covered.',
    },
  },
  'text/summarization/bart-large-cnn': {
    repo: 'Xenova/t5-small',
    task: 'summarization',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'BART-large-CNN 的浏览器权重约 400 MB，改用 T5-small（约 60 MB）做真实摘要，偏抽取式。',
      en: 'BART-large-CNN is ~400 MB in the browser, so T5-small (~60 MB) summarises for real; output is fairly extractive.',
    },
  },
  'search-rag/reranker/bge-reranker-base': {
    repo: 'Xenova/bge-reranker-base',
    task: 'text-classification',
    dtype: 'q8',
    note: {
      zh: '真实权重：BGE Reranker Base 交叉编码器（约 279 MB），对每个 query–文档对直接打相关性分。',
      en: 'Real weights: the BGE Reranker Base cross-encoder (~279 MB) scores every query–document pair directly.',
    },
  },
  'llm/chat/llama-3-8b-instruct': {
    repo: 'onnx-community/Qwen2.5-0.5B-Instruct',
    task: 'text-generation',
    dtype: 'q4f16',
    substitute: true,
    note: {
      zh: 'Llama-3-8B 的浏览器权重超过 0.7 GB，改用 Qwen2.5-0.5B-Instruct（约 460 MB）做真实多轮生成。',
      en: 'Llama-3-8B exceeds ~0.7 GB in the browser, so Qwen2.5-0.5B-Instruct (~460 MB) generates the replies for real.',
    },
  },
  'llm/chat/tinyllama-1-1b': {
    repo: 'onnx-community/Qwen2.5-0.5B-Instruct',
    task: 'text-generation',
    dtype: 'q4f16',
    substitute: true,
    note: {
      zh: 'TinyLlama-1.1B 的浏览器权重超过 0.7 GB，改用 Qwen2.5-0.5B-Instruct（约 460 MB）做真实多轮生成。',
      en: 'TinyLlama-1.1B exceeds ~0.7 GB in the browser, so Qwen2.5-0.5B-Instruct (~460 MB) generates the replies for real.',
    },
  },
  'llm/chat/gemma-2-2b-it': {
    repo: 'onnx-community/Qwen2.5-0.5B-Instruct',
    task: 'text-generation',
    dtype: 'q4f16',
    substitute: true,
    note: {
      zh: 'Gemma-2-2B 的浏览器权重超过 0.7 GB，改用 Qwen2.5-0.5B-Instruct（约 460 MB）做真实多轮生成。',
      en: 'Gemma-2-2B exceeds ~0.7 GB in the browser, so Qwen2.5-0.5B-Instruct (~460 MB) generates the replies for real.',
    },
  },
  'llm/chat/smollm2-1-7b': {
    repo: 'onnx-community/Qwen2.5-0.5B-Instruct',
    task: 'text-generation',
    dtype: 'q4f16',
    substitute: true,
    note: {
      zh: 'SmolLM2-1.7B 的浏览器权重超过 0.7 GB，改用 Qwen2.5-0.5B-Instruct（约 460 MB）做真实多轮生成。',
      en: 'SmolLM2-1.7B exceeds ~0.7 GB in the browser, so Qwen2.5-0.5B-Instruct (~460 MB) generates the replies for real.',
    },
  },
  'llm/chat/deepseek-r1-distill-qwen-1-5b': {
    repo: 'onnx-community/Qwen2.5-0.5B-Instruct',
    task: 'text-generation',
    dtype: 'q4f16',
    substitute: true,
    note: {
      zh: 'DeepSeek-R1-Distill-1.5B 的浏览器权重超过 0.7 GB，改用 Qwen2.5-0.5B-Instruct（约 460 MB）做真实多轮生成。',
      en: 'DeepSeek-R1-Distill-1.5B exceeds ~0.7 GB in the browser, so Qwen2.5-0.5B-Instruct (~460 MB) generates the replies for real.',
    },
  },
  'llm/structured-output/outline-llama': {
    repo: 'onnx-community/Qwen2.5-0.5B-Instruct',
    task: 'text-generation',
    dtype: 'q4f16',
    substitute: true,
    note: {
      zh: 'Outlines + Llama 体积过大，改用 Qwen2.5-0.5B-Instruct 按 Schema 提示真实生成 JSON，合法性由前端再校验。',
      en: 'Outlines + Llama is too large for the browser, so Qwen2.5-0.5B-Instruct generates JSON from the schema prompt for real; the front end still validates it.',
    },
  },
  'llm/code/codellama-7b': {
    repo: 'onnx-community/Qwen2.5-Coder-0.5B-Instruct',
    task: 'text-generation',
    dtype: 'q4f16',
    substitute: true,
    note: {
      zh: 'CodeLlama-7B 的浏览器权重过大，改用 Qwen2.5-Coder-0.5B-Instruct（约 530 MB）真实生成代码。',
      en: 'CodeLlama-7B is too large for the browser, so Qwen2.5-Coder-0.5B-Instruct (~530 MB) generates the code for real.',
    },
  },
  'llm/code/starcoder2-3b': {
    repo: 'onnx-community/Qwen2.5-Coder-0.5B-Instruct',
    task: 'text-generation',
    dtype: 'q4f16',
    substitute: true,
    note: {
      zh: 'StarCoder2-3B 的浏览器权重过大，改用 Qwen2.5-Coder-0.5B-Instruct（约 530 MB）真实生成代码。',
      en: 'StarCoder2-3B is too large for the browser, so Qwen2.5-Coder-0.5B-Instruct (~530 MB) generates the code for real.',
    },
  },
  'multimodal/vlm/llava-1-5-7b': {
    repo: 'Xenova/vit-gpt2-image-captioning',
    task: 'image-to-text',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'LLaVA-1.5-7B 在当前运行时无法加载，改用 ViT-GPT2 做真实图像描述；多轮视觉问答暂不支持。',
      en: 'LLaVA-1.5-7B cannot be loaded by this runtime, so ViT-GPT2 captions the image for real; multi-turn VQA is not supported.',
    },
  },
  'multimodal/vlm/paligemma-3b': {
    repo: 'Xenova/vit-gpt2-image-captioning',
    task: 'image-to-text',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'PaliGemma-3B 在当前运行时无法加载，改用 ViT-GPT2 做真实图像描述；多轮视觉问答暂不支持。',
      en: 'PaliGemma-3B cannot be loaded by this runtime, so ViT-GPT2 captions the image for real; multi-turn VQA is not supported.',
    },
  },
  'multimodal/vlm/florence-2': {
    repo: 'Xenova/vit-gpt2-image-captioning',
    task: 'image-to-text',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'Florence-2 在当前运行时无法加载，改用 ViT-GPT2 做真实图像描述；多轮视觉问答暂不支持。',
      en: 'Florence-2 cannot be loaded by this runtime, so ViT-GPT2 captions the image for real; multi-turn VQA is not supported.',
    },
  },
  'multimodal/document-understanding/layoutlmv3': {
    repo: 'Xenova/donut-base-finetuned-cord-v2',
    task: 'document-question-answering',
    dtype: 'q8',
    substitute: true,
    note: {
      zh: 'LayoutLMv3 需要外部 OCR，改用端到端的 Donut（约 209 MB）直接读文档并抽取字段。',
      en: 'LayoutLMv3 needs an external OCR step, so the end-to-end Donut (~209 MB) reads the document and extracts fields directly.',
    },
  },

  'audio/tts/bark-wasm': {
    repo: 'onnx-community/Supertonic-TTS-ONNX',
    task: 'text-to-audio',
    dtype: 'fp32',
    substitute: true,
    note: {
      zh: 'Bark 在浏览器里体积过大（仅英文文本），改用 Supertonic TTS（约 260 MB）做真实语音合成。',
      en: 'Bark is too large for the browser, so Supertonic TTS (~260 MB) does the real synthesis.',
    },
  },
  'generative-vision/inpainting/sdxl-inpaint': {
    repo: 'https://huggingface.co/anyisalin/migan-onnx/resolve/main/onnx/migan_pipeline.onnx',
    task: 'onnxruntime',
    ort: 'migan',
    dtype: 'uint8',
    substitute: true,
    note: {
      zh: 'SDXL Inpaint（约 3.8 GB）无法在浏览器中运行，改用 MI-GAN（28 MB）真实修补涂抹区域。',
      en: 'SDXL Inpaint (~3.8 GB) cannot run in the browser, so MI-GAN (28 MB) fills the painted area for real.',
    },
  },
  'video/video-understanding/videoclip': {
    repo: MP_URL['classify'],
    task: 'mediapipe',
    mp: 'classify',
    dtype: 'float32',
    substitute: true,
    note: {
      zh: 'VideoCLIP 的浏览器权重过大且无视频管线，改用 EfficientNet-Lite0（约 18 MB）对抽样帧逐帧分类，并把相邻同类帧合并成时间段。',
      en: 'VideoCLIP is too large and has no video pipeline here, so EfficientNet-Lite0 (~18 MB) classifies each sampled frame and adjacent frames with the same label merge into segments.',
    },
  },
  'video/video-understanding/xclip': {
    repo: MP_URL['classify'],
    task: 'mediapipe',
    mp: 'classify',
    dtype: 'float32',
    substitute: true,
    note: {
      zh: 'X-CLIP 的浏览器权重过大且无视频管线，改用 EfficientNet-Lite0（约 18 MB）对抽样帧逐帧分类，并把相邻同类帧合并成时间段。',
      en: 'X-CLIP is too large and has no video pipeline here, so EfficientNet-Lite0 (~18 MB) classifies each sampled frame and adjacent frames with the same label merge into segments.',
    },
  },
  'video/video-understanding/videomae': {
    repo: MP_URL['classify'],
    task: 'mediapipe',
    mp: 'classify',
    dtype: 'float32',
    substitute: true,
    note: {
      zh: 'VideoMAE 的浏览器权重过大且无视频管线，改用 EfficientNet-Lite0（约 18 MB）对抽样帧逐帧分类，并把相邻同类帧合并成时间段。',
      en: 'VideoMAE is too large and has no video pipeline here, so EfficientNet-Lite0 (~18 MB) classifies each sampled frame and adjacent frames with the same label merge into segments.',
    },
  },
  'video/video-watermark-removal/video-watermark-repair': {
    repo: 'https://huggingface.co/anyisalin/migan-onnx/resolve/main/onnx/migan_pipeline.onnx',
    task: 'onnxruntime',
    ort: 'migan',
    dtype: 'uint8',
    note: {
      zh: '真实权重：选区时域采样判定背景是否静止，静止时用 MI-GAN（28 MB ONNX）单帧补全补丁，WebCodecs 重编码并用 ffmpeg.wasm 回填原音轨。',
      en: 'Real weights: the selection is sampled over time; a static background gets a MI-GAN (28 MB ONNX) single-frame patch, then WebCodecs re-encodes the frames and ffmpeg.wasm muxes the original audio back.',
    },
  },

  'text/token-classification/bert-base-ner': {
    repo: 'Xenova/bert-base-NER',
    task: 'token-classification',
    dtype: 'q8',
    note: {
      zh: '真实权重：BERT-base CoNLL-2003 实体识别（约 109 MB），token 级预测后在前端合并为完整实体。',
      en: 'Real weights: BERT-base fine-tuned on CoNLL-2003 (~109 MB); token predictions are merged into whole entities in the browser.',
    },
  },
  'text/token-classification/distilbert-multilingual-ner': {
    repo: 'Xenova/distilbert-base-multilingual-cased-ner-hrl',
    task: 'token-classification',
    dtype: 'q8',
    note: {
      zh: '真实权重：DistilBERT 多语言实体识别（约 135 MB），覆盖中文、英文等 10 种语言。',
      en: 'Real weights: multilingual DistilBERT entity tagger (~135 MB) covering Chinese, English and 8 other languages.',
    },
  },
  'text/question-answering/distilbert-squad': {
    repo: 'Xenova/distilbert-base-cased-distilled-squad',
    task: 'question-answering',
    dtype: 'q8',
    note: {
      zh: '真实权重：DistilBERT SQuAD 抽取式问答（约 67 MB），答案是原文里的一个片段。',
      en: 'Real weights: DistilBERT SQuAD extractive QA (~67 MB); the answer is a span of the passage.',
    },
  },
  'text/question-answering/distilbert-squad-uncased': {
    repo: 'Xenova/distilbert-base-uncased-distilled-squad',
    task: 'question-answering',
    dtype: 'q8',
    note: {
      zh: '真实权重：DistilBERT uncased SQuAD 问答（约 67 MB）。',
      en: 'Real weights: DistilBERT uncased SQuAD QA (~67 MB).',
    },
  },
  'vision/image-classification/mobilevit-small': {
    repo: 'Xenova/mobilevit-small',
    task: 'image-classification',
    dtype: 'q8',
    note: {
      zh: '真实权重：MobileViT-small（约 6 MB）ImageNet-1k 分类。',
      en: 'Real weights: MobileViT-small (~6 MB) ImageNet-1k classification.',
    },
  },
  'vision/image-classification/resnet-50': {
    repo: 'Xenova/resnet-50',
    task: 'image-classification',
    dtype: 'q8',
    note: {
      zh: '真实权重：ResNet-50（约 26 MB）ImageNet-1k 分类。',
      en: 'Real weights: ResNet-50 (~26 MB) ImageNet-1k classification.',
    },
  },
  'vision/image-classification/vit-base': {
    repo: 'Xenova/vit-base-patch16-224',
    task: 'image-classification',
    dtype: 'q8',
    note: {
      zh: '真实权重：ViT-base（约 88 MB）ImageNet-1k 分类。',
      en: 'Real weights: ViT-base (~88 MB) ImageNet-1k classification.',
    },
  },
  'vision/zero-shot-detection/owlvit-base': {
    repo: 'Xenova/owlvit-base-patch32',
    task: 'zero-shot-object-detection',
    dtype: 'q4f16',
    note: {
      zh: '真实权重：OWL-ViT（约 127 MB）开放词表检测，目标由你输入的文字描述决定。',
      en: 'Real weights: OWL-ViT (~127 MB) open-vocabulary detector; targets are whatever you describe in text.',
    },
  },
  'audio/audio-classification/ast-audioset': {
    repo: 'Xenova/ast-finetuned-audioset-10-10-0.4593',
    task: 'audio-classification',
    dtype: 'q8',
    note: {
      zh: '真实权重：AST（约 91 MB）AudioSet 527 类声音事件分类。',
      en: 'Real weights: AST (~91 MB) classifying 527 AudioSet sound events.',
    },
  },
  'audio/audio-classification/wav2vec2-keyword-spotting': {
    repo: 'Xenova/wav2vec2-base-superb-ks',
    task: 'audio-classification',
    dtype: 'q8',
    note: {
      zh: '真实权重：Wav2Vec2 关键词识别（约 96 MB），12 个语音指令（yes / no / up / down …）。',
      en: 'Real weights: Wav2Vec2 keyword spotting (~96 MB) for 12 spoken commands (yes / no / up / down …).',
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
