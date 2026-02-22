import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { DisclaimerPage } from './DisclaimerPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/disclaimer']}>
      <DisclaimerPage />
    </MemoryRouter>
  );
}

describe('DisclaimerPage', () => {
  it('renders the page header with H1', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Programme Disclaimer' })
    ).toBeInTheDocument();
  });

  it('renders all 5 sections', () => {
    renderPage();
    expect(screen.getByText('System Scope')).toBeInTheDocument();
    expect(screen.getByText('Committee Authority')).toBeInTheDocument();
    expect(screen.getByText('Expression of Interest')).toBeInTheDocument();
    expect(screen.getByText('No Legal Commitment')).toBeInTheDocument();
    expect(screen.getByText('Payroll & Gratuity Scope')).toBeInTheDocument();
  });

  it('has correct heading hierarchy', () => {
    renderPage();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    const h2s = screen.getAllByRole('heading', { level: 2 });
    expect(h2s).toHaveLength(5);
  });

  it('sets page title', () => {
    renderPage();
    expect(document.title).toBe('Programme Disclaimer | Vehicle Loan Scheme');
  });
});
