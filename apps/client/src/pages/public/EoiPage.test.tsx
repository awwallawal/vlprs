import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { EoiPage } from './EoiPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/eoi']}>
      <EoiPage />
    </MemoryRouter>
  );
}

describe('EoiPage', () => {
  it('renders the page header with H1', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Expression of Interest' })
    ).toBeInTheDocument();
  });

  it('renders Coming Soon badge', () => {
    renderPage();
    expect(screen.getByText('Coming Soon (Phase 2)')).toBeInTheDocument();
  });

  it('renders description', () => {
    renderPage();
    expect(screen.getByText(/Expression of Interest portal/)).toBeInTheDocument();
  });

  it('renders EOI disclaimer', () => {
    renderPage();
    expect(
      screen.getByText(/does not constitute, imply, or guarantee/)
    ).toBeInTheDocument();
  });

  it('renders related links', () => {
    renderPage();
    expect(screen.getByText('→ How It Works')).toBeInTheDocument();
    expect(screen.getByText('→ Contact Support')).toBeInTheDocument();
  });

  it('sets page title', () => {
    renderPage();
    expect(document.title).toBe('Expression of Interest | Vehicle Loan Scheme');
  });
});
