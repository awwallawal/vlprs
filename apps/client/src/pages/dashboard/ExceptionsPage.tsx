import { Construction } from 'lucide-react';

export function ExceptionsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4">
      <div className="rounded-full bg-gold-50 p-6">
        <Construction className="h-12 w-12 text-gold" />
      </div>
      <h1 className="text-2xl font-bold text-text-primary">Exception Management</h1>
      <p className="text-text-secondary">
        Full exception management is coming in Sprint 9 (Epic 7).
      </p>
    </div>
  );
}

export { ExceptionsPage as Component };
