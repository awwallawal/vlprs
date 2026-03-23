import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { FlagExceptionDialog } from './FlagExceptionDialog';

const { mockUseFlagException } = vi.hoisted(() => {
  const mockUseFlagException = vi.fn();
  return { mockUseFlagException };
});

vi.mock('@/hooks/useExceptionData', () => ({
  useFlagException: mockUseFlagException,
  useExceptions: vi.fn(),
  useExceptionQueue: vi.fn(),
  useExceptionDetail: vi.fn(),
  useExceptionCounts: vi.fn(),
  useResolveException: vi.fn(),
}));

const mockMutate = vi.fn();

function renderDialog() {
  mockUseFlagException.mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <FlagExceptionDialog
        open={true}
        onOpenChange={vi.fn()}
        loanId="loan-test-1"
      />
    </QueryClientProvider>,
  );
}

describe('FlagExceptionDialog', () => {
  it('renders priority and category selectors', () => {
    renderDialog();
    expect(screen.getByText('Flag as Exception')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('shows notes textarea with min length hint', () => {
    renderDialog();
    expect(screen.getByPlaceholderText('Describe the issue...')).toBeInTheDocument();
    expect(screen.getByText(/min 10 characters/)).toBeInTheDocument();
  });

  it('submit button disabled when form incomplete', () => {
    renderDialog();
    const submitButton = screen.getByRole('button', { name: 'Flag Exception' });
    expect(submitButton).toBeDisabled();
  });
});
