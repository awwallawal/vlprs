import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { LoginModal } from './LoginModal';

function renderModal(open = true) {
  const onOpenChange = vi.fn();
  render(
    <MemoryRouter>
      <LoginModal open={open} onOpenChange={onOpenChange} />
    </MemoryRouter>
  );
  return { onOpenChange };
}

describe('LoginModal', () => {
  it('renders dialog with title when open', () => {
    renderModal(true);
    expect(screen.getByText('Access VLPRS')).toBeInTheDocument();
  });

  it('shows 3 portal cards', () => {
    renderModal();
    expect(screen.getByText('Staff Portal')).toBeInTheDocument();
    expect(screen.getByText('Beneficiary Portal')).toBeInTheDocument();
    expect(screen.getByText('Expression of Interest')).toBeInTheDocument();
  });

  it('has active Staff Portal with Login button', () => {
    renderModal();
    expect(screen.getByText('Login to Dashboard')).toBeInTheDocument();
  });

  it('shows disabled Beneficiary and EOI portals with Coming Soon (Phase 2) badges', () => {
    renderModal();
    const badges = screen.getAllByText(/Coming Soon \(Phase 2\)/);
    expect(badges.length).toBe(2);
  });

  it('shows footer note about role-based access', () => {
    renderModal();
    expect(screen.getByText(/role-based/)).toBeInTheDocument();
  });

  it('calls onOpenChange when Escape is pressed', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
