import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ExecutiveSummaryReport } from './components/ExecutiveSummaryReport';
import { MdaComplianceReport } from './components/MdaComplianceReport';
import { FileBarChart, Building2 } from 'lucide-react';

export function ReportsPage() {
  usePageMeta({
    title: 'Reports — VLPRS',
    description: 'Executive Summary and MDA Compliance reports for governance and briefings.',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
        <p className="text-text-secondary">Executive reporting for governance meetings and Commissioner briefings.</p>
      </div>

      <Tabs defaultValue="executive-summary">
        <TabsList>
          <TabsTrigger value="executive-summary" className="gap-2">
            <FileBarChart className="h-4 w-4" />
            Executive Summary
          </TabsTrigger>
          <TabsTrigger value="mda-compliance" className="gap-2">
            <Building2 className="h-4 w-4" />
            MDA Compliance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="executive-summary" className="mt-6">
          <ExecutiveSummaryReport />
        </TabsContent>

        <TabsContent value="mda-compliance" className="mt-6">
          <MdaComplianceReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { ReportsPage as Component };
