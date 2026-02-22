import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { SubmissionsPage } from './SubmissionsPage';

const mockSubmissions = [
  {
    id: 'sub-001',
    referenceNumber: 'MOH-2026-02-0001',
    submissionDate: '2026-02-15T14:20:00Z',
    recordCount: 178,
    alignedCount: 175,
    varianceCount: 3,
    status: 'confirmed' as const,
  },
  {
    id: 'sub-002',
    referenceNumber: 'MOH-2026-01-0001',
    submissionDate: '2026-01-14T10:30:00Z',
    recordCount: 176,
    alignedCount: 174,
    varianceCount: 2,
    status: 'confirmed' as const,
  },
];

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: any) =>
    selector({
      user: {
        mdaId: 'mda-003',
        firstName: 'Health',
        lastName: 'Officer',
        role: 'mda_officer',
        email: 'test@test.com',
      },
    }),
}));

vi.mock('@/hooks/useSubmissionData', () => ({
  useSubmissionHistory: () => ({ data: mockSubmissions, isPending: false }),
}));

function renderPage(initialEntries = ['/dashboard/submissions']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <SubmissionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SubmissionsPage', () => {
  it('renders page heading "Monthly Submissions"', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Monthly Submissions' }),
    ).toBeInTheDocument();
  });

  it('renders MDA name context', () => {
    renderPage();
    expect(screen.getByText('Ministry of Health')).toBeInTheDocument();
  });

  it('renders pre-submission checkpoint section', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Pre-Submission Checkpoint' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('2 staff approaching retirement within 12 months'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('1 staff with zero deduction last month and no event filed'),
    ).toBeInTheDocument();
  });

  it('renders confirmation checkbox', () => {
    renderPage();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(
      screen.getByText(/I have reviewed the above items and confirm I am ready to submit/),
    ).toBeInTheDocument();
  });

  it('renders upload section', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Upload Deduction File' }),
    ).toBeInTheDocument();
  });

  it('renders submission history table', () => {
    renderPage();
    expect(screen.getByText('MOH-2026-02-0001')).toBeInTheDocument();
    expect(screen.getByText('MOH-2026-01-0001')).toBeInTheDocument();
  });
});
