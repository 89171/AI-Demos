'use client';

import Link from 'next/link';
import { useApp } from '@/lib/client-context';
import { TAXONOMY } from '@/lib/data/taxonomy';
import { MODELS, FRAMEWORK_LABEL } from '@/lib/data/models';
import { REAL_MODELS } from '@/lib/data/real-models';

export default function HomePage() {
  const { locale, tr } = useApp();
  const totalSubs = TAXONOMY.reduce((a, c) => a + c.subcategories.length, 0);
  const totalModels = Object.values(MODELS).reduce(
    (a, s) => a + Object.values(s).reduce((b, m) => b + m.length, 0),
    0
  );
  const realModels = Object.keys(REAL_MODELS).length;
  const frameworks = new Set(
    Object.values(MODELS).flatMap((s) => Object.values(s).flatMap((ms) => ms.map((m) => m.framework)))
  );

  return (
    <div>
      <section className="relative overflow-hidden border-b">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-[0.35]" />
        <div className="relative mx-auto max-w-6xl px-6 py-14 lg:px-10 lg:py-20">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]" style={{ background: 'var(--bg)' }}>
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--fg)' }} />
            {locale === 'zh' ? '端侧推理 · 无需服务端' : 'On-device inference · no backend needed'}
          </div>
          <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight tracking-tight lg:text-[40px]">
            {locale === 'zh' ? '在浏览器里体验 AI 模型' : 'Experience AI models in your browser'}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6" style={{ color: 'var(--fg-muted)' }}>
            {tr('homeLead').replace('{real}', String(realModels))}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { k: tr('categories'), v: TAXONOMY.length },
              { k: tr('subcategories'), v: totalSubs },
              { k: tr('models'), v: totalModels },
              { k: tr('realWeights'), v: realModels },
              { k: locale === 'zh' ? '推理框架' : 'Frameworks', v: frameworks.size },
            ].map((s) => (
              <div key={s.k} className="surface rounded-xl px-4 py-3">
                <div className="mono text-2xl font-semibold tracking-tight">{s.v}</div>
                <div className="mt-1 text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
                  {s.k}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-sm font-medium">{tr('categories')}</h2>
          <span className="text-[11px]" style={{ color: 'var(--fg-faint)' }}>
            {locale === 'zh' ? '每个子类都有独立的演示页' : 'Every subcategory has its own demo page'}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {TAXONOMY.map((cat) => {
            const count = cat.subcategories.reduce((a, s) => a + (MODELS[cat.slug]?.[s.slug]?.length ?? 0), 0);
            const fws = new Set(
              cat.subcategories.flatMap((s) => (MODELS[cat.slug]?.[s.slug] ?? []).map((m) => m.framework))
            );
            return (
              <div key={cat.slug} className="surface flex flex-col rounded-xl p-5 transition-shadow hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[15px] font-semibold tracking-tight">{cat.name[locale]}</h3>
                    <p className="mt-1 text-[12px] leading-5" style={{ color: 'var(--fg-subtle)' }}>
                      {cat.blurb[locale]}
                    </p>
                  </div>
                  <span className="tag shrink-0">{count}</span>
                </div>

                <div className="mt-4 space-y-1">
                  {cat.subcategories.map((sub) => (
                    <Link
                      key={sub.slug}
                      href={`/demos/${cat.slug}/${sub.slug}`}
                      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors"
                      style={{ color: 'var(--fg-muted)' }}
                    >
                      <span className="inline-block h-1 w-1 rounded-full" style={{ background: 'var(--fg-faint)' }} />
                      <span className="flex-1 truncate group-hover:underline">{sub.name[locale]}</span>
                      <span className="mono text-[10px]" style={{ color: 'var(--fg-faint)' }}>
                        {(MODELS[cat.slug]?.[sub.slug] ?? []).length}
                      </span>
                    </Link>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-1 border-t pt-3">
                  {[...fws].slice(0, 4).map((f) => (
                    <span key={f} className="tag">
                      {FRAMEWORK_LABEL[f] ?? f}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-8 text-[11px] leading-5 lg:px-10" style={{ color: 'var(--fg-faint)' }}>
          {locale === 'zh'
            ? '演示模式说明：部分任务使用确定性模拟引擎或内置参考输出，界面上会明确标注。图像像素运算、音频频谱处理、向量检索、场景切换检测等均为浏览器内真实计算。'
            : 'About demo mode: some tasks use a deterministic simulator or built-in reference outputs and are explicitly labelled. Image pixel operations, audio spectral processing, vector retrieval and shot-change detection are all computed for real in the browser.'}
        </div>
      </footer>
    </div>
  );
}
