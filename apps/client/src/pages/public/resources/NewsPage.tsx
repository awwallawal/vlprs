import { Link } from 'react-router';
import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';
import { ContentPageHeader } from '@/components/public/ContentPageHeader';
import { CtaBanner } from '@/components/public/CtaBanner';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NEWS_ITEMS } from '@/content/news';
import { FINAL_CTA } from '@/content/homepage';

const NEWS_PAGE_META = {
  title: 'News & Announcements | Vehicle Loan Scheme',
  description:
    'Latest news and announcements from the Oyo State Vehicle Loan Scheme.',
};

// Sorted once at module level — NEWS_ITEMS is a static constant
const sortedNews = [...NEWS_ITEMS].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
);

export function NewsPage() {
  usePageMeta(NEWS_PAGE_META);

  return (
    <>
      <ContentPageHeader
        title="News & Announcements"
        subtitle="Updates from the Vehicle Loan Scheme"
      >
        <BreadcrumbNav />
      </ContentPageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {sortedNews.map((item) => (
            <div key={item.slug} className="border border-slate-200 rounded-lg p-6 hover:border-crimson-300 hover:shadow-md transition-all duration-200">
              <p className="text-sm text-slate-500 mb-2">
                {new Date(item.date).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{item.title}</h3>
              <p className="text-slate-600 line-clamp-3 mb-4">{item.excerpt}</p>
              <Link
                to={`/resources/news/${item.slug}`}
                className="text-sm font-medium text-teal hover:underline"
              >
                Read more →
              </Link>
            </div>
          ))}
        </div>
      </div>

      <CtaBanner
        heading={FINAL_CTA.heading}
        description={FINAL_CTA.description}
        primaryCta={FINAL_CTA.primaryCta}
        secondaryCta={FINAL_CTA.secondaryCta}
        variant="light"
      />
    </>
  );
}
