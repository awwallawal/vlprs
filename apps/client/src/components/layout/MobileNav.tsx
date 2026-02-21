import { NavLink, useNavigate } from 'react-router';
import { LogOut, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';
import { NAV_ITEMS, ROLE_LABELS } from './navItems';
import { cn } from '@/lib/utils';
import type { Role } from '@vlprs/shared';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(user.role as Role),
  );

  const handleLogout = async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } catch {
      // Logout even if API call fails
    }
    clearAuth();
    navigate('/login');
    onClose();
  };

  const handleNavClick = () => {
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-[85%] max-w-xs bg-crimson text-white border-none p-0">
        <SheetHeader className="p-4 space-y-1">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-bold text-white">VLPRS</SheetTitle>
            <button
              onClick={onClose}
              className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </SheetHeader>

        <Separator className="bg-white/20" />

        {/* User info */}
        <div className="px-4 py-3 space-y-1">
          <p className="text-sm font-medium truncate">
            {user.firstName} {user.lastName}
          </p>
          <Badge variant="outline" className="border-white/30 text-white/80 text-[11px]">
            {ROLE_LABELS[user.role as Role]}
          </Badge>
        </div>

        <Separator className="bg-white/20" />

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-1" role="navigation" aria-label="Main navigation">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={handleNavClick}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all min-h-[44px]',
                  isActive
                    ? 'bg-white/15 font-semibold border-l-2 border-white'
                    : 'hover:bg-white/10 text-white/80',
                )
              }
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <Separator className="bg-white/20" />

        {/* Logout */}
        <div className="px-2 py-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded text-sm text-white/80 hover:bg-white/10 w-full min-h-[44px] transition-all"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Logout
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
