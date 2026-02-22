import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PublicNavBar } from './PublicNavBar';

function renderNav(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <PublicNavBar />
    </MemoryRouter>
  );
}

describe('PublicNavBar', () => {
  it('renders the wordmark with site title', () => {
    renderNav();
    expect(screen.getByText('Vehicle Loan Scheme')).toBeInTheDocument();
  });

  it('renders Home and About nav items', () => {
    renderNav();
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'About' })).toBeInTheDocument();
  });

  it('renders The Scheme dropdown trigger', () => {
    renderNav();
    expect(screen.getByText('The Scheme')).toBeInTheDocument();
  });

  it('renders Resources dropdown trigger', () => {
    renderNav();
    expect(screen.getByText('Resources')).toBeInTheDocument();
  });

  it('renders Staff Login button', () => {
    renderNav();
    expect(screen.getAllByText('Staff Login').length).toBeGreaterThan(0);
  });

  it('renders mobile hamburger button', () => {
    renderNav();
    expect(screen.getByLabelText('Open navigation menu')).toBeInTheDocument();
  });

  it('opens login modal when Staff Login is clicked', async () => {
    const user = userEvent.setup();
    renderNav();
    // Click the desktop Staff Login button (hidden on mobile but present in DOM)
    const loginButtons = screen.getAllByText('Staff Login');
    await user.click(loginButtons[0]);
    expect(screen.getByText('Access VLPRS')).toBeInTheDocument();
  });
});
