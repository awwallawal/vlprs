import { NavLink, useNavigate } from 'react-router';
import { LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';
import { NAV_ITEMS, ROLE_LABELS } from './navItems';
import { cn } from '@/lib/utils';
import type { Role } from '@vlprs/shared';

export function Sidebar() {
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
  };

  return (
    <aside
      className="hidden lg:flex w-64 flex-col bg-crimson text-white min-h-screen fixed inset-y-0 left-0 z-30"
    >
      {/* Brand */}
      <div className="p-4 space-y-1">
        <img
          src="/oyo-crest.svg"
          alt="Oyo State Government Crest"
          className="h-10 w-10 mx-auto"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <h2 className="text-lg font-bold text-center">VLPRS</h2>
      </div>

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
      <nav className="flex-1 px-2 py-3 space-y-1" aria-label="Main navigation">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all min-h-[44px]',
                isActive
                  ? 'bg-white/15 font-semibold border-l-2 border-white'
                  : 'hover:bg-white/10 text-white/80',
              )
            }
            end
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
    </aside>
  );
}
