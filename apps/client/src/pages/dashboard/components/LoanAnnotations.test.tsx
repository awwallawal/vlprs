import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockUseAnnotations, mockUseAddAnnotation } = vi.hoisted(() => ({
  mockUseAnnotations: vi.fn(),
  mockUseAddAnnotation: vi.fn(),
}));

vi.mock('@/hooks/useAnnotations', () => ({
  useAnnotations: mockUseAnnotations,
  useAddAnnotation: mockUseAddAnnotation,
  useEventFlagCorrections: vi.fn(),
  useCorrectEventFlag: vi.fn(),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ user: { role: 'dept_admin' }, accessToken: 'test' }),
  ),
}));

import { LoanAnnotations } from './LoanAnnotations';

function renderComponent() {
  mockUseAddAnnotation.mockReturnValue({ mutate: vi.fn(), isPending: false });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LoanAnnotations loanId="loan-1" />
    </QueryClientProvider>,
  );
}

describe('LoanAnnotations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders empty state when no annotations', () => {
    mockUseAnnotations.mockReturnValue({ data: [], isLoading: false, isError: false });
    renderComponent();
    expect(screen.getByText('No annotations yet')).toBeInTheDocument();
  });

  it('renders annotations list with author and content', () => {
    mockUseAnnotations.mockReturnValue({
      data: [
        { id: 'a1', loanId: 'loan-1', content: 'Test annotation', createdBy: { userId: 'u1', name: 'John Doe' }, createdAt: new Date().toISOString() },
      ],
      isLoading: false,
      isError: false,
    });
    renderComponent();
    expect(screen.getByText('Test annotation')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('shows Add Annotation button for dept_admin', () => {
    mockUseAnnotations.mockReturnValue({ data: [], isLoading: false, isError: false });
    renderComponent();
    expect(screen.getByRole('button', { name: /add annotation/i })).toBeInTheDocument();
  });

  it('shows loading skeleton while fetching', () => {
    mockUseAnnotations.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderComponent();
    expect(screen.queryByText('No annotations yet')).not.toBeInTheDocument();
  });

  it('shows error state', () => {
    mockUseAnnotations.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderComponent();
    expect(screen.getByText('Unable to load annotations.')).toBeInTheDocument();
  });
});
