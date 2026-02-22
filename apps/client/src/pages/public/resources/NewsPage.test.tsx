import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { NewsPage } from './NewsPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/resources/news']}>
      <NewsPage />
    </MemoryRouter>
  );
}

describe('NewsPage', () => {
  it('renders the page header with H1', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'News & Announcements' })
    ).toBeInTheDocument();
  });

  it('renders 3 announcement cards', () => {
    renderPage();
    expect(screen.getByText('VLPRS Digital Platform Launches for Oyo State')).toBeInTheDocument();
    expect(screen.getByText(/MDA Officers: Monthly Submission Portal/)).toBeInTheDocument();
    expect(screen.getByText('Data Migration Progress: Phase 1 Complete')).toBeInTheDocument();
  });

  it('renders Read more links', () => {
    renderPage();
    const links = screen.getAllByText('Read more →');
    expect(links).toHaveLength(3);
  });

  it('renders cards in reverse chronological order', () => {
    renderPage();
    const headings = screen.getAllByRole('heading', { level: 3 });
    // Most recent first
    expect(headings[0].textContent).toContain('VLPRS Digital Platform');
  });

  it('sets page title', () => {
    renderPage();
    expect(document.title).toBe('News & Announcements | Vehicle Loan Scheme');
  });
});
