import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AboutPage } from './AboutPage';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/about']}>
      <AboutPage />
    </MemoryRouter>
  );
}

describe('AboutPage', () => {
  it('renders the page header with H1', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'About the Programme' })
    ).toBeInTheDocument();
  });

  it('renders Mission and Vision sections', () => {
    renderPage();
    expect(screen.getByText('Our Mission')).toBeInTheDocument();
    expect(screen.getByText('Our Vision')).toBeInTheDocument();
  });

  it('renders 5 Core Values as badges', () => {
    renderPage();
    expect(screen.getByText('Transparency')).toBeInTheDocument();
    expect(screen.getByText('Accountability')).toBeInTheDocument();
    expect(screen.getByText('Accuracy')).toBeInTheDocument();
    expect(screen.getByText('Fairness')).toBeInTheDocument();
    expect(screen.getByText('Institutional Trust')).toBeInTheDocument();
  });

  it('renders 6 programme leader cards with role, name, description', () => {
    renderPage();
    expect(screen.getByText('Accountant-General')).toBeInTheDocument();
    expect(screen.getByText('Mrs. K. A. Adegoke (FCA)')).toBeInTheDocument();
    expect(screen.getByText('Director, Finance and Accounts')).toBeInTheDocument();
    expect(screen.getByText('Director, Treasury')).toBeInTheDocument();
    expect(screen.getByText('Mrs. C. F. Fadipe')).toBeInTheDocument();
  });

  it('renders Programme Governance section', () => {
    renderPage();
    expect(screen.getByText('Programme Governance')).toBeInTheDocument();
    expect(screen.getByText('Vehicle Loan Committee')).toBeInTheDocument();
    expect(screen.getByText("AG's Office Role")).toBeInTheDocument();
  });

  it('renders Institutional Story section', () => {
    renderPage();
    expect(screen.getByText('Institutional Story')).toBeInTheDocument();
    expect(screen.getByText(/serves beneficiaries across all participating MDAs/)).toBeInTheDocument();
  });

  it('renders sidebar quick links', () => {
    renderPage();
    expect(screen.getByText('Eligibility & Loan Categories')).toBeInTheDocument();
    expect(screen.getByText('How It Works')).toBeInTheDocument();
  });

  it('renders authority callout in sidebar', () => {
    renderPage();
    expect(
      screen.getByText(/AG's Office is the authority/)
    ).toBeInTheDocument();
  });

  it('renders CTA banner', () => {
    renderPage();
    expect(screen.getByText('Ready to access VLPRS?')).toBeInTheDocument();
  });

  it('sets page title', () => {
    renderPage();
    expect(document.title).toBe('About the Programme | Vehicle Loan Scheme');
  });

  it('has single H1 and multiple H2s', () => {
    renderPage();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    const h2s = screen.getAllByRole('heading', { level: 2 });
    expect(h2s.length).toBeGreaterThanOrEqual(6);
  });
});
