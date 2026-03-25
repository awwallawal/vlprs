import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockUseCorrectEventFlag } = vi.hoisted(() => ({
  mockUseCorrectEventFlag: vi.fn(),
}));

vi.mock('@/hooks/useAnnotations', () => ({
  useAnnotations: vi.fn(),
  useAddAnnotation: vi.fn(),
  useEventFlagCorrections: vi.fn(),
  useCorrectEventFlag: mockUseCorrectEventFlag,
}));

import { CorrectEventFlagDialog } from './CorrectEventFlagDialog';

function renderDialog(currentFlag = 'NONE') {
  mockUseCorrectEventFlag.mockReturnValue({ mutate: vi.fn(), isPending: false });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CorrectEventFlagDialog
        open={true}
        onOpenChange={vi.fn()}
        loanId="loan-1"
        currentFlag={currentFlag}
      />
    </QueryClientProvider>,
  );
}

describe('CorrectEventFlagDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders dialog with original flag read-only', () => {
    renderDialog('RETIREMENT');
    expect(screen.getByText('Retirement')).toBeInTheDocument();
  });

  it('renders new flag select trigger', () => {
    renderDialog('NONE');
    expect(screen.getByText('Select new flag...')).toBeInTheDocument();
  });

  it('renders correction reason textarea', () => {
    renderDialog();
    expect(screen.getByPlaceholderText(/explain why/i)).toBeInTheDocument();
  });

  it('Save button is disabled when form incomplete', () => {
    renderDialog();
    const btn = screen.getByRole('button', { name: /save correction/i });
    expect(btn).toBeDisabled();
  });

  it('shows character count for reason', () => {
    renderDialog();
    expect(screen.getByText('0/1000')).toBeInTheDocument();
  });
});
