import type { UserListItem } from '@vlprs/shared';
import { ROLES, canManageRole, UI_COPY } from '@vlprs/shared';
import type { Role } from '@vlprs/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MoreHorizontal, Eye } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { ROLE_LABELS } from '@/components/layout/navItems';

interface UserCardProps {
  user: UserListItem;
  currentUserRole: Role;
  mdaName?: string;
  onDeactivate: (user: UserListItem) => void;
  onReactivate: (user: UserListItem) => void;
  onDelete: (user: UserListItem) => void;
  onResetPassword: (user: UserListItem) => void;
  onReassignMda: (user: UserListItem) => void;
}

export function UserCard({
  user,
  currentUserRole,
  mdaName,
  onDeactivate,
  onReactivate,
  onDelete,
  onResetPassword,
  onReassignMda,
}: UserCardProps) {
  const isSuperAdmin = user.role === ROLES.SUPER_ADMIN;
  const canManage = canManageRole(currentUserRole, user.role as Role);

  return (
    <Card className="min-h-[44px]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
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
              <Badge variant={user.isActive ? 'info' : 'pending'}>
                <span
                  className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${user.isActive ? 'bg-teal' : 'bg-[#6B7280]'}`}
                  aria-hidden="true"
                />
                {user.isActive ? 'Active' : 'Deactivated'}
              </Badge>
            </div>
            {mdaName && (
              <p className="text-xs text-muted-foreground mt-1">{mdaName}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Created {formatDate(user.createdAt)}
            </p>
          </div>

          {!user.isSelf && (
            <div className="ml-2">
              {isSuperAdmin ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10">
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">View Details</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{UI_COPY.SUPER_ADMIN_TOOLTIP}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : canManage ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11"
                      aria-label={`Actions for ${user.firstName} ${user.lastName}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {user.isActive ? (
                      <>
                        <DropdownMenuItem onClick={() => onResetPassword(user)}>
                          Reset Password
                        </DropdownMenuItem>
                        {user.role === ROLES.MDA_OFFICER && (
                          <DropdownMenuItem onClick={() => onReassignMda(user)}>
                            Reassign MDA
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onDeactivate(user)}>
                          Deactivate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onDelete(user)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={() => onReactivate(user)}>
                          Reactivate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onDelete(user)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
