# Story 1.9b: User Administration Interface, Profile Self-Service & First-Login Flow

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Generated: 2026-02-20 | Epic: 1 — Project Foundation & Secure Access | Sprint: 1 -->
<!-- Blocked By: 1.9a (API endpoints, email, role hierarchy), 1.6 (frontend auth shell, router, auth store, apiClient), 1.8a (design foundation, shared components, mock hooks), 1.8b (role-specific screens, DashboardLayout, Sidebar, AdminPage stub, routes) -->
<!-- Blocks: Nothing — last story in Epic 1 before retrospective -->
<!-- FRs: FR72 (user account lifecycle UI), FR73 (admin-initiated password reset UI), FR42 (password policy inline validation) -->
<!-- Epics Alignment: Epics spec uses single "Name" field in invite form. This story uses split "First Name"/"Last Name" to match existing DB schema and API contract (firstName/lastName established in Story 1.9a). -->

## Story

As a **Super Admin or Department Admin**,
I want a user management screen where I can view, create, and manage user accounts with clear visual indicators of account status and role hierarchy,
so that user administration is self-service, intuitive, and transparent.

## Acceptance Criteria (BDD)

### AC1: User Management Page — Super Admin View

```gherkin
Given a super_admin navigates to /admin/users
When the page renders
Then a table displays all non-deleted users with columns: Name, Email, Role (badge), MDA (if applicable), Status (Active/Deactivated badge), Last Login, Created Date
And the table supports: sorting by any column, filtering by role (dept_admin, mda_officer), filtering by status (Active, Deactivated), filtering by MDA, and text search on name/email
And super admin accounts are visible in the list but their action menus show only "View Details" — no deactivate/delete/reset actions (with a tooltip: "Super Admin accounts are managed via system administration")
And a prominent "Invite User" button is visible as the primary action (crimson)
```

### AC2: User Management Page — Department Admin View

```gherkin
Given a dept_admin navigates to /admin/users
When the page renders
Then only mda_officer accounts are listed (their manageable scope)
And no super_admin or dept_admin accounts are visible
And the "Invite User" button is visible with Role dropdown pre-limited to mda_officer
```

### AC3: Invite User Dialog

```gherkin
Given the "Invite User" button is clicked
When the create user dialog opens
Then it displays a form with: First Name (required), Last Name (required), Email (required, validated), Role (dropdown — options limited to what the acting user can create via getManageableRoles()), MDA (dropdown — required when Role is MDA Reporting Officer, hidden otherwise)
And a preview note states: "A welcome email with temporary login credentials will be sent to this address"
And submitting the form calls POST /api/users and shows a success toast: "Invitation sent to [email]"
And the user list refreshes to show the new account
And form validation uses createUserSchema from @vlprs/shared with react-hook-form + zodResolver
And validation fires on blur (not on keystroke), with inline amber (#D4A017) messages below each field
And input focus ring: 2px solid Deep Teal (#0D7377), default border #E2E8F0
And required fields show asterisk (*) after label — never rely on colour alone
And helper text below inputs in #64748B secondary text colour where applicable
And form layout: single-column on mobile (full-width inputs), optional two-column for name fields on desktop. Submit button full-width on mobile, right-aligned on desktop
```

### AC4: User Action Menu

```gherkin
Given a user row in the table
When the admin clicks the action menu (three-dot icon via DropdownMenu)
Then available actions are shown based on hierarchy and account state:
  Active account: "Reset Password", "Reassign MDA" (if mda_officer), "Deactivate", "Delete"
  Deactivated account: "Reactivate", "Delete"
And each destructive action (Deactivate, Delete) opens a confirmation dialog with the user's name and email displayed prominently
And super_admin rows show only "View Details" with tooltip "Super Admin accounts are managed via system administration"
And the acting user's own row (isSelf: true) shows no action menu (self-management denied)
```

### AC5: Deactivate Confirmation Dialog

```gherkin
Given the "Deactivate" action is selected
When the confirmation dialog opens (AlertDialog)
Then it shows: "Deactivate [Name]'s account? They will be logged out immediately and unable to sign in until reactivated."
And an optional "Reason" text field is available
And confirming calls POST /api/users/:id/deactivate and updates the table row's status badge to "Deactivated"
And the confirm button uses the default primary style (crimson) — NOT destructive red (deactivation is reversible)
```

### AC6: Delete Confirmation Dialog

```gherkin
Given the "Delete" action is selected
When the confirmation dialog opens (AlertDialog)
Then it shows: "Permanently remove [Name]'s account? This action cannot be undone. Type their email to confirm:"
And an email input field is displayed
And the confirm button is disabled until the typed email matches exactly
And the confirm button uses the destructive style (red #DC2626 — this IS a genuine irreversible action, appropriate use of red per UX spec)
And confirming calls DELETE /api/users/:id with { confirmEmail } and removes the row from the table
```

### AC7: Password Reset Confirmation

```gherkin
Given the "Reset Password" action is selected
When the confirmation dialog opens
Then it shows: "Send a temporary password to [email]? Their current sessions will be terminated."
And confirming calls POST /api/users/:id/reset-password and shows a success toast: "Password reset email sent to [email]"
```

### AC8: MDA Reassignment Dialog

```gherkin
Given the "Reassign MDA" action is selected for an mda_officer
When the dialog opens
Then it shows: current MDA assignment, a dropdown to select the new MDA (fetched from available MDAs), and a note: "The officer's data access will immediately switch to the new MDA"
And confirming calls PATCH /api/users/:id with { mdaId } and updates the MDA column in the table
```

### AC9: First-Login Password Change Screen

```gherkin
Given a user logs in with mustChangePassword = true (from LoginResponse)
When they are authenticated
Then instead of the normal dashboard, they see a full-screen "Set Your Password" form with: current temporary password field, new password field, confirm password field
And the new password is validated against FR42 rules (min 8 chars, 1 uppercase, 1 lowercase, 1 digit) with inline validation feedback
And the page cannot be navigated away from — sidebar and header show but all navigation links redirect back to this screen
And after successful password change via POST /api/auth/change-password, the user is redirected to their role-appropriate home screen with a welcome toast: "Password updated. Welcome to VLPRS."
```

### AC10: Profile Self-Service

```gherkin
Given any authenticated user clicks their name/avatar in the sidebar footer (desktop) or header (mobile)
When the profile dropdown opens
Then it shows: "My Profile" link, "Change Password" link, and "Logout"

Given a user navigates to /profile
When the page renders
Then it displays their account details as read-only fields: Full Name, Email, Role (badge), MDA assignment (if mda_officer), Account Created date, Last Login timestamp
And a "Change Password" button is visible
And role, email, and MDA fields show a subtle lock icon (Lock from lucide-react) with tooltip: "Contact your administrator to update"

Given the "Change Password" button is clicked
When the password change form opens (Dialog — DECIDED: Dialog chosen over inline for focus trapping, cleaner separation from profile form, and consistent modal pattern across story)
Then it shows: Current Password (required), New Password (required), Confirm New Password (required)
And the new password is validated inline against FR42 rules with real-time feedback as the user types
And submitting calls POST /api/auth/change-password (from Story 1.3)
And on success: toast "Password updated successfully", all other sessions terminated (Story 1.3 behaviour), user remains logged in
And on wrong current password: inline error "Current password is incorrect"
```

### AC11: Navigation Integration

```gherkin
Given the application sidebar
When a super_admin or dept_admin views navigation
Then a "User Management" item is visible in the sidebar (below Reports, above Logout — in an "Administration" section) (Enhancement: "Administration" section grouping approved as UX organizational improvement — not in original epic, but aligns with UX spec section 1254 collapsible sidebar sections)
And mda_officer users do NOT see this navigation item

Given any authenticated user
When they view the sidebar footer (desktop) or header (mobile)
Then their profile area shows: name, role badge, and (if mda_officer) their assigned MDA name
```

### AC12: Responsive Design

```gherkin
Given the user management page on mobile (<768px)
When the table renders
Then it uses a card layout (one user per card) instead of a horizontal table, with the action menu accessible via a button on each card
And all touch targets are >=44x44px
And dialogs render as full-screen sheets (Sheet component) on mobile
And the profile page stacks all fields in a single column
And mobile layouts tested at 375px viewport (iPhone SE) as minimum baseline per UX spec
```

### AC13: Visual Design Compliance

```gherkin
Given the user management interface
When any screen is rendered
Then it follows the client-approved visual design established in ux-design-directions.html:
  Oyo Crimson sidebar, neutral content area, status badges with colour + icon + text,
  button hierarchy (crimson primary, teal secondary, ghost tertiary, red destructive only for irreversible actions),
  Inter typography, and all component patterns (cards, tables, badges, dialogs) matching approved mockup styles
And account status badges use:
  Active → teal (#0D7377) dot + "Active" text
  Deactivated → grey (#6B7280) dot + "Deactivated" text
And role badges use the extended Badge component variants established in Story 1.8a
And table rows use 48px height, `#F8FAFC` alternating backgrounds, sticky headers on scroll, uppercase column headers, and hover row highlighting (per UX spec Data Display Patterns)
```

### AC14: Empty State

```gherkin
Given the user management page with no users matching filters
When the table has zero results
Then an empty state is shown: "No users found matching your filters" with a "Clear Filters" action
And if the table has zero total users (new system), show: "No users yet. Click 'Invite User' to get started." (Enhancement: First-use empty state approved as UX improvement beyond epic AC — aligns with UX spec section 1320-1323 "Empty Dashboard (First Use)" pattern)
```

### AC15: Accessibility (WCAG 2.1 AA)

```gherkin
Given Story 1.9b is implemented
When accessibility testing is performed
Then:
  axe-core returns 0 violations on all pages (AdminPage, ProfilePage, PasswordChangeScreen)
  Lighthouse accessibility score >= 95
  All flows completable via keyboard only (tab through table rows, open/close dialogs, submit forms)
  All icon-only elements have aria-label (action menu icons, lock icons, status dots)
  All form inputs have visible <label> elements linked via htmlFor
  Focus is trapped inside open Dialog/AlertDialog and returns to trigger element on close
  Colour contrast meets WCAG AA ratios (verified via Lighthouse/axe)
  Semantic HTML used first — ARIA only when native semantics are insufficient
```

### AC16: Tests

```gherkin
Given Story 1.9b is implemented
When I run pnpm test from the monorepo root
Then component tests pass for (including AC15 accessibility checks):
  - UserManagementPage renders table with user data
  - super_admin sees all manageable users + invite button
  - dept_admin sees only mda_officer accounts
  - mda_officer cannot access /admin/users (redirected by RoleGuard)
  - InviteUserDialog validates form fields and submits
  - Deactivate confirmation dialog flow
  - Delete confirmation requires email match to enable button
  - PasswordChangeScreen validates against FR42 rules
  - ProfilePage displays user details as read-only
  - ProfilePage change password form validates and submits
  - First-login redirect to password change screen
  - super_admin rows show restricted action menu
  - Empty state renders when no users match filters
  - Mobile card layout renders on small viewport
And all existing tests from Stories 1.1-1.9a continue to pass
```

## Tasks / Subtasks

- [ ] Task 1: Create TanStack Query hooks for user administration (AC: #1-#8, #14)
  - [ ] 1.1 Create `apps/client/src/hooks/useUserAdmin.ts`:
    ```typescript
    import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
    import { apiClient } from '@/lib/apiClient';
    import type { User, ApiResponse } from '@vlprs/shared';

    // Query: list users with filters
    export function useUsers(filters?: { role?: string; mdaId?: string; status?: string; search?: string; page?: number; pageSize?: number }) {
      return useQuery({
        queryKey: ['users', filters],
        queryFn: () => apiClient.get<PaginatedResponse<UserListItem>>('/api/users', { params: filters }),
      });
    }

    // Mutation: create user (invite)
    export function useCreateUser() {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (data: CreateUserInput) => apiClient.post<User>('/api/users', data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); },
      });
    }

    // Mutation: deactivate user
    export function useDeactivateUser() { ... }

    // Mutation: reactivate user
    export function useReactivateUser() { ... }

    // Mutation: delete user (soft)
    export function useDeleteUser() { ... }

    // Mutation: reassign MDA
    export function useReassignMda() { ... }

    // Mutation: reset password
    export function useResetPassword() { ... }

    // Usage example (AdminPage.tsx):
    // const { data, isPending, error } = useUsers(filters);
    // if (isPending) return <Skeleton />;
    // if (error) return <ErrorState />;
    ```
  - [ ] 1.2 Hook naming follows architecture rule 9: `use<Action><Entity>` for mutations, `use<Entity>` for queries
  - [ ] 1.3 All mutations invalidate `['users']` query key on success
  - [ ] 1.4 Use `isPending` (NOT `isLoading`) for loading states — TanStack Query v5
  - [ ] 1.5 Create `apps/client/src/hooks/useUserAdmin.test.ts` — test hook configurations
  - [ ] 1.6 Add `UserListItem` type extending `User` with `isSelf: boolean` and `lastLoginAt: string | null` to `packages/shared/src/types/auth.ts`

- [ ] Task 2: Create User Management Page (AC: #1, #2, #4, #13, #14)
  - [ ] 2.1 Replace the AdminPage stub at `apps/client/src/pages/dashboard/AdminPage.tsx` with the full user management implementation. Ensure file exports `export const Component = AdminPage;` for React Router v7 lazy route compatibility.
  - [ ] 2.2 Page structure:
    ```tsx
    // Header: "User Management" title + "Invite User" button (crimson primary)
    // Filters bar: Role dropdown, Status dropdown, MDA dropdown, Search input (debounced)
    // Table (desktop): columns per AC1, sortable headers, action menu per row
    // Card list (mobile <768px): one card per user with action button
    // Pagination: page controls using standard pagination envelope
    // Empty state: per AC14
    ```
  - [ ] 2.3 Use shadcn/ui `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `TableHead` for desktop
  - [ ] 2.4 Use `DropdownMenu` for action menus (three-dot icon via `MoreHorizontal` from lucide-react)
  - [ ] 2.5 Use `Badge` component with appropriate variants for role and status badges:
    - Role badges: `super_admin` → "Super Admin" (info variant), `dept_admin` → "Dept Admin" (review variant), `mda_officer` → "MDA Officer" (pending variant)
    - Status badges: Active → teal dot + text (info variant), Deactivated → grey dot + text (pending variant)
  - [ ] 2.6 Filter logic: Role and Status as `Select` dropdowns, MDA as `Select` (only show if super_admin), Search as `Input` with `useDebounce` (300ms)
  - [ ] 2.7 Sort state managed locally (URL search params preferred for shareability)
  - [ ] 2.8 `dept_admin` view: hide role filter (only mda_officer visible), hide super_admin/dept_admin rows
  - [ ] 2.9 Wrap page in `RoleGuard` allowing only `super_admin` and `dept_admin`
  - [ ] 2.10 Create `apps/client/src/pages/dashboard/AdminPage.test.tsx` — render tests for both role views, filter interactions, empty state

- [ ] Task 3: Create Invite User Dialog (AC: #3)
  - [ ] 3.1 Create `apps/client/src/pages/dashboard/components/InviteUserDialog.tsx`:
    ```tsx
    // Dialog (shadcn/ui) with form:
    // - firstName: Input (required)
    // - lastName: Input (required)
    // - email: Input (required, validated)
    // - role: Select (options from getManageableRoles(currentUser.role))
    // - mdaId: Select (shown only when role === 'mda_officer', required)
    // Preview note: "A welcome email with temporary login credentials will be sent to this address"
    // Submit button: "Send Invitation" (crimson primary)
    // Cancel button: ghost style
    ```
  - [ ] 3.2 Use `react-hook-form` with `zodResolver(createUserSchema)` from `@vlprs/shared`
  - [ ] 3.3 Validation fires on blur (`mode: 'onBlur'`), inline amber (#D4A017) error messages below each field
  - [ ] 3.4 On submit: call `useCreateUser()` mutation → on success: close dialog + show toast "Invitation sent to [email]"
  - [ ] 3.5 On API error: display error message in dialog (e.g., 409 "Email already registered")
  - [ ] 3.6 Fetch MDA list for dropdown: create `useMdas()` hook in `useUserAdmin.ts` querying `GET /api/mdas` (or inline the existing MDAs data)
  - [ ] 3.7 On mobile: render as `Sheet` (full-screen bottom sheet) instead of centred `Dialog`
  - [ ] 3.8 Create `InviteUserDialog.test.tsx` — test form validation, submit flow, role-based options

- [ ] Task 4: Create Confirmation Dialogs (AC: #5, #6, #7, #8)
  - [ ] 4.1 Create `apps/client/src/pages/dashboard/components/DeactivateDialog.tsx`:
    - Uses `AlertDialog` from shadcn/ui
    - Shows user name and email prominently
    - Optional "Reason" textarea
    - Confirm button: crimson primary (NOT destructive red — deactivation is reversible)
    - Calls `useDeactivateUser()` mutation
  - [ ] 4.2 Create `apps/client/src/pages/dashboard/components/DeleteDialog.tsx`:
    - Uses `AlertDialog` from shadcn/ui
    - Shows user name and email, warning text: "This action cannot be undone"
    - Email confirmation input — confirm button disabled until match
    - Confirm button: destructive red (#DC2626) — this IS irreversible, appropriate red usage
    - Calls `useDeleteUser()` mutation with `{ confirmEmail }`
  - [ ] 4.3 Create `apps/client/src/pages/dashboard/components/ResetPasswordDialog.tsx`:
    - "Send a temporary password to [email]? Their current sessions will be terminated."
    - Confirm button: crimson primary
    - Calls `useResetPassword()` mutation
    - Success toast: "Password reset email sent to [email]"
  - [ ] 4.4 Create `apps/client/src/pages/dashboard/components/ReassignMdaDialog.tsx`:
    - Shows current MDA assignment
    - `Select` dropdown for new MDA (fetched from `useMdas()`)
    - Note: "The officer's data access will immediately switch to the new MDA"
    - Calls `useReassignMda()` mutation
  - [ ] 4.5 All dialogs: show `isPending` spinner on confirm button during mutation
  - [ ] 4.6 All dialogs: render as full-screen `Sheet` on mobile (<768px)
  - [ ] 4.7 Create test files for each dialog — test renders, interactions, mutation calls

- [ ] Task 5: Create First-Login Password Change Screen (AC: #9)
  - [ ] 5.1 Create `apps/client/src/pages/dashboard/PasswordChangeScreen.tsx`:
    ```tsx
    // Full-screen overlay within DashboardLayout
    // Form: Current Password, New Password, Confirm New Password
    // Inline validation against FR42: min 8 chars, 1 uppercase, 1 lowercase, 1 digit
    // Show password strength indicator as user types
    // Submit calls POST /api/auth/change-password
    // On success: update auth store (mustChangePassword = false), redirect to role home, toast "Password updated. Welcome to VLPRS."
    ```
  - [ ] 5.2 Create Zod schema for password change form in `packages/shared/src/validators/userSchemas.ts` (or reuse existing `changePasswordSchema` if created by Story 1.3):
    ```typescript
    export const changePasswordFormSchema = z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Must contain at least one digit'),
      confirmPassword: z.string(),
    }).refine(data => data.newPassword === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    });
    ```
  - [ ] 5.3 Intercept at `DashboardLayout` level: if `authStore.user.mustChangePassword === true`, render `PasswordChangeScreen` instead of `<Outlet />`
  - [ ] 5.4 Sidebar and header remain visible but all nav links redirect back to password change (use `useEffect` + `useNavigate` to intercept)
  - [ ] 5.5 After successful change: update auth store user object, use `ROLE_HOME_ROUTES[user.role]` for redirect
  - [ ] 5.6 Create `PasswordChangeScreen.test.tsx` — test form validation, submit, redirect, navigation interception

- [ ] Task 6: Create Profile Page (AC: #10)
  - [ ] 6.1 Create `apps/client/src/pages/dashboard/ProfilePage.tsx` (ensure `export const Component = ProfilePage;` for React Router v7 lazy route compatibility):
    ```tsx
    // Read-only card with user details:
    // - Full Name (text)
    // - Email (text + lock icon)
    // - Role (Badge component + lock icon)
    // - MDA (text + lock icon, shown only for mda_officer)
    // - Account Created (formatted date via formatDate())
    // - Last Login (formatted datetime via formatDateTime())
    // "Change Password" button (teal secondary)
    // Lock icons: import { Lock } from 'lucide-react';
    // Usage: <Lock size={16} className="text-muted-foreground" /> with Tooltip: "Contact your administrator to update"
    ```
  - [ ] 6.2 Create `apps/client/src/pages/dashboard/components/ChangePasswordDialog.tsx`:
    - Reuses `changePasswordFormSchema` from Task 5
    - Dialog with: Current Password, New Password, Confirm Password
    - Inline FR42 validation with real-time feedback
    - On success: toast "Password updated successfully"
    - On wrong current password: inline error "Current password is incorrect" (from API 401)
    - Calls `POST /api/auth/change-password` via `useChangePassword()` hook
  - [ ] 6.3 Add `useChangePassword()` mutation hook to `apps/client/src/hooks/useAuth.ts` (or `useUserAdmin.ts`):
    ```typescript
    export function useChangePassword() {
      return useMutation({
        mutationFn: (data: { currentPassword: string; newPassword: string }) =>
          apiClient.post('/api/auth/change-password', data),
      });
    }
    ```
  - [ ] 6.4 User data sourced from auth store (Zustand) — no additional API call needed
  - [ ] 6.5 Create `ProfilePage.test.tsx` — test read-only display, change password dialog, API error handling

- [ ] Task 7: Add route and navigation integration (AC: #11)
  - [ ] 7.1 Add route to `apps/client/src/router.tsx`:
    ```typescript
    { path: 'profile', lazy: () => import('./pages/dashboard/ProfilePage') },
    // AdminPage route should already exist from Story 1.8b at:
    // { path: 'admin', lazy: () => import('./pages/dashboard/AdminPage') },
    ```
  - [ ] 7.2 Update sidebar navigation in `apps/client/src/components/layout/Sidebar.tsx` (or wherever `NAV_ITEMS` is defined):
    - Add "Administration" section with "User Management" item for `super_admin` and `dept_admin`
    - Use `Users` icon from lucide-react
    - Path: `/dashboard/admin`
    - `mda_officer` must NOT see this item
  - [ ] 7.3 Update sidebar footer / user profile area:
    - Show user's name, role badge, and MDA name (if mda_officer)
    - Add dropdown/popover with: "My Profile" → `/dashboard/profile`, "Change Password" (opens dialog or navigates), "Logout"
  - [ ] 7.4 Ensure `/dashboard/admin` is protected by `RoleGuard` allowing only `super_admin` and `dept_admin`
  - [ ] 7.5 Ensure `mda_officer` navigating to `/dashboard/admin` is redirected to their home route

- [ ] Task 8: Create mobile-responsive layouts (AC: #12)
  - [ ] 8.1 User management table: use a `useMediaQuery` hook or Tailwind responsive classes
    - Desktop (>=768px): standard `Table` component with all columns
    - Mobile (<768px): `Card` layout — one card per user with name, email, role badge, status badge, and action button
  - [ ] 8.2 All confirmation dialogs: render as `Sheet` (bottom sheet, full-screen) on mobile, `AlertDialog` (centred overlay) on desktop
  - [ ] 8.3 Invite User form: single-column stack on mobile, optional two-column for name fields on desktop
  - [ ] 8.4 Touch targets: all interactive elements >=44x44px on mobile
  - [ ] 8.5 Profile page: single-column card stack on all screen sizes
  - [ ] 8.6 Create or reuse `useMediaQuery` hook in `apps/client/src/hooks/useMediaQuery.ts`:
    ```typescript
    export function useMediaQuery(query: string): boolean {
      const [matches, setMatches] = useState(false);
      useEffect(() => {
        const mql = window.matchMedia(query);
        setMatches(mql.matches);
        const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
      }, [query]);
      return matches;
    }
    export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
    ```

- [ ] Task 9: Install required shadcn/ui components (AC: #1-#14)
  - [ ] 9.1 Check which shadcn/ui components are already installed (from Stories 1.6/1.8a/1.8b)
  - [ ] 9.2 Install any missing components needed for this story:
    ```bash
    npx shadcn add dialog alert-dialog dropdown-menu select table input badge sheet skeleton tooltip command separator
    ```
    Note: Some of these may already exist from prerequisite stories. Only install what's missing.
  - [ ] 9.3 Install `react-hook-form` and `@hookform/resolvers` if not already installed (from Story 1.6):
    ```bash
    pnpm --filter client add react-hook-form @hookform/resolvers
    ```
  - [ ] 9.4 Verify all imports resolve and `pnpm typecheck` passes

- [ ] Task 10: Create user admin types and exports (AC: #1-#3)
  - [ ] 10.1 Add to `packages/shared/src/types/auth.ts` (if not already done by 1.9a):
    ```typescript
    export interface UserListItem extends User {
      isSelf: boolean;
      lastLoginAt: string | null;
    }

    export interface PaginatedResponse<T> {
      data: T[];
      pagination: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
      };
    }
    ```
  - [ ] 10.2 Add user admin vocabulary for frontend-specific messages to `packages/shared/src/constants/vocabulary.ts`:
    ```typescript
    // User Administration UI (Story 1.9b)
    INVITE_USER: 'Invite User',
    INVITATION_SENT_TO: 'Invitation sent to',
    PASSWORD_RESET_SENT_TO: 'Password reset email sent to',
    DEACTIVATE_CONFIRM: 'Deactivate {name}\'s account? They will be logged out immediately and unable to sign in until reactivated.',
    DELETE_CONFIRM: 'Permanently remove {name}\'s account? This action cannot be undone.',
    DELETE_TYPE_EMAIL: 'Type their email to confirm:',
    RESET_PASSWORD_CONFIRM: 'Send a temporary password to {email}? Their current sessions will be terminated.',
    REASSIGN_MDA_NOTE: 'The officer\'s data access will immediately switch to the new MDA.',
    SUPER_ADMIN_TOOLTIP: 'Super Admin accounts are managed via system administration',
    ADMIN_FIELD_LOCKED: 'Contact your administrator to update',
    NO_USERS_MATCHING: 'No users found matching your filters',
    NO_USERS_YET: 'No users yet. Click \'Invite User\' to get started.',
    PASSWORD_UPDATED_WELCOME: 'Password updated. Welcome to VLPRS.',
    PASSWORD_UPDATED: 'Password updated successfully',
    ```
  - [ ] 10.3 Export new types from `packages/shared/src/index.ts`
  - [ ] 10.4 Export `changePasswordFormSchema` from shared if created in Task 5

- [ ] Task 11: Create mock data for development (AC: #1, #2)
  - [ ] 11.1 Create `apps/client/src/mocks/users.ts` — mock user list data following mock-first pattern:
    ```typescript
    export const mockUsers: UserListItem[] = [
      { id: '...', firstName: 'Adebayo', lastName: 'Ogunlesi', email: 'ag@vlprs.oyo.gov.ng', role: 'super_admin', mdaId: null, isActive: true, mustChangePassword: false, createdAt: '2026-01-15T09:00:00Z', isSelf: false, lastLoginAt: '2026-02-20T08:30:00Z' },
      { id: '...', firstName: 'Chidinma', lastName: 'Okafor', email: 'dept.admin@vlprs.oyo.gov.ng', role: 'dept_admin', mdaId: null, isActive: true, mustChangePassword: false, createdAt: '2026-01-16T10:00:00Z', isSelf: false, lastLoginAt: '2026-02-19T14:00:00Z' },
      // ... 3-5 mda_officer accounts with varied statuses
    ];

    export const mockMdas = [
      { id: '...', name: 'Ministry of Agriculture', code: 'MOA' },
      { id: '...', name: 'Ministry of Education', code: 'MOE' },
      // ... 3-5 MDAs
    ];
    ```
  - [ ] 11.2 `useUsers()` hook initially returns mock data, swap `queryFn` to real API call when backend is wired
  - [ ] 11.3 This follows the exact mock-first pattern established by Story 1.8a

- [ ] Task 12: Verify all tests pass (AC: #15, #16)
  - [ ] 12.1 Run `pnpm --filter shared build` — types compile
  - [ ] 12.2 Run `pnpm test` from monorepo root — all workspaces pass
  - [ ] 12.3 Run `pnpm typecheck` — no type errors
  - [ ] 12.4 Run `pnpm lint` — no lint errors
  - [ ] 12.5 Verify all existing tests from Stories 1.1-1.9a continue to pass (no regressions)
  - [ ] 12.6 Accessibility verification: axe-core scan returns 0 violations on AdminPage, ProfilePage, PasswordChangeScreen
  - [ ] 12.7 Accessibility verification: all flows completable via keyboard only (tab navigation, dialog interactions, form submission)
  - [ ] 12.8 Accessibility verification: all icon-only elements have `aria-label`, all form inputs have `htmlFor`-linked labels

## Dev Notes

### Critical Context — What This Story Establishes

This is **Story 9b of 58** — the **user administration frontend**. When complete, Super Admins and Department Admins can manage user accounts through a self-service UI. This is the **companion** to Story 1.9a (API) — together they deliver the Sprint 1 demonstrability milestone:

> User invitation system operational — AG can create dept admin and MDA officer accounts via UI with welcome emails. AG can open dashboard on her phone.

**This is a frontend-heavy story.** All API endpoints already exist from Story 1.9a. This story consumes them.

### Dependency Status

| Dependency | Status | What This Story Needs From It |
|---|---|---|
| Story 1.1 (scaffold) | done | Monorepo, shared package, design tokens |
| Story 1.2 (auth) | done | User type, login/register, sanitiseUser() |
| Story 1.3 (session security) | review | change-password endpoint, token revocation |
| Story 1.4 (RBAC) | **review** | authorise() middleware, permission matrix, RoleGuard |
| Story 1.5 (audit logging) | ready-for-dev | Audit log middleware (API-level — no frontend concern) |
| Story 1.6 (frontend auth shell) | **ready-for-dev** | Router, AuthGuard, DashboardLayout, Sidebar, apiClient, auth store, LoginPage |
| Story 1.8a (design foundation) | **ready-for-dev** | Shared components, Badge variants, formatters, design tokens, mock hooks |
| Story 1.8b (role-specific screens) | **ready-for-dev** | AdminPage stub, role-specific routes, NAV_ITEMS, DashboardLayout with Sidebar, ROLE_HOME_ROUTES |
| Story 1.9a (account lifecycle API) | **ready-for-dev** | All 7 user admin API endpoints, createUserSchema, role hierarchy utilities, vocabulary constants, mustChangePassword flow, email service |

**IMPORTANT:** Stories 1.6, 1.8a, 1.8b, and 1.9a MUST be implemented before this story. The frontend currently has only a bare scaffold — no router, no auth store, no apiClient, no layout components, no TanStack Query. If starting before 1.6 is complete, use mock data and placeholder hooks (same mock-first pattern) but expect significant wiring work.

### What Already Exists (Reuse, Don't Reinvent)

| Component | Location | Reuse For |
|---|---|---|
| `cn()` utility | `apps/client/src/lib/utils.ts` | All className composition |
| `Button` component | `apps/client/src/components/ui/Button.tsx` | Crimson primary, teal secondary, ghost, destructive |
| Design tokens | `apps/client/src/styles/globals.css` | All colours, typography, spacing |
| `ROLES`, `ALL_ROLES`, `Role` | `packages/shared/src/constants/roles.ts` | Role checks in UI |
| `ROLE_HIERARCHY`, `canManageRole()`, `getManageableRoles()` | `packages/shared/src/constants/roles.ts` | Action menu visibility, invite form role options |
| `VOCABULARY` | `packages/shared/src/constants/vocabulary.ts` | All user-facing messages |
| `hasPermission()` | `packages/shared/src/constants/permissions.ts` | Permission checks |
| `createUserSchema`, `updateUserSchema`, `deactivateUserSchema`, `deleteUserSchema` | `packages/shared/src/validators/userSchemas.ts` | Form validation with zodResolver |
| `User`, `UserListItem`, `LoginResponse` | `packages/shared/src/types/auth.ts` | TypeScript types |
| `ApiResponse<T>`, `ApiError` | `packages/shared/src/types/api.ts` | API response typing |
| `AuthGuard` | `apps/client/src/components/layout/AuthGuard.tsx` | Route protection |
| `RoleGuard` | `apps/client/src/components/layout/RoleGuard.tsx` | Admin-only route protection |
| `DashboardLayout` | `apps/client/src/components/layout/DashboardLayout.tsx` | Page layout wrapper |
| `Sidebar` | `apps/client/src/components/layout/Sidebar.tsx` | Navigation integration |
| `apiClient` | `apps/client/src/lib/apiClient.ts` | API calls with JWT + CSRF |
| `authContext` / auth store | `apps/client/src/lib/authContext.tsx` | Current user, role, mustChangePassword |
| `formatDate()`, `formatDateTime()` | `apps/client/src/lib/formatters.ts` | Date display formatting |
| `useDebounce` | `apps/client/src/hooks/useDebounce.ts` | Search input debouncing |
| Badge variants | `apps/client/src/components/ui/badge.tsx` | Role and status badges |
| `ROLE_HOME_ROUTES` | `apps/client/src/router.tsx` (or constants) | Post-password-change redirect |
| shadcn/ui components | `apps/client/src/components/ui/` | Dialog, AlertDialog, Table, Input, Select, Sheet, etc. |

### What NOT To Do

1. **DO NOT hardcode role strings** — Import `ROLES` from `@vlprs/shared`. OSLRS lesson: frontend/backend role string mismatch caused 3 roles to fail despite 53 passing tests.
2. **DO NOT use `isLoading`** — Use `isPending` (TanStack Query v5). `isLoading` is deprecated and maps to `isPending && isFetching`.
3. **DO NOT use `cacheTime`** — Use `gcTime` (TanStack Query v5 rename).
4. **DO NOT use `onSuccess`/`onError` on `useQuery`** — Removed in TanStack Query v5. Only available on `useMutation`.
5. **DO NOT store server data in Zustand** — All API data in TanStack Query cache. Zustand only for UI state (sidebar toggle, modal visibility, filter selections).
6. **DO NOT use red (#DC2626) for anything except irreversible destructive actions** — Delete button only. Deactivate uses crimson primary (reversible action). Status badges use teal/grey. NEVER red for data variance.
7. **DO NOT use warning triangles** — Use info circle (`Info` from lucide-react) for attention items.
8. **DO NOT use crimson in data content areas** — Crimson is for sidebar, header, primary buttons only. Content area uses neutral colours.
9. **DO NOT create a separate `__tests__` directory** — Tests co-located next to source files.
10. **DO NOT use `react-router-dom`** — Import from `react-router` (single package in v7).
11. **DO NOT create `tailwind.config.js`** — Tailwind CSS v4 uses CSS-first config (`@theme` in `globals.css`).
12. **DO NOT validate on keystroke** — Validate on blur (`mode: 'onBlur'` in react-hook-form). Exception: password strength indicator can update in real-time.
13. **DO NOT create backend API endpoints** — That's Story 1.9a. This story only consumes existing API.
14. **DO NOT modify shared components from Story 1.8a** — `HeroMetricCard`, `NairaDisplay`, `AttentionItemCard`, etc. are stable.
15. **DO NOT modify mock data hooks from Story 1.8a** — `useDashboardMetrics()`, `useMdaComplianceGrid()`, etc. are stable.
16. **DO NOT use floating-point for financial amounts** — Always string type.

### API Endpoints Consumed

| Method | Path | Body / Query | Purpose | Hook |
|---|---|---|---|---|
| `GET` | `/api/users` | `?role&mdaId&status&page&pageSize&search` | List users (role-scoped) | `useUsers()` |
| `POST` | `/api/users` | `{ email, firstName, lastName, role, mdaId? }` | Create user + invitation | `useCreateUser()` |
| `POST` | `/api/users/:id/deactivate` | `{ reason? }` | Deactivate account | `useDeactivateUser()` |
| `POST` | `/api/users/:id/reactivate` | — | Reactivate account | `useReactivateUser()` |
| `DELETE` | `/api/users/:id` | `{ confirmEmail }` | Soft delete account | `useDeleteUser()` |
| `PATCH` | `/api/users/:id` | `{ mdaId }` | Reassign MDA | `useReassignMda()` |
| `POST` | `/api/users/:id/reset-password` | — | Reset password + email | `useResetPassword()` |
| `POST` | `/api/auth/change-password` | `{ currentPassword, newPassword }` | Self-service password change | `useChangePassword()` |

**All responses follow the standard envelope:**
```typescript
// Success: { success: true, data: { ... } }
// Paginated: { success: true, data: [...], pagination: { page, pageSize, totalItems, totalPages } }
// Error: { success: false, error: { code, message, details? } }
```

**CSRF:** The `apiClient` must include the `X-CSRF-Token` header (read from `__csrf` cookie) on all POST/PATCH/DELETE mutations. This should already be implemented by Story 1.6's apiClient.

### Downward-Only Hierarchy — UI Decision Matrix

| Acting Role | super_admin rows | dept_admin rows | mda_officer rows |
|---|---|---|---|
| super_admin | "View Details" only (tooltip: CLI-managed) | Full actions | Full actions + Reassign MDA |
| dept_admin | NOT VISIBLE | NOT VISIBLE | Full actions + Reassign MDA |

**Self rows (isSelf: true):** No action menu shown for any role.

### Account Status Badge Mapping

| State | Badge Variant | Colour | Icon | Text |
|---|---|---|---|---|
| Active | info | Teal `#0D7377` | Dot | "Active" |
| Deactivated | pending | Grey `#6B7280` | Dot | "Deactivated" |

### Component File Structure — What This Story Creates

```
apps/client/src/
├── hooks/
│   ├── useUserAdmin.ts                    # NEW — TanStack Query hooks for user CRUD
│   ├── useUserAdmin.test.ts               # NEW
│   ├── useMediaQuery.ts                   # NEW — responsive breakpoint hook
│   └── useAuth.ts                         # MODIFY — add useChangePassword() mutation
│
├── pages/
│   └── dashboard/
│       ├── AdminPage.tsx                  # REPLACE stub — full user management page
│       ├── AdminPage.test.tsx             # NEW
│       ├── ProfilePage.tsx                # NEW — self-service profile
│       ├── ProfilePage.test.tsx           # NEW
│       ├── PasswordChangeScreen.tsx       # NEW — first-login forced password change
│       ├── PasswordChangeScreen.test.tsx  # NEW
│       └── components/
│           ├── InviteUserDialog.tsx        # NEW
│           ├── InviteUserDialog.test.tsx   # NEW
│           ├── DeactivateDialog.tsx        # NEW
│           ├── DeleteDialog.tsx            # NEW
│           ├── ResetPasswordDialog.tsx     # NEW
│           ├── ReassignMdaDialog.tsx       # NEW
│           ├── ChangePasswordDialog.tsx    # NEW — profile password change
│           └── UserCard.tsx               # NEW — mobile card layout for user row
│
├── mocks/
│   └── users.ts                           # NEW — mock user list + MDAs
│
├── components/
│   └── layout/
│       ├── Sidebar.tsx                    # MODIFY — add "User Management" nav item for admins
│       └── DashboardLayout.tsx            # MODIFY — add mustChangePassword intercept
│
└── router.tsx                             # MODIFY — add /profile route

packages/shared/src/
├── types/
│   └── auth.ts                            # MODIFY — add UserListItem, PaginatedResponse (if not in 1.9a)
├── constants/
│   └── vocabulary.ts                      # MODIFY — add frontend-specific user admin vocabulary
├── validators/
│   └── userSchemas.ts                     # MODIFY — add changePasswordFormSchema
└── index.ts                               # MODIFY — export new types and schemas
```

**Files this story MUST NOT modify:**

```
apps/server/**                              # No backend changes (Story 1.9a handles API)
apps/client/src/components/shared/         # Shared components from Story 1.8a — stable
apps/client/src/hooks/useDashboard*.ts     # Mock data hooks from Story 1.8a — stable
apps/client/src/hooks/useMda*.ts           # Mock data hooks from Story 1.8a — stable
apps/client/src/hooks/useLoan*.ts          # Mock data hooks from Story 1.8a — stable
apps/client/src/hooks/useSubmission*.ts    # Mock data hooks from Story 1.8a — stable
apps/client/src/hooks/useException*.ts     # Mock data hooks from Story 1.8a — stable
apps/client/src/hooks/useMigration*.ts     # Mock data hooks from Story 1.8a — stable
apps/client/src/mocks/dashboard*.ts        # Mock data from Story 1.8a — stable
apps/client/src/mocks/mda*.ts              # Mock data from Story 1.8a — stable
packages/shared/src/constants/roles.ts     # Role hierarchy from Story 1.9a — stable
packages/shared/src/validators/authSchemas.ts  # Auth schemas — stable
```

### Previous Story Intelligence

**From Story 1.9a (account lifecycle API — ready-for-dev):**
1. All 7 user admin endpoints defined with exact paths, bodies, and response formats
2. `createUserSchema` validates: email, firstName, lastName, role (enum: dept_admin/mda_officer), mdaId (uuid, nullable/optional)
3. `getManageableRoles(actingRole)` returns array of roles the actor can create — use for Invite dialog role dropdown
4. `canManageRole(actingRole, targetRole)` returns boolean — use for action menu visibility
5. User listing returns `isSelf: true` on the acting user's own record — hide action menu for self
6. Error codes match VOCABULARY keys: `HIERARCHY_INSUFFICIENT`, `SELF_MANAGEMENT_DENIED`, `SUPER_ADMIN_CLI_ONLY`, etc.
7. `mustChangePassword` added to JWT claims and LoginResponse
8. Email is fire-and-forget on backend — UI always shows success toast regardless of email delivery

**From Story 1.8a (design foundation — ready-for-dev):**
1. Badge component extended with variants: `review`, `info`, `complete`, `pending`, `variance`
2. Design tokens defined in `globals.css` via `@theme` directive — use `var(--color-*)` or Tailwind classes
3. `cn()` utility for className composition
4. Formatters: `formatDate()`, `formatDateTime()`, `formatNaira()`, `formatCount()`
5. Mock-first hook pattern: import mock data → return via TanStack Query hook → swap `queryFn` when API ready

**From Story 1.8b (role-specific screens — ready-for-dev):**
1. `AdminPage.tsx` exists as a stub at `/dashboard/admin` route — replace with real implementation
2. `NAV_ITEMS` object in Sidebar maps roles to navigation items — add "User Management" entry
3. `ROLE_HOME_ROUTES` maps roles to home paths — use for post-password-change redirect
4. `DashboardLayout` wraps all protected routes with Sidebar + Header + Outlet — modify to intercept `mustChangePassword`
5. shadcn/ui `Sidebar` component used with collapsible sections

**From Story 1.6 (frontend auth shell — ready-for-dev):**
1. `apiClient` handles JWT attachment, 401 → refresh → retry, CSRF token inclusion
2. Auth store (Zustand) manages: `user`, `accessToken`, `login()`, `logout()`, `setUser()`
3. `AuthGuard` redirects unauthenticated users to `/login`
4. `RoleGuard` redirects insufficient-role users to `/dashboard`
5. React Router v7 with lazy routes

### Architecture Compliance

**Frontend Stack (confirmed versions):**
| Technology | Version | Key Pattern |
|---|---|---|
| React | 18.3.x | NOT React 19 (known bugs) |
| React Router | 7.x | Single package `react-router`, lazy routes |
| TanStack Query | v5 | `isPending` not `isLoading`, `gcTime` not `cacheTime`, no `onSuccess` on queries |
| Zustand | v5 | Curried `create<T>()((set) => ...)`, UI state only |
| shadcn/ui | Latest | `npx shadcn add <component>`, Tailwind v4 compatible |
| React Hook Form | 7.x | `@hookform/resolvers >= 5.0.0` for Zod v4 |
| Tailwind CSS | v4 | CSS-first config, `@theme` directive, no JS config |
| Lucide React | Latest | Named imports, tree-shakable |
| Zod | v4 | `import { z } from 'zod/v4'` — NOT Zod v3 |

**Component Naming:**
- Pages: `PascalCase` + `Page` suffix in `pages/dashboard/`
- Page components: `PascalCase.tsx` in `pages/dashboard/components/`
- Shared components: `PascalCase.tsx` in `components/shared/`
- Layout components: `PascalCase.tsx` in `components/layout/`
- shadcn/ui: `lowercase.tsx` in `components/ui/` (auto-generated convention)
- Hooks: `camelCase.ts` with `use` prefix in `hooks/`
- Tests: co-located, `*.test.tsx` next to source

**Data Flow:**
```
API → apiClient (JWT + CSRF) → TanStack Query hook → React component → shadcn/ui → formatters
```

**State Management:**
- Server state: TanStack Query cache ONLY — never Zustand
- UI state: Zustand — sidebar toggle, modal visibility, active filters
- Auth state: Zustand auth store — user, accessToken (memory only, NEVER localStorage)

**Form Validation:**
```
Zod schema (packages/shared) → zodResolver → react-hook-form → inline error messages (amber #D4A017)
```

**Error Handling:**
```
API error → TanStack Query onError → shadcn Toast (non-punitive language from VOCABULARY)
401 → apiClient interceptor → silent refresh → retry → if still 401 → redirect to /login
```

**Loading States:**
```
Initial load → shadcn Skeleton components
Background refetch → subtle spinner overlay (data still visible)
Mutation pending → spinner on submit button, button disabled
NEVER: blank white screen during loading
```

### UX Design Reference

All screens must follow the canonical visual reference: `_bmad-output/planning-artifacts/ux-design-directions.html`

**Key UX rules for this story:**
- Tables: 48px comfortable rows, `#F8FAFC` alternating background, sticky header, uppercase header text, hover highlight
- Forms: label always above input, 16px min font, teal focus ring, validate on blur, amber validation messages, helper text in `#64748B`
- Dialogs: centred overlay with backdrop blur, clear title, concise description, two buttons (cancel ghost + action primary/destructive)
- Destructive actions: always behind AlertDialog, two-step confirmation, red ONLY for irreversible (Delete), crimson for reversible (Deactivate)
- Status indicators: colour + icon + text — NEVER colour alone
- Empty states: contextual message + action suggestion, never blank table
- Mobile: card layout for tables, full-screen sheets for dialogs, >=44px touch targets
- Chrome vs content: crimson in sidebar/header/buttons, neutral in data content area
- Non-punitive language: "Deactivated" (neutral), no "Disabled" or "Suspended"

### Scope Boundaries

**Explicitly IN scope:**
- User management page with table, filtering, sorting, pagination
- Invite user dialog with form validation
- Action menus with role-hierarchy-scoped options
- Confirmation dialogs (deactivate, delete, reset password, MDA reassign)
- First-login password change screen
- Profile self-service page with password change
- Navigation integration ("User Management" sidebar item)
- Mobile-responsive layouts (card view, bottom sheets)
- Mock data for development
- TanStack Query hooks for all user admin operations
- Component and integration tests

**Explicitly NOT in scope (already in Story 1.9a):**
- Backend API endpoints
- Email service (Resend integration)
- CLI commands
- Database schema changes
- Role hierarchy utility functions
- Validation schemas (except `changePasswordFormSchema`)

**Explicitly NOT in scope (later stories/phases):**
- Audit log viewing UI (later epic)
- Email notification preferences UI (Epic 9)
- MFA setup UI (Phase 2)
- User activity/login history table (Phase 2)
- Bulk user operations (Phase 2)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.9b: User Administration Interface, Profile Self-Service & First-Login Flow]
- [Source: _bmad-output/planning-artifacts/epics.md#FR72 — User account lifecycle]
- [Source: _bmad-output/planning-artifacts/epics.md#FR73 — Admin-initiated password reset]
- [Source: _bmad-output/planning-artifacts/epics.md#FR42 — Password policy]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture — React 18, TanStack Query v5, Zustand, React Router v7]
- [Source: _bmad-output/planning-artifacts/architecture.md#Component Organization — pages, components, hooks, layout]
- [Source: _bmad-output/planning-artifacts/architecture.md#Code Naming — PascalCase components, camelCase hooks, Page suffix]
- [Source: _bmad-output/planning-artifacts/architecture.md#TanStack Query Key Convention — queryKey: ['users', filters]]
- [Source: _bmad-output/planning-artifacts/architecture.md#Zustand Store Convention — UI state only]
- [Source: _bmad-output/planning-artifacts/architecture.md#Forms — react-hook-form + zodResolver + Zod schemas from shared]
- [Source: _bmad-output/planning-artifacts/architecture.md#Error Handling — Toast notifications, non-punitive language]
- [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement Rules — ROLES import, isPending, co-located tests]
- [Source: _bmad-output/planning-artifacts/architecture.md#AdminPage.tsx — FR42-48, FR72-73]
- [Source: _bmad-output/planning-artifacts/architecture.md#useUserAdmin.ts — TanStack Query hooks for user management]
- [Source: _bmad-output/planning-artifacts/architecture.md#Responsive breakpoints — Mobile <768px, Tablet 768-1024px, Desktop >1024px]
- [Source: _bmad-output/planning-artifacts/prd.md#FR72 — Account lifecycle full definition]
- [Source: _bmad-output/planning-artifacts/prd.md#FR73 — Password reset full definition]
- [Source: _bmad-output/planning-artifacts/prd.md#FR42 — Password policy (min 8, 1 upper, 1 lower, 1 digit)]
- [Source: _bmad-output/planning-artifacts/prd.md#Journey 4 — Dept Admin user management scenario (Mr. Okonkwo)]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR — Accessibility WCAG 2.1 AA, 44px touch targets, colour independence]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR — Performance FCP <1.5s, LCP <3s, dashboard route <150KB gzipped]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Table patterns — 48px rows, sortable, sticky header]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Form patterns — label above, 16px min, teal focus, validate on blur]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Status indicators — colour + icon + text, never colour alone]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Non-punitive language — neutral terminology for account states]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Button hierarchy — crimson primary, teal secondary, ghost tertiary, red destructive]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Modal patterns — AlertDialog for confirmations, escape to dismiss]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#New screens follow same design language]
- [Source: _bmad-output/implementation-artifacts/1-9a-user-account-lifecycle-api-email-invitation.md — API endpoints, schemas, hierarchy matrix]
- [Source: _bmad-output/implementation-artifacts/1-8a-design-foundation-components-mock-data-layer.md — Badge variants, formatters, mock-first pattern]
- [Source: _bmad-output/implementation-artifacts/1-8b-role-specific-screens-demo-seed-wiring-map.md — AdminPage stub, NAV_ITEMS, ROLE_HOME_ROUTES, DashboardLayout]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
