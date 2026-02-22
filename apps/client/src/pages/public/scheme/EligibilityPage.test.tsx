import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { EligibilityPage } from './EligibilityPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/scheme/eligibility']}>
      <EligibilityPage />
    </MemoryRouter>
  );
}

describe('EligibilityPage', () => {
  it('renders the page header with H1', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Eligibility & Loan Categories' })
    ).toBeInTheDocument();
  });

  it('renders 4 loan tier cards with amounts', () => {
    renderPage();
    expect(screen.getByText('Levels 1-6')).toBeInTheDocument();
    expect(screen.getByText('₦250,000')).toBeInTheDocument();
    expect(screen.getByText('Levels 7-8')).toBeInTheDocument();
    expect(screen.getByText('₦450,000')).toBeInTheDocument();
    expect(screen.getByText('Levels 9-10')).toBeInTheDocument();
    expect(screen.getByText('₦600,000')).toBeInTheDocument();
    expect(screen.getByText('Levels 12+')).toBeInTheDocument();
    expect(screen.getByText('₦750,000')).toBeInTheDocument();
  });

  it('renders interest rate on each tier', () => {
    renderPage();
    const interestElements = screen.getAllByText('Interest: 13.33% p.a.');
    expect(interestElements).toHaveLength(4);
  });

  it('renders eligibility conditions', () => {
    renderPage();
    expect(screen.getByText(/Active government service/)).toBeInTheDocument();
    expect(screen.getByText(/Grade level qualification/)).toBeInTheDocument();
    expect(screen.getByText(/No existing active vehicle loan/)).toBeInTheDocument();
    expect(screen.getByText(/Committee approval/)).toBeInTheDocument();
  });

  it('renders retirement provision disclaimer callout', () => {
    renderPage();
    expect(screen.getByText('Retirement Provision')).toBeInTheDocument();
    expect(
      screen.getByText(/Staff within 24 months of retirement/)
    ).toBeInTheDocument();
  });

  it('renders general disclaimer', () => {
    renderPage();
    expect(
      screen.getByText(/Eligibility is determined by scheme rules/)
    ).toBeInTheDocument();
  });

  it('renders CTA banner', () => {
    renderPage();
    expect(screen.getByText('Ready to access VLPRS?')).toBeInTheDocument();
  });

  it('sets page title', () => {
    renderPage();
    expect(document.title).toBe('Eligibility & Loan Categories | Vehicle Loan Scheme');
  });
});
