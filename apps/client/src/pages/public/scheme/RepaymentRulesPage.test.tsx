import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { RepaymentRulesPage } from './RepaymentRulesPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/scheme/repayment']}>
      <RepaymentRulesPage />
    </MemoryRouter>
  );
}

describe('RepaymentRulesPage', () => {
  it('renders the page header with H1', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Repayment & Settlement Rules' })
    ).toBeInTheDocument();
  });

  it('renders 4 accordion items', () => {
    renderPage();
    expect(screen.getByText('Standard Repayment')).toBeInTheDocument();
    expect(screen.getByText('Accelerated Repayment')).toBeInTheDocument();
    expect(screen.getByText('Early Principal Settlement')).toBeInTheDocument();
    expect(screen.getByText('Retirement & Gratuity Settlement')).toBeInTheDocument();
  });

  it('shows accordion content with examples (all expanded by default)', () => {
    renderPage();
    expect(screen.getByText(/60-month tenure/)).toBeInTheDocument();
    expect(screen.getByText(/A Level 9 officer/)).toBeInTheDocument();
  });

  it('accordion items can be collapsed', async () => {
    const user = userEvent.setup();
    renderPage();
    const trigger = screen.getByText('Standard Repayment');
    await user.click(trigger);
    // After clicking, content is removed from DOM
    expect(screen.queryByText(/A Level 9 officer/)).not.toBeInTheDocument();
  });

  it('renders sidebar disclaimer callout with link', () => {
    renderPage();
    expect(screen.getByText('Key Clarification')).toBeInTheDocument();
    expect(
      screen.getByText(/VLPRS supports record accuracy/)
    ).toBeInTheDocument();
    expect(screen.getByText('→ See FAQ')).toBeInTheDocument();
  });

  it('renders CTA banner', () => {
    renderPage();
    expect(screen.getByText('Ready to access VLPRS?')).toBeInTheDocument();
  });

  it('sets page title', () => {
    renderPage();
    expect(document.title).toBe('Repayment & Settlement Rules | Vehicle Loan Scheme');
  });
});
