import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { SupportPage } from './SupportPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/support']}>
      <SupportPage />
    </MemoryRouter>
  );
}

describe('SupportPage', () => {
  it('renders the page header with H1', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Help & Support' })
    ).toBeInTheDocument();
  });

  it('renders guidance banner', () => {
    renderPage();
    expect(screen.getByText(/Need help/)).toBeInTheDocument();
    expect(screen.getByText('MDA Officers:')).toBeInTheDocument();
  });

  it('renders 3 contact cards', () => {
    renderPage();
    expect(screen.getByText('Visit Us')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Phone')).toBeInTheDocument();
  });

  it('renders contact info', () => {
    renderPage();
    expect(screen.getByText("Accountant-General's Office")).toBeInTheDocument();
    expect(screen.getByText('carloan@oyo.gov.ng')).toBeInTheDocument();
  });

  it('renders office hours', () => {
    renderPage();
    expect(screen.getByText(/Monday – Friday/)).toBeInTheDocument();
  });

  it('renders useful links section', () => {
    renderPage();
    expect(screen.getByText('Useful Links')).toBeInTheDocument();
    expect(screen.getByText('Programme Overview')).toBeInTheDocument();
  });

  it('sets page title', () => {
    renderPage();
    expect(document.title).toBe('Help & Support | Vehicle Loan Scheme');
  });
});
