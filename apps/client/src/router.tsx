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
      // Story 14.2 — Scheme information pages
      {
        path: '/about',
        lazy: () =>
          import('@/pages/public/AboutPage').then((m) => ({
            Component: m.AboutPage,
          })),
      },
      {
        path: '/scheme',
        lazy: () =>
          import('@/pages/public/scheme/ProgrammeOverviewPage').then((m) => ({
            Component: m.ProgrammeOverviewPage,
          })),
      },
      {
        path: '/scheme/overview',
        lazy: () =>
          import('@/pages/public/scheme/ProgrammeOverviewPage').then((m) => ({
            Component: m.ProgrammeOverviewPage,
          })),
      },
      {
        path: '/scheme/about-vlprs',
        lazy: () =>
          import('@/pages/public/scheme/AboutVlprsPage').then((m) => ({
            Component: m.AboutVlprsPage,
          })),
      },
      {
        path: '/scheme/eligibility',
        lazy: () =>
          import('@/pages/public/scheme/EligibilityPage').then((m) => ({
            Component: m.EligibilityPage,
          })),
      },
      {
        path: '/scheme/repayment',
        lazy: () =>
          import('@/pages/public/scheme/RepaymentRulesPage').then((m) => ({
            Component: m.RepaymentRulesPage,
          })),
      },
      {
        path: '/how-it-works',
        lazy: () =>
          import('@/pages/public/HowItWorksPage').then((m) => ({
            Component: m.HowItWorksPage,
          })),
      },
      // Story 14.3 — Resources, support & legal pages
      {
        path: '/resources/faq',
        lazy: () =>
          import('@/pages/public/resources/FaqPage').then((m) => ({
            Component: m.FaqPage,
          })),
      },
      {
        path: '/resources/submission-guide',
        lazy: () =>
          import('@/pages/public/resources/MdaGuidePage').then((m) => ({
            Component: m.MdaGuidePage,
          })),
      },
      {
        path: '/resources/downloads',
        lazy: () =>
          import('@/pages/public/resources/DownloadsPage').then((m) => ({
            Component: m.DownloadsPage,
          })),
      },
      {
        path: '/resources/news',
        lazy: () =>
          import('@/pages/public/resources/NewsPage').then((m) => ({
            Component: m.NewsPage,
          })),
      },
      {
        path: '/resources/news/:slug',
        lazy: () =>
          import('@/pages/public/resources/NewsDetailPage').then((m) => ({
            Component: m.NewsDetailPage,
          })),
      },
      {
        path: '/resources/beneficiary-lists',
        lazy: () =>
          import('@/pages/public/resources/BeneficiaryListsPage').then((m) => ({
            Component: m.BeneficiaryListsPage,
          })),
      },
      {
        path: '/support',
        lazy: () =>
          import('@/pages/public/SupportPage').then((m) => ({
            Component: m.SupportPage,
          })),
      },
      {
        path: '/privacy',
        lazy: () =>
          import('@/pages/public/legal/PrivacyPage').then((m) => ({
            Component: m.PrivacyPage,
          })),
      },
      {
        path: '/accessibility',
        lazy: () =>
          import('@/pages/public/legal/AccessibilityPage').then((m) => ({
            Component: m.AccessibilityPage,
          })),
      },
      {
        path: '/disclaimer',
        lazy: () =>
          import('@/pages/public/legal/DisclaimerPage').then((m) => ({
            Component: m.DisclaimerPage,
          })),
      },
      {
        path: '/eoi',
        lazy: () =>
          import('@/pages/public/EoiPage').then((m) => ({
            Component: m.EoiPage,
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
  // Catch-all → homepage
  { path: '*', element: <Navigate to="/" replace /> },
]);
