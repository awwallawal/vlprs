import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AccessibilityPage } from './AccessibilityPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/accessibility']}>
      <AccessibilityPage />
    </MemoryRouter>
  );
}

describe('AccessibilityPage', () => {
  it('renders the page header with H1', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Accessibility Statement' })
    ).toBeInTheDocument();
  });

  it('renders all 5 sections', () => {
    renderPage();
    expect(screen.getByText('WCAG 2.1 AA Compliance')).toBeInTheDocument();
    expect(screen.getByText('Accessibility Features')).toBeInTheDocument();
    expect(screen.getByText('Known Limitations')).toBeInTheDocument();
    expect(screen.getByText('Report an Issue')).toBeInTheDocument();
    expect(screen.getByText('Continuous Improvement')).toBeInTheDocument();
  });

  it('has correct heading hierarchy', () => {
    renderPage();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    const h2s = screen.getAllByRole('heading', { level: 2 });
    expect(h2s).toHaveLength(5);
  });

  it('renders accessibility features as a list', () => {
    renderPage();
    const listItems = screen.getAllByRole('listitem');
    expect(listItems.length).toBeGreaterThanOrEqual(7);
    expect(screen.getByText('Full keyboard navigation support for all interactive elements')).toBeInTheDocument();
    expect(screen.getByText('Visible focus indicators on all interactive elements')).toBeInTheDocument();
  });

  it('sets page title', () => {
    renderPage();
    expect(document.title).toBe('Accessibility Statement | Vehicle Loan Scheme');
  });
});
