import { createBrowserRouter, Navigate } from 'react-router';
import { AuthGuard } from '@/components/layout/AuthGuard';
import { PublicLayout } from '@/components/layout/PublicLayout';

// Lazy-loaded layout (imported eagerly since it wraps protected routes)
const DashboardLayoutModule = () =>
  import('@/components/layout/DashboardLayout').then((m) => ({
    Component: m.DashboardLayout,
  }));

export const router = createBrowserRouter([
  // Public routes
  {
    element: <PublicLayout />,
    children: [
      {
        path: '/',
        lazy: () =>
          import('@/pages/public/HomePage').then((m) => ({
            Component: m.HomePage,
          })),
      },
      {
        path: '/login',
        lazy: () =>
          import('@/pages/public/LoginPage').then((m) => ({
            Component: m.LoginPage,
          })),
      },
    ],
  },
  // Protected routes
  {
    element: <AuthGuard />,
    children: [
      {
        lazy: DashboardLayoutModule,
        children: [
          {
            path: '/dashboard',
            lazy: () =>
              import('@/pages/dashboard/DashboardPage').then((m) => ({
                Component: m.DashboardPage,
              })),
          },
          {
            path: '/operations',
            lazy: () =>
              import('@/pages/dashboard/OperationsPage').then((m) => ({
                Component: m.OperationsPage,
              })),
          },
          {
            path: '/submissions',
            lazy: () =>
              import('@/pages/dashboard/SubmissionsPage').then((m) => ({
                Component: m.SubmissionsPage,
              })),
          },
          {
            path: '/reports',
            lazy: () =>
              import('@/pages/dashboard/PlaceholderPage').then((m) => ({
                Component: m.default,
              })),
          },
          {
            path: '/exceptions',
            lazy: () =>
              import('@/pages/dashboard/PlaceholderPage').then((m) => ({
                Component: m.default,
              })),
          },
          {
            path: '/migration',
            lazy: () =>
              import('@/pages/dashboard/PlaceholderPage').then((m) => ({
                Component: m.default,
              })),
          },
          {
            path: '/history',
            lazy: () =>
              import('@/pages/dashboard/PlaceholderPage').then((m) => ({
                Component: m.default,
              })),
          },
        ],
      },
    ],
  },
  // Catch-all → login
  { path: '*', element: <Navigate to="/login" replace /> },
]);
