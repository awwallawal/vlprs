import { useLocation } from 'react-router';

const SPRINT_MAP: Record<string, number> = {
  '/reports': 4,
  '/exceptions': 5,
  '/migration': 3,
  '/history': 4,
};

export default function PlaceholderPage() {
  const location = useLocation();
  const sprint = SPRINT_MAP[location.pathname] ?? 2;
  const pageName = location.pathname.replace('/', '').replace(/^\w/, (c) => c.toUpperCase());

  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4">
      <div className="text-6xl text-text-muted">🚧</div>
      <h1 className="text-2xl font-bold text-text-primary">{pageName}</h1>
      <p className="text-text-secondary">
        Coming in Sprint {sprint}
      </p>
    </div>
  );
}
