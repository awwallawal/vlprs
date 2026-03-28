import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ExecutiveSummaryReport } from './components/ExecutiveSummaryReport';
import { MdaComplianceReport } from './components/MdaComplianceReport';
import { VarianceReport } from './components/VarianceReport';
import { LoanSnapshotReport } from './components/LoanSnapshotReport';
import { WeeklyAgReport } from './components/WeeklyAgReport';
import { FileBarChart, Building2, ArrowLeftRight, Camera, CalendarDays } from 'lucide-react';

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
          <TabsTrigger value="variance" className="gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            Variance
          </TabsTrigger>
          <TabsTrigger value="loan-snapshot" className="gap-2">
            <Camera className="h-4 w-4" />
            Loan Snapshot
          </TabsTrigger>
          <TabsTrigger value="weekly-ag" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Weekly AG Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="executive-summary" className="mt-6">
          <ExecutiveSummaryReport />
        </TabsContent>

        <TabsContent value="mda-compliance" className="mt-6">
          <MdaComplianceReport />
        </TabsContent>

        <TabsContent value="variance" className="mt-6">
          <VarianceReport />
        </TabsContent>

        <TabsContent value="loan-snapshot" className="mt-6">
          <LoanSnapshotReport />
        </TabsContent>

        <TabsContent value="weekly-ag" className="mt-6">
          <WeeklyAgReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export { ReportsPage as Component };
