import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ProgrammeOverviewPage } from './ProgrammeOverviewPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/scheme']}>
      <ProgrammeOverviewPage />
    </MemoryRouter>
  );
}

describe('ProgrammeOverviewPage', () => {
  it('renders the page header with H1', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Programme Overview' })
    ).toBeInTheDocument();
  });

  it('renders 4 section headings', () => {
    renderPage();
    expect(screen.getByText('Scheme Objectives')).toBeInTheDocument();
    expect(screen.getByText('Policy Basis')).toBeInTheDocument();
    expect(screen.getByText('Benefits to Staff')).toBeInTheDocument();
    expect(screen.getByText("Role of the AG's Office")).toBeInTheDocument();
  });

  it('renders sidebar disclaimer callout', () => {
    renderPage();
    expect(
      screen.getByText(/VLPRS is classified as an administrative support system/)
    ).toBeInTheDocument();
  });

  it('renders sidebar quick links', () => {
    renderPage();
    expect(screen.getByText('Eligibility & Loan Categories')).toBeInTheDocument();
    expect(screen.getByText('Repayment & Settlement Rules')).toBeInTheDocument();
  });

  it('renders programme disclaimer at bottom', () => {
    renderPage();
    expect(
      screen.getByText(/Expression of Interest submission does not constitute/)
    ).toBeInTheDocument();
  });

  it('renders CTA banner', () => {
    renderPage();
    expect(screen.getByText('Ready to access VLPRS?')).toBeInTheDocument();
  });

  it('has single H1 and multiple H2s', () => {
    renderPage();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    const h2s = screen.getAllByRole('heading', { level: 2 });
    expect(h2s.length).toBeGreaterThanOrEqual(4);
  });

  it('sets page title', () => {
    renderPage();
    expect(document.title).toBe('Programme Overview | Vehicle Loan Scheme');
  });
});
