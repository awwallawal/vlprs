import type { KeyboardEvent } from 'react';
import { useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate, Navigate } from 'react-router';
import { LogOut, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarSeparator,
  SidebarGroup,
  SidebarGroupContent,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { NAV_ITEMS, ROLE_LABELS, ROLE_HOME_ROUTES } from './navItems';
import { Breadcrumb } from './Breadcrumb';
import { BuildStatus } from '@/components/shared/BuildStatus';
import { cn } from '@/lib/utils';
import type { Role } from '@vlprs/shared';

/** Close button visible only when sidebar is rendered as a mobile sheet. */
function MobileSidebarClose() {
  const { setOpenMobile, isMobile } = useSidebar();
  if (!isMobile) return null;
  return (
    <button
      onClick={() => setOpenMobile(false)}
      className="flex h-7 w-7 items-center justify-center rounded-full text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      aria-label="Close sidebar"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

export function DashboardLayout() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const location = useLocation();
  const { showWarning, onContinue, onLogoutNow } = useSessionTimeout();

  // Focus management: move focus to page h1 on route change
  useEffect(() => {
    const heading = document.querySelector<HTMLElement>('main h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  // Global Ctrl+K shortcut for search
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toast('Global search coming soon', {
          description: 'This feature will be available in a future update.',
        });
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Role-based home redirect
  if (user && location.pathname === '/dashboard') {
    const roleHome = ROLE_HOME_ROUTES[user.role as Role];
    if (roleHome && roleHome !== '/dashboard') {
      return <Navigate to={roleHome} replace />;
    }
  }

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

  const handleSearchClick = () => {
    toast('Global search coming soon', {
      description: 'This feature will be available in a future update.',
    });
  };

  const handleSearchKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSearchClick();
    }
  };

  return (
    <SidebarProvider>
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-crimson focus:text-white focus:px-4 focus:py-2 focus:rounded focus:text-sm"
      >
        Skip to main content
      </a>

      <Sidebar collapsible="icon">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
            <img
              src="/oyo-crest.png"
              alt="Oyo State Government Crest"
              className="h-8 w-8 shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <h2 className="text-lg font-bold group-data-[collapsible=icon]:hidden flex-1">
              VLPRS
            </h2>
            <MobileSidebarClose />
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        {/* User info */}
        <div className="px-4 py-3 space-y-1 group-data-[collapsible=icon]:hidden">
          <p className="text-sm font-medium truncate">
            {user.firstName} {user.lastName}
          </p>
          <Badge
            variant="outline"
            className="border-sidebar-border text-sidebar-foreground/80 text-[11px]"
          >
            {ROLE_LABELS[user.role as Role]}
          </Badge>
        </div>

        <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />

        {/* Navigation */}
        <SidebarContent>
          <nav aria-label="Main navigation">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => (
                    <SidebarMenuItem key={`${item.label}-${item.path}`}>
                      <SidebarMenuButton asChild tooltip={item.label}>
                        <NavLink
                          to={item.path}
                          end={item.path === '/dashboard'}
                          className={({ isActive }) =>
                            cn(
                              'min-h-[44px]',
                              isActive && 'font-semibold',
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <item.icon className="h-[18px] w-[18px]" />
                              <span>{item.label}</span>
                              {isActive && (
                                <span className="sr-only">(current page)</span>
                              )}
                            </>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </nav>
        </SidebarContent>

        <SidebarSeparator />

        {/* Footer */}
        <SidebarFooter>
          <BuildStatus />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleLogout}
                tooltip="Logout"
                className="min-h-[44px]"
              >
                <LogOut className="h-[18px] w-[18px]" />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-h-svh">
        {/* Mobile header bar */}
        <header className="sticky top-0 z-40 flex items-center gap-2 h-14 px-4 bg-crimson text-white md:hidden">
          <SidebarTrigger className="text-white hover:bg-white/10 hover:text-white" />
          <img
            src="/oyo-crest.png"
            alt="Oyo State Government Crest"
            className="h-7 w-7"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className="text-lg font-bold flex-1">VLPRS</span>
          <Badge
            variant="outline"
            className="border-white/30 text-white/80 text-[11px]"
          >
            {ROLE_LABELS[user.role as Role]}
          </Badge>
        </header>

        <main id="main-content" role="main" className="flex-1">
          <div className="p-4 lg:p-6 space-y-4">
            {/* Global search bar */}
            <search role="search" aria-label="Global search">
              <div
                role="button"
                tabIndex={0}
                onClick={handleSearchClick}
                onKeyDown={handleSearchKeyDown}
                className="flex items-center gap-2 w-full max-w-md rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-muted cursor-pointer hover:border-teal transition-colors"
                aria-label="Open global search"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="flex-1">Search...</span>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-text-muted">
                  Ctrl+K
                </kbd>
              </div>
            </search>

            {/* Breadcrumb */}
            <Breadcrumb />

            {/* Page content */}
            <div className="mt-2">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      {/* Session timeout warning dialog */}
      <Dialog open={showWarning} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Your session is expiring soon</DialogTitle>
            <DialogDescription>
              You&apos;ll be logged out due to inactivity. Click below to continue
              working.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onLogoutNow}>
              Log Out Now
            </Button>
            <Button onClick={onContinue}>Continue Working</Button>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

export { DashboardLayout as Component };
