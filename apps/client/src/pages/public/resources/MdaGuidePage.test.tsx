import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { MdaGuidePage } from './MdaGuidePage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/resources/submission-guide']}>
      <MdaGuidePage />
    </MemoryRouter>
  );
}

describe('MdaGuidePage', () => {
  it('renders the page header with H1', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'MDA Submission Guide' })
    ).toBeInTheDocument();
  });

  it('renders 8-field table with correct headers', () => {
    renderPage();
    expect(screen.getByText('Field Name')).toBeInTheDocument();
    expect(screen.getByText('Staff ID')).toBeInTheDocument();
    expect(screen.getByText('Amount Deducted')).toBeInTheDocument();
    expect(screen.getByText('Event Flag')).toBeInTheDocument();
    expect(screen.getByText('Deduction Cessation Reason')).toBeInTheDocument();
  });

  it('renders conditional field rules', () => {
    renderPage();
    expect(screen.getByText(/Event Effective Date is required/)).toBeInTheDocument();
  });

  it('renders 4 submission steps', () => {
    renderPage();
    expect(screen.getByText('Step-by-Step Process')).toBeInTheDocument();
    expect(screen.getByText('Fill in Staff Records')).toBeInTheDocument();
    expect(screen.getByText('Upload via VLPRS Portal')).toBeInTheDocument();
    expect(screen.getByText('Review Confirmation & Comparison Summary')).toBeInTheDocument();
  });

  it('renders screenshot placeholder', () => {
    renderPage();
    expect(screen.getByText(/Screenshots to be added/)).toBeInTheDocument();
  });

  it('renders sidebar quick reference', () => {
    renderPage();
    expect(screen.getByText('28th of each month')).toBeInTheDocument();
    expect(screen.getByText('.csv')).toBeInTheDocument();
  });

  it('sets page title', () => {
    renderPage();
    expect(document.title).toBe('MDA Submission Guide | Vehicle Loan Scheme');
  });
});
