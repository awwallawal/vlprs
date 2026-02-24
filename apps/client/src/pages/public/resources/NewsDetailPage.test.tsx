import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { NewsDetailPage } from './NewsDetailPage';

function renderPage(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/resources/news/${slug}`]}>
      <Routes>
        <Route path="/resources/news/:slug" element={<NewsDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('NewsDetailPage', () => {
  it('renders article title as H1 for valid slug', () => {
    renderPage('vlprs-platform-launch');
    expect(
      screen.getByRole('heading', { level: 1, name: 'VLPRS Digital Platform Launches for Oyo State' })
    ).toBeInTheDocument();
  });

  it('renders article body', () => {
    renderPage('vlprs-platform-launch');
    expect(screen.getByText(/digital platform replaces the previous/)).toBeInTheDocument();
  });

  it('renders back link', () => {
    renderPage('vlprs-platform-launch');
    expect(screen.getByText('← Back to News')).toBeInTheDocument();
  });

  it('sets dynamic page title', () => {
    renderPage('vlprs-platform-launch');
    expect(document.title).toBe(
      'VLPRS Digital Platform Launches for Oyo State | News | Vehicle Loan Scheme'
    );
  });

  it('redirects to /resources/news for an invalid slug', () => {
    render(
      <MemoryRouter initialEntries={['/resources/news/nonexistent-slug']}>
        <Routes>
          <Route path="/resources/news/:slug" element={<NewsDetailPage />} />
          <Route
            path="/resources/news"
            element={<p>News listing page</p>}
          />
        </Routes>
      </MemoryRouter>
    );
    // The component should redirect, so we land on the news listing route
    expect(screen.getByText('News listing page')).toBeInTheDocument();
  });
});
