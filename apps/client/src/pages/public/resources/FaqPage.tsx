import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';
import { ContentPageHeader } from '@/components/public/ContentPageHeader';
import { CtaBanner } from '@/components/public/CtaBanner';
import { usePageMeta } from '@/hooks/usePageMeta';
import { FAQ_PAGE, FAQ_CATEGORIES } from '@/content/faq';
import { FINAL_CTA } from '@/content/homepage';

export function FaqPage() {
  usePageMeta(FAQ_PAGE.meta);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('beneficiaries');

  const filteredQuestions = useMemo(() => {
    const category = FAQ_CATEGORIES.find((c) => c.id === activeTab);
    if (!category) return [];
    if (!searchQuery.trim()) return category.questions;
    const q = searchQuery.toLowerCase();
    return category.questions.filter(
      (faq) =>
        faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q)
    );
  }, [activeTab, searchQuery]);

  return (
    <>
      <ContentPageHeader title={FAQ_PAGE.title} subtitle={FAQ_PAGE.subtitle}>
        <BreadcrumbNav />
      </ContentPageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Search input */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="search"
            placeholder="Search questions..."
            aria-label="Search frequently asked questions"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            {FAQ_CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id}>
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {FAQ_CATEGORIES.map((cat) => (
            <TabsContent key={cat.id} value={cat.id}>
              {filteredQuestions.length > 0 ? (
                <Accordion type="multiple">
                  {filteredQuestions.map((faq, index) => (
                    <AccordionItem key={faq.question} value={`faq-${index}`}>
                      <AccordionTrigger className="text-left font-medium text-slate-900">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-slate-700 leading-relaxed">{faq.answer}</p>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-slate-500 py-8 text-center">
                  No questions match your search in this category.
                </p>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <div className="mt-16">
        <CtaBanner
          heading={FINAL_CTA.heading}
          description={FINAL_CTA.description}
          primaryCta={FINAL_CTA.primaryCta}
          secondaryCta={FINAL_CTA.secondaryCta}
          variant="light"
        />
      </div>
    </>
  );
}
