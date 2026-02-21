# Story 1.6: Frontend Authentication Shell

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Generated: 2026-02-19 | Epic: 1 — Project Foundation & Secure Access | Sprint: 1 -->
<!-- Blocks: 1.7 (CI/CD), 1.8a (Design Foundation), 1.8b (Role-Specific Screens), ALL frontend Epics 2-13 -->
<!-- Blocked By: 1.2 (User Registration & Login), 1.3 (Session Security), 1.4 (RBAC), 1.5 (Audit Logging) -->
<!-- FRs: FR42, FR43, FR44, FR45, FR46 | NFRs: NFR-SEC-10, NFR-PERF-2, NFR-PERF-6, NFR-ACCESS-1 through 7 -->

## Story

As any **VLPRS user**,
I want to log in through a secure, polished interface and navigate to my role-appropriate dashboard,
so that I can access the system's features relevant to my role.

## Acceptance Criteria (BDD)

### AC1: Protected Route Redirection

```gherkin
Given the React SPA is loaded
When an unauthenticated user visits any protected route (e.g., /dashboard, /operations, /submissions)
Then they are redirected to the login page at /login
And the redirect happens at the React Router level before any component renders
And no API request is made during the redirect (purely client-side state check)
```

### AC2: Login Form & Token Handling

```gherkin
Given the login page at /login
When a user enters valid credentials and submits the form
Then the client sends POST /api/auth/login with email, password, and reCAPTCHA token
And the access token from the response is stored in Zustand state (in-memory only, NEVER localStorage)
And the refresh token is set as httpOnly cookie by the server (never accessible to JavaScript)
And the user is redirected to their role-appropriate dashboard view:
  - super_admin → /dashboard
  - dept_admin → /operations
  - mda_officer → /submissions
And the login form validates inputs on blur using Zod schemas from @vlprs/shared
And Google reCAPTCHA v3 (invisible) protects the login endpoint
And error messages use non-punitive vocabulary from @vlprs/shared VOCABULARY constants
```

### AC3: Application Shell Navigation

```gherkin
Given an authenticated user viewing the application shell
When the viewport is desktop (>1024px)
Then a fixed 256px Oyo Crimson (#9C1E23) sidebar displays:
  - Oyo State crest/logo at top
  - User's full name and role badge (shadcn/ui Badge)
  - Role-specific navigation items:
    - super_admin: Dashboard, Reports, Exceptions
    - dept_admin: Operations, Migration, Reports, Exceptions
    - mda_officer: Submit, History
  - "Logout" action at bottom

When the viewport is mobile (<768px)
Then the sidebar collapses to a hamburger menu
And a crimson header bar shows hamburger icon, "VLPRS" title, and role badge
And tapping hamburger opens a Sheet overlay with the same navigation
And all touch targets are minimum 44x44px (NFR-ACCESS-4)

When the user clicks an active navigation item
Then they navigate to the corresponding route
And the active item is highlighted with a white left border + background tint

When the user clicks a navigation item for a future feature
Then they see a placeholder page: "Coming in Sprint [N]"
```

### AC4: Automatic Token Refresh

```gherkin
Given the access token has expired (or is about to expire)
When the client makes an API call that returns 401
Then the API client automatically calls POST /api/auth/refresh (cookie sent automatically by browser)
And the new access token is stored in Zustand state
And the original failed request is retried silently with the new token
And no loading spinner or UI disruption is shown to the user

When the refresh also returns 401 (refresh token expired or revoked)
Then the user is redirected to /login
And the auth state is cleared
And a toast notification shows: "Your session has expired. Please log in again."
```

### AC5: Public Zone Landing Page

```gherkin
Given an unauthenticated user visits the root URL /
Then they see a landing page with:
  - Oyo State Government branding (crest/logo)
  - Heading: "VLPRS — Vehicle Loan Processing & Receivables System"
  - Brief scheme description
  - "Staff Login" primary button (crimson) → navigates to /login
  - "Beneficiary Portal — Coming Soon (Phase 2)" placeholder section
And the page is mobile-responsive
And no authentication is required
```

### AC6: Session Timeout Warning

```gherkin
Given an authenticated user has been inactive for 29 minutes (1 minute before 30-min timeout)
When the warning threshold is reached
Then a Dialog modal appears with:
  - Title: "Your session is expiring soon"
  - Message: "You'll be logged out due to inactivity. Click below to continue working."
  - Primary button (crimson): "Continue Working" → calls refresh endpoint, resets timer
  - Secondary button (ghost): "Log Out Now" → immediate logout
And Escape key does NOT dismiss the dialog
And backdrop click does NOT dismiss the dialog

When the user takes no action for 60 seconds
Then they are automatically logged out
And redirected to /login with toast: "Your session has expired. Please log in again."
```

### AC7: Tests

```gherkin
Given Story 1.6 is implemented
When I run pnpm test from the monorepo root
Then unit tests pass for:
  - Auth store (setAuth, clearAuth, isAuthenticated)
  - API client (JWT attachment, 401 refresh retry, redirect on refresh failure)
  - AuthGuard (redirect when unauthenticated, render children when authenticated)
  - Login form validation (email required, password required, error display)
And all existing tests from Stories 1.1-1.5 continue to pass

When I run Playwright E2E smoke tests
Then the following flows pass:
  - Unauthenticated user visits /dashboard → redirected to /login
  - Login with super_admin credentials → redirected to /dashboard → role badge shows "Super Admin"
  - Login with dept_admin credentials → redirected to /operations → role badge shows "Department Admin"
  - Login with mda_officer credentials → redirected to /submissions → role badge shows "MDA Officer"
  - Authenticated user clicks Logout → redirected to /login → protected routes inaccessible
```

## Tasks / Subtasks

- [x] Task 1: Install frontend dependencies (AC: all)
  - [x] 1.1 Install runtime dependencies: `react-router` (v7 — NOT react-router-dom, it's deprecated in v7), `@tanstack/react-query`, `zustand`, `react-hook-form`, `@hookform/resolvers` (must be ^5.2.2 for Zod 4 compatibility), `react-google-recaptcha-v3`, `lucide-react`
  - [x] 1.2 Install dev dependencies: `@playwright/test`, `@tanstack/react-query-devtools`
  - [x] 1.3 Add shadcn/ui components via `npx shadcn@latest add`: input, label, card, badge, sheet, dialog, separator, skeleton, sonner (toast), form
  - [x] 1.4 Run `npx playwright install --with-deps` to install browser binaries
  - [x] 1.5 Add `VITE_API_URL` and `VITE_RECAPTCHA_SITE_KEY` to `.env.example` with documentation comments
  - [x] 1.6 Verify `pnpm typecheck` and `pnpm test` still pass after installs

- [x] Task 2: Auth store — Zustand (AC: #2, #4)
  - [x] 2.1 Create `apps/client/src/stores/authStore.ts` — Zustand store with `accessToken: string | null`, `user: User | null`, `setAuth(token, user)`, `clearAuth()`, `isAuthenticated` computed via `get()`
  - [x] 2.2 Store must NOT use Zustand `persist` middleware — access token stays in memory only (XSS protection)
  - [x] 2.3 Export `useAuthStore` hook for React components and `useAuthStore.getState()` pattern for API client (outside React tree)
  - [x] 2.4 Import `User` type from `@vlprs/shared` — never redeclare types that exist in shared
  - [x] 2.5 Create `apps/client/src/stores/authStore.test.ts` — test setAuth, clearAuth, isAuthenticated

- [x] Task 3: API client with JWT + refresh interceptor (AC: #4)
  - [x] 3.1 Create `apps/client/src/lib/apiClient.ts` — typed fetch wrapper using native `fetch` (NOT axios)
  - [x] 3.2 Attach `Authorization: Bearer {accessToken}` from `useAuthStore.getState()` on every request
  - [x] 3.3 On 401 response: call `POST /api/auth/refresh` (cookie sent automatically), store new accessToken in auth store, retry original request with new token
  - [x] 3.4 On refresh failure (401): call `clearAuth()`, redirect to `/login` via `window.location.href` (not React Router — outside React tree)
  - [x] 3.5 Always include `credentials: 'include'` on fetch calls (required for httpOnly cookie to be sent cross-origin)
  - [x] 3.6 Parse response envelope: `{ success: true, data }` → return `data`; `{ success: false, error }` → throw typed `ApiError`
  - [x] 3.7 Implement request queue to prevent multiple simultaneous refresh calls (only one refresh in-flight at a time; queue other 401s behind it)
  - [x] 3.8 Create `apps/client/src/lib/apiClient.test.ts` — test JWT attachment, 401 refresh retry, refresh failure redirect, request queuing

- [x] Task 4: TanStack Query + React Router setup (AC: #1, #2)
  - [x] 4.1 Create `apps/client/src/lib/queryClient.ts` — `new QueryClient()` with `staleTime: 5 * 60 * 1000`, `retry: 1`
  - [x] 4.2 Create `apps/client/src/router.tsx` — `createBrowserRouter` with public routes (`/`, `/login`) and protected route group (`/dashboard/*`, `/operations/*`, `/submissions/*`)
  - [x] 4.3 Create `apps/client/src/components/layout/AuthGuard.tsx` — checks `useAuthStore` for accessToken; if missing, `<Navigate to="/login" replace />`; if loading, render Skeleton
  - [x] 4.4 Protected route group uses `AuthGuard` as layout element wrapping `<Outlet />`
  - [x] 4.5 Use `lazy` property on route objects for code splitting — each lazy module exports `{ Component }` (React Router v7 pattern)
  - [x] 4.6 Update `apps/client/src/App.tsx` — replace demo content with `<QueryClientProvider>`, `<GoogleReCaptchaProvider>`, `<RouterProvider>`, `<Toaster>` wrapper stack
  - [x] 4.7 Update `apps/client/src/main.tsx` if needed — keep StrictMode, ensure providers are correct
  - [x] 4.8 Create `apps/client/src/components/layout/AuthGuard.test.tsx` — test redirect when unauthenticated, render children when authenticated

- [x] Task 5: Login page (AC: #2, #5)
  - [x] 5.1 Create `apps/client/src/pages/public/LoginPage.tsx` — centered Card layout (max-width 640px), Oyo State crest above form, email + password fields, "Login" primary button
  - [x] 5.2 Use React Hook Form with `zodResolver(loginSchema)` — import `loginSchema` from `@vlprs/shared` (already exists, uses Zod 4 via `zod/v4`)
  - [x] 5.3 Validate on blur (NOT keystroke) — set RHF `mode: 'onBlur'`
  - [x] 5.4 Integrate `useGoogleReCaptcha` hook — call `executeRecaptcha('login')` on submit, include token in login request body
  - [x] 5.5 On success: call `authStore.setAuth(accessToken, user)`, then navigate to role-appropriate route using React Router's `useNavigate()`
  - [x] 5.6 On error: display non-punitive message from `VOCABULARY` constants (e.g., `VOCABULARY.LOGIN_UNSUCCESSFUL`). Show in amber text below form.
  - [x] 5.7 Disable submit button while request is in-flight (loading state)
  - [x] 5.8 Handle reCAPTCHA gracefully in development: if `VITE_RECAPTCHA_SITE_KEY` is empty/undefined, skip reCAPTCHA token (send empty string or omit)
  - [x] 5.9 Accessibility: labels on all inputs, focus ring (2px teal), 16px minimum font, 44x44px button touch target, `aria-live` for error messages

- [x] Task 6: Application shell layout (AC: #3)
  - [x] 6.1 Create `apps/client/src/components/layout/DashboardLayout.tsx` — flexbox wrapper: Sidebar (desktop) + main content area with `<Outlet />`
  - [x] 6.2 Create `apps/client/src/components/layout/Sidebar.tsx` — 256px fixed width, crimson `#9C1E23` background, white text/icons. Sections: brand (crest + "VLPRS"), user info (name + Badge with role label), role-based nav items (use `ROLES` from `@vlprs/shared`), logout at bottom
  - [x] 6.3 Create `apps/client/src/components/layout/MobileHeader.tsx` — sticky crimson header bar (56px), hamburger icon (left), "VLPRS" title (center), role Badge (right)
  - [x] 6.4 Create `apps/client/src/components/layout/MobileNav.tsx` — shadcn/ui Sheet triggered by hamburger, slides from left, 85% width, same nav items as Sidebar, close button
  - [x] 6.5 Navigation items: use lucide-react icons, `NavLink` from `react-router` for active state highlighting (white left border + `rgba(255,255,255,0.15)` background)
  - [x] 6.6 Role-based nav item filtering: define `NAV_ITEMS` array with `{ label, path, icon, roles: Role[] }`, filter by `user.role` from auth store
  - [x] 6.7 Logout handler: call `POST /api/auth/logout` via apiClient, then `authStore.clearAuth()`, then `navigate('/login')`
  - [x] 6.8 Responsive breakpoint: use Tailwind `lg:` prefix (1024px) to toggle sidebar vs mobile header. Hide sidebar on mobile, hide mobile header on desktop.
  - [x] 6.9 Breadcrumb placeholder: create `apps/client/src/components/layout/Breadcrumb.tsx` — renders breadcrumb trail from route path (max 3 levels). Wire into DashboardLayout above `<Outlet />`.

- [x] Task 7: Public landing page (AC: #5)
  - [x] 7.1 Create `apps/client/src/pages/public/HomePage.tsx` — hero section with Oyo State crest, "VLPRS" heading, scheme description, "Staff Login" crimson Button linking to `/login`
  - [x] 7.2 Add "Beneficiary Portal — Coming Soon (Phase 2)" placeholder section below hero (grey surface background, muted text)
  - [x] 7.3 Create `apps/client/src/components/layout/PublicLayout.tsx` — simple centered layout for public pages (header with crest, main content, footer)
  - [x] 7.4 Mobile responsive: single column, full-width, stacked content

- [x] Task 8: Session timeout handling (AC: #6)
  - [x] 8.1 Create `apps/client/src/hooks/useSessionTimeout.ts` — tracks last activity timestamp, resets on user interaction (click, keypress, scroll, API call)
  - [x] 8.2 Warning threshold: 29 minutes (60 seconds before 30-min server timeout). Show Dialog modal.
  - [x] 8.3 "Continue Working" button: call refresh endpoint via apiClient, reset activity timer, close dialog
  - [x] 8.4 "Log Out Now" button: trigger logout flow (same as sidebar logout)
  - [x] 8.5 Auto-logout: if no action taken within 60 seconds of warning, auto-logout with toast notification
  - [x] 8.6 Dialog uses `onOpenChange` disabled (no Escape/backdrop dismiss) — user must explicitly choose
  - [x] 8.7 Mount `useSessionTimeout` in `DashboardLayout` (only active when authenticated)

- [x] Task 9: Placeholder dashboard pages (AC: #2, #3)
  - [x] 9.1 Create `apps/client/src/pages/dashboard/DashboardPage.tsx` — heading "Executive Dashboard", placeholder text "Dashboard content coming in Story 1.8b"
  - [x] 9.2 Create `apps/client/src/pages/dashboard/OperationsPage.tsx` — heading "Operations Hub", same placeholder pattern
  - [x] 9.3 Create `apps/client/src/pages/dashboard/SubmissionsPage.tsx` — heading "Monthly Submissions" with MDA name from auth store user.mdaId context, same placeholder
  - [x] 9.4 Create generic `apps/client/src/pages/dashboard/PlaceholderPage.tsx` — reusable "Coming in Sprint [N]" component for unimplemented nav items
  - [x] 9.5 Wire all pages into router.tsx with lazy loading

- [x] Task 10: Unit tests (AC: #7)
  - [x] 10.1 Create `apps/client/src/test/setup.ts` — import `@testing-library/jest-dom/vitest` for DOM matchers. Update `vite.config.ts` setupFiles.
  - [x] 10.2 Verify auth store tests pass (Task 2.5)
  - [x] 10.3 Verify API client tests pass (Task 3.8)
  - [x] 10.4 Verify AuthGuard tests pass (Task 4.8)
  - [x] 10.5 Create `apps/client/src/pages/public/LoginPage.test.tsx` — render form, validate error display on blur, verify submit calls API
  - [x] 10.6 Run `pnpm test` from monorepo root — all 4 workspaces pass

- [x] Task 11: Playwright E2E smoke tests (AC: #7)
  - [x] 11.1 Create `apps/client/playwright.config.ts` — CI-compatible, headless, baseURL `http://localhost:5173`, retries 2 on CI, reporter `github` on CI / `html` locally, `webServer` starts both client and server
  - [x] 11.2 Create `apps/client/e2e/setup/globalSetup.ts` — seed test accounts via direct API calls or DB operations before test suite runs (super_admin, dept_admin, mda_officer)
  - [x] 11.3 Create `apps/client/e2e/auth.spec.ts` — 5 test flows:
    - Test 1: Visit /dashboard unauthenticated → redirected to /login
    - Test 2: Login as super_admin → lands on /dashboard → heading "Executive Dashboard" → role badge "Super Admin"
    - Test 3: Login as dept_admin → lands on /operations → heading "Operations Hub" → role badge "Department Admin"
    - Test 4: Login as mda_officer → lands on /submissions → heading "Monthly Submissions" → role badge "MDA Officer"
    - Test 5: Authenticated user clicks Logout → redirected to /login → visiting /dashboard redirects to /login again
  - [x] 11.4 Add `e2e` script to `apps/client/package.json`: `"e2e": "playwright test"`
  - [x] 11.5 Add `.gitignore` entries for `playwright-report/`, `test-results/`, `blob-report/`

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] useSessionTimeout: Auto-logout timer cleared on re-render — logoutTimerRef cleared by useEffect cleanup when showWarning state changes [hooks/useSessionTimeout.ts:56-84]
- [x] [AI-Review][HIGH] AuthGuard: Missing CSRF token (x-csrf-token) on session restoration POST /auth/refresh — will 403 on page refresh [components/layout/AuthGuard.tsx:17-20]
- [x] [AI-Review][MEDIUM] Missing "Skip to main content" accessibility link in DashboardLayout — WCAG 2.1 AA requirement [components/layout/DashboardLayout.tsx]
- [x] [AI-Review][MEDIUM] No route-change focus management — focus should move to page h1 on navigation [router.tsx / DashboardLayout.tsx]
- [x] [AI-Review][MEDIUM] apiClient does not reset session timeout timer on successful API calls — story spec requires resetActivityTimer integration [lib/apiClient.ts + hooks/useSessionTimeout.ts]
- [x] [AI-Review][MEDIUM] Session timeout logout does not call POST /api/auth/logout — refresh token remains valid server-side (security gap) [hooks/useSessionTimeout.ts:25-31]
- [x] [AI-Review][LOW] Sidebar has double navigation landmark — aside role="navigation" wraps nested nav element [components/layout/Sidebar.tsx:33-66]
- [x] [AI-Review][LOW] Desktop sidebar nav items missing min-h-[44px] touch target [components/layout/Sidebar.tsx:71-84]
- [x] [AI-Review][LOW] PlaceholderPage SPRINT_MAP numbers shifted by Epic 14 insertion [pages/dashboard/PlaceholderPage.tsx:3-8]
- [x] [AI-Review][LOW] pnpm-lock.yaml modified but not in Dev Agent Record File List [story file]

## Dev Notes

### Critical Context — What This Story Establishes

This is **Story 6 of 58** — the **first frontend story** and the entry point for all user-facing functionality. This story transforms the backend auth infrastructure (Stories 1.2-1.5) into a polished, accessible login and navigation experience. Every future frontend story builds on the patterns established here.

**VLPRS is a government financial system for the Oyo State Accountant General's Office.** The AG's primary usage pattern is checking dashboard metrics on her phone during 30-second glances. The frontend must feel like a **modern fintech dashboard**, not a legacy government form.

**What this story produces:**

| Component | Purpose | Consumed By |
|---|---|---|
| `authStore` (Zustand) | In-memory JWT + user state | Every authenticated component, API client |
| `apiClient` (fetch wrapper) | JWT attachment, 401 refresh, retry | Every API call in Epics 2-13 |
| `AuthGuard` | Protected route redirection | Every dashboard route |
| `DashboardLayout` + `Sidebar` + `MobileHeader` | Application shell | Every authenticated page |
| `LoginPage` | User authentication UI | Entry point for all users |
| `HomePage` (public) | Landing page | Unauthenticated visitors |
| `useSessionTimeout` | Inactivity timeout handling | DashboardLayout |
| `router.tsx` | Route configuration | Entire SPA |
| `queryClient.ts` | TanStack Query setup | All data fetching hooks (1.8a+) |
| Playwright config | E2E testing infrastructure | CI/CD pipeline (Story 1.7) |

**What previous stories created that this story builds on:**

| Component | Location | What Was Created | Story |
|---|---|---|---|
| Login endpoint | `POST /api/auth/login` | Returns `{ accessToken, user }` + httpOnly refresh cookie | 1.2 |
| Register endpoint | `POST /api/auth/register` | Super admin creates users | 1.2 |
| Refresh endpoint | `POST /api/auth/refresh` | Token rotation, returns new `{ accessToken }` | 1.3 |
| Logout endpoint | `POST /api/auth/logout` | Revokes refresh token, clears cookie | 1.3 |
| CSRF protection | `csrf-csrf` middleware | Double-submit cookie pattern on mutations | 1.3 |
| RBAC middleware | `authenticate → authorise → scopeToMda` | Server-side role enforcement | 1.4 |
| Zod schemas | `packages/shared/src/validators/authSchemas.ts` | `loginSchema`, `registerSchema` (Zod 4 via `zod/v4`) | 1.2 |
| Role constants | `packages/shared/src/constants/roles.ts` | `ROLES`, `ALL_ROLES`, `Role` type | 1.2 |
| Vocabulary | `packages/shared/src/constants/vocabulary.ts` | Non-punitive auth error messages | 1.2 |
| Types | `packages/shared/src/types/auth.ts` | `User`, `JwtPayload`, `LoginRequest`, `LoginResponse` | 1.2 |
| API types | `packages/shared/src/types/api.ts` | `ApiResponse<T>`, `ApiError`, `ApiResult<T>` | 1.1 |
| Button component | `apps/client/src/components/ui/Button.tsx` | shadcn/ui Button with crimson/teal variants | 1.1 |
| Design tokens | `apps/client/src/styles/globals.css` | Oyo Crimson palette, teal, gold, typography, spacing | 1.1 |
| cn() utility | `apps/client/src/lib/utils.ts` | clsx + tailwind-merge | 1.1 |

### What NOT To Do

1. **DO NOT store access token in localStorage or sessionStorage** — XSS vulnerability. Keep in Zustand memory store only. Token is lost on page refresh; the refresh endpoint (httpOnly cookie) restores it.
2. **DO NOT access the refresh token from JavaScript** — It is httpOnly, secure, sameSite:strict. The browser sends it automatically with `credentials: 'include'`.
3. **DO NOT use `react-router-dom`** — Deprecated in v7. Import everything from `react-router` package.
4. **DO NOT hardcode role strings** — Import `ROLES` from `@vlprs/shared`. This is the #1 lesson from OSLRS (frontend/backend role string mismatch caused 3 roles to fail at runtime despite 53 passing tests).
5. **DO NOT use Axios** — Architecture specifies native `fetch` with a custom typed wrapper. Axios adds unnecessary bundle weight.
6. **DO NOT install `@testing-library/react-hooks`** — Deprecated. `renderHook` is built into `@testing-library/react` (v14+).
7. **DO NOT create mock data hooks or the mock data layer** — That's Story 1.8a. Dashboard pages in this story are placeholders only.
8. **DO NOT create HeroMetricCard, NairaDisplay, or other design system components** — That's Story 1.8a. Only use shadcn/ui primitives and simple layout components.
9. **DO NOT create the demo seed script** — That's Story 1.8b. E2E tests in this story create their own test accounts.
10. **DO NOT use `pino-http` or any server logging changes** — Server is not modified in this story.
11. **DO NOT create a `__tests__` directory** — Tests co-located next to source files.
12. **DO NOT use `React.lazy()` + `<Suspense>` for route splitting** — Use React Router v7's built-in `lazy` property on route objects, which returns `{ Component }`.
13. **DO NOT create a separate auth context provider** — Zustand replaces React Context for auth state. Components use `useAuthStore()` hook directly.
14. **DO NOT use red (#DC2626) for form validation errors** — Use amber/gold (#D4A017) per UX spec. Red is reserved for destructive actions only.

### React Router v7 — Critical Setup

**Package:** `react-router` (unified package, NOT `react-router-dom`)

```typescript
// apps/client/src/router.tsx
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router';

const router = createBrowserRouter([
  // Public routes
  {
    element: <PublicLayout />,
    children: [
      { path: '/', lazy: () => import('./pages/public/HomePage').then(m => ({ Component: m.HomePage })) },
      { path: '/login', lazy: () => import('./pages/public/LoginPage').then(m => ({ Component: m.LoginPage })) },
    ],
  },
  // Protected routes
  {
    element: <AuthGuard><DashboardLayout /></AuthGuard>,
    children: [
      { path: '/dashboard', lazy: () => import('./pages/dashboard/DashboardPage').then(m => ({ Component: m.DashboardPage })) },
      { path: '/operations', lazy: () => import('./pages/dashboard/OperationsPage').then(m => ({ Component: m.OperationsPage })) },
      { path: '/submissions', lazy: () => import('./pages/dashboard/SubmissionsPage').then(m => ({ Component: m.SubmissionsPage })) },
      // Future routes — placeholder pages
      { path: '/reports', lazy: () => import('./pages/dashboard/PlaceholderPage').then(m => ({ Component: m.default })) },
      { path: '/exceptions', lazy: () => import('./pages/dashboard/PlaceholderPage').then(m => ({ Component: m.default })) },
      { path: '/migration', lazy: () => import('./pages/dashboard/PlaceholderPage').then(m => ({ Component: m.default })) },
      { path: '/history', lazy: () => import('./pages/dashboard/PlaceholderPage').then(m => ({ Component: m.default })) },
    ],
  },
  // Catch-all → login
  { path: '*', element: <Navigate to="/login" replace /> },
]);
```

**Lazy loading pattern (React Router v7):**

Each lazy-loaded page must use **named export** matching `Component`:

```typescript
// apps/client/src/pages/dashboard/DashboardPage.tsx
export function DashboardPage() {
  return <div>...</div>;
}
```

Then in the router: `.then(m => ({ Component: m.DashboardPage }))`.

### Auth Store — Zustand

```typescript
// apps/client/src/stores/authStore.ts
import { create } from 'zustand';
import type { User } from '@vlprs/shared';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setAuth: (accessToken: string, user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setAuth: (accessToken, user) => set({ accessToken, user }),
  clearAuth: () => set({ accessToken: null, user: null }),
}));
```

**Outside React (in apiClient.ts):**
```typescript
const token = useAuthStore.getState().accessToken;
```

**Critical:** No `persist` middleware. Token lives only in memory. On page refresh, the token is lost — the app must call `/api/auth/refresh` on mount to restore the session (handled by AuthGuard's initial loading state).

### API Client — Fetch Wrapper

```typescript
// apps/client/src/lib/apiClient.ts
import { useAuthStore } from '@/stores/authStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

let refreshPromise: Promise<boolean> | null = null;

async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // sends httpOnly cookie
    });
    if (!res.ok) return false;
    const { data } = await res.json();
    useAuthStore.getState().setAuth(data.accessToken, useAuthStore.getState().user!);
    return true;
  } catch {
    return false;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // 401 → attempt silent refresh + retry
  if (res.status === 401 && accessToken) {
    // Prevent multiple simultaneous refresh calls
    if (!refreshPromise) {
      refreshPromise = refreshToken().finally(() => { refreshPromise = null; });
    }
    const refreshed = await refreshPromise;

    if (refreshed) {
      // Retry with new token
      const newToken = useAuthStore.getState().accessToken;
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
        credentials: 'include',
      });
    } else {
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  const body = await res.json();

  if (!res.ok || !body.success) {
    const error = body.error || { code: 'UNKNOWN', message: 'An unexpected error occurred' };
    throw Object.assign(new Error(error.message), { code: error.code, status: res.status });
  }

  return body.data as T;
}
```

**Key details:**
- `credentials: 'include'` on EVERY fetch — required for httpOnly cookie
- Single `refreshPromise` prevents stampede of refresh calls when multiple requests fail simultaneously
- On refresh failure: use `window.location.href` not React Router (apiClient is outside React tree)

### AuthGuard — Session Restoration on Refresh

When the user refreshes the browser, the Zustand store is empty (token lost). The AuthGuard must attempt session restoration via the refresh endpoint before deciding to redirect:

```typescript
// apps/client/src/components/layout/AuthGuard.tsx
import { useAuthStore } from '@/stores/authStore';
import { Navigate, Outlet } from 'react-router';
import { useEffect, useState } from 'react';

export function AuthGuard() {
  const { accessToken, setAuth, clearAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(!accessToken); // only load if no token

  useEffect(() => {
    if (accessToken) return; // already authenticated

    // Attempt session restoration
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(({ data }) => setAuth(data.accessToken, data.user))
      .catch(() => clearAuth())
      .finally(() => setIsLoading(false));
  }, [accessToken, setAuth, clearAuth]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">
      <div className="animate-spin h-8 w-8 border-2 border-crimson border-t-transparent rounded-full" />
    </div>;
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
```

**This is critical:** Without session restoration, every page refresh would force re-login. The refresh endpoint returns `{ accessToken, user }` — the auth store is repopulated silently.

### Login Page — Form Pattern

```typescript
// Key imports
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, VOCABULARY } from '@vlprs/shared';
import type { LoginRequest, LoginResponse } from '@vlprs/shared';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
```

**Form configuration:**
```typescript
const form = useForm<LoginRequest>({
  resolver: zodResolver(loginSchema),
  mode: 'onBlur', // validate on blur, not keystroke
  defaultValues: { email: '', password: '' },
});
```

**reCAPTCHA integration:**
```typescript
const { executeRecaptcha } = useGoogleReCaptcha();

const onSubmit = async (data: LoginRequest) => {
  let recaptchaToken = '';
  if (executeRecaptcha) {
    recaptchaToken = await executeRecaptcha('login');
  }
  // POST to /auth/login with { ...data, recaptchaToken }
};
```

**reCAPTCHA in development:** When `VITE_RECAPTCHA_SITE_KEY` is empty, the `GoogleReCaptchaProvider` should receive a placeholder key or be conditionally rendered. The login endpoint should skip reCAPTCHA verification when no token is provided in development mode.

### Application Shell — Sidebar Navigation

**Navigation items definition:**

```typescript
// apps/client/src/components/layout/navItems.ts
import { ROLES, type Role } from '@vlprs/shared';
import {
  LayoutDashboard,
  Settings,
  AlertTriangle,
  FileText,
  Upload,
  History,
  FolderSync,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: [ROLES.SUPER_ADMIN] },
  { label: 'Operations', path: '/operations', icon: Settings, roles: [ROLES.DEPT_ADMIN] },
  { label: 'Submit', path: '/submissions', icon: Upload, roles: [ROLES.MDA_OFFICER] },
  { label: 'History', path: '/history', icon: History, roles: [ROLES.MDA_OFFICER] },
  { label: 'Migration', path: '/migration', icon: FolderSync, roles: [ROLES.DEPT_ADMIN] },
  { label: 'Reports', path: '/reports', icon: FileText, roles: [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN] },
  { label: 'Exceptions', path: '/exceptions', icon: AlertTriangle, roles: [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN] },
];
```

**Filtering:**
```typescript
const userRole = useAuthStore(s => s.user?.role);
const visibleItems = NAV_ITEMS.filter(item => userRole && item.roles.includes(userRole));
```

**Active state (React Router v7 NavLink):**
```tsx
import { NavLink } from 'react-router';

<NavLink
  to={item.path}
  className={({ isActive }) =>
    cn(
      'flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-all',
      isActive
        ? 'bg-white/15 font-semibold border-l-2 border-white'
        : 'hover:bg-white/10 text-white/80'
    )
  }
>
  <item.icon className="h-[18px] w-[18px]" />
  {item.label}
</NavLink>
```

### Role Badge Display

**Role label mapping (human-readable):**

```typescript
const ROLE_LABELS: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.DEPT_ADMIN]: 'Department Admin',
  [ROLES.MDA_OFFICER]: 'MDA Officer',
};
```

**Badge in sidebar:**
```tsx
<Badge variant="outline" className="border-white/30 text-white/80 text-[11px]">
  {ROLE_LABELS[user.role]}
</Badge>
```

### Session Timeout Hook

```typescript
// apps/client/src/hooks/useSessionTimeout.ts
const WARNING_THRESHOLD_MS = 29 * 60 * 1000; // 29 minutes
const LOGOUT_DELAY_MS = 60 * 1000; // 60 seconds after warning
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'];
```

**Pattern:** Track `lastActivityTime` in a ref. Set an interval that checks `Date.now() - lastActivityTime`. When threshold reached, show warning dialog. When logout delay reached, force logout.

**Reset on activity:** Add event listeners for mouse, keyboard, scroll, touch. Each resets the timer.

**Reset on API call:** Export a `resetActivityTimer()` function that the apiClient calls on every successful request.

### CSRF Considerations

Story 1.3 established CSRF protection via `csrf-csrf` (double-submit cookie pattern). The frontend must:

1. Read the CSRF token from the response cookie (it's NOT httpOnly — it's the "double submit" half)
2. Include it as `X-CSRF-Token` header on state-changing requests (POST, PUT, PATCH, DELETE)

The `apiClient` should handle this automatically. Check if `csrf-csrf` sets a cookie named `__csrf` or similar and include it in mutation requests.

**Note:** If the CSRF token is returned in a response header instead of a cookie, adjust accordingly. Read Story 1.3's implementation to determine the exact mechanism.

### Provider Stack — App.tsx

```tsx
// apps/client/src/App.tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { RouterProvider } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { queryClient } from '@/lib/queryClient';
import { router } from '@/router';

export default function App() {
  const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

  return (
    <QueryClientProvider client={queryClient}>
      {recaptchaKey ? (
        <GoogleReCaptchaProvider reCaptchaKey={recaptchaKey}>
          <RouterProvider router={router} />
        </GoogleReCaptchaProvider>
      ) : (
        <RouterProvider router={router} />
      )}
      <Toaster position="bottom-right" />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
```

### Playwright E2E — Test Account Setup

Since the demo seed script (Story 1.8b) doesn't exist yet, E2E tests must create their own test accounts. Two approaches:

**Option A (recommended): API-based setup**
```typescript
// e2e/setup/globalSetup.ts
// Use the super admin credentials from env to register test accounts
// 1. Login as super admin (SUPER_ADMIN_EMAIL from server .env)
// 2. POST /api/auth/register to create dept_admin and mda_officer accounts
// 3. Store credentials in a shared fixture file
```

**Option B: Direct DB setup**
```typescript
// Use pg client to insert test users directly
// Less fragile but tightly couples to schema
```

**Choose Option A** — it validates the auth flow end-to-end.

**Playwright webServer config:**
```typescript
webServer: [
  {
    command: 'pnpm --filter server dev',
    url: 'http://localhost:3001/api/health',
    reuseExistingServer: !process.env.CI,
  },
  {
    command: 'pnpm --filter client dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
],
```

### File Structure — What This Story Creates

```
apps/client/
├── src/
│   ├── App.tsx                              # MODIFY — provider stack
│   ├── App.test.tsx                         # MODIFY — update for new App structure
│   ├── main.tsx                             # NO CHANGE (or minimal)
│   ├── router.tsx                           # NEW — createBrowserRouter config
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx                   # NO CHANGE
│   │   │   ├── input.tsx                    # NEW — shadcn/ui add
│   │   │   ├── label.tsx                    # NEW — shadcn/ui add
│   │   │   ├── card.tsx                     # NEW — shadcn/ui add
│   │   │   ├── badge.tsx                    # NEW — shadcn/ui add
│   │   │   ├── sheet.tsx                    # NEW — shadcn/ui add
│   │   │   ├── dialog.tsx                   # NEW — shadcn/ui add
│   │   │   ├── separator.tsx                # NEW — shadcn/ui add
│   │   │   ├── skeleton.tsx                 # NEW — shadcn/ui add
│   │   │   ├── sonner.tsx                   # NEW — shadcn/ui add (toast)
│   │   │   └── form.tsx                     # NEW — shadcn/ui add (RHF integration)
│   │   └── layout/
│   │       ├── AuthGuard.tsx                # NEW
│   │       ├── AuthGuard.test.tsx           # NEW
│   │       ├── DashboardLayout.tsx          # NEW
│   │       ├── Sidebar.tsx                  # NEW
│   │       ├── MobileHeader.tsx             # NEW
│   │       ├── MobileNav.tsx                # NEW
│   │       ├── PublicLayout.tsx             # NEW
│   │       ├── Breadcrumb.tsx               # NEW
│   │       └── navItems.ts                  # NEW
│   ├── pages/
│   │   ├── public/
│   │   │   ├── HomePage.tsx                 # NEW
│   │   │   ├── LoginPage.tsx                # NEW
│   │   │   └── LoginPage.test.tsx           # NEW
│   │   └── dashboard/
│   │       ├── DashboardPage.tsx            # NEW — placeholder
│   │       ├── OperationsPage.tsx           # NEW — placeholder
│   │       ├── SubmissionsPage.tsx          # NEW — placeholder
│   │       └── PlaceholderPage.tsx          # NEW — generic "Coming in Sprint N"
│   ├── hooks/
│   │   └── useSessionTimeout.ts            # NEW
│   ├── stores/
│   │   ├── authStore.ts                    # NEW
│   │   └── authStore.test.ts               # NEW
│   ├── lib/
│   │   ├── utils.ts                         # NO CHANGE
│   │   ├── apiClient.ts                     # NEW
│   │   ├── apiClient.test.ts                # NEW
│   │   └── queryClient.ts                   # NEW
│   ├── styles/
│   │   └── globals.css                      # NO CHANGE
│   └── test/
│       └── setup.ts                         # NEW — testing-library/jest-dom setup
├── e2e/
│   ├── auth.spec.ts                         # NEW
│   └── setup/
│       └── globalSetup.ts                   # NEW
├── playwright.config.ts                     # NEW
├── .env.example                             # MODIFY — add VITE_ vars
├── package.json                             # MODIFY — new deps + scripts
├── vite.config.ts                           # MODIFY — setupFiles
└── components.json                          # NO CHANGE
```

**Files this story MUST NOT modify:**

```
apps/server/**                               # No server changes
packages/shared/src/constants/roles.ts       # Already correct
packages/shared/src/constants/vocabulary.ts  # Already correct
packages/shared/src/validators/authSchemas.ts # Already correct
packages/shared/src/types/auth.ts            # Already correct
packages/shared/src/types/api.ts             # Already correct
packages/shared/src/index.ts                 # Already exports everything needed
```

### Architecture Compliance

**Token Storage — XSS-Safe:**

| Token | Storage | Accessible to JS | Security |
|---|---|---|---|
| Access Token | Zustand state (memory) | Yes (needed for Authorization header) | Lost on page refresh, restored via refresh endpoint |
| Refresh Token | httpOnly secure cookie | No (managed by browser) | Never accessible to malicious scripts |

**Middleware Chain Position (Server-Side, for reference):**

```
1. helmet → 2. cors → 3. cookie-parser → 4. body parsing → 5. requestLogger
6. rateLimiter → 7. [captcha ← THIS STORY enables] → 8. authenticate
9. csrfProtect → 10. authorise → 11. scopeToMda → 12. validate → 13. auditLog → 14. handler
```

**Response Envelope (all API calls return this format):**

```typescript
// Success
{ success: true, data: { ... } }

// Error
{ success: false, error: { code: 'SCREAMING_SNAKE', message: '...' } }
```

### Library & Framework Requirements

**New dependencies to install:**

| Package | Version | Purpose | Notes |
|---|---|---|---|
| `react-router` | ^7.13.0 | Routing + lazy loading | NOT react-router-dom (deprecated in v7) |
| `@tanstack/react-query` | ^5.90.0 | Server state management | v5 is current for React |
| `zustand` | ^5.0.0 | Client state (auth, UI) | No persist for auth store |
| `react-hook-form` | ^7.71.0 | Form handling | v7 is current |
| `@hookform/resolvers` | ^5.2.2 | Zod integration for RHF | MUST be 5.2.2+ for Zod 4 compatibility |
| `react-google-recaptcha-v3` | ^1.11.0 | reCAPTCHA v3 invisible | Provider + hook pattern |
| `lucide-react` | ^0.468.0 | Icons for navigation | Tree-shakeable, shadcn/ui compatible |

**Dev dependencies:**

| Package | Version | Purpose | Notes |
|---|---|---|---|
| `@playwright/test` | ^1.58.0 | E2E testing | Install browsers separately |
| `@tanstack/react-query-devtools` | ^5.90.0 | Query debugging | Dev only |

**Already installed (DO NOT reinstall or upgrade):**

| Package | Version | Purpose |
|---|---|---|
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | DOM rendering |
| `tailwindcss` | ^4.1.8 | CSS framework (v4, CSS-first config) |
| `@tailwindcss/vite` | ^4.1.8 | Vite plugin |
| `class-variance-authority` | ^0.7.1 | Component variants (shadcn/ui) |
| `clsx` | ^2.1.1 | Conditional classNames |
| `tailwind-merge` | ^3.3.0 | Tailwind class deduplication |
| `vitest` | ^3.2.1 | Unit testing |
| `@testing-library/react` | ^16.3.0 | React testing utilities |
| `@testing-library/jest-dom` | ^6.6.3 | DOM matchers |

### Testing Requirements

**Framework:** Vitest (unit/integration, co-located) + Playwright (E2E, in `e2e/` directory)

**Unit Tests:**

1. **`apps/client/src/stores/authStore.test.ts`:**
   - `setAuth(token, user)` stores both values
   - `clearAuth()` resets to null
   - `getState().accessToken` returns current token (outside React)
   - Initial state: both null

2. **`apps/client/src/lib/apiClient.test.ts`:**
   - Attaches Authorization header when token exists
   - Omits Authorization header when no token
   - Returns parsed `data` from success response envelope
   - Throws error with `code` and `message` from error response
   - On 401: calls refresh endpoint, retries original request
   - On 401 + refresh failure: clears auth, redirects to /login
   - Multiple simultaneous 401s: only one refresh call made

3. **`apps/client/src/components/layout/AuthGuard.test.tsx`:**
   - Renders `<Outlet />` when accessToken exists
   - Redirects to `/login` when no accessToken and refresh fails
   - Shows loading spinner while attempting session restoration

4. **`apps/client/src/pages/public/LoginPage.test.tsx`:**
   - Renders email and password fields with labels
   - Shows validation error on blur when email is empty
   - Shows validation error on blur when password is empty
   - Submit button disabled during loading
   - Calls API with correct payload on valid submit
   - Displays error message on failed login (non-punitive text)

**E2E Tests (Playwright):**

5. **`apps/client/e2e/auth.spec.ts`:**
   - Unauthenticated redirect: `/dashboard` → `/login`
   - Super admin login → `/dashboard` + "Super Admin" badge
   - Dept admin login → `/operations` + "Department Admin" badge
   - MDA officer login → `/submissions` + "MDA Officer" badge
   - Logout → redirected to `/login`, protected routes inaccessible

### Accessibility Requirements (WCAG 2.1 AA)

**Login Page:**
- All inputs have visible `<label>` elements (never placeholder-only)
- Focus ring: 2px solid teal `#0D7377` on all focusable elements
- Minimum 16px font size (prevents iOS auto-zoom)
- Login button: 48px height on mobile, 40px on desktop, minimum 44x44px touch target
- Error messages: `aria-live="polite"` for screen reader announcement
- Tab order: email → password → login button (logical flow)
- Enter key submits form

**Application Shell:**
- Semantic HTML: `<nav>`, `<main>`, `<header>`, `<aside>` landmarks
- Skip link: "Skip to main content" as first focusable element
- Sidebar navigation: `role="navigation"` with `aria-label="Main navigation"`
- Active nav item: `aria-current="page"`
- Mobile Sheet: focus trap when open, Escape closes, focus returns to hamburger on close
- Route change: focus moves to page `<h1>`
- Dialog (session timeout): focus trap, no Escape dismiss

**Colour Contrast (verified by design tokens):**
- Sidebar text on crimson: 7.2:1 (exceeds AA 4.5:1)
- Primary text on white: 12.6:1 (exceeds AA)
- Teal links on white: 5.1:1 (meets AA)
- Form validation text (amber on white): verify ≥ 4.5:1

**Motion:**
- Support `prefers-reduced-motion: reduce` — disable skeleton pulse animation
- Session timeout countdown: no animation required (text countdown)

### Environment Variables

**Client-side (Vite, prefixed with VITE_):**

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `VITE_API_URL` | No | `http://localhost:3001/api` | Backend API base URL |
| `VITE_RECAPTCHA_SITE_KEY` | No | `''` (skips reCAPTCHA in dev) | Google reCAPTCHA v3 site key |

**Add to `.env.example`:**
```
# Frontend
VITE_API_URL=http://localhost:3001/api
VITE_RECAPTCHA_SITE_KEY=               # Leave empty for local dev (reCAPTCHA skipped)
```

### Performance Targets

| Metric | Target | Strategy |
|---|---|---|
| First Contentful Paint | <1.5s | Code splitting via lazy routes |
| Time to Interactive | <4s (NFR-PERF-6) | Minimal JS bundle, tree-shaking |
| SPA page transitions | <500ms (NFR-PERF-2) | React Router lazy loading, TanStack Query cache |
| Dashboard route bundle | <150KB gzipped | Dynamic imports per route |
| Login page load | <2s | Small bundle (only auth deps) |

### Previous Story Intelligence

**From Story 1.1 (scaffold):**
1. Vite dev server runs on port **5173**, server on port **3001**
2. DB port is **5433** (not 5432) — relevant for E2E test setup
3. `@` path alias already configured in vite.config.ts
4. shadcn/ui configured with `components.json` — use `npx shadcn@latest add` to add components
5. Tailwind CSS v4 uses CSS-first config (`@theme` in globals.css) — NO `tailwind.config.js`
6. Tests co-located next to source files (not in `__tests__/`)

**From Story 1.2 (auth):**
1. Login response shape: `{ success: true, data: { accessToken: string, user: User } }`
2. Refresh cookie name and attributes set by server (httpOnly, secure, sameSite: strict)
3. `loginSchema` in shared validates email + password (Zod 4 via `zod/v4`)
4. Password policy: 8+ chars, 1 uppercase, 1 lowercase, 1 digit (validated server-side, shown client-side for UX)
5. Rate limiting: 5 requests per 15 minutes on auth endpoints

**From Story 1.3 (session security):**
1. Refresh endpoint: `POST /api/auth/refresh` — returns new `{ accessToken }` + sets new cookie
2. Token rotation: old refresh token revoked, new one issued on every refresh
3. Reuse detection: if old rotated token is reused, ALL user tokens revoked → 401 → must re-login
4. 30-minute inactivity timeout via `last_activity_at` tracking (server-side)
5. Max 1 concurrent session: new login revokes old refresh tokens
6. CSRF protection via `csrf-csrf` — double-submit cookie pattern

**From Story 1.4 (RBAC):**
1. `ROLES` constant already in `@vlprs/shared` — use it, never hardcode strings
2. `PERMISSION_MATRIX` in shared for reference
3. Three roles: super_admin (full access), dept_admin (cross-MDA), mda_officer (own MDA only)

**From Story 1.5 (audit logging):**
1. All auth events are audit-logged server-side — no client action needed
2. `requestLogger` middleware generates X-Request-Id on every request

### Git Intelligence

**Recent commits:**
```
9e6dd63 fix: code review fixes for Story 1.1 scaffold (14 issues resolved)
2084119 chore: scaffold VLPRS monorepo (Story 1.1)
```

**Branch:** `dev` | **Commit style:** `type: description` (conventional commits)

### Latest Technology Intelligence (Feb 2026)

| Technology | Version | Key Notes |
|---|---|---|
| `react-router` | 7.13.0 | `react-router-dom` deprecated — use `react-router`. Lazy routes use `lazy` property returning `{ Component }`. |
| `tailwindcss` | 4.2.0 (installed: 4.1.8) | Stay on 4.1.8 — already configured, no upgrade needed mid-sprint. |
| `@tanstack/react-query` | 5.90.21 | v5 current for React. `isPending` replaces old `isLoading`. |
| `zustand` | 5.0.11 | Minimal API. `create` from `zustand`. `getState()` for outside React. |
| `react-hook-form` | 7.71.1 | Stable. `@hookform/resolvers` MUST be ^5.2.2 for Zod 4 compatibility. |
| `react-google-recaptcha-v3` | 1.11.0 | Provider + `useGoogleReCaptcha` hook. Invisible, score-based. |
| `@playwright/test` | 1.58.2 | CI: `forbidOnly`, `reporter: 'github'`, `retries: 2`. `webServer` starts dev servers. |
| `vitest` | 3.2.1 (installed) | Stay on 3.2.1. `renderHook` built into `@testing-library/react` — no deprecated hooks package. |
| `@testing-library/jest-dom` | 6.6.3 (installed) | Import from `@testing-library/jest-dom/vitest` in setup file. |

### Scope Boundaries

**Explicitly IN scope:**
- React Router v7 setup with public/protected route groups and lazy loading
- Zustand auth store (access token + user in memory)
- API client (typed fetch wrapper with JWT, refresh interceptor, request queuing)
- TanStack Query setup (QueryClient, Provider — no data hooks yet)
- Login page (React Hook Form + Zod + reCAPTCHA v3)
- Application shell (DashboardLayout, Sidebar, MobileHeader, MobileNav, Breadcrumb)
- Public landing page (HomePage with branding)
- Session timeout warning (useSessionTimeout hook + Dialog)
- Role-based navigation (NAV_ITEMS filtered by user role)
- Placeholder dashboard pages (DashboardPage, OperationsPage, SubmissionsPage, PlaceholderPage)
- Unit tests (auth store, API client, AuthGuard, LoginPage)
- Playwright E2E smoke tests (5 auth flows)
- shadcn/ui component additions (input, label, card, badge, sheet, dialog, etc.)
- Environment variable setup (VITE_API_URL, VITE_RECAPTCHA_SITE_KEY)

**Explicitly NOT in scope (later stories):**
- Design foundation components — HeroMetricCard, NairaDisplay, AttentionItemCard, etc. (Story 1.8a)
- Mock data hooks — useDashboardMetrics, useMdaComplianceGrid, etc. (Story 1.8a)
- Mock data files in `src/mocks/` (Story 1.8a)
- Actual dashboard content — charts, metrics, compliance grid (Story 1.8b)
- Demo seed script — `pnpm seed:demo` (Story 1.8b)
- Wiring map documentation (Story 1.8b)
- Role-specific screen implementations — Executive Dashboard, Operations Hub, MDA Submission (Story 1.8b)
- CI/CD pipeline (Story 1.7)
- Global search (Ctrl+K command palette) — non-functional in Sprint 1
- Password reset flow (future story)
- User registration UI (super admin creates via API, no UI in Sprint 1)
- Server-side changes (Stories 1.2-1.5 already complete)

### Non-Punitive Vocabulary Rules

All user-facing text MUST pass: "Would an MDA officer feel defensive seeing this?"

| Context | Correct | Incorrect |
|---|---|---|
| Login failure | "Email or password is incorrect. Please try again." | "Login failed" / "Invalid credentials" |
| Session expired | "Your session has expired. Please log in again." | "Session terminated" / "Timed out" |
| Session warning | "Your session is expiring soon" | "Session timeout warning" |
| Future feature | "Coming in Sprint [N]" | "Not implemented" / "Error: feature unavailable" |
| Form validation | "Please enter your password" | "Password required" / "Missing field" |
| Account locked | "Your account is temporarily unavailable. Please try again in 15 minutes." | "Account locked due to failed attempts" |

All vocabulary constants are already defined in `packages/shared/src/constants/vocabulary.ts` — import and use them.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1, Story 1.6]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#RBAC Implementation]
- [Source: _bmad-output/planning-artifacts/architecture.md#Shared Role Constants]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Folder Structure]
- [Source: _bmad-output/planning-artifacts/architecture.md#API Patterns & Data Contracts]
- [Source: _bmad-output/planning-artifacts/architecture.md#Response Envelope]
- [Source: _bmad-output/planning-artifacts/architecture.md#Rate Limiting Tiers]
- [Source: _bmad-output/planning-artifacts/architecture.md#Google reCAPTCHA Integration]
- [Source: _bmad-output/planning-artifacts/prd.md#FR42 Email/Password Authentication]
- [Source: _bmad-output/planning-artifacts/prd.md#FR43 RBAC with 3 MVP Roles]
- [Source: _bmad-output/planning-artifacts/prd.md#FR44-46 Role-Specific Access]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-SEC-3 Session Management]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-SEC-5 Session Timeout]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-PERF-2 SPA Transitions]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-PERF-6 Time to Interactive]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-ACCESS-1 through 7 Accessibility]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Login Page Design]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Dashboard Shell Layout]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Role-Based Navigation]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Session Timeout UX]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Non-Punitive Vocabulary]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Color Scheme & Typography]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Accessibility Requirements]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Responsive Design]
- [Source: _bmad-output/implementation-artifacts/1-2-user-registration-login.md#Auth Endpoints]
- [Source: _bmad-output/implementation-artifacts/1-3-session-security-token-refresh.md#Token Refresh Flow]
- [Source: _bmad-output/implementation-artifacts/1-4-role-based-access-control.md#Middleware Architecture]
- [Source: _bmad-output/implementation-artifacts/1-5-audit-logging-action-tracking.md#Middleware Chain]

## Change Log

- **2026-02-20**: Code review fixes — 10 issues resolved (2 HIGH, 4 MEDIUM, 4 LOW). Fixed useSessionTimeout auto-logout timer bug (split into 2 effects), AuthGuard CSRF token on refresh, added skip-to-content link, route-change focus management, apiClient session timer reset, session timeout server logout, sidebar landmark/touch targets, PlaceholderPage sprint numbers, File List gap.
- **2026-02-20**: Story implemented — all 11 tasks complete. Auth store, API client, router, login page, application shell, session timeout, placeholder pages, unit tests (26 client), Playwright E2E smoke tests. 181 total monorepo tests pass.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- shadcn/ui button overwrite: Restored crimson/teal variants after `npx shadcn@latest add` overwrote Button.tsx
- AuthGuard test spinner: Used `querySelector('.animate-spin')` instead of `getByRole('status')` (spinner div has no ARIA role)
- App.test.tsx: Mocked router + RouterProvider to avoid jsdom AbortSignal incompatibility with React Router v7's `createBrowserRouter`
- App.test.tsx: Added `window.matchMedia` mock for Sonner toast compatibility in jsdom
- TypeScript: Created `src/vite-env.d.ts` for `import.meta.env` type support
- TypeScript: Added `@vlprs/shared@workspace:^` as client dependency and removed `rootDir` from tsconfig.json
- Vitest: Added `exclude: ['e2e/**', 'node_modules/**']` to vite.config.ts test config to prevent Playwright specs from being collected by Vitest

### Completion Notes List

- All 11 tasks and 66 subtasks completed
- 26 client unit tests pass (5 test files: authStore, apiClient, AuthGuard, App, LoginPage)
- 5 Playwright E2E smoke tests created (auth redirect, 3 role-based logins, logout flow)
- 181 total monorepo tests pass (26 client + 141 server + 12 shared + 2 testing)
- Typecheck passes for client workspace
- No server files modified (per story constraints)
- reCAPTCHA gracefully skipped when VITE_RECAPTCHA_SITE_KEY not set

### File List

**New files:**
- `apps/client/src/vite-env.d.ts` — Vite client type declarations
- `apps/client/src/test/setup.ts` — Testing library jest-dom setup
- `apps/client/src/stores/authStore.ts` — Zustand auth store (in-memory only)
- `apps/client/src/stores/authStore.test.ts` — Auth store unit tests (5 tests)
- `apps/client/src/lib/apiClient.ts` — Typed fetch wrapper with JWT + refresh
- `apps/client/src/lib/apiClient.test.ts` — API client unit tests (9 tests)
- `apps/client/src/lib/queryClient.ts` — TanStack Query client config
- `apps/client/src/router.tsx` — React Router v7 browser router config
- `apps/client/src/components/layout/AuthGuard.tsx` — Protected route guard with session restoration
- `apps/client/src/components/layout/AuthGuard.test.tsx` — AuthGuard unit tests (4 tests)
- `apps/client/src/components/layout/PublicLayout.tsx` — Public route wrapper
- `apps/client/src/components/layout/DashboardLayout.tsx` — Dashboard shell with sidebar + mobile nav + session timeout
- `apps/client/src/components/layout/Sidebar.tsx` — 256px crimson sidebar
- `apps/client/src/components/layout/MobileHeader.tsx` — Sticky mobile header
- `apps/client/src/components/layout/MobileNav.tsx` — Sheet-based mobile navigation
- `apps/client/src/components/layout/Breadcrumb.tsx` — Route-based breadcrumb
- `apps/client/src/components/layout/navItems.ts` — Role-filtered navigation items + role labels
- `apps/client/src/pages/public/LoginPage.tsx` — Login form with RHF + Zod + reCAPTCHA
- `apps/client/src/pages/public/LoginPage.test.tsx` — Login page unit tests (6 tests)
- `apps/client/src/hooks/useSessionTimeout.ts` — 29-min warning + auto-logout hook
- `apps/client/src/components/ui/form.tsx` — shadcn/ui RHF form integration
- `apps/client/src/components/ui/input.tsx` — shadcn/ui input
- `apps/client/src/components/ui/label.tsx` — shadcn/ui label
- `apps/client/src/components/ui/card.tsx` — shadcn/ui card
- `apps/client/src/components/ui/badge.tsx` — shadcn/ui badge
- `apps/client/src/components/ui/sheet.tsx` — shadcn/ui sheet
- `apps/client/src/components/ui/dialog.tsx` — shadcn/ui dialog
- `apps/client/src/components/ui/separator.tsx` — shadcn/ui separator
- `apps/client/src/components/ui/skeleton.tsx` — shadcn/ui skeleton
- `apps/client/src/components/ui/sonner.tsx` — shadcn/ui toast (Sonner)
- `apps/client/playwright.config.ts` — Playwright E2E config
- `apps/client/e2e/setup/globalSetup.ts` — E2E test account seeding
- `apps/client/e2e/auth.spec.ts` — E2E auth smoke tests (5 tests)

**Modified files:**
- `apps/client/package.json` — Added runtime/dev deps, e2e script
- `apps/client/vite.config.ts` — Added setupFiles + e2e exclude
- `apps/client/tsconfig.json` — Removed rootDir constraint
- `apps/client/src/App.tsx` — Provider stack (QueryClient, reCAPTCHA, Router, Toaster)
- `apps/client/src/App.test.tsx` — Updated for mocked router + matchMedia
- `apps/client/src/components/ui/Button.tsx` — Restored crimson/teal variants after shadcn overwrite
- `apps/client/src/pages/public/HomePage.tsx` — Hero landing page
- `apps/client/src/pages/dashboard/DashboardPage.tsx` — Executive Dashboard heading
- `apps/client/src/pages/dashboard/OperationsPage.tsx` — Operations Hub heading
- `apps/client/src/pages/dashboard/SubmissionsPage.tsx` — Monthly Submissions with MDA context
- `apps/client/src/pages/dashboard/PlaceholderPage.tsx` — Coming in Sprint N
- `.env.example` — Added VITE_RECAPTCHA_SITE_KEY
- `.gitignore` — Added playwright-report/, test-results/, blob-report/
- `pnpm-lock.yaml` — Updated from new dependency installs
