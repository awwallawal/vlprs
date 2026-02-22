import { useAuthStore } from '@/stores/authStore';

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

interface WelcomeGreetingProps {
  subtitle?: string;
}

export function WelcomeGreeting({ subtitle }: WelcomeGreetingProps) {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  return (
    <div className="space-y-1">
      <p className="text-lg text-text-secondary">
        {getTimeGreeting()},{' '}
        <span className="font-semibold text-text-primary">
          {user.firstName}
        </span>
      </p>
      {subtitle && (
        <p className="text-sm text-text-muted">{subtitle}</p>
      )}
    </div>
  );
}
