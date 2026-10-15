import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <span className="mono text-[11px]" style={{ color: 'var(--fg-faint)' }}>
        404
      </span>
      <h1 className="mt-3 text-xl font-semibold">未找到该演示 / Demo not found</h1>
      <p className="mt-2 text-[12px] leading-5" style={{ color: 'var(--fg-subtle)' }}>
        请从左侧目录选择一个子类，或返回首页浏览全部分类。
        <br />
        Pick a subcategory from the sidebar, or head back home to browse all categories.
      </p>
      <Link href="/" className="btn btn-primary mt-6">
        返回首页 / Back home
      </Link>
    </div>
  );
}
