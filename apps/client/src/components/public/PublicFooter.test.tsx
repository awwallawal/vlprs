import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PublicFooter } from './PublicFooter';

function renderFooter() {
  return render(
    <MemoryRouter>
      <PublicFooter />
    </MemoryRouter>
  );
}

describe('PublicFooter', () => {
  it('renders 4 column headings', () => {
    renderFooter();
    expect(screen.getByText('About & Scheme')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByText('Staff Portal')).toBeInTheDocument();
  });

  it('renders legal links', () => {
    renderFooter();
    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Accessibility')).toBeInTheDocument();
    expect(screen.getByText('Disclaimer')).toBeInTheDocument();
  });

  it('renders copyright notice', () => {
    renderFooter();
    expect(screen.getByText(/2026 Oyo State Government/)).toBeInTheDocument();
  });

  it('renders contact information', () => {
    renderFooter();
    expect(screen.getByText("Accountant-General's Office")).toBeInTheDocument();
    expect(screen.getByText(/carloan@oyo.gov.ng/)).toBeInTheDocument();
  });

  it('renders programme disclaimer', () => {
    renderFooter();
    expect(screen.getByText(/Vehicle Loan Processing/)).toBeInTheDocument();
  });
});
