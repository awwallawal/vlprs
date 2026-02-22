import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AboutVlprsPage } from './AboutVlprsPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/scheme/about-vlprs']}>
      <AboutVlprsPage />
    </MemoryRouter>
  );
}

describe('AboutVlprsPage', () => {
  it('renders the page header with H1', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'About VLPRS' })
    ).toBeInTheDocument();
  });

  it('renders core principle quote', () => {
    renderPage();
    expect(
      screen.getByText(/MDAs submit facts\. VLPRS computes truth/)
    ).toBeInTheDocument();
  });

  it('renders "What VLPRS Does" card with CheckCircle items', () => {
    renderPage();
    expect(screen.getByText('What VLPRS Does')).toBeInTheDocument();
    expect(screen.getByText(/Centralised record-keeping/)).toBeInTheDocument();
    expect(screen.getByText(/Automated computation/)).toBeInTheDocument();
  });

  it('renders "What VLPRS Does NOT Do" card with XCircle items', () => {
    renderPage();
    expect(screen.getByText('What VLPRS Does NOT Do')).toBeInTheDocument();
    expect(screen.getByText(/Does not approve or reject/)).toBeInTheDocument();
    expect(screen.getByText(/Does not change policy/)).toBeInTheDocument();
  });

  it('renders both cards in a grid', () => {
    renderPage();
    // Navigate up to the card container (parent of the flex header div)
    const doesHeader = screen.getByText('What VLPRS Does').closest('div');
    const doesCard = doesHeader?.parentElement;
    expect(doesCard?.className).toContain('bg-green-50');
    const doesNotHeader = screen.getByText('What VLPRS Does NOT Do').closest('div');
    const doesNotCard = doesNotHeader?.parentElement;
    expect(doesNotCard?.className).toContain('bg-slate-50');
  });

  it('renders CTA banner', () => {
    renderPage();
    expect(screen.getByText('Ready to access VLPRS?')).toBeInTheDocument();
  });

  it('sets page title', () => {
    renderPage();
    expect(document.title).toBe('About VLPRS | Vehicle Loan Scheme');
  });
});
