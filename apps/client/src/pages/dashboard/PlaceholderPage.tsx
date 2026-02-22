import { useParams, useNavigate } from 'react-router';
import { Construction, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FEATURE_SPRINTS: Record<string, { label: string; sprint: string }> = {
  'generate-report': { label: 'Generate Report', sprint: 'Sprint 10 (Epic 6)' },
  'employment-event': { label: 'File Employment Event', sprint: 'Sprint 8 (Epic 11)' },
  'early-exit': { label: 'Compute Early Exit', sprint: 'Sprint 11 (Epic 12)' },
  'manual-entry': { label: 'Manual Entry Form', sprint: 'Sprint 7 (Epic 5)' },
};

export function PlaceholderPage() {
  const { feature } = useParams<{ feature: string }>();
  const navigate = useNavigate();
  const info = feature ? FEATURE_SPRINTS[feature] : undefined;
  const label = info?.label ?? feature ?? 'Feature';
  const sprint = info?.sprint ?? 'a future sprint';

  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      <div className="rounded-full bg-gold-50 p-6">
        <Construction className="h-12 w-12 text-gold" />
      </div>
      <h1 className="text-2xl font-bold text-text-primary">{label}</h1>
      <p className="text-text-secondary text-center max-w-md">
        This feature is coming in <span className="font-semibold">{sprint}</span>.
        Check back soon for updates.
      </p>
      <Button variant="outline" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Go Back
      </Button>
    </div>
  );
}

export { PlaceholderPage as Component };
