import { Menu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_LABELS } from './navItems';
import type { Role } from '@vlprs/shared';

interface MobileHeaderProps {
  onMenuOpen: () => void;
}

export function MobileHeader({ onMenuOpen }: MobileHeaderProps) {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-crimson text-white">
      <button
        onClick={onMenuOpen}
        className="p-2 -ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <h1 className="text-lg font-bold">VLPRS</h1>
      {user && (
        <Badge variant="outline" className="border-white/30 text-white/80 text-[11px]">
          {ROLE_LABELS[user.role as Role]}
        </Badge>
      )}
    </header>
  );
}
