import { Link, Navigate, useParams } from 'react-router';
import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';
import { ContentPageHeader } from '@/components/public/ContentPageHeader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NEWS_ITEMS } from '@/content/news';

export function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const article = NEWS_ITEMS.find((a) => a.slug === slug);

  usePageMeta({
    title: article
      ? `${article.title} | News | Vehicle Loan Scheme`
      : 'News | Vehicle Loan Scheme',
    description: article?.excerpt ?? 'News article from the Vehicle Loan Scheme.',
  });

  if (!article) {
    return <Navigate to="/resources/news" replace />;
  }

  return (
    <>
      <ContentPageHeader title={article.title}>
        <BreadcrumbNav />
      </ContentPageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-sm text-slate-500 mb-8">
          {new Date(article.date).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>

        <div className="max-w-3xl">
          <p className="text-slate-700 leading-relaxed">{article.body}</p>
        </div>

        <div className="mt-12">
          <Link
            to="/resources/news"
            className="text-sm font-medium text-teal hover:underline"
          >
            ← Back to News
          </Link>
        </div>
      </div>
    </>
  );
}
