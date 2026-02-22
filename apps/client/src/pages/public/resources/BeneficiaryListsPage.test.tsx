import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { BeneficiaryListsPage } from './BeneficiaryListsPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/resources/beneficiary-lists']}>
      <BeneficiaryListsPage />
    </MemoryRouter>
  );
}

describe('BeneficiaryListsPage', () => {
  it('renders the page header with H1', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Approved Beneficiary Lists' })
    ).toBeInTheDocument();
  });

  it('renders Coming Soon badge', () => {
    renderPage();
    expect(screen.getByText('Coming Soon (Phase 2)')).toBeInTheDocument();
  });

  it('renders description and features', () => {
    renderPage();
    expect(screen.getByText(/publish approved batch lists/)).toBeInTheDocument();
    expect(screen.getByText('Searchable by name or Staff ID')).toBeInTheDocument();
  });

  it('renders related links', () => {
    renderPage();
    expect(screen.getByText('→ Back to Resources')).toBeInTheDocument();
    expect(screen.getByText('→ How It Works')).toBeInTheDocument();
  });

  it('sets page title', () => {
    renderPage();
    expect(document.title).toBe('Approved Beneficiary Lists | Vehicle Loan Scheme');
  });
});
