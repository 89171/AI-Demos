import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'AI Demos · 浏览器端 AI 模型演示集',
  description:
    '10 个分类、30 个子类、103 个可在浏览器运行的 AI 模型交互演示。每个子类支持切换模型，示例内容通用。',
  keywords: ['AI', 'on-device', 'transformers.js', 'webgpu', 'demo', 'browser'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" data-theme="light" suppressHydrationWarning>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
