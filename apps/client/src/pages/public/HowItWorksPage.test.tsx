import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { HowItWorksPage } from './HowItWorksPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/how-it-works']}>
      <HowItWorksPage />
    </MemoryRouter>
  );
}

describe('HowItWorksPage', () => {
  it('renders the page header with H1', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'How It Works' })
    ).toBeInTheDocument();
  });

  it('renders 4 compact step summary cards', () => {
    renderPage();
    expect(screen.getByText('Expression of Interest')).toBeInTheDocument();
    expect(screen.getByText('Administrative Review')).toBeInTheDocument();
    expect(screen.getByText('Committee Decision')).toBeInTheDocument();
    expect(screen.getByText('Payroll Repayment')).toBeInTheDocument();
  });

  it('renders 4 expanded step sections as H2s', () => {
    renderPage();
    expect(screen.getByText('Step 1: Expression of Interest')).toBeInTheDocument();
    expect(screen.getByText('Step 2: Administrative Review')).toBeInTheDocument();
    expect(screen.getByText('Step 3: Committee Decision')).toBeInTheDocument();
    expect(screen.getByText('Step 4: Payroll Repayment')).toBeInTheDocument();
  });

  it('renders expanded detail text for each step', () => {
    renderPage();
    expect(screen.getByText(/unique reference number/)).toBeInTheDocument();
    expect(screen.getByText(/verifies eligibility against scheme rules/)).toBeInTheDocument();
    expect(screen.getByText(/plays no role in the decision-making/)).toBeInTheDocument();
    expect(screen.getByText(/Auto-Stop Certificate/)).toBeInTheDocument();
  });

  it('renders "What Happens After Completion?" section', () => {
    renderPage();
    expect(screen.getByText('What Happens After Completion?')).toBeInTheDocument();
    expect(
      screen.getByText(/Clearance Certificate and notifies your MDA/)
    ).toBeInTheDocument();
  });

  it('renders programme disclaimer component', () => {
    renderPage();
    expect(
      screen.getByText(/Vehicle Loan Processing & Receivables System/)
    ).toBeInTheDocument();
  });

  it('renders CTA banner', () => {
    renderPage();
    expect(screen.getByText('Ready to access VLPRS?')).toBeInTheDocument();
  });

  it('sets page title', () => {
    renderPage();
    expect(document.title).toBe('How It Works | Vehicle Loan Scheme');
  });

  it('has single H1 and multiple H2s', () => {
    renderPage();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    const h2s = screen.getAllByRole('heading', { level: 2 });
    expect(h2s.length).toBeGreaterThanOrEqual(5);
  });
});
