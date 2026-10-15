import type { Metadata } from 'next';
import { DemoPlayground } from '@/components/demo/DemoPlayground';
import { allDemoPaths, getCategory, getSubMeta } from '@/lib/data/taxonomy';

export const dynamicParams = false;

export function generateStaticParams() {
  return allDemoPaths();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; subcategory: string }>;
}): Promise<Metadata> {
  const { category, subcategory } = await params;
  const cat = getCategory(category);
  const sub = getSubMeta(category, subcategory);
  if (!cat || !sub) return { title: 'AI Demos' };
  return {
    title: `${sub.name.zh} · ${cat.name.zh} · AI Demos`,
    description: `${sub.blurb.zh} — ${cat.name.zh} 分类下的浏览器端 AI 模型演示，可切换该子类的多个模型。`,
  };
}

export default async function SubcategoryDemoPage({
  params,
}: {
  params: Promise<{ category: string; subcategory: string }>;
}) {
  const { category, subcategory } = await params;
  return <DemoPlayground category={category} subcategory={subcategory} />;
}
