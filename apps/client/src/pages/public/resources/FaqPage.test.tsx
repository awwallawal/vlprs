import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { FaqPage } from './FaqPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/resources/faq']}>
      <FaqPage />
    </MemoryRouter>
  );
}

describe('FaqPage', () => {
  it('renders the page header with H1', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Frequently Asked Questions' })
    ).toBeInTheDocument();
  });

  it('renders 3 category tabs', () => {
    renderPage();
    expect(screen.getByText('For Beneficiaries')).toBeInTheDocument();
    expect(screen.getByText('For MDA Officers')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Search questions...')).toBeInTheDocument();
  });

  it('renders beneficiary questions by default (minimum 5)', () => {
    renderPage();
    expect(screen.getByText('How do I check my loan balance?')).toBeInTheDocument();
    expect(screen.getByText('What is an Auto-Stop Certificate?')).toBeInTheDocument();
    const accordionTriggers = screen.getAllByRole('button', { expanded: false });
    expect(accordionTriggers.length).toBeGreaterThanOrEqual(5);
  });

  it('filters questions by search query', async () => {
    const user = userEvent.setup();
    renderPage();
    const searchInput = screen.getByPlaceholderText('Search questions...');
    await user.type(searchInput, 'Auto-Stop');
    expect(screen.getByText('What is an Auto-Stop Certificate?')).toBeInTheDocument();
    expect(screen.queryByText('How do I check my loan balance?')).not.toBeInTheDocument();
  });

  it('shows empty message when search has no matches', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByPlaceholderText('Search questions...'), 'xyznonexistent');
    expect(screen.getByText(/No questions match your search/)).toBeInTheDocument();
  });

  it('sets page title', () => {
    renderPage();
    expect(document.title).toBe('FAQ | Vehicle Loan Scheme');
  });
});
