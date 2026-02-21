import { useAuthStore } from '@/stores/authStore';

export function SubmissionsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text-primary">Monthly Submissions</h1>
      {user?.mdaId && (
        <p className="text-text-secondary">
          MDA: {user.mdaId}
        </p>
      )}
      <p className="text-text-secondary">
        Submissions content coming in Story 1.8b
      </p>
    </div>
  );
}
