import { useState } from 'react';
import { Navigate } from 'react-router';
import { ROLES, canManageRole, UI_COPY } from '@vlprs/shared';
import type { Role, UserListItem } from '@vlprs/shared';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MoreHorizontal,
  Eye,
  Plus,
  Search,
  UserX,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useUsers, useMdas, useReactivateUser } from '@/hooks/useUserAdmin';
import type { UserFilters } from '@/hooks/useUserAdmin';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useAuthStore } from '@/stores/authStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { ROLE_LABELS, ROLE_HOME_ROUTES } from '@/components/layout/navItems';
import { InviteUserDialog } from './components/InviteUserDialog';
import { DeactivateDialog } from './components/DeactivateDialog';
import { DeleteDialog } from './components/DeleteDialog';
import { ResetPasswordDialog } from './components/ResetPasswordDialog';
import { ReassignMdaDialog } from './components/ReassignMdaDialog';
import { UserCard } from './components/UserCard';

type SortField = 'name' | 'email' | 'role' | 'mda' | 'status' | 'lastLoginAt' | 'createdAt';
type SortDirection = 'asc' | 'desc';

function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const isMobile = useIsMobile();

  // Guard: only super_admin and dept_admin can access
  if (!user || (user.role !== ROLES.SUPER_ADMIN && user.role !== ROLES.DEPT_ADMIN)) {
    const homeRoute = user ? ROLE_HOME_ROUTES[user.role as Role] : '/login';
    return <Navigate to={homeRoute} replace />;
  }

  return <AdminPageContent currentUser={user} isMobile={isMobile} />;
}

interface AdminPageContentProps {
  currentUser: NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
  isMobile: boolean;
}

function AdminPageContent({ currentUser, isMobile }: AdminPageContentProps) {
  // Filter state
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [mdaFilter, setMdaFilter] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Sort state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deactivateUser, setDeactivateUser] = useState<UserListItem | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<UserListItem | null>(null);
  const [resetPwUser, setResetPwUser] = useState<UserListItem | null>(null);
  const [reassignUser, setReassignUser] = useState<UserListItem | null>(null);

  const reactivateUser = useReactivateUser();
  const { data: mdas } = useMdas();

  const filters: UserFilters = {
    ...(roleFilter && roleFilter !== 'all' && { role: roleFilter }),
    ...(statusFilter && statusFilter !== 'all' && { status: statusFilter }),
    ...(mdaFilter && mdaFilter !== 'all' && { mdaId: mdaFilter }),
    ...(debouncedSearch && { search: debouncedSearch }),
    page: currentPage,
    pageSize,
  };

  const { data: usersResponse, isPending, error } = useUsers(filters);

  // Mark current user's own record
  const users = usersResponse?.data.map((u) => ({
    ...u,
    isSelf: u.id === currentUser.id,
  })) ?? [];

  // For dept_admin: filter to only mda_officer
  const visibleUsers = currentUser.role === ROLES.DEPT_ADMIN
    ? users.filter((u) => u.role === ROLES.MDA_OFFICER)
    : users;

  const getMdaName = (mdaId: string | null) => {
    if (!mdaId || !mdas) return '';
    return mdas.find((m) => m.id === mdaId)?.name ?? '';
  };

  // Sort
  const sortedUsers = [...visibleUsers].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'name':
        cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        break;
      case 'email':
        cmp = a.email.localeCompare(b.email);
        break;
      case 'role':
        cmp = a.role.localeCompare(b.role);
        break;
      case 'mda':
        cmp = (getMdaName(a.mdaId) || '').localeCompare(getMdaName(b.mdaId) || '');
        break;
      case 'status':
        cmp = Number(b.isActive) - Number(a.isActive);
        break;
      case 'lastLoginAt':
        cmp = (a.lastLoginAt ?? '').localeCompare(b.lastLoginAt ?? '');
        break;
      case 'createdAt':
        cmp = a.createdAt.localeCompare(b.createdAt);
        break;
    }
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleReactivate = async (target: UserListItem) => {
    try {
      await reactivateUser.mutateAsync(target.id);
      toast.success(`${target.firstName} ${target.lastName}'s account has been reactivated`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reactivate user';
      toast.error(message);
    }
  };

  const clearFilters = () => {
    setRoleFilter('');
    setStatusFilter('');
    setMdaFilter('');
    setSearchInput('');
    setCurrentPage(1);
  };

  const hasActiveFilters = !!(roleFilter && roleFilter !== 'all') || !!(statusFilter && statusFilter !== 'all') || !!(mdaFilter && mdaFilter !== 'all') || !!debouncedSearch;

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' \u2191' : ' \u2193';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-text-primary">User Management</h1>
        <Button onClick={() => setInviteOpen(true)} className="min-h-[44px]">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {UI_COPY.INVITE_USER}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 focus-visible:ring-teal border-[#E2E8F0]"
            aria-label="Search users"
          />
        </div>

        {currentUser.role === ROLES.SUPER_ADMIN && (
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[160px] focus:ring-teal border-[#E2E8F0]" aria-label="Filter by role">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="dept_admin">Dept Admin</SelectItem>
              <SelectItem value="mda_officer">MDA Officer</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] focus:ring-teal border-[#E2E8F0]" aria-label="Filter by status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="deactivated">Deactivated</SelectItem>
          </SelectContent>
        </Select>

        {currentUser.role === ROLES.SUPER_ADMIN && mdas && mdas.length > 0 && (
          <Select value={mdaFilter} onValueChange={setMdaFilter}>
            <SelectTrigger className="w-[200px] focus:ring-teal border-[#E2E8F0]" aria-label="Filter by MDA">
              <SelectValue placeholder="All MDAs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All MDAs</SelectItem>
              {mdas.map((mda) => (
                <SelectItem key={mda.id} value={mda.id}>
                  {mda.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="min-h-[44px]">
            Clear Filters
          </Button>
        )}
      </div>

      {/* Loading state */}
      {isPending && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">Failed to load users. Please try again.</p>
        </div>
      )}

      {/* Data display */}
      {!isPending && !error && (
        <>
          {sortedUsers.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="rounded-full bg-muted p-4">
                <UserX className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              </div>
              {hasActiveFilters ? (
                <>
                  <p className="text-sm text-muted-foreground">{UI_COPY.NO_USERS_MATCHING}</p>
                  <Button variant="ghost" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{UI_COPY.NO_USERS_YET}</p>
                  <Button onClick={() => setInviteOpen(true)}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {UI_COPY.INVITE_USER}
                  </Button>
                </>
              )}
            </div>
          ) : isMobile ? (
            /* Mobile card layout */
            <div className="space-y-3">
              {sortedUsers.map((u) => (
                <UserCard
                  key={u.id}
                  user={u}
                  currentUserRole={currentUser.role as Role}
                  mdaName={getMdaName(u.mdaId)}
                  onDeactivate={setDeactivateUser}
                  onReactivate={handleReactivate}
                  onDelete={setDeleteUserTarget}
                  onResetPassword={setResetPwUser}
                  onReassignMda={setReassignUser}
                />
              ))}
            </div>
          ) : (
            /* Desktop table */
            <div className="rounded-md border max-h-[70vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-muted/50">
                    <TableHead
                      className="uppercase text-xs font-semibold cursor-pointer select-none h-12"
                      onClick={() => handleSort('name')}
                    >
                      Name{sortIndicator('name')}
                    </TableHead>
                    <TableHead
                      className="uppercase text-xs font-semibold cursor-pointer select-none h-12"
                      onClick={() => handleSort('email')}
                    >
                      Email{sortIndicator('email')}
                    </TableHead>
                    <TableHead
                      className="uppercase text-xs font-semibold cursor-pointer select-none h-12"
                      onClick={() => handleSort('role')}
                    >
                      Role{sortIndicator('role')}
                    </TableHead>
                    {currentUser.role === ROLES.SUPER_ADMIN && (
                      <TableHead
                        className="uppercase text-xs font-semibold cursor-pointer select-none h-12"
                        onClick={() => handleSort('mda')}
                      >
                        MDA{sortIndicator('mda')}
                      </TableHead>
                    )}
                    <TableHead
                      className="uppercase text-xs font-semibold cursor-pointer select-none h-12"
                      onClick={() => handleSort('status')}
                    >
                      Status{sortIndicator('status')}
                    </TableHead>
                    <TableHead
                      className="uppercase text-xs font-semibold cursor-pointer select-none h-12"
                      onClick={() => handleSort('lastLoginAt')}
                    >
                      Last Login{sortIndicator('lastLoginAt')}
                    </TableHead>
                    <TableHead
                      className="uppercase text-xs font-semibold cursor-pointer select-none h-12"
                      onClick={() => handleSort('createdAt')}
                    >
                      Created{sortIndicator('createdAt')}
                    </TableHead>
                    <TableHead className="uppercase text-xs font-semibold h-12 w-[60px]">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedUsers.map((u, idx) => (
                    <TableRow
                      key={u.id}
                      className={`h-12 hover:bg-muted/30 ${idx % 2 === 1 ? 'bg-[#F8FAFC]' : ''}`}
                    >
                      <TableCell className="font-medium">
                        {u.firstName} {u.lastName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            u.role === ROLES.SUPER_ADMIN
                              ? 'info'
                              : u.role === ROLES.DEPT_ADMIN
                                ? 'review'
                                : 'pending'
                          }
                        >
                          {ROLE_LABELS[u.role as Role]}
                        </Badge>
                      </TableCell>
                      {currentUser.role === ROLES.SUPER_ADMIN && (
                        <TableCell className="text-muted-foreground">
                          {getMdaName(u.mdaId) || '\u2014'}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant={u.isActive ? 'info' : 'pending'}>
                          <span
                            className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-teal' : 'bg-[#6B7280]'}`}
                            aria-hidden="true"
                          />
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </TableCell>
                      <TableCell>
                        <UserActions
                          user={u}
                          currentUserRole={currentUser.role as Role}
                          onDeactivate={setDeactivateUser}
                          onReactivate={handleReactivate}
                          onDelete={setDeleteUserTarget}
                          onResetPassword={setResetPwUser}
                          onReassignMda={setReassignUser}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination controls */}
          {usersResponse && usersResponse.pagination.totalItems > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {sortedUsers.length} of {usersResponse.pagination.totalItems} users
              </p>
              {usersResponse.pagination.totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="min-h-[44px]"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {usersResponse.pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(usersResponse.pagination.totalPages, p + 1))}
                    disabled={currentPage >= usersResponse.pagination.totalPages}
                    className="min-h-[44px]"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <DeactivateDialog
        user={deactivateUser}
        open={!!deactivateUser}
        onOpenChange={(open) => !open && setDeactivateUser(null)}
      />
      <DeleteDialog
        user={deleteUserTarget}
        open={!!deleteUserTarget}
        onOpenChange={(open) => !open && setDeleteUserTarget(null)}
      />
      <ResetPasswordDialog
        user={resetPwUser}
        open={!!resetPwUser}
        onOpenChange={(open) => !open && setResetPwUser(null)}
      />
      <ReassignMdaDialog
        user={reassignUser}
        open={!!reassignUser}
        onOpenChange={(open) => !open && setReassignUser(null)}
        currentMdaName={reassignUser ? getMdaName(reassignUser.mdaId) : undefined}
      />
    </div>
  );
}

// ─── Action Menu ───────────────────────────────────────────

interface UserActionsProps {
  user: UserListItem;
  currentUserRole: Role;
  onDeactivate: (user: UserListItem) => void;
  onReactivate: (user: UserListItem) => void;
  onDelete: (user: UserListItem) => void;
  onResetPassword: (user: UserListItem) => void;
  onReassignMda: (user: UserListItem) => void;
}

function UserActions({
  user,
  currentUserRole,
  onDeactivate,
  onReactivate,
  onDelete,
  onResetPassword,
  onReassignMda,
}: UserActionsProps) {
  if (user.isSelf) return null;

  const isSuperAdmin = user.role === ROLES.SUPER_ADMIN;
  const canManage = canManageRole(currentUserRole, user.role as Role);

  if (isSuperAdmin) {
    return (
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
    );
  }

  if (!canManage) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
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
  );
}

export { AdminPage as Component };
export { AdminPage };
