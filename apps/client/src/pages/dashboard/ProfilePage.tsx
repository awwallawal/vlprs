import { useState } from 'react';
import { ROLES, UI_COPY } from '@vlprs/shared';
import type { Role } from '@vlprs/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Lock, KeyRound } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useMdas } from '@/hooks/useUserAdmin';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { ROLE_LABELS } from '@/components/layout/navItems';
import { ChangePasswordDialog } from './components/ChangePasswordDialog';

function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const { data: mdas } = useMdas();

  if (!user) return null;

  const mdaName = user.mdaId
    ? mdas?.find((m) => m.id === user.mdaId)?.name ?? ''
    : '';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">My Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Full Name</label>
            <p className="text-sm">{user.firstName} {user.lastName}</p>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              Email
              <LockedFieldIcon />
            </label>
            <p className="text-sm">{user.email}</p>
          </div>

          {/* Role */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              Role
              <LockedFieldIcon />
            </label>
            <Badge
              variant={
                user.role === ROLES.SUPER_ADMIN
                  ? 'info'
                  : user.role === ROLES.DEPT_ADMIN
                    ? 'review'
                    : 'pending'
              }
            >
              {ROLE_LABELS[user.role as Role]}
            </Badge>
          </div>

          {/* MDA - only for mda_officer */}
          {user.role === ROLES.MDA_OFFICER && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                MDA Assignment
                <LockedFieldIcon />
              </label>
              <p className="text-sm">{mdaName || 'Not assigned'}</p>
            </div>
          )}

          {/* Account Created */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Account Created</label>
            <p className="text-sm">{formatDate(user.createdAt)}</p>
          </div>

          {/* Last Login */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Last Login</label>
            <p className="text-sm">
              {'lastLoginAt' in user && user.lastLoginAt
                ? formatDateTime(user.lastLoginAt as string)
                : 'Current session'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground">
                Change your password to keep your account secure
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => setChangePasswordOpen(true)}
            className="min-h-[44px]"
          >
            Change Password
          </Button>
        </CardContent>
      </Card>

      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </div>
  );
}

function LockedFieldIcon() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label={UI_COPY.ADMIN_FIELD_LOCKED} />
        </TooltipTrigger>
        <TooltipContent>
          <p>{UI_COPY.ADMIN_FIELD_LOCKED}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { ProfilePage as Component };
export { ProfilePage };
