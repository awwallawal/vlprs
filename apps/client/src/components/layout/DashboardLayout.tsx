import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { MobileNav } from './MobileNav';
import { Breadcrumb } from './Breadcrumb';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';

export function DashboardLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { showWarning, onContinue, onLogoutNow } = useSessionTimeout();
  const location = useLocation();

  // Focus management: move focus to page h1 on route change
  useEffect(() => {
    const heading = document.querySelector<HTMLElement>('main h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-crimson focus:text-white focus:px-4 focus:py-2 focus:rounded focus:text-sm"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile header */}
      <MobileHeader onMenuOpen={() => setMobileNavOpen(true)} />

      {/* Mobile navigation sheet */}
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Main content */}
      <main id="main-content" className="lg:ml-64 min-h-screen">
        <div className="p-4 lg:p-6">
          <Breadcrumb />
          <div className="mt-2">
            <Outlet />
          </div>
        </div>
      </main>

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
    </div>
  );
}
