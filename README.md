# AI Demos

浏览器端 AI 模型交互演示集。10 个分类、35 个子类、114 个模型，每个子类都有独立的演示页。

## 快速开始

```bash
npm install
npm run dev      # http://localhost:3100
```

```bash
npm run build && npm run start
npm run typecheck
npm run lint
```

## 技术栈

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| next | 16.4.0 | App Router + Turbopack（v16 默认构建器） |
| react / react-dom | 19.3.0 | v16 要求的 React 19 |
| tailwindcss | 4.3.3 | v4 CSS-first 配置，配 `@tailwindcss/postcss` |
| typescript | 5.9.3 | |
| eslint | 9.39.5 | `eslint.config.mjs` 扁平配置（`next lint` 已在 v16 移除） |

升级到 Next 16 / Tailwind 4 时的两个注意点：

- **路由参数变为 Promise**：`params` / `searchParams` 需要 `const { x } = await params`（见 `app/demos/[category]/[subcategory]/page.tsx`）。
- **Tailwind v4 不再使用 `tailwind.config.ts`**：配置写在 `app/globals.css` 里（`@import 'tailwindcss'`）。v4 的 preflight 把默认边框色改成了 `currentColor`，所以 `globals.css` 里补了 `* { border-color: var(--border); border-style: solid }` 来保持原来的 hairline 效果。

> 若 `npm install` 中途被中断，`node_modules` 可能停留在半解压状态（表现为某些包装好了 `package.json` 却缺 `index.js`，ESLint 报 `Cannot find module`）。修复方式是整体重装：`mv node_modules /tmp/old-nm && npm install`。

## 结构

```
app/
  layout.tsx                                 根布局（侧边栏 + 主题 + 语言）
  page.tsx                                   首页：10 个分类总览
  demos/[category]/[subcategory]/page.tsx    35 个子类演示页（静态预渲染）
components/
  AppShell.tsx                               侧边导航 / 主题切换 / 中英切换
  demo/
    DemoPlayground.tsx                       演示页编排：模型切换、输入、运行、结果
    InputPanel.tsx                           文本 / 图片 / 音频 / 视频 / 行编辑 / 掩码画布
    ParamBar.tsx                             参数控件（滑杆、下拉、开关）
    results.tsx                              25 种输出类型的渲染器
    LiveOverlay.tsx                          实时摄像头关键点叠加预览
lib/
  types.ts                                   领域类型
  i18n.ts                                    界面文案（中英）
  client-context.tsx                         locale / theme 上下文
  data/
    taxonomy.ts                              分类与子类元数据
    models.json                             从 WebAIModels 抽取的模型目录（103 个）；extra-models.json 补充上游没有的 11 个
    models.ts                                模型目录读取与展示标签
    registry.ts                              30 个子类的演示定义（输入类型、示例、参数）
    sample-gt.json                           示例图片的 ground truth 标注
  engine/
    index.ts                                 推理调度入口 runInference(kind, ctx)
    image-tasks.ts                           Canvas 像素运算（检测/分割/深度/修复/修补/关键点）
    audio-tasks.ts                           FFT/STFT、降噪、音源分离、Web Audio 作曲
    text-tasks.ts                            n-gram 向量、分类、抽取式摘要、术语对齐
    fixtures.ts                              内置示例的参考输出
    random.ts                                确定性哈希与 PRNG
scripts/
  gen_samples.py                             生成示例图片与标注
  extract-models.cjs                         从同级 WebAIModels 抽取模型目录
public/samples/                              示例素材（图片、音频、视频）
```

## 三个核心约定

1. **每个子类一个演示页** — `/demos/{分类}/{子类}`，共 35 个页面，构建时静态预渲染。
2. **示例与模型解耦** — 同一子类下的示例（文本、图片、音频、视频）是通用的。切换模型只替换权重量化、设备与后端元信息，输入内容保持不变，并且会自动用新模型重跑一次。
3. **可插拔推理层** — 所有任务都经过 `runInference(outputKind, ctx)`。要接入真实运行时（Transformers.js / onnxruntime-web / WebLLM / MediaPipe），只需在 `lib/engine/index.ts` 中为对应的 `outputKind` 换一个实现，UI 无需改动。

## 真实计算 vs 演示模式

结果面板上的徽章会明确标注来源：

| 徽章 | 含义 |
| --- | --- |
| 真实计算 | 结果由浏览器内真实算法得出 |
| 演示模式 | 使用内置参考输出或规则引擎生成 |

**真实权重**：音频降噪用 RNNoise（`@jitsi/rnnoise-wasm`）；音源分离用 HT-Demucs ONNX（Worker 中 onnxruntime-web，参考 json-toolkit 的实现）；图像修补用 MI-GAN ONNX；OCR 的 Tesseract.js 走 `tesseract.js`（WASM 与语言数据首次从 CDN 下载）；视频理解的 MediaPipe 分类器用 EfficientNet-Lite0 对抽样帧分类；实时感知（人脸 / 姿态 / 手势 / 目标追踪）走 `@mediapipe/tasks-vision`（模型来自 storage.googleapis.com/mediapipe-models，WASM 由 `postinstall` 复制到 `public/mediapipe`，摄像头叠加也逐帧真实推理）；其余带「浏览器权重」标记的模型走 Transformers.js，映射表见 `lib/data/real-models.ts`。

以下任务在浏览器内**真实计算**：

- 图像：分割（边界色板前景建模）、深度（单目线索 + 色彩映射）、修复（中值/双边 + unsharp）、修补（扩散填充）、文生图（种子驱动程序化采样）、关键点拓扑投影、目标检测（显著性能量提议 / 标注回放）、追踪（帧间差分 + 关联）、视频镜头切换（直方图变化率）
- 音频：降噪（STFT 谱减法 + 单极点高通）、音源分离（逐频点时间稳定性掩码）、文生音乐（Web Audio 实时合成）、语音合成（浏览器原生合成接口）
- 文本：嵌入（字符二元 / 词 n-gram 哈希桶 + 余弦）、重排序、语义检索、分类（关键词驱动的情感/意图/毒性判别）、抽取式摘要（TF 加权选句）、结构化抽取（正则模板）

以下任务使用内置参考输出（因为需要真实权重，镜像未随包分发）：对话生成、代码生成、结构化输出、机器翻译（自定义输入回退到术语表对齐）、VLM 问答、ASR 转写（自定义音频回退到能量 VAD 分段）、文档理解（自定义图片回退到版面行检测）。

## 示例素材

`scripts/gen_samples.py` 生成全部示例图片并输出 `lib/data/sample-gt.json`：

| 文件 | 用途 |
| --- | --- |
| `street.png` | 目标检测 / 深度 / 追踪 / VLM |
| `desk.png` | 目标检测 / 分割 / 深度 |
| `portrait.png` | 人脸关键点 / 分割 / 修复 |
| `pose.png` | 姿态估计 |
| `hand.png` | 手势关键点 |
| `document.png` | OCR / 文档理解（含真实可核对的中英文字段） |
| `poster.png` | 图像修补（右下角水印） |
| `street-noisy.png` `street-lowres.png` `portrait-noisy.png` | 图像修复（附干净参考图） |

音频由 macOS `say` 生成真实中英文语音，再用 `ffmpeg` 叠加粉红噪声 / 固定音调伴奏，因此 ASR、降噪、音源分离的输入与参考转写是对得上的。视频由 `ffmpeg` 合成。

## 设置

- 端口：3100（`npm run dev` / `npm run start`）
- 主题：跟随系统，可手动切换（黑白灰）
- 语言：中文 / English 切换，示例内容同步切换

## 数据来源

模型目录抽取自同级项目 `../WebAIModels`（`data/models.ts`），重新抽取：

```bash
node scripts/extract-models.cjs
```
