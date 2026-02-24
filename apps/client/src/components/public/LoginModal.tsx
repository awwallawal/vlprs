import { Link } from 'react-router';
import { LayoutDashboard, User, FileEdit, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PORTALS = [
  {
    id: 'staff',
    icon: LayoutDashboard,
    title: 'Staff Portal',
    description:
      'For authorised MDA officers, department staff, and administrators.',
    active: true,
    href: '/login',
    ctaLabel: 'Login to Dashboard',
  },
  {
    id: 'beneficiary',
    icon: User,
    title: 'Beneficiary Portal',
    description: 'View your loan status and documents.',
    active: false,
    badge: 'Coming Soon (Phase 2)',
  },
  {
    id: 'eoi',
    icon: FileEdit,
    title: 'Expression of Interest',
    description: 'Register interest in the scheme.',
    active: false,
    badge: 'Coming Soon (Phase 2)',
  },
] as const;

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* Branded header */}
        <div className="bg-gradient-to-b from-crimson-25 to-white px-6 pt-6 pb-4">
          <DialogHeader className="items-center text-center">
            <img
              src="/oyo-crest.png"
              alt="Oyo State Government Crest"
              className="h-12 w-12 mx-auto mb-2"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <DialogTitle className="text-xl font-brand font-semibold text-slate-900">
              Access VLPRS
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Select a portal to continue
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Portal cards */}
        <div className="space-y-3 px-6 pb-2">
          {PORTALS.map((portal) => {
            const Icon = portal.icon;

            if (portal.active) {
              return (
                <div
                  key={portal.id}
                  className="rounded-xl border-2 border-crimson bg-crimson-50 p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-crimson text-white shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-brand font-semibold text-slate-900">
                          {portal.title}
                        </h3>
                        <Badge variant="info">Active</Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-3">
                        {portal.description}
                      </p>
                      <Button asChild size="sm" className="min-h-[44px]">
                        <Link to={portal.href} onClick={() => onOpenChange(false)}>
                          {portal.ctaLabel}
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={portal.id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 opacity-60 cursor-not-allowed"
              >
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-slate-100 text-slate-400 shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-brand font-semibold text-slate-400">
                        {portal.title}
                      </h3>
                      <Badge variant="pending">{portal.badge}</Badge>
                    </div>
                    <p className="text-sm text-slate-400">
                      {portal.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-slate-500 text-center px-6 pb-5 pt-3 border-t border-slate-100 mx-6">
          All portal access is role-based. Contact your department for account setup.
        </p>
      </DialogContent>
    </Dialog>
  );
}
