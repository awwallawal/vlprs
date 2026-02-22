/** @deprecated Use ContentPageHeader instead */
interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

/** @deprecated Use ContentPageHeader instead */
export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="pb-8 border-b border-slate-200 mb-8">
      <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-lg text-slate-600">{subtitle}</p>
      )}
    </div>
  );
}
