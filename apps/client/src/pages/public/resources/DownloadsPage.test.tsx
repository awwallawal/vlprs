import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { DownloadsPage } from './DownloadsPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/resources/downloads']}>
      <DownloadsPage />
    </MemoryRouter>
  );
}

describe('DownloadsPage', () => {
  it('renders the page header with H1', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Downloads & Forms' })
    ).toBeInTheDocument();
  });

  it('renders 4 resource cards', () => {
    renderPage();
    expect(screen.getByText('CSV Submission Template')).toBeInTheDocument();
    expect(screen.getByText('Policy Summary')).toBeInTheDocument();
    expect(screen.getByText('MDA Officer Quick Reference Guide')).toBeInTheDocument();
    expect(screen.getByText('Training Materials')).toBeInTheDocument();
  });

  it('renders 1 downloadable and 3 coming soon', () => {
    renderPage();
    const downloadButtons = screen.getAllByText('Download');
    expect(downloadButtons).toHaveLength(1);
    const comingSoonBadges = screen.getAllByText('Coming Soon');
    expect(comingSoonBadges).toHaveLength(3);
  });

  it('renders format badges', () => {
    renderPage();
    const csvBadges = screen.getAllByText('CSV');
    expect(csvBadges.length).toBeGreaterThanOrEqual(1);
    const pdfBadges = screen.getAllByText('PDF');
    expect(pdfBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('sets page title', () => {
    renderPage();
    expect(document.title).toBe('Downloads & Forms | Vehicle Loan Scheme');
  });
});
