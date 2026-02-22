import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Menu, LogIn, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { LoginModal } from '@/components/public/LoginModal';
import { PUBLIC_NAV_ITEMS, isDropdown } from '@/content/navigation';
import { cn } from '@/lib/utils';

export function PublicNavBar() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      {/* Crimson accent line */}
      <div className="h-1 bg-gradient-to-r from-crimson to-crimson-dark" />

      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl backdrop-saturate-[1.8] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Wordmark */}
            <Link to="/" className="flex items-center gap-3 shrink-0 group">
              <img
                src="/oyo-crest.png"
                alt="Oyo State Government Crest"
                className="h-9 w-9"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="font-brand font-bold text-slate-900 text-sm group-hover:text-crimson transition-colors">
                Vehicle Loan Scheme
              </span>
            </Link>

            {/* Desktop Navigation */}
            <NavigationMenu className="hidden lg:flex">
              <NavigationMenuList className="gap-0.5">
                {PUBLIC_NAV_ITEMS.map((item) =>
                  isDropdown(item) ? (
                    <NavigationMenuItem key={item.label}>
                      <NavigationMenuTrigger className="text-sm font-medium text-slate-600 hover:text-crimson data-[state=open]:text-crimson transition-colors">
                        {item.label}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ul className="grid w-[300px] gap-0.5 p-2">
                          {item.items.map((sub) => (
                            <li key={sub.href}>
                              <NavigationMenuLink asChild>
                                <Link
                                  to={sub.href}
                                  className={cn(
                                    'group/link flex items-center justify-between rounded-lg px-3 py-2.5 text-sm leading-none no-underline outline-none transition-colors hover:bg-crimson-50 focus:bg-crimson-50',
                                    location.pathname === sub.href &&
                                      'bg-crimson-50 text-crimson font-medium'
                                  )}
                                >
                                  <span className="flex items-center gap-2">
                                    {sub.label}
                                    {sub.badge && (
                                      <Badge
                                        variant="pending"
                                        className="text-[10px] px-1.5 py-0"
                                      >
                                        {sub.badge}
                                      </Badge>
                                    )}
                                  </span>
                                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover/link:text-crimson transition-colors" />
                                </Link>
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  ) : (
                    <NavigationMenuItem key={item.label}>
                      <NavigationMenuLink asChild>
                        <Link
                          to={item.href}
                          className={cn(
                            'relative inline-flex h-10 items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-crimson focus:outline-none',
                            location.pathname === item.href &&
                              'text-crimson font-semibold after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:bg-crimson after:rounded-full'
                          )}
                          aria-current={
                            location.pathname === item.href ? 'page' : undefined
                          }
                        >
                          {item.label}
                        </Link>
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  )
                )}
              </NavigationMenuList>
            </NavigationMenu>

            {/* Desktop CTA */}
            <Button
              size="sm"
              className="hidden lg:inline-flex min-h-[44px] gap-2"
              onClick={() => setLoginOpen(true)}
            >
              <LogIn className="h-4 w-4" />
              Staff Login
            </Button>

            {/* Mobile Hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden min-h-[44px] min-w-[44px]"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5 text-slate-900" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[85%] max-w-[448px] p-0 flex flex-col"
              >
                {/* Branded mobile header */}
                <SheetHeader className="bg-gradient-to-b from-crimson-25 to-white px-5 pt-5 pb-4 border-b border-slate-100">
                  <SheetTitle className="flex items-center gap-3">
                    <img
                      src="/oyo-crest.png"
                      alt="Oyo State Government Crest"
                      className="h-9 w-9"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span className="text-sm font-brand font-bold text-slate-900">
                      Vehicle Loan Scheme
                    </span>
                  </SheetTitle>
                </SheetHeader>

                {/* Mobile navigation */}
                <nav
                  className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
                  aria-label="Mobile navigation"
                >
                  {PUBLIC_NAV_ITEMS.map((item) =>
                    isDropdown(item) ? (
                      <div key={item.label} className="pt-3 first:pt-0">
                        <span className="block px-3 py-2 text-xs font-brand font-semibold text-crimson uppercase tracking-wider">
                          {item.label}
                        </span>
                        {item.items.map((sub) => (
                          <Link
                            key={sub.href}
                            to={sub.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              'flex items-center justify-between rounded-lg px-3 py-3 text-sm text-slate-700 hover:bg-crimson-50 hover:text-crimson min-h-[44px] transition-colors',
                              location.pathname === sub.href &&
                                'bg-crimson-50 text-crimson font-medium border-l-2 border-crimson'
                            )}
                            aria-current={
                              location.pathname === sub.href ? 'page' : undefined
                            }
                          >
                            <span className="flex items-center gap-2">
                              {sub.label}
                              {sub.badge && (
                                <Badge
                                  variant="pending"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {sub.badge}
                                </Badge>
                              )}
                            </span>
                            <ChevronRight className="h-4 w-4 text-slate-300" />
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <Link
                        key={item.label}
                        to={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center justify-between rounded-lg px-3 py-3 text-sm text-slate-700 hover:bg-crimson-50 hover:text-crimson min-h-[44px] transition-colors',
                          location.pathname === item.href &&
                            'bg-crimson-50 text-crimson font-medium border-l-2 border-crimson'
                        )}
                        aria-current={
                          location.pathname === item.href ? 'page' : undefined
                        }
                      >
                        {item.label}
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </Link>
                    )
                  )}
                </nav>

                {/* Mobile footer */}
                <div className="px-4 pb-5 pt-3 border-t border-slate-200 space-y-3">
                  <Button
                    className="w-full min-h-[44px] gap-2"
                    onClick={() => {
                      setMobileOpen(false);
                      setLoginOpen(true);
                    }}
                  >
                    <LogIn className="h-4 w-4" />
                    Staff Login
                  </Button>
                  <p className="text-[11px] text-slate-400 text-center">
                    Oyo State Government Official Platform
                  </p>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}
