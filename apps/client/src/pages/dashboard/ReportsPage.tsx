import { Construction } from 'lucide-react';

export function ReportsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4">
      <div className="rounded-full bg-gold-50 p-6">
        <Construction className="h-12 w-12 text-gold" />
      </div>
      <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
      <p className="text-text-secondary">
        Reporting and PDF export is coming in Sprint 10 (Epic 6).
      </p>
    </div>
  );
}

export { ReportsPage as Component };
