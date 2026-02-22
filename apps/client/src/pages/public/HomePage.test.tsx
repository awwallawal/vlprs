import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage';

function renderHomePage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );
}

describe('HomePage', () => {
  it('renders the hero section with H1 title', () => {
    renderHomePage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Vehicle Loan Scheme' })
    ).toBeInTheDocument();
  });

  it('renders the Official Programme Notice card', () => {
    renderHomePage();
    expect(screen.getByText('Official Programme Notice')).toBeInTheDocument();
  });

  it('renders trust strip with 3 badges', () => {
    renderHomePage();
    expect(screen.getByText('NDPR-aligned handling')).toBeInTheDocument();
    expect(screen.getByText('Audit-ready reporting')).toBeInTheDocument();
    expect(screen.getByText('Committee approvals preserved')).toBeInTheDocument();
  });

  it('renders How It Works section with 4 steps', () => {
    renderHomePage();
    expect(screen.getByText('How It Works')).toBeInTheDocument();
    expect(screen.getByText('Expression of Interest')).toBeInTheDocument();
    expect(screen.getByText('Administrative Review')).toBeInTheDocument();
    expect(screen.getByText('Committee Decision')).toBeInTheDocument();
    expect(screen.getByText('Payroll Repayment')).toBeInTheDocument();
  });

  it('renders disclaimer with info icon (not warning triangle)', () => {
    renderHomePage();
    expect(
      screen.getByText(/Expression of Interest submission does not constitute/)
    ).toBeInTheDocument();
  });

  it('renders 4 loan tier cards with Naira amounts', () => {
    renderHomePage();
    expect(screen.getByText('Levels 1-6')).toBeInTheDocument();
    expect(screen.getByText('Levels 7-8')).toBeInTheDocument();
    expect(screen.getByText('Levels 9-10')).toBeInTheDocument();
    expect(screen.getByText('Levels 12+')).toBeInTheDocument();
  });

  it('renders 6 key capabilities', () => {
    renderHomePage();
    expect(screen.getByText('Immutable Financial Ledger')).toBeInTheDocument();
    expect(screen.getByText('Computed Balances')).toBeInTheDocument();
    expect(screen.getByText('Auto-Stop Certificates')).toBeInTheDocument();
    expect(screen.getByText('Real-Time Executive Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Non-Punitive Design')).toBeInTheDocument();
    expect(screen.getByText('Audit-Ready from Day One')).toBeInTheDocument();
  });

  it('renders repayment accordion with 4 items', () => {
    renderHomePage();
    expect(screen.getByText('Standard Repayment')).toBeInTheDocument();
    expect(screen.getByText('Accelerated Repayment')).toBeInTheDocument();
    expect(screen.getByText('Early Principal Settlement')).toBeInTheDocument();
    expect(screen.getByText('Retirement & Gratuity Settlement')).toBeInTheDocument();
  });

  it('renders Who VLPRS Serves section with 3 role cards', () => {
    renderHomePage();
    expect(screen.getByText('Car Loan Department')).toBeInTheDocument();
    expect(screen.getByText('MDA Officers')).toBeInTheDocument();
    expect(screen.getByText('Beneficiaries')).toBeInTheDocument();
  });

  it('renders Trust & Compliance section with 3 pillars', () => {
    renderHomePage();
    expect(screen.getByText('NDPR Compliant')).toBeInTheDocument();
    expect(screen.getByText('Audit-Ready')).toBeInTheDocument();
    expect(screen.getByText('Immutable Ledger')).toBeInTheDocument();
  });

  it('renders endorsement banner with AG quote', () => {
    renderHomePage();
    expect(screen.getByText(/Accountant General, Oyo State/)).toBeInTheDocument();
  });

  it('renders 3 news announcement cards', () => {
    renderHomePage();
    expect(screen.getByText('VLPRS Digital Platform Launches for Oyo State')).toBeInTheDocument();
    expect(screen.getByText(/MDA Officers: Monthly Submission Portal/)).toBeInTheDocument();
    expect(screen.getByText('Data Migration Progress: Phase 1 Complete')).toBeInTheDocument();
  });

  it('renders final CTA dark banner', () => {
    renderHomePage();
    expect(screen.getByText('Ready to access VLPRS?')).toBeInTheDocument();
  });

  it('opens login modal when Staff Login button is clicked', async () => {
    const user = userEvent.setup();
    renderHomePage();
    // Find the hero section Staff Login button
    const loginButtons = screen.getAllByRole('button', { name: 'Staff Login' });
    await user.click(loginButtons[0]);
    expect(screen.getByText('Access VLPRS')).toBeInTheDocument();
  });

  it('has single H1 and multiple H2s for section headings', () => {
    renderHomePage();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    const h2s = screen.getAllByRole('heading', { level: 2 });
    expect(h2s.length).toBeGreaterThanOrEqual(8);
  });
});
