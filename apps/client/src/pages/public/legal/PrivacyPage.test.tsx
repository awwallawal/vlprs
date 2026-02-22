import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PrivacyPage } from './PrivacyPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/privacy']}>
      <PrivacyPage />
    </MemoryRouter>
  );
}

describe('PrivacyPage', () => {
  it('renders the page header with H1', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Privacy & Data Protection' })
    ).toBeInTheDocument();
  });

  it('renders all 8 sections', () => {
    renderPage();
    expect(screen.getByText('What Personal Data Is Collected')).toBeInTheDocument();
    expect(screen.getByText('How Data Is Processed')).toBeInTheDocument();
    expect(screen.getByText('Who Has Access')).toBeInTheDocument();
    expect(screen.getByText('Data Retention')).toBeInTheDocument();
    expect(screen.getByText('Right of Access')).toBeInTheDocument();
    expect(screen.getByText('Consent Practices')).toBeInTheDocument();
    expect(screen.getByText('Data Security')).toBeInTheDocument();
    expect(screen.getByText('Data Protection Enquiries')).toBeInTheDocument();
  });

  it('has correct heading hierarchy', () => {
    renderPage();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    const h2s = screen.getAllByRole('heading', { level: 2 });
    expect(h2s).toHaveLength(8);
  });

  it('sets page title', () => {
    renderPage();
    expect(document.title).toBe('Privacy & Data Protection | Vehicle Loan Scheme');
  });
});
