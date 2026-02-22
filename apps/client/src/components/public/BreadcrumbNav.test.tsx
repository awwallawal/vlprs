import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { BreadcrumbNav } from './BreadcrumbNav';

function renderBreadcrumb(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <BreadcrumbNav />
    </MemoryRouter>
  );
}

describe('BreadcrumbNav', () => {
  it('renders nothing on the homepage', () => {
    const { container } = renderBreadcrumb('/');
    expect(container.querySelector('nav')).toBeNull();
  });

  it('renders Home > About for /about', () => {
    renderBreadcrumb('/about');
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('renders nested path correctly', () => {
    renderBreadcrumb('/scheme/eligibility');
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('The Scheme')).toBeInTheDocument();
    expect(screen.getByText('Eligibility & Loan Categories')).toBeInTheDocument();
  });

  it('last breadcrumb item is not a link', () => {
    renderBreadcrumb('/about');
    const aboutElement = screen.getByText('About');
    expect(aboutElement.closest('a')).toBeNull();
  });
});
