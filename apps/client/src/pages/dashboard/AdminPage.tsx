import { Construction } from 'lucide-react';

export function AdminPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4">
      <div className="rounded-full bg-gold-50 p-6">
        <Construction className="h-12 w-12 text-gold" />
      </div>
      <h1 className="text-2xl font-bold text-text-primary">User Administration</h1>
      <p className="text-text-secondary">
        User management is coming in Story 1.9a / 1.9b.
      </p>
    </div>
  );
}

export { AdminPage as Component };
